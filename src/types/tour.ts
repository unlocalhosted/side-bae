export interface TourEdge {
  target: string;
  label: string;
}

export interface TourNode {
  file: string;
  startLine: number;
  endLine: number;
  title: string;
  explanation: string;
  edges: TourEdge[];
}

export interface TrackedFile {
  path: string;
  lastCommit: string;
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
        for (const edge of node.edges as Array<Record<string, unknown>>) {
          if (typeof edge.target !== "string") {
            issues.push(`node '${id}': edge missing target`);
          } else if (!nodeIds.has(edge.target)) {
            issues.push(
              `node '${id}': edge target '${edge.target}' does not exist`
            );
          }
        }
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
  return {
    version: 1,
    id: tour.id,
    name: tour.name,
    query: tour.query ?? "",
    generatedAt: tour.generatedAt ?? new Date().toISOString(),
    trackedFiles: Array.isArray(tour.trackedFiles) ? tour.trackedFiles : [],
    entryNode: tour.entryNode,
    nodes: tour.nodes,
  };
}
