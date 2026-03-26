import { spawn } from "node:child_process";
import type { TourDocument } from "../types/tour.js";
import type { FeatureTreeNode } from "../types/feature-tree.js";
import { TOUR_DOCUMENT_SCHEMA, FEATURE_TREE_SCHEMA } from "./schema.js";
import {
  buildTourGenerationPrompt,
  buildFeatureDiscoveryPrompt,
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

// Honest, specific messages about what's actually happening during generation.
// Rotated on a timer so the user sees forward momentum, not a frozen spinner.
const TOUR_GENERATION_MESSAGES = [
  "Reading source files...",
  "Tracing code paths related to your query...",
  "Identifying entry points and call chains...",
  "Mapping connections between files...",
  "Writing explanations for each stop...",
  "Building the tour graph...",
  "Finalizing tour structure...",
];

const FEATURE_DISCOVERY_MESSAGES = [
  "Scanning directory structure...",
  "Reading entry points and route definitions...",
  "Identifying major features...",
  "Grouping related functionality...",
  "Building feature tree...",
];

export class ClaudeAdapter {
  private workspaceRoot: string;
  private model: string;
  private maxBudgetUsd: number;

  constructor(options: ClaudeAdapterOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.model = options.model ?? "sonnet";
    this.maxBudgetUsd = options.maxBudgetUsd ?? 0.5;
  }

  async generateTour(
    query: string,
    progress: GenerationProgress
  ): Promise<TourDocument> {
    const prompt = buildTourGenerationPrompt(query);
    const result = await this.runClaude(
      prompt,
      TOUR_DOCUMENT_SCHEMA,
      progress,
      TOUR_GENERATION_MESSAGES
    );
    return result as TourDocument;
  }

  async discoverFeatures(
    progress: GenerationProgress
  ): Promise<FeatureTreeNode[]> {
    const prompt = buildFeatureDiscoveryPrompt();
    const result = await this.runClaude(
      prompt,
      FEATURE_TREE_SCHEMA,
      progress,
      FEATURE_DISCOVERY_MESSAGES
    );
    return (result as { features: FeatureTreeNode[] }).features;
  }

  buildArgs(prompt: string, schema: object): string[] {
    return [
      "-p",
      "--output-format",
      "json",
      "--json-schema",
      JSON.stringify(schema),
      "--model",
      this.model,
      "--max-turns",
      "10",
      "--max-budget-usd",
      String(this.maxBudgetUsd),
      prompt,
    ];
  }

  private runClaude(
    prompt: string,
    schema: object,
    progress: GenerationProgress,
    messages: string[]
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const args = this.buildArgs(prompt, schema);

      const child = spawn("claude", args, {
        cwd: this.workspaceRoot,
        stdio: ["ignore", "pipe", "pipe"],
      });

      // Rotate progress messages on a timer so the user sees momentum
      let messageIndex = 0;
      progress.onProgress(messages[0]!);
      const messageTimer = setInterval(() => {
        messageIndex++;
        if (messageIndex < messages.length) {
          progress.onProgress(messages[messageIndex]!);
        }
      }, 6000);

      progress.onCancel(() => {
        clearInterval(messageTimer);
        child.kill("SIGTERM");
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutChunks.push(chunk);
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });

      child.on("error", (err) => {
        clearInterval(messageTimer);
        reject(
          new Error(
            `Could not find the Claude CLI (${err.message}). Make sure it's installed and on your PATH.`
          )
        );
      });

      child.on("close", (code) => {
        clearInterval(messageTimer);

        if (code !== 0) {
          const stderr = Buffer.concat(stderrChunks).toString("utf-8");
          // Extract the most useful part of the error
          const shortError =
            stderr.split("\n").find((line) => line.trim().length > 0) ||
            "No details available";
          reject(
            new Error(
              `Claude couldn't complete the request: ${shortError}`
            )
          );
          return;
        }

        try {
          const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
          const response = JSON.parse(stdout);

          if (response.result) {
            const parsed =
              typeof response.result === "string"
                ? JSON.parse(response.result)
                : response.result;
            resolve(parsed);
          } else {
            resolve(response);
          }
        } catch {
          reject(
            new Error(
              `Claude returned an unexpected response. Try again — if this persists, the query may be too broad.`
            )
          );
        }
      });
    });
  }
}
