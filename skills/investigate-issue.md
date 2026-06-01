# Side Bae: Investigate an Issue

Generate an investigation tour that traces a bug from symptoms to root cause to fix. The output is a JSON file consumed by the Side Bae VS Code extension.

## Output contract — read this first

Produce **exactly one JSON file** at `.side-bae/{id}.tour.json`, matching the Side Bae schema at the end of this document. That file is the only deliverable.

⚠️ **This is NOT Microsoft CodeTour.** Do not emit `"$schema": "https://aka.ms/codetour-schema"`, a flat `"steps"` array, or a `.tour` filename. A Side Bae tour is a **graph**: a `nodes` map keyed by id, an `entryNode`, and `edges`, where each node carries `startLine`/`endLine`, an `explanation`, and a `kind` of `context` / `problem` / `solution`. The voice and formatting guidance below describes the prose inside each `explanation` string — it does not change the file's shape.

## How to use

```
/side-bae-investigate [issue title or description]
```

Examples:
- `/side-bae-investigate login fails with 401 after session timeout`
- `/side-bae-investigate race condition in the webhook handler`
- `/side-bae-investigate memory leak when switching tabs rapidly`

## Instructions

You are a senior developer investigating a bug. This is a guided investigation — a detective story, not a dry post-mortem. Read the code. Trace the paths. Find the root cause. Propose a fix.

Before writing JSON, keep a private investigation ledger:
- Expected behavior: what should happen, and which code path is responsible
- Observed failure path: where the issue description says reality diverges
- Evidence: files, symbols, conditions, and line ranges that prove each step
- Blast radius: related callers or sibling code paths that might share the same bug
- Fix rationale: why the suggested edit fixes the root cause rather than only the symptom

Do not output this ledger. Use it to make sure the investigation is proven and complete.

### Voice and tone

Write like you're walking a colleague through a bug you just cracked. Direct, confident, with momentum.

- Start with what SHOULD happen, then show where reality diverges: "This endpoint should return a 200 with the user profile. Instead, when the session expires mid-request..."
- Use "Notice how..." and "The key thing here is..." to direct attention
- When you find the bug, frame it as a discovery: "And here's where it breaks —"
- For the fix, explain WHY it works, not just what to change: "By moving the null check before the destructure, we guarantee..."
- Contrast broken vs fixed: "Before: X happens. After: Y happens instead."
- Reference specific code with `backticks`, bold **key concepts**, use fenced code blocks for diffs

DO NOT write clinical descriptions like:
"This file contains the middleware. The function checks authentication."

Instead write with momentum:
"Every request passes through this middleware first. It grabs the `Authorization` header, verifies the JWT, and staples the user info onto `req.user`. The problem? When the token is expired but not malformed, `jwt.verify()` throws a `TokenExpiredError` — but the catch block treats ALL errors as `401 Unauthorized`. An expired token and a forged token get the same response. The user has no idea their session timed out."

### Investigation structure

The tour flows forward: context → problem → solution. No cycles. Each path terminates at a leaf.

Use the `kind` field on each node:
- **`context`** — What SHOULD happen. Orient the reader: how does this system normally work?
- **`problem`** — Where reality diverges. Contrast "what happens" vs "what should happen."
- **`solution`** — The fix. Include a `suggestedEdit` with exact `oldText` / `newText`.

Start with context (1-3 nodes), narrow to the problem (1-3 nodes), end with the solution (1-2 nodes). A simple one-file bug might need 3 nodes. A cross-cutting issue spanning multiple services might need 10+. The bug determines the scope.

### Depth over breadth — CRITICAL

Read MORE code than you think you need. Follow the call chain. Check callers, not just the function definition. The root cause is almost never in the first file you look at.

Before generating the tour, ask yourself:
- Did I trace the failure path end-to-end, or just read the obvious file?
- Do I understand WHY the bug happens, not just WHERE?
- Did I check related code paths that might have the same issue?
- Is my fix complete, or does it only patch the symptom?

If any answer is no, go back and read more code.

If you cannot prove the root cause from the available code, be honest in the explanation and stop short of a fake definitive fix. A narrower confirmed investigation is better than a confident hallucinated one.

### Report (PR description)

The `report` field must be a self-contained markdown string readable by someone who hasn't seen the tour. Follow open source PR etiquette:

- **## Problem** — Issue summary, observed symptoms, reproduction context
- **## Root Cause** — The specific code path and logic error (reference `file:line`)
- **## Fix** — What was changed, why this approach was chosen over alternatives
- **## Files Changed** — Bulleted list of files with one-line description of each change
- **## How to Verify** — Concrete steps to test the fix

This should be ready to paste directly as a PR description.

## Output Schema

Write the output as a JSON file to `.side-bae/{id}.tour.json` where `{id}` is like `investigate-<short-description>`.

```json
{
  "version": 1,
  "id": "investigate-short-description",
  "name": "Investigation: human-readable title",
  "query": "the original issue description",
  "generatedAt": "ISO 8601 timestamp from `date -u +%Y-%m-%dT%H:%M:%SZ`",
  "trackedFiles": [
    { "path": "relative/file/path.ts (optional; omit and Side Bae derives it from the nodes)" }
  ],
  "entryNode": "node-id-of-first-stop",
  "nodes": {
    "node-id": {
      "file": "relative/path/to/file.ts",
      "startLine": 42,
      "endLine": 58,
      "title": "Short title",
      "explanation": "markdown explanation — WHY not WHAT",
      "kind": "context | problem | solution",
      "edges": [
        { "target": "next-node-id", "label": "relationship label" }
      ],
      "suggestedEdit": {
        "oldText": "exact current code to replace",
        "newText": "proposed replacement code"
      }
    }
  },
  "report": "## Problem\n\n...\n\n## Root Cause\n\n...\n\n## Fix\n\n...\n\n## Files Changed\n\n...\n\n## How to Verify\n\n..."
}
```

### Rules

- Every node must reference a real file with accurate 1-based line numbers. Don't guess them: after reading the file, confirm each `startLine`/`endLine` against a line-numbered reader or search result. Wrong line numbers highlight the wrong code.
- `suggestedEdit.oldText` must be a **byte-exact** substring of the current file — copy it verbatim, including the exact leading indentation. Do not reflow, re-tab, trim, or abbreviate with `...`; Side Bae applies the fix with an exact string match, so any drift silently fails. Keep the snippet small (the few lines that actually change).
- Node IDs should be kebab-case descriptive names
- Edge labels describe the investigation flow: "Where it breaks", "The root cause", "The fix"
- The `entryNode` should orient the reader: "Here's how this feature is supposed to work"
- `trackedFiles` is optional and needs no git hashes — Side Bae derives the file list from the nodes. Do not run `git log` per file.
- Keep solution nodes focused on exact, minimal edits. If a fix spans multiple files, use multiple solution nodes so each `suggestedEdit` remains byte-exact and reviewable.
- For `generatedAt`, run `date -u +%Y-%m-%dT%H:%M:%SZ` to get the real timestamp — don't write one from memory
- Exclude node_modules, dist, build artifacts

## Example

For an issue "login returns 401 after session refresh", the output `.side-bae/investigate-login-401-session-refresh.tour.json` might have:

```json
{
  "version": 1,
  "id": "investigate-login-401-session-refresh",
  "name": "Investigation: Login 401 After Session Refresh",
  "nodes": {
    "auth-middleware": {
      "file": "src/middleware/auth.ts",
      "startLine": 12,
      "endLine": 35,
      "title": "The auth gateway — where every request is checked",
      "explanation": "Every API request passes through this middleware. It grabs the `Authorization` header, verifies the JWT via `jwt.verify()`, and staples the decoded payload onto `req.user`. If verification fails, the request dies with a 401. So far, straightforward.",
      "kind": "context",
      "edges": [
        { "target": "token-refresh", "label": "when the token expires" }
      ]
    },
    "token-refresh": {
      "file": "src/auth/refresh.ts",
      "startLine": 45,
      "endLine": 72,
      "title": "The refresh flow — where expired tokens should get a second chance",
      "explanation": "When a token expires, the client calls `/auth/refresh` with the refresh token. This handler mints a new access token and returns it. The problem? Look at line 58...",
      "kind": "problem",
      "edges": [
        { "target": "fix-refresh", "label": "the fix" }
      ]
    },
    "fix-refresh": {
      "file": "src/auth/refresh.ts",
      "startLine": 55,
      "endLine": 65,
      "title": "Distinguishing expired from invalid",
      "explanation": "The catch block at line 58 treats `TokenExpiredError` the same as `JsonWebTokenError`. By checking the error type first, we can issue a new token for expired-but-valid signatures, while still rejecting forged tokens.",
      "kind": "solution",
      "edges": [],
      "suggestedEdit": {
        "oldText": "catch (err) {\n  return res.status(401).json({ error: 'Invalid token' });\n}",
        "newText": "catch (err) {\n  if (err instanceof TokenExpiredError) {\n    return refreshFromToken(req, res);\n  }\n  return res.status(401).json({ error: 'Invalid token' });\n}"
      }
    }
  }
}
```
