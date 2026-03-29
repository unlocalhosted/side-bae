import * as vscode from "vscode";
import type { ClaudeAdapter, ClaudeStatus } from "../claude/adapter.js";
import type { FeatureTreeNode } from "../types/feature-tree.js";
import type { RecentChange } from "../types/recent-changes.js";
import type { LearnableConcept } from "../types/lesson.js";
import * as tourStore from "../engine/tour-store.js";
import { requireClaude } from "../commands/preflight.js";

// ── Semantic icon mapping ──
// Maps feature name keywords to codicons for visual variety
const ICON_RULES: [RegExp, string][] = [
  [/auth|login|session|oauth|sso|sign.?in/, "shield"],
  [/databas|sql|postgres|mongo|redis|storage|persist/, "database"],
  [/api|endpoint|route|http|rest|graphql|server/, "globe"],
  [/ui|component|frontend|layout|interface|render|view/, "window"],
  [/test|spec|coverage|assert/, "beaker"],
  [/config|setting|env|option|preference/, "gear"],
  [/deploy|ci|cd|pipeline|build|release/, "rocket"],
  [/pay|bill|strip|subscri|pric|checkout/, "credit-card"],
  [/user|account|profile|member|identity/, "person"],
  [/email|mail|smtp|inbox/, "mail"],
  [/notif|alert|push/, "bell"],
  [/search|find|index|query|filter/, "search"],
  [/log|monitor|metric|trace|observ|telemetry/, "pulse"],
  [/cache|memo|perform|optimi/, "zap"],
  [/queue|job|worker|task|background|async/, "server-process"],
  [/file|upload|download|asset|media|image/, "file-media"],
  [/chat|message|comment|discuss|thread/, "comment-discussion"],
  [/nav|menu|sidebar|header|footer|toolbar/, "layout-sidebar-left"],
  [/plugin|extend|hook|middleware|integrat/, "plug"],
  [/ai|ml|model|predict|claude|llm|generat/, "sparkle"],
  [/tour|guide|onboard|walkthrough/, "compass"],
  [/error|debug|crash|exception/, "bug"],
  [/doc|readme|wiki|help/, "book"],
  [/permission|role|access|rbac|authoriz/, "key"],
  [/websocket|realtime|stream|event|socket/, "radio-tower"],
  [/i18n|locale|translat|language/, "symbol-string"],
  [/cli|command|terminal|shell/, "terminal"],
  [/state|redux|context|store|signal/, "layers"],
  [/schema|type|valid|contract/, "symbol-interface"],
  [/cron|schedul|timer|recurring/, "clock"],
];

function featureIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [pattern, icon] of ICON_RULES) {
    if (pattern.test(lower)) return icon;
  }
  return "symbol-module";
}

type TreeItemData =
  | { kind: "section"; label: string; children: TreeItemData[]; collapsed?: boolean }
  | { kind: "feature"; feature: FeatureTreeNode }
  | { kind: "tour"; tourId: string; name: string; query: string; nodeCount: number; isLesson?: boolean; lessonDepth?: string }
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "retry" }
  | { kind: "hint"; text: string; command?: string; commandTitle?: string; icon?: string }
  | { kind: "change"; change: RecentChange }
  | { kind: "learnable"; concept: LearnableConcept };

export class FeatureTreeProvider
  implements vscode.TreeDataProvider<TreeItemData>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TreeItemData | undefined | null
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private features: FeatureTreeNode[] | null = null;
  private featuresLoaded = false;
  private isLoading = false;
  private loadingMessage = "";
  private error: string | null = null;
  private exploredNames = new Set<string>();

  // What's New state
  private recentChanges: RecentChange[] | null = null;
  private whatsNewLoading = false;
  private whatsNewLoadingMessage = "";
  private whatsNewError: string | null = null;
  private lastHasTours: boolean | null = null;

  // Learn state
  private learnableConcepts: LearnableConcept[] | null = null;
  private learnableLoaded = false;
  private learnableLoading = false;
  private learnableLoadingMessage = "";
  private learnableError: string | null = null;

  constructor(
    private getAdapter: () => ClaudeAdapter,
    private checkClaude: () => Promise<ClaudeStatus>,
    private workspaceRoot: string
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async discoverFeatures(): Promise<void> {
    if (!(await requireClaude(this.checkClaude))) return;

    this.isLoading = true;
    this.loadingMessage = "Starting scan...";
    this.error = null;
    this.features = null;
    this._onDidChangeTreeData.fire(undefined);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Side Bae",
        cancellable: true,
      },
      async (progress, token) => {
        try {
          const adapter = this.getAdapter();
          this.features = await adapter.discoverFeatures({
            onProgress: (msg) => {
              progress.report({ message: msg });
              this.loadingMessage = msg;
              this._onDidChangeTreeData.fire(undefined);
            },
            onCancel: (callback) =>
              token.onCancellationRequested(callback),
          });
          this.error = null;
          vscode.commands.executeCommand(
            "setContext",
            "sideBae.featuresLoaded",
            true
          );
          this.featuresLoaded = true;
          tourStore.saveFeatures(this.workspaceRoot, this.features);
          const count = this.features.length;
          vscode.window.showInformationMessage(
            `Found ${count} feature${count === 1 ? "" : "s"} in this codebase.`
          );
        } catch (err) {
          if (token.isCancellationRequested) {
            this.error = null;
            this.features = null;
            return;
          }
          this.error = err instanceof Error ? err.message : String(err);
          this.features = null;
        } finally {
          this.isLoading = false;
          this._onDidChangeTreeData.fire(undefined);
        }
      }
    );
  }

  async loadWhatsNew(
    adapter: ClaudeAdapter,
    range: string
  ): Promise<void> {
    this.whatsNewLoading = true;
    this.whatsNewLoadingMessage = "Reading git history...";
    this.whatsNewError = null;
    this.recentChanges = null;
    this._onDidChangeTreeData.fire(undefined);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Side Bae",
        cancellable: true,
      },
      async (progress, token) => {
        try {
          this.recentChanges = await adapter.analyzeRecentChanges(range, {
            onProgress: (msg) => {
              progress.report({ message: msg });
              this.whatsNewLoadingMessage = msg;
              this._onDidChangeTreeData.fire(undefined);
            },
            onCancel: (callback) =>
              token.onCancellationRequested(callback),
          });
          this.whatsNewError = null;
          const count = this.recentChanges.length;
          vscode.window.showInformationMessage(
            `Found ${count} recent change${count === 1 ? "" : "s"}.`
          );
        } catch (err) {
          if (token.isCancellationRequested) {
            this.whatsNewError = null;
            this.recentChanges = null;
            return;
          }
          this.whatsNewError =
            err instanceof Error ? err.message : String(err);
          this.recentChanges = null;
        } finally {
          this.whatsNewLoading = false;
          this._onDidChangeTreeData.fire(undefined);
        }
      }
    );
  }

  async discoverLearnableConcepts(): Promise<void> {
    if (!(await requireClaude(this.checkClaude))) return;

    this.learnableLoading = true;
    this.learnableLoadingMessage = "Scanning codebase...";
    this.learnableError = null;
    this.learnableConcepts = null;
    this._onDidChangeTreeData.fire(undefined);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Side Bae",
        cancellable: true,
      },
      async (progress, token) => {
        try {
          const adapter = this.getAdapter();
          this.learnableConcepts = await adapter.discoverLearnableConcepts({
            onProgress: (msg) => {
              progress.report({ message: msg });
              this.learnableLoadingMessage = msg;
              this._onDidChangeTreeData.fire(undefined);
            },
            onCancel: (callback) =>
              token.onCancellationRequested(callback),
          });
          this.learnableError = null;
          this.learnableLoaded = true;
          tourStore.saveLearnableConcepts(this.workspaceRoot, this.learnableConcepts);
          const count = this.learnableConcepts.length;
          vscode.window.showInformationMessage(
            `Found ${count} learnable topic${count === 1 ? "" : "s"} in this codebase.`
          );
        } catch (err) {
          if (token.isCancellationRequested) {
            this.learnableError = null;
            this.learnableConcepts = null;
            return;
          }
          this.learnableError = err instanceof Error ? err.message : String(err);
          this.learnableConcepts = null;
        } finally {
          this.learnableLoading = false;
          this._onDidChangeTreeData.fire(undefined);
        }
      }
    );
  }

  getTreeItem(element: TreeItemData): vscode.TreeItem {
    switch (element.kind) {
      case "section": {
        const item = new vscode.TreeItem(
          element.label,
          element.collapsed
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.Expanded
        );
        item.contextValue = "section";
        return item;
      }
      case "feature": {
        const f = element.feature;
        const hasChildren = f.children && f.children.length > 0;
        const explored = this.exploredNames.has(f.name.toLowerCase());
        const item = new vscode.TreeItem(
          f.name,
          hasChildren
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None
        );
        item.description = explored ? `\u2713 ${f.description}` : f.description;
        item.tooltip = explored
          ? `"${f.name}" — already explored\nClick to regenerate tour`
          : `Generate a tour about "${f.name}" (takes a moment)`;
        if (!hasChildren) {
          item.command = {
            command: "sideBae.generateTour",
            title: "Generate Tour",
            arguments: [f.name],
          };
        }
        const iconId = f.icon || featureIcon(f.name);
        item.iconPath = explored
          ? new vscode.ThemeIcon(iconId, new vscode.ThemeColor("charts.green"))
          : new vscode.ThemeIcon(iconId);
        return item;
      }
      case "tour": {
        const item = new vscode.TreeItem(
          element.name,
          vscode.TreeItemCollapsibleState.None
        );
        if (element.isLesson) {
          const depthLabel = element.lessonDepth ? ` \u00B7 ${element.lessonDepth}` : "";
          item.description = `${element.nodeCount} steps${depthLabel}`;
          item.tooltip = `${element.name}\nLesson replay (instant)\n\nRight-click to delete`;
          item.iconPath = new vscode.ThemeIcon("mortar-board");
        } else {
          item.description = `${element.nodeCount} stops`;
          item.tooltip = `${element.name}\n${element.query}\n\nInstant replay \u2014 right-click to delete`;
          item.iconPath = new vscode.ThemeIcon("play-circle");
        }
        item.command = {
          command: "sideBae.openTour",
          title: "Open Tour",
          arguments: [element.tourId],
        };
        item.contextValue = "tour";
        return item;
      }
      case "loading": {
        const item = new vscode.TreeItem(
          element.message,
          vscode.TreeItemCollapsibleState.None
        );
        item.iconPath = new vscode.ThemeIcon("loading~spin");
        return item;
      }
      case "error": {
        const short =
          element.message.length > 80
            ? element.message.slice(0, 77) + "..."
            : element.message;
        const item = new vscode.TreeItem(
          short,
          vscode.TreeItemCollapsibleState.None
        );
        item.tooltip = element.message;
        item.iconPath = new vscode.ThemeIcon("error");
        return item;
      }
      case "retry": {
        const item = new vscode.TreeItem(
          "Try again",
          vscode.TreeItemCollapsibleState.None
        );
        item.command = {
          command: "sideBae.discoverFeatures",
          title: "Retry",
        };
        item.iconPath = new vscode.ThemeIcon("refresh");
        return item;
      }
      case "change": {
        const c = element.change;
        const item = new vscode.TreeItem(
          c.name,
          vscode.TreeItemCollapsibleState.None
        );
        item.description = `${c.author} \u00B7 ${c.date}`;
        item.tooltip = `${c.name}\n${c.summary}\n\nAuthor: ${c.author}\nCommits: ${c.commits.join(", ")}\nFiles: ${c.files.join(", ")}\n\nClick to generate a tour (takes a moment)`;
        item.command = {
          command: "sideBae.generateTour",
          title: "Generate Tour",
          arguments: [c.name],
        };
        item.iconPath = new vscode.ThemeIcon("git-commit");
        return item;
      }
      case "learnable": {
        const c = element.concept;
        const item = new vscode.TreeItem(
          c.name,
          vscode.TreeItemCollapsibleState.None
        );
        const depthLabel = c.depth.charAt(0).toUpperCase() + c.depth.slice(1);
        item.description = `${depthLabel} \u00B7 ${c.concepts.length} pattern${c.concepts.length === 1 ? "" : "s"}`;
        item.tooltip = `${c.name}\n${c.description}\n\nPatterns: ${c.concepts.join(", ")}\nEntry: ${c.entryFile}\n\nClick to start a live lesson (takes a moment)`;
        item.command = {
          command: "sideBae.startLesson",
          title: "Start Lesson",
          arguments: [c.name, c.entryFile],
        };
        item.iconPath = new vscode.ThemeIcon(
          c.icon || "mortar-board"
        );
        return item;
      }
      case "hint": {
        const item = new vscode.TreeItem(
          element.text,
          vscode.TreeItemCollapsibleState.None
        );
        if (element.command) {
          item.command = {
            command: element.command,
            title: element.commandTitle ?? element.text,
          };
        }
        item.iconPath = new vscode.ThemeIcon(
          element.icon ?? (element.command ? "add" : "info")
        );
        return item;
      }
    }
  }

  async getChildren(element?: TreeItemData): Promise<TreeItemData[]> {
    if (element) {
      if (element.kind === "section") {
        return element.children;
      }
      if (element.kind === "feature" && element.feature.children) {
        return element.feature.children.map((child) => ({
          kind: "feature" as const,
          feature: child,
        }));
      }
      return [];
    }

    // Load cached data on first render (parallel)
    const needFeatures = !this.featuresLoaded && !this.features && !this.isLoading;
    const needLearnable = !this.learnableLoaded && !this.learnableConcepts && !this.learnableLoading;
    if (needFeatures || needLearnable) {
      const [cachedFeatures, cachedLearnable] = await Promise.all([
        needFeatures ? tourStore.loadFeatures(this.workspaceRoot) : null,
        needLearnable ? tourStore.loadLearnableConcepts(this.workspaceRoot) : null,
      ]);
      if (needFeatures) {
        this.featuresLoaded = true;
        if (cachedFeatures) {
          this.features = cachedFeatures;
          vscode.commands.executeCommand("setContext", "sideBae.featuresLoaded", true);
        }
      }
      if (needLearnable) {
        this.learnableLoaded = true;
        if (cachedLearnable) {
          this.learnableConcepts = cachedLearnable;
        }
      }
    }

    // Root level — tours first (free, instant), generation second (costly)
    const sections: TreeItemData[] = [];

    // ── Saved Tours (PRIMARY — always first, always expanded) ──
    const tours = await tourStore.listTours(this.workspaceRoot);
    const hasTours = tours.length > 0;
    if (this.lastHasTours !== hasTours) {
      this.lastHasTours = hasTours;
      vscode.commands.executeCommand("setContext", "sideBae.hasTours", hasTours);
    }

    // Build explored set from tour queries (features the user has already toured)
    this.exploredNames = new Set(tours.map((t) => t.query.toLowerCase()));
    if (tours.length > 0) {
      const tourItems: TreeItemData[] = tours.map((t) => ({
        kind: "tour" as const,
        tourId: t.id,
        name: t.name,
        query: t.query,
        nodeCount: t.nodeCount,
        isLesson: t.isLesson,
        lessonDepth: t.lessonDepth,
      }));
      // Add a "generate new" hint at the bottom of the tours section
      tourItems.push({
        kind: "hint",
        text: "Ask about another feature...",
        command: "sideBae.generateTour",
        commandTitle: "Ask About a Feature",
      });
      tourItems.push({
        kind: "hint",
        text: "Investigate an issue...",
        command: "sideBae.investigateIssue",
        commandTitle: "Investigate Issue",
        icon: "search-fuzzy",
      });
      sections.push({
        kind: "section",
        label: `Your Tours (${tours.length})`,
        children: tourItems,
      });
    }

    // ── Discover Features — collapsed by default when tours exist ──
    if (this.isLoading) {
      sections.push({
        kind: "section",
        label: "Discover Features",
        children: [{ kind: "loading", message: this.loadingMessage }],
      });
    } else if (this.error) {
      sections.push({
        kind: "section",
        label: "Discover Features",
        children: [
          { kind: "error", message: this.error },
          { kind: "retry" },
        ],
      });
    } else if (this.features) {
      const leaves = this.features.flatMap((f) =>
        f.children?.length ? f.children : [f]
      );
      const exploredCount = leaves.filter((f) =>
        this.exploredNames.has(f.name.toLowerCase())
      ).length;
      const progress =
        exploredCount > 0
          ? ` (${exploredCount}/${leaves.length} explored)`
          : ` (${leaves.length})`;
      const featureItems: TreeItemData[] = this.features.map((f) => ({
        kind: "feature" as const,
        feature: f,
      }));
      featureItems.push({
        kind: "hint",
        text: "Rescan codebase...",
        command: "sideBae.discoverFeatures",
        commandTitle: "Rescan",
        icon: "refresh",
      });
      sections.push({
        kind: "section",
        label: `Discover Features${progress}`,
        children: featureItems,
        collapsed: tours.length > 0,
      });
    } else {
      sections.push({
        kind: "section",
        label: "Discover Features",
        children: [
          {
            kind: "hint",
            text: "Scan codebase for features",
            command: "sideBae.discoverFeatures",
            commandTitle: "Discover All Features",
            icon: "search",
          },
          {
            kind: "hint",
            text: "Or ask about a specific feature...",
            command: "sideBae.generateTour",
            commandTitle: "Ask About a Feature",
            icon: "compass",
          },
        ],
        collapsed: tours.length > 0,
      });
    }

    // ── Learn — deep-dive lessons from this codebase ──
    if (this.learnableLoading) {
      sections.push({
        kind: "section",
        label: "Learn",
        children: [{ kind: "loading", message: this.learnableLoadingMessage }],
      });
    } else if (this.learnableError) {
      sections.push({
        kind: "section",
        label: "Learn",
        children: [
          { kind: "error", message: this.learnableError },
          {
            kind: "hint",
            text: "Try again",
            command: "sideBae.scanLearnable",
            commandTitle: "Scan for Things to Learn",
          },
        ],
      });
    } else if (this.learnableConcepts) {
      const learnableItems: TreeItemData[] = this.learnableConcepts.map((c) => ({
        kind: "learnable" as const,
        concept: c,
      }));
      learnableItems.push({
        kind: "hint",
        text: "Learn about something specific...",
        command: "sideBae.startLesson",
        commandTitle: "Start a Lesson",
        icon: "mortar-board",
      });
      learnableItems.push({
        kind: "hint",
        text: "Rescan codebase...",
        command: "sideBae.scanLearnable",
        commandTitle: "Rescan",
        icon: "refresh",
      });
      sections.push({
        kind: "section",
        label: `Learn (${this.learnableConcepts.length})`,
        children: learnableItems,
        collapsed: tours.length > 0,
      });
    } else {
      sections.push({
        kind: "section",
        label: "Learn \u2014 patterns & architecture",
        children: [
          {
            kind: "hint",
            text: "Scan for things to learn",
            command: "sideBae.scanLearnable",
            commandTitle: "Scan for Learnable Topics",
            icon: "mortar-board",
          },
          {
            kind: "hint",
            text: "Learn about something specific...",
            command: "sideBae.startLesson",
            commandTitle: "Start a Lesson",
          },
        ],
        collapsed: tours.length > 0,
      });
    }

    // ── What's New — recent changes from commits ──
    if (this.whatsNewLoading) {
      sections.push({
        kind: "section",
        label: "What's New",
        children: [{ kind: "loading", message: this.whatsNewLoadingMessage }],
      });
    } else if (this.whatsNewError) {
      sections.push({
        kind: "section",
        label: "What's New",
        children: [
          { kind: "error", message: this.whatsNewError },
          {
            kind: "hint",
            text: "Try again",
            command: "sideBae.whatsNew",
            commandTitle: "What's New",
          },
        ],
      });
    } else if (this.recentChanges) {
      const changeItems: TreeItemData[] = this.recentChanges.map((c) => ({
        kind: "change" as const,
        change: c,
      }));
      if (this.recentChanges.length === 0) {
        changeItems.push({
          kind: "hint",
          text: "No changes found in this range",
        });
      }
      changeItems.push({
        kind: "hint",
        text: "Load a different range...",
        command: "sideBae.whatsNew",
        commandTitle: "What's New",
        icon: "history",
      });
      sections.push({
        kind: "section",
        label: this.recentChanges.length > 0
          ? `What's New (${this.recentChanges.length})`
          : "What's New",
        children: changeItems,
      });
    } else {
      sections.push({
        kind: "section",
        label: "What\u2019s New \u2014 recent changes",
        children: [
          {
            kind: "hint",
            text: "See what changed recently",
            command: "sideBae.whatsNew",
            commandTitle: "What's New",
            icon: "history",
          },
        ],
        collapsed: tours.length > 0,
      });
    }

    return sections;
  }
}
