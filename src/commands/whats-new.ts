import * as vscode from "vscode";
import type { AIProvider, AIProviderStatus } from "../ai/index.js";
import type { FeatureTreeProvider } from "../views/feature-tree-provider.js";
import { requireAIProvider } from "./preflight.js";

export function registerWhatsNewCommand(
  context: vscode.ExtensionContext,
  getAdapter: () => AIProvider,
  featureTreeProvider: FeatureTreeProvider,
  checkProvider: () => Promise<AIProviderStatus>
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "sideBae.whatsNew",
      async () => {
        if (!(await requireAIProvider(checkProvider))) return;

        const range = await vscode.window.showInputBox({
          prompt: "Show changes from when?",
          placeHolder: "e.g., this week, last 3 days, since v2.0, last 10 commits",
        });

        if (!range) return;

        await featureTreeProvider.loadWhatsNew(getAdapter(), range);
      }
    )
  );
}
