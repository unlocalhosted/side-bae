export type LessonLayer = "outcome" | "architecture" | "rationale" | "insight" | "challenge";
export type LessonDepth = "foundational" | "intermediate" | "advanced";

// ── Lesson Plan (generated once, persisted) ──

export interface LessonPlan {
  id: string;
  subject: string;
  generatedAt: string;
  steps: LessonPlanStep[];
}

export interface LessonPlanStep {
  id: string;
  title: string;
  file: string;
  startLine: number;
  endLine: number;
  concepts: string[];
  layer?: LessonLayer;
}

// ── Step Content (generated per step, on demand) ──

export interface StepContent {
  explanation: string;
  prompt?: string;
  inputType?: "text" | "choice" | "none";
  options?: string[];
  correctIndex?: number;
  correctExplanation?: string;
  incorrectExplanation?: string;
  skipReason?: string;
}

// ── Step Response (inline reply to user's answer) ──

export interface StepResponse {
  content: string;
  correct?: boolean;
  summary: string;
}

// ── Step State (accumulated during lesson) ──

export type StepStatus = "upcoming" | "active" | "completed" | "skipped";

export interface LessonStepState {
  status: StepStatus;
  plan: LessonPlanStep;
  content?: StepContent;
  userAnswer?: string;
  userChoiceIndex?: number;
  response?: StepResponse;
  summary?: string;
}

// ── Session State (sent to webview) ──

export interface LessonSessionState {
  subject: string;
  planId: string;
  steps: LessonStepState[];
  activeStepIndex: number;
  isComplete: boolean;
}

// ── Shared types (unchanged) ──

export interface CheckResult {
  concept: string;
  correct: boolean;
  userAnswer: string;
}

export interface LearnableConcept {
  name: string;
  description: string;
  depth: LessonDepth;
  concepts: string[];
  entryFile: string;
  icon?: string;
}
