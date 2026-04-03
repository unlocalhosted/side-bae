import { readdir, readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { validateTourDocument, type TourDocument } from "../types/tour.js";
import type { FeatureTreeNode } from "../types/feature-tree.js";
import type { RecentChange } from "../types/recent-changes.js";
import type { LearnableConcept, LessonPlan, LessonStepState } from "../types/lesson.js";
import { validateFullLesson, type FullLesson, type FullLessonSummary } from "../types/full-lesson.js";

const TOUR_DIR = ".side-bae";
const FEATURES_FILE = "features.json";
const LEARNABLE_FILE = "learnable-concepts.json";
const WHATS_NEW_FILE = "whats-new.json";
const FULL_LESSON_SUFFIX = ".full-lesson.json";

function getTourDir(workspaceRoot: string): string {
  return join(workspaceRoot, TOUR_DIR);
}

function getTourPath(workspaceRoot: string, tourId: string): string {
  return join(getTourDir(workspaceRoot), `${tourId}.tour.json`);
}

export async function saveTour(
  workspaceRoot: string,
  tour: TourDocument
): Promise<string> {
  const dir = getTourDir(workspaceRoot);
  await mkdir(dir, { recursive: true });
  const filePath = getTourPath(workspaceRoot, tour.id);
  await writeFile(filePath, JSON.stringify(tour, null, 2), "utf-8");
  return filePath;
}

export async function loadTour(
  workspaceRoot: string,
  tourId: string
): Promise<TourDocument> {
  const filePath = getTourPath(workspaceRoot, tourId);
  const content = await readFile(filePath, "utf-8");
  return validateTourDocument(JSON.parse(content));
}

export async function deleteTour(
  workspaceRoot: string,
  tourId: string
): Promise<void> {
  const filePath = getTourPath(workspaceRoot, tourId);
  await unlink(filePath);
}

export interface TourSummary {
  id: string;
  name: string;
  query: string;
  generatedAt: string;
  nodeCount: number;
  isLesson?: boolean;
  lessonDepth?: string;
}

export async function listTours(
  workspaceRoot: string
): Promise<TourSummary[]> {
  const dir = getTourDir(workspaceRoot);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const tourFiles = entries.filter((e) => e.endsWith(".tour.json"));
  const results = await Promise.all(
    tourFiles.map(async (entry) => {
      try {
        const content = await readFile(join(dir, entry), "utf-8");
        const tour = JSON.parse(content) as TourDocument;
        return {
          id: tour.id,
          name: tour.name,
          query: tour.query,
          generatedAt: tour.generatedAt,
          nodeCount: tour.nodes ? Object.keys(tour.nodes).length : 0,
          isLesson: tour.lesson ? true : undefined,
          lessonDepth: tour.lesson?.depth,
        } as TourSummary;
      } catch {
        return null;
      }
    })
  );

  return results.filter((t): t is TourSummary => t !== null);
}

export async function saveFeatures(
  workspaceRoot: string,
  features: FeatureTreeNode[]
): Promise<void> {
  const dir = getTourDir(workspaceRoot);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, FEATURES_FILE),
    JSON.stringify(features, null, 2),
    "utf-8"
  );
}

export async function loadFeatures(
  workspaceRoot: string
): Promise<FeatureTreeNode[] | null> {
  try {
    const content = await readFile(
      join(getTourDir(workspaceRoot), FEATURES_FILE),
      "utf-8"
    );
    const data = JSON.parse(content);
    if (Array.isArray(data) && data.length > 0) return data;
    return null;
  } catch {
    return null;
  }
}

export async function saveLearnableConcepts(
  workspaceRoot: string,
  concepts: LearnableConcept[]
): Promise<void> {
  const dir = getTourDir(workspaceRoot);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, LEARNABLE_FILE),
    JSON.stringify(concepts, null, 2),
    "utf-8"
  );
}

export async function loadLearnableConcepts(
  workspaceRoot: string
): Promise<LearnableConcept[] | null> {
  try {
    const content = await readFile(
      join(getTourDir(workspaceRoot), LEARNABLE_FILE),
      "utf-8"
    );
    const data = JSON.parse(content);
    if (Array.isArray(data) && data.length > 0) return data;
    return null;
  } catch {
    return null;
  }
}

export async function saveLessonState(
  workspaceRoot: string,
  plan: LessonPlan,
  stepStates: LessonStepState[]
): Promise<void> {
  const dir = getTourDir(workspaceRoot);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `${plan.id}.lesson.json`),
    JSON.stringify({ plan, stepStates }, null, 2),
    "utf-8"
  );
}

export async function loadLessonState(
  workspaceRoot: string,
  planId: string
): Promise<{ plan: LessonPlan; stepStates: LessonStepState[] } | null> {
  try {
    const content = await readFile(
      join(getTourDir(workspaceRoot), `${planId}.lesson.json`),
      "utf-8"
    );
    const data = JSON.parse(content);
    if (data?.plan && Array.isArray(data.stepStates)) return data;
    return null;
  } catch {
    return null;
  }
}

// ── Full Lessons (pre-generated, offline playback) ──

export async function loadFullLesson(
  workspaceRoot: string,
  id: string
): Promise<FullLesson> {
  const filePath = join(getTourDir(workspaceRoot), `${id}${FULL_LESSON_SUFFIX}`);
  const content = await readFile(filePath, "utf-8");
  return validateFullLesson(JSON.parse(content));
}

export async function listFullLessons(
  workspaceRoot: string
): Promise<FullLessonSummary[]> {
  const dir = getTourDir(workspaceRoot);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const lessonFiles = entries.filter((e) => e.endsWith(FULL_LESSON_SUFFIX));
  const results = await Promise.all(
    lessonFiles.map(async (entry) => {
      try {
        const content = await readFile(join(dir, entry), "utf-8");
        const data = JSON.parse(content);
        return {
          id: data.id,
          subject: data.subject,
          generatedAt: data.generatedAt,
          depth: data.depth,
          stepCount: Array.isArray(data.steps) ? data.steps.length : 0,
          concepts: Array.isArray(data.concepts) ? data.concepts : [],
        } as FullLessonSummary;
      } catch {
        return null;
      }
    })
  );

  return results.filter((s): s is FullLessonSummary => s !== null);
}

// ── What's New (persisted for skill-file compatibility) ──

export async function saveWhatsNew(
  workspaceRoot: string,
  changes: RecentChange[]
): Promise<void> {
  const dir = getTourDir(workspaceRoot);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, WHATS_NEW_FILE),
    JSON.stringify(changes, null, 2),
    "utf-8"
  );
}

export async function loadWhatsNew(
  workspaceRoot: string
): Promise<RecentChange[] | null> {
  try {
    const content = await readFile(
      join(getTourDir(workspaceRoot), WHATS_NEW_FILE),
      "utf-8"
    );
    const data = JSON.parse(content);
    if (Array.isArray(data) && data.length > 0) return data;
    return null;
  } catch {
    return null;
  }
}
