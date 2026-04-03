import * as vscode from "vscode";
import type { AIProviderStatus } from "../ai/index.js";

export async function requireClaude(
  checkClaude: () => Promise<AIProviderStatus>
): Promise<boolean> {
  const status = await checkClaude();
  if (!status.available) {
    const detail = status.error ? `\n\nError: ${status.error}` : "";
    const providerName = status.displayName || "AI provider";
    const action = await vscode.window.showErrorMessage(
      `Can't connect to ${providerName}.${detail}`,
      "Open Settings",
      "How to Install"
    );
    if (action === "Open Settings") {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "sideBae"
      );
    } else if (action === "How to Install") {
      vscode.env.openExternal(
        vscode.Uri.parse("https://docs.anthropic.com/en/docs/claude-code")
      );
    }
    return false;
  }
  if (!status.authenticated) {
    const providerName = status.displayName || "AI provider";
    const action = await vscode.window.showErrorMessage(
      `${providerName} is not logged in. Run 'claude login' in your terminal.`,
      "Open Terminal"
    );
    if (action === "Open Terminal") {
      const terminal = vscode.window.createTerminal("Claude Login");
      terminal.show();
      terminal.sendText("claude login");
    }
    return false;
  }
  return true;
}
