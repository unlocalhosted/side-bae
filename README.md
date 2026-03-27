# Side Bae

AI-powered codebase onboarding for VS Code. Ask about a feature, get a guided walkthrough.

## What it does

You join a new project. You open Side Bae. You type "how does authentication work?" Claude reads your codebase, traces the relevant code paths, and generates an interactive walkthrough — a graph of annotated stops across your source files that you navigate like a guided tour.

Each stop highlights a code region, explains what it does and why, and offers clickable links to follow the code flow deeper. When you're done, the walkthrough is saved as a `.tour.json` file you can replay instantly or share with teammates.

## Install

```bash
curl -sL https://github.com/unlocalhosted/side-bae/releases/latest/download/side-bae.vsix -o /tmp/side-bae.vsix && code --install-extension /tmp/side-bae.vsix
```

Requires the [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) to be installed and authenticated (`claude login`).

## Quick start

1. Open any codebase in VS Code
4. Press `Cmd+Shift+T` (Mac) / `Ctrl+Shift+T` (Windows) and ask a question
5. Wait ~30s for the walkthrough to generate, then follow the stops

## Features

**Ask about a feature** — Type a question like "how does payment processing work?" or "where does the user object get the role field?" Claude scans your codebase and builds a walkthrough.

**Discover features** — Click "Discover Features" in the sidebar to get an AI-generated map of what your codebase does. Click any feature to generate a walkthrough for it.

**Saved walkthroughs** — Generated walkthroughs are saved to `.side-chick/` and appear in the sidebar. Replaying is instant and free (no API calls).

**Graph navigation** — Each stop has clickable edge links that show where the code flows next. Edges show how many stops are reachable ("3 stops") and whether you've already explored that path (new / in progress / done).

**Connective context** — When you follow a link, the next stop shows how you got there ("calls validateToken()") so you never lose the narrative thread.

**Tour summary** — Before the first stop, you see an overview: name, query, file count, and file list. Click "Start walkthrough" when you're ready.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  VS Code Extension               │
│                                                   │
│  ┌──────────────┐   ┌────────────────────────┐   │
│  │ Feature Tree  │   │      Tour Player       │   │
│  │ (TreeView)    │   │                        │   │
│  │               │   │  TourEngine (state)    │   │
│  │ - Saved tours │   │  Decorations (editor)  │   │
│  │ - Discovered  │   │  WebviewProvider (card) │   │
│  │   features    │   │                        │   │
│  └───────┬───────┘   └───────────┬────────────┘   │
│          │                       │                 │
│          └───────┬───────────────┘                 │
│                  │                                 │
│         ┌────────▼─────────┐                       │
│         │   Claude Adapter  │                       │
│         │ (Agent SDK query) │                       │
│         └────────┬─────────┘                       │
│                  │                                 │
│         ┌────────▼─────────┐                       │
│         │    Tour Store     │                       │
│         │ (.side-chick/*.json)                      │
│         └──────────────────┘                       │
└─────────────────────────────────────────────────┘
```

### Layers

| Layer | Files | Responsibility |
|-------|-------|----------------|
| **Types** | `src/types/tour.ts` | `TourDocument`, `TourNode`, `TourEdge` — the DSL data model. Includes `validateTourDocument()` for boundary validation. |
| **Engine** | `src/engine/tour-engine.ts` | Pure TypeScript state machine. Graph navigation, history, breadcrumbs, visited node tracking, edge depth counting. No VS Code imports — fully testable. |
| **Store** | `src/engine/tour-store.ts` | Read/write `.side-chick/*.tour.json` files. Uses Node `fs/promises` — testable without VS Code. |
| **Adapter** | `src/claude/adapter.ts` | Wraps `@anthropic-ai/claude-agent-sdk`. Sends prompts with JSON Schema, gets structured output back. Handles auth, progress, cancellation. |
| **Prompts** | `src/claude/prompts.ts` | Prompt templates for tour generation and feature discovery. |
| **Tree View** | `src/views/feature-tree-provider.ts` | Sidebar tree: saved tours (primary) + discovered features (secondary). Manages feature scan lifecycle. |
| **Tour Player** | `src/views/tour-player/tour-player.ts` | Orchestrates file navigation, decorations, and webview updates. |
| **Webview** | `src/views/tour-player/webview-provider.ts` | Bridge between extension and sidebar webview card. |
| **Card UI** | `src/views/tour-player/webview/tour-card.{js,css,html}` | The interactive tour card: summary, explanation, edges, breadcrumb, confetti. |
| **Decorations** | `src/views/tour-player/decorations.ts` | Code highlighting: background color + left border + inline title on annotated regions. |
| **Entry** | `src/extension.ts` | Wires everything together. Registers commands, providers, keybindings. |

### Data flow

```
User asks "how does auth work?"
  │
  ▼
ClaudeAdapter.generateTour(query)
  │  Uses Agent SDK: query() with outputFormat: json_schema
  │  Claude reads files, traces code, returns structured JSON
  ▼
validateTourDocument(result)
  │  Checks all fields, edge targets, line numbers
  ▼
TourStore.saveTour(tour)
  │  Writes to .side-chick/auth-flow.tour.json
  ▼
TourPlayer.startTour(tour)
  │
  ├─▶ TourEngine.load(tour)
  │     Sets up state, navigates to entry node
  │
  ├─▶ showNode(node)
  │     Opens file, scrolls to line range
  │     Applies decorations (highlight + title)
  │
  └─▶ WebviewProvider.updateCard(engine.getCardState())
        Sends summary (first stop) or stop card to webview
        Webview renders: title, explanation, edges, breadcrumb
```

### Tour DSL format

Walkthroughs are stored as `.tour.json` files:

```jsonc
{
  "version": 1,
  "id": "auth-flow",
  "name": "Authentication Flow",
  "query": "how does auth work?",
  "entryNode": "auth-middleware",
  "nodes": {
    "auth-middleware": {
      "file": "src/auth/middleware.ts",
      "startLine": 12,
      "endLine": 34,
      "title": "Request Authentication Gate",
      "explanation": "Every request hits this middleware first...",
      "edges": [
        { "target": "validate-token", "label": "calls validateToken()" }
      ]
    },
    "validate-token": {
      "file": "src/auth/validate.ts",
      "startLine": 5,
      "endLine": 22,
      "title": "Token Validation",
      "explanation": "Called by the auth middleware to verify the JWT...",
      "edges": []
    }
  }
}
```

The DSL is a **directed graph** — nodes are annotated code regions, edges are navigable links between them. The file is the single artifact: generated by Claude, rendered by the player, stored on disk, committable to git.

## Development

```sh
pnpm install         # install dependencies
pnpm build           # bundle with esbuild (copies webview assets to dist/)
pnpm typecheck       # tsc --noEmit
pnpm test            # vitest (watch mode)
pnpm test:run        # vitest (single run)
pnpm lint            # oxlint
```

**F5 debugging:** Open this repo in VS Code, press F5. A new VS Code window launches with the extension loaded. Open any codebase there to test.

**Build pipeline:** `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build`

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `sideChick.model` | `haiku` | Claude model (haiku = fast, sonnet = balanced, opus = thorough) |
| `sideChick.maxBudgetUsd` | `0.5` | Max cost per tour or feature scan |
| `sideChick.celebrations` | `auto` | Confetti animations: auto (follow system), on, off |

## Keyboard shortcuts

| Action | Mac | Windows/Linux | When |
|--------|-----|---------------|------|
| Ask about a feature | `Cmd+Shift+T` | `Ctrl+Shift+T` | Always |
| Go back | `Alt+Left` | `Alt+Left` | During tour |
| Go forward | `Alt+Right` | `Alt+Right` | During tour |
| Follow path | `Alt+Down` | `Alt+Down` | During tour |
| Stop tour | `Escape` | `Escape` | During tour |
