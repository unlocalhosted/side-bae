import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { validateTourDocument, type TourDocument } from "../types/tour.js";

const TOUR_DIR = ".side-chick";

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

export interface TourSummary {
  id: string;
  name: string;
  query: string;
  generatedAt: string;
  nodeCount: number;
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
        } satisfies TourSummary;
      } catch {
        return null;
      }
    })
  );

  return results.filter((t): t is TourSummary => t !== null);
}
