import * as vscode from "vscode";
import type { ClaudeAdapter, ClaudeStatus } from "../claude/adapter.js";
import type { FeatureTreeNode } from "../types/feature-tree.js";
import * as tourStore from "../engine/tour-store.js";

type TreeItemData =
  | { kind: "section"; label: string; children: TreeItemData[]; collapsed?: boolean }
  | { kind: "feature"; feature: FeatureTreeNode }
  | { kind: "tour"; tourId: string; name: string; query: string; nodeCount: number }
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "retry" }
  | { kind: "hint"; text: string; command?: string; commandTitle?: string };

export class FeatureTreeProvider
  implements vscode.TreeDataProvider<TreeItemData>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TreeItemData | undefined | null
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private features: FeatureTreeNode[] | null = null;
  private isLoading = false;
  private loadingMessage = "";
  private error: string | null = null;

  constructor(
    private getAdapter: () => ClaudeAdapter,
    private checkClaude: () => Promise<ClaudeStatus>,
    private workspaceRoot: string
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async discoverFeatures(): Promise<void> {
    const status = await this.checkClaude();
    if (!status.available) {
      const action = await vscode.window.showErrorMessage(
        "Claude CLI is not installed.",
        "How to Install",
        "Retry"
      );
      if (action === "How to Install") {
        vscode.env.openExternal(
          vscode.Uri.parse("https://docs.anthropic.com/en/docs/claude-code")
        );
      } else if (action === "Retry") {
        return this.discoverFeatures();
      }
      return;
    }
    if (!status.authenticated) {
      const action = await vscode.window.showErrorMessage(
        "Claude CLI is not logged in. Run 'claude login' in your terminal.",
        "Open Terminal",
        "Retry"
      );
      if (action === "Open Terminal") {
        const terminal = vscode.window.createTerminal("Claude Login");
        terminal.show();
        terminal.sendText("claude login");
      } else if (action === "Retry") {
        return this.discoverFeatures();
      }
      return;
    }

    this.isLoading = true;
    this.loadingMessage = "Starting scan...";
    this.error = null;
    this.features = null;
    this._onDidChangeTreeData.fire(undefined);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Side Chick",
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
            "sideChick.featuresLoaded",
            true
          );
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
        const item = new vscode.TreeItem(
          f.name,
          hasChildren
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None
        );
        item.tooltip = `Generate a tour about "${f.name}" (uses Claude API)`;
        item.description = f.description;
        if (!hasChildren) {
          item.command = {
            command: "sideChick.generateTour",
            title: "Generate Tour",
            arguments: [f.name],
          };
        }
        item.iconPath = new vscode.ThemeIcon("symbol-module");
        return item;
      }
      case "tour": {
        const item = new vscode.TreeItem(
          element.name,
          vscode.TreeItemCollapsibleState.None
        );
        item.description = `${element.nodeCount} stops`;
        item.tooltip = `${element.name}\n${element.query}\n\nClick to start (instant, no API cost)`;
        item.command = {
          command: "sideChick.openTour",
          title: "Open Tour",
          arguments: [element.tourId],
        };
        item.iconPath = new vscode.ThemeIcon("play-circle");
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
          command: "sideChick.discoverFeatures",
          title: "Retry",
        };
        item.iconPath = new vscode.ThemeIcon("refresh");
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
          item.iconPath = new vscode.ThemeIcon("add");
        } else {
          item.iconPath = new vscode.ThemeIcon("info");
        }
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

    // Root level — tours first (free, instant), generation second (costly)
    const sections: TreeItemData[] = [];

    // ── Saved Tours (PRIMARY — always first, always expanded) ──
    const tours = await tourStore.listTours(this.workspaceRoot);
    // Keep the when-clause context in sync every time the tree renders
    vscode.commands.executeCommand("setContext", "sideChick.hasTours", tours.length > 0);
    if (tours.length > 0) {
      const tourItems: TreeItemData[] = tours.map((t) => ({
        kind: "tour" as const,
        tourId: t.id,
        name: t.name,
        query: t.query,
        nodeCount: t.nodeCount
      }));
      // Add a "generate new" hint at the bottom of the tours section
      tourItems.push({
        kind: "hint",
        text: "Ask about another feature...",
        command: "sideChick.generateTour",
        commandTitle: "Ask About a Feature",
      });
      sections.push({
        kind: "section",
        label: `Your Tours (${tours.length})`,
        children: tourItems,
      });
    }

    // ── Discover Features (SECONDARY — collapsed by default when tours exist) ──
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
      sections.push({
        kind: "section",
        label: "Discover Features",
        children: this.features.map((f) => ({
          kind: "feature" as const,
          feature: f,
        })),
        collapsed: tours.length > 0, // Collapse if user already has tours
      });
    }

    return sections;
  }
}
