import * as vscode from "vscode";
import type { AIProvider } from "./ai/index.js";
import { createProvider, type ProviderChoice } from "./ai/create-provider.js";
import { TourPlayer } from "./views/tour-player/tour-player.js";
import { TourCardPanelProvider } from "./views/tour-player/webview-provider.js";
import { FeatureTreeProvider } from "./views/feature-tree-provider.js";
import { registerGenerateTourCommand } from "./commands/generate-tour.js";
import { registerNavigationCommands } from "./commands/navigate.js";
import { registerWhatsNewCommand } from "./commands/whats-new.js";
import { registerInvestigateIssueCommand } from "./commands/investigate-issue.js";
import { registerStartLessonCommand } from "./commands/start-lesson.js";
import { registerScanLearnableCommand } from "./commands/scan-learnable.js";
import { registerInstallSkillsCommand, checkSkillFilesForUpdates } from "./commands/install-skills.js";
import { registerExploreAtlasCommand } from "./commands/explore-atlas.js";
import { disposeDecorations } from "./views/tour-player/decorations.js";
import * as statusBar from "./views/status-bar.js";
import * as tourStore from "./engine/tour-store.js";
import { SideBaeFileWatcher } from "./engine/file-watcher.js";
import { requireAIProvider } from "./commands/preflight.js";
import { showDiagnostics } from "./diagnostics.js";

function getProvider(workspaceRoot: string): AIProvider {
  const config = vscode.workspace.getConfiguration("sideBae");
  return createProvider({
    provider: config.get<ProviderChoice>("provider", "auto"),
    workspaceRoot,
    model: config.get<string>("model", "haiku"),
    codexModel: config.get<string>("codexModel", ""),
    maxBudgetUsd: config.get<number>("maxBudgetUsd", 0.5),
  });
}

export async function activate(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;

  // Create provider — recreated on config changes
  let adapter = getProvider(workspaceRoot);

  // Reusable pre-flight check
  const checkProvider = () => adapter.checkStatus();

  // Check on activation (non-blocking)
  requireAIProvider(checkProvider);

  // Status bar indicator
  context.subscriptions.push(statusBar.init());

  // Create panel provider and tour player
  const webviewProvider = new TourCardPanelProvider(context.extensionUri);
  const player = new TourPlayer(workspaceRoot, webviewProvider);
  player.setAIAdapter(adapter);

  // Feature tree
  const featureTreeProvider = new FeatureTreeProvider(
    () => adapter,
    checkProvider,
    workspaceRoot
  );
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "sideBae.featureTree",
      featureTreeProvider
    )
  );

  // Commands
  registerGenerateTourCommand(context, () => adapter, player, workspaceRoot, checkProvider);
  registerNavigationCommands(context, player, workspaceRoot);
  registerWhatsNewCommand(context, () => adapter, featureTreeProvider, checkProvider);
  registerInvestigateIssueCommand(context, () => adapter, player, workspaceRoot, checkProvider);
  registerStartLessonCommand(context, () => adapter, player, checkProvider);
  registerScanLearnableCommand(context, featureTreeProvider);
  registerExploreAtlasCommand(context, () => adapter, player, workspaceRoot, checkProvider);
  registerInstallSkillsCommand(context, workspaceRoot);

  // Non-blocking: check if installed skill files are outdated
  checkSkillFilesForUpdates(context, workspaceRoot).catch((err) => {
    console.warn("Side Bae: skill file update check failed:", err);
  });

  // File watcher — detects externally-generated content in .side-bae/
  const fileWatcher = new SideBaeFileWatcher(workspaceRoot, {
    onNewTour: async (tourId) => {
      try {
        const tour = await tourStore.loadTour(workspaceRoot, tourId);
        featureTreeProvider.refresh();
        const action = await vscode.window.showInformationMessage(
          `New tour detected: "${tour.name}". Open it?`,
          "Open Tour"
        );
        if (action === "Open Tour") await player.startTour(tour);
      } catch {
        featureTreeProvider.refresh();
        vscode.window.showWarningMessage(
          `Side Bae: could not load tour "${tourId}" — the file may still be writing or is malformed.`
        );
      }
    },
    onNewFullLesson: async (lessonId) => {
      try {
        const lesson = await tourStore.loadFullLesson(workspaceRoot, lessonId);
        featureTreeProvider.refresh();
        const action = await vscode.window.showInformationMessage(
          `New lesson ready: "${lesson.subject}". Start it?`,
          "Start Lesson"
        );
        if (action === "Start Lesson") await player.startFullLesson(lesson);
      } catch {
        featureTreeProvider.refresh();
        vscode.window.showWarningMessage(
          `Side Bae: could not load lesson "${lessonId}" — the file may still be writing or is malformed.`
        );
      }
    },
    onCodeTourFile: async (fileName) => {
      // Silently transcode a Microsoft CodeTour file into native format. The
      // resulting .tour.json fires onNewTour above, which handles the prompt —
      // so we don't notify here and avoid a double prompt.
      try {
        await tourStore.ingestCodeTourFile(workspaceRoot, fileName);
      } catch {
        vscode.window.showWarningMessage(
          `Side Bae: found "${fileName}" but couldn't convert it from CodeTour format — it may still be writing or is malformed.`
        );
      }
    },
    onSidebarRefresh: () => featureTreeProvider.refresh(),
  });
  fileWatcher.start();
  context.subscriptions.push({ dispose: () => fileWatcher.dispose() });

  // Start pre-generated lesson (no AI provider needed)
  let startingFullLesson = false;
  context.subscriptions.push(
    vscode.commands.registerCommand("sideBae.startFullLesson", async (lessonId?: string) => {
      if (!lessonId || startingFullLesson) return;
      startingFullLesson = true;
      try {
        const lesson = await tourStore.loadFullLesson(workspaceRoot, lessonId);
        await player.startFullLesson(lesson);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to start lesson: ${message}`);
      } finally {
        startingFullLesson = false;
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("sideBae.refreshFeatures", () => {
      featureTreeProvider.refresh();
    }),
    vscode.commands.registerCommand("sideBae.showDiagnostics", () => {
      showDiagnostics();
    }),
    vscode.commands.registerCommand("sideBae.discoverFeatures", () => {
      featureTreeProvider.discoverFeatures();
    }),
    vscode.commands.registerCommand("sideBae.copyTourPrompt", async (item: unknown) => {
      await featureTreeProvider.copyTourPrompt(item);
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
        adapter = getProvider(workspaceRoot);
        player.setAIAdapter(adapter);
        webviewProvider.sendCelebrationSetting();
      }
    })
  );

  vscode.commands.executeCommand("setContext", "sideBae.tourActive", false);
  vscode.commands.executeCommand("setContext", "sideBae.hasContent", false);
  // sideBae.hasTours and sideBae.hasContent are set inside FeatureTreeProvider.getChildren() on every render

  // First-run: show the command hub so new users see a clear entry point
  const WELCOMED_KEY = "sideBae.welcomed";
  if (!context.globalState.get<boolean>(WELCOMED_KEY)) {
    context.globalState.update(WELCOMED_KEY, true);
    // Short delay so VS Code settles — the sidebar and editor area are ready
    setTimeout(() => player.showWelcome(), 800);
  }
}

export function deactivate() {
  disposeDecorations();
}
