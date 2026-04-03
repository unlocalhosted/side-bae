/**
 * Tool definitions and safe local execution for the VS Code LM provider.
 *
 * Follows Roo Code's pattern of passing native tools to the VS Code LM API
 * with JSON Schema draft 2020-12 normalization.
 *
 * All tool execution is local and read-only. The git tool is restricted
 * to a safe allowlist of read-only commands.
 */

import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Tool definitions for the VS Code Language Model API. */
export const WORKSPACE_TOOLS: vscode.LanguageModelChatTool[] = [
  {
    name: "readFile",
    description:
      "Read the contents of a file in the workspace. Returns the file text. Use startLine/endLine to read a specific range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string" as const,
          description: "Relative path from workspace root",
        },
        startLine: {
          type: "number" as const,
          description: "Optional 1-based start line",
        },
        endLine: {
          type: "number" as const,
          description: "Optional 1-based end line",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "searchFiles",
    description:
      "Search for a regex pattern across files in the workspace. Returns matching lines with file paths and line numbers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string" as const,
          description: "Regex pattern to search for",
        },
        glob: {
          type: "string" as const,
          description: "File glob filter (e.g., '*.ts', 'src/**/*.js')",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "listFiles",
    description:
      "List files matching a glob pattern in the workspace. Returns an array of relative paths.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string" as const,
          description: "Glob pattern (e.g., 'src/**/*.ts')",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "gitCommand",
    description:
      "Run a read-only git command. Only git log, git show, git diff, and git shortlog are allowed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        args: {
          type: "string" as const,
          description:
            "Git subcommand and arguments (e.g., 'log --oneline -10', 'diff HEAD~3')",
        },
      },
      required: ["args"],
    },
  },
];

/** Safe git subcommands — read-only operations only. */
const ALLOWED_GIT_COMMANDS = new Set(["log", "show", "diff", "shortlog", "blame", "rev-parse"]);

/**
 * Execute a tool call locally. All operations are read-only.
 * Returns the tool output as a string.
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  workspaceRoot: string
): Promise<string> {
  switch (name) {
    case "readFile":
      return executeReadFile(input, workspaceRoot);
    case "searchFiles":
      return executeSearchFiles(input, workspaceRoot);
    case "listFiles":
      return executeListFiles(input, workspaceRoot);
    case "gitCommand":
      return executeGitCommand(input, workspaceRoot);
    default:
      return `Unknown tool: ${name}`;
  }
}

/** Human-friendly label for progress reporting. */
export function describeToolCall(
  name: string,
  input: Record<string, unknown>
): string {
  switch (name) {
    case "readFile":
      return `Reading ${shortPath(String(input.path ?? ""))}`;
    case "searchFiles":
      return `Searching for ${String(input.pattern ?? "")}`;
    case "listFiles":
      return `Scanning ${String(input.pattern ?? "")}`;
    case "gitCommand":
      return `Running git ${String(input.args ?? "").split(" ")[0]}`;
    default:
      return name;
  }
}

function shortPath(path: string): string {
  if (!path) return "";
  const parts = path.replace(/\\/g, "/").split("/");
  return parts.length > 2 ? parts.slice(-2).join("/") : path;
}

async function executeReadFile(
  input: Record<string, unknown>,
  workspaceRoot: string
): Promise<string> {
  const relPath = String(input.path ?? "");
  if (!relPath) return "Error: path is required";

  const absPath = join(workspaceRoot, relPath);
  // Prevent path traversal
  if (!absPath.startsWith(workspaceRoot)) {
    return "Error: path must be within the workspace";
  }

  try {
    const content = await fs.readFile(absPath, "utf-8");
    const startLine = typeof input.startLine === "number" ? input.startLine : undefined;
    const endLine = typeof input.endLine === "number" ? input.endLine : undefined;

    if (startLine !== undefined || endLine !== undefined) {
      const lines = content.split("\n");
      const start = Math.max(0, (startLine ?? 1) - 1);
      const end = endLine ?? lines.length;
      return lines.slice(start, end).join("\n");
    }

    // Truncate very large files
    if (content.length > 50_000) {
      return content.slice(0, 50_000) + "\n\n[...truncated at 50KB]";
    }

    return content;
  } catch {
    return `Error: Could not read ${relPath}`;
  }
}

async function executeSearchFiles(
  input: Record<string, unknown>,
  workspaceRoot: string
): Promise<string> {
  const pattern = String(input.pattern ?? "");
  if (!pattern) return "Error: pattern is required";

  const glob = input.glob ? String(input.glob) : "**/*";

  try {
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceRoot, glob),
      "**/node_modules/**",
      100
    );

    const regex = new RegExp(pattern, "gi");
    const results: string[] = [];
    let matchCount = 0;

    for (const file of files) {
      if (matchCount >= 200) break;
      try {
        const content = await fs.readFile(file.fsPath, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i]!)) {
            const relPath = vscode.workspace.asRelativePath(file);
            results.push(`${relPath}:${i + 1}: ${lines[i]!.trim()}`);
            matchCount++;
            if (matchCount >= 200) break;
          }
          regex.lastIndex = 0; // Reset for global regex
        }
      } catch {
        // Skip unreadable files
      }
    }

    return results.length > 0
      ? results.join("\n")
      : `No matches found for pattern "${pattern}"`;
  } catch (err) {
    return `Error searching: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeListFiles(
  input: Record<string, unknown>,
  workspaceRoot: string
): Promise<string> {
  const pattern = String(input.pattern ?? "**/*");

  try {
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceRoot, pattern),
      "**/node_modules/**",
      500
    );

    const paths = files.map((f) => vscode.workspace.asRelativePath(f)).sort();
    return paths.length > 0
      ? paths.join("\n")
      : `No files found matching "${pattern}"`;
  } catch (err) {
    return `Error listing files: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeGitCommand(
  input: Record<string, unknown>,
  workspaceRoot: string
): Promise<string> {
  const args = String(input.args ?? "").trim();
  if (!args) return "Error: args is required";

  const parts = args.split(/\s+/);
  const subcommand = parts[0];
  if (!subcommand || !ALLOWED_GIT_COMMANDS.has(subcommand)) {
    return `Error: Only these git commands are allowed: ${[...ALLOWED_GIT_COMMANDS].join(", ")}`;
  }

  try {
    const { stdout, stderr } = await execFileAsync("git", parts, {
      cwd: workspaceRoot,
      encoding: "utf-8",
      timeout: 15_000,
      maxBuffer: 512 * 1024,
    });

    const output = (stdout + (stderr ? `\n${stderr}` : "")).trim();
    // Truncate large git output
    if (output.length > 30_000) {
      return output.slice(0, 30_000) + "\n\n[...truncated]";
    }
    return output || "(no output)";
  } catch (err) {
    return `Error running git ${subcommand}: ${err instanceof Error ? err.message : String(err)}`;
  }
}
