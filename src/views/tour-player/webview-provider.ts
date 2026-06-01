import * as vscode from "vscode";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TourCardState } from "../../engine/tour-engine.js";
import type { LessonSessionState, StepContent, StepResponse } from "../../types/lesson.js";
import type { InvestigationStep, InvestigationSessionState } from "../../types/investigation.js";
import type { SystemAtlas, AtlasLayer, AtlasConnection, AtlasFlow, AtlasSuggestion } from "../../types/atlas.js";
import { logDiagnostic, logStack } from "../../diagnostics.js";

const TOUR_CARD_COLUMN = vscode.ViewColumn.Beside;

export type NavigationCallback = (
  action:
    | { type: "navigate"; nodeId: string }
    | { type: "back" }
    | { type: "forward" }
    | { type: "stop" }
    | { type: "panelClosed" }
    | { type: "dismissSummary" }
    | { type: "applyFix"; nodeId: string; oldText: string; newText: string }
    | { type: "copyReport"; report: string }
    | { type: "lessonAnswer"; text: string }
    | { type: "lessonChoice"; choiceIndex: number }
    | { type: "lessonContinue" }
    | { type: "lessonJumpToStep"; index: number }
    | { type: "lessonEnd" }
    | { type: "launchCommand"; command: string }
    | { type: "investigationResponse"; text: string }
    | { type: "investigationConfirm" }
    | { type: "investigationRunTests" }
    | { type: "investigationRequestFix" }
    | { type: "investigationApplyFix" }
    | { type: "investigationCreatePR" }
    | { type: "investigationEnd" }
    | { type: "openExternal"; url: string }
    | { type: "openFileAtLine"; file: string; line: number }
    | { type: "askFollowUp"; nodeId: string; selectedText: string; question: string; mode: "tour" | "lesson" | "investigation" }
    | { type: "atlasDeepDive"; query: string }
) => void;

export class TourCardPanelProvider {
  private panel: vscode.WebviewPanel | null = null;
  private onNavigation?: NavigationCallback;
  private ready = false;
  private retainedMessages = new Map<string, Record<string, unknown>>();
  private lastTitle = "Side Bae";

  constructor(private extensionUri: vscode.Uri) {}

  setNavigationCallback(callback: NavigationCallback): void {
    this.onNavigation = callback;
  }

  /** Open (or reveal) the tour card panel in the walkthrough column. */
  open(title: string): void {
    this.lastTitle = title;
    logDiagnostic("webview.open", {
      title,
      hasPanel: Boolean(this.panel),
      ready: this.ready,
      retainedMessages: this.retainedMessages.size,
    });
    if (this.panel) {
      this.panel.title = title;
      return;
    }

    this.ready = false;
    this.disposed = false;
    this.retainedMessages.clear();

    this.createPanel(false);
    this.sendCelebrationSetting();
    this.sendProviderStatus(this.lastProviderStatus);
  }

  private createPanel(preserveFocus: boolean): void {
    this.ready = false;
    logDiagnostic("webview.createPanel", {
      title: this.lastTitle,
      preserveFocus,
      column: "Beside",
    });
    this.panel = vscode.window.createWebviewPanel(
      "sideBae.tourCard",
      this.lastTitle,
      { viewColumn: TOUR_CARD_COLUMN, preserveFocus },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      }
    );

    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

    this.panel.webview.onDidReceiveMessage((message) => {
      logDiagnostic("webview.receiveMessage", {
        type: String(message?.type ?? "unknown"),
      });
      if (message.type === "ready") {
        this.ready = true;
        logDiagnostic("webview.ready", {
          title: this.lastTitle,
          retainedMessages: this.retainedMessages.size,
        });
        for (const msg of this.retainedMessages.values()) {
          this.panel?.webview.postMessage(msg);
        }
        return;
      }
      if (this.onNavigation) {
        this.onNavigation(message);
      }
    });

    const createdPanel = this.panel;
    this.panel.onDidDispose(() => {
      // Guard against stale dispose: if a new panel was created between
      // dispose() and this async callback, don't wipe the new panel's state
      if (this.panel !== createdPanel) return;
      logDiagnostic("webview.onDidDispose", {
        title: this.lastTitle,
        ready: this.ready,
        intentional: this.disposed,
        retainedMessages: this.retainedMessages.size,
      });
      this.panel = null;
      this.ready = false;
      this.retainedMessages.clear();
      if (this.onNavigation) {
        this.onNavigation({ type: "panelClosed" });
      }
    });
  }

  private lastProviderStatus = true;

  sendCelebrationSetting(): void {
    const setting = vscode.workspace
      .getConfiguration("sideBae")
      .get<string>("celebrations", "auto");
    this.post({ type: "config", celebrations: setting });
  }

  updateCard(state: TourCardState): void {
    this.post({ type: "update", data: state });
  }

  sendLessonPlan(state: LessonSessionState): void {
    this.post({ type: "lessonPlan", state });
  }

  sendStepContent(stepIndex: number, content: StepContent): void {
    this.post({ type: "lessonStepContent", stepIndex, content });
  }

  sendStepResponse(stepIndex: number, response: StepResponse): void {
    this.post({ type: "lessonStepResponse", stepIndex, response });
  }

  sendStepSkipped(stepIndex: number, reason: string): void {
    this.post({ type: "lessonStepSkipped", stepIndex, reason });
  }

  showStepLoading(stepIndex: number): void {
    this.post({ type: "lessonStepLoading", stepIndex });
  }

  updateLessonLoadingMessage(message: string): void {
    this.post({ type: "lessonLoadingMessage", message });
  }

  sendAskFollowUpResponse(nodeId: string, annotation: { selectedText: string; question: string; answer: string }, mode: "tour" | "lesson" | "investigation"): void {
    this.post({ type: "askFollowUpResponse", nodeId, annotation, mode });
  }

  sendAskFollowUpError(): void {
    this.post({ type: "askFollowUpError" });
  }

  sendProviderStatus(available: boolean): void {
    this.lastProviderStatus = available;
    this.post({ type: "providerStatus", available });
  }

  // ── Atlas ──

  sendAtlasPhase1(data: { projectName: string; summary: string; techStack: string[] }): void {
    this.post({ type: "atlasPhase1", data });
  }

  sendAtlasPhase2(data: { layers: AtlasLayer[]; connections: AtlasConnection[] }): void {
    this.post({ type: "atlasPhase2", data });
  }

  sendAtlasPhase3(data: { flows: AtlasFlow[] }): void {
    this.post({ type: "atlasPhase3", data });
  }

  sendAtlasPhase4(data: { suggestions: AtlasSuggestion[] }): void {
    this.post({ type: "atlasPhase4", data });
  }

  sendAtlasFull(data: SystemAtlas): void {
    this.post({ type: "atlasFull", data });
  }

  updateAtlasLoadingMessage(message: string): void {
    this.post({ type: "atlasLoadingMessage", message });
  }

  updateInvestigationStep(step: InvestigationStep, state: InvestigationSessionState): void {
    this.post({ type: "investigationUpdate", step, state });
  }

  showInvestigationLoading(message?: string): void {
    this.post({ type: "investigationLoading", message });
  }

  updateInvestigationLoadingMessage(message: string): void {
    this.post({ type: "investigationLoadingMessage", message });
  }

  clear(): void {
    this.post({ type: "clear" });
  }

  getViewColumn(): vscode.ViewColumn | undefined {
    return this.panel?.viewColumn;
  }

  dispose(): void {
    logStack("webview.dispose called", {
      title: this.lastTitle,
      hasPanel: Boolean(this.panel),
      ready: this.ready,
      retainedMessages: this.retainedMessages.size,
    });
    this.disposed = true;
    this.retainedMessages.clear();
    if (this.panel) {
      const p = this.panel;
      this.panel = null;
      this.ready = false;
      p.dispose();
    }
  }

  private disposed = false;

  private post(msg: Record<string, unknown>): void {
    if (this.disposed) return;
    this.rememberMessage(msg);
    logDiagnostic("webview.post", {
      type: String(msg.type ?? "unknown"),
      hasPanel: Boolean(this.panel),
      ready: this.ready,
      retainedMessages: this.retainedMessages.size,
    });
    if (this.ready && this.panel) {
      this.panel.webview.postMessage(msg);
    }
    // If the panel is not ready yet, the retained state will be replayed when
    // the webview sends its ready handshake.
  }

  private rememberMessage(msg: Record<string, unknown>): void {
    const key = this.getMessageKey(msg);
    this.retainedMessages.set(key, msg);
  }

  private getMessageKey(msg: Record<string, unknown>): string {
    const type = String(msg.type ?? "unknown");
    if ("stepIndex" in msg) return `${type}:${String(msg.stepIndex)}`;
    if ("nodeId" in msg) return `${type}:${String(msg.nodeId)}:${String(msg.mode ?? "")}`;
    return type;
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const webviewDir = join(this.extensionUri.fsPath, "dist", "webview");

    let htmlTemplate: string;
    try {
      htmlTemplate = readFileSync(
        join(webviewDir, "tour-card.html"),
        "utf-8"
      );
    } catch {
      return `<html><body><p>Side Bae failed to load. Try reinstalling the extension.</p></body></html>`;
    }

    const cssUri = webview.asWebviewUri(
      vscode.Uri.file(join(webviewDir, "tour-card.css"))
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.file(join(webviewDir, "tour-card.js"))
    );

    const nonce = getNonce();

    return htmlTemplate
      .replace(/\{\{cspSource\}\}/g, webview.cspSource)
      .replace(/\{\{nonce\}\}/g, nonce)
      .replace(/\{\{cssUri\}\}/g, cssUri.toString())
      .replace(/\{\{jsUri\}\}/g, jsUri.toString());
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
