import * as vscode from "vscode";
import type { ClaudeAdapter, ClaudeStatus } from "../claude/adapter.js";
import type { TourPlayer } from "../views/tour-player/tour-player.js";
import { requireClaude } from "./preflight.js";

export function registerStartLessonCommand(
  context: vscode.ExtensionContext,
  getAdapter: () => ClaudeAdapter,
  player: TourPlayer,
  checkClaude: () => Promise<ClaudeStatus>
): void {
  let generating = false;

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "sideBae.startLesson",
      async (conceptName?: string, entryFile?: string) => {
        if (generating) {
          vscode.window.showWarningMessage(
            "A lesson is already active."
          );
          return;
        }
        generating = true;

        try {
          if (!(await requireClaude(checkClaude))) return;

          const subject =
            conceptName ??
            (await vscode.window.showInputBox({
              prompt: "What do you want to learn about in this codebase?",
              placeHolder: "e.g., how the virtual scroll engine works",
            }));

          if (!subject) return;

          await player.startLesson(getAdapter(), subject, entryFile);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Failed to start lesson: ${message}`);
        } finally {
          generating = false;
        }
      }
    )
  );
}
