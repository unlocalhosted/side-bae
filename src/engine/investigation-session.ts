import type { ClaudeAdapter, GenerationProgress } from "../claude/adapter.js";
import {
  INVESTIGATION_PHASE_KIND,
  type InvestigationStep,
  type InvestigationTurn,
  type InvestigationSessionState,
} from "../types/investigation.js";
import type { TourDocument, TourNode } from "../types/tour.js";
import {
  buildInvestigationSessionPrompt,
  buildInvestigationTurnPrompt,
} from "../claude/prompts.js";
import { slugify } from "../utils.js";

export class InvestigationSession {
  private history: InvestigationTurn[] = [];
  private currentStep: InvestigationStep | null = null;
  private stepCount = 0;
  private fixApplied = false;
  private testsRun = false;
  private prCreated = false;
  private readonly systemPrompt: string;

  constructor(
    private adapter: ClaudeAdapter,
    private issueTitle: string,
    issueBody: string
  ) {
    this.systemPrompt = buildInvestigationSessionPrompt(issueTitle, issueBody);
  }

  async start(progress: GenerationProgress): Promise<InvestigationStep> {
    const prompt = `${this.systemPrompt}

Generate the first step: an "orient" phase. Describe what you think the issue is about based on the description. Ask the user if you're on the right track. Set awaitsResponse to true, inputType to "confirm", isComplete to false.`;

    return this.generateStep(prompt, progress);
  }

  async respondText(
    text: string,
    progress: GenerationProgress
  ): Promise<InvestigationStep> {
    const trimmed = text.trim().slice(0, 5000);
    if (!trimmed) return this.confirmAndContinue(progress);
    this.history.push({ role: "user", text: trimmed });
    const turnPrompt = this.buildTurnPrompt({ text, type: "response" });
    return this.generateStep(turnPrompt, progress);
  }

  async confirmAndContinue(
    progress: GenerationProgress
  ): Promise<InvestigationStep> {
    this.history.push({ role: "user", text: "(confirmed)" });
    const turnPrompt = this.buildTurnPrompt({ type: "confirm" });
    return this.generateStep(turnPrompt, progress);
  }

  async requestFix(
    progress: GenerationProgress
  ): Promise<InvestigationStep> {
    this.history.push({ role: "user", text: "(requested fix)" });
    const turnPrompt = this.buildTurnPrompt({ type: "requestFix" });
    return this.generateStep(turnPrompt, progress);
  }

  async requestTests(
    progress: GenerationProgress
  ): Promise<InvestigationStep> {
    this.history.push({ role: "user", text: "(requested tests)" });
    this.testsRun = true;
    const turnPrompt = this.buildTurnPrompt({ type: "runTests" });
    return this.generateStep(turnPrompt, progress);
  }

  async notifyFixApplied(
    progress: GenerationProgress
  ): Promise<InvestigationStep> {
    this.fixApplied = true;
    this.history.push({ role: "user", text: "(applied fix)" });
    const turnPrompt = this.buildTurnPrompt({ type: "applyFix" });
    return this.generateStep(turnPrompt, progress);
  }

  async requestPR(
    progress: GenerationProgress
  ): Promise<InvestigationStep> {
    this.history.push({ role: "user", text: "(requested PR)" });
    const turnPrompt = this.buildTurnPrompt({ type: "createPR" });
    const step = await this.generateStep(turnPrompt, progress);
    if (step.prUrl) this.prCreated = true;
    return step;
  }

  isActive(): boolean {
    return this.currentStep !== null && !this.currentStep.isComplete;
  }

  getSessionState(): InvestigationSessionState {
    return {
      issueTitle: this.issueTitle,
      isActive: this.isActive(),
      currentStep: this.currentStep,
      stepCount: this.stepCount,
      history: [...this.history],
      fixApplied: this.fixApplied,
      testsRun: this.testsRun,
      prCreated: this.prCreated,
    };
  }

  toTourDocument(): TourDocument {
    const nodes: Record<string, TourNode> = {};
    const steps = this.history
      .filter((t) => t.role === "investigator" && t.step)
      .map((t) => t.step!);

    let prevNodeId: string | null = null;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      if (step.phase === "recap" || step.phase === "ship") continue;

      const nodeId = `step-${i + 1}`;
      nodes[nodeId] = {
        file: step.file ?? "",
        startLine: step.startLine ?? 1,
        endLine: step.endLine ?? 1,
        title: step.title ?? `Step ${i + 1}`,
        explanation: step.content,
        edges: [],
        kind: INVESTIGATION_PHASE_KIND[step.phase],
        suggestedEdit: step.suggestedEdit
          ? { oldText: step.suggestedEdit.oldText, newText: step.suggestedEdit.newText }
          : undefined,
      };

      if (prevNodeId && nodes[prevNodeId]) {
        nodes[prevNodeId].edges.push({
          target: nodeId,
          label: step.phase === "diagnose" ? "What's wrong" : step.phase === "propose" ? "The fix" : "Continue",
        });
      }
      prevNodeId = nodeId;
    }

    const nodeIds = Object.keys(nodes);
    return {
      version: 1,
      id: `investigate-${slugify(this.issueTitle)}`,
      name: `Investigation: ${this.issueTitle}`,
      query: this.issueTitle,
      generatedAt: new Date().toISOString(),
      trackedFiles: [],
      entryNode: nodeIds[0] ?? "step-1",
      nodes,
    };
  }

  private buildTurnPrompt(
    userInput: { text?: string; type: "response" | "confirm" | "runTests" | "requestFix" | "applyFix" | "createPR" }
  ): string {
    const turnPrompt = buildInvestigationTurnPrompt(this.history, userInput);
    return `${this.systemPrompt}\n\n${turnPrompt}`;
  }

  private async generateStep(
    prompt: string,
    progress: GenerationProgress
  ): Promise<InvestigationStep> {
    const step = await this.adapter.generateInvestigationStep(prompt, progress);
    this.currentStep = step;
    this.stepCount++;
    this.history.push({ role: "investigator", step });
    return step;
  }
}

