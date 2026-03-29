import * as vscode from "vscode";
import type { FeatureTreeProvider } from "../views/feature-tree-provider.js";

export function registerScanLearnableCommand(
  context: vscode.ExtensionContext,
  featureTreeProvider: FeatureTreeProvider
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("sideBae.scanLearnable", () => {
      featureTreeProvider.discoverLearnableConcepts();
    })
  );
}
