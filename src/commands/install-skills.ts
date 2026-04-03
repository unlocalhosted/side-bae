import * as vscode from "vscode";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const SKILL_DIR_NAME = "skills";

/** Map skill source filenames to Claude Code command names. */
const SKILL_FILES: Record<string, string> = {
  "generate-tour.md": "side-bae-tour.md",
  "generate-lesson.md": "side-bae-lesson.md",
  "discover-features.md": "side-bae-features.md",
  "discover-concepts.md": "side-bae-concepts.md",
  "whats-new.md": "side-bae-whats-new.md",
};

const STATE_KEY_GLOBAL = "sideBae.skillFilesHash.global";
const STATE_KEY_PROJECT = "sideBae.skillFilesHash.project";

type InstallTarget = "global" | "project";

function getTargetDir(target: InstallTarget, workspaceRoot?: string): string {
  if (target === "global") {
    return join(homedir(), ".claude", "commands");
  }
  return join(workspaceRoot!, ".claude", "commands");
}

/** Compute a hash of all bundled skill files to detect changes across extension versions. */
async function computeSkillFilesHash(extensionPath: string): Promise<string> {
  const skillDir = join(extensionPath, SKILL_DIR_NAME);
  const hash = createHash("sha256");

  const sourceFiles = Object.keys(SKILL_FILES).sort();
  for (const file of sourceFiles) {
    try {
      const content = await readFile(join(skillDir, file), "utf-8");
      hash.update(file);
      hash.update(content);
    } catch {
      // File missing from bundle — skip
    }
  }

  return hash.digest("hex").slice(0, 16);
}

/** Check if any side-bae skill files exist in a target directory. */
async function hasInstalledSkillFiles(targetDir: string): Promise<boolean> {
  for (const targetFile of Object.values(SKILL_FILES)) {
    try {
      await stat(join(targetDir, targetFile));
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function installSkillFiles(
  extensionPath: string,
  targetDir: string
): Promise<number> {
  const skillSourceDir = join(extensionPath, SKILL_DIR_NAME);
  const sourceFiles = await readdir(skillSourceDir);
  const skillFiles = sourceFiles.filter((f) => f in SKILL_FILES);

  if (skillFiles.length === 0) return 0;

  await mkdir(targetDir, { recursive: true });

  let installed = 0;
  for (const sourceFile of skillFiles) {
    const content = await readFile(join(skillSourceDir, sourceFile), "utf-8");
    const targetFile = SKILL_FILES[sourceFile]!;
    await writeFile(join(targetDir, targetFile), content, "utf-8");
    installed++;
  }

  return installed;
}

/** Check for stale skill files on activation and prompt user to update. */
export async function checkSkillFilesForUpdates(
  context: vscode.ExtensionContext,
  workspaceRoot: string
): Promise<void> {
  const currentHash = await computeSkillFilesHash(context.extensionPath);

  // Check global install
  const globalDir = getTargetDir("global");
  const globalInstalledHash = context.globalState.get<string>(STATE_KEY_GLOBAL);
  if (globalInstalledHash && globalInstalledHash !== currentHash) {
    const hasFiles = await hasInstalledSkillFiles(globalDir);
    if (hasFiles) {
      promptUpdate(context, "global", globalDir, currentHash, workspaceRoot);
    }
  }

  // Check project install
  const projectDir = getTargetDir("project", workspaceRoot);
  const projectInstalledHash = context.workspaceState.get<string>(STATE_KEY_PROJECT);
  if (projectInstalledHash && projectInstalledHash !== currentHash) {
    const hasFiles = await hasInstalledSkillFiles(projectDir);
    if (hasFiles) {
      promptUpdate(context, "project", projectDir, currentHash, workspaceRoot);
    }
  }
}

async function promptUpdate(
  context: vscode.ExtensionContext,
  target: InstallTarget,
  targetDir: string,
  currentHash: string,
  _workspaceRoot: string
): Promise<void> {
  const location = target === "global" ? "global" : "project";
  const action = await vscode.window.showInformationMessage(
    `Side Bae skill files have been updated. Update your ${location} install?`,
    "Update",
    "Dismiss"
  );

  if (action !== "Update") return;

  try {
    const count = await installSkillFiles(context.extensionPath, targetDir);
    if (target === "global") {
      await context.globalState.update(STATE_KEY_GLOBAL, currentHash);
    } else {
      await context.workspaceState.update(STATE_KEY_PROJECT, currentHash);
    }
    vscode.window.showInformationMessage(`Updated ${count} skill files.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to update skill files: ${message}`);
  }
}

export function registerInstallSkillsCommand(
  context: vscode.ExtensionContext,
  workspaceRoot: string
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("sideBae.installSkillFiles", async () => {
      const choice = await vscode.window.showQuickPick(
        [
          {
            label: "$(home) Install globally",
            description: "~/.claude/commands/ — works in every project",
            detail: "Skill commands will be available as /side-bae-tour, /side-bae-lesson, etc. in Claude Code across all projects.",
            target: "global" as InstallTarget,
          },
          {
            label: "$(folder) Install for this project",
            description: ".claude/commands/ — shareable via git",
            detail: "Skill commands will be available only in this workspace. Commit .claude/commands/ to share with your team.",
            target: "project" as InstallTarget,
          },
        ],
        {
          placeHolder: "Where should the skill files be installed?",
        }
      );

      if (!choice) return;

      const target = (choice as { target: InstallTarget }).target;
      const targetDir = getTargetDir(target, workspaceRoot);

      try {
        const count = await installSkillFiles(context.extensionPath, targetDir);

        if (count === 0) {
          vscode.window.showErrorMessage("No skill files found in extension bundle.");
          return;
        }

        // Save the hash so we can detect when files become stale
        const currentHash = await computeSkillFilesHash(context.extensionPath);
        if (target === "global") {
          await context.globalState.update(STATE_KEY_GLOBAL, currentHash);
        } else {
          await context.workspaceState.update(STATE_KEY_PROJECT, currentHash);
        }

        const location = target === "global"
          ? "~/.claude/commands/"
          : ".claude/commands/";

        const commands = Object.values(SKILL_FILES)
          .map((f) => `/${f.replace(".md", "")}`)
          .join(", ");

        vscode.window.showInformationMessage(
          `Installed ${count} skill files to ${location}. Available as: ${commands}`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to install skill files: ${message}`);
      }
    })
  );
}
