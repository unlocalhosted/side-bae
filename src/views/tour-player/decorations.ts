import * as vscode from "vscode";
import type { TourNode } from "../../types/tour.js";

let highlightDecoration: vscode.TextEditorDecorationType | null = null;
let kindDecoration: vscode.TextEditorDecorationType | null = null;

const KIND_COLORS: Record<string, string> = {
  context: "textLink.foreground",
  problem: "errorForeground",
  solution: "testing.iconPassed",
};

const LAYER_COLORS: Record<string, string> = {
  outcome: "textLink.foreground",
  architecture: "charts.purple",
  rationale: "charts.yellow",
  insight: "charts.orange",
  challenge: "testing.iconPassed",
};

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

function getColoredDecoration(kind: string): vscode.TextEditorDecorationType {
  kindDecoration?.dispose();
  const colorToken = KIND_COLORS[kind] ?? LAYER_COLORS[kind] ?? "focusBorder";
  kindDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor(
      "editor.findMatchHighlightBackground"
    ),
    borderWidth: "0 0 0 3px",
    borderStyle: "solid",
    borderColor: new vscode.ThemeColor(colorToken),
    isWholeLine: true,
    overviewRulerColor: new vscode.ThemeColor(colorToken),
    overviewRulerLane: vscode.OverviewRulerLane.Left,
  });
  return kindDecoration;
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

  if (node.kind) {
    const kindDeco = getColoredDecoration(node.kind);
    editor.setDecorations(kindDeco, [{ range }]);
    editor.setDecorations(getDecoration(), []);
  } else if (node.layer && LAYER_COLORS[node.layer]) {
    const layerDeco = getColoredDecoration(node.layer);
    editor.setDecorations(layerDeco, [{ range }]);
    editor.setDecorations(getDecoration(), []);
  } else {
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
}

export function clearDecorations(editor: vscode.TextEditor): void {
  if (highlightDecoration) {
    editor.setDecorations(highlightDecoration, []);
  }
  if (kindDecoration) {
    editor.setDecorations(kindDecoration, []);
  }
}

export function disposeDecorations(): void {
  highlightDecoration?.dispose();
  highlightDecoration = null;
  kindDecoration?.dispose();
  kindDecoration = null;
}
