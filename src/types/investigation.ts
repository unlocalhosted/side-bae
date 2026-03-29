export type InvestigationPhase =
  | "orient" | "investigate" | "diagnose" | "propose"
  | "verify" | "revise" | "ship" | "recap";

export interface InvestigationStep {
  phase: InvestigationPhase;
  file?: string;
  startLine?: number;
  endLine?: number;
  title?: string;
  content: string;
  prompt?: string;
  inputType?: "text" | "confirm" | "none";

  suggestedEdit?: { oldText: string; newText: string; file: string };

  testResults?: {
    passed: number;
    failed: number;
    errors: string[];
  };

  prUrl?: string;
  prNumber?: number;
  branchName?: string;
  filesChanged?: number;
  additions?: number;
  deletions?: number;

  awaitsResponse: boolean;
  isComplete: boolean;

  trail?: Array<{ file: string; kind: "context" | "problem" | "fix" }>;
}

export interface InvestigationTurn {
  role: "investigator" | "user";
  step?: InvestigationStep;
  text?: string;
}

export interface InvestigationSessionState {
  issueTitle: string;
  isActive: boolean;
  currentStep: InvestigationStep | null;
  stepCount: number;
  history: InvestigationTurn[];
  fixApplied: boolean;
  testsRun: boolean;
  prCreated: boolean;
}
