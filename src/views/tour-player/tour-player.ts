import * as vscode from "vscode";
import { join } from "node:path";
import { TourEngine } from "../../engine/tour-engine.js";
import type { TourDocument, TourEdge, TourNode } from "../../types/tour.js";
import { applyDecorations, clearDecorations } from "./decorations.js";
import type { TourCardWebviewProvider } from "./webview-provider.js";

export class TourPlayer {
  private engine = new TourEngine();
  private workspaceRoot: string;
  private webviewProvider: TourCardWebviewProvider;
  private activeEditor?: vscode.TextEditor;
  private visitedNodes = new Set<string>();
  private isNewTour = false;

  constructor(
    workspaceRoot: string,
    webviewProvider: TourCardWebviewProvider
  ) {
    this.workspaceRoot = workspaceRoot;
    this.webviewProvider = webviewProvider;

    this.webviewProvider.setNavigationCallback((action) => {
      switch (action.type) {
        case "navigate":
          this.navigateToNode(action.nodeId);
          break;
        case "back":
          this.goBack();
          break;
        case "forward":
          this.goForward();
          break;
        case "stop":
          this.stopTour();
          break;
      }
    });
  }

  async startTour(tour: TourDocument): Promise<void> {
    this.engine.load(tour);
    this.visitedNodes.clear();
    this.isNewTour = true;
    this.setTourActiveContext(true);
    const node = this.engine.navigateToEntry();
    if (node) {
      await this.showNode(node);
    }
  }

  async navigateToNode(nodeId: string): Promise<void> {
    const node = this.engine.navigateToNode(nodeId);
    if (node) {
      await this.showNode(node);
    }
  }

  async goBack(): Promise<void> {
    const node = this.engine.navigateBack();
    if (node) {
      await this.showNode(node);
    }
  }

  async goForward(): Promise<void> {
    const node = this.engine.navigateForward();
    if (node) {
      await this.showNode(node);
    }
  }

  stopTour(): void {
    if (this.activeEditor) {
      clearDecorations(this.activeEditor);
    }
    this.engine.reset();
    this.visitedNodes.clear();
    this.webviewProvider.clear();
    this.setTourActiveContext(false);
  }

  isActive(): boolean {
    return this.engine.isLoaded();
  }

  getAvailableEdges(): TourEdge[] {
    return this.engine.getAvailableEdges();
  }

  onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined): void {
    if (!editor || !this.engine.isLoaded()) return;

    const node = this.engine.getCurrentNode();
    if (!node) return;

    const filePath = join(this.workspaceRoot, node.file);
    if (editor.document.uri.fsPath === filePath) {
      this.activeEditor = editor;
      applyDecorations(editor, node);
    }
  }

  private setTourActiveContext(active: boolean): void {
    vscode.commands.executeCommand("setContext", "sideChick.tourActive", active);
  }

  private async showNode(node: TourNode): Promise<void> {
    if (this.activeEditor) {
      clearDecorations(this.activeEditor);
    }

    const fileUri = vscode.Uri.file(join(this.workspaceRoot, node.file));
    const doc = await vscode.workspace.openTextDocument(fileUri);
    const editor = await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    });

    this.activeEditor = editor;

    const range = new vscode.Range(
      new vscode.Position(node.startLine - 1, 0),
      new vscode.Position(node.endLine - 1, Number.MAX_SAFE_INTEGER)
    );
    editor.revealRange(
      range,
      vscode.TextEditorRevealType.InCenterIfOutsideViewport
    );
    editor.selection = new vscode.Selection(range.start, range.start);

    applyDecorations(editor, node);

    // Track visited nodes for celebration triggers
    const tour = this.engine.getTour()!;
    const nodeIds = Object.keys(tour.nodes);
    const currentId = this.engine.getCurrentNodeId()!;
    this.visitedNodes.add(currentId);

    const currentIndex = nodeIds.indexOf(currentId) + 1;
    const totalNodes = nodeIds.length;

    this.webviewProvider.updateCard(
      node,
      this.engine.getBreadcrumb(),
      this.engine.canGoBack(),
      this.engine.canGoForward(),
      currentIndex,
      totalNodes,
      this.visitedNodes.size,
      this.isNewTour
    );

    // Only true for the very first showNode call after startTour
    this.isNewTour = false;
  }
}
