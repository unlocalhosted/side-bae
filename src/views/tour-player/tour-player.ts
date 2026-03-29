import * as vscode from "vscode";
import { join } from "node:path";
import { TourEngine } from "../../engine/tour-engine.js";
import { LessonSession } from "../../engine/lesson-session.js";
import { InvestigationSession } from "../../engine/investigation-session.js";
import type { ClaudeAdapter } from "../../claude/adapter.js";
import type { TourDocument, TourEdge, TourNode } from "../../types/tour.js";
import { INVESTIGATION_PHASE_KIND, type InvestigationStep } from "../../types/investigation.js";
import { applyDecorations, clearDecorations } from "./decorations.js";
import type { TourCardPanelProvider } from "./webview-provider.js";
import * as tourStore from "../../engine/tour-store.js";

export class TourPlayer {
  private engine = new TourEngine();
  private lessonSession: LessonSession | null = null;
  private lessonProcessing = false;
  private investigationSession: InvestigationSession | null = null;
  private investigationProcessing = false;
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
        case "lessonAnswer":
          this.handleLessonTextAnswer(action.text);
          break;
        case "lessonChoice":
          this.handleLessonChoiceAnswer(action.choiceIndex);
          break;
        case "lessonContinue":
          this.handleLessonContinue();
          break;
        case "lessonJumpToStep":
          this.handleLessonJump(action.index);
          break;
        case "lessonEnd":
          this.endLesson();
          break;
        case "investigationResponse":
          this.handleInvestigationAction(() => this.investigationSession!.respondText(action.text, this.makeInvestigationProgress()));
          break;
        case "investigationConfirm":
          this.handleInvestigationAction(() => this.investigationSession!.confirmAndContinue(this.makeInvestigationProgress()));
          break;
        case "investigationRunTests":
          this.handleInvestigationAction(() => this.investigationSession!.requestTests(this.makeInvestigationProgress()));
          break;
        case "investigationRequestFix":
          this.handleInvestigationAction(() => this.investigationSession!.requestFix(this.makeInvestigationProgress()));
          break;
        case "investigationApplyFix":
          await this.applyInvestigationFix();
          break;
        case "investigationCreatePR":
          this.handleInvestigationAction(() => this.investigationSession!.requestPR(this.makeInvestigationProgress()));
          break;
        case "investigationEnd":
          this.endInvestigation();
          break;
        case "openExternal":
          vscode.env.openExternal(vscode.Uri.parse(action.url));
          break;
        case "openFileAtLine":
          this.openFileAtLine(action.file, action.line);
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

  // ── Lesson session management (plan-based stepper) ──

  async startLesson(
    adapter: ClaudeAdapter,
    subject: string,
    entryFile?: string
  ): Promise<void> {
    if (this.lessonSession) this.endLesson();
    if (this.investigationSession) this.endInvestigation();
    if (this.engine.isLoaded()) this.stopTour();

    this.lessonSession = new LessonSession(adapter, subject, entryFile);

    this.webviewProvider.open(`Learning: ${subject}`);
    this.webviewProvider.showStepLoading(-1); // -1 = plan generation
    this.setTourActiveContext(true);

    try {
      // Phase 1: Generate the plan
      await this.lessonSession.generatePlan(this.makeLessonProgress());
      this.webviewProvider.sendLessonPlan(this.lessonSession.getSessionState());
      await this.autoSaveLesson();

      // Phase 2: Teach the first step
      await this.teachCurrentStep();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Lesson failed to start: ${msg}`);
      this.endLesson();
    }
  }

  private async teachCurrentStep(): Promise<void> {
    if (!this.lessonSession || this.lessonProcessing) return;
    this.lessonProcessing = true;

    const state = this.lessonSession.getSessionState();
    const stepIndex = state.activeStepIndex;
    this.webviewProvider.showStepLoading(stepIndex);

    try {
      const content = await this.lessonSession.teachActiveStep(this.makeLessonProgress());

      if (content.skipReason) {
        this.webviewProvider.sendStepSkipped(stepIndex, content.skipReason);
        // Auto-advance past skipped step
        this.lessonSession.advanceToNextStep();
        this.webviewProvider.sendLessonPlan(this.lessonSession.getSessionState());
        await this.autoSaveLesson();
        if (!this.lessonSession.isComplete()) {
          this.lessonProcessing = false;
          await this.teachCurrentStep();
          return;
        }
      } else {
        this.webviewProvider.sendStepContent(stepIndex, content);
        await this.openStepFile(stepIndex);
        await this.autoSaveLesson();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Lesson error: ${msg}`);
      this.webviewProvider.sendLessonPlan(this.lessonSession.getSessionState());
    } finally {
      this.lessonProcessing = false;
    }
  }

  private async handleLessonTextAnswer(text: string): Promise<void> {
    if (!this.lessonSession || this.lessonProcessing) return;
    this.lessonProcessing = true;

    const stepIndex = this.lessonSession.getSessionState().activeStepIndex;
    this.webviewProvider.showStepLoading(stepIndex);

    try {
      const response = await this.lessonSession.respondToText(text, this.makeLessonProgress());
      this.webviewProvider.sendStepResponse(stepIndex, response);
      await this.autoSaveLesson();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Lesson error: ${msg}`);
    } finally {
      this.lessonProcessing = false;
    }
  }

  private handleLessonChoiceAnswer(choiceIndex: number): void {
    if (!this.lessonSession) return;

    const stepIndex = this.lessonSession.getSessionState().activeStepIndex;
    const response = this.lessonSession.respondToChoice(choiceIndex);
    this.webviewProvider.sendStepResponse(stepIndex, response);
    this.autoSaveLesson();
  }

  private async handleLessonContinue(): Promise<void> {
    if (!this.lessonSession) return;

    const nextIndex = this.lessonSession.advanceToNextStep();
    this.webviewProvider.sendLessonPlan(this.lessonSession.getSessionState());
    await this.autoSaveLesson();

    if (nextIndex === -1) {
      // Lesson complete — save as tour
      this.saveLessonAsTour();
      return;
    }

    await this.teachCurrentStep();
  }

  private handleLessonJump(_index: number): void {
    // Just update the webview to expand the completed step — no API call
    this.webviewProvider.sendLessonPlan(this.lessonSession!.getSessionState());
  }

  private async openStepFile(stepIndex: number): Promise<void> {
    const state = this.lessonSession?.getSessionState();
    const step = state?.steps[stepIndex]?.plan;
    if (!step?.file) return;

    if (this.activeEditor) clearDecorations(this.activeEditor);

    const fileUri = vscode.Uri.file(join(this.workspaceRoot, step.file));
    try {
      const doc = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: true,
      });
      this.activeEditor = editor;

      const range = new vscode.Range(
        new vscode.Position(step.startLine - 1, 0),
        new vscode.Position(step.endLine - 1, Number.MAX_SAFE_INTEGER)
      );
      editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      editor.selection = new vscode.Selection(range.start, range.start);

      // Small delay lets VS Code finish rendering the editor before we apply decorations
      await new Promise((resolve) => setTimeout(resolve, 100));
      applyDecorations(editor, {
        file: step.file,
        startLine: step.startLine,
        endLine: step.endLine,
        title: step.title,
        explanation: "",
        edges: [],
        layer: step.layer,
      });
    } catch {
      // File might not exist
    }
  }

  private endLesson(): void {
    if (this.lessonSession) {
      this.saveLessonAsTour();
    }

    if (this.activeEditor) clearDecorations(this.activeEditor);
    this.lessonSession = null;
    this.webviewProvider.dispose();
    this.setTourActiveContext(false);
  }

  private saveLessonAsTour(): void {
    if (!this.lessonSession) return;
    try {
      const tour = this.lessonSession.toTourDocument();
      if (Object.keys(tour.nodes).length > 0) {
        tourStore.saveTour(this.workspaceRoot, tour);
        vscode.commands.executeCommand("sideBae.refreshFeatures");
      }
    } catch {
      // Non-critical
    }
  }

  private async autoSaveLesson(): Promise<void> {
    const data = this.lessonSession?.getSerializableState();
    if (data) {
      tourStore.saveLessonState(this.workspaceRoot, data.plan, data.stepStates);
    }
  }

  private makeLessonProgress(): import("../../claude/adapter.js").GenerationProgress {
    return {
      onProgress: (msg: string) => {
        this.webviewProvider.updateLessonLoadingMessage(msg);
      },
      onCancel: () => {},
    };
  }

  // ── Investigation session management ──

  async startInvestigation(
    adapter: ClaudeAdapter,
    issueTitle: string,
    issueBody: string
  ): Promise<void> {
    if (this.lessonSession) this.endLesson();
    if (this.investigationSession) this.endInvestigation();
    if (this.engine.isLoaded()) this.stopTour();

    this.investigationSession = new InvestigationSession(adapter, issueTitle, issueBody);

    this.webviewProvider.open(`Investigating: ${issueTitle}`);
    this.webviewProvider.showInvestigationLoading();
    this.setTourActiveContext(true);

    try {
      const step = await this.investigationSession.start(this.makeInvestigationProgress());
      await this.showInvestigationStep(step);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Investigation failed to start: ${msg}`);
      this.endInvestigation();
    }
  }

  private async handleInvestigationAction(
    action: () => Promise<InvestigationStep>
  ): Promise<void> {
    if (!this.investigationSession || this.investigationProcessing) return;
    this.investigationProcessing = true;

    this.webviewProvider.showInvestigationLoading();

    try {
      const step = await action();
      await this.showInvestigationStep(step);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Investigation error: ${msg}`);
      // Restore the last step so the UI isn't stuck on loading
      const state = this.investigationSession?.getSessionState();
      if (state?.currentStep) {
        this.webviewProvider.updateInvestigationStep(state.currentStep, state);
      }
    } finally {
      this.investigationProcessing = false;
    }
  }

  private async showInvestigationStep(step: InvestigationStep): Promise<void> {
    if (!this.investigationSession) return;

    if (step.file) {
      if (this.activeEditor) clearDecorations(this.activeEditor);

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

          applyDecorations(editor, {
            file: step.file,
            startLine: step.startLine,
            endLine: step.endLine,
            title: step.title ?? "",
            explanation: "",
            edges: [],
            kind: INVESTIGATION_PHASE_KIND[step.phase],
          });
        }
      } catch {
        // File might not exist
      }
    }

    this.webviewProvider.updateInvestigationStep(step, this.investigationSession.getSessionState());
  }

  private async applyInvestigationFix(): Promise<void> {
    if (!this.investigationSession || this.investigationProcessing) return;
    const state = this.investigationSession.getSessionState();
    const step = state.currentStep;
    if (!step?.suggestedEdit?.file || !step.suggestedEdit.oldText) return;

    const { file, oldText, newText } = step.suggestedEdit;
    const fileUri = vscode.Uri.file(join(this.workspaceRoot, file));

    try {
      const doc = await vscode.workspace.openTextDocument(fileUri);
      const text = doc.getText();
      const idx = text.indexOf(oldText);

      if (idx === -1) {
        vscode.window.showWarningMessage("Could not find the code to replace \u2014 it may have changed.");
        return;
      }

      const startPos = doc.positionAt(idx);
      const endPos = doc.positionAt(idx + oldText.length);
      const edit = new vscode.WorkspaceEdit();
      edit.replace(fileUri, new vscode.Range(startPos, endPos), newText);
      await vscode.workspace.applyEdit(edit);

      vscode.window.showInformationMessage("Fix applied. Use Ctrl+Z to undo.");

      await this.handleInvestigationAction(() => this.investigationSession!.notifyFixApplied(this.makeInvestigationProgress()));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to apply fix: ${msg}`);
    }
  }

  private endInvestigation(): void {
    if (this.investigationSession) {
      try {
        const tour = this.investigationSession.toTourDocument();
        if (Object.keys(tour.nodes).length > 0) {
          tourStore.saveTour(this.workspaceRoot, tour);
          vscode.commands.executeCommand("sideBae.refreshFeatures");
          vscode.window.showInformationMessage(
            `Investigation saved \u2014 replay "${tour.name}" anytime from the sidebar.`
          );
        }
      } catch {
        // Non-critical
      }
    }

    if (this.activeEditor) clearDecorations(this.activeEditor);
    this.investigationSession = null;
    this.webviewProvider.dispose();
    this.setTourActiveContext(false);
  }

  private makeInvestigationProgress(): import("../../claude/adapter.js").GenerationProgress {
    return {
      onProgress: (msg: string) => {
        this.webviewProvider.updateInvestigationLoadingMessage(msg);
      },
      onCancel: () => {},
    };
  }

  private async openFileAtLine(file: string, line: number): Promise<void> {
    const fileUri = vscode.Uri.file(join(this.workspaceRoot, file));
    try {
      const doc = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: true,
      });
      const pos = new vscode.Position(Math.max(0, line - 1), 0);
      editor.revealRange(
        new vscode.Range(pos, pos),
        vscode.TextEditorRevealType.InCenterIfOutsideViewport
      );
      editor.selection = new vscode.Selection(pos, pos);
    } catch {
      // File might not exist
    }
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
