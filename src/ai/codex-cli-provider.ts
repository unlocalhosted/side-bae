/**
 * Codex CLI provider — runs `codex exec` using the user's local Codex login.
 *
 * This intentionally does not call the OpenAI API directly. Codex owns auth,
 * model access, sandboxing, and subscription/API-key selection via `codex login`.
 */

import * as vscode from "vscode";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AIProvider, AIProviderCapabilities, AIProviderStatus } from "./provider.js";
import type { GenerationProgress, QueryOptions } from "./types.js";
import { validateTourDocument, type TourDocument } from "../types/tour.js";
import type { FeatureTreeNode } from "../types/feature-tree.js";
import type { RecentChange } from "../types/recent-changes.js";
import type { LessonPlanStep, StepContent, StepResponse, LearnableConcept } from "../types/lesson.js";
import type { InvestigationStep } from "../types/investigation.js";
import type { SystemAtlas } from "../types/atlas.js";
import { TOUR_DOCUMENT_SCHEMA, FEATURE_TREE_SCHEMA, RECENT_CHANGES_SCHEMA, LESSON_PLAN_SCHEMA, STEP_CONTENT_SCHEMA, STEP_RESPONSE_SCHEMA, LEARNABLE_CONCEPTS_SCHEMA, INVESTIGATION_STEP_SCHEMA, SYSTEM_ATLAS_SCHEMA } from "../claude/schema.js";
import {
  buildTourGenerationPrompt,
  buildFeatureDiscoveryPrompt,
  buildAtlasPrompt,
  buildWhatsNewPrompt,
  buildLearnableConceptsPrompt,
} from "../claude/prompts.js";
import { extractJSON } from "./json-parser.js";

export interface CodexCliProviderOptions {
  workspaceRoot: string;
  model?: string;
}

interface StructuredQueryResult {
  data: unknown;
  sessionId?: string;
}

interface CodexProcessResult {
  finalText: string;
  threadId?: string;
  stderr: string;
  stdout: string;
}

interface CodexCommandResult {
  stdout: string;
  stderr: string;
}

const SHARED_SYSTEM_PROMPT = `You are Side Bae, an AI assistant in a VS Code extension that teaches developers about codebases through guided tours, interactive lessons, and bug investigations.

Voice: sound like a sharp friend explaining their favorite codebase over coffee — not documentation.
- Reference code with \`backticks\`, bold **key concepts** on first mention
- Explain WHY, not just WHAT. Have opinions: "this is clever because..."
- Concrete before abstract: show code, explain behavior, then name the pattern
- Never announce actions ("I'm going to..."): just do it
- Do not include node_modules, dist, or build artifacts in file references`;

let cachedStatus: AIProviderStatus | null = null;
let pendingCheck: Promise<AIProviderStatus> | null = null;

function getConfiguredCodexPath(): string {
  return vscode.workspace
    .getConfiguration("sideBae")
    .get<string>("codexPath", "") || "codex";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function truncate(value: string, max = 80): string {
  const oneLine = value.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}...` : oneLine;
}

function looksLikeAuthError(message: string): boolean {
  return /auth|login|log in|sign in|unauthorized|forbidden|credential|token/i.test(message);
}

function codexErrorMessage(message: string): string {
  if (looksLikeAuthError(message)) {
    return "Codex CLI is not logged in. Run `codex login` in your terminal to use your Codex access.";
  }
  return message.trim() || "Codex CLI failed. Run `codex login` or check your Codex installation.";
}

function describeCodexItem(item: Record<string, unknown>): string | undefined {
  const type = stringField(item, "type");
  if (type === "command_execution") {
    const command = stringField(item, "command");
    return command ? `Running ${truncate(command)}` : "Running command";
  }
  if (type === "mcp_tool_call") {
    const name = stringField(item, "name");
    return name ? `Using ${name}` : "Using tool";
  }
  if (type === "web_search") {
    return "Searching";
  }
  if (type === "file_change") {
    const path = stringField(item, "path");
    return path ? `Updating ${path}` : "Updating files";
  }
  return undefined;
}

function extractAgentText(event: Record<string, unknown>): string | undefined {
  const item = event.item;
  if (!isRecord(item) || stringField(item, "type") !== "agent_message") {
    return undefined;
  }
  return stringField(item, "text");
}

function readThreadId(event: Record<string, unknown>): string | undefined {
  if (event.type === "thread.started") {
    return stringField(event, "thread_id");
  }
  return undefined;
}

export class CodexCliProvider implements AIProvider {
  readonly id = "codex";
  readonly displayName = "Codex";
  readonly capabilities: AIProviderCapabilities = {
    investigation: true,
    lessons: true,
    tours: true,
    featureDiscovery: true,
    recentChanges: true,
    learnableConcepts: true,
    atlas: true,
  };

  private workspaceRoot: string;
  private model?: string;
  private codebaseContextPromise: Promise<string> | null = null;

  constructor(options: CodexCliProviderOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.model = options.model || undefined;
  }

  async checkStatus(): Promise<AIProviderStatus> {
    if (cachedStatus?.available && cachedStatus?.authenticated) {
      return cachedStatus;
    }
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
      persistSession: false,
    });
    return validateTourDocument(data);
  }

  async analyzeRecentChanges(
    range: string,
    progress: GenerationProgress
  ): Promise<RecentChange[]> {
    const prompt = buildWhatsNewPrompt(range);
    const { data } = await this.runStructuredQuery(prompt, RECENT_CHANGES_SCHEMA, progress, {
      persistSession: false,
    });
    return (data as { changes: RecentChange[] }).changes;
  }

  async generateInvestigationStep(
    prompt: string,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<InvestigationStep & { sessionId?: string }> {
    const { data, sessionId } = await this.runStructuredQuery(prompt, INVESTIGATION_STEP_SCHEMA, progress, options);
    return { ...(data as InvestigationStep), sessionId };
  }

  async generateLessonPlan(
    prompt: string,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<{ steps: LessonPlanStep[] }> {
    const { data } = await this.runStructuredQuery(prompt, LESSON_PLAN_SCHEMA, progress, options);
    return data as { steps: LessonPlanStep[] };
  }

  async generateStepContent(
    prompt: string,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<StepContent & { sessionId?: string }> {
    const { data, sessionId } = await this.runStructuredQuery(prompt, STEP_CONTENT_SCHEMA, progress, options);
    return { ...(data as StepContent), sessionId };
  }

  async generateStepResponse(
    prompt: string,
    progress: GenerationProgress
  ): Promise<StepResponse> {
    const { data } = await this.runStructuredQuery(prompt, STEP_RESPONSE_SCHEMA, progress, {
      persistSession: false,
    });
    return data as StepResponse;
  }

  async discoverLearnableConcepts(
    progress: GenerationProgress
  ): Promise<LearnableConcept[]> {
    const structure = await this.getFormattedContext();
    const prompt = buildLearnableConceptsPrompt(structure);
    const { data } = await this.runStructuredQuery(prompt, LEARNABLE_CONCEPTS_SCHEMA, progress, {
      persistSession: false,
    });
    return (data as { concepts: LearnableConcept[] }).concepts;
  }

  async generateAtlas(
    progress: GenerationProgress
  ): Promise<SystemAtlas> {
    const structure = await this.getFormattedContext();
    const prompt = buildAtlasPrompt(structure);
    const { data } = await this.runStructuredQuery(prompt, SYSTEM_ATLAS_SCHEMA, progress, {
      persistSession: false,
    });
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
    const { data } = await this.runStructuredQuery(prompt, FEATURE_TREE_SCHEMA, progress, {
      persistSession: false,
    });
    return (data as { features: FeatureTreeNode[] }).features;
  }

  private async checkStatusUncached(): Promise<AIProviderStatus> {
    try {
      await this.runCodexCommand(["--version"]);
      await this.runCodexCommand(["login", "status"]);
      return { available: true, authenticated: true, displayName: this.displayName };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/ENOENT|not found|spawn .* ENOENT/i.test(msg)) {
        return {
          available: false,
          authenticated: false,
          error: "Codex CLI was not found. Install Codex and run `codex login`.",
          displayName: this.displayName,
        };
      }
      return {
        available: true,
        authenticated: false,
        error: codexErrorMessage(msg),
        displayName: this.displayName,
      };
    }
  }

  private runCodexCommand(args: string[]): Promise<CodexCommandResult> {
    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      const maxCapturedOutput = 20_000;
      const child = spawn(getConfiguredCodexPath(), args, {
        cwd: this.workspaceRoot,
        env: process.env,
      });

      child.on("error", (err) => {
        reject(err);
      });

      child.stdout.on("data", (chunk: Buffer) => {
        if (stdout.length < maxCapturedOutput) {
          stdout += chunk.toString("utf-8").slice(0, maxCapturedOutput - stdout.length);
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        if (stderr.length < maxCapturedOutput) {
          stderr += chunk.toString("utf-8").slice(0, maxCapturedOutput - stderr.length);
        }
      });

      child.on("close", (code, signal) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }
        const suffix = signal ? ` (signal ${signal})` : "";
        const message = stderr.trim() || stdout.trim() || `Codex CLI exited with code ${code}${suffix}.`;
        reject(new Error(codexErrorMessage(message)));
      });
    });
  }

  private async runStructuredQuery(
    prompt: string,
    schema: Record<string, unknown>,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<StructuredQueryResult> {
    const fullPrompt = `${SHARED_SYSTEM_PROMPT}

Task:
${prompt}

Return only the final JSON object requested by the provided output schema.`;

    const result = await this.runCodexExec(fullPrompt, schema, progress, options);
    return {
      data: extractJSON(result.finalText),
      sessionId: result.threadId,
    };
  }

  private async runCodexExec(
    prompt: string,
    schema: Record<string, unknown>,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<CodexProcessResult> {
    const tempDir = await mkdtemp(join(tmpdir(), "side-bae-codex-"));
    const schemaPath = join(tempDir, "schema.json");
    const outputPath = join(tempDir, "output.json");
    await writeFile(schemaPath, JSON.stringify(schema), "utf-8");

    const args = [
      "exec",
      "--cd",
      this.workspaceRoot,
      "--json",
      "--output-schema",
      schemaPath,
      "--output-last-message",
      outputPath,
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
    ];

    if (this.model) {
      args.push("--model", this.model);
    }

    const shouldPersist = options?.persistSession === true || Boolean(options?.resumeSessionId);
    if (!shouldPersist) {
      args.push("--ephemeral");
    }

    if (options?.resumeSessionId) {
      args.push("resume", options.resumeSessionId, "-");
    } else {
      args.push("-");
    }

    try {
      const result = await this.spawnCodex(args, prompt, progress);
      let finalText = "";
      try {
        finalText = await readFile(outputPath, "utf-8");
      } catch {
        finalText = result.finalText;
      }
      return { ...result, finalText };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private spawnCodex(
    args: string[],
    prompt: string,
    progress: GenerationProgress
  ): Promise<CodexProcessResult> {
    return new Promise((resolve, reject) => {
      const abortController = new AbortController();
      let stdout = "";
      let stderr = "";
      let finalText = "";
      let threadId: string | undefined;
      let settled = false;

      const child = spawn(getConfiguredCodexPath(), args, {
        cwd: this.workspaceRoot,
        env: process.env,
      });

      const finishReject = (err: Error) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      progress.onCancel(() => abortController.abort());
      abortController.signal.addEventListener("abort", () => {
        child.kill("SIGTERM");
        finishReject(new Error("Query cancelled."));
      });

      child.on("error", (err) => {
        finishReject(err);
      });

      let pendingStdout = "";
      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf-8");
        stdout += text;
        pendingStdout += text;
        const lines = pendingStdout.split(/\r?\n/);
        pendingStdout = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed) as unknown;
            if (!isRecord(event)) continue;
            threadId = readThreadId(event) ?? threadId;
            const item = event.item;
            if (isRecord(item)) {
              const description = describeCodexItem(item);
              if (description && event.type === "item.started") {
                progress.onProgress(description);
              }
            }
            finalText = extractAgentText(event) ?? finalText;
          } catch {
            finalText = trimmed;
          }
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf-8");
      });

      child.on("close", (code, signal) => {
        if (settled) return;
        settled = true;
        if (code === 0) {
          resolve({ finalText, threadId, stderr, stdout });
          return;
        }
        const suffix = signal ? ` (signal ${signal})` : "";
        const message = stderr.trim() || stdout.trim() || `Codex CLI exited with code ${code}${suffix}.`;
        reject(new Error(codexErrorMessage(message)));
      });

      child.stdin.end(prompt);
    });
  }
}
