/**
 * VS Code Language Model API provider — wraps vscode.lm for Copilot subscribers.
 *
 * Architecture follows Roo Code's VS Code LM handler:
 * - Native tool passing (not text serialization like Cline)
 * - JSON Schema draft 2020-12 for tool schemas
 * - Defensive JSON extraction (Continue's pattern)
 *
 * @see https://code.visualstudio.com/api/extension-guides/language-model
 */

import * as vscode from "vscode";
import type { AIProvider, AIProviderCapabilities, AIProviderStatus } from "./provider.js";
import type { GenerationProgress, QueryOptions } from "./types.js";
import { validateTourDocument, type TourDocument } from "../types/tour.js";
import type { FeatureTreeNode } from "../types/feature-tree.js";
import type { RecentChange } from "../types/recent-changes.js";
import type { LessonPlanStep, StepContent, StepResponse, LearnableConcept } from "../types/lesson.js";
import type { InvestigationStep } from "../types/investigation.js";
import type { SystemAtlas } from "../types/atlas.js";
import { TOUR_DOCUMENT_SCHEMA, FEATURE_TREE_SCHEMA, RECENT_CHANGES_SCHEMA, LESSON_PLAN_SCHEMA, STEP_CONTENT_SCHEMA, STEP_RESPONSE_SCHEMA, LEARNABLE_CONCEPTS_SCHEMA, SYSTEM_ATLAS_SCHEMA } from "../claude/schema.js";
import {
  buildTourGenerationPrompt,
  buildFeatureDiscoveryPrompt,
  buildAtlasPrompt,
  buildWhatsNewPrompt,
  buildLearnableConceptsPrompt,
} from "../claude/prompts.js";
import { extractJSON } from "./json-parser.js";
import { WORKSPACE_TOOLS, executeTool, describeToolCall } from "./vscode-lm-tools.js";

export interface VSCodeLMProviderOptions {
  workspaceRoot: string;
}

const SYSTEM_INSTRUCTION = `You are Side Bae, an AI assistant in a VS Code extension that teaches developers about codebases through guided tours and interactive lessons.

Voice: sound like a sharp friend explaining their favorite codebase over coffee — not documentation.
- Reference code with \`backticks\`, bold **key concepts** on first mention
- Explain WHY, not just WHAT. Have opinions: "this is clever because..."
- Concrete before abstract: show code, explain behavior, then name the pattern
- Do not include node_modules, dist, or build artifacts in file references

IMPORTANT: Use the provided tools to read files and search the codebase. Do NOT guess file contents.`;

/** Max tool-calling rounds before giving up. */
const MAX_TOOL_ROUNDS = 15;

export class VSCodeLMProvider implements AIProvider {
  readonly id = "vscode-lm";
  readonly displayName = "Copilot";
  readonly capabilities: AIProviderCapabilities = {
    investigation: false,
    lessons: true,
    tours: true,
    featureDiscovery: true,
    recentChanges: true,
    learnableConcepts: true,
    atlas: true,
  };

  private workspaceRoot: string;
  private codebaseContextPromise: Promise<string> | null = null;

  constructor(options: VSCodeLMProviderOptions) {
    this.workspaceRoot = options.workspaceRoot;
  }

  async checkStatus(): Promise<AIProviderStatus> {
    try {
      const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
      if (models.length === 0) {
        return {
          available: false,
          authenticated: false,
          error: "No Copilot models available. Is GitHub Copilot installed and signed in?",
          displayName: this.displayName,
        };
      }
      return { available: true, authenticated: true, displayName: this.displayName };
    } catch (err) {
      return {
        available: false,
        authenticated: false,
        error: err instanceof Error ? err.message : String(err),
        displayName: this.displayName,
      };
    }
  }

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
    const data = await this.runWithTools(prompt, TOUR_DOCUMENT_SCHEMA, progress);
    return validateTourDocument(data);
  }

  async analyzeRecentChanges(
    range: string,
    progress: GenerationProgress
  ): Promise<RecentChange[]> {
    const prompt = buildWhatsNewPrompt(range);
    const data = await this.runWithTools(prompt, RECENT_CHANGES_SCHEMA, progress);
    return (data as { changes: RecentChange[] }).changes;
  }

  async generateInvestigationStep(
    _prompt: string,
    _progress: GenerationProgress,
    _options?: QueryOptions
  ): Promise<InvestigationStep & { sessionId?: string }> {
    throw new Error(
      "Investigation requires Claude Code. Switch provider in Settings → Side Bae → Provider."
    );
  }

  async generateLessonPlan(
    prompt: string,
    progress: GenerationProgress,
    _options?: QueryOptions
  ): Promise<{ steps: LessonPlanStep[] }> {
    const data = await this.runWithTools(prompt, LESSON_PLAN_SCHEMA, progress);
    return data as { steps: LessonPlanStep[] };
  }

  async generateStepContent(
    prompt: string,
    progress: GenerationProgress,
    _options?: QueryOptions
  ): Promise<StepContent & { sessionId?: string }> {
    const data = await this.runWithTools(prompt, STEP_CONTENT_SCHEMA, progress);
    return { ...(data as StepContent), sessionId: undefined };
  }

  async generateStepResponse(
    prompt: string,
    progress: GenerationProgress
  ): Promise<StepResponse> {
    // Step responses are simple — no tools needed, just chat
    const data = await this.runWithTools(prompt, STEP_RESPONSE_SCHEMA, progress, false);
    return data as StepResponse;
  }

  async discoverLearnableConcepts(
    progress: GenerationProgress
  ): Promise<LearnableConcept[]> {
    const structure = await this.getFormattedContext();
    const prompt = buildLearnableConceptsPrompt(structure);
    const data = await this.runWithTools(prompt, LEARNABLE_CONCEPTS_SCHEMA, progress);
    return (data as { concepts: LearnableConcept[] }).concepts;
  }

  async generateAtlas(
    progress: GenerationProgress
  ): Promise<SystemAtlas> {
    const structure = await this.getFormattedContext();
    const prompt = buildAtlasPrompt(structure);
    const data = await this.runWithTools(prompt, SYSTEM_ATLAS_SCHEMA, progress);
    return {
      version: 1,
      id: "atlas",
      generatedAt: new Date().toISOString(),
      ...(data as Omit<SystemAtlas, "version" | "id" | "generatedAt">),
    };
  }

  async discoverFeatures(
    progress: GenerationProgress
  ): Promise<FeatureTreeNode[]> {
    const structure = await this.getFormattedContext();
    const prompt = buildFeatureDiscoveryPrompt(structure);
    const data = await this.runWithTools(prompt, FEATURE_TREE_SCHEMA, progress);
    return (data as { features: FeatureTreeNode[] }).features;
  }

  /**
   * Core method: send a prompt with optional tools, loop on tool calls,
   * then extract structured JSON from the final text response.
   */
  private async runWithTools(
    prompt: string,
    schema: Record<string, unknown>,
    progress: GenerationProgress,
    useTools = true
  ): Promise<unknown> {
    const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
    const model = models[0];
    if (!model) {
      throw new Error("No Copilot model available. Is GitHub Copilot installed?");
    }

    const abortController = new AbortController();
    const tokenSource = new vscode.CancellationTokenSource();
    progress.onCancel(() => {
      abortController.abort();
      tokenSource.cancel();
    });

    const schemaInstruction = `\n\nRespond with a JSON object matching this schema. Do NOT wrap it in markdown code fences.\n${JSON.stringify(schema, null, 2)}`;

    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(SYSTEM_INSTRUCTION),
      vscode.LanguageModelChatMessage.User(prompt + schemaInstruction),
    ];

    const requestOptions: vscode.LanguageModelChatRequestOptions = {
      justification: `Side Bae would like to use '${model.name}' to analyze your codebase.`,
    };

    if (useTools) {
      requestOptions.tools = WORKSPACE_TOOLS;
      requestOptions.toolMode = vscode.LanguageModelChatToolMode.Auto;
    }

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      if (abortController.signal.aborted) {
        throw new Error("Query cancelled.");
      }

      // eslint-disable-next-line no-await-in-loop -- sequential tool-calling loop: each round depends on the previous
      const response = await model.sendRequest(
        messages,
        requestOptions,
        tokenSource.token
      );

      let fullText = "";
      const toolCalls: vscode.LanguageModelToolCallPart[] = [];

      for await (const part of response.stream) { // eslint-disable-line no-await-in-loop -- streaming
        if (part instanceof vscode.LanguageModelTextPart) {
          fullText += part.value;
        } else if (part instanceof vscode.LanguageModelToolCallPart) {
          toolCalls.push(part);
        }
      }

      // No tool calls — extract JSON from final text
      if (toolCalls.length === 0) {
        return extractJSON(fullText);
      }

      // Execute tool calls and feed results back
      for (const call of toolCalls) {
        const input = (call.input ?? {}) as Record<string, unknown>;
        progress.onProgress(describeToolCall(call.name, input));

        // eslint-disable-next-line no-await-in-loop -- tool results feed back into next round sequentially
        const result = await executeTool(call.name, input, this.workspaceRoot);

        // Append assistant message with tool call, then user message with result
        messages.push(
          vscode.LanguageModelChatMessage.Assistant([call])
        );
        messages.push(
          vscode.LanguageModelChatMessage.User([
            new vscode.LanguageModelToolResultPart(call.callId, [
              new vscode.LanguageModelTextPart(result),
            ]),
          ])
        );
      }
    }

    throw new Error(
      "Too many tool-calling rounds. Try asking about something more specific."
    );
  }
}
