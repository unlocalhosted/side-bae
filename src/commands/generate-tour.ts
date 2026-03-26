import * as vscode from "vscode";
import type { ClaudeAdapter } from "../claude/adapter.js";
import * as tourStore from "../engine/tour-store.js";
import type { TourPlayer } from "../views/tour-player/tour-player.js";

export function registerGenerateTourCommand(
  context: vscode.ExtensionContext,
  getAdapter: () => ClaudeAdapter,
  player: TourPlayer,
  workspaceRoot: string
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "sideChick.generateTour",
      async (featureName?: string) => {
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

  context.subscriptions.push(
    vscode.commands.registerCommand("sideChick.askQuestion", async () => {
      const query = await vscode.window.showInputBox({
        prompt: "Ask anything about this codebase",
        placeHolder:
          "e.g., where does the user object get the role field before hitting billing?",
      });
      if (query) {
        vscode.commands.executeCommand("sideChick.generateTour", query);
      }
    })
  );
}
