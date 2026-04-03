# Changelog

## 0.3.0

### Multi-Provider AI Architecture

Side Bae no longer requires Claude Code exclusively. The monolithic Claude adapter has been replaced with a pluggable provider system that supports multiple AI backends:

- **Claude Code** — Full-featured provider via the Claude Agent SDK (default)
- **VS Code Language Model API** — Works with Copilot and any LM API-compatible model
- **Auto-detection** — Picks the best available provider automatically
- **`sideBae.provider` setting** — Choose `auto`, `claude-code`, or `copilot`

### Skill-File Architecture

AI agent workflows (tours, lessons, feature discovery, what's-new) are now defined as portable Markdown skill files in `skills/`. This enables:

- **Offline rendering** — Pre-generated full lessons play back instantly with zero AI cost
- **File watcher** — Externally generated `.tour.json` and `.full-lesson.json` files are picked up automatically
- **`Side Bae: Install Skill Files`** — One-click command copies skill definitions into `.side-bae/` for external AI agents to use

### Lesson Engine Overhaul

The lesson experience has been substantially rebuilt for speed and depth:

- **Vertical stepper UI** — Replaced flat card view with a structured stepper showing plan, progress, and completed steps at a glance
- **Instant navigation** — Next step content is prefetched during the current step, so transitions feel immediate
- **File content pre-loading** — All lesson files are read upfront and injected into prompts, eliminating mid-lesson file reads
- **Better pedagogy** — Improved prompts for completeness, question variety, inline code refs, and guided discovery
- **Session persistence** — Lessons survive editor restarts with per-schema scoped state
- **Codebase context injection** — AI receives a pre-scanned codebase overview for richer, more grounded explanations
- **History truncation** — Long conversations are intelligently trimmed to stay within context limits

### Performance & Reliability

- **Prefetch pipeline** — Aggressive parallel prefetch of next lesson step content
- **Status bar progress** — Real-time progress indicator for all long-running operations
- **Cached status checks** — Claude availability checks are deduplicated and cached
- **Double-trigger guards** — Prevents duplicate concurrent operations across all flows
- **Race condition fixes** — Resolved webview dispose race, broken prefetch cancel, stale panel references
- **Per-query SDK config** — Each AI operation specifies its own effort level, max turns, tools, and system prompt

### UI Polish

- **Command hub primary action** — "Ask About a Feature" uses accent styling with clear visual hierarchy
- **Redesigned welcome view** — Warm copy, 2 focused buttons instead of 5, codicons
- **Webview renders on first click** — Fixed the timing/focus/layout bug that required a second click
- **Sidebar toolbar cleanup** — 2 icons in toolbar, rest in overflow menu with full labels
- **Earned celebrations only** — Confetti fires for completed tours, leaf nodes, and PRs — not on summary card load
- **Auto-scroll on step change** — Active lesson step scrolls into view smoothly
- **Phase-aware loading** — Investigation loading shows "Understanding the issue...", "Scanning code...", etc.
- **Interaction states** — Every button has hover, active, and focus-visible states with consistent `0.15s ease-out` timing
- **Keyboard accessibility** — Summary stop items are keyboard-navigable; all interactive elements have focus rings
- **High contrast support** — Complete `forced-colors` media query coverage

### Documentation

- **Ubiquitous language glossary** — `UBIQUITOUS_LANGUAGE.md` with domain term definitions across all systems
- **Agent architecture doc** — `docs/architecture/agent-architecture-v1.md` design document

## 0.2.1

### Interactive Investigation Mode

Investigation is now a live, collaborative debugging session instead of a one-shot static report. The AI investigates step by step, asks for your guidance, and you can steer the process.

- **Collaborative debugging** — AI shows its work at each step, asks "Am I on the right track?", accepts redirections
- **Live fix proposals** — Review diffs, give feedback ("I have feedback"), approve with "Apply this fix"
- **Test verification** — "Run tests" executes the test suite and reports pass/fail with error details
- **PR creation** — "Open pull request" creates a branch, commits, pushes, and opens a PR via `gh` CLI
- **Investigation trail** — Color-coded breadcrumb showing each file investigated (blue=context, red=problem, green=fix)
- **Delight** — "Found it" border pulse on diagnosis, animated test results, rain confetti on PR creation

## 0.2.0

### Guided Learning Mode

Clone any codebase you admire and learn from it with a live AI tutor. The AI stays present throughout the entire lesson, reacting to your predictions and answers, adapting depth based on your understanding.

- **Live tutor sessions** — Multi-turn conversations where the AI teaches you step by step, responding to YOUR actual words
- **Guided discovery** — You discover concepts through questions, not lectures. Patterns get named after you understand them.
- **5 pedagogical layers** — Outcome, Architecture, Rationale, Insight, Challenge
- **Knowledge checks** — Text predictions, multiple choice, follow-up questions
- **Personalized recap** — See what clicked, where your thinking evolved, and what to revisit
- **Free replay** — Completed lessons save as static tours you can revisit anytime
- **Scan any codebase** — Automatically finds learnable patterns in any project type
- **Keyboard shortcut** — `Cmd+Shift+L` / `Ctrl+Shift+L`

### Command Hub

The empty webview panel is now a polished command hub showing all 5 capabilities:

- Ask About a Feature
- Discover Features
- Investigate Issue
- Learn from This Code
- What's New

Each with an icon, description, and keyboard shortcut. The sidebar welcome view also surfaces all capabilities for first-time users.

### UX Polish

- **Better error messages** — Removed internal jargon ("Claude ran out of turns" becomes "This was too complex. Try something more specific.")
- **Natural tooltips** — "(takes a moment)" instead of "(uses Claude API)"
- **Investigation voice** — Bug investigations now read like detective stories, not clinical reports. Badges: "The Setup", "What's Wrong", "The Fix"
- **Brilliant-style lesson voice** — AI uses guided discovery pedagogy: ask first, explain after, concrete before abstract
- **Real progress transparency** — Shows exactly what Claude is doing in real-time ("Reading engine/tour-store.ts", "Searching useCallback") instead of canned fake messages. Lessons now get live progress too.
- **Clearer labels** — "What you learned" instead of "Lesson complete", "Copy report" instead of "Copy for PR"
- **Better tree view** — "Learn — patterns & architecture", "What's New — recent changes", "Investigate an issue..." hint

## 0.1.0

Initial release with tour generation, feature discovery, What's New, and Investigate Issue.
