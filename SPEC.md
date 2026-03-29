# side-bae — v1 Spec

AI-powered codebase onboarding for VS Code / Cursor. Ask about a feature, get a guided code tour.

---

## Core Loop

```
User asks "how does auth work?"
        ↓
Claude scans repo, traces relevant code paths
        ↓
Generates a .tour.json DSL file (graph of annotated code stops)
        ↓
Tour player opens — floating cards auto-appear on each stop
        ↓
User clicks through nodes, jumps between files, asks follow-ups
```

---

## v1 Features

### F1: Feature Discovery (P0)

The cold-start experience. User opens the extension on a new repo.

- AI scans the repo and presents a **feature tree** that mirrors the folder structure
- Shows high-level capabilities: "Authentication", "Payments", "API Routes", etc.
- User picks a feature to explore → triggers tour generation
- User can also type a free-form question: "where does the user object get the `role` field appended before hitting the billing service?"

**UX:** Tree view in the sidebar panel. Each node is clickable to generate a tour.

---

### F2: Tour Generation (P0)

User selects a feature or asks a question → Claude generates a tour.

- Claude reads the codebase, identifies relevant files and code paths
- Generates a `.side-bae/<tour-name>.tour.json` DSL file
- DSL contains a graph of **nodes** (annotated code stops) and **edges** (navigation links)
- Generation shows a progress indicator: "Scanning files → Tracing code paths → Generating explanations"

**AI Backend:** Claude Code CLI (spawned as subprocess). Leverages the user's existing Claude subscription.

---

### F3: Tour DSL Format (P0)

The tour file is the core artifact. Committable, shareable, renderable.

```jsonc
{
  "version": 1,
  "id": "auth-flow",
  "name": "Authentication Flow",
  "query": "how does auth work?",
  "generatedAt": "2026-03-26T10:00:00Z",

  // Files tracked for staleness detection (compared against git blame)
  "trackedFiles": [
    { "path": "src/auth/middleware.ts", "lastCommit": "abc123" },
    { "path": "src/auth/validate.ts", "lastCommit": "def456" }
  ],

  // Entry point — where the tour starts
  "entryNode": "auth-middleware",

  // Graph of annotated stops
  "nodes": {
    "auth-middleware": {
      "file": "src/auth/middleware.ts",
      "startLine": 12,
      "endLine": 34,
      "title": "Request Authentication Gate",
      "explanation": "Every incoming request hits this middleware first. It extracts the Bearer token from the Authorization header and passes it to validateToken(). If validation fails, it short-circuits with a 401.",
      "edges": [
        { "target": "validate-token", "label": "calls validateToken()" },
        { "target": "auth-error-handler", "label": "on failure" }
      ]
    },
    "validate-token": {
      "file": "src/auth/validate.ts",
      "startLine": 5,
      "endLine": 22,
      "title": "Token Validation",
      "explanation": "Decodes the JWT, checks expiry, and verifies the signature against the public key. Returns the decoded payload with user ID and role.",
      "edges": [
        { "target": "user-lookup", "label": "fetches user from DB" }
      ]
    }
  }
}
```

**Key design decisions:**
- **Location-based references** (file + line range) for v1 simplicity
- **Metadata tracks git commits** per file for staleness detection
- **Graph structure** via edges on each node — not a flat list
- **Atomic, intent-based nodes** — a node can be 2 lines or 50 lines, scoped by what makes sense for the explanation, not by language constructs

---

### F4: Tour Player (P0)

Renders the tour as an interactive walkthrough.

- On tour start, editor jumps to the **entry node's** file and line
- A **floating popup card** auto-appears over the annotated code region
- Card contains:
  - **Title** (e.g., "Request Authentication Gate")
  - **Explanation text**
  - **Navigation links** — clickable edge labels ("calls validateToken()") that jump to the target node
  - **Back / Forward buttons** for linear retracing
  - **Breadcrumb trail** showing the path taken so far
- Clicking a navigation link:
  - Opens the target file (if different)
  - Scrolls to the target line range
  - Highlights the annotated region
  - Auto-shows the next floating card
- The annotated code region gets a subtle background highlight (non-intrusive)

**UX details:**
- Cards are floating, positioned near the code but not obscuring it
- Cards are dismissible but re-appear on navigating to a node
- Breadcrumb shows: `Auth Middleware → Token Validation → User Lookup`
- Back button follows the breadcrumb in reverse

---

### F5: Sidebar Q&A (P1)

Dedicated panel for asking follow-up questions during a tour.

- User can ask questions with full codebase context + current tour context
- AI answers reference specific files/lines (clickable to jump)
- Questions like "what happens if the token is expired?" get contextual answers
- Can trigger generation of new tour nodes from Q&A ("show me that code path")

---

### F6: Depth Slider (P1)

Controls explanation granularity across the entire tour.

- Slider in the sidebar/toolbar: `Brief ←→ Detailed ←→ Deep`
- **Brief:** One-sentence summary per node
- **Detailed:** Full paragraph explanation (default)
- **Deep:** Implementation details, edge cases, "why it's done this way"
- Changing depth regenerates explanations (or uses pre-generated tiers if cached)

---

### F7: Staleness Detection (P2)

Warns when tour annotations may be outdated.

- On tour open, compare `trackedFiles[].lastCommit` against current git blame
- If a file has changed since the tour was generated, show a warning badge on affected nodes
- Offer "Regenerate stale nodes" action
- Lightweight — no background watchers, only checks on tour open

---

### F8: Shareable Tours (P2)

Tours as committed artifacts.

- `.side-bae/` folder in repo root, gitignore-optional
- Team members with the extension installed auto-discover committed tours
- Convention: `.side-bae/<feature-name>.tour.json`

---

## Architecture (v1)

```
┌──────────────────────────────────────────┐
│            VS Code Extension             │
│                                          │
│  ┌─────────┐  ┌──────────┐  ┌────────┐  │
│  │ Feature  │  │  Tour    │  │Sidebar │  │
│  │Discovery │  │  Player  │  │  Q&A   │  │
│  │(TreeView)│  │(WebView/ │  │(WebView│  │
│  │          │  │ Overlays)│  │  Panel)│  │
│  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│       │              │            │       │
│       └──────┬───────┴────────────┘       │
│              │                            │
│     ┌────────▼─────────┐                  │
│     │  Tour Engine      │                  │
│     │  - DSL read/write │                  │
│     │  - Graph nav      │                  │
│     │  - Staleness check│                  │
│     └────────┬─────────┘                  │
│              │                            │
│     ┌────────▼─────────┐                  │
│     │  Claude Adapter   │                  │
│     │  (CLI subprocess) │                  │
│     └──────────────────┘                  │
└──────────────────────────────────────────┘
```

**Key components:**
- **Feature Discovery** — TreeView provider, populated by Claude scanning the repo
- **Tour Player** — Decorations API for highlights + WebView for floating cards
- **Sidebar Q&A** — WebView panel with chat interface
- **Tour Engine** — Pure TypeScript, manages DSL parsing, graph traversal, staleness
- **Claude Adapter** — Spawns `claude` CLI, sends prompts, parses structured output

---

## What v1 is NOT

- Not a real-time code analysis tool (on-demand only)
- Not a team collaboration platform (solo-first)
- Not tied to a specific AI provider long-term (adapter pattern, Claude first)
- Not a replacement for documentation (complementary)
- No inline code modifications or suggestions
- No background indexing or watchers
