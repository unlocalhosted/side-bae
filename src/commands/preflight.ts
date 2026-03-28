import * as vscode from "vscode";
import type { ClaudeStatus } from "../claude/adapter.js";

export async function requireClaude(
  checkClaude: () => Promise<ClaudeStatus>
): Promise<boolean> {
  const status = await checkClaude();
  if (!status.available) {
    const action = await vscode.window.showErrorMessage(
      "Can't find Claude CLI. Run `which claude` in your terminal, then set the path in Settings > Side Bae > Claude Path.",
      "Set Path",
      "How to Install"
    );
    if (action === "Set Path") {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "sideChick.claudePath"
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
