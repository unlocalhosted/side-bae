import type { TourDocument, TourEdge, TourNode } from "../types/tour.js";

export interface BreadcrumbEntry {
  id: string;
  title: string;
}

export class TourEngine {
  private tour: TourDocument | null = null;
  private currentNodeId: string | null = null;
  private history: string[] = [];
  private historyIndex = -1;

  load(tour: TourDocument): void {
    this.tour = tour;
    this.currentNodeId = null;
    this.history = [];
    this.historyIndex = -1;
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

  navigateToEntry(): TourNode | null {
    if (!this.tour) return null;
    return this.navigateToNode(this.tour.entryNode);
  }

  navigateToNode(nodeId: string): TourNode | null {
    if (!this.tour) return null;
    const node = this.tour.nodes[nodeId];
    if (!node) return null;

    this.currentNodeId = nodeId;

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

  reset(): void {
    this.tour = null;
    this.currentNodeId = null;
    this.history = [];
    this.historyIndex = -1;
  }
}
