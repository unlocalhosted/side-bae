import type { LessonLayer, LessonDepth } from "./lesson.js";

export interface TourEdge {
  target: string;
  label: string;
}

export interface SuggestedEdit {
  oldText: string;
  newText: string;
}

export interface ConceptTag {
  name: string;
  category: string;
}

export interface TourNode {
  file: string;
  startLine: number;
  endLine: number;
  title: string;
  explanation: string;
  edges: TourEdge[];
  kind?: "context" | "problem" | "solution";
  suggestedEdit?: SuggestedEdit;
  /** Lesson layer — used in lesson replay tours */
  layer?: LessonLayer;
  /** Named patterns/concepts taught in this node */
  concepts?: ConceptTag[];
  /** Key takeaway sentence */
  takeaway?: string;
}

export interface TrackedFile {
  path: string;
  lastCommit: string;
}

export interface LessonMeta {
  subject: string;
  depth: LessonDepth;
  concepts: string[];
  synopsis: string;
}

export interface TourDocument {
  version: 1;
  id: string;
  name: string;
  query: string;
  generatedAt: string;
  trackedFiles: TrackedFile[];
  entryNode: string;
  nodes: Record<string, TourNode>;
  report?: string;
  /** Lesson metadata — present when this tour is a saved lesson replay */
  lesson?: LessonMeta;
}

export class TourValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: string[]
  ) {
    super(message);
    this.name = "TourValidationError";
  }
}

export function validateTourDocument(data: unknown): TourDocument {
  const issues: string[] = [];
  const d = data as Record<string, unknown>;

  if (!d || typeof d !== "object") {
    throw new TourValidationError("Tour data is not an object", [
      "expected object",
    ]);
  }

  if (typeof d.id !== "string" || d.id.length === 0)
    issues.push("missing or empty 'id'");
  if (typeof d.name !== "string" || d.name.length === 0)
    issues.push("missing or empty 'name'");
  if (typeof d.query !== "string") issues.push("missing 'query'");
  if (typeof d.entryNode !== "string" || d.entryNode.length === 0)
    issues.push("missing or empty 'entryNode'");

  if (!d.nodes || typeof d.nodes !== "object") {
    issues.push("missing 'nodes' map");
  } else {
    const nodes = d.nodes as Record<string, unknown>;
    const nodeIds = new Set(Object.keys(nodes));

    if (nodeIds.size === 0) {
      issues.push("tour has no nodes");
    }

    if (
      typeof d.entryNode === "string" &&
      d.entryNode.length > 0 &&
      !nodeIds.has(d.entryNode)
    ) {
      issues.push(
        `entryNode '${d.entryNode}' does not exist in nodes`
      );
    }

    for (const [id, raw] of Object.entries(nodes)) {
      const node = raw as Record<string, unknown>;
      if (typeof node.file !== "string" || node.file.length === 0)
        issues.push(`node '${id}': missing file`);
      if (typeof node.startLine !== "number" || node.startLine < 1)
        issues.push(`node '${id}': invalid startLine`);
      if (typeof node.endLine !== "number" || node.endLine < 1)
        issues.push(`node '${id}': invalid endLine`);
      if (typeof node.title !== "string" || node.title.length === 0)
        issues.push(`node '${id}': missing title`);
      if (typeof node.explanation !== "string")
        issues.push(`node '${id}': missing explanation`);

      if (Array.isArray(node.edges)) {
        // Strip edges pointing to non-existent nodes instead of failing
        node.edges = (node.edges as Array<Record<string, unknown>>).filter(
          (edge) => typeof edge.target === "string" && nodeIds.has(edge.target)
        );
      } else {
        issues.push(`node '${id}': missing edges array`);
      }
    }
  }

  if (issues.length > 0) {
    throw new TourValidationError(
      `Invalid tour: ${issues[0]}${issues.length > 1 ? ` (+${issues.length - 1} more)` : ""}`,
      issues
    );
  }

  // Normalize: ensure version and optional fields
  const tour = data as TourDocument;
  const result: TourDocument = {
    version: 1,
    id: tour.id,
    name: tour.name,
    query: tour.query ?? "",
    generatedAt: tour.generatedAt ?? new Date().toISOString(),
    trackedFiles: Array.isArray(tour.trackedFiles) ? tour.trackedFiles : [],
    entryNode: tour.entryNode,
    nodes: tour.nodes,
    report: tour.report,
    lesson: tour.lesson,
  };

  // Step 1: Walk reachability on the ORIGINAL edges (before cycle stripping)
  // to determine which nodes are part of the tour at all.
  const reachable = new Set<string>();
  function walkReachable(nodeId: string) {
    if (reachable.has(nodeId)) return;
    reachable.add(nodeId);
    const node = result.nodes[nodeId];
    if (!node) return;
    for (const edge of node.edges) {
      walkReachable(edge.target);
    }
  }
  walkReachable(result.entryNode);

  // Step 2: Remove orphan nodes unreachable from entryNode
  for (const nodeId of Object.keys(result.nodes)) {
    if (!reachable.has(nodeId)) {
      delete result.nodes[nodeId];
    }
  }

  // Step 3: Enforce DAG within the reachable subgraph — strip back-edges
  const ancestors = new Set<string>();
  function stripCycles(nodeId: string) {
    if (ancestors.has(nodeId)) return;
    ancestors.add(nodeId);
    const node = result.nodes[nodeId];
    if (!node) return;
    node.edges = node.edges.filter((e) => !ancestors.has(e.target));
    for (const edge of node.edges) {
      stripCycles(edge.target);
    }
    ancestors.delete(nodeId); // allow visiting from different branches
  }
  stripCycles(result.entryNode);

  return result;
}
