# Side Bae: Discover Features

Analyze a codebase and identify its major features and capabilities. The output is a JSON file consumed by the Side Bae VS Code extension's sidebar.

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

### What counts as a feature

A "feature" is a user-facing capability or a major internal system. Examples: "Authentication", "Payment Processing", "Real-time Notifications", "Search Engine", "CLI Commands".

### What does NOT count

Don't include build tooling, CI/CD, linting, or dev dependencies as features UNLESS they are the project's primary purpose (e.g., a webpack plugin project should list its plugin capabilities).

### Depth

Include as many features as the project actually has. A microservice might have 3. A large monorepo might have 20. Do NOT cap arbitrarily — completeness matters.

Use `children` for features with clear sub-components (e.g., "Authentication" might have children "JWT Validation", "OAuth Providers", "Session Management"). Don't nest children deeper than one level.

## Output Schema

Write the output to `.side-bae/features.json`.

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
