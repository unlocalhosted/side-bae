/**
 * Claude Code provider — wraps @anthropic-ai/claude-agent-sdk.
 *
 * The SDK spawns a Claude Code subprocess internally. Each query gets
 * a structured JSON response validated against a JSON schema.
 *
 * @see https://platform.claude.com/docs/en/agent-sdk/typescript
 * @see https://platform.claude.com/docs/en/agent-sdk/structured-outputs
 */

import * as vscode from "vscode";
import type { AIProvider, AIProviderCapabilities, AIProviderStatus } from "./provider.js";
import type { GenerationProgress, QueryOptions } from "./types.js";
import { validateTourDocument, type TourDocument } from "../types/tour.js";
import type { FeatureTreeNode } from "../types/feature-tree.js";
import type { RecentChange } from "../types/recent-changes.js";
import type { LessonPlanStep, StepContent, StepResponse, LearnableConcept } from "../types/lesson.js";
import type { InvestigationStep } from "../types/investigation.js";
import { TOUR_DOCUMENT_SCHEMA, FEATURE_TREE_SCHEMA, RECENT_CHANGES_SCHEMA, LESSON_PLAN_SCHEMA, STEP_CONTENT_SCHEMA, STEP_RESPONSE_SCHEMA, LEARNABLE_CONCEPTS_SCHEMA, INVESTIGATION_STEP_SCHEMA } from "../claude/schema.js";
import {
  buildTourGenerationPrompt,
  buildFeatureDiscoveryPrompt,
  buildWhatsNewPrompt,
  buildLearnableConceptsPrompt,
} from "../claude/prompts.js";

export interface ClaudeCodeProviderOptions {
  workspaceRoot: string;
  model?: string;
  maxBudgetUsd?: number;
}

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

/** Internal result from runStructuredQuery, includes session ID for resumption. */
interface StructuredQueryResult {
  data: unknown;
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
  const parts = path.replace(/\\/g, "/").split("/");
  return parts.length > 2 ? parts.slice(-2).join("/") : path;
}

// ── Claude status cache ──
let cachedStatus: AIProviderStatus | null = null;
let pendingCheck: Promise<AIProviderStatus> | null = null;

const SHARED_SYSTEM_PROMPT = `You are Side Bae, an AI assistant in a VS Code extension that teaches developers about codebases through guided tours, interactive lessons, and bug investigations.

Voice: sound like a sharp friend explaining their favorite codebase over coffee — not documentation.
- Reference code with \`backticks\`, bold **key concepts** on first mention
- Explain WHY, not just WHAT. Have opinions: "this is clever because..."
- Concrete before abstract: show code, explain behavior, then name the pattern
- Never announce actions ("I'm going to..."): just do it
- Do not include node_modules, dist, or build artifacts in file references`;

export class ClaudeCodeProvider implements AIProvider {
  readonly id = "claude-code";
  readonly displayName = "Claude Code";
  readonly capabilities: AIProviderCapabilities = {
    investigation: true,
    lessons: true,
    tours: true,
    featureDiscovery: true,
    recentChanges: true,
    learnableConcepts: true,
  };

  private workspaceRoot: string;
  private model: string;
  private maxBudgetUsd: number;
  private codebaseContextPromise: Promise<string> | null = null;

  constructor(options: ClaudeCodeProviderOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.model = options.model ?? "haiku";
    this.maxBudgetUsd = options.maxBudgetUsd ?? 1.0;
  }

  async checkStatus(): Promise<AIProviderStatus> {
    // Return cached success immediately
    if (cachedStatus?.available && cachedStatus?.authenticated) {
      return cachedStatus;
    }
    // Join in-flight check instead of spawning a duplicate
    if (pendingCheck) {
      return pendingCheck;
    }
    pendingCheck = this.checkStatusUncached();
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

  /** Get the formatted codebase structure for prompt injection. Cached after first call. */
  async getFormattedContext(): Promise<string> {
    if (!this.codebaseContextPromise) {
      this.codebaseContextPromise = import("../claude/codebase-context.js").then(
        (mod) => mod.buildCodebaseContext(this.workspaceRoot).then(mod.formatContextForPrompt)
      );
    }
    return this.codebaseContextPromise;
  }

  async generateTour(
    queryText: string,
    progress: GenerationProgress
  ): Promise<TourDocument> {
    const structure = await this.getFormattedContext();
    const prompt = buildTourGenerationPrompt(queryText, structure);
    const { data } = await this.runStructuredQuery(prompt, TOUR_DOCUMENT_SCHEMA, progress, {
      tools: ["Read", "Grep", "Glob", "Bash"],
      maxTurns: 40,
      effort: "high",
    });
    return validateTourDocument(data);
  }

  async analyzeRecentChanges(
    range: string,
    progress: GenerationProgress
  ): Promise<RecentChange[]> {
    const prompt = buildWhatsNewPrompt(range);
    const { data } = await this.runStructuredQuery(prompt, RECENT_CHANGES_SCHEMA, progress, {
      tools: ["Read", "Grep", "Glob", "Bash"],
      maxTurns: 10,
      effort: "medium",
    });
    return (data as { changes: RecentChange[] }).changes;
  }

  async generateInvestigationStep(
    prompt: string,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<InvestigationStep & { sessionId?: string }> {
    const { data, sessionId } = await this.runStructuredQuery(prompt, INVESTIGATION_STEP_SCHEMA, progress, {
      tools: ["Read", "Grep", "Glob", "Bash"],
      maxTurns: 20,
      effort: "high",
      ...options,
    });
    return { ...(data as InvestigationStep), sessionId };
  }

  async generateLessonPlan(
    prompt: string,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<{ steps: LessonPlanStep[] }> {
    const { data } = await this.runStructuredQuery(prompt, LESSON_PLAN_SCHEMA, progress, {
      tools: ["Read", "Grep", "Glob", "Bash"],
      maxTurns: 40,
      effort: "high",
      ...options,
    });
    return data as { steps: LessonPlanStep[] };
  }

  async generateStepContent(
    prompt: string,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<StepContent & { sessionId?: string }> {
    const { data, sessionId } = await this.runStructuredQuery(prompt, STEP_CONTENT_SCHEMA, progress, {
      tools: ["Read", "Grep"],
      maxTurns: 8,
      effort: "high",
      ...options,
    });
    return { ...(data as StepContent), sessionId };
  }

  async generateStepResponse(
    prompt: string,
    progress: GenerationProgress
  ): Promise<StepResponse> {
    const { data } = await this.runStructuredQuery(prompt, STEP_RESPONSE_SCHEMA, progress, {
      tools: [],
      maxTurns: 2,
      effort: "low",
    });
    return data as StepResponse;
  }

  async discoverLearnableConcepts(
    progress: GenerationProgress
  ): Promise<LearnableConcept[]> {
    const structure = await this.getFormattedContext();
    const prompt = buildLearnableConceptsPrompt(structure);
    const { data } = await this.runStructuredQuery(prompt, LEARNABLE_CONCEPTS_SCHEMA, progress, {
      tools: ["Read", "Grep", "Glob"],
      maxTurns: 30,
      effort: "high",
    });
    return (data as { concepts: LearnableConcept[] }).concepts;
  }

  async discoverFeatures(
    progress: GenerationProgress
  ): Promise<FeatureTreeNode[]> {
    const structure = await this.getFormattedContext();
    const prompt = buildFeatureDiscoveryPrompt(structure);
    const { data } = await this.runStructuredQuery(prompt, FEATURE_TREE_SCHEMA, progress, {
      tools: ["Read", "Grep", "Glob"],
      maxTurns: 30,
      effort: "high",
    });
    return (data as { features: FeatureTreeNode[] }).features;
  }

  private async checkStatusUncached(): Promise<AIProviderStatus> {
    try {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");
      const claudePath = getConfiguredClaudePath();

      const q = query({
        prompt: "respond with the single word: ok",
        options: {
          cwd: this.workspaceRoot,
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
            return { available: true, authenticated: true, displayName: this.displayName };
          }
          return {
            available: true,
            authenticated: false,
            error: "result" in message ? String(message.result) : message.subtype,
            displayName: this.displayName,
          };
        }
      }

      return { available: true, authenticated: true, displayName: this.displayName };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { available: false, authenticated: false, error: msg, displayName: this.displayName };
    }
  }

  private async runStructuredQuery(
    prompt: string,
    schema: Record<string, unknown>,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<StructuredQueryResult> {
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

        // Extract session_id for resumption (available on all result types)
        const resultAny = message as Record<string, unknown>;
        const sessionId = typeof resultAny.session_id === "string" ? resultAny.session_id : undefined;

        switch (message.subtype) {
          case "success":
            if ("structured_output" in message && message.structured_output) {
              return { data: message.structured_output, sessionId };
            }
            if ("result" in message && typeof message.result === "string") {
              return { data: JSON.parse(message.result), sessionId };
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
