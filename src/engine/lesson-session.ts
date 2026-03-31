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

  constructor(
    private adapter: ClaudeAdapter,
    private subject: string,
    private entryFile?: string
  ) {}

  async generatePlan(progress: GenerationProgress): Promise<LessonPlan> {
    const prompt = buildLessonPlanPrompt(this.subject, this.entryFile);
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

    const prompt = buildStepContentPrompt(this.subject, step.plan, priorSummaries);
    const content = await this.adapter.generateStepContent(prompt, progress);

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

  async prefetchNextStep(): Promise<void> {
    // Cancel any in-progress prefetch first
    this.prefetchAbortController?.abort();
    this.prefetchAbortController = null;

    const nextIndex = this.getNextTeachableStepIndex();
    if (nextIndex === null) return;
    if (this.prefetchedContent.has(nextIndex)) return;

    const step = this.stepStates[nextIndex]!;
    const priorSummaries = this.stepStates
      .filter((s) => s.status === "completed" && s.summary)
      .map((s) => s.summary!);

    const prompt = buildStepContentPrompt(this.subject, step.plan, priorSummaries);
    const abortController = new AbortController();
    this.prefetchAbortController = abortController;

    const silentProgress: GenerationProgress = {
      onProgress: () => {},
      onCancel: (callback) => {
        abortController.signal.addEventListener("abort", callback);
      },
    };

    try {
      const content = await this.adapter.generateStepContent(prompt, silentProgress);
      if (!abortController.signal.aborted && step.status === "upcoming") {
        this.prefetchedContent.set(nextIndex, content);
      }
    } catch {
      // Prefetch failure is non-fatal
    } finally {
      if (this.prefetchAbortController === abortController) {
        this.prefetchAbortController = null;
      }
    }
  }

  cancelPrefetch(): void {
    this.prefetchAbortController?.abort();
    this.prefetchAbortController = null;
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
    stepStates: LessonStepState[]
  ): LessonSession {
    const session = new LessonSession(adapter, plan.subject);
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
