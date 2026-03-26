import * as vscode from "vscode";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TourCardState } from "../../engine/tour-engine.js";

export type NavigationCallback = (
  action:
    | { type: "navigate"; nodeId: string }
    | { type: "back" }
    | { type: "forward" }
    | { type: "stop" }
    | { type: "dismissSummary" }
) => void;

export class TourCardWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "sideChick.tourCard";

  private view?: vscode.WebviewView;
  private onNavigation?: NavigationCallback;

  constructor(private extensionUri: vscode.Uri) {}

  setNavigationCallback(callback: NavigationCallback): void {
    this.onNavigation = callback;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      if (this.onNavigation) {
        this.onNavigation(message);
      }
    });

    // Send celebration setting on init
    this.sendCelebrationSetting();
  }

  sendCelebrationSetting(): void {
    if (this.view) {
      const setting = vscode.workspace
        .getConfiguration("sideChick")
        .get<string>("celebrations", "auto");
      this.view.webview.postMessage({ type: "config", celebrations: setting });
    }
  }

  updateCard(state: TourCardState): void {
    if (this.view) {
      this.view.webview.postMessage({ type: "update", data: state });
      this.view.show?.(true);
    }
  }

  clear(): void {
    if (this.view) {
      this.view.webview.postMessage({ type: "clear" });
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
