import * as vscode from "vscode";
import type { AIProvider, AIProviderStatus } from "../ai/index.js";
import * as tourStore from "../engine/tour-store.js";
import type { TourPlayer } from "../views/tour-player/tour-player.js";
import * as statusBar from "../views/status-bar.js";
import { requireClaude } from "./preflight.js";

export function registerGenerateTourCommand(
  context: vscode.ExtensionContext,
  getAdapter: () => AIProvider,
  player: TourPlayer,
  workspaceRoot: string,
  checkClaude: () => Promise<AIProviderStatus>
): void {
  let generating = false;

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "sideBae.generateTour",
      async (featureName?: string) => {
        if (generating) {
          vscode.window.showWarningMessage(
            "A tour is still generating. Wait for it to finish, or close the panel to cancel."
          );
          return;
        }
        generating = true;

        try {
          if (!(await requireClaude(checkClaude))) return;

          const query =
            featureName ??
            (await vscode.window.showInputBox({
              prompt: "What do you want to understand about this codebase?",
              placeHolder: "e.g., how does authentication work?",
            }));

          if (!query) return;

          statusBar.show("Generating tour...");
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Side Bae",
              cancellable: true,
            },
            async (progress, token) => {
              try {
                const adapter = getAdapter();
                const tour = await adapter.generateTour(query, {
                  onProgress: (msg) => {
                    progress.report({ message: msg });
                    statusBar.show(msg);
                  },
                  onCancel: (callback) =>
                    token.onCancellationRequested(callback),
                });

                await tourStore.saveTour(workspaceRoot, tour);
                vscode.commands.executeCommand("sideBae.refreshFeatures");

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
        } finally {
          generating = false;
          statusBar.hide();
        }
      }
    )
  );
}
