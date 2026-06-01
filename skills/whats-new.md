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
2. Run `git log` with appropriate flags. Include short SHA, absolute date, author, subject, and changed files. Use `git log --date=short --format="%h %ad %an %s" --name-only <range-flags>` as the default shape.
3. Group commits by author first — one author's commits in a time window almost always form a coherent feature or fix.
4. Within each author's commits, identify logical changes (a feature, bugfix, refactor, or chore). Merge commits that are clearly part of the same work.
5. If multiple authors touched the same files for the same work, merge into a single change.

Before writing JSON, do a private grouping pass:
- Drop merge commits and bot-only noise unless they are the only activity
- Merge commits that are part of the same user-visible change even if filenames differ
- Split same-author commits when they clearly represent unrelated work
- Make sure every non-noise commit in the selected range is represented by exactly one change

Do not output this grouping pass. Use it to avoid missing or double-counting work.

## Output Schema

Write the output to `.side-bae/whats-new.json`. That file is the only deliverable — write it to disk; don't paste the JSON into the chat.

```json
[
  {
    "name": "string — short descriptive name (e.g., 'Redesigned tour card UI')",
    "summary": "string — one-line description",
    "author": "string — primary author's name",
    "date": "string — the change's most recent commit date, absolute, as YYYY-MM-DD",
    "commits": ["string — short commit SHAs"],
    "files": ["string — relative file paths, deduplicated"]
  }
]
```

### Rules

- Aim for 3-10 logical changes — complete coverage, not just the biggest ones
- If more than 15 commits, group aggressively by author + topic
- If fewer than 3 commits, each commit can be its own change
- Order most recent first
- `date` must be an **absolute** date (`YYYY-MM-DD`) taken from the group's most recent commit — get it from `git log --date=short --format=%ad`. Never write a relative phrase like "3 days ago": it's baked in at generation time and goes stale. Side Bae renders it relative ("3 days ago") at display time.
- Don't include merge commits or automated commits (dependabot, CI bots) unless they are the only activity
- `summary` should explain what the change accomplishes for the user, not describe files touched
- `name` should be specific: "Redesigned tour card UI" not "UI changes"
