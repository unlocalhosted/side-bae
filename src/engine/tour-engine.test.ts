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

  it("load() returns the entry node and sets it as current", () => {
    const node = engine.load(MOCK_TOUR);
    expect(node.title).toBe("Entry Point");
    expect(engine.isLoaded()).toBe(true);
    expect(engine.getCurrentNodeId()).toBe("node-a");
  });

  it("load() throws when entry node does not exist", () => {
    const bad = { ...MOCK_TOUR, entryNode: "nonexistent" };
    expect(() => engine.load(bad)).toThrow("does not exist");
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
    engine.navigateToNode("node-b");
    engine.navigateToNode("node-c");

    const node = engine.navigateBack();
    expect(node!.title).toBe("Function B");
    expect(engine.getCurrentNodeId()).toBe("node-b");
  });

  it("navigates forward after going back", () => {
    engine.load(MOCK_TOUR);
    engine.navigateToNode("node-b");
    engine.navigateBack();

    const node = engine.navigateForward();
    expect(node!.title).toBe("Function B");
    expect(engine.getCurrentNodeId()).toBe("node-b");
  });

  it("cannot go back at start", () => {
    engine.load(MOCK_TOUR);
    expect(engine.canGoBack()).toBe(false);
    expect(engine.navigateBack()).toBeNull();
  });

  it("cannot go forward at end", () => {
    engine.load(MOCK_TOUR);
    expect(engine.canGoForward()).toBe(false);
    expect(engine.navigateForward()).toBeNull();
  });

  it("truncates forward history on new navigation", () => {
    engine.load(MOCK_TOUR);
    engine.navigateToNode("node-b");
    engine.navigateBack();
    engine.navigateToNode("node-c");
    expect(engine.canGoForward()).toBe(false);
    expect(engine.getBreadcrumb()).toEqual([
      { id: "node-a", title: "Entry Point" },
      { id: "node-c", title: "Function C" },
    ]);
  });

  it("returns available edges for current node", () => {
    engine.load(MOCK_TOUR);
    const edges = engine.getAvailableEdges();
    expect(edges).toHaveLength(2);
    expect(edges[0]!.target).toBe("node-b");
    expect(edges[1]!.target).toBe("node-c");
  });

  it("returns empty edges for leaf node", () => {
    engine.load(MOCK_TOUR);
    engine.navigateToNode("node-c");
    expect(engine.getAvailableEdges()).toEqual([]);
  });

  it("resets fully", () => {
    engine.load(MOCK_TOUR);
    engine.navigateToNode("node-b");
    engine.reset();

    expect(engine.isLoaded()).toBe(false);
    expect(engine.getCurrentNode()).toBeNull();
    expect(engine.getBreadcrumb()).toEqual([]);
  });

  describe("getCardState", () => {
    it("returns complete state for current node", () => {
      engine.load(MOCK_TOUR);
      const state = engine.getCardState();

      expect(state.node.title).toBe("Entry Point");
      expect(state.totalNodes).toBe(3);
      expect(state.visitedCount).toBe(1);
      expect(state.canGoBack).toBe(false);
      expect(state.canGoForward).toBe(false);
      expect(state.breadcrumb).toHaveLength(1);
    });

    it("isNewTour is true only on first getCardState after load", () => {
      engine.load(MOCK_TOUR);
      const first = engine.getCardState();
      expect(first.isNewTour).toBe(true);
      expect(first.summary).not.toBeNull();
      expect(first.summary!.totalNodes).toBe(3);
      expect(first.summary!.totalFiles).toBe(2);
      expect(engine.getCardState().isNewTour).toBe(false);
      expect(engine.getCardState().summary).toBeNull();
    });

    it("tracks visited nodes across navigation", () => {
      engine.load(MOCK_TOUR);
      engine.getCardState(); // consume newTour flag
      engine.navigateToNode("node-b");
      const state = engine.getCardState();
      expect(state.visitedCount).toBe(2);
    });

    it("tracks arrivedVia edge label", () => {
      engine.load(MOCK_TOUR);
      expect(engine.getCardState().arrivedVia).toBeNull(); // entry has no edge
      engine.navigateToNode("node-b");
      expect(engine.getCardState().arrivedVia).toBe("calls B");
    });

    it("throws when no tour is loaded", () => {
      expect(() => engine.getCardState()).toThrow();
    });

    it("edgeInfo shows 'new' for unvisited targets with reachable count", () => {
      engine.load(MOCK_TOUR);
      const state = engine.getCardState();
      expect(state.edgeInfo["node-b"]!.state).toBe("new");
      expect(state.edgeInfo["node-b"]!.reachableCount).toBe(2); // node-b + node-c
      expect(state.edgeInfo["node-c"]!.state).toBe("new");
      expect(state.edgeInfo["node-c"]!.reachableCount).toBe(1); // just node-c
    });

    it("edgeInfo shows 'complete' for visited leaf", () => {
      engine.load(MOCK_TOUR);
      engine.navigateToNode("node-c");
      engine.navigateToNode("node-a");
      const state = engine.getCardState();
      expect(state.edgeInfo["node-c"]!.state).toBe("complete");
    });

    it("edgeInfo shows 'partial' for visited node with unvisited children", () => {
      engine.load(MOCK_TOUR);
      engine.navigateToNode("node-b"); // visited, but node-b -> node-c is unvisited
      engine.navigateToNode("node-a"); // go back
      const state = engine.getCardState();
      expect(state.edgeInfo["node-b"]!.state).toBe("partial");
    });
  });
});
