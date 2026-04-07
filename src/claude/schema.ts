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
    annotations: {
      type: "object",
      description: "User-generated Q&A annotations keyed by node ID. Each value is an array of question/answer pairs.",
      additionalProperties: {
        type: "array",
        items: {
          type: "object",
          required: ["selectedText", "question", "answer"],
          properties: {
            selectedText: { type: "string", description: "The text the user selected before asking" },
            question: { type: "string", description: "The user's question" },
            answer: { type: "string", description: "The AI-generated answer scoped to this explanation and code" },
          },
        },
      },
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

export const LESSON_PLAN_SCHEMA = {
  type: "object",
  required: ["steps"],
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "title", "file", "startLine", "endLine", "concepts"],
        properties: {
          id: { type: "string", description: "Step ID like 'step-1', 'step-2'." },
          title: { type: "string", description: "Short title for this lesson step." },
          file: { type: "string", description: "Relative file path to study." },
          startLine: { type: "number", description: "1-based start line." },
          endLine: { type: "number", description: "1-based end line." },
          concepts: { type: "array", items: { type: "string" }, description: "Concepts taught in this step." },
          layer: { type: "string", enum: ["outcome", "architecture", "rationale", "insight", "challenge"] },
        },
      },
      description: "Ordered list of lesson steps, foundational to advanced.",
    },
  },
} as const;

export const STEP_CONTENT_SCHEMA = {
  type: "object",
  required: ["explanation"],
  properties: {
    explanation: {
      type: "string",
      description: "Teaching content in markdown. Reference specific code with backticks, bold key concepts.",
    },
    prompt: { type: "string", description: "Question for the learner." },
    inputType: {
      type: "string",
      enum: ["text", "choice", "none"],
      description: "How the learner responds.",
    },
    options: { type: "array", items: { type: "string" }, description: "Choice options." },
    correctIndex: { type: "number", description: "0-based index of correct option." },
    correctExplanation: { type: "string", description: "Shown when learner picks the correct choice." },
    incorrectExplanation: { type: "string", description: "Shown when learner picks a wrong choice." },
    skipReason: {
      type: "string",
      description: "If the learner already demonstrated understanding of this step's concepts, set this instead of explanation. The step will be skipped.",
    },
  },
} as const;

export const STEP_RESPONSE_SCHEMA = {
  type: "object",
  required: ["content", "summary"],
  properties: {
    content: {
      type: "string",
      description: "Brief response (2-3 sentences) to the learner's text answer. Reference their words.",
    },
    correct: { type: "boolean", description: "Whether the learner's understanding is correct." },
    summary: {
      type: "string",
      description: "One-line summary of what was learned in this step (for collapsed view).",
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

/** Exported for skill files — external AI tools reference this schema to generate .full-lesson.json files. */
export const FULL_LESSON_SCHEMA = {
  type: "object",
  required: ["version", "id", "subject", "generatedAt", "depth", "concepts", "synopsis", "steps"],
  properties: {
    version: { type: "number", const: 1 },
    id: { type: "string", description: "Kebab-case unique identifier for the lesson" },
    subject: { type: "string", description: "What this lesson teaches" },
    generatedAt: { type: "string", description: "ISO 8601 timestamp" },
    depth: { type: "string", enum: ["foundational", "intermediate", "advanced"] },
    concepts: { type: "array", items: { type: "string" }, description: "Named concepts/patterns covered" },
    synopsis: { type: "string", description: "One-paragraph summary of what the learner will gain" },
    steps: {
      type: "array",
      items: {
        type: "object",
        required: ["plan", "content"],
        properties: {
          plan: {
            type: "object",
            required: ["id", "title", "file", "startLine", "endLine", "concepts"],
            properties: {
              id: { type: "string", description: "Step ID like 'step-1', 'step-2'." },
              title: { type: "string", description: "Short title for this lesson step." },
              file: { type: "string", description: "Relative file path to study." },
              startLine: { type: "number", description: "1-based start line." },
              endLine: { type: "number", description: "1-based end line." },
              concepts: { type: "array", items: { type: "string" }, description: "Concepts taught in this step." },
              layer: { type: "string", enum: ["outcome", "architecture", "rationale", "insight", "challenge"] },
            },
          },
          content: {
            type: "object",
            required: ["explanation"],
            properties: {
              explanation: {
                type: "string",
                description: "Teaching content in markdown. Reference specific code with backticks, bold key concepts.",
              },
              prompt: { type: "string", description: "Question for the learner." },
              inputType: {
                type: "string",
                enum: ["text", "choice", "none"],
                description: "How the learner responds.",
              },
              options: { type: "array", items: { type: "string" }, description: "Choice options." },
              correctIndex: { type: "number", description: "0-based index of correct option." },
              correctExplanation: { type: "string", description: "Shown when learner picks the correct choice." },
              incorrectExplanation: { type: "string", description: "Shown when learner picks a wrong choice." },
              modelAnswer: {
                type: "string",
                description: "Model answer for text questions — shown after user submits for self-assessment.",
              },
            },
          },
        },
      },
      description: "Ordered list of lesson steps with pre-generated content and quiz questions.",
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
