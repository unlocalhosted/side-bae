import type { TourDocument, TourEdge, TourNode } from "../types/tour.js";

export interface BreadcrumbEntry {
  id: string;
  title: string;
}

export type EdgeVisitState = "new" | "partial" | "complete";

export interface EdgeInfo {
  state: EdgeVisitState;
  /** How many nodes are reachable from this edge target (including itself) */
  reachableCount: number;
}

export interface TourSummary {
  name: string;
  query: string;
  totalNodes: number;
  totalFiles: number;
  fileList: string[];
}

export interface TourCardState {
  node: TourNode;
  breadcrumb: BreadcrumbEntry[];
  canGoBack: boolean;
  canGoForward: boolean;
  totalNodes: number;
  visitedCount: number;
  /** Per-edge info: visit state + reachable depth */
  edgeInfo: Record<string, EdgeInfo>;
  /** The edge label that was followed to arrive at this node (null for entry) */
  arrivedVia: string | null;
  /** Tour summary — shown once at the start */
  summary: TourSummary | null;
  isNewTour: boolean;
}

export class TourEngine {
  private tour: TourDocument | null = null;
  private currentNodeId: string | null = null;
  private history: string[] = [];
  private historyIndex = -1;
  private visitedNodes = new Set<string>();
  private newTourFlag = false;
  private lastEdgeLabel: string | null = null;

  /**
   * Load a tour and navigate to its entry node.
   * Throws if the entry node doesn't exist in the nodes map.
   */
  load(tour: TourDocument): TourNode {
    const entryNode = tour.nodes[tour.entryNode];
    if (!entryNode) {
      throw new Error(
        `Tour entry node '${tour.entryNode}' does not exist in nodes`
      );
    }

    this.tour = tour;
    this.currentNodeId = null;
    this.history = [];
    this.historyIndex = -1;
    this.visitedNodes.clear();
    this.newTourFlag = true;
    this.lastEdgeLabel = null;

    // Navigate to entry immediately — a loaded engine always has a current node
    return this.navigateToNode(tour.entryNode)!;
  }

  isLoaded(): boolean {
    return this.tour !== null;
  }

  getTour(): TourDocument | null {
    return this.tour;
  }

  getCurrentNodeId(): string | null {
    return this.currentNodeId;
  }

  getCurrentNode(): TourNode | null {
    if (!this.tour || !this.currentNodeId) return null;
    return this.tour.nodes[this.currentNodeId] ?? null;
  }

  getBreadcrumb(): BreadcrumbEntry[] {
    if (!this.tour) return [];
    return this.history.slice(0, this.historyIndex + 1).map((id) => ({
      id,
      title: this.tour!.nodes[id]?.title ?? id,
    }));
  }

  navigateToNode(nodeId: string): TourNode | null {
    if (!this.tour) return null;
    const node = this.tour.nodes[nodeId];
    if (!node) return null;

    // Record the edge label that brought us here (from the previous node)
    const prevNode = this.getCurrentNode();
    if (prevNode) {
      const edge = prevNode.edges.find((e) => e.target === nodeId);
      this.lastEdgeLabel = edge?.label ?? null;
    } else {
      this.lastEdgeLabel = null;
    }

    this.currentNodeId = nodeId;
    this.visitedNodes.add(nodeId);

    // Truncate forward history and push new entry
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(nodeId);
    this.historyIndex = this.history.length - 1;

    return node;
  }

  navigateBack(): TourNode | null {
    if (!this.tour || this.historyIndex <= 0) return null;
    this.historyIndex--;
    this.currentNodeId = this.history[this.historyIndex]!;
    return this.tour.nodes[this.currentNodeId] ?? null;
  }

  navigateForward(): TourNode | null {
    if (!this.tour || this.historyIndex >= this.history.length - 1) return null;
    this.historyIndex++;
    this.currentNodeId = this.history[this.historyIndex]!;
    return this.tour.nodes[this.currentNodeId] ?? null;
  }

  canGoBack(): boolean {
    return this.historyIndex > 0;
  }

  canGoForward(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  getAvailableEdges(): TourEdge[] {
    const node = this.getCurrentNode();
    if (!node) return [];
    return node.edges;
  }

  /** Count how many nodes are reachable from a given node (including itself). */
  private countReachable(nodeId: string, seen = new Set<string>()): number {
    if (!this.tour || seen.has(nodeId)) return 0;
    seen.add(nodeId);
    const node = this.tour.nodes[nodeId];
    if (!node) return 0;
    let count = 1;
    for (const edge of node.edges) {
      count += this.countReachable(edge.target, seen);
    }
    return count;
  }

  /**
   * Check if a node and all its reachable descendants have been visited.
   * Returns "new" (not visited), "partial" (visited but has unvisited descendants),
   * or "complete" (visited and all descendants visited).
   */
  private getNodeVisitState(nodeId: string, seen = new Set<string>()): EdgeVisitState {
    if (!this.tour || seen.has(nodeId)) return "new";
    seen.add(nodeId);

    if (!this.visitedNodes.has(nodeId)) return "new";

    const node = this.tour.nodes[nodeId];
    if (!node || node.edges.length === 0) return "complete"; // leaf, visited = done

    // Check all children
    const childStates = node.edges.map((e) =>
      this.getNodeVisitState(e.target, seen)
    );

    if (childStates.every((s) => s === "complete")) return "complete";
    return "partial";
  }

  /** Build the complete card state for the webview. */
  getCardState(): TourCardState {
    const node = this.getCurrentNode();
    if (!node || !this.tour) {
      throw new Error("Cannot get card state: no tour loaded or no current node");
    }

    const nodeIds = Object.keys(this.tour.nodes);
    const breadcrumb = this.getBreadcrumb();

    // Per-edge info: visit state + reachable depth
    const edgeInfo: Record<string, EdgeInfo> = {};
    for (const edge of node.edges) {
      edgeInfo[edge.target] = {
        state: this.getNodeVisitState(edge.target),
        reachableCount: this.countReachable(edge.target),
      };
    }

    // Tour summary — only provided on first card after load
    let summary: TourSummary | null = null;
    if (this.newTourFlag) {
      const files = new Set<string>();
      for (const n of Object.values(this.tour.nodes)) {
        files.add(n.file);
      }
      summary = {
        name: this.tour.name,
        query: this.tour.query,
        totalNodes: nodeIds.length,
        totalFiles: files.size,
        fileList: [...files],
      };
    }

    const state: TourCardState = {
      node,
      breadcrumb,
      canGoBack: this.canGoBack(),
      canGoForward: this.canGoForward(),
      totalNodes: nodeIds.length,
      visitedCount: this.visitedNodes.size,
      edgeInfo,
      arrivedVia: this.lastEdgeLabel,
      summary,
      isNewTour: this.newTourFlag,
    };

    this.newTourFlag = false;

    return state;
  }

  reset(): void {
    this.tour = null;
    this.currentNodeId = null;
    this.history = [];
    this.historyIndex = -1;
    this.visitedNodes.clear();
    this.newTourFlag = false;
    this.lastEdgeLabel = null;
  }
}
