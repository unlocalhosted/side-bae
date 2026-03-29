import * as vscode from "vscode";
import { join } from "node:path";
import { TourEngine } from "../../engine/tour-engine.js";
import { LessonSession } from "../../engine/lesson-session.js";
import type { ClaudeAdapter } from "../../claude/adapter.js";
import type { TourDocument, TourEdge, TourNode } from "../../types/tour.js";
import type { LessonStep } from "../../types/lesson.js";
import { applyDecorations, clearDecorations } from "./decorations.js";
import type { TourCardPanelProvider } from "./webview-provider.js";
import * as tourStore from "../../engine/tour-store.js";

export class TourPlayer {
  private engine = new TourEngine();
  private lessonSession: LessonSession | null = null;
  private lessonProcessing = false;
  private workspaceRoot: string;
  private webviewProvider: TourCardPanelProvider;
  private activeEditor?: vscode.TextEditor;

  constructor(
    workspaceRoot: string,
    webviewProvider: TourCardPanelProvider
  ) {
    this.workspaceRoot = workspaceRoot;
    this.webviewProvider = webviewProvider;

    this.webviewProvider.setNavigationCallback(async (action) => {
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
        case "dismissSummary": {
          // User clicked "Begin walkthrough" — NOW open the file for the first time
          const currentNode = this.engine.getCurrentNode();
          if (currentNode) {
            await this.showNode(currentNode);
          }
          break;
        }
        case "applyFix":
          await this.applyFix(action.nodeId, action.oldText, action.newText);
          break;
        case "copyReport":
          await vscode.env.clipboard.writeText(action.report);
          vscode.window.showInformationMessage("Report copied to clipboard.");
          break;
        case "lessonResponse":
          this.handleLessonAction(() => this.lessonSession!.respondText(action.text, this.makeLessonProgress()));
          break;
        case "lessonChoice":
          this.handleLessonAction(() => this.lessonSession!.respondChoice(action.choiceIndex, this.makeLessonProgress()));
          break;
        case "lessonSkip":
          this.handleLessonAction(() => this.lessonSession!.skip(this.makeLessonProgress()));
          break;
        case "lessonContinue":
          this.handleLessonAction(() => this.lessonSession!.respondText("(read and understood)", this.makeLessonProgress()));
          break;
        case "lessonFollowUp":
          this.handleLessonAction(() => this.lessonSession!.askFollowUp(action.text, this.makeLessonProgress()));
          break;
        case "lessonEnd":
          this.endLesson();
          break;
        case "launchCommand": {
          const allowed = [
            "sideBae.generateTour",
            "sideBae.discoverFeatures",
            "sideBae.investigateIssue",
            "sideBae.startLesson",
            "sideBae.whatsNew",
            "sideBae.scanLearnable",
          ];
          if (allowed.includes(action.command)) {
            vscode.commands.executeCommand(action.command);
          }
          break;
        }
      }
    });
  }

  async startTour(tour: TourDocument): Promise<void> {
    const hasKindNodes = Object.values(tour.nodes).some((n) => n.kind);
    const title = hasKindNodes
      ? `Investigating: ${tour.query}`
      : tour.name;

    // 1. Open the panel — it gets focus, no competition
    this.webviewProvider.open(title);

    // 2. Load engine (navigates to entry node internally)
    this.engine.load(tour);
    this.setTourActiveContext(true);

    // 3. Send the summary card state — no file opened yet.
    //    The panel is the only thing in the editor area, so the webview
    //    loads immediately with no race condition.
    this.webviewProvider.updateCard(this.engine.getCardState());
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
    this.webviewProvider.dispose();
    this.setTourActiveContext(false);
  }

  isActive(): boolean {
    return this.engine.isLoaded();
  }

  // ── Lesson session management ──

  async startLesson(
    adapter: ClaudeAdapter,
    subject: string,
    entryFile?: string
  ): Promise<void> {
    this.lessonSession = new LessonSession(adapter, subject, entryFile);

    this.webviewProvider.open(`Learning: ${subject}`);
    this.webviewProvider.showLessonLoading();
    this.setTourActiveContext(true);

    try {
      const step = await this.lessonSession.start(this.makeLessonProgress());
      await this.showLessonStep(step);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Lesson failed to start: ${msg}`);
      this.endLesson();
    }
  }

  private async handleLessonAction(
    action: () => Promise<LessonStep>
  ): Promise<void> {
    if (!this.lessonSession || this.lessonProcessing) return;
    this.lessonProcessing = true;

    this.webviewProvider.showLessonLoading();

    try {
      const step = await action();
      await this.showLessonStep(step);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Lesson error: ${msg}`);
    } finally {
      this.lessonProcessing = false;
    }
  }

  private async showLessonStep(step: LessonStep): Promise<void> {
    if (!this.lessonSession) return;

    // Open the file if the step references one
    if (step.file) {
      if (this.activeEditor) {
        clearDecorations(this.activeEditor);
      }

      const fileUri = vscode.Uri.file(join(this.workspaceRoot, step.file));
      try {
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
          preserveFocus: true,
        });
        this.activeEditor = editor;

        if (step.startLine && step.endLine) {
          const range = new vscode.Range(
            new vscode.Position(step.startLine - 1, 0),
            new vscode.Position(step.endLine - 1, Number.MAX_SAFE_INTEGER)
          );
          editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
          editor.selection = new vscode.Selection(range.start, range.start);

          // Apply decorations using a synthetic node
          applyDecorations(editor, {
            file: step.file,
            startLine: step.startLine,
            endLine: step.endLine,
            title: step.title ?? "",
            explanation: "",
            edges: [],
            layer: step.layer,
          });
        }
      } catch {
        // File might not exist — continue without highlighting
      }
    }

    this.webviewProvider.updateLessonStep(step, this.lessonSession.getSessionState());
  }

  private endLesson(): void {
    if (this.lessonSession) {
      // Save the completed lesson as a static tour for replay
      try {
        const tour = this.lessonSession.toTourDocument();
        if (Object.keys(tour.nodes).length > 0) {
          tourStore.saveTour(this.workspaceRoot, tour);
          vscode.commands.executeCommand("sideBae.refreshFeatures");
          vscode.window.showInformationMessage(
            `Lesson saved — replay "${tour.name}" anytime from the sidebar.`
          );
        }
      } catch {
        // Non-critical — lesson already completed
      }
    }

    if (this.activeEditor) {
      clearDecorations(this.activeEditor);
    }
    this.lessonSession = null;
    this.webviewProvider.dispose();
    this.setTourActiveContext(false);
  }

  private makeLessonProgress(): import("../../claude/adapter.js").GenerationProgress {
    return {
      onProgress: (msg: string) => {
        this.webviewProvider.updateLessonLoadingMessage(msg);
      },
      onCancel: () => {},
    };
  }

  private async applyFix(
    nodeId: string,
    oldText: string,
    newText: string
  ): Promise<void> {
    const node = this.engine.getNode(nodeId);
    if (!node) return;

    const fileUri = vscode.Uri.file(join(this.workspaceRoot, node.file));
    const doc = await vscode.workspace.openTextDocument(fileUri);
    const text = doc.getText();

    // Search within the node's line range first, fall back to full file
    const rangeStart = doc.offsetAt(new vscode.Position(node.startLine - 1, 0));
    const rangeEnd = doc.offsetAt(new vscode.Position(node.endLine, 0));
    const regionText = text.slice(rangeStart, rangeEnd);
    let idx = regionText.indexOf(oldText);
    if (idx !== -1) {
      idx += rangeStart; // adjust to absolute offset
    } else {
      idx = text.indexOf(oldText); // fall back to full file
    }

    if (idx === -1) {
      vscode.window.showWarningMessage(
        "Could not find the code to replace \u2014 it may have changed."
      );
      return;
    }

    const startPos = doc.positionAt(idx);
    const endPos = doc.positionAt(idx + oldText.length);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(fileUri, new vscode.Range(startPos, endPos), newText);
    await vscode.workspace.applyEdit(edit);

    // Re-apply decorations so the highlight stays visible after the edit
    const currentNode = this.engine.getCurrentNode();
    if (this.activeEditor && currentNode) {
      applyDecorations(this.activeEditor, currentNode);
    }

    vscode.window.showInformationMessage(
      "Fix applied. Use Ctrl+Z to undo."
    );
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
    vscode.commands.executeCommand("setContext", "sideBae.tourActive", active);
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
    this.webviewProvider.updateCard(this.engine.getCardState());
  }
}
