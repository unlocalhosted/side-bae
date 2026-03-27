export const TOUR_DOCUMENT_SCHEMA = {
  type: "object",
  required: [
    "version",
    "id",
    "name",
    "query",
    "generatedAt",
    "trackedFiles",
    "entryNode",
    "nodes",
  ],
  properties: {
    version: { type: "number", const: 1 },
    id: {
      type: "string",
      description: "Kebab-case unique identifier for the tour",
    },
    name: { type: "string", description: "Human-readable tour name" },
    query: {
      type: "string",
      description: "The original question or feature name",
    },
    generatedAt: {
      type: "string",
      description: "ISO 8601 timestamp of generation",
    },
    trackedFiles: {
      type: "array",
      items: {
        type: "object",
        required: ["path", "lastCommit"],
        properties: {
          path: {
            type: "string",
            description: "Relative file path from workspace root",
          },
          lastCommit: {
            type: "string",
            description: "Short git commit hash at generation time",
          },
        },
      },
    },
    entryNode: {
      type: "string",
      description: "ID of the first node in the tour",
    },
    nodes: {
      type: "object",
      description: "Map of node ID to node definition",
      additionalProperties: {
        type: "object",
        required: [
          "file",
          "startLine",
          "endLine",
          "title",
          "explanation",
          "edges",
        ],
        properties: {
          file: {
            type: "string",
            description: "Relative file path from workspace root",
          },
          startLine: {
            type: "number",
            description: "1-based start line of annotated region",
          },
          endLine: {
            type: "number",
            description: "1-based end line of annotated region",
          },
          title: {
            type: "string",
            description: "Short title for the node",
          },
          explanation: {
            type: "string",
            description:
              "Explanation of what this code does and why. Focus on WHY, not just WHAT.",
          },
          edges: {
            type: "array",
            items: {
              type: "object",
              required: ["target", "label"],
              properties: {
                target: {
                  type: "string",
                  description: "ID of the target node",
                },
                label: {
                  type: "string",
                  description:
                    "Human-readable label describing the relationship",
                },
              },
            },
          },
          kind: {
            type: "string",
            enum: ["context", "problem", "solution"],
            description:
              "Node role in investigation tours. Only used for investigate-issue tours.",
          },
          suggestedEdit: {
            type: "object",
            required: ["oldText", "newText"],
            properties: {
              oldText: {
                type: "string",
                description: "Current code to replace",
              },
              newText: {
                type: "string",
                description: "Suggested replacement code",
              },
            },
            description:
              "Code fix suggestion for solution nodes. Only used for investigate-issue tours.",
          },
        },
      },
    },
    report: {
      type: "string",
      description:
        "Markdown investigation report in PR-ready format. Only for investigation tours.",
    },
  },
} as const;

export const RECENT_CHANGES_SCHEMA = {
  type: "object",
  required: ["changes"],
  properties: {
    changes: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "summary", "author", "date", "commits", "files"],
        properties: {
          name: {
            type: "string",
            description: "Short name for this logical change",
          },
          summary: {
            type: "string",
            description: "One-line description of what this change does",
          },
          author: {
            type: "string",
            description: "Primary author of this change",
          },
          date: {
            type: "string",
            description: "Relative date of the most recent commit (e.g., '3 days ago')",
          },
          commits: {
            type: "array",
            items: { type: "string" },
            description: "Short commit SHAs included in this change",
          },
          files: {
            type: "array",
            items: { type: "string" },
            description: "Files touched by this change (relative paths)",
          },
        },
      },
    },
  },
} as const;

export const FEATURE_TREE_SCHEMA = {
  type: "object",
  required: ["features"],
  properties: {
    features: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "description"],
        properties: {
          name: { type: "string", description: "Feature name" },
          description: {
            type: "string",
            description: "One-line description of the feature",
          },
          icon: {
            type: "string",
            description:
              "VS Code codicon name for this feature (e.g., 'shield', 'database', 'globe', 'gear', 'beaker', 'rocket'). Pick the most semantically relevant icon.",
          },
          children: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "description"],
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                path: {
                  type: "string",
                  description: "Primary file/directory for this sub-feature",
                },
                icon: {
                  type: "string",
                  description: "VS Code codicon name for this sub-feature",
                },
              },
            },
          },
          path: {
            type: "string",
            description: "Primary file or directory for this feature",
          },
        },
      },
    },
  },
} as const;
