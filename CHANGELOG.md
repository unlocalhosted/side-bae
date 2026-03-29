# Changelog

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
- **Cycling loading states** — "Reading your response...", "Exploring the code...", "Preparing the next step..."
- **Clearer labels** — "What you learned" instead of "Lesson complete", "Copy report" instead of "Copy for PR"
- **Better tree view** — "Learn — patterns & architecture", "What's New — recent changes", "Investigate an issue..." hint

## 0.1.0

Initial release with tour generation, feature discovery, What's New, and Investigate Issue.
