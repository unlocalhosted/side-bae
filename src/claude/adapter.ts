/**
 * Claude Agent SDK integration.
 *
 * Uses @anthropic-ai/claude-agent-sdk to run queries against the user's
 * Claude subscription. The SDK spawns a Claude Code subprocess internally.
 *
 * @see https://platform.claude.com/docs/en/agent-sdk/typescript
 * @see https://platform.claude.com/docs/en/agent-sdk/structured-outputs
 */

import * as vscode from "vscode";
import { validateTourDocument, type TourDocument } from "../types/tour.js";

/**
 * Get the Claude CLI path if explicitly configured by the user.
 * Returns undefined to let the SDK auto-detect (which is the default and preferred path).
 */
function getConfiguredClaudePath(): string | undefined {
  const configured = vscode.workspace
    .getConfiguration("sideBae")
    .get<string>("claudePath", "");
  return configured || undefined;
}
import type { FeatureTreeNode } from "../types/feature-tree.js";
import type { RecentChange } from "../types/recent-changes.js";
import type { LessonPlanStep, StepContent, StepResponse, LearnableConcept } from "../types/lesson.js";
import type { InvestigationStep } from "../types/investigation.js";
import { TOUR_DOCUMENT_SCHEMA, FEATURE_TREE_SCHEMA, RECENT_CHANGES_SCHEMA, LESSON_PLAN_SCHEMA, STEP_CONTENT_SCHEMA, STEP_RESPONSE_SCHEMA, LEARNABLE_CONCEPTS_SCHEMA, INVESTIGATION_STEP_SCHEMA } from "./schema.js";
import {
  buildTourGenerationPrompt,
  buildFeatureDiscoveryPrompt,
  buildWhatsNewPrompt,
  buildLearnableConceptsPrompt,
} from "./prompts.js";

export interface ClaudeAdapterOptions {
  workspaceRoot: string;
  model?: string;
  maxBudgetUsd?: number;
}

export interface GenerationProgress {
  onProgress: (message: string) => void;
  onCancel: (callback: () => void) => void;
}

export interface ClaudeStatus {
  available: boolean;
  authenticated: boolean;
  error?: string;
}

export interface QueryOptions {
  tools?: string[];
  maxTurns?: number;
  effort?: "low" | "medium" | "high";
  resumeSessionId?: string;
  persistSession?: boolean;
}

export interface QueryResult<T> {
  data: T;
  sessionId?: string;
}

/** Human-friendly labels for SDK tool names */
const TOOL_LABELS: Record<string, string> = {
  Read: "Reading",
  Grep: "Searching",
  Glob: "Scanning",
  Bash: "Running",
};

/** Extract a short, readable filename from a path */
function shortPath(path: string): string {
  if (!path) return "";
  // Show last 2 segments: "src/engine/tour-store.ts"
  const parts = path.replace(/\\/g, "/").split("/");
  return parts.length > 2 ? parts.slice(-2).join("/") : path;
}

// ── Claude status cache ──
// Caches a successful check so we don't spawn a subprocess on every command.
// Also deduplicates concurrent checks (join the in-flight promise).
let cachedStatus: ClaudeStatus | null = null;
let pendingCheck: Promise<ClaudeStatus> | null = null;

export async function checkClaudeStatus(
  workspaceRoot: string
): Promise<ClaudeStatus> {
  // Return cached success immediately
  if (cachedStatus?.available && cachedStatus?.authenticated) {
    return cachedStatus;
  }
  // Join in-flight check instead of spawning a duplicate
  if (pendingCheck) {
    return pendingCheck;
  }
  pendingCheck = checkClaudeStatusUncached(workspaceRoot);
  try {
    const status = await pendingCheck;
    if (status.available && status.authenticated) {
      cachedStatus = status;
    }
    return status;
  } finally {
    pendingCheck = null;
  }
}

/**
 * Check if the Claude Agent SDK can connect and authenticate.
 * Uses the SDK itself (not execFile) so it tests the exact same code path.
 */
async function checkClaudeStatusUncached(
  workspaceRoot: string
): Promise<ClaudeStatus> {
  try {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const claudePath = getConfiguredClaudePath();

    const q = query({
      prompt: "respond with the single word: ok",
      options: {
        cwd: workspaceRoot,
        maxTurns: 1,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        persistSession: false,
        pathToClaudeCodeExecutable: claudePath,
        settingSources: ["user", "project"],
        disallowedTools: [
          "Read",
          "Edit",
          "Write",
          "Bash",
          "Grep",
          "Glob",
          "Agent",
        ],
      },
    });

    for await (const message of q) {
      if (message.type === "result") {
        const isError = "is_error" in message && message.is_error === true;
        if (message.subtype === "success" && !isError) {
          return { available: true, authenticated: true };
        }
        return {
          available: true,
          authenticated: false,
          error: "result" in message ? String(message.result) : message.subtype,
        };
      }
    }

    return { available: true, authenticated: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Don't guess the cause — pass the raw error so the user sees what actually failed
    return { available: false, authenticated: false, error: msg };
  }
}

// ── Shared system prompt (~150 tokens, cached by SDK) ──
const SHARED_SYSTEM_PROMPT = `You are Side Bae, an AI assistant in a VS Code extension that teaches developers about codebases through guided tours, interactive lessons, and bug investigations.

Voice: sound like a sharp friend explaining their favorite codebase over coffee — not documentation.
- Reference code with \`backticks\`, bold **key concepts** on first mention
- Explain WHY, not just WHAT. Have opinions: "this is clever because..."
- Concrete before abstract: show code, explain behavior, then name the pattern
- Never announce actions ("I'm going to..."): just do it
- Do not include node_modules, dist, or build artifacts in file references`;

export class ClaudeAdapter {
  private workspaceRoot: string;
  private model: string;
  private maxBudgetUsd: number;
  private codebaseContextPromise: Promise<import("./codebase-context.js").CodebaseContext> | null = null;

  constructor(options: ClaudeAdapterOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.model = options.model ?? "haiku";
    this.maxBudgetUsd = options.maxBudgetUsd ?? 0.5;
  }

  /** Get the formatted codebase structure for prompt injection. */
  async getFormattedContext(): Promise<string> {
    if (!this.codebaseContextPromise) {
      const { buildCodebaseContext } = await import("./codebase-context.js");
      this.codebaseContextPromise = buildCodebaseContext(this.workspaceRoot);
    }
    const ctx = await this.codebaseContextPromise;
    const { formatContextForPrompt } = await import("./codebase-context.js");
    return formatContextForPrompt(ctx);
  }

  async generateTour(
    queryText: string,
    progress: GenerationProgress
  ): Promise<TourDocument> {
    const structure = await this.getFormattedContext();
    const prompt = buildTourGenerationPrompt(queryText, structure);
    const result = await this.runStructuredQuery(prompt, TOUR_DOCUMENT_SCHEMA, progress, {
      tools: ["Read", "Grep", "Glob"],
      maxTurns: 15,
      effort: "medium",
    });
    return validateTourDocument(result);
  }

  async analyzeRecentChanges(
    range: string,
    progress: GenerationProgress
  ): Promise<RecentChange[]> {
    const prompt = buildWhatsNewPrompt(range);
    const result = await this.runStructuredQuery(prompt, RECENT_CHANGES_SCHEMA, progress, {
      tools: ["Read", "Grep", "Glob", "Bash"],
      maxTurns: 10,
      effort: "low",
    });
    return (result as { changes: RecentChange[] }).changes;
  }

  async generateInvestigationStep(
    prompt: string,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<InvestigationStep> {
    const result = await this.runStructuredQuery(prompt, INVESTIGATION_STEP_SCHEMA, progress, {
      tools: ["Read", "Grep", "Glob", "Bash"],
      maxTurns: 20,
      effort: "high",
      ...options,
    });
    return result as InvestigationStep;
  }

  async generateLessonPlan(
    prompt: string,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<{ steps: LessonPlanStep[] }> {
    const result = await this.runStructuredQuery(prompt, LESSON_PLAN_SCHEMA, progress, {
      tools: ["Read", "Grep", "Glob"],
      maxTurns: 20,
      effort: "medium",
      ...options,
    });
    return result as { steps: LessonPlanStep[] };
  }

  async generateStepContent(
    prompt: string,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<StepContent> {
    const result = await this.runStructuredQuery(prompt, STEP_CONTENT_SCHEMA, progress, {
      tools: ["Read"],
      maxTurns: 3,
      effort: "medium",
      ...options,
    });
    return result as StepContent;
  }

  async generateStepResponse(
    prompt: string,
    progress: GenerationProgress
  ): Promise<StepResponse> {
    const result = await this.runStructuredQuery(prompt, STEP_RESPONSE_SCHEMA, progress, {
      tools: [],
      maxTurns: 2,
      effort: "low",
    });
    return result as StepResponse;
  }

  async discoverLearnableConcepts(
    progress: GenerationProgress
  ): Promise<LearnableConcept[]> {
    const structure = await this.getFormattedContext();
    const prompt = buildLearnableConceptsPrompt(structure);
    const result = await this.runStructuredQuery(prompt, LEARNABLE_CONCEPTS_SCHEMA, progress, {
      tools: ["Read", "Grep", "Glob"],
      maxTurns: 15,
      effort: "low",
    });
    return (result as { concepts: LearnableConcept[] }).concepts;
  }

  async discoverFeatures(
    progress: GenerationProgress
  ): Promise<FeatureTreeNode[]> {
    const structure = await this.getFormattedContext();
    const prompt = buildFeatureDiscoveryPrompt(structure);
    const result = await this.runStructuredQuery(prompt, FEATURE_TREE_SCHEMA, progress, {
      tools: ["Read", "Grep", "Glob"],
      maxTurns: 12,
      effort: "low",
    });
    return (result as { features: FeatureTreeNode[] }).features;
  }

  private async runStructuredQuery(
    prompt: string,
    schema: Record<string, unknown>,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<unknown> {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const claudePath = getConfiguredClaudePath();

    const abortController = new AbortController();
    progress.onCancel(() => abortController.abort());

    const tools = options?.tools ?? ["Read", "Grep", "Glob", "Bash"];

    try {
      const q = query({
        prompt,
        options: {
          cwd: this.workspaceRoot,
          model: this.model,
          pathToClaudeCodeExecutable: claudePath,
          systemPrompt: SHARED_SYSTEM_PROMPT,
          maxTurns: options?.maxTurns ?? 30,
          effort: options?.effort ?? "medium",
          maxBudgetUsd: this.maxBudgetUsd,
          abortController,
          tools: tools.length > 0 ? tools : [],
          allowedTools: tools.length > 0 ? tools : undefined,
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          outputFormat: { type: "json_schema", schema },
          persistSession: options?.persistSession ?? false,
          resume: options?.resumeSessionId,
          settingSources: ["user", "project"],
        },
      });

      for await (const message of q) {
        // Surface real tool activity from the SDK as progress
        if (message.type === "assistant" && "message" in message) {
          const assistantMsg = message.message as { content?: Array<{ type: string; name?: string; input?: { file_path?: string; pattern?: string; command?: string } }> };
          if (assistantMsg.content) {
            for (const block of assistantMsg.content) {
              if (block.type === "tool_use" && block.name) {
                const verb = TOOL_LABELS[block.name] ?? block.name;
                const target = block.input?.file_path || block.input?.pattern || block.input?.command || "";
                const display = shortPath(target);
                const label = display ? `${verb} ${display}` : `${verb}...`;
                progress.onProgress(label);
              }
            }
          }
        }
        if (message.type !== "result") continue;

        switch (message.subtype) {
          case "success":
            if ("structured_output" in message && message.structured_output) {
              return message.structured_output;
            }
            if ("result" in message && typeof message.result === "string") {
              return JSON.parse(message.result);
            }
            throw new Error("Completed but returned no output. Try again.");

          case "error_max_turns":
            throw new Error(
              "This was too complex to finish. Try asking about something more specific."
            );

          case "error_max_budget_usd":
            throw new Error(
              `This request exceeded the $${this.maxBudgetUsd} cost limit. You can increase it in Settings → Side Bae → Max Budget.`
            );

          case "error_max_structured_output_retries":
            throw new Error(
              "Couldn't generate a valid result. Try rephrasing your question."
            );

          default:
            throw new Error(
              `Something went wrong: ${message.subtype}${
                "result" in message ? ` — ${message.result}` : ""
              }`
            );
        }
      }

      throw new Error("No result was returned. Try again.");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Query cancelled.", { cause: err });
      }
      throw err;
    }
  }
}
