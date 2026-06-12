# Side Bae — Development Guidelines

## Design Context

### Users
Developers joining or working on unfamiliar codebases. They're in VS Code, mid-task, and need to understand how code connects — not read documentation.

### Brand Personality
**Friendly, Curious, Playful** — like a knowledgeable friend who makes exploring code enjoyable. Has opinions, celebrates progress, makes the mundane engaging.

### Design Principles

1. **Native, not bolted on** — Use VS Code theme tokens, standard patterns, codicons. If a user can't tell where VS Code ends and Side Bae begins, that's a win.
2. **Explain through structure, not just text** — Graphs, colored borders, spatial layout should convey meaning before reading.
3. **Celebrate without gamifying** — Confetti and warm copy are earned moments. No points, streaks, or badges.
4. **Fast and forgettable** — Navigation shouldn't require thought. The user's attention belongs on the code, not the tool.
5. **Opinionated defaults, minimal configuration** — One button to start, one click to navigate. Don't ask users to configure what you can decide.

### Anti-references
- Jira / enterprise tooling (heavy, over-configured)
- Overly gamified apps (childish for professional devs)
- Generic AI chat (bland, no structure)

### Technical Tokens
- Colors: Exclusively `--vscode-*` theme tokens. No hardcoded hex.
- Typography: 10/11/12/13/14px scale. Editor font for code, system font for UI.
- Spacing: 4px base. Gaps: 4/8/10/12px. Padding: 8/12/16/20px.
- Border radius: 3-4px. Animations: 0.15-0.2s ease-out. Respect `prefers-reduced-motion`.
