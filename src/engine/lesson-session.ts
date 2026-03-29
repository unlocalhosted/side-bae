import type { ClaudeAdapter, GenerationProgress } from "../claude/adapter.js";
import type {
  LessonStep,
  LessonTurn,
  CheckResult,
  LessonSessionState,
  LessonDepth,
} from "../types/lesson.js";
import type { TourDocument, TourNode } from "../types/tour.js";
import {
  buildLessonSystemPrompt,
  buildLessonTurnPrompt,
} from "../claude/prompts.js";

export class LessonSession {
  private history: LessonTurn[] = [];
  private checkResults: CheckResult[] = [];
  private conceptsIntroduced = new Set<string>();
  private currentStep: LessonStep | null = null;
  private stepCount = 0;
  private readonly systemPrompt: string;

  constructor(
    private adapter: ClaudeAdapter,
    private subject: string,
    private entryFile?: string
  ) {
    this.systemPrompt = buildLessonSystemPrompt(subject);
  }

  async start(progress: GenerationProgress): Promise<LessonStep> {
    const entryHint = this.entryFile
      ? `\n\nStart by examining the file: ${this.entryFile}`
      : "";

    const prompt = `${this.systemPrompt}${entryHint}

Generate the first step: a "prime" phase. Show the learner a key code region and ask what they think it does or why it might be structured this way. Set awaitsResponse to true, skippable to true, inputType to "text", isComplete to false.`;

    return this.generateStep(prompt, progress);
  }

  async respondText(
    text: string,
    progress: GenerationProgress
  ): Promise<LessonStep> {
    this.history.push({ role: "learner", text });

    const turnPrompt = this.buildTurnPrompt({
      text,
      type: "response",
    });

    return this.generateStep(turnPrompt, progress);
  }

  async respondChoice(
    index: number,
    progress: GenerationProgress
  ): Promise<LessonStep> {
    // Grade the choice if the current step has a correct answer
    if (this.currentStep?.correctIndex !== undefined && this.currentStep.concepts) {
      const correct = index === this.currentStep.correctIndex;
      const chosenOption = this.currentStep.options?.[index] ?? `option ${index}`;
      for (const concept of this.currentStep.concepts) {
        this.checkResults.push({
          concept,
          correct,
          userAnswer: chosenOption,
        });
      }
    }

    this.history.push({ role: "learner", choiceIndex: index });

    const turnPrompt = this.buildTurnPrompt({
      choiceIndex: index,
      type: "choice",
    });

    return this.generateStep(turnPrompt, progress);
  }

  async skip(progress: GenerationProgress): Promise<LessonStep> {
    this.history.push({ role: "learner", text: "(skipped)" });

    const turnPrompt = this.buildTurnPrompt({ type: "skip" });

    return this.generateStep(turnPrompt, progress);
  }

  async askFollowUp(
    question: string,
    progress: GenerationProgress
  ): Promise<LessonStep> {
    this.history.push({ role: "learner", text: question });

    const turnPrompt = this.buildTurnPrompt({
      text: question,
      type: "followUp",
    });

    return this.generateStep(turnPrompt, progress);
  }

  isActive(): boolean {
    return this.currentStep !== null && !this.currentStep.isComplete;
  }

  getSessionState(): LessonSessionState {
    return {
      subject: this.subject,
      isActive: this.isActive(),
      currentStep: this.currentStep,
      stepCount: this.stepCount,
      conceptsLearned: [...this.conceptsIntroduced],
      checkResults: [...this.checkResults],
      history: [...this.history],
    };
  }

  /** Convert completed lesson into a static TourDocument for free replay. */
  toTourDocument(): TourDocument {
    const nodes: Record<string, TourNode> = {};
    const teachSteps = this.history
      .filter((t) => t.role === "tutor" && t.step)
      .map((t) => t.step!);

    let prevNodeId: string | null = null;

    for (let i = 0; i < teachSteps.length; i++) {
      const step = teachSteps[i]!;
      // Skip non-content steps for replay
      if (step.phase === "respond" || step.phase === "transition") continue;
      if (step.phase === "recap") continue;

      const nodeId = `step-${i + 1}`;
      const nextContentIdx = findNextContentStep(teachSteps, i + 1);
      const nextNodeId = nextContentIdx !== -1 ? `step-${nextContentIdx + 1}` : undefined;

      nodes[nodeId] = {
        file: step.file ?? "",
        startLine: step.startLine ?? 1,
        endLine: step.endLine ?? 1,
        title: step.title ?? `Step ${i + 1}`,
        explanation: step.content,
        edges: nextNodeId
          ? [{ target: nextNodeId, label: getLayerTransition(step.layer) }]
          : [],
        layer: step.layer,
        concepts: step.concepts?.map((c) => ({ name: c, category: "" })),
      };

      if (prevNodeId && nodes[prevNodeId] && nodes[prevNodeId].edges.length === 0) {
        nodes[prevNodeId].edges.push({
          target: nodeId,
          label: getLayerTransition(step.layer),
        });
      }
      prevNodeId = nodeId;
    }

    const nodeIds = Object.keys(nodes);
    const entryNode = nodeIds[0] ?? "step-1";

    return {
      version: 1,
      id: `lesson-${slugify(this.subject)}`,
      name: `Lesson: ${this.subject}`,
      query: this.subject,
      generatedAt: new Date().toISOString(),
      trackedFiles: [],
      entryNode,
      nodes,
      lesson: {
        subject: this.subject,
        depth: inferDepth(this.checkResults),
        concepts: [...this.conceptsIntroduced],
        synopsis: `Interactive lesson about ${this.subject}.`,
      },
    };
  }

  private buildTurnPrompt(
    userInput: { text?: string; choiceIndex?: number; type: "response" | "choice" | "skip" | "followUp" }
  ): string {
    const turnPrompt = buildLessonTurnPrompt(
      this.history,
      this.checkResults,
      userInput
    );
    return `${this.systemPrompt}\n\n${turnPrompt}`;
  }

  private async generateStep(
    prompt: string,
    progress: GenerationProgress
  ): Promise<LessonStep> {
    const step = await this.adapter.generateLessonStep(prompt, progress);

    this.currentStep = step;
    this.stepCount++;
    this.history.push({ role: "tutor", step });

    if (step.concepts) {
      for (const concept of step.concepts) {
        this.conceptsIntroduced.add(concept);
      }
    }

    return step;
  }
}

function findNextContentStep(steps: LessonStep[], startIdx: number): number {
  for (let i = startIdx; i < steps.length; i++) {
    const phase = steps[i]!.phase;
    if (phase !== "respond" && phase !== "transition" && phase !== "recap") {
      return i;
    }
  }
  return -1;
}

function getLayerTransition(layer?: string): string {
  switch (layer) {
    case "outcome": return "How is it built?";
    case "architecture": return "Why this approach?";
    case "rationale": return "The clever part";
    case "insight": return "Try it yourself";
    case "challenge": return "Next concept";
    default: return "Continue";
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function inferDepth(results: CheckResult[]): LessonDepth {
  if (results.length === 0) return "intermediate";
  const correctRate = results.filter((r) => r.correct).length / results.length;
  if (correctRate >= 0.8) return "advanced";
  if (correctRate >= 0.5) return "intermediate";
  return "foundational";
}
