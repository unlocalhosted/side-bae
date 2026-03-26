import * as vscode from "vscode";
import type { ClaudeAdapter, ClaudeStatus } from "../claude/adapter.js";
import * as tourStore from "../engine/tour-store.js";
import type { TourPlayer } from "../views/tour-player/tour-player.js";

export function registerGenerateTourCommand(
  context: vscode.ExtensionContext,
  getAdapter: () => ClaudeAdapter,
  player: TourPlayer,
  workspaceRoot: string,
  checkClaude?: () => Promise<ClaudeStatus>
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "sideChick.generateTour",
      async (featureName?: string) => {
        // Pre-flight Claude check
        if (checkClaude) {
          const status = await checkClaude();
          if (!status.available) {
            vscode.window.showErrorMessage(
              "Claude CLI is not installed. Visit https://docs.anthropic.com/en/docs/claude-code"
            );
            return;
          }
          if (!status.authenticated) {
            const action = await vscode.window.showErrorMessage(
              "Claude CLI is not logged in. Run 'claude login' in your terminal.",
              "Open Terminal"
            );
            if (action === "Open Terminal") {
              const terminal = vscode.window.createTerminal("Claude Login");
              terminal.show();
              terminal.sendText("claude login");
            }
            return;
          }
        }

        const query =
          featureName ??
          (await vscode.window.showInputBox({
            prompt: "What do you want to understand about this codebase?",
            placeHolder: "e.g., how does authentication work?",
          }));

        if (!query) return;

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Side Chick",
            cancellable: true,
          },
          async (progress, token) => {
            try {
              const adapter = getAdapter();
              const tour = await adapter.generateTour(query, {
                onProgress: (msg) => progress.report({ message: msg }),
                onCancel: (callback) =>
                  token.onCancellationRequested(callback),
              });

              await tourStore.saveTour(workspaceRoot, tour);
              vscode.commands.executeCommand("setContext", "sideChick.hasTours", true);
              vscode.commands.executeCommand("sideChick.refreshFeatures");

              await player.startTour(tour);

              vscode.window.showInformationMessage(
                `Tour "${tour.name}" ready — ${Object.keys(tour.nodes).length} stops across ${new Set(Object.values(tour.nodes).map((n) => n.file)).size} files.`
              );
            } catch (err) {
              if (token.isCancellationRequested) {
                vscode.window.showInformationMessage(
                  "Tour generation cancelled."
                );
                return;
              }
              const message =
                err instanceof Error ? err.message : String(err);
              vscode.window.showErrorMessage(
                `Failed to generate tour: ${message}`
              );
            }
          }
        );
      }
    )
  );

  // sideChick.askQuestion removed — merged into generateTour (one command, one input box)
}
