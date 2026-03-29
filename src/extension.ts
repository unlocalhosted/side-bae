import * as vscode from "vscode";
import { ClaudeAdapter, checkClaudeStatus } from "./claude/adapter.js";
import { TourPlayer } from "./views/tour-player/tour-player.js";
import { TourCardPanelProvider } from "./views/tour-player/webview-provider.js";
import { FeatureTreeProvider } from "./views/feature-tree-provider.js";
import { registerGenerateTourCommand } from "./commands/generate-tour.js";
import { registerNavigationCommands } from "./commands/navigate.js";
import { registerWhatsNewCommand } from "./commands/whats-new.js";
import { registerInvestigateIssueCommand } from "./commands/investigate-issue.js";
import { registerStartLessonCommand } from "./commands/start-lesson.js";
import { registerScanLearnableCommand } from "./commands/scan-learnable.js";
import { disposeDecorations } from "./views/tour-player/decorations.js";
import * as tourStore from "./engine/tour-store.js";
import { requireClaude } from "./commands/preflight.js";

function getAdapter(workspaceRoot: string): ClaudeAdapter {
  const config = vscode.workspace.getConfiguration("sideBae");
  return new ClaudeAdapter({
    workspaceRoot,
    model: config.get<string>("model", "haiku"),
    maxBudgetUsd: config.get<number>("maxBudgetUsd", 0.5),
  });
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

  // Check on activation (non-blocking)
  requireClaude(checkClaude);

  // Create panel provider and tour player
  const webviewProvider = new TourCardPanelProvider(context.extensionUri);
  const player = new TourPlayer(workspaceRoot, webviewProvider);

  // Feature tree
  const featureTreeProvider = new FeatureTreeProvider(
    () => adapter,
    checkClaude,
    workspaceRoot
  );
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "sideBae.featureTree",
      featureTreeProvider
    )
  );

  // Commands
  registerGenerateTourCommand(context, () => adapter, player, workspaceRoot, checkClaude);
  registerNavigationCommands(context, player, workspaceRoot);
  registerWhatsNewCommand(context, () => adapter, featureTreeProvider, checkClaude);
  registerInvestigateIssueCommand(context, () => adapter, player, workspaceRoot, checkClaude);
  registerStartLessonCommand(context, () => adapter, player, checkClaude);
  registerScanLearnableCommand(context, featureTreeProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand("sideBae.refreshFeatures", () => {
      featureTreeProvider.refresh();
    }),
    vscode.commands.registerCommand("sideBae.discoverFeatures", () => {
      featureTreeProvider.discoverFeatures();
    }),
    vscode.commands.registerCommand("sideBae.deleteTour", async (item: unknown) => {
      const tour = item as { kind?: string; tourId?: string; name?: string };
      if (!tour?.tourId || tour.kind !== "tour") return;
      const confirm = await vscode.window.showWarningMessage(
        `Delete "${tour.name}"? This can't be undone.`,
        { modal: true },
        "Delete"
      );
      if (confirm === "Delete") {
        await tourStore.deleteTour(workspaceRoot, tour.tourId);
        featureTreeProvider.refresh();
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      player.onDidChangeActiveTextEditor(editor);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sideBae")) {
        adapter = getAdapter(workspaceRoot);
        webviewProvider.sendCelebrationSetting();
      }
    })
  );

  vscode.commands.executeCommand("setContext", "sideBae.tourActive", false);
  vscode.commands.executeCommand("setContext", "sideBae.featuresLoaded", false);
  // sideBae.hasTours is set inside FeatureTreeProvider.getChildren() on every render
}

export function deactivate() {
  disposeDecorations();
}
