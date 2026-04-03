# Side Bae

**Understand any codebase from the inside.** Side Bae is a VS Code extension that uses AI to generate interactive walkthroughs, live coding lessons, and collaborative debugging sessions — all from within your editor.

Open a new project. Ask a question. Navigate the answer through real code.

## Install

Download the latest `.vsix` from [Releases](https://github.com/unlocalhosted/side-bae/releases) and install:

```bash
# VS Code
code --install-extension side-bae.vsix

# Cursor
cursor --install-extension side-bae.vsix

# Windsurf
windsurf --install-extension side-bae.vsix
```

Or use the command palette: `Extensions: Install from VSIX...`

**Requirements:** One of the following AI backends:
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) — install and run `claude login`
- [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) — works via VS Code's Language Model API

Side Bae auto-detects which is available. You can override with the `sideBae.provider` setting.

---

## Five ways to explore

Side Bae has five modes, each designed for a different situation. All are accessible from the **command hub** (the panel that appears when you click the Side Bae icon in the activity bar) or from the sidebar tree view.

### Ask About a Feature

> "How does authentication work?" "Where does the user role get set?" "What happens when a payment fails?"

Type a question, wait ~30 seconds, and get an interactive walkthrough through the actual code. Each stop highlights a file region, explains what it does and why, and offers links to follow the code flow deeper.

**How to start:** `Cmd+Shift+T` / `Ctrl+Shift+T`, or click "Ask About a Feature" in the command hub.

**What you get:**
- A **tour summary** showing the stops ahead, so you know what to expect
- **Annotated code stops** with explanations, highlighted regions, and inline labels
- **Clickable edges** showing where the code flows next, how many stops are reachable, and whether you've visited them
- **Connective context** — each stop shows how you got there ("calls `validateToken()`") so you never lose the thread
- **Saved walkthroughs** in `.side-bae/` — replay instantly without any AI calls, or commit to git and share with your team

**Navigate:** `Alt+Down` to follow a path, `Alt+Left` to go back, `Alt+Right` to go forward, `Escape` to stop.

---

### Discover Features

Auto-scan a codebase to see what it does at a glance.

**How to start:** Click "Discover Features" in the sidebar toolbar, or use the command hub.

**What you get:** A categorized tree of features the AI found in the codebase — auth, API routes, database layer, UI components, etc. Each feature has a semantic icon and description. Click any feature to generate a full walkthrough for it.

The feature list is cached in `.side-bae/features.json`, so it loads instantly on subsequent opens.

---

### Learn from This Code

Clone any codebase you admire and learn from it with a live AI tutor. The AI walks you through the code step by step, asks you questions, reacts to your answers, and adapts based on your understanding.

**How to start:** `Cmd+Shift+L` / `Ctrl+Shift+L`, or click "Learn from This Code" in the command hub. You'll be asked what you want to learn about and at what depth (foundational, intermediate, or advanced).

**What you get:**
- A **vertical stepper** showing the full lesson plan — you always know where you are and what's coming
- **Guided discovery** — the AI asks questions first, then explains. You discover patterns before they're named.
- **Knowledge checks** — text predictions ("what do you think this does?"), multiple choice, and follow-up questions
- **Instant feedback** — the AI reacts to YOUR actual words, not a canned response
- **Personalized recap** — see what clicked, where your thinking evolved, and concepts to revisit
- **Free replay** — completed lessons save as static tours, replayable without AI calls

**Scan for topics:** Click "Scan for Things to Learn" in the sidebar menu to auto-discover learnable patterns in any codebase (design patterns, architectural decisions, domain concepts).

**Pre-generated lessons:** Lesson authors can create `.full-lesson.json` files that play back instantly with no AI required. These appear in the Learn section of the sidebar.

---

### Investigate Issue

Paste a bug description and debug it collaboratively with AI. The AI investigates step by step, shows its work, and asks for your guidance — not a one-shot answer, a back-and-forth debugging session.

**How to start:** Click "Investigate Issue" in the command hub or sidebar menu. Paste or describe the bug.

**What you get:**
- **Step-by-step investigation** — the AI reads files, traces logic, and shows you what it's finding at each step
- **Guided checkpoints** — "Am I on the right track?" You can confirm or redirect.
- **Live fix proposals** — review diffs inline, give feedback, or approve with "Apply this fix"
- **Test verification** — click "Run tests" to execute the test suite and see pass/fail results
- **PR creation** — click "Open pull request" to create a branch, commit the fix, and open a PR
- **Investigation trail** — a color-coded breadcrumb showing each file investigated (blue = context, red = problem, green = fix)

---

### What's New

See what changed in recent commits at a glance, explained in plain language.

**How to start:** Click "What's New" in the sidebar menu. Choose a time range (e.g. "last week", "last 20 commits").

**What you get:** A list of meaningful changes extracted from the git history — not a raw commit log, but grouped changes with author, date, and a human-readable summary. Click any change to generate a walkthrough of the relevant code.

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `sideBae.provider` | `auto` | AI backend: `auto` (detect best available), `claude-code`, or `copilot` |
| `sideBae.model` | `haiku` | Claude model: `haiku` (fast), `sonnet` (balanced), `opus` (thorough) |
| `sideBae.maxBudgetUsd` | `0.5` | Max cost per AI request (USD) |
| `sideBae.claudePath` | _(auto-detect)_ | Path to Claude CLI binary. Leave empty unless auto-detection fails. |
| `sideBae.celebrations` | `auto` | Confetti animations: `auto` (follows system Reduce Motion), `on`, `off` |

## Keyboard shortcuts

| Action | Mac | Windows/Linux | When |
|--------|-----|---------------|------|
| Ask about a feature | `Cmd+Shift+T` | `Ctrl+Shift+T` | Always |
| Start a lesson | `Cmd+Shift+L` | `Ctrl+Shift+L` | Always |
| Go back | `Alt+Left` | `Alt+Left` | During tour |
| Go forward | `Alt+Right` | `Alt+Right` | During tour |
| Follow path | `Alt+Down` | `Alt+Down` | During tour |
| Stop tour | `Escape` | `Escape` | During tour |

## For AI agents

Side Bae includes skill files that let external AI agents (like Claude Code) generate tours and lessons for your project.

Run **Side Bae: Install Skill Files** from the command palette to install them globally (`~/.claude/commands/`) or per-project (`.claude/commands/`). Once installed, you can use commands like `/side-bae-tour` and `/side-bae-lesson` in Claude Code.

The extension watches `.side-bae/` for externally generated files and picks them up automatically.

## Stored files

All generated content is saved to `.side-bae/` in your workspace root:

| File | Purpose |
|------|---------|
| `*.tour.json` | Saved walkthroughs (instant replay, no AI needed) |
| `*.lesson.json` | Lesson session state (survives editor restarts) |
| `*.full-lesson.json` | Pre-generated lessons (offline playback) |
| `features.json` | Cached feature discovery results |
| `learnable-concepts.json` | Cached learnable topics |
| `whats-new.json` | Cached recent changes |

Add `.side-bae/` to your `.gitignore` to keep generated content local, or commit it to share walkthroughs with your team.

## Development

```sh
pnpm install         # install dependencies
pnpm build           # bundle with esbuild
pnpm typecheck       # tsc --noEmit
pnpm test            # vitest (watch mode)
pnpm test:run        # vitest (single run)
pnpm lint            # oxlint
```

Press **F5** in VS Code to launch a development instance with the extension loaded.

## License

MIT
