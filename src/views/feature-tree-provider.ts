import * as vscode from "vscode";
import type { AIProvider, AIProviderStatus } from "../ai/index.js";
import type { FeatureTreeNode } from "../types/feature-tree.js";
import type { RecentChange } from "../types/recent-changes.js";
import type { LearnableConcept } from "../types/lesson.js";
import type { FullLessonSummary } from "../types/full-lesson.js";
import * as tourStore from "../engine/tour-store.js";
import * as statusBar from "./status-bar.js";
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
  | { kind: "learnable"; concept: LearnableConcept }
  | { kind: "fullLesson"; lesson: FullLessonSummary };

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

  // Full lesson cache (pre-generated lessons from .side-bae/)
  private fullLessonCache: FullLessonSummary[] | null = null;

  // Learn state
  private learnableConcepts: LearnableConcept[] | null = null;
  private learnableLoaded = false;
  private learnableLoading = false;
  private learnableLoadingMessage = "";
  private learnableError: string | null = null;

  constructor(
    private getAdapter: () => AIProvider,
    private checkClaude: () => Promise<AIProviderStatus>,
    private workspaceRoot: string
  ) {}

  refresh(): void {
    // Invalidate all disk-backed caches so next render re-reads from disk.
    // This is critical for external writes (skill files, CLI tools).
    this.fullLessonCache = null;
    this.features = null;
    this.featuresLoaded = false;
    this.learnableConcepts = null;
    this.learnableLoaded = false;
    this.recentChanges = null;
    this._onDidChangeTreeData.fire(undefined);
  }

  async discoverFeatures(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;
    this.loadingMessage = "Starting scan...";
    this.error = null;
    this.features = null;
    this._onDidChangeTreeData.fire(undefined);
    statusBar.show("Discovering features...");

    if (!(await requireClaude(this.checkClaude))) {
      this.isLoading = false;
      statusBar.hide();
      this._onDidChangeTreeData.fire(undefined);
      return;
    }
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
            onProgress: (msg: string) => {
              progress.report({ message: msg });
              statusBar.show(msg);
              this.loadingMessage = msg;
              this._onDidChangeTreeData.fire(undefined);
            },
            onCancel: (callback: () => void) =>
              token.onCancellationRequested(callback),
          });
          this.error = null;
          vscode.commands.executeCommand(
            "setContext",
            "sideBae.featuresLoaded",
            true
          );
          this.featuresLoaded = true;
          if (this.features) {
            tourStore.saveFeatures(this.workspaceRoot, this.features);
          }
          const count = this.features?.length ?? 0;
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
          statusBar.hide();
          this._onDidChangeTreeData.fire(undefined);
        }
      }
    );
  }

  async loadWhatsNew(
    adapter: AIProvider,
    range: string
  ): Promise<void> {
    if (this.whatsNewLoading) return;
    this.whatsNewLoading = true;
    this.whatsNewLoadingMessage = "Reading git history...";
    this.whatsNewError = null;
    this.recentChanges = null;
    this._onDidChangeTreeData.fire(undefined);

    statusBar.show("Analyzing recent changes...");
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Side Bae",
        cancellable: true,
      },
      async (progress, token) => {
        try {
          this.recentChanges = await adapter.analyzeRecentChanges(range, {
            onProgress: (msg: string) => {
              progress.report({ message: msg });
              statusBar.show(msg);
              this.whatsNewLoadingMessage = msg;
              this._onDidChangeTreeData.fire(undefined);
            },
            onCancel: (callback: () => void) =>
              token.onCancellationRequested(callback),
          });
          this.whatsNewError = null;
          if (this.recentChanges) {
            tourStore.saveWhatsNew(this.workspaceRoot, this.recentChanges);
          }
          const count = this.recentChanges?.length ?? 0;
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
          statusBar.hide();
          this._onDidChangeTreeData.fire(undefined);
        }
      }
    );
  }

  async discoverLearnableConcepts(): Promise<void> {
    if (this.learnableLoading) return;
    this.learnableLoading = true;
    this.learnableLoadingMessage = "Scanning codebase...";
    this.learnableError = null;
    this.learnableConcepts = null;
    this._onDidChangeTreeData.fire(undefined);
    statusBar.show("Scanning for learnable topics...");

    if (!(await requireClaude(this.checkClaude))) {
      this.learnableLoading = false;
      statusBar.hide();
      this._onDidChangeTreeData.fire(undefined);
      return;
    }
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
            onProgress: (msg: string) => {
              progress.report({ message: msg });
              statusBar.show(msg);
              this.learnableLoadingMessage = msg;
              this._onDidChangeTreeData.fire(undefined);
            },
            onCancel: (callback: () => void) =>
              token.onCancellationRequested(callback),
          });
          this.learnableError = null;
          this.learnableLoaded = true;
          if (this.learnableConcepts) {
            tourStore.saveLearnableConcepts(this.workspaceRoot, this.learnableConcepts);
          }
          const count = this.learnableConcepts?.length ?? 0;
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
          statusBar.hide();
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
        const hasLesson = this.exploredNames.has(c.name.toLowerCase());
        const item = new vscode.TreeItem(
          c.name,
          vscode.TreeItemCollapsibleState.None
        );
        const depthLabel = c.depth.charAt(0).toUpperCase() + c.depth.slice(1);
        item.description = hasLesson
          ? `\u2713 ${depthLabel} \u00B7 ${c.concepts.length} pattern${c.concepts.length === 1 ? "" : "s"}`
          : `${depthLabel} \u00B7 ${c.concepts.length} pattern${c.concepts.length === 1 ? "" : "s"}`;
        item.tooltip = hasLesson
          ? `"${c.name}" \u2014 lesson completed\nClick to start a new lesson`
          : `${c.name}\n${c.description}\n\nPatterns: ${c.concepts.join(", ")}\nEntry: ${c.entryFile}\n\nClick to start a live lesson (takes a moment)`;
        item.command = {
          command: "sideBae.startLesson",
          title: "Start Lesson",
          arguments: [c.name, c.entryFile],
        };
        const iconId = c.icon || "mortar-board";
        item.iconPath = hasLesson
          ? new vscode.ThemeIcon(iconId, new vscode.ThemeColor("charts.green"))
          : new vscode.ThemeIcon(iconId);
        return item;
      }
      case "fullLesson": {
        const fl = element.lesson;
        const item = new vscode.TreeItem(
          fl.subject,
          vscode.TreeItemCollapsibleState.None
        );
        const depthLabel = fl.depth.charAt(0).toUpperCase() + fl.depth.slice(1);
        item.description = `${fl.stepCount} steps \u00B7 ${depthLabel}`;
        item.tooltip = `${fl.subject}\nPre-generated lesson \u2014 instant playback\n${fl.concepts.join(", ")}`;
        item.command = {
          command: "sideBae.startFullLesson",
          title: "Start Lesson",
          arguments: [fl.id],
        };
        item.iconPath = new vscode.ThemeIcon("mortar-board", new vscode.ThemeColor("charts.blue"));
        item.contextValue = "fullLesson";
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
    const needWhatsNew = !this.recentChanges && !this.whatsNewLoading;
    if (needFeatures || needLearnable || needWhatsNew) {
      const [cachedFeatures, cachedLearnable, cachedWhatsNew] = await Promise.all([
        needFeatures ? tourStore.loadFeatures(this.workspaceRoot) : null,
        needLearnable ? tourStore.loadLearnableConcepts(this.workspaceRoot) : null,
        needWhatsNew ? tourStore.loadWhatsNew(this.workspaceRoot) : null,
      ]);
      if (needWhatsNew && cachedWhatsNew) {
        this.recentChanges = cachedWhatsNew;
      }
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
    const fullLessonsForCheck = this.fullLessonCache ?? await tourStore.listFullLessons(this.workspaceRoot);
    const hasTours = tours.length > 0;
    if (this.lastHasTours !== hasTours) {
      this.lastHasTours = hasTours;
      vscode.commands.executeCommand("setContext", "sideBae.hasTours", hasTours);
    }

    // Pristine state: no content at all → return empty so viewsWelcome shows
    const hasAnyContent = hasTours || !!this.features || !!this.learnableConcepts
      || !!this.recentChanges || fullLessonsForCheck.length > 0
      || this.isLoading || this.learnableLoading || this.whatsNewLoading;
    vscode.commands.executeCommand("setContext", "sideBae.hasContent", hasAnyContent);
    if (!hasAnyContent) {
      return [];
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
      // Quick-access hint at the bottom
      tourItems.push({
        kind: "hint",
        text: "Ask about another feature...",
        command: "sideBae.generateTour",
        commandTitle: "Ask About a Feature",
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
        text: "Rescan for features...",
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
            text: "Scan this codebase for features",
            command: "sideBae.discoverFeatures",
            commandTitle: "Discover All Features",
            icon: "search",
          },
        ],
        collapsed: tours.length > 0,
      });
    }

    // ── Learn — deep-dive lessons from this codebase ──
    if (!this.fullLessonCache) {
      this.fullLessonCache = await tourStore.listFullLessons(this.workspaceRoot);
    }
    const fullLessons = this.fullLessonCache;

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
    } else if (this.learnableConcepts || fullLessons.length > 0) {
      const learnableItems: TreeItemData[] = [];

      // Pre-generated full lessons (instant playback)
      for (const fl of fullLessons) {
        learnableItems.push({ kind: "fullLesson" as const, lesson: fl });
      }

      // AI-discovered learnable concepts
      if (this.learnableConcepts) {
        for (const c of this.learnableConcepts) {
          learnableItems.push({ kind: "learnable" as const, concept: c });
        }
      }

      learnableItems.push({
        kind: "hint",
        text: "Learn about something specific...",
        command: "sideBae.startLesson",
        commandTitle: "Start a Lesson",
        icon: "mortar-board",
      });
      learnableItems.push({
        kind: "hint",
        text: "Rescan for topics...",
        command: "sideBae.scanLearnable",
        commandTitle: "Rescan",
        icon: "refresh",
      });
      const totalCount = fullLessons.length + (this.learnableConcepts?.length ?? 0);
      sections.push({
        kind: "section",
        label: `Learn (${totalCount})`,
        children: learnableItems,
        collapsed: tours.length > 0,
      });
    } else {
      sections.push({
        kind: "section",
        label: "Learn",
        children: [
          {
            kind: "hint",
            text: "Find patterns worth learning",
            command: "sideBae.scanLearnable",
            commandTitle: "Scan for Learnable Topics",
            icon: "mortar-board",
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
        label: "What\u2019s New",
        children: [
          {
            kind: "hint",
            text: "See what changed in recent commits",
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
