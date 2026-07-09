import * as vscode from "vscode";
import type { AIProviderStatus } from "../ai/index.js";

const SKILL_FILES_BTN = "Use Skill Files";

export async function requireAIProvider(
  checkProvider: () => Promise<AIProviderStatus>
): Promise<boolean> {
  const status = await checkProvider();
  if (!status.available) {
    const action = await vscode.window.showErrorMessage(
      "No AI provider found. Install Codex CLI, Claude Code, or GitHub Copilot, or use skill files to generate tours with any AI chat.",
      "Install Codex",
      "Install Claude Code",
      SKILL_FILES_BTN,
      "Open Settings"
    );
    if (action === "Install Codex") {
      vscode.env.openExternal(
        vscode.Uri.parse("https://developers.openai.com/codex/")
      );
    } else if (action === "Install Claude Code") {
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
    const lowerProviderName = providerName.toLowerCase();
    const isCodex = lowerProviderName.includes("codex");
    const isClaude = lowerProviderName.includes("claude");
    const loginCommand = isCodex ? "codex login" : isClaude ? "claude login" : "";
    const hint = loginCommand
      ? ` Run \`${loginCommand}\` in your terminal to sign in.`
      : " Check that you're signed in to " + providerName + ".";
    const action = await vscode.window.showErrorMessage(
      `${providerName} is not logged in.${hint}`,
      loginCommand ? "Open Terminal" : "Open Settings",
      SKILL_FILES_BTN
    );
    if (action === "Open Terminal") {
      const terminal = vscode.window.createTerminal("Side Bae");
      terminal.show();
      terminal.sendText(loginCommand);
    } else if (action === "Open Settings") {
      vscode.commands.executeCommand("workbench.action.openSettings", "sideBae");
    } else if (action === SKILL_FILES_BTN) {
      vscode.commands.executeCommand("sideBae.installSkillFiles");
    }
    return false;
  }
  return true;
}
