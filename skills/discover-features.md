# Side Bae: Discover Features

Analyze a codebase and identify its major features and capabilities. The output is a JSON file consumed by the Side Bae VS Code extension's sidebar.

## How to use

```
/side-bae-features
```

## Instructions

Look at:
- Directory structure and naming
- Entry points (main files, route definitions, command handlers)
- Exported modules and their purposes
- README, docs, and configuration files

Focus on high-level features that a new developer would want to understand. Group related functionality together.

## Output Schema

Write the output to `.side-bae/features.json`.

```json
[
  {
    "name": "string — feature name (e.g., 'Authentication')",
    "description": "string — one-line description",
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

- 3-8 top-level features depending on project size
- Each feature needs a semantically relevant VS Code codicon icon
- Don't include build tooling, CI/CD, or dev dependencies as features unless they are the project's primary purpose
- Children are optional — use them for features with clear sub-components
