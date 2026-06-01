import * as vscode from "vscode";

let channel: vscode.OutputChannel | null = null;

function getChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel("Side Bae");
  }
  return channel;
}

function diagnosticsEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("sideBae")
    .get<boolean>("debugLifecycle", false);
}

export function showDiagnostics(): void {
  getChannel().show(true);
}

export function logDiagnostic(message: string, details?: Record<string, unknown>): void {
  if (!diagnosticsEnabled()) return;
  const timestamp = new Date().toISOString();
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  const line = `[${timestamp}] ${message}${suffix}`;
  getChannel().appendLine(line);
  console.info(line);
}

export function logStack(message: string, details?: Record<string, unknown>): void {
  logDiagnostic(message, details);
  const stack = new Error().stack
    ?.split("\n")
    .slice(2, 9)
    .join("\n");
  if (stack) {
    getChannel().appendLine(stack);
    console.info(stack);
  }
}
