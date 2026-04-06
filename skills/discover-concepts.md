# Side Bae: Discover Learnable Concepts

Analyze a codebase and identify the most interesting and teachable aspects — things a developer could deeply learn from by studying the implementation.

## How to use

```
/side-bae-concepts
```

## Instructions

This could be ANY type of codebase: a UI library, a game engine, a compiler, a CLI tool, a backend framework, a build system — anything. Look for what makes this codebase interesting and well-crafted.

Scan broadly first, then read the most interesting files deeply. Look for:

- **Architecture patterns** — How the system is structured and why (plugin systems, middleware chains, event-driven design)
- **Algorithm implementations** — Clever or elegant solutions (custom sort, tree traversal, caching strategy)
- **API design decisions** — How the public interface is shaped (fluent APIs, builder patterns, progressive disclosure)
- **State management approaches** — How data flows through the system (unidirectional, reactive, event sourcing)
- **Performance techniques** — Optimizations, caching, lazy loading, virtualization, memoization
- **Error handling strategies** — How failures are managed gracefully (circuit breakers, retry logic, fallback chains)
- **Testing patterns** — If tests demonstrate interesting techniques (snapshot testing, property-based testing, test factories)
- **Build/tooling patterns** — If the build system itself is notable (custom transforms, incremental compilation)
- **Any "wow, that's clever" moments** in the code

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
- Don't include generic things like "project structure" or "configuration" unless they demonstrate genuinely interesting patterns
- Each topic needs a semantically relevant VS Code codicon icon — pick the most descriptive one (e.g., 'mortar-board' for learning, 'beaker' for experimental, 'lightbulb' for insight, 'layers' for architecture, 'symbol-interface' for API design)
- `entryFile` must be a real file that exists — verify by reading it
- `concepts` should be specific named patterns (e.g., "Observer Pattern", "Intersection Observer API", "Memoization"), not vague descriptions
- `description` should focus on what the developer LEARNS, not what the code DOES — "How to efficiently render large lists with O(1) memory" is better than "Renders large lists"
