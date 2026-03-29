import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ClaudeAdapter, ClaudeStatus } from "../claude/adapter.js";
import * as tourStore from "../engine/tour-store.js";
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
  getAdapter: () => ClaudeAdapter,
  player: TourPlayer,
  workspaceRoot: string,
  checkClaude: () => Promise<ClaudeStatus>
): void {
  let investigating = false;

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "sideBae.investigateIssue",
      async () => {
        if (investigating) {
          vscode.window.showWarningMessage("An investigation is already in progress.");
          return;
        }
        if (!(await requireClaude(checkClaude))) return;

        const input = await vscode.window.showInputBox({
          prompt: "Paste a GitHub issue URL or describe the bug",
          placeHolder:
            "e.g., https://github.com/org/repo/issues/42 or 'login times out under load'",
        });

        if (!input) return;

        let issueTitle: string;
        let issueBody: string;

        if (isGitHubIssueUrl(input)) {
          const issue = await fetchGitHubIssue(input, workspaceRoot);
          if (!issue) {
            vscode.window.showErrorMessage(
              "Failed to fetch issue. Make sure the `gh` CLI is installed and authenticated."
            );
            return;
          }
          issueTitle = issue.title;
          issueBody = issue.body;
        } else {
          issueTitle = input;
          issueBody = input;
        }

        investigating = true;
        try {
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Side Bae",
              cancellable: true,
            },
            async (progress, token) => {
              try {
                const adapter = getAdapter();
                const tour = await adapter.investigateIssue(
                  issueTitle,
                  issueBody,
                  {
                    onProgress: (msg) => progress.report({ message: msg }),
                    onCancel: (callback) =>
                      token.onCancellationRequested(callback),
                  }
                );

                await tourStore.saveTour(workspaceRoot, tour);
                vscode.commands.executeCommand("sideBae.refreshFeatures");

                await player.startTour(tour);

                const solutionCount = Object.values(tour.nodes).filter(
                  (n) => n.kind === "solution"
                ).length;
                const fixLabel =
                  solutionCount > 0
                    ? `, ${solutionCount} suggested fix${solutionCount === 1 ? "" : "es"}`
                    : "";
                vscode.window.showInformationMessage(
                  `Investigation ready \u2014 ${Object.keys(tour.nodes).length} stops${fixLabel}.`
                );
              } catch (err) {
                if (token.isCancellationRequested) {
                  vscode.window.showInformationMessage(
                    "Investigation cancelled."
                  );
                  return;
                }
                const message =
                  err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(
                  `Failed to investigate: ${message}`
                );
              }
            }
          );
        } finally {
          investigating = false;
        }
      }
    )
  );
}
