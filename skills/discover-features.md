# Side Bae: Discover Features

Analyze a codebase and identify its major features and capabilities. The output is a JSON file consumed by the Side Bae VS Code extension's sidebar.

> **Features vs. concepts:** this command maps what the codebase *does* — its capabilities, for the sidebar's feature tree. If you instead want what's worth *learning* from how it's built (teachable patterns and techniques), that's a different command, `/side-bae-concepts`. Don't produce a list of learnable topics here.

## How to use

```
/side-bae-features
```

## Instructions

Scan the codebase systematically. Look at:

- Directory structure and naming conventions
- Entry points (main files, route definitions, command handlers, exported modules)
- Configuration files that reveal capabilities (package.json scripts, Dockerfile services, etc.)
- README, docs, and inline comments that describe features

Focus on high-level features that a new developer would want to understand. Group related functionality together. Think about what a developer would see in a table of contents for this codebase.

Before writing JSON, do a private dedupe pass:
- Merge overlapping features that describe the same capability from different files
- Split features that share a directory but serve different user or system outcomes
- Verify every `path` by reading or listing it; omit `path` when you cannot verify it
- Check whether a feature should be a child of another feature instead of a top-level sibling

Do not output this pass. Use it to keep the sidebar complete without duplicates.

### What counts as a feature

A "feature" is a user-facing capability or a major internal system. Examples: "Authentication", "Payment Processing", "Real-time Notifications", "Search Engine", "CLI Commands".

### What does NOT count

Don't include build tooling, CI/CD, linting, or dev dependencies as features UNLESS they are the project's primary purpose (e.g., a webpack plugin project should list its plugin capabilities).

### Depth

Include as many features as the project actually has. A microservice might have 3. A large monorepo might have 20. Do NOT cap arbitrarily — completeness matters.

Use `children` for features with clear sub-components (e.g., "Authentication" might have children "JWT Validation", "OAuth Providers", "Session Management"). Don't nest children deeper than one level.

## Output Schema

Write the output to `.side-bae/features.json`. That file is the only deliverable — write it to disk; don't paste the JSON into the chat.

```json
[
  {
    "name": "string — feature name (e.g., 'Authentication')",
    "description": "string — one-line description of what this feature does",
    "icon": "string — VS Code codicon name (e.g., 'shield', 'database', 'globe', 'gear')",
    "path": "string — primary file or directory (optional)",
    "children": [
      {
        "name": "string — sub-feature name",
        "description": "string — one-line description",
        "path": "string — primary file/directory",
        "icon": "string — codicon name"
      }
    ]
  }
]
```

### Rules

- Include as many features as the project actually has — complete coverage, not a top-5 summary
- Each feature needs a semantically relevant VS Code codicon icon — pick the most descriptive one (e.g., 'shield' for auth, 'database' for storage, 'globe' for API, 'rocket' for deployment, 'beaker' for tests)
- Don't include build tooling, CI/CD, or dev dependencies as features unless they are the project's primary purpose
- Children are optional — use them for features with clear sub-components (no nested children)
- Descriptions should be specific, not generic — "Validates JWT tokens and manages user sessions" is better than "Handles authentication"
- Order features by importance/centrality to the project, not alphabetically
- Every `path` must point to a real file or directory. If there is no clear primary path, omit it rather than guessing.
