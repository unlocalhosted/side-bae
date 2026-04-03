import type { LessonDepth, LessonPlanStep, StepContent } from "./lesson.js";

// ── Full Lesson (pre-generated, all content inline — no AI needed at playback) ──

export interface FullLessonStep {
  plan: LessonPlanStep;
  content: StepContent;
}

export interface FullLesson {
  version: 1;
  id: string;
  subject: string;
  generatedAt: string;
  depth: LessonDepth;
  concepts: string[];
  synopsis: string;
  steps: FullLessonStep[];
}

export interface FullLessonSummary {
  id: string;
  subject: string;
  generatedAt: string;
  depth: LessonDepth;
  stepCount: number;
  concepts: string[];
}

export class FullLessonValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: string[]
  ) {
    super(message);
    this.name = "FullLessonValidationError";
  }
}

export function validateFullLesson(data: unknown): FullLesson {
  const issues: string[] = [];
  const d = data as Record<string, unknown>;

  if (!d || typeof d !== "object") {
    throw new FullLessonValidationError("Full lesson data is not an object", [
      "expected object",
    ]);
  }

  if (typeof d.id !== "string" || d.id.length === 0)
    issues.push("missing or empty 'id'");
  if (typeof d.subject !== "string" || d.subject.length === 0)
    issues.push("missing or empty 'subject'");
  if (typeof d.generatedAt !== "string")
    issues.push("missing 'generatedAt'");

  const validDepths = ["foundational", "intermediate", "advanced"];
  if (typeof d.depth !== "string" || !validDepths.includes(d.depth))
    issues.push("invalid 'depth' — must be foundational, intermediate, or advanced");
  if (!Array.isArray(d.concepts))
    issues.push("missing 'concepts' array");
  if (typeof d.synopsis !== "string")
    issues.push("missing 'synopsis'");

  if (!Array.isArray(d.steps)) {
    issues.push("missing 'steps' array");
  } else if (d.steps.length === 0) {
    issues.push("lesson has no steps");
  } else {
    for (let i = 0; i < d.steps.length; i++) {
      const step = d.steps[i] as Record<string, unknown>;
      const plan = step?.plan as Record<string, unknown> | undefined;
      const content = step?.content as Record<string, unknown> | undefined;

      if (!plan) {
        issues.push(`step ${i}: missing 'plan'`);
        continue;
      }
      if (typeof plan.id !== "string") issues.push(`step ${i}: missing plan.id`);
      if (typeof plan.file !== "string") issues.push(`step ${i}: missing plan.file`);
      if (typeof plan.startLine !== "number") issues.push(`step ${i}: missing plan.startLine`);
      if (typeof plan.endLine !== "number") issues.push(`step ${i}: missing plan.endLine`);
      if (typeof plan.title !== "string") issues.push(`step ${i}: missing plan.title`);

      if (!content) {
        issues.push(`step ${i}: missing 'content'`);
        continue;
      }
      if (typeof content.explanation !== "string")
        issues.push(`step ${i}: missing content.explanation`);
    }
  }

  if (issues.length > 0) {
    throw new FullLessonValidationError(
      `Invalid full lesson: ${issues[0]}${issues.length > 1 ? ` (+${issues.length - 1} more)` : ""}`,
      issues
    );
  }

  const lesson = data as FullLesson;
  return {
    version: 1,
    id: lesson.id,
    subject: lesson.subject,
    generatedAt: lesson.generatedAt ?? new Date().toISOString(),
    depth: lesson.depth,
    concepts: Array.isArray(lesson.concepts) ? lesson.concepts : [],
    synopsis: typeof lesson.synopsis === "string" ? lesson.synopsis : "",
    steps: lesson.steps,
  };
}
