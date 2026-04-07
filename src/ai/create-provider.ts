/**
 * Provider factory — simple switch, following Cline/Roo Code's buildApiHandler pattern.
 *
 * No registry, no DI container, no plugin system. All 6 researched projects
 * use a flat switch/map factory and it works at any scale.
 */

import type { AIProvider, AIProviderStatus } from "./provider.js";
import type { GenerationProgress, QueryOptions } from "./types.js";
import { ClaudeCodeProvider } from "./claude-code-provider.js";
import { VSCodeLMProvider } from "./vscode-lm-provider.js";
import type { TourDocument } from "../types/tour.js";
import type { FeatureTreeNode } from "../types/feature-tree.js";
import type { RecentChange } from "../types/recent-changes.js";
import type { LessonPlanStep, StepContent, StepResponse, LearnableConcept } from "../types/lesson.js";
import type { InvestigationStep } from "../types/investigation.js";
import type { SystemAtlas } from "../types/atlas.js";

export type ProviderChoice = "claude-code" | "copilot" | "auto";

export interface ProviderConfig {
  provider: ProviderChoice;
  workspaceRoot: string;
  model?: string;
  maxBudgetUsd?: number;
}

export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.provider) {
    case "claude-code":
      return new ClaudeCodeProvider({
        workspaceRoot: config.workspaceRoot,
        model: config.model,
        maxBudgetUsd: config.maxBudgetUsd,
      });
    case "copilot":
      return new VSCodeLMProvider({
        workspaceRoot: config.workspaceRoot,
      });
    case "auto":
      return new AutoProvider(config);
  }
}

/**
 * Auto-detecting provider. Probes Copilot first, falls back to Claude Code.
 * Resolution happens lazily on first checkStatus() or domain method call.
 */
class AutoProvider implements AIProvider {
  readonly id = "auto";
  readonly displayName = "Auto";

  private resolved: AIProvider | null = null;
  private resolving: Promise<AIProvider> | null = null;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  get capabilities() {
    // Before resolution, report the intersection of both providers
    return this.resolved?.capabilities ?? {
      investigation: false,
      lessons: true,
      tours: true,
      featureDiscovery: true,
      recentChanges: true,
      learnableConcepts: true,
      atlas: true,
    };
  }

  async checkStatus(): Promise<AIProviderStatus> {
    const provider = await this.resolve();
    return provider.checkStatus();
  }

  async getFormattedContext(): Promise<string> {
    const provider = await this.resolve();
    return provider.getFormattedContext();
  }

  async generateTour(query: string, progress: GenerationProgress): Promise<TourDocument> {
    const provider = await this.resolve();
    return provider.generateTour(query, progress);
  }

  async analyzeRecentChanges(range: string, progress: GenerationProgress): Promise<RecentChange[]> {
    const provider = await this.resolve();
    return provider.analyzeRecentChanges(range, progress);
  }

  async generateInvestigationStep(prompt: string, progress: GenerationProgress, options?: QueryOptions): Promise<InvestigationStep & { sessionId?: string }> {
    const provider = await this.resolve();
    return provider.generateInvestigationStep(prompt, progress, options);
  }

  async generateLessonPlan(prompt: string, progress: GenerationProgress, options?: QueryOptions): Promise<{ steps: LessonPlanStep[] }> {
    const provider = await this.resolve();
    return provider.generateLessonPlan(prompt, progress, options);
  }

  async generateStepContent(prompt: string, progress: GenerationProgress, options?: QueryOptions): Promise<StepContent & { sessionId?: string }> {
    const provider = await this.resolve();
    return provider.generateStepContent(prompt, progress, options);
  }

  async generateStepResponse(prompt: string, progress: GenerationProgress): Promise<StepResponse> {
    const provider = await this.resolve();
    return provider.generateStepResponse(prompt, progress);
  }

  async discoverLearnableConcepts(progress: GenerationProgress): Promise<LearnableConcept[]> {
    const provider = await this.resolve();
    return provider.discoverLearnableConcepts(progress);
  }

  async discoverFeatures(progress: GenerationProgress): Promise<FeatureTreeNode[]> {
    const provider = await this.resolve();
    return provider.discoverFeatures(progress);
  }

  async generateAtlas(progress: GenerationProgress): Promise<SystemAtlas> {
    const provider = await this.resolve();
    return provider.generateAtlas(progress);
  }

  private async resolve(): Promise<AIProvider> {
    if (this.resolved) return this.resolved;
    if (this.resolving) return this.resolving;

    this.resolving = this.detectProvider();
    try {
      this.resolved = await this.resolving;
      return this.resolved;
    } finally {
      this.resolving = null;
    }
  }

  private async detectProvider(): Promise<AIProvider> {
    // Try Copilot first — it's cheaper for the user (included in Copilot subscription)
    const copilot = new VSCodeLMProvider({ workspaceRoot: this.config.workspaceRoot });
    const copilotStatus = await copilot.checkStatus();
    if (copilotStatus.available && copilotStatus.authenticated) {
      return copilot;
    }

    // Fall back to Claude Code
    return new ClaudeCodeProvider({
      workspaceRoot: this.config.workspaceRoot,
      model: this.config.model,
      maxBudgetUsd: this.config.maxBudgetUsd,
    });
  }
}
