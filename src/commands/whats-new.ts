import * as vscode from "vscode";
import type { ClaudeAdapter, ClaudeStatus } from "../claude/adapter.js";
import type { FeatureTreeProvider } from "../views/feature-tree-provider.js";
import { requireClaude } from "./preflight.js";

export function registerWhatsNewCommand(
  context: vscode.ExtensionContext,
  getAdapter: () => ClaudeAdapter,
  featureTreeProvider: FeatureTreeProvider,
  checkClaude: () => Promise<ClaudeStatus>
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "sideBae.whatsNew",
      async () => {
        if (!(await requireClaude(checkClaude))) return;

        const range = await vscode.window.showInputBox({
          prompt: "What time range?",
          placeHolder: "e.g., this week, last 3 days, since v2.0, last 10 commits",
        });

        if (!range) return;

        await featureTreeProvider.loadWhatsNew(getAdapter(), range);
      }
    )
  );
}
