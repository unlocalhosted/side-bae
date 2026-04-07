import * as vscode from "vscode";
import type { TourPlayer } from "../views/tour-player/tour-player.js";
import * as tourStore from "../engine/tour-store.js";

export function registerNavigationCommands(
  context: vscode.ExtensionContext,
  player: TourPlayer,
  workspaceRoot: string
): void {
  context.subscriptions.push(
    // Start a saved tour via QuickPick
    vscode.commands.registerCommand("sideBae.startTour", async () => {
      const tours = await tourStore.listTours(workspaceRoot);

      if (tours.length === 0) {
        const action = await vscode.window.showInformationMessage(
          "No saved tours found. Generate one first?",
          "Generate Tour"
        );
        if (action === "Generate Tour") {
          vscode.commands.executeCommand("sideBae.generateTour");
        }
        return;
      }

      const picked = await vscode.window.showQuickPick(
        tours.map((t) => ({
          label: t.name,
          description: t.query,
          detail: `Generated: ${new Date(t.generatedAt).toLocaleDateString()}`,
          tourId: t.id,
        })),
        { placeHolder: "Select a tour to start" }
      );

      if (!picked) return;

      try {
        const tour = await tourStore.loadTour(workspaceRoot, picked.tourId);
        await player.startTour(tour);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to load tour: ${message}`);
      }
    }),

    // Open a specific tour by ID (from tree view click)
    vscode.commands.registerCommand(
      "sideBae.openTour",
      async (tourId: string) => {
        try {
          const tour = await tourStore.loadTour(workspaceRoot, tourId);
          await player.startTour(tour);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Failed to load tour: ${message}`);
        }
      }
    ),

    // Next Stop — pick an edge from the current node via QuickPick
    vscode.commands.registerCommand("sideBae.nextEdge", async () => {
      if (!player.isActive()) {
        vscode.window.showInformationMessage(
          "No active tour. Start one from the sidebar or press " + (process.platform === "darwin" ? "\u2318\u21E7T" : "Ctrl+Shift+T") + "."
        );
        return;
      }

      const edges = player.getAvailableEdges();
      if (edges.length === 0) {
        vscode.window.showInformationMessage(
          "End of this branch. Press Back to explore other paths."
        );
        return;
      }

      // If only one edge, navigate directly
      if (edges.length === 1) {
        await player.navigateToNode(edges[0]!.target);
        return;
      }

      // Multiple edges — let the user pick
      const picked = await vscode.window.showQuickPick(
        edges.map((e) => ({
          label: e.label,
          targetId: e.target,
        })),
        { placeHolder: "Pick a path to follow" }
      );

      if (picked) {
        await player.navigateToNode(picked.targetId);
      }
    }),

    // Go back in history
    vscode.commands.registerCommand("sideBae.previousNode", async () => {
      if (!player.isActive()) return;
      await player.goBack();
    }),

    // Go forward in history
    vscode.commands.registerCommand("sideBae.goForward", async () => {
      if (!player.isActive()) return;
      await player.goForward();
    }),

    // Stop tour
    vscode.commands.registerCommand("sideBae.stopTour", () => {
      if (!player.isActive()) return;
      player.stopTour();
    })
  );
}
