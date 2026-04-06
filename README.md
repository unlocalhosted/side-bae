# Side Bae

**Understand any codebase from the inside.** Side Bae turns codebases into interactive walkthroughs, live coding lessons, and collaborative debugging sessions — all from within your editor.

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

## Two ways to use it

Side Bae works in two modes. Pick whichever fits your setup — or use both.

### Built-in AI (sidebar buttons, keyboard shortcuts)

The extension calls an AI backend directly to generate tours, lessons, and investigations on demand. Requires one of:

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) — install and run `claude login`
- [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) — works via VS Code's Language Model API

Side Bae auto-detects which is available. Override with the `sideBae.provider` setting.

### Skill files (use with any AI chat)

Side Bae ships with skill files that work as slash commands in Claude Code, or as prompt instructions for any AI chat (Cursor, Windsurf, ChatGPT, etc.). The AI generates `.side-bae/*.json` files, and the extension picks them up automatically.

**Setup:** Run **Side Bae: Install Skill Files** from the command palette. Choose global (`~/.claude/commands/`) or per-project (`.claude/commands/`).

**Available commands:**

| Command | What it generates |
|---------|-------------------|
| `/side-bae-tour` | Interactive code walkthrough |
| `/side-bae-lesson` | Full lesson with quizzes (offline playback) |
| `/side-bae-investigate` | Bug investigation tour (context → problem → fix) |
| `/side-bae-features` | Feature map for the sidebar |
| `/side-bae-concepts` | Learnable topics and patterns |
| `/side-bae-whats-new` | Recent changes from git history |

No built-in AI backend required. The extension watches `.side-bae/` and loads new files as they appear — a notification prompts you to open them.

**Using with non-Claude AI tools:** Copy the contents of any skill file (e.g. `~/.claude/commands/side-bae-tour.md`) into your AI chat as instructions. Tell the AI to read your codebase and write the output JSON file to `.side-bae/`. Side Bae will detect it.

---

## Five ways to explore

All modes are accessible from the **command hub** (the panel that appears when you click the Side Bae icon) or from the sidebar tree view.

### Ask About a Feature

> "How does authentication work?" "Where does the user role get set?" "What happens when a payment fails?"

Type a question, wait ~30 seconds, and get an interactive walkthrough through the actual code. Each stop highlights a file region, explains what it does and why, and offers links to follow the code flow deeper.

**How to start:** `Cmd+Shift+T` / `Ctrl+Shift+T`, or click "Ask About a Feature" in the command hub.
**Skill file:** `/side-bae-tour how does authentication work`

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
**Skill file:** `/side-bae-features`

**What you get:** A categorized tree of features the AI found in the codebase — auth, API routes, database layer, UI components, etc. Each feature has a semantic icon and description. Click any feature to generate a full walkthrough for it.

The feature list is cached in `.side-bae/features.json`, so it loads instantly on subsequent opens.

---

### Learn from This Code

Clone any codebase you admire and learn from it with a live AI tutor. The AI walks you through the code step by step, asks you questions, reacts to your answers, and adapts based on your understanding.

**How to start:** `Cmd+Shift+L` / `Ctrl+Shift+L`, or click "Learn from This Code" in the command hub.
**Skill file:** `/side-bae-lesson how the virtual scroll engine works`

**What you get:**
- A **vertical stepper** showing the full lesson plan — you always know where you are and what's coming
- **Guided discovery** — the AI asks questions first, then explains. You discover patterns before they're named.
- **Knowledge checks** — text predictions ("what do you think this does?"), multiple choice, and follow-up questions
- **Instant feedback** — the AI reacts to YOUR actual words, not a canned response
- **Personalized recap** — see what clicked, where your thinking evolved, and concepts to revisit
- **Free replay** — completed lessons save as static tours, replayable without AI calls

**Scan for topics:** Click "Scan for Things to Learn" in the sidebar menu to auto-discover learnable patterns in any codebase.
**Skill file:** `/side-bae-concepts`

**Pre-generated lessons:** Lesson authors can create `.full-lesson.json` files that play back instantly with no AI required. These appear in the Learn section of the sidebar.

---

### Investigate Issue

Paste a bug description and debug it collaboratively with AI. The AI investigates step by step, shows its work, and asks for your guidance.

**How to start:** Click "Investigate Issue" in the command hub or sidebar menu. Paste or describe the bug.
**Skill file:** `/side-bae-investigate login fails with 401 after session timeout`

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
**Skill file:** `/side-bae-whats-new this week`

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
