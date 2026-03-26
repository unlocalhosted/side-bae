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
