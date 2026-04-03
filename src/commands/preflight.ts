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
    const isClaude = providerName.toLowerCase().includes("claude");
    const hint = isClaude
      ? " Run 'claude login' in your terminal."
      : " Check that you're signed in.";
    const action = await vscode.window.showErrorMessage(
      `${providerName} is not logged in.${hint}`,
      isClaude ? "Open Terminal" : "Open Settings"
    );
    if (action === "Open Terminal") {
      const terminal = vscode.window.createTerminal("Side Bae");
      terminal.show();
      terminal.sendText("claude login");
    } else if (action === "Open Settings") {
      vscode.commands.executeCommand("workbench.action.openSettings", "sideBae");
    }
    return false;
  }
  return true;
}
