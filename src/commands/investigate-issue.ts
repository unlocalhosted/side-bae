import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AIProvider, AIProviderStatus } from "../ai/index.js";
import type { TourPlayer } from "../views/tour-player/tour-player.js";
import { requireClaude } from "./preflight.js";

const execFileAsync = promisify(execFile);

function isGitHubIssueUrl(input: string): boolean {
  return /github\.com\/.+\/.+\/issues\/\d+/.test(input);
}

async function fetchGitHubIssue(
  url: string,
  workspaceRoot: string
): Promise<{ title: string; body: string } | null> {
  try {
    const { stdout } = await execFileAsync(
      "gh",
      ["issue", "view", url, "--json", "title,body,comments"],
      { encoding: "utf-8", cwd: workspaceRoot, timeout: 15000 }
    );
    const data = JSON.parse(stdout) as {
      title: string;
      body: string;
      comments?: Array<{ body: string }>;
    };
    let body = data.body ?? "";
    if (data.comments?.length) {
      body +=
        "\n\n--- Comments ---\n" +
        data.comments.map((c) => c.body).join("\n---\n");
    }
    return { title: data.title, body };
  } catch {
    return null;
  }
}

export function registerInvestigateIssueCommand(
  context: vscode.ExtensionContext,
  getAdapter: () => AIProvider,
  player: TourPlayer,
  workspaceRoot: string,
  checkClaude: () => Promise<AIProviderStatus>
): void {
  let investigating = false;

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "sideBae.investigateIssue",
      async () => {
        if (investigating) {
          vscode.window.showWarningMessage("An investigation is already running. Close the panel first to start a new one.");
          return;
        }
        investigating = true;

        try {
          if (!(await requireClaude(checkClaude))) return;

          const input = await vscode.window.showInputBox({
            prompt: "Paste a GitHub issue URL or describe the bug",
            placeHolder:
              "e.g., https://github.com/org/repo/issues/42 or 'login times out under load'",
          });

          const trimmedInput = input?.trim();
          if (!trimmedInput) return;

          let issueTitle: string;
          let issueBody: string;

          if (isGitHubIssueUrl(trimmedInput)) {
            const issue = await fetchGitHubIssue(trimmedInput, workspaceRoot);
            if (!issue) {
              vscode.window.showErrorMessage(
                "Could not fetch that issue. Check that the GitHub CLI (gh) is installed and you're logged in — run `gh auth login` in your terminal."
              );
              return;
            }
            issueTitle = issue.title;
            issueBody = issue.body;
          } else {
            issueTitle = trimmedInput.slice(0, 200);
            issueBody = trimmedInput.slice(0, 10000);
          }

          await player.startInvestigation(getAdapter(), issueTitle, issueBody);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Failed to start investigation: ${message}`);
        } finally {
          investigating = false;
        }
      }
    )
  );
}
