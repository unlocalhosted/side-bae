import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { saveTour, loadTour, listTours, saveAnnotation, saveAtlas, loadAtlas, ingestCodeTourFile } from "./tour-store.js";
import { validateTourDocument, type TourDocument } from "../types/tour.js";
import type { SystemAtlas } from "../types/atlas.js";

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

// ── trackedFiles derivation ──

describe("trackedFiles derivation", () => {
  it("derives trackedFiles from reachable node files when omitted", () => {
    const tour = validateTourDocument({
      id: "t",
      name: "T",
      query: "q",
      entryNode: "a",
      trackedFiles: [],
      nodes: {
        a: { file: "src/a.ts", startLine: 1, endLine: 2, title: "A", explanation: "x", edges: [{ target: "b", label: "to b" }] },
        b: { file: "src/b.ts", startLine: 1, endLine: 2, title: "B", explanation: "y", edges: [] },
      },
    });
    expect(tour.trackedFiles).toEqual([
      { path: "src/a.ts", lastCommit: "" },
      { path: "src/b.ts", lastCommit: "" },
    ]);
  });

  it("keeps author-provided trackedFiles untouched", () => {
    const tour = validateTourDocument({
      id: "t",
      name: "T",
      query: "q",
      entryNode: "a",
      trackedFiles: [{ path: "custom.ts", lastCommit: "abc123" }],
      nodes: {
        a: { file: "src/a.ts", startLine: 1, endLine: 2, title: "A", explanation: "x", edges: [] },
      },
    });
    expect(tour.trackedFiles).toEqual([{ path: "custom.ts", lastCommit: "abc123" }]);
  });
});

// ── CodeTour ingestion ──

const MOCK_CODETOUR = {
  $schema: "https://aka.ms/codetour-schema",
  title: "Bots As Session Clients",
  description: "How the Slack bot is a thin client.",
  steps: [
    { file: "src/index.ts", line: 55, title: "Create", description: "It creates a session." },
    { file: "src/index.ts", line: 127, title: "Prompt", description: "It sends a prompt." },
  ],
};

describe("CodeTour ingestion", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "side-bae-codetour-test-"));
    await mkdir(join(tempDir, ".side-bae"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("transcodes a raw .tour file and persists it as native .tour.json", async () => {
    await writeFile(
      join(tempDir, ".side-bae", "bots-as-session-clients.tour"),
      JSON.stringify(MOCK_CODETOUR),
      "utf-8"
    );

    const tour = await ingestCodeTourFile(tempDir, "bots-as-session-clients.tour");
    expect(tour.id).toBe("bots-as-session-clients");
    expect(tour.entryNode).toBe("step-1");
    expect(Object.keys(tour.nodes)).toHaveLength(2);

    // The converted tour is now a first-class native tour on disk.
    const reloaded = await loadTour(tempDir, "bots-as-session-clients");
    expect(reloaded).toEqual(tour);
  });

  it("loadTour transparently converts CodeTour content stored in a .tour.json", async () => {
    await writeFile(
      join(tempDir, ".side-bae", "legacy.tour.json"),
      JSON.stringify(MOCK_CODETOUR),
      "utf-8"
    );

    const loaded = await loadTour(tempDir, "legacy");
    expect(loaded.entryNode).toBe("step-1");
    expect(loaded.nodes["step-1"].file).toBe("src/index.ts");
    expect(loaded.nodes["step-1"].edges).toEqual([{ target: "step-2", label: "next" }]);
  });
});

// ── System Atlas ──

const MOCK_ATLAS: SystemAtlas = {
  version: 1,
  id: "atlas",
  generatedAt: "2026-04-07T00:00:00Z",
  projectName: "Test Project",
  summary: "A test project for unit tests.",
  techStack: ["TypeScript", "Vitest"],
  layers: [
    { id: "core", name: "Core", description: "Core logic", keyFiles: ["src/core.ts"] },
    { id: "api", name: "API", description: "REST endpoints", keyFiles: ["src/api.ts"] },
  ],
  connections: [
    { from: "api", to: "core", label: "calls business logic" },
  ],
  flows: [
    {
      id: "create-item",
      name: "Create Item",
      trigger: "User submits form",
      steps: [
        { summary: "API receives request", explanation: "The handler validates input.", file: "src/api.ts", startLine: 10, endLine: 20, layerId: "api" },
        { summary: "Core creates record", explanation: "Business logic runs.", file: "src/core.ts", startLine: 5, endLine: 15, layerId: "core" },
      ],
    },
  ],
  suggestions: [
    { type: "tour", label: "Explore the API layer", query: "how does the API work?" },
  ],
};

describe("Atlas Store", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "side-bae-atlas-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("saves and loads an atlas", async () => {
    await saveAtlas(tempDir, MOCK_ATLAS);
    const loaded = await loadAtlas(tempDir);
    expect(loaded).toEqual(MOCK_ATLAS);
  });

  it("returns null when no atlas exists", async () => {
    const loaded = await loadAtlas(tempDir);
    expect(loaded).toBeNull();
  });

  it("handles atlas without optional fields", async () => {
    const minimal: SystemAtlas = {
      ...MOCK_ATLAS,
      suggestions: [],
    };
    await saveAtlas(tempDir, minimal);
    const loaded = await loadAtlas(tempDir);
    expect(loaded?.suggestions).toEqual([]);
  });
});
