import * as vscode from "vscode";
import { join } from "node:path";
import { TourEngine } from "../../engine/tour-engine.js";
import { LessonSession } from "../../engine/lesson-session.js";
import { InvestigationSession } from "../../engine/investigation-session.js";
import { readFile } from "node:fs/promises";
import type { AIProvider } from "../../ai/index.js";
import type { FullLesson } from "../../types/full-lesson.js";
import type { TourDocument, TourEdge, TourNode } from "../../types/tour.js";
import type { SystemAtlas } from "../../types/atlas.js";
import { INVESTIGATION_PHASE_KIND, type InvestigationStep } from "../../types/investigation.js";
import { applyDecorations, clearDecorations } from "./decorations.js";
import type { TourCardPanelProvider } from "./webview-provider.js";
import * as tourStore from "../../engine/tour-store.js";
import * as statusBar from "../status-bar.js";
import { buildFollowUpPrompt } from "../../claude/prompts.js";

const PHASE_LOADING_MESSAGES: Record<string, string> = {
  orient: "Understanding the issue...",
  investigate: "Scanning relevant code...",
  diagnose: "Looking for root cause...",
  propose: "Working on a fix...",
  verify: "Running tests...",
  revise: "Adjusting the fix...",
  ship: "Preparing pull request...",
  recap: "Wrapping up...",
};

export class TourPlayer {
  private engine = new TourEngine();
  private lessonSession: LessonSession | null = null;
  private lessonProcessing = false;
  private investigationSession: InvestigationSession | null = null;
  private investigationProcessing = false;
  private workspaceRoot: string;
  private webviewProvider: TourCardPanelProvider;
  private activeEditor?: vscode.TextEditor;
  private aiAdapter: AIProvider | null = null;
  private askFollowUpInFlight = false;

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
          if (this.investigationSession) this.handleInvestigationAction(() => this.investigationSession!.respondText(action.text, this.makeInvestigationProgress()));
          break;
        case "investigationConfirm":
          if (this.investigationSession) this.handleInvestigationAction(() => this.investigationSession!.confirmAndContinue(this.makeInvestigationProgress()));
          break;
        case "investigationRunTests":
          if (this.investigationSession) this.handleInvestigationAction(() => this.investigationSession!.requestTests(this.makeInvestigationProgress()));
          break;
        case "investigationRequestFix":
          if (this.investigationSession) this.handleInvestigationAction(() => this.investigationSession!.requestFix(this.makeInvestigationProgress()));
          break;
        case "investigationApplyFix":
          if (this.investigationSession) await this.applyInvestigationFix();
          break;
        case "investigationCreatePR":
          if (this.investigationSession) this.handleInvestigationAction(() => this.investigationSession!.requestPR(this.makeInvestigationProgress()));
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
        case "askFollowUp":
          this.handleAskFollowUp(action.nodeId, action.selectedText, action.question, action.mode);
          break;
        case "atlasDeepDive":
          this.handleAtlasDeepDive(action.query);
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

  /** Open the command hub panel without starting a tour. Used for first-run onboarding. */
  showWelcome(): void {
    this.webviewProvider.open("Side Bae");
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
    this.atlasActive = false;
    if (this.lessonSession) this.endLesson();
    if (this.investigationSession) this.endInvestigation();
    this.webviewProvider.dispose();
    this.setTourActiveContext(false);
  }

  isActive(): boolean {
    return this.engine.isLoaded() || this.atlasActive;
  }

  // ── Lesson session management (plan-based stepper) ──

  async startLesson(
    adapter: AIProvider,
    subject: string,
    entryFile?: string
  ): Promise<void> {
    if (this.lessonSession) this.endLesson();
    if (this.investigationSession) this.endInvestigation();
    if (this.engine.isLoaded()) this.stopTour();

    this.lessonSession = new LessonSession(adapter, subject, this.workspaceRoot, entryFile);
    this.setTourActiveContext(true);

    // Phase 1: Generate plan with VS Code notification progress (like tours)
    statusBar.show("Generating lesson plan...");
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Side Bae",
        cancellable: true,
      },
      async (progress, token) => {
        try {
          const lessonProgress = {
            onProgress: (msg: string) => {
              progress.report({ message: msg });
              statusBar.show(msg);
            },
            onCancel: (callback: () => void) => token.onCancellationRequested(callback),
          };

          await this.lessonSession!.generatePlan(lessonProgress);

          if (token.isCancellationRequested) {
            statusBar.hide();
            this.lessonSession = null;
            this.setTourActiveContext(false);
            return;
          }

          // Plan ready — NOW open the panel
          statusBar.hide();
          this.webviewProvider.open(`Learning: ${subject}`);
          this.webviewProvider.sendLessonPlan(this.lessonSession!.getSessionState());
          await this.autoSaveLesson();

          // Phase 2: Teach the first step
          await this.teachCurrentStep();
        } catch (err) {
          statusBar.hide();
          if (token.isCancellationRequested) {
            vscode.window.showInformationMessage("Lesson generation cancelled.");
            this.lessonSession = null;
            this.setTourActiveContext(false);
            return;
          }
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Lesson failed to start: ${msg}`);
          this.endLesson();
        }
      }
    );
  }

  /** Start a pre-generated lesson — no AI provider needed, instant playback. */
  async startFullLesson(lesson: FullLesson): Promise<void> {
    if (this.lessonSession) this.endLesson();
    if (this.investigationSession) this.endInvestigation();
    if (this.engine.isLoaded()) this.stopTour();

    this.lessonSession = LessonSession.fromFullLesson(lesson, this.workspaceRoot);
    this.setTourActiveContext(true);

    // Open panel immediately — no plan generation wait
    this.webviewProvider.open(`Learning: ${lesson.subject}`);
    this.webviewProvider.sendLessonPlan(this.lessonSession.getSessionState());

    // Teach the first step instantly (content is pre-loaded)
    await this.teachCurrentStep();
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
        this.webviewProvider.reveal();
        this.triggerPrefetch();
      }
    } catch (err) {
      if (!this.lessonSession) return;
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
    if (!this.lessonSession || this.lessonProcessing) return;

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
      vscode.window.showWarningMessage(
        `File not found: ${step.file} — it may have been renamed or deleted since this lesson was generated.`
      );
    }
  }

  private endLesson(): void {
    if (this.lessonSession) {
      this.lessonSession.cancelPrefetch();
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
      try {
        await tourStore.saveLessonState(this.workspaceRoot, data.plan, data.stepStates);
      } catch {
        vscode.window.showWarningMessage("Side Bae: could not save lesson progress.");
      }
    }
  }

  private triggerPrefetch(): void {
    if (!this.lessonSession) return;
    this.lessonSession.prefetchNextStep().catch(() => {});
  }

  private makeLessonProgress(): import("../../ai/index.js").GenerationProgress {
    return {
      onProgress: (msg: string) => {
        this.webviewProvider.updateLessonLoadingMessage(msg);
      },
      onCancel: () => {},
    };
  }

  // ── Investigation session management ──

  async startInvestigation(
    adapter: AIProvider,
    issueTitle: string,
    issueBody: string
  ): Promise<void> {
    if (this.lessonSession) this.endLesson();
    if (this.investigationSession) this.endInvestigation();
    if (this.engine.isLoaded()) this.stopTour();

    this.investigationSession = new InvestigationSession(adapter, issueTitle, issueBody);

    this.webviewProvider.open(`Investigating: ${issueTitle}`);
    this.webviewProvider.showInvestigationLoading("Understanding the issue...");
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

    const phase = this.investigationSession.getSessionState().currentStep?.phase;
    this.webviewProvider.showInvestigationLoading(phase ? PHASE_LOADING_MESSAGES[phase] : undefined);

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
      const applied = await vscode.workspace.applyEdit(edit);

      if (!applied) {
        vscode.window.showWarningMessage("Could not apply the fix \u2014 the file may be read-only.");
        return;
      }

      vscode.window.showInformationMessage(`Fix applied. Use ${process.platform === "darwin" ? "Cmd" : "Ctrl"}+Z to undo.`);

      if (this.investigationSession) {
        await this.handleInvestigationAction(() => this.investigationSession!.notifyFixApplied(this.makeInvestigationProgress()));
      }
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

  private makeInvestigationProgress(): import("../../ai/index.js").GenerationProgress {
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

    try {
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
      const applied = await vscode.workspace.applyEdit(edit);

      if (!applied) {
        vscode.window.showWarningMessage("Could not apply the fix \u2014 the file may be read-only.");
        return;
      }

      // Re-apply decorations so the highlight stays visible after the edit
      const currentNode = this.engine.getCurrentNode();
      if (this.activeEditor && currentNode) {
        applyDecorations(this.activeEditor, currentNode);
      }

      vscode.window.showInformationMessage(
        `Fix applied. Use ${process.platform === "darwin" ? "Cmd" : "Ctrl"}+Z to undo.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to apply fix: ${msg}`);
    }
  }

  // ── System Atlas ──

  private atlasActive = false;

  /** Show a cached atlas instantly (no AI call). */
  showCachedAtlas(atlas: SystemAtlas): void {
    if (this.lessonSession) this.endLesson();
    if (this.investigationSession) this.endInvestigation();
    if (this.engine.isLoaded()) this.stopTour();

    this.atlasActive = true;
    this.setTourActiveContext(true);
    this.webviewProvider.open(`Atlas: ${atlas.projectName}`);
    this.webviewProvider.sendAtlasFull(atlas);
  }

  /** Generate a new atlas with progressive rendering. */
  async startAtlas(adapter: AIProvider): Promise<void> {
    if (this.lessonSession) this.endLesson();
    if (this.investigationSession) this.endInvestigation();
    if (this.engine.isLoaded()) this.stopTour();

    this.atlasActive = true;
    this.setTourActiveContext(true);
    this.webviewProvider.open("Exploring codebase...");

    try {
      const atlas = await adapter.generateAtlas({
        onProgress: (msg: string) => {
          this.webviewProvider.updateAtlasLoadingMessage(msg);
          statusBar.show(msg);
        },
        onCancel: () => {},
      });

      // Send progressively: Phase 1 first, then 2, 3, 4
      this.webviewProvider.sendAtlasPhase1({
        projectName: atlas.projectName,
        summary: atlas.summary,
        techStack: atlas.techStack,
      });

      this.webviewProvider.sendAtlasPhase2({
        layers: atlas.layers,
        connections: atlas.connections,
      });

      this.webviewProvider.sendAtlasPhase3({
        flows: atlas.flows,
      });

      this.webviewProvider.sendAtlasPhase4({
        suggestions: atlas.suggestions,
      });

      // Save to disk
      await tourStore.saveAtlas(this.workspaceRoot, atlas);
      statusBar.hide();
    } catch (err) {
      statusBar.hide();
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Atlas generation failed: ${msg}`);
      this.atlasActive = false;
      this.setTourActiveContext(false);
    }
  }

  /** Handle "Go deeper" from an atlas flow step — generate a focused tour. */
  private handleAtlasDeepDive(query: string): void {
    if (!this.aiAdapter) return;
    // Stop the atlas but remember we came from it
    this.atlasActive = false;
    // Generate a tour with the scoped query
    vscode.commands.executeCommand("sideBae.generateTour", query);
  }

  /** Set the AI provider for follow-up Q&A. */
  setAIAdapter(adapter: AIProvider | null): void {
    this.aiAdapter = adapter;
    this.webviewProvider.sendProviderStatus(adapter !== null);
  }

  // ── Ask About Selection ──

  private async handleAskFollowUp(
    nodeId: string,
    selectedText: string,
    question: string,
    mode: "tour" | "lesson" | "investigation"
  ): Promise<void> {
    if (!this.aiAdapter) {
      this.webviewProvider.sendAskFollowUpError();
      return;
    }

    if (this.askFollowUpInFlight) return;
    this.askFollowUpInFlight = true;

    try {
      // Get the explanation text and file content for prompt context
      let explanation = "";
      let fileContent = "";

      if (mode === "tour") {
        const node = this.engine.getNode(nodeId);
        if (node) {
          explanation = node.explanation;
          try {
            fileContent = await readFile(join(this.workspaceRoot, node.file), "utf-8");
          } catch {
            // File might not exist
          }
        }
      } else if (mode === "lesson" && this.lessonSession) {
        const state = this.lessonSession.getSessionState();
        const step = state.steps.find(s => s.plan.id === nodeId);
        if (step?.content) {
          explanation = step.content.explanation;
          try {
            fileContent = await readFile(join(this.workspaceRoot, step.plan.file), "utf-8");
          } catch {
            // File might not exist
          }
        }
      } else if (mode === "investigation" && this.investigationSession) {
        const state = this.investigationSession.getSessionState();
        if (state.currentStep) {
          explanation = state.currentStep.content || "";
          if (state.currentStep.file) {
            try {
              fileContent = await readFile(join(this.workspaceRoot, state.currentStep.file), "utf-8");
            } catch {
              // File might not exist
            }
          }
        }
      }

      const prompt = buildFollowUpPrompt(explanation, fileContent, selectedText, question);
      const response = await this.aiAdapter.generateStepResponse(prompt, {
        onProgress: () => {},
        onCancel: () => {},
      });

      const annotation = {
        selectedText,
        question,
        answer: response.content,
      };

      // Send the answer back to the webview
      this.webviewProvider.sendAskFollowUpResponse(nodeId, annotation, mode);

      // Persist to disk for tour mode (immediately, as per PRD)
      if (mode === "tour") {
        // Update in-memory tour so annotations survive navigation
        this.engine.addAnnotation(nodeId, annotation);
        const tourId = this.engine.getTourId();
        if (tourId) {
          tourStore.saveAnnotation(this.workspaceRoot, tourId, nodeId, annotation).catch(() => {
            // Non-critical
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Question failed — ${msg}. Try again or rephrase your question.`);
      this.webviewProvider.sendAskFollowUpError();
    } finally {
      this.askFollowUpInFlight = false;
    }
  }

  getAvailableEdges(): TourEdge[] {
    return this.engine.getAvailableEdges();
  }

  onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined): void {
    if (!editor) return;

    // Tour mode
    if (this.engine.isLoaded()) {
      const node = this.engine.getCurrentNode();
      if (!node) return;
      const filePath = join(this.workspaceRoot, node.file);
      if (editor.document.uri.fsPath === filePath) {
        this.activeEditor = editor;
        applyDecorations(editor, node);
      }
      return;
    }

    // Lesson mode — re-apply decorations when user switches back to the step's file
    if (this.lessonSession) {
      const state = this.lessonSession.getSessionState();
      const step = state.steps[state.activeStepIndex]?.plan;
      if (step?.file) {
        const filePath = join(this.workspaceRoot, step.file);
        if (editor.document.uri.fsPath === filePath) {
          this.activeEditor = editor;
          applyDecorations(editor, {
            file: step.file,
            startLine: step.startLine,
            endLine: step.endLine,
            title: step.title,
            explanation: "",
            edges: [],
            layer: step.layer,
          });
        }
      }
    }
  }

  private setTourActiveContext(active: boolean): void {
    vscode.commands.executeCommand("setContext", "sideBae.tourActive", active);
  }

  private async showNode(node: TourNode): Promise<void> {
    if (this.activeEditor) {
      clearDecorations(this.activeEditor);
    }

    try {
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
    } catch {
      vscode.window.showWarningMessage(
        `Could not open ${node.file} — the file may have been moved or deleted.`
      );
    }

    this.webviewProvider.updateCard(this.engine.getCardState());
    this.webviewProvider.reveal();
  }
}
