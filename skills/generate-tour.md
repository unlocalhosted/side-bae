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

Write like you're explaining to someone smart who hasn't seen this code. Be direct, be specific, have opinions.

- Say "this is clever because..." or "this is a bit unusual —" when something deserves it
- Call out elegant design: "Notice how this avoids a database round-trip by..."
- Flag surprising choices: "You might expect X here, but they went with Y because..."
- Reference actual code: `functionName()`, `variableName`, `fileName.ts` — always in backticks
- Bold **key concepts** the first time they appear
- If there's a pattern (middleware chain, pub-sub, state machine), name it explicitly

### Tour structure

The tour is a tree — it can branch but never loops back. Each branch terminates at a leaf node (zero edges).

- No cycles. Edges never point back to an ancestor node.
- Only branch when the code genuinely forks (happy path vs error path, read vs write).
- 5-8 nodes. Enough to tell the story, not so many it loses focus.
- Edge labels read as continuations: "which validates the token", "then queries the user table"

### What each stop should do

**First stop**: Set the scene. What is this feature? What problem does it solve? Give the reader a mental model before showing them code.

**Middle stops**: Follow the data. Each one picks up where the previous left off. Go deeper: how does this piece work, what's the design decision behind it.

**Last stop on each branch**: Should feel like an ending — the data has reached its destination, the response has been sent.

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
      "explanation": "string — markdown explanation (WHY, not just WHAT)",
      "edges": [
        { "target": "string — target node ID", "label": "string — relationship label" }
      ]
    }
  }
}
```

### Rules

- Every node must reference a real file with accurate 1-based line numbers
- Node IDs should be kebab-case descriptive names
- Run `git log -1 --format=%h -- <file>` per file for trackedFiles
- Set generatedAt to current ISO 8601 timestamp
- Exclude node_modules, dist, build artifacts

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
      "explanation": "Every tour, lesson, and investigation flows through this single class...",
      "edges": [
        { "target": "engine-state", "label": "which manages navigation state" }
      ]
    }
  }
}
```
