/**
 * Compatibility shim for Microsoft CodeTour files (`vsls-contrib.codetour`).
 *
 * "Generate a code tour for VS Code" is a strong attractor for LLMs: they tend
 * to emit CodeTour's `$schema` / flat `steps[]` shape instead of Side Bae's
 * native graph format, especially when the skill prompt isn't firmly in context
 * (a plain natural-language ask, or a non-Claude tool like Cursor/Copilot).
 *
 * Rather than fight that with prompting alone, we accept CodeTour files and
 * convert them. CodeTour is a flat, linear list of steps, so a converted tour is
 * always a single path — the branching that makes a Side Bae tour a *tree* has
 * no CodeTour equivalent.
 */

import type { TourDocument, TourNode, TrackedFile } from "../types/tour.js";

interface CodeTourSelection {
  start?: { line?: number; character?: number };
  end?: { line?: number; character?: number };
}

interface CodeTourStep {
  file?: string;
  uri?: string;
  line?: number;
  pattern?: string;
  selection?: CodeTourSelection;
  title?: string;
  description?: string;
}

interface CodeTourDocument {
  $schema?: string;
  title?: string;
  description?: string;
  steps?: unknown;
}

/**
 * Distinguish a CodeTour document from Side Bae's native format. Native tours
 * always carry a `nodes` map; CodeTour never does, and instead has a `steps`
 * array and/or the `aka.ms/codetour-schema` `$schema`.
 */
export function isCodeTourDocument(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  // A `nodes` map is the unambiguous marker of a native Side Bae tour.
  if (d.nodes && typeof d.nodes === "object") return false;
  const schema = typeof d.$schema === "string" ? d.$schema : "";
  return schema.includes("codetour") || Array.isArray(d.steps);
}

function slugify(input: string, fallback: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : fallback;
}

/** Derive a stable Side Bae tour id from a CodeTour filename (`.tour` or `.tour.json`). */
export function codeTourIdFromFileName(fileName: string): string {
  const base = fileName.replace(/\.tour\.json$/, "").replace(/\.tour$/, "");
  return slugify(base, "imported-tour");
}

/** Fall back to a step title when CodeTour omits one (its `title` is optional). */
function deriveTitle(explanation: string, index: number): string {
  const trimmed = explanation.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return `Step ${index + 1}`;
  const end = trimmed.search(/[.!?](\s|$)/);
  const candidate = end > 0 ? trimmed.slice(0, end + 1) : trimmed;
  return candidate.length > 60 ? candidate.slice(0, 59).trimEnd() + "…" : candidate;
}

export interface ConvertOptions {
  /** Stable id, usually derived from the source filename via codeTourIdFromFileName. */
  id: string;
  /** ISO timestamp, injected so the conversion stays deterministic and testable. */
  generatedAt: string;
}

/**
 * Convert a Microsoft CodeTour document into Side Bae's native graph format,
 * mapping the flat `steps[]` onto a linear chain of nodes joined by "next" edges.
 * Throws if no step anchors to a file (CodeTour also allows directory/content
 * steps, which have no place in a code walkthrough).
 */
export function convertCodeTourToTour(
  data: unknown,
  opts: ConvertOptions
): TourDocument {
  const doc = (data ?? {}) as CodeTourDocument;
  const rawSteps: unknown[] = Array.isArray(doc.steps) ? doc.steps : [];

  const fileSteps = rawSteps.filter((s): s is CodeTourStep => {
    if (!s || typeof s !== "object") return false;
    const loc = (s as CodeTourStep).file ?? (s as CodeTourStep).uri;
    return typeof loc === "string" && loc.length > 0;
  });

  if (fileSteps.length === 0) {
    throw new Error("CodeTour file has no file-anchored steps to convert");
  }

  const nodes: Record<string, TourNode> = {};
  const trackedPaths = new Set<string>();

  fileSteps.forEach((step, i) => {
    const nodeId = `step-${i + 1}`;
    const isLast = i === fileSteps.length - 1;

    const file = (step.file ?? step.uri)!;
    trackedPaths.add(file);

    const rawStart = step.selection?.start?.line ?? step.line ?? 1;
    const rawEnd = step.selection?.end?.line ?? step.line ?? rawStart;
    const startLine = Math.max(1, rawStart);
    const endLine = Math.max(startLine, rawEnd);

    const explanation = (step.description ?? "").trim();
    const title =
      step.title && step.title.trim().length > 0
        ? step.title.trim()
        : deriveTitle(explanation, i);

    nodes[nodeId] = {
      file,
      startLine,
      endLine,
      title,
      explanation,
      edges: isLast ? [] : [{ target: `step-${i + 2}`, label: "next" }],
    };
  });

  const name =
    doc.title && doc.title.trim().length > 0 ? doc.title.trim() : opts.id;
  const trackedFiles: TrackedFile[] = [...trackedPaths].map((path) => ({
    path,
    lastCommit: "",
  }));

  return {
    version: 1,
    id: slugify(opts.id, "imported-tour"),
    name,
    query:
      doc.description && doc.description.trim().length > 0
        ? doc.description.trim()
        : name,
    generatedAt: opts.generatedAt,
    trackedFiles,
    entryNode: "step-1",
    nodes,
  };
}
