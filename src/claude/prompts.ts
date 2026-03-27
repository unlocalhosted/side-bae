export function buildTourGenerationPrompt(query: string): string {
  return `You are writing an interactive article about a codebase. Not documentation. Not a function reference. An article — with a narrative arc, a point of view, and a voice that sounds like a sharp friend explaining their favorite codebase over coffee.

The workspace root is the current directory. The reader wants to understand: "${query}"

Read the relevant source files. Trace the code paths. Then produce a tour as a JSON object following the provided schema.

## Voice and tone

Write like you're explaining to someone smart who hasn't seen this code. Be direct, be specific, have opinions. Sound like a real person — not a documentation generator.

- Say "this is clever because..." or "this is a bit unusual —" when something deserves it
- Call out elegant design: "Notice how this avoids a database round-trip by..."
- Flag surprising choices: "You might expect X here, but they went with Y because..."
- Reference actual code: \`functionName()\`, \`variableName\`, \`fileName.ts\` — always in backticks
- Bold **key concepts** the first time they appear so the reader builds a vocabulary
- If there's a pattern (middleware chain, pub-sub, state machine), name it explicitly

DO NOT write like this:
"This file contains the authentication middleware. It exports a function that validates tokens. The function checks the Authorization header."

That's a code-to-English translator. It tells the reader nothing they couldn't get from the file name and a 2-second scan. Instead:

"Every request to the API passes through this single gateway. It cracks open the \`Authorization\` header, pulls the **Bearer token**, and runs it through \`jwt.verify()\` — if that fails, the request dies here with a 401. No route handler ever sees an unauthenticated request. The clever part: the verified payload (with \`userId\` and \`role\`) gets stapled onto \`req.user\`, which means every downstream handler gets identity for free. New endpoints don't need auth code — they inherit it."

That's an article paragraph. It has momentum, specificity, and a point of view ("the clever part"). It tells you something you couldn't learn from scanning the file for 10 seconds.

## What each stop should do

**The first stop** sets the scene. Don't jump into implementation. Answer: what is this feature? What problem does it solve? Where does the user's request or data enter the system? Give the reader a mental model before showing them code.

**Middle stops** follow the data. Each one picks up where the previous left off — the reader arrived via an edge label ("which validates the token"), so start by threading that connection. Then go deeper: how does this piece work, what's the design decision behind it, what would break if you changed it.

**The last stop on each branch** should feel like an ending — the data has reached its destination, the side effect has happened, the response has been sent. The reader should think "ah, I see how this fits together."

## Tour structure

The tour is a tree — it can branch but never loops back. Each branch terminates at a leaf node (zero edges). The reader follows one path to the end, comes back, explores another.

- No cycles. Edges never point back to an ancestor node.
- Only branch when the code genuinely forks (happy path vs error path, read vs write). Most tours have 1-2 forks.
- 5-8 nodes. Enough to tell the story, not so many it loses focus.
- Edge labels read as continuations: "which validates the token", "then queries the user table", "if that fails, handles the error"

## Formatting

- \`backticks\` for all code references — functions, variables, files, types
- **bold** for key concepts on first mention
- Bullet lists when listing related items (never for the main explanation)
- Fenced code blocks for 2-4 line snippets that show a key pattern
- Write substantial paragraphs — not one-liners, not walls of text

## Output rules

- entryNode: where the feature begins
- Each node: real file, accurate 1-based line numbers
- Node IDs: kebab-case descriptive names
- id: kebab-case slug from the query
- trackedFiles: run "git log -1 --format=%h -- <file>" per file
- generatedAt: current ISO 8601 timestamp
- Exclude node_modules, dist, build artifacts`;
}

export function buildWhatsNewPrompt(range: string): string {
  return `Analyze the recent changes in this git repository for the time range: "${range}"

Steps:
1. Interpret the time range naturally. Examples: "this week" → --since=1.week.ago, "last 5 commits" → -5, "since Monday" → --since=last.monday, "since v2.0" → v2.0..HEAD
2. Run git log with the appropriate flags. Include author and changed files: git log --format="%h %an %s" --name-only <range-flags>
3. Group commits by author first — one author's commits in a time window almost always form a coherent feature or fix. This is the primary clustering signal.
4. Within each author's commits, identify logical changes (a feature, bugfix, refactor, or chore). Merge commits that are clearly part of the same work.
5. If multiple authors touched the same files for the same logical change (co-authored work), merge into a single change with the primary author noted.

Return a JSON object with a "changes" array, ordered most recent first. Each change should have:
- name: Short descriptive name (e.g., "Redesigned tour card UI", "Fixed session timeout bug")
- summary: One-line description of what this change accomplishes
- author: The primary author's name
- date: Relative date of the most recent commit in this change (e.g., "3 days ago", "yesterday")
- commits: Array of short commit SHAs grouped into this change
- files: Array of files touched (relative paths from workspace root, deduplicated)

Aim for 3-10 logical changes. If there are more than 15 commits, group aggressively by author + topic. If fewer than 3 commits, each commit can be its own change.
Do not include merge commits or automated commits (dependabot, CI bots) unless they are the only activity.`;
}

export function buildInvestigationPrompt(
  issueTitle: string,
  issueBody: string
): string {
  return `You are investigating a bug or issue reported in this codebase. The workspace root is the current directory.

Issue title: "${issueTitle}"

Issue details:
${issueBody}

Scan the codebase to understand the issue, locate the root cause, and propose a fix. Produce a tour as a JSON object following the provided schema.

Node rules:
- Use kind: "context" for nodes that explain the relevant code area (background, setup)
- Use kind: "problem" for nodes that pinpoint the root cause — explain what's wrong AND what the correct behavior should be
- Use kind: "solution" for nodes that propose the fix — include a suggestedEdit with exact oldText/newText when a code change is proposed
- Start with context nodes, narrow to problem nodes, end with solution nodes
- The tour flows forward: context → problem → solution. No cycles — edges never point back. Each path terminates at a leaf node.
- The entryNode should be a context node that orients the reader
- Each node must reference a real file with accurate line numbers
- Explanations should be thorough: problem nodes should contrast "what happens" vs "what should happen"
- Format explanations with markdown: use \`backticks\` for function names, variables, and file paths; use **bold** for key concepts; use bullet lists and fenced code blocks where helpful
- suggestedEdit.oldText must be an exact substring of the current file content
- 4-8 nodes typical: 1-2 context, 1-2 problem, 1-3 solution

Report rules (the "report" field):
- Must be a self-contained markdown string readable by someone who hasn't seen the tour
- Follow open source bug fix PR etiquette:
  - ## Problem — issue summary, observed symptoms, reproduction context
  - ## Root Cause — the specific code path and logic error (reference file:line)
  - ## Fix — what was changed, why this approach was chosen over alternatives
  - ## Files Changed — bulleted list of files with one-line description of each change
  - ## How to Verify — concrete steps to test the fix
- Meant to be pasted directly as a PR description

General rules:
- Each node must reference a real file that exists in the workspace (use relative paths)
- Line numbers must be accurate and 1-based
- Edge labels describe the relationship (e.g., "Where it breaks", "See the fix")
- Node IDs should be kebab-case descriptive names
- The id field should be a kebab-case slug like "investigate-<short-description>"
- For trackedFiles, run "git log -1 --format=%h -- <file>" for each referenced file
- Set generatedAt to the current ISO 8601 timestamp
- Do not include node_modules, dist, or build artifacts`;
}

export function buildFeatureDiscoveryPrompt(): string {
  return `Analyze this codebase and identify the major features and capabilities. Look at:
- Directory structure and naming
- Entry points (main files, route definitions, command handlers)
- Exported modules and their purposes
- README, docs, and configuration files

Return a JSON object with a "features" array. Each feature should have:
- name: Short feature name (e.g., "Authentication", "Payment Processing")
- description: One-line description of what this feature does
- icon: A VS Code codicon name that represents this feature (e.g., "shield" for auth, "database" for storage, "globe" for API, "gear" for config, "beaker" for tests, "terminal" for CLI)
- path: The primary file or directory for this feature (optional)
- children: Sub-features if applicable (optional, same structure but without nested children, each with their own icon)

Focus on high-level features that a new developer would want to understand. Group related functionality together.
Aim for 3-8 top-level features depending on the project size.
Do not include build tooling, CI/CD, or dev dependencies as features unless they are the primary purpose of the project.`;
}
