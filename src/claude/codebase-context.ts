/**
 * Lightweight codebase context scanner.
 *
 * Produces a compact structural map of the workspace (<100ms, <1K tokens)
 * so prompts can guide Claude to the right files instead of blind exploration.
 *
 * Inspired by Aider's repo-map approach:
 * @see https://aider.chat/docs/repomap.html
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface CodebaseContext {
  fileTree: string;
  entryPoints: string[];
  directories: DirSummary[];
  totalFiles: number;
  packageName?: string;
  description?: string;
}

interface DirSummary {
  name: string;
  fileCount: number;
}

// Directories always skipped regardless of .gitignore
const ALWAYS_SKIP = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".output",
  "coverage",
  ".side-bae",
  ".side-chick",
  "__pycache__",
  ".cache",
  ".turbo",
  ".vercel",
  ".svelte-kit",
]);

// File patterns to skip
const SKIP_EXTENSIONS = new Set([
  ".map",
  ".lock",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
]);

/** Files that indicate project entry points */
const ENTRY_PATTERNS = [
  "src/index.ts",
  "src/index.js",
  "src/main.ts",
  "src/main.js",
  "src/app.ts",
  "src/app.js",
  "src/extension.ts",
  "index.ts",
  "index.js",
  "main.ts",
  "main.js",
  "app.ts",
  "app.js",
];

// Thresholds for adaptive output
const FULL_TREE_MAX_FILES = 200;
const DIR_SUMMARY_MAX_FILES = 2000;

let cached: { root: string; ctx: CodebaseContext } | null = null;

/**
 * Build a lightweight structural map of the codebase.
 * Results are cached per workspace root for the lifetime of the process.
 */
export async function buildCodebaseContext(
  workspaceRoot: string
): Promise<CodebaseContext> {
  if (cached && cached.root === workspaceRoot) {
    return cached.ctx;
  }

  const files: string[] = [];
  const dirCounts = new Map<string, number>();

  walkDir(workspaceRoot, workspaceRoot, files, dirCounts, 0);

  const entryPoints = findEntryPoints(workspaceRoot, files);
  const directories = buildDirSummaries(dirCounts);
  const fileTree = buildFileTree(files, directories);
  const pkg = readPackageJson(workspaceRoot);

  const ctx: CodebaseContext = {
    fileTree,
    entryPoints,
    directories,
    totalFiles: files.length,
    packageName: pkg?.name,
    description: pkg?.description,
  };

  cached = { root: workspaceRoot, ctx };
  return ctx;
}

/** Clear the cached context (e.g., after major file changes). */
export function clearCodebaseContextCache(): void {
  cached = null;
}

/** Format context for prompt injection (~200-800 tokens depending on repo size). */
export function formatContextForPrompt(ctx: CodebaseContext): string {
  const lines: string[] = [];

  if (ctx.packageName) {
    lines.push(
      `Project: ${ctx.packageName}${ctx.description ? ` — ${ctx.description}` : ""}`
    );
  }

  lines.push(`${ctx.totalFiles} source files.\n`);
  lines.push("Structure:");
  lines.push(ctx.fileTree);

  if (ctx.entryPoints.length > 0) {
    lines.push(`\nEntry points: ${ctx.entryPoints.join(", ")}`);
  }

  return lines.join("\n");
}

// ── Internal helpers ──

function walkDir(
  root: string,
  dir: string,
  files: string[],
  dirCounts: Map<string, number>,
  depth: number
): void {
  if (depth > 6) return; // Hard depth limit
  if (files.length > DIR_SUMMARY_MAX_FILES) return; // Hard file limit

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // Permission denied, etc.
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;

    if (entry.isDirectory()) {
      if (ALWAYS_SKIP.has(entry.name)) continue;
      walkDir(root, path.join(dir, entry.name), files, dirCounts, depth + 1);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SKIP_EXTENSIONS.has(ext)) continue;

      const relPath = path.relative(root, path.join(dir, entry.name));
      files.push(relPath);

      // Count files per top-level directory
      const topDir = relPath.split(path.sep)[0] ?? "";
      if (topDir && topDir !== entry.name) {
        dirCounts.set(topDir, (dirCounts.get(topDir) ?? 0) + 1);
      }
    }
  }
}

function findEntryPoints(root: string, files: string[]): string[] {
  const found: string[] = [];

  // Check package.json main/module
  const pkg = readPackageJson(root);
  if (pkg?.main) found.push(pkg.main);
  if (pkg?.module && pkg.module !== pkg.main) found.push(pkg.module);

  // Check common entry patterns
  const fileSet = new Set(files.map((f) => f.replace(/\\/g, "/")));
  for (const pattern of ENTRY_PATTERNS) {
    if (fileSet.has(pattern) && !found.includes(pattern)) {
      found.push(pattern);
    }
  }

  return found.slice(0, 5); // Max 5 entry points
}

function buildDirSummaries(
  dirCounts: Map<string, number>
): DirSummary[] {
  return [...dirCounts.entries()]
    .map(([name, fileCount]) => ({ name, fileCount }))
    .sort((a, b) => b.fileCount - a.fileCount);
}

function buildFileTree(
  files: string[],
  directories: DirSummary[]
): string {
  // For large repos, show only directory summaries
  if (files.length > FULL_TREE_MAX_FILES) {
    const lines: string[] = [];
    for (const dir of directories) {
      lines.push(`  ${dir.name}/  (${dir.fileCount} files)`);
    }
    // Show root-level files
    const rootFiles = files.filter((f) => !f.includes(path.sep));
    for (const f of rootFiles.slice(0, 10)) {
      lines.push(`  ${f}`);
    }
    if (rootFiles.length > 10) {
      lines.push(`  ... and ${rootFiles.length - 10} more root files`);
    }
    return lines.join("\n");
  }

  // For small/medium repos, build a tree
  const tree = new Map<string, string[]>();
  const rootFiles: string[] = [];

  for (const file of files) {
    const parts = file.split(path.sep);
    if (parts.length === 1) {
      rootFiles.push(file);
    } else {
      const dir = parts.slice(0, -1).join("/");
      const existing = tree.get(dir) ?? [];
      existing.push(parts[parts.length - 1]!);
      tree.set(dir, existing);
    }
  }

  const lines: string[] = [];

  // Sort directories, show files inside each
  const sortedDirs = [...tree.keys()].sort();
  for (const dir of sortedDirs) {
    const dirFiles = tree.get(dir)!;
    lines.push(`  ${dir}/`);
    // Show up to 15 files per dir, then truncate
    const shown = dirFiles.slice(0, 15);
    for (const f of shown) {
      lines.push(`    ${f}`);
    }
    if (dirFiles.length > 15) {
      lines.push(`    ... +${dirFiles.length - 15} more`);
    }
  }

  // Root-level files
  for (const f of rootFiles.slice(0, 10)) {
    lines.push(`  ${f}`);
  }

  return lines.join("\n");
}

function readPackageJson(
  root: string
): { name?: string; description?: string; main?: string; module?: string } | null {
  try {
    const raw = fs.readFileSync(path.join(root, "package.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
