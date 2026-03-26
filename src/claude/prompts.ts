export function buildTourGenerationPrompt(query: string): string {
  return `You are analyzing a codebase to create a guided code tour. The workspace root is the current directory.

The user wants to understand: "${query}"

Scan the relevant source files, trace the code paths involved, and produce a tour as a JSON object following the provided schema.

Rules:
- Each node must reference a real file that exists in the workspace (use relative paths from the workspace root)
- Line numbers must be accurate and 1-based
- The entryNode must be the most logical starting point for understanding this feature
- Edges should represent actual code flow (function calls, imports, data flow)
- Edge labels should describe the relationship clearly — they appear as navigation buttons (e.g., "calls validateToken()", "imports UserModel", "handles the error case")
- Explanations should be concise but illuminating — explain WHY this code exists, not just WHAT it does
- Each explanation should reference how it connects to the previous step — the user arrives via an edge label, so the explanation should continue that narrative (e.g., "This function is called by the auth middleware to verify the JWT signature...")
- Use 4-10 nodes for a typical tour (fewer for simple features, more for complex ones)
- Node IDs should be kebab-case descriptive names
- The id field should be a kebab-case slug derived from the query
- For trackedFiles, run "git log -1 --format=%h -- <file>" for each referenced file to get the short commit hash
- Set generatedAt to the current ISO 8601 timestamp
- Do not include node_modules, dist, or build artifacts in the tour`;
}

export function buildFeatureDiscoveryPrompt(): string {
  return `Analyze this codebase and identify the major features and capabilities. Look at:
- Directory structure and naming
- Entry points (main files, route definitions, command handlers)
- Exported modules and their purposes
- README, docs, and configuration files

Return a JSON object with a "features" array. Each feature should have:
- name: Short feature name (e.g., "Authentication", "Payment Processing")
- description: One-line description of what this feature does
- path: The primary file or directory for this feature (optional)
- children: Sub-features if applicable (optional, same structure but without nested children)

Focus on high-level features that a new developer would want to understand. Group related functionality together.
Aim for 3-8 top-level features depending on the project size.
Do not include build tooling, CI/CD, or dev dependencies as features unless they are the primary purpose of the project.`;
}
