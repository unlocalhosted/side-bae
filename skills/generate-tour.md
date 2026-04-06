# Side Bae: Generate a Code Tour

Generate an interactive code tour that guides a developer through a codebase feature. The output is a JSON file consumed by the Side Bae VS Code extension.

## How to use

```
/side-bae-tour [feature or question]
```

Example: `/side-bae-tour how does authentication work`

## Instructions

You are writing an interactive article about a codebase. Not documentation. Not a function reference. An article — with a narrative arc, a point of view, and a voice that sounds like a sharp friend explaining their favorite codebase over coffee.

Read the relevant source files. Trace the code paths. Then produce a tour as a JSON file.

### Voice and tone

Write like you're explaining to someone smart who hasn't seen this code. Be direct, be specific, have opinions. Sound like a real person — not a documentation generator.

- Say "this is clever because..." or "this is a bit unusual —" when something deserves it
- Call out elegant design: "Notice how this avoids a database round-trip by..."
- Flag surprising choices: "You might expect X here, but they went with Y because..."
- Reference actual code: `functionName()`, `variableName`, `fileName.ts` — always in backticks
- Bold **key concepts** the first time they appear so the reader builds a vocabulary
- If there's a pattern (middleware chain, pub-sub, state machine), name it explicitly

DO NOT write like this:
"This file contains the authentication middleware. It exports a function that validates tokens. The function checks the Authorization header."

That's a code-to-English translator. It tells the reader nothing they couldn't get from the file name and a 2-second scan. Instead:

"Every request to the API passes through this single gateway. It cracks open the `Authorization` header, pulls the **Bearer token**, and runs it through `jwt.verify()` — if that fails, the request dies here with a 401. No route handler ever sees an unauthenticated request. The clever part: the verified payload (with `userId` and `role`) gets stapled onto `req.user`, which means every downstream handler gets identity for free. New endpoints don't need auth code — they inherit it."

That's an article paragraph. It has momentum, specificity, and a point of view ("the clever part"). It tells you something you couldn't learn from scanning the file for 10 seconds.

### Tour structure

The tour is a tree — it can branch but never loops back. Each branch terminates at a leaf node (zero edges). The reader follows one path to the end, comes back, explores another.

- No cycles. Edges never point back to an ancestor node.
- Only branch when the code genuinely forks (happy path vs error path, read vs write). Most tours have 1-2 forks.
- Use as many nodes as the feature ACTUALLY requires. A simple utility might need 3 nodes. A complex auth flow spanning 12 files needs 12+ nodes. Do not pad simple features or truncate complex ones. The code determines the scope, not an arbitrary number.
- Edge labels read as continuations: "which validates the token", "then queries the user table", "if that fails, handles the error"

### What each stop should do

**The first stop** sets the scene. Don't jump into implementation. Answer: what is this feature? What problem does it solve? Where does the user's request or data enter the system? Give the reader a mental model before showing them code.

**Middle stops** follow the data. Each one picks up where the previous left off — the reader arrived via an edge label ("which validates the token"), so start by threading that connection. Then go deeper: how does this piece work, what's the design decision behind it, what would break if you changed it.

**The last stop on each branch** should feel like an ending — the data has reached its destination, the side effect has happened, the response has been sent. The reader should think "ah, I see how this fits together."

### Formatting

- `backticks` for all code references — functions, variables, files, types
- **bold** for key concepts on first mention
- Bullet lists when listing related items (never for the main explanation)
- Fenced code blocks only for 2-4 line snippets that show a key pattern
- Write substantial paragraphs — not one-liners, not walls of text. Each explanation should be 3-8 sentences minimum.

### Depth over breadth — CRITICAL

Read MORE code than you think you need. Follow imports. Check how functions are called, not just how they're defined. The best stops come from understanding the connections BETWEEN files, not describing single files in isolation.

Before generating the tour, ask yourself:
- Did I trace data flow end-to-end, or just read top-level files?
- Do my explanations reveal something a 2-minute code scan WOULDN'T?
- Did I name specific design decisions, trade-offs, or patterns?
- Would a senior developer learn something from reading this?
- Does every explanation have at least 3-4 sentences of genuine insight?

If any answer is no, go back and read more code.

A shallow tour that skims the surface of 5 files is worse than a deep tour that thoroughly explains 12. Accuracy and completeness are the top priorities.

## Output Schema

Write the output as a JSON file to `.side-bae/{id}.tour.json` where `{id}` is a kebab-case slug derived from the query.

```json
{
  "version": 1,
  "id": "string — kebab-case unique identifier",
  "name": "string — human-readable tour name",
  "query": "string — the original question",
  "generatedAt": "string — ISO 8601 timestamp",
  "trackedFiles": [
    { "path": "string — relative file path", "lastCommit": "string — short git hash" }
  ],
  "entryNode": "string — ID of the first node",
  "nodes": {
    "node-id": {
      "file": "string — relative file path",
      "startLine": "number — 1-based",
      "endLine": "number — 1-based",
      "title": "string — short title",
      "explanation": "string — markdown explanation (WHY, not just WHAT). Minimum 3 sentences.",
      "edges": [
        { "target": "string — target node ID", "label": "string — relationship label" }
      ]
    }
  }
}
```

### Rules

- Every node must reference a real file with accurate 1-based line numbers — verify by reading the file
- Node IDs should be kebab-case descriptive names
- Run `git log -1 --format=%h -- <file>` per file for trackedFiles
- Set generatedAt to current ISO 8601 timestamp
- Exclude node_modules, dist, build artifacts
- Each explanation must have genuine insight — if it only restates what the code does, rewrite it to explain WHY
- Every node must be reachable from the entryNode by following edges

## Quality checklist (verify before outputting)

1. Does the tour have enough nodes to cover the feature end-to-end? (not a shallow 5-stop overview of a complex system)
2. Does every explanation contain insight a 2-minute code scan wouldn't reveal?
3. Are all file paths real and all line numbers accurate?
4. Do edge labels read naturally as continuations of the previous explanation?
5. Does the first stop set context before diving into code?
6. Do leaf nodes feel like natural endings, not abrupt stops?

## Example

For a query "how does the tour player work", the output file `.side-bae/tour-player.tour.json` might start:

```json
{
  "version": 1,
  "id": "tour-player",
  "name": "The Tour Player",
  "query": "how does the tour player work",
  "generatedAt": "2026-04-02T10:00:00Z",
  "trackedFiles": [
    { "path": "src/views/tour-player/tour-player.ts", "lastCommit": "abc1234" }
  ],
  "entryNode": "player-entry",
  "nodes": {
    "player-entry": {
      "file": "src/views/tour-player/tour-player.ts",
      "startLine": 25,
      "endLine": 40,
      "title": "The Tour Player — command center",
      "explanation": "Every tour, lesson, and investigation flows through this single class. It's the **Tour Player** — a coordinator that owns the webview panel, the navigation engine, and file decorations. When a tour starts, `startTour()` loads the tour document into the engine, opens the webview beside the editor, and navigates to the entry node. Notice how it doesn't render anything itself — it delegates rendering to the webview and navigation state to `TourEngine`. This separation means the player can handle tours, lessons, and investigations through the same pipeline, just by swapping what gets sent to the webview.",
      "edges": [
        { "target": "engine-state", "label": "which manages navigation state" }
      ]
    }
  }
}
```
