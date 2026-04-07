import * as vscode from "vscode";
import type { AIProviderStatus } from "../ai/index.js";

const SKILL_FILES_BTN = "Use Skill Files";

export async function requireClaude(
  checkClaude: () => Promise<AIProviderStatus>
): Promise<boolean> {
  const status = await checkClaude();
  if (!status.available) {
    const action = await vscode.window.showErrorMessage(
      "No AI provider found. Install Claude Code or GitHub Copilot, or use skill files to generate tours with any AI chat.",
      "Install Claude Code",
      SKILL_FILES_BTN,
      "Open Settings"
    );
    if (action === "Install Claude Code") {
      vscode.env.openExternal(
        vscode.Uri.parse("https://docs.anthropic.com/en/docs/claude-code")
      );
    } else if (action === SKILL_FILES_BTN) {
      vscode.commands.executeCommand("sideBae.installSkillFiles");
    } else if (action === "Open Settings") {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "sideBae"
      );
    }
    return false;
  }
  if (!status.authenticated) {
    const providerName = status.displayName || "AI provider";
    const isClaude = providerName.toLowerCase().includes("claude");
    const hint = isClaude
      ? " Run `claude login` in your terminal to sign in."
      : " Check that you're signed in to " + providerName + ".";
    const action = await vscode.window.showErrorMessage(
      `${providerName} is not logged in.${hint}`,
      isClaude ? "Open Terminal" : "Open Settings",
      SKILL_FILES_BTN
    );
    if (action === "Open Terminal") {
      const terminal = vscode.window.createTerminal("Side Bae");
      terminal.show();
      terminal.sendText("claude login");
    } else if (action === "Open Settings") {
      vscode.commands.executeCommand("workbench.action.openSettings", "sideBae");
    } else if (action === SKILL_FILES_BTN) {
      vscode.commands.executeCommand("sideBae.installSkillFiles");
    }
    return false;
  }
  return true;
}
