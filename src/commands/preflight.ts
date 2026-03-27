import * as vscode from "vscode";
import type { ClaudeStatus } from "../claude/adapter.js";

export async function requireClaude(
  checkClaude: () => Promise<ClaudeStatus>
): Promise<boolean> {
  const status = await checkClaude();
  if (!status.available) {
    const action = await vscode.window.showErrorMessage(
      "Claude CLI is not available. Visit https://docs.anthropic.com/en/docs/claude-code",
      "How to Install"
    );
    if (action === "How to Install") {
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
