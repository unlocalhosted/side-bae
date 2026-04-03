# Side Bae: Discover Learnable Concepts

Analyze a codebase and identify the most interesting and teachable aspects — things a developer could deeply learn from by studying the implementation.

## How to use

```
/side-bae-concepts
```

## Instructions

This could be ANY type of codebase. Look for what makes it interesting and well-crafted:

- Architecture patterns (how the system is structured and why)
- Algorithm implementations (clever or elegant solutions)
- API design decisions (how the public interface is shaped)
- State management approaches (how data flows)
- Performance techniques (optimizations, caching, lazy loading)
- Error handling strategies (how failures are managed gracefully)
- Testing patterns (if tests demonstrate interesting techniques)
- Any "wow, that's clever" moments in the code

Focus on topics where the implementation itself is worth studying — where a developer would say "I want to learn how they did that."

## Output Schema

Write the output to `.side-bae/learnable-concepts.json`.

```json
[
  {
    "name": "string — short name (e.g., 'Virtual Scrolling Engine')",
    "description": "string — what a developer would learn (one line)",
    "depth": "foundational | intermediate | advanced",
    "concepts": ["string — named patterns/techniques involved"],
    "entryFile": "string — primary file to start exploring",
    "icon": "string — VS Code codicon name (e.g., 'mortar-board', 'beaker', 'lightbulb')"
  }
]
```

### Rules

- Return 4-10 topics, ordered from most foundational to most advanced
- Don't include generic things like "project structure" unless it demonstrates genuinely interesting patterns
- Each topic needs a semantically relevant VS Code codicon icon
