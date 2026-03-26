import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { ClaudeAdapter } from "./claude/adapter.js";
import { TourPlayer } from "./views/tour-player/tour-player.js";
import { TourCardWebviewProvider } from "./views/tour-player/webview-provider.js";
import { FeatureTreeProvider } from "./views/feature-tree-provider.js";
import { registerGenerateTourCommand } from "./commands/generate-tour.js";
import { registerNavigationCommands } from "./commands/navigate.js";
import { disposeDecorations } from "./views/tour-player/decorations.js";

function checkClaudeCli(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("claude", ["--version"], (error) => {
      resolve(!error);
    });
  });
}

function getAdapter(workspaceRoot: string): ClaudeAdapter {
  const config = vscode.workspace.getConfiguration("sideChick");
  return new ClaudeAdapter({
    workspaceRoot,
    model: config.get<string>("model", "sonnet"),
    maxBudgetUsd: config.get<number>("maxBudgetUsd", 0.5),
  });
}

export async function activate(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;

  // Check Claude CLI availability
  const claudeAvailable = await checkClaudeCli();
  if (!claudeAvailable) {
    const action = await vscode.window.showWarningMessage(
      "Side Chick requires the Claude CLI to generate tours. Install it to get started.",
      "How to Install"
    );
    if (action === "How to Install") {
      vscode.env.openExternal(
        vscode.Uri.parse("https://docs.anthropic.com/en/docs/claude-code")
      );
    }
  }

  // Create adapter — recreated on config changes
  let adapter = getAdapter(workspaceRoot);

  // Create webview provider and tour player
  const webviewProvider = new TourCardWebviewProvider(context.extensionUri);
  const player = new TourPlayer(workspaceRoot, webviewProvider);

  // Register webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TourCardWebviewProvider.viewType,
      webviewProvider
    )
  );

  // Create and register feature tree
  const featureTreeProvider = new FeatureTreeProvider(adapter, workspaceRoot);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "sideChick.featureTree",
      featureTreeProvider
    )
  );

  // Register commands
  registerGenerateTourCommand(context, () => adapter, player, workspaceRoot);
  registerNavigationCommands(context, player, workspaceRoot);

  context.subscriptions.push(
    vscode.commands.registerCommand("sideChick.refreshFeatures", () => {
      featureTreeProvider.refresh();
    }),
    vscode.commands.registerCommand("sideChick.discoverFeatures", () => {
      featureTreeProvider.discoverFeatures();
    })
  );

  // Re-apply decorations when switching editors
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      player.onDidChangeActiveTextEditor(editor);
    })
  );

  // Recreate adapter on config changes so new settings take effect
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sideChick")) {
        adapter = getAdapter(workspaceRoot);
      }
    })
  );

  // Initialize context values
  vscode.commands.executeCommand("setContext", "sideChick.tourActive", false);
  vscode.commands.executeCommand(
    "setContext",
    "sideChick.featuresLoaded",
    false
  );
}

export function deactivate() {
  disposeDecorations();
}
