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
          layer: {
            type: "string",
            enum: ["outcome", "architecture", "rationale", "insight", "challenge"],
            description: "Lesson layer — used in lesson replay tours.",
          },
          concepts: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "category"],
              properties: {
                name: { type: "string", description: "Pattern or concept name" },
                category: { type: "string", description: "Category like 'React Pattern', 'CSS Technique', 'Performance'" },
              },
            },
            description: "Named patterns/concepts taught in this node.",
          },
          takeaway: {
            type: "string",
            description: "One key sentence the learner should remember from this node.",
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
    lesson: {
      type: "object",
      properties: {
        subject: { type: "string", description: "What this lesson teaches" },
        depth: { type: "string", enum: ["foundational", "intermediate", "advanced"] },
        concepts: { type: "array", items: { type: "string" }, description: "Named concepts/patterns covered" },
        synopsis: { type: "string", description: "One-paragraph summary of what the learner will gain" },
      },
      required: ["subject", "depth", "concepts", "synopsis"],
      description: "Lesson metadata — present when this tour is a saved lesson replay.",
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

export const LESSON_STEP_SCHEMA = {
  type: "object",
  required: ["phase", "content", "awaitsResponse", "skippable", "isComplete"],
  properties: {
    phase: {
      type: "string",
      enum: ["prime", "teach", "check", "respond", "transition", "recap"],
      description: "The pedagogical phase of this step.",
    },
    file: {
      type: "string",
      description: "Relative file path to highlight in the editor.",
    },
    startLine: { type: "number", description: "1-based start line." },
    endLine: { type: "number", description: "1-based end line." },
    title: { type: "string", description: "Step title." },
    content: {
      type: "string",
      description:
        "Markdown content — the AI's teaching, response, or explanation. This is the main body of the step.",
    },
    prompt: {
      type: "string",
      description: "Question or prompt for the learner when awaiting a response.",
    },
    inputType: {
      type: "string",
      enum: ["text", "choice", "none"],
      description:
        "How the learner should respond: text area, multiple choice, or no input needed.",
    },
    options: {
      type: "array",
      items: { type: "string" },
      description: "Choice options when inputType is 'choice'.",
    },
    correctIndex: {
      type: "number",
      description:
        "Index of the correct option (0-based). Only set for check phases with choice input.",
    },
    concepts: {
      type: "array",
      items: { type: "string" },
      description: "Concepts being taught or checked in this step.",
    },
    layer: {
      type: "string",
      enum: ["outcome", "architecture", "rationale", "insight", "challenge"],
      description: "Which pedagogical layer this step belongs to.",
    },
    awaitsResponse: {
      type: "boolean",
      description: "True if the webview should wait for learner input before continuing.",
    },
    skippable: {
      type: "boolean",
      description: "True if the learner can skip this interaction.",
    },
    isComplete: {
      type: "boolean",
      description: "True if this is the final step (recap). Signals end of lesson.",
    },
    recapData: {
      type: "object",
      properties: {
        conceptsSolid: {
          type: "array",
          items: { type: "string" },
          description: "Concepts the learner demonstrated strong understanding of.",
        },
        conceptsShaky: {
          type: "array",
          items: {
            type: "object",
            required: ["name", "suggestion"],
            properties: {
              name: { type: "string" },
              suggestion: { type: "string", description: "What to revisit or review." },
            },
          },
        },
        predictionsVsReality: {
          type: "array",
          items: {
            type: "object",
            required: ["prediction", "reality"],
            properties: {
              prediction: { type: "string", description: "What the learner predicted." },
              reality: { type: "string", description: "What was actually happening." },
            },
          },
        },
        totalSteps: { type: "number" },
        checksCorrect: { type: "number" },
        checksTotal: { type: "number" },
      },
      description: "Recap data — only present on the final recap step.",
    },
  },
} as const;

export const LEARNABLE_CONCEPTS_SCHEMA = {
  type: "object",
  required: ["concepts"],
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "description", "depth", "concepts", "entryFile"],
        properties: {
          name: {
            type: "string",
            description: "Short name for this learnable topic (e.g., 'Virtual Scrolling Engine', 'Plugin Architecture').",
          },
          description: {
            type: "string",
            description: "One-line description of what a developer would learn from studying this.",
          },
          depth: {
            type: "string",
            enum: ["foundational", "intermediate", "advanced"],
            description: "How much prior knowledge is needed.",
          },
          concepts: {
            type: "array",
            items: { type: "string" },
            description: "Named patterns or techniques involved (e.g., 'Observer Pattern', 'Intersection Observer API').",
          },
          entryFile: {
            type: "string",
            description: "Primary file to start exploring this topic.",
          },
          icon: {
            type: "string",
            description: "VS Code codicon name (e.g., 'mortar-board', 'beaker', 'lightbulb').",
          },
        },
      },
    },
  },
} as const;

export const INVESTIGATION_STEP_SCHEMA = {
  type: "object",
  required: ["phase", "content", "awaitsResponse", "isComplete"],
  properties: {
    phase: {
      type: "string",
      enum: ["orient", "investigate", "diagnose", "propose", "verify", "revise", "ship", "recap"],
      description: "The investigation phase of this step.",
    },
    file: { type: "string", description: "Relative file path being investigated." },
    startLine: { type: "number", description: "1-based start line." },
    endLine: { type: "number", description: "1-based end line." },
    title: { type: "string", description: "Step title." },
    content: {
      type: "string",
      description: "Markdown content — the investigator's findings, explanation, or response to user feedback.",
    },
    prompt: { type: "string", description: "Question for the user when awaiting input." },
    inputType: {
      type: "string",
      enum: ["text", "confirm", "none"],
      description: "How the user should respond: text feedback, simple confirmation, or no input needed.",
    },
    suggestedEdit: {
      type: "object",
      required: ["oldText", "newText", "file"],
      properties: {
        oldText: { type: "string", description: "Current code to replace (exact match)." },
        newText: { type: "string", description: "Proposed replacement code." },
        file: { type: "string", description: "File containing the code to replace." },
      },
      description: "Code fix proposal. Only for propose/revise phases.",
    },
    testResults: {
      type: "object",
      properties: {
        passed: { type: "number" },
        failed: { type: "number" },
        errors: { type: "array", items: { type: "string" }, description: "First few lines of failure output." },
      },
      description: "Test execution results. Only for verify phase.",
    },
    prUrl: { type: "string", description: "URL of the created pull request." },
    prNumber: { type: "number", description: "PR number." },
    branchName: { type: "string", description: "Branch name used for the PR." },
    filesChanged: { type: "number" },
    additions: { type: "number" },
    deletions: { type: "number" },
    awaitsResponse: {
      type: "boolean",
      description: "True if the user should respond before continuing.",
    },
    isComplete: {
      type: "boolean",
      description: "True only on the final recap step.",
    },
    trail: {
      type: "array",
      items: {
        type: "object",
        required: ["file", "kind"],
        properties: {
          file: { type: "string" },
          kind: { type: "string", enum: ["context", "problem", "fix"] },
        },
      },
      description: "Files investigated so far, for the breadcrumb trail.",
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
