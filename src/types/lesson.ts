export type LessonLayer = "outcome" | "architecture" | "rationale" | "insight" | "challenge";
export type LessonDepth = "foundational" | "intermediate" | "advanced";

export interface LessonStep {
  phase: "prime" | "teach" | "check" | "respond" | "transition" | "recap";
  file?: string;
  startLine?: number;
  endLine?: number;
  title?: string;
  content: string;
  prompt?: string;
  inputType?: "text" | "choice" | "none";
  options?: string[];
  correctIndex?: number;
  concepts?: string[];
  layer?: LessonLayer;
  awaitsResponse: boolean;
  skippable: boolean;
  isComplete: boolean;
  recapData?: LessonRecapData;
}

export interface LessonRecapData {
  conceptsSolid: string[];
  conceptsShaky: Array<{ name: string; suggestion: string }>;
  predictionsVsReality: Array<{ prediction: string; reality: string }>;
  totalSteps: number;
  checksCorrect: number;
  checksTotal: number;
}

export interface LessonTurn {
  role: "tutor" | "learner";
  step?: LessonStep;
  text?: string;
  choiceIndex?: number;
}

export interface CheckResult {
  concept: string;
  correct: boolean;
  userAnswer: string;
}

export interface LessonSessionState {
  subject: string;
  isActive: boolean;
  currentStep: LessonStep | null;
  stepCount: number;
  conceptsLearned: string[];
  checkResults: CheckResult[];
  history: LessonTurn[];
}

export interface LearnableConcept {
  name: string;
  description: string;
  depth: LessonDepth;
  concepts: string[];
  entryFile: string;
  icon?: string;
}
