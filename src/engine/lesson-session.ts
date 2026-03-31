import * as fs from "node:fs/promises";
import { join } from "node:path";
import type { ClaudeAdapter, GenerationProgress } from "../claude/adapter.js";
import type {
  LessonPlan,
  StepContent,
  StepResponse,
  LessonStepState,
  LessonSessionState,
  CheckResult,
  StepStatus,
} from "../types/lesson.js";
import type { TourDocument, TourNode } from "../types/tour.js";
import {
  buildLessonPlanPrompt,
  buildStepContentPrompt,
  buildStepResponsePrompt,
} from "../claude/prompts.js";
import { slugify } from "../utils.js";

export class LessonSession {
  private plan: LessonPlan | null = null;
  private stepStates: LessonStepState[] = [];
  private activeStepIndex = -1;
  private checkResults: CheckResult[] = [];
  private prefetchedContent: Map<number, StepContent> = new Map();
  private prefetchAbortController: AbortController | null = null;
  /** SDK session ID for step content calls (per-schema session scoping). */
  private stepSessionId: string | null = null;

  constructor(
    private adapter: ClaudeAdapter,
    private subject: string,
    private workspaceRoot: string,
    private entryFile?: string
  ) {}

  async generatePlan(progress: GenerationProgress): Promise<LessonPlan> {
    const codebaseStructure = await this.adapter.getFormattedContext();
    const prompt = buildLessonPlanPrompt(this.subject, this.entryFile, codebaseStructure);
    const result = await this.adapter.generateLessonPlan(prompt, progress);

    this.plan = {
      id: `lesson-${slugify(this.subject)}-${Date.now()}`,
      subject: this.subject,
      generatedAt: new Date().toISOString(),
      steps: result.steps,
    };

    this.stepStates = result.steps.map((step, i) => ({
      status: (i === 0 ? "active" : "upcoming") as StepStatus,
      plan: step,
    }));
    this.activeStepIndex = 0;

    // Immediately start prefetching first 2 steps (non-blocking)
    this.prefetchSteps([0, 1]);

    return this.plan;
  }

  async teachActiveStep(progress: GenerationProgress): Promise<StepContent> {
    const step = this.stepStates[this.activeStepIndex];
    if (!step) throw new Error("No active step");

    // Cancel any in-progress prefetch to avoid concurrent API calls
    this.cancelPrefetch();

    // Check prefetch cache first
    const cached = this.prefetchedContent.get(this.activeStepIndex);
    if (cached) {
      this.prefetchedContent.delete(this.activeStepIndex);
      if (cached.skipReason) {
        step.status = "skipped";
        step.summary = cached.skipReason;
        return cached;
      }
      step.content = cached;
      return cached;
    }

    // Cache miss — generate on demand
    const priorSummaries = this.stepStates
      .filter((s) => s.status === "completed" && s.summary)
      .map((s) => s.summary!);

    // Pre-load file content locally (avoids a Read tool call)
    const fileContent = await this.readStepFile(step.plan.file);
    const prompt = buildStepContentPrompt(this.subject, step.plan, priorSummaries, fileContent);
    const content = await this.adapter.generateStepContent(prompt, progress, {
      persistSession: true,
      resumeSessionId: this.stepSessionId ?? undefined,
    });

    // Capture session ID from first step content call for reuse
    if (!this.stepSessionId && content.sessionId) {
      this.stepSessionId = content.sessionId;
    }

    // Handle skip
    if (content.skipReason) {
      step.status = "skipped";
      step.summary = content.skipReason;
      return content;
    }

    step.content = content;
    return content;
  }

  async respondToText(
    text: string,
    progress: GenerationProgress
  ): Promise<StepResponse> {
    const trimmed = text.trim().slice(0, 5000);
    const step = this.stepStates[this.activeStepIndex];
    if (!step?.content) throw new Error("No active content");

    step.userAnswer = trimmed;

    const prompt = buildStepResponsePrompt(
      step.content.explanation,
      step.content.prompt ?? "",
      trimmed
    );
    const response = await this.adapter.generateStepResponse(prompt, progress);

    step.response = response;
    step.summary = response.summary;

    if (response.correct !== undefined && step.content.prompt) {
      for (const concept of step.plan.concepts) {
        this.checkResults.push({
          concept,
          correct: response.correct,
          userAnswer: trimmed,
        });
      }
    }

    return response;
  }

  respondToChoice(index: number): StepResponse {
    const step = this.stepStates[this.activeStepIndex];
    if (!step?.content) throw new Error("No active content");

    step.userChoiceIndex = index;
    const correct = step.content.correctIndex === index;
    const chosenOption = step.content.options?.[index] ?? `option ${index}`;

    const content = correct
      ? (step.content.correctExplanation ?? "Correct!")
      : (step.content.incorrectExplanation ?? "Not quite.");

    const response: StepResponse = {
      content,
      correct,
      summary: `${step.plan.title} — ${correct ? "understood" : "needs review"}`,
    };

    step.response = response;
    step.summary = response.summary;
    step.userAnswer = chosenOption;

    for (const concept of step.plan.concepts) {
      this.checkResults.push({ concept, correct, userAnswer: chosenOption });
    }

    return response;
  }

  advanceToNextStep(): number {
    const current = this.stepStates[this.activeStepIndex];
    if (current) current.status = "completed";

    const nextIndex = this.getNextTeachableStepIndex();
    if (nextIndex !== null) {
      this.activeStepIndex = nextIndex;
      this.stepStates[nextIndex]!.status = "active";
      return nextIndex;
    }

    // All done
    this.activeStepIndex = this.stepStates.length;
    return -1;
  }

  private getNextTeachableStepIndex(): number | null {
    for (let i = this.activeStepIndex + 1; i < this.stepStates.length; i++) {
      if (this.stepStates[i]!.status !== "skipped") {
        return i;
      }
    }
    return null;
  }

  /** Prefetch multiple steps in parallel. Non-blocking, fire-and-forget. */
  /** Prefetch multiple steps in parallel. Non-blocking, fire-and-forget. */
  prefetchSteps(indices: number[]): void {
    // Cancel any in-flight prefetches before starting new ones
    this.cancelPrefetch();
    this.prefetchAbortController = new AbortController();
    const controller = this.prefetchAbortController;

    for (const i of indices) {
      if (i < 0 || i >= this.stepStates.length) continue;
      if (this.prefetchedContent.has(i)) continue;
      if (this.stepStates[i]!.status === "skipped") continue;
      this.prefetchOneStep(i, controller).catch(() => {});
    }
  }

  async prefetchNextStep(): Promise<void> {
    const nextIndex = this.getNextTeachableStepIndex();
    if (nextIndex === null) return;
    this.prefetchSteps([nextIndex, nextIndex + 1]);
  }

  private async prefetchOneStep(index: number, controller: AbortController): Promise<void> {
    if (this.prefetchedContent.has(index)) return;
    if (controller.signal.aborted) return;

    const step = this.stepStates[index]!;
    const priorSummaries = this.stepStates
      .filter((s) => s.status === "completed" && s.summary)
      .map((s) => s.summary!);

    const fileContent = await this.readStepFile(step.plan.file);
    const prompt = buildStepContentPrompt(this.subject, step.plan, priorSummaries, fileContent);

    const silentProgress: GenerationProgress = {
      onProgress: () => {},
      onCancel: (callback) => {
        controller.signal.addEventListener("abort", callback);
      },
    };

    try {
      const content = await this.adapter.generateStepContent(prompt, silentProgress, {
        persistSession: true,
        resumeSessionId: this.stepSessionId ?? undefined,
      });
      if (!this.stepSessionId && content.sessionId) {
        this.stepSessionId = content.sessionId;
      }
      if (!controller.signal.aborted && step.status === "upcoming") {
        this.prefetchedContent.set(index, content);
      }
    } catch {
      // Prefetch failure is non-fatal
    }
  }

  cancelPrefetch(): void {
    this.prefetchAbortController?.abort();
    this.prefetchAbortController = null;
  }

  private fileCache = new Map<string, string | undefined>();

  /** Read a step's file locally. Cached per session to avoid redundant reads. */
  private async readStepFile(file: string): Promise<string | undefined> {
    if (this.fileCache.has(file)) return this.fileCache.get(file);
    try {
      const content = await fs.readFile(join(this.workspaceRoot, file), "utf-8");
      this.fileCache.set(file, content);
      return content;
    } catch {
      this.fileCache.set(file, undefined);
      return undefined;
    }
  }

  isComplete(): boolean {
    return this.activeStepIndex >= this.stepStates.length;
  }

  getPlan(): LessonPlan | null {
    return this.plan;
  }

  getSessionState(): LessonSessionState {
    return {
      subject: this.subject,
      planId: this.plan?.id ?? "",
      steps: this.stepStates,
      activeStepIndex: this.activeStepIndex,
      isComplete: this.isComplete(),
    };
  }

  getSerializableState(): { plan: LessonPlan; stepStates: LessonStepState[] } | null {
    if (!this.plan) return null;
    return { plan: this.plan, stepStates: this.stepStates };
  }

  static fromSaved(
    adapter: ClaudeAdapter,
    plan: LessonPlan,
    stepStates: LessonStepState[],
    workspaceRoot: string
  ): LessonSession {
    const session = new LessonSession(adapter, plan.subject, workspaceRoot);
    session.plan = plan;
    session.stepStates = stepStates;

    // Find the active step
    const activeIdx = stepStates.findIndex((s) => s.status === "active");
    session.activeStepIndex = activeIdx >= 0 ? activeIdx : stepStates.length;

    return session;
  }

  toTourDocument(): TourDocument {
    if (!this.plan) throw new Error("No plan to convert");

    const nodes: Record<string, TourNode> = {};
    let prevNodeId: string | null = null;

    for (const step of this.stepStates) {
      if (step.status === "skipped" || !step.content) continue;

      const nodeId = step.plan.id;
      nodes[nodeId] = {
        file: step.plan.file,
        startLine: step.plan.startLine,
        endLine: step.plan.endLine,
        title: step.plan.title,
        explanation: step.content.explanation,
        edges: [],
        layer: step.plan.layer,
        concepts: step.plan.concepts.map((c) => ({ name: c, category: "" })),
        takeaway: step.summary,
      };

      if (prevNodeId && nodes[prevNodeId]) {
        nodes[prevNodeId].edges.push({ target: nodeId, label: "Next" });
      }
      prevNodeId = nodeId;
    }

    const nodeIds = Object.keys(nodes);
    return {
      version: 1,
      id: this.plan.id,
      name: `Lesson: ${this.subject}`,
      query: this.subject,
      generatedAt: this.plan.generatedAt,
      trackedFiles: [],
      entryNode: nodeIds[0] ?? "step-1",
      nodes,
      lesson: {
        subject: this.subject,
        depth: "intermediate",
        concepts: [...new Set(this.stepStates.flatMap((s) => s.plan.concepts))],
        synopsis: `Interactive lesson about ${this.subject}.`,
      },
    };
  }
}
