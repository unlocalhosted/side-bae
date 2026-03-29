import * as vscode from "vscode";
import type { ClaudeStatus } from "../claude/adapter.js";

export async function requireClaude(
  checkClaude: () => Promise<ClaudeStatus>
): Promise<boolean> {
  const status = await checkClaude();
  if (!status.available) {
    const detail = status.error ? `\n\nError: ${status.error}` : "";
    const action = await vscode.window.showErrorMessage(
      `Can't connect to Claude.${detail}`,
      "Set Claude Path",
      "How to Install"
    );
    if (action === "Set Claude Path") {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "sideBae.claudePath"
      );
    } else if (action === "How to Install") {
      vscode.env.openExternal(
        vscode.Uri.parse("https://docs.anthropic.com/en/docs/claude-code")
      );
    }
    return false;
  }
  if (!status.authenticated) {
    const action = await vscode.window.showErrorMessage(
      "Claude CLI is not logged in. Run 'claude login' in your terminal.",
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
