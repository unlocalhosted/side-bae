# Side Bae: Explore This Codebase

Generate a System Atlas — a codebase map with architecture layers, boundary connections, flow traces, and suggested next tours or lessons. The output is a JSON file consumed by the Side Bae VS Code extension.

## How to use

```
/side-bae-atlas
```

## Instructions

You are generating a senior-engineer-level walkthrough of this codebase for someone who has never seen it before. Read the real code: entry points, command handlers, exported modules, storage/persistence modules, UI surfaces, configuration, and docs. Do not infer architecture from folder names alone.

If `.side-bae/features.json` already exists, read it as a starting point, but verify it against the code. Features may be stale, overlapping, or framed differently than the implementation.

Before writing JSON, do a private reconciliation pass:
- Every flow step must belong to a real layer
- Every connection must be supported by at least one verified call, data handoff, persisted artifact, command registration, route, event, or import boundary
- Every suggested tour or lesson must point at a concrete capability found in the flows or layers
- If a layer has no role in any connection or flow, either remove it or explain why it is still architecturally important

Do not output this reconciliation pass. Use it to prevent disconnected atlas sections.

## What to produce

### Project identity

- `projectName`: the actual project name from package metadata or equivalent
- `summary`: 2-3 sentences explaining what the project does and why it exists
- `techStack`: 3-6 key technologies, frameworks, languages, or platform APIs

### Architectural layers

Identify how this codebase is actually organized, not how it would look in a textbook architecture diagram. If a project is a monolith, say so. If a boundary is fuzzy, say so.

Each layer needs:

- `id`: kebab-case
- `name`: human-readable layer name
- `description`: 1-2 sentences about what the layer owns
- `keyFiles`: 2-5 real files a developer should read first
- `icon`: optional VS Code codicon name

Order layers from entry/user-facing surfaces toward persistence/infrastructure.

### Connections

For each pair of layers that interact, describe what crosses the boundary and why. Avoid generic labels like "uses" or "calls". Good labels explain the contract: "passes structured tour documents to render" or "loads cached atlas JSON for instant replay".

### Flow traces

Identify 3-6 important capabilities and trace each one end-to-end. Each flow should have:

- `id`: kebab-case
- `name`: the capability
- `trigger`: what starts it
- `steps`: 4-8 verified steps

Each step needs:

- `summary`: one-line collapsed view
- `explanation`: 2-3 sentences with concrete code references in `backticks`
- `file`, `startLine`, `endLine`: real file and accurate 1-based line range
- `layerId`: id of the layer this step belongs to

### Suggestions

Add 2-4 next steps the user should try after reading the atlas. Suggestions must be specific tours or lessons, not generic prompts.

## Output Schema

Write the output to `.side-bae/atlas.json`. That file is the only deliverable — write it to disk; do not paste the JSON into the chat.

```json
{
  "version": 1,
  "id": "atlas",
  "generatedAt": "string — ISO 8601 timestamp from `date -u +%Y-%m-%dT%H:%M:%SZ`",
  "projectName": "string",
  "summary": "string",
  "techStack": ["string"],
  "layers": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "keyFiles": ["string"],
      "icon": "string — VS Code codicon name (optional)"
    }
  ],
  "connections": [
    {
      "from": "layer-id",
      "to": "layer-id",
      "label": "string — what flows across the boundary"
    }
  ],
  "flows": [
    {
      "id": "string",
      "name": "string",
      "trigger": "string",
      "steps": [
        {
          "summary": "string",
          "explanation": "string",
          "file": "string",
          "startLine": 1,
          "endLine": 10,
          "layerId": "layer-id"
        }
      ]
    }
  ],
  "suggestions": [
    {
      "type": "tour | lesson",
      "label": "string",
      "query": "string"
    }
  ]
}
```

## Rules

- Every `keyFiles` entry and flow step file must exist.
- Every flow step line range must be accurate. Verify by reading the file with line numbers before writing the JSON.
- Flow steps must trace real code paths, not hypothetical architecture.
- Connections must reference existing layer ids.
- Suggestions must use `type: "tour"` or `type: "lesson"`.
- Use `date -u +%Y-%m-%dT%H:%M:%SZ` for `generatedAt`; do not invent the timestamp.
- Exclude `node_modules`, `dist`, and build artifacts.
- If you cannot fully trace a flow, either choose a different flow or state the uncertainty honestly inside the explanation.

## Quality checklist

1. Do the layers reflect the actual code organization?
2. Does every connection explain a real boundary contract?
3. Does each flow follow executable code from trigger to outcome?
4. Are all files and line numbers verified?
5. Would a new developer know what to read next after this atlas?
