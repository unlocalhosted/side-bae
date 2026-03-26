import * as vscode from "vscode";
import { ClaudeAdapter, checkClaudeStatus, type ClaudeStatus } from "./claude/adapter.js";
import { TourPlayer } from "./views/tour-player/tour-player.js";
import { TourCardWebviewProvider } from "./views/tour-player/webview-provider.js";
import { FeatureTreeProvider } from "./views/feature-tree-provider.js";
import { registerGenerateTourCommand } from "./commands/generate-tour.js";
import { registerNavigationCommands } from "./commands/navigate.js";
import { disposeDecorations } from "./views/tour-player/decorations.js";

function getAdapter(workspaceRoot: string): ClaudeAdapter {
  const config = vscode.workspace.getConfiguration("sideChick");
  return new ClaudeAdapter({
    workspaceRoot,
    model: config.get<string>("model", "sonnet"),
    maxBudgetUsd: config.get<number>("maxBudgetUsd", 0.5),
  });
}

async function handleClaudeStatus(
  status: ClaudeStatus
): Promise<boolean> {
  if (!status.available) {
    const action = await vscode.window.showErrorMessage(
      `Claude CLI is not available: ${status.error ?? "unknown error"}`,
      "How to Install"
    );
    if (action === "How to Install") {
      vscode.env.openExternal(
        vscode.Uri.parse("https://docs.anthropic.com/en/docs/claude-code")
      );
    }
    return false;
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
    return false;
  }
  return true;
}

export async function activate(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;

  // Create adapter — recreated on config changes
  let adapter = getAdapter(workspaceRoot);

  // Reusable pre-flight check using the SDK itself
  const checkClaude = () => checkClaudeStatus(workspaceRoot);

  // Check on activation (non-blocking — don't await the dialog)
  checkClaude().then((status) => {
    if (!status.available || !status.authenticated) {
      handleClaudeStatus(status);
    }
  });

  // Create webview provider and tour player
  const webviewProvider = new TourCardWebviewProvider(context.extensionUri);
  const player = new TourPlayer(workspaceRoot, webviewProvider);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TourCardWebviewProvider.viewType,
      webviewProvider
    )
  );

  // Feature tree
  const featureTreeProvider = new FeatureTreeProvider(
    () => adapter,
    checkClaude,
    workspaceRoot
  );
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "sideChick.featureTree",
      featureTreeProvider
    )
  );

  // Commands
  registerGenerateTourCommand(context, () => adapter, player, workspaceRoot, checkClaude);
  registerNavigationCommands(context, player, workspaceRoot);

  context.subscriptions.push(
    vscode.commands.registerCommand("sideChick.refreshFeatures", () => {
      featureTreeProvider.refresh();
    }),
    vscode.commands.registerCommand("sideChick.discoverFeatures", () => {
      featureTreeProvider.discoverFeatures();
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      player.onDidChangeActiveTextEditor(editor);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sideChick")) {
        adapter = getAdapter(workspaceRoot);
        webviewProvider.sendCelebrationSetting();
      }
    })
  );

  vscode.commands.executeCommand("setContext", "sideChick.tourActive", false);
  vscode.commands.executeCommand("setContext", "sideChick.featuresLoaded", false);
  // sideChick.hasTours is set inside FeatureTreeProvider.getChildren() on every render
}

export function deactivate() {
  disposeDecorations();
}
