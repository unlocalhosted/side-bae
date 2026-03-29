import * as vscode from "vscode";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TourCardState } from "../../engine/tour-engine.js";
import type { LessonSessionState, StepContent, StepResponse } from "../../types/lesson.js";
import type { InvestigationStep, InvestigationSessionState } from "../../types/investigation.js";

export type NavigationCallback = (
  action:
    | { type: "navigate"; nodeId: string }
    | { type: "back" }
    | { type: "forward" }
    | { type: "stop" }
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
) => void;

export class TourCardPanelProvider {
  private panel: vscode.WebviewPanel | null = null;
  private onNavigation?: NavigationCallback;
  private ready = false;
  private pendingMessages: Record<string, unknown>[] = [];

  constructor(private extensionUri: vscode.Uri) {}

  setNavigationCallback(callback: NavigationCallback): void {
    this.onNavigation = callback;
  }

  /** Open (or reveal) the tour card panel beside the active editor. */
  open(title: string): void {
    if (this.panel) {
      this.panel.title = title;
      this.panel.reveal(vscode.ViewColumn.Beside, true);
      return;
    }

    this.ready = false;
    this.pendingMessages = [];

    this.panel = vscode.window.createWebviewPanel(
      "sideBae.tourCard",
      title,
      { viewColumn: vscode.ViewColumn.Two, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      }
    );

    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

    this.panel.webview.onDidReceiveMessage((message) => {
      if (message.type === "ready") {
        this.ready = true;
        for (const msg of this.pendingMessages) {
          this.panel?.webview.postMessage(msg);
        }
        this.pendingMessages = [];
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
      this.panel = null;
      this.ready = false;
      this.pendingMessages = [];
      if (this.onNavigation) {
        this.onNavigation({ type: "stop" });
      }
    });

    this.sendCelebrationSetting();
  }

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

  updateInvestigationStep(step: InvestigationStep, state: InvestigationSessionState): void {
    this.post({ type: "investigationUpdate", step, state });
  }

  showInvestigationLoading(): void {
    this.post({ type: "investigationLoading" });
  }

  updateInvestigationLoadingMessage(message: string): void {
    this.post({ type: "investigationLoadingMessage", message });
  }

  /** Ensure the panel is visible without stealing focus from the editor. */
  reveal(): void {
    this.panel?.reveal(vscode.ViewColumn.Beside, true);
  }

  clear(): void {
    this.post({ type: "clear" });
  }

  dispose(): void {
    if (this.panel) {
      const p = this.panel;
      this.panel = null;
      this.ready = false;
      this.pendingMessages = [];
      p.dispose();
    }
  }

  private post(msg: Record<string, unknown>): void {
    if (this.ready && this.panel) {
      this.panel.webview.postMessage(msg);
    } else {
      this.pendingMessages.push(msg);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const webviewDir = join(this.extensionUri.fsPath, "dist", "webview");

    const htmlTemplate = readFileSync(
      join(webviewDir, "tour-card.html"),
      "utf-8"
    );

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
