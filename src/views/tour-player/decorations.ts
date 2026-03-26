import * as vscode from "vscode";
import type { TourNode } from "../../types/tour.js";

const HIGHLIGHT_COLOR = new vscode.ThemeColor(
  "editor.findMatchHighlightBackground"
);
const BORDER_COLOR = new vscode.ThemeColor("focusBorder");

const highlightDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: HIGHLIGHT_COLOR,
  borderWidth: "0 0 0 3px",
  borderStyle: "solid",
  borderColor: BORDER_COLOR,
  isWholeLine: true,
  overviewRulerColor: BORDER_COLOR,
  overviewRulerLane: vscode.OverviewRulerLane.Left,
});

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

  editor.setDecorations(highlightDecoration, [
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
  editor.setDecorations(highlightDecoration, []);
}

export function disposeDecorations(): void {
  highlightDecoration.dispose();
}
