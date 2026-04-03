# Side Bae: What's New

Analyze recent changes in a git repository and group them into logical changes. The output is a JSON file consumed by the Side Bae VS Code extension.

## How to use

```
/side-bae-whats-new [time range]
```

Examples:
- `/side-bae-whats-new this week`
- `/side-bae-whats-new last 10 commits`
- `/side-bae-whats-new since Monday`

## Instructions

1. Interpret the time range naturally. Examples: "this week" -> `--since=1.week.ago`, "last 5 commits" -> `-5`
2. Run `git log` with appropriate flags. Include author and changed files.
3. Group commits by author first — one author's commits in a time window almost always form a coherent feature or fix.
4. Within each author's commits, identify logical changes (a feature, bugfix, refactor, or chore). Merge commits that are clearly part of the same work.
5. If multiple authors touched the same files for the same work, merge into a single change.

## Output Schema

Write the output to `.side-bae/whats-new.json`.

```json
[
  {
    "name": "string — short descriptive name (e.g., 'Redesigned tour card UI')",
    "summary": "string — one-line description",
    "author": "string — primary author's name",
    "date": "string — relative date (e.g., '3 days ago')",
    "commits": ["string — short commit SHAs"],
    "files": ["string — relative file paths, deduplicated"]
  }
]
```

### Rules

- Aim for 3-10 logical changes
- If more than 15 commits, group aggressively by author + topic
- If fewer than 3 commits, each commit can be its own change
- Order most recent first
- Don't include merge commits or automated commits (dependabot, CI bots)
