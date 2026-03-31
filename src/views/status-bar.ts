import * as vscode from "vscode";

let item: vscode.StatusBarItem | null = null;

export function init(): vscode.StatusBarItem {
  item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  item.name = "Side Bae";
  return item;
}

export function show(message: string): void {
  if (!item) return;
  item.text = `$(loading~spin) ${message}`;
  item.show();
}

export function hide(): void {
  item?.hide();
}
