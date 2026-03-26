import * as vscode from "vscode";
import type { TourNode } from "../../types/tour.js";

let highlightDecoration: vscode.TextEditorDecorationType | null = null;

function getDecoration(): vscode.TextEditorDecorationType {
  if (!highlightDecoration) {
    highlightDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor(
        "editor.findMatchHighlightBackground"
      ),
      borderWidth: "0 0 0 3px",
      borderStyle: "solid",
      borderColor: new vscode.ThemeColor("focusBorder"),
      isWholeLine: true,
      overviewRulerColor: new vscode.ThemeColor("focusBorder"),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
  }
  return highlightDecoration;
}

export function applyDecorations(
  editor: vscode.TextEditor,
  node: TourNode
): void {
  const startLine = Math.max(0, node.startLine - 1);
  const endLine = Math.max(0, node.endLine - 1);

  const range = new vscode.Range(
    new vscode.Position(startLine, 0),
    new vscode.Position(endLine, Number.MAX_SAFE_INTEGER)
  );

  editor.setDecorations(getDecoration(), [
    {
      range,
      renderOptions: {
        after: {
          contentText: `  ${node.title}`,
          color: new vscode.ThemeColor("editorCodeLens.foreground"),
          fontStyle: "italic",
          margin: "0 0 0 2em",
        },
      },
    },
  ]);
}

export function clearDecorations(editor: vscode.TextEditor): void {
  if (highlightDecoration) {
    editor.setDecorations(highlightDecoration, []);
  }
}

export function disposeDecorations(): void {
  highlightDecoration?.dispose();
  highlightDecoration = null;
}
