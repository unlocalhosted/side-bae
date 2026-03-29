# Changelog

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
