import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { saveTour, loadTour, listTours, saveAnnotation } from "./tour-store.js";
import type { TourDocument } from "../types/tour.js";

const MOCK_TOUR: TourDocument = {
  version: 1,
  id: "auth-flow",
  name: "Authentication Flow",
  query: "how does auth work?",
  generatedAt: "2026-01-01T00:00:00Z",
  trackedFiles: [{ path: "src/auth.ts", lastCommit: "abc123" }],
  entryNode: "entry",
  nodes: {
    entry: {
      file: "src/auth.ts",
      startLine: 1,
      endLine: 10,
      title: "Auth Entry",
      explanation: "Entry point for auth.",
      edges: [],
    },
  },
};

describe("TourStore", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "side-bae-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("saves and loads a tour", async () => {
    await saveTour(tempDir, MOCK_TOUR);
    const loaded = await loadTour(tempDir, "auth-flow");
    expect(loaded).toEqual(MOCK_TOUR);
  });

  it("creates .side-bae directory if missing", async () => {
    const path = await saveTour(tempDir, MOCK_TOUR);
    expect(path).toContain(".side-bae");
    expect(path).toContain("auth-flow.tour.json");
  });

  it("lists saved tours", async () => {
    await saveTour(tempDir, MOCK_TOUR);
    await saveTour(tempDir, { ...MOCK_TOUR, id: "payment-flow", name: "Payments", query: "how do payments work?" });

    const tours = await listTours(tempDir);
    expect(tours).toHaveLength(2);
    expect(tours.map((t) => t.id).sort()).toEqual(["auth-flow", "payment-flow"]);
  });

  it("returns empty list when no tours exist", async () => {
    const tours = await listTours(tempDir);
    expect(tours).toEqual([]);
  });

  it("throws when loading nonexistent tour", async () => {
    await expect(loadTour(tempDir, "nonexistent")).rejects.toThrow();
  });

  // ── Annotation persistence ──

  it("round-trips tour with annotations", async () => {
    const tourWithAnnotations: TourDocument = {
      ...MOCK_TOUR,
      annotations: {
        entry: [
          { selectedText: "auth", question: "What is auth?", answer: "Authentication validates user identity." },
        ],
      },
    };
    await saveTour(tempDir, tourWithAnnotations);
    const loaded = await loadTour(tempDir, "auth-flow");
    expect(loaded.annotations).toEqual(tourWithAnnotations.annotations);
  });

  it("loads old tour without annotations gracefully", async () => {
    await saveTour(tempDir, MOCK_TOUR);
    const loaded = await loadTour(tempDir, "auth-flow");
    expect(loaded.annotations).toBeUndefined();
  });

  it("appends annotation incrementally via saveAnnotation", async () => {
    await saveTour(tempDir, MOCK_TOUR);
    await saveAnnotation(tempDir, "auth-flow", "entry", {
      selectedText: "Entry point",
      question: "What is the entry point?",
      answer: "Where the auth flow begins.",
    });
    const loaded = await loadTour(tempDir, "auth-flow");
    expect(loaded.annotations?.entry).toHaveLength(1);
    expect(loaded.annotations?.entry[0].selectedText).toBe("Entry point");

    // Append a second annotation to the same node
    await saveAnnotation(tempDir, "auth-flow", "entry", {
      selectedText: "auth.ts",
      question: "What does auth.ts do?",
      answer: "Handles authentication logic.",
    });
    const loaded2 = await loadTour(tempDir, "auth-flow");
    expect(loaded2.annotations?.entry).toHaveLength(2);
  });
});
