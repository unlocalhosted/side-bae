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
import type { LessonStep, LearnableConcept } from "../types/lesson.js";
import { TOUR_DOCUMENT_SCHEMA, FEATURE_TREE_SCHEMA, RECENT_CHANGES_SCHEMA, LESSON_STEP_SCHEMA, LEARNABLE_CONCEPTS_SCHEMA } from "./schema.js";
import {
  buildTourGenerationPrompt,
  buildFeatureDiscoveryPrompt,
  buildWhatsNewPrompt,
  buildInvestigationPrompt,
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

const TOUR_PROGRESS = [
  "Reading source files...",
  "Tracing code paths related to your query...",
  "Identifying entry points and call chains...",
  "Mapping connections between files...",
  "Reading deeper into the code...",
  "Writing explanations for each stop...",
  "Building the tour graph...",
  "Still working — complex features take longer...",
  "Almost there — finalizing the tour...",
];

const FEATURE_PROGRESS = [
  "Scanning directory structure...",
  "Reading entry points and route definitions...",
  "Identifying major features...",
  "Grouping related functionality...",
  "Building feature tree...",
];

const WHATS_NEW_PROGRESS = [
  "Reading git history...",
  "Grouping commits by author...",
  "Identifying logical changes...",
  "Summarizing changes...",
];

const LESSON_STEP_PROGRESS = [
  "Reading your response...",
  "Exploring the code...",
  "Crafting the next step...",
  "Almost ready...",
];

const LEARNABLE_SCAN_PROGRESS = [
  "Scanning the codebase...",
  "Identifying patterns and techniques...",
  "Assessing complexity levels...",
  "Building learning catalog...",
];

const INVESTIGATION_PROGRESS = [
  "Reading the bug report...",
  "Searching for the affected code...",
  "Tracing the code path...",
  "Found something \u2014 analyzing the root cause...",
  "Working on a fix...",
  "Writing up the investigation...",
  "Putting it all together...",
];

/**
 * Check if the Claude Agent SDK can connect and authenticate.
 * Uses the SDK itself (not execFile) so it tests the exact same code path.
 */
export async function checkClaudeStatus(
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

export class ClaudeAdapter {
  private workspaceRoot: string;
  private model: string;
  private maxBudgetUsd: number;

  constructor(options: ClaudeAdapterOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.model = options.model ?? "haiku";
    this.maxBudgetUsd = options.maxBudgetUsd ?? 0.5;
  }

  async generateTour(
    queryText: string,
    progress: GenerationProgress
  ): Promise<TourDocument> {
    const prompt = buildTourGenerationPrompt(queryText);
    const result = await this.runStructuredQuery(
      prompt,
      TOUR_DOCUMENT_SCHEMA,
      progress,
      TOUR_PROGRESS
    );
    return validateTourDocument(result);
  }

  async investigateIssue(
    issueTitle: string,
    issueBody: string,
    progress: GenerationProgress
  ): Promise<TourDocument> {
    const prompt = buildInvestigationPrompt(issueTitle, issueBody);
    const result = await this.runStructuredQuery(
      prompt,
      TOUR_DOCUMENT_SCHEMA,
      progress,
      INVESTIGATION_PROGRESS
    );
    return validateTourDocument(result);
  }

  async analyzeRecentChanges(
    range: string,
    progress: GenerationProgress
  ): Promise<RecentChange[]> {
    const prompt = buildWhatsNewPrompt(range);
    const result = await this.runStructuredQuery(
      prompt,
      RECENT_CHANGES_SCHEMA,
      progress,
      WHATS_NEW_PROGRESS
    );
    return (result as { changes: RecentChange[] }).changes;
  }

  async generateLessonStep(
    prompt: string,
    progress: GenerationProgress
  ): Promise<LessonStep> {
    const result = await this.runStructuredQuery(
      prompt,
      LESSON_STEP_SCHEMA,
      progress,
      LESSON_STEP_PROGRESS
    );
    return result as LessonStep;
  }

  async discoverLearnableConcepts(
    progress: GenerationProgress
  ): Promise<LearnableConcept[]> {
    const prompt = buildLearnableConceptsPrompt();
    const result = await this.runStructuredQuery(
      prompt,
      LEARNABLE_CONCEPTS_SCHEMA,
      progress,
      LEARNABLE_SCAN_PROGRESS
    );
    return (result as { concepts: LearnableConcept[] }).concepts;
  }

  async discoverFeatures(
    progress: GenerationProgress
  ): Promise<FeatureTreeNode[]> {
    const prompt = buildFeatureDiscoveryPrompt();
    const result = await this.runStructuredQuery(
      prompt,
      FEATURE_TREE_SCHEMA,
      progress,
      FEATURE_PROGRESS
    );
    return (result as { features: FeatureTreeNode[] }).features;
  }

  private async runStructuredQuery(
    prompt: string,
    schema: Record<string, unknown>,
    progress: GenerationProgress,
    progressMessages: string[]
  ): Promise<unknown> {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const claudePath = getConfiguredClaudePath();

    const abortController = new AbortController();
    progress.onCancel(() => abortController.abort());

    progress.onProgress(progressMessages[0]!);

    try {
      const q = query({
        prompt,
        options: {
          cwd: this.workspaceRoot,
          model: this.model,
          pathToClaudeCodeExecutable: claudePath,
          maxTurns: 30,
          maxBudgetUsd: this.maxBudgetUsd,
          abortController,
          allowedTools: ["Read", "Grep", "Glob", "Bash"],
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          outputFormat: { type: "json_schema", schema },
          persistSession: false,
          settingSources: ["user", "project"],
        },
      });

      for await (const message of q) {
        // Surface real activity from the SDK as progress
        if (message.type === "assistant" && "message" in message) {
          const assistantMsg = message.message as { content?: Array<{ type: string; name?: string; input?: { file_path?: string; pattern?: string; command?: string } }> };
          if (assistantMsg.content) {
            for (const block of assistantMsg.content) {
              if (block.type === "tool_use" && block.name) {
                const target = block.input?.file_path || block.input?.pattern || block.input?.command || "";
                const shortTarget = target.length > 50 ? "..." + target.slice(-47) : target;
                const label = shortTarget ? `${block.name}: ${shortTarget}` : block.name;
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
