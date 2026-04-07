import * as vscode from "vscode";
import type { AIProvider, AIProviderStatus } from "../ai/index.js";
import type { TourPlayer } from "../views/tour-player/tour-player.js";
import * as tourStore from "../engine/tour-store.js";
import * as statusBar from "../views/status-bar.js";
import { requireClaude } from "./preflight.js";

export function registerExploreAtlasCommand(
  context: vscode.ExtensionContext,
  getAdapter: () => AIProvider,
  player: TourPlayer,
  workspaceRoot: string,
  checkClaude: () => Promise<AIProviderStatus>
): void {
  let generating = false;

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "sideBae.exploreAtlas",
      async (forceRegenerate?: boolean) => {
        // Check for cached atlas first (unless forcing regeneration)
        if (!forceRegenerate) {
          const cached = await tourStore.loadAtlas(workspaceRoot);
          if (cached) {
            player.showCachedAtlas(cached);
            return;
          }
        }

        if (generating) {
          vscode.window.showWarningMessage(
            "Atlas is still generating. Wait for it to finish, or close the panel to cancel."
          );
          return;
        }
        generating = true;

        try {
          if (!(await requireClaude(checkClaude))) return;

          statusBar.show("Exploring codebase...");
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Side Bae",
              cancellable: true,
            },
            async (progress, token) => {
              try {
                const adapter = getAdapter();

                progress.report({ message: "Scanning codebase..." });

                await player.startAtlas(adapter);

                if (token.isCancellationRequested) {
                  vscode.window.showInformationMessage("Atlas generation cancelled.");
                  return;
                }

                vscode.commands.executeCommand("sideBae.refreshFeatures");
              } catch (err) {
                if (token.isCancellationRequested) {
                  vscode.window.showInformationMessage("Atlas generation cancelled.");
                  return;
                }
                const message = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Atlas failed: ${message}`);
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
