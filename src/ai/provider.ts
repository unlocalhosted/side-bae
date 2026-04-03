/**
 * AI provider interface.
 *
 * Domain-level abstraction following Aider's strategy pattern — each provider
 * handles prompts, tool loops, and output parsing internally. Consumers call
 * typed domain methods and receive structured results.
 *
 * @see /docs/architecture/agent-architecture-v1.md
 */

import type { GenerationProgress, QueryOptions } from "./types.js";
import type { TourDocument } from "../types/tour.js";
import type { FeatureTreeNode } from "../types/feature-tree.js";
import type { RecentChange } from "../types/recent-changes.js";
import type {
  LessonPlanStep,
  StepContent,
  StepResponse,
  LearnableConcept,
} from "../types/lesson.js";
import type { InvestigationStep } from "../types/investigation.js";

export interface AIProvider {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: AIProviderCapabilities;

  checkStatus(): Promise<AIProviderStatus>;

  /** Cached codebase structure for prompt injection. Shared implementation via codebase-context.ts. */
  getFormattedContext(): Promise<string>;

  generateTour(
    query: string,
    progress: GenerationProgress
  ): Promise<TourDocument>;

  analyzeRecentChanges(
    range: string,
    progress: GenerationProgress
  ): Promise<RecentChange[]>;

  generateInvestigationStep(
    prompt: string,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<InvestigationStep & { sessionId?: string }>;

  generateLessonPlan(
    prompt: string,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<{ steps: LessonPlanStep[] }>;

  generateStepContent(
    prompt: string,
    progress: GenerationProgress,
    options?: QueryOptions
  ): Promise<StepContent & { sessionId?: string }>;

  generateStepResponse(
    prompt: string,
    progress: GenerationProgress
  ): Promise<StepResponse>;

  discoverLearnableConcepts(
    progress: GenerationProgress
  ): Promise<LearnableConcept[]>;

  discoverFeatures(
    progress: GenerationProgress
  ): Promise<FeatureTreeNode[]>;
}

/** Domain-level capabilities — what features this provider supports. */
export interface AIProviderCapabilities {
  investigation: boolean;
  lessons: boolean;
  tours: boolean;
  featureDiscovery: boolean;
  recentChanges: boolean;
  learnableConcepts: boolean;
}

export interface AIProviderStatus {
  available: boolean;
  authenticated: boolean;
  error?: string;
  displayName: string;
}
