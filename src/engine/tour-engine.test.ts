import { describe, expect, it, beforeEach } from "vitest";
import { TourEngine } from "./tour-engine.js";
import type { TourDocument } from "../types/tour.js";

const MOCK_TOUR: TourDocument = {
  version: 1,
  id: "test-tour",
  name: "Test Tour",
  query: "how does test work?",
  generatedAt: "2026-01-01T00:00:00Z",
  trackedFiles: [
    { path: "src/a.ts", lastCommit: "abc123" },
    { path: "src/b.ts", lastCommit: "def456" },
  ],
  entryNode: "node-a",
  nodes: {
    "node-a": {
      file: "src/a.ts",
      startLine: 1,
      endLine: 10,
      title: "Entry Point",
      explanation: "This is the entry point.",
      edges: [
        { target: "node-b", label: "calls B" },
        { target: "node-c", label: "calls C" },
      ],
    },
    "node-b": {
      file: "src/b.ts",
      startLine: 5,
      endLine: 15,
      title: "Function B",
      explanation: "This is function B.",
      edges: [{ target: "node-c", label: "calls C" }],
    },
    "node-c": {
      file: "src/a.ts",
      startLine: 20,
      endLine: 30,
      title: "Function C",
      explanation: "This is function C.",
      edges: [],
    },
  },
};

describe("TourEngine", () => {
  let engine: TourEngine;

  beforeEach(() => {
    engine = new TourEngine();
  });

  it("starts unloaded", () => {
    expect(engine.isLoaded()).toBe(false);
    expect(engine.getCurrentNode()).toBeNull();
    expect(engine.getBreadcrumb()).toEqual([]);
  });

  it("loads a tour", () => {
    engine.load(MOCK_TOUR);
    expect(engine.isLoaded()).toBe(true);
    expect(engine.getCurrentNode()).toBeNull();
  });

  it("navigates to entry node", () => {
    engine.load(MOCK_TOUR);
    const node = engine.navigateToEntry();
    expect(node).not.toBeNull();
    expect(node!.title).toBe("Entry Point");
    expect(engine.getCurrentNodeId()).toBe("node-a");
  });

  it("navigates to a specific node", () => {
    engine.load(MOCK_TOUR);
    const node = engine.navigateToNode("node-b");
    expect(node).not.toBeNull();
    expect(node!.title).toBe("Function B");
  });

  it("returns null for unknown node", () => {
    engine.load(MOCK_TOUR);
    expect(engine.navigateToNode("nonexistent")).toBeNull();
  });

  it("builds breadcrumb from navigation history", () => {
    engine.load(MOCK_TOUR);
    engine.navigateToEntry();
    engine.navigateToNode("node-b");
    engine.navigateToNode("node-c");

    const breadcrumb = engine.getBreadcrumb();
    expect(breadcrumb).toEqual([
      { id: "node-a", title: "Entry Point" },
      { id: "node-b", title: "Function B" },
      { id: "node-c", title: "Function C" },
    ]);
  });

  it("navigates back", () => {
    engine.load(MOCK_TOUR);
    engine.navigateToEntry();
    engine.navigateToNode("node-b");
    engine.navigateToNode("node-c");

    const node = engine.navigateBack();
    expect(node!.title).toBe("Function B");
    expect(engine.getCurrentNodeId()).toBe("node-b");
  });

  it("navigates forward after going back", () => {
    engine.load(MOCK_TOUR);
    engine.navigateToEntry();
    engine.navigateToNode("node-b");
    engine.navigateBack();

    const node = engine.navigateForward();
    expect(node!.title).toBe("Function B");
    expect(engine.getCurrentNodeId()).toBe("node-b");
  });

  it("cannot go back at start", () => {
    engine.load(MOCK_TOUR);
    engine.navigateToEntry();
    expect(engine.canGoBack()).toBe(false);
    expect(engine.navigateBack()).toBeNull();
  });

  it("cannot go forward at end", () => {
    engine.load(MOCK_TOUR);
    engine.navigateToEntry();
    expect(engine.canGoForward()).toBe(false);
    expect(engine.navigateForward()).toBeNull();
  });

  it("truncates forward history on new navigation", () => {
    engine.load(MOCK_TOUR);
    engine.navigateToEntry();
    engine.navigateToNode("node-b");
    engine.navigateBack();
    // Now at node-a, with node-b in forward history
    engine.navigateToNode("node-c");
    // Forward history (node-b) should be gone
    expect(engine.canGoForward()).toBe(false);
    expect(engine.getBreadcrumb()).toEqual([
      { id: "node-a", title: "Entry Point" },
      { id: "node-c", title: "Function C" },
    ]);
  });

  it("returns available edges for current node", () => {
    engine.load(MOCK_TOUR);
    engine.navigateToEntry();
    const edges = engine.getAvailableEdges();
    expect(edges).toHaveLength(2);
    expect(edges[0]!.target).toBe("node-b");
    expect(edges[1]!.target).toBe("node-c");
  });

  it("returns empty edges when no node is selected", () => {
    engine.load(MOCK_TOUR);
    expect(engine.getAvailableEdges()).toEqual([]);
  });

  it("resets fully", () => {
    engine.load(MOCK_TOUR);
    engine.navigateToEntry();
    engine.navigateToNode("node-b");
    engine.reset();

    expect(engine.isLoaded()).toBe(false);
    expect(engine.getCurrentNode()).toBeNull();
    expect(engine.getBreadcrumb()).toEqual([]);
  });
});
