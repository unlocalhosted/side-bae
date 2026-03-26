import * as vscode from "vscode";
import type { ClaudeAdapter } from "../claude/adapter.js";
import type { FeatureTreeNode } from "../types/feature-tree.js";
import * as tourStore from "../engine/tour-store.js";

type TreeItemData =
  | { kind: "section"; label: string; children: TreeItemData[] }
  | { kind: "feature"; feature: FeatureTreeNode }
  | { kind: "tour"; tourId: string; name: string; query: string }
  | { kind: "loading" }
  | { kind: "error"; message: string };

export class FeatureTreeProvider
  implements vscode.TreeDataProvider<TreeItemData>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TreeItemData | undefined | null
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private features: FeatureTreeNode[] | null = null;
  private isLoading = false;
  private error: string | null = null;

  constructor(
    private adapter: ClaudeAdapter,
    private workspaceRoot: string
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Explicitly triggered by user — never auto-fires */
  async discoverFeatures(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    this.features = null;
    this._onDidChangeTreeData.fire(undefined);

    try {
      this.features = await this.adapter.discoverFeatures({
        onProgress: () => {},
        onCancel: () => {},
      });
      this.error = null;
      vscode.commands.executeCommand(
        "setContext",
        "sideChick.featuresLoaded",
        true
      );
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      this.features = null;
    } finally {
      this.isLoading = false;
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  getTreeItem(element: TreeItemData): vscode.TreeItem {
    switch (element.kind) {
      case "section": {
        const item = new vscode.TreeItem(
          element.label,
          vscode.TreeItemCollapsibleState.Expanded
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
        item.tooltip = f.description;
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
        item.description = element.query;
        item.command = {
          command: "sideChick.openTour",
          title: "Open Tour",
          arguments: [element.tourId],
        };
        item.iconPath = new vscode.ThemeIcon("compass");
        return item;
      }
      case "loading": {
        const item = new vscode.TreeItem(
          "Scanning codebase...",
          vscode.TreeItemCollapsibleState.None
        );
        item.iconPath = new vscode.ThemeIcon("loading~spin");
        return item;
      }
      case "error": {
        const short = element.message.length > 60
          ? element.message.slice(0, 57) + "..."
          : element.message;
        const item = new vscode.TreeItem(
          short,
          vscode.TreeItemCollapsibleState.None
        );
        item.tooltip = element.message;
        item.iconPath = new vscode.ThemeIcon("error");
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

    // Root level
    const sections: TreeItemData[] = [];

    // Saved tours section
    const tours = await tourStore.listTours(this.workspaceRoot);
    if (tours.length > 0) {
      sections.push({
        kind: "section",
        label: "Saved Tours",
        children: tours.map((t) => ({
          kind: "tour" as const,
          tourId: t.id,
          name: t.name,
          query: t.query,
        })),
      });
    }

    // Features section — only shown if user has explicitly scanned
    if (this.isLoading) {
      sections.push({
        kind: "section",
        label: "Discover Features",
        children: [{ kind: "loading" }],
      });
    } else if (this.error) {
      sections.push({
        kind: "section",
        label: "Discover Features",
        children: [{ kind: "error", message: this.error }],
      });
    } else if (this.features) {
      sections.push({
        kind: "section",
        label: "Discover Features",
        children: this.features.map((f) => ({
          kind: "feature" as const,
          feature: f,
        })),
      });
    }
    // If features === null and not loading, show nothing — the welcome view handles this

    return sections;
  }
}
