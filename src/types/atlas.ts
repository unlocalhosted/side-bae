// ── System Atlas: codebase map + flow traces ──

export interface AtlasLayer {
  id: string;
  name: string;
  description: string;
  keyFiles: string[];
  icon?: string;
}

export interface AtlasConnection {
  from: string;
  to: string;
  label: string;
}

export interface AtlasFlowStep {
  summary: string;
  explanation: string;
  file: string;
  startLine: number;
  endLine: number;
  layerId: string;
}

export interface AtlasFlow {
  id: string;
  name: string;
  trigger: string;
  steps: AtlasFlowStep[];
}

export interface AtlasSuggestion {
  type: "tour" | "lesson";
  label: string;
  query: string;
}

export interface SystemAtlas {
  version: 1;
  id: string;
  generatedAt: string;

  /** Phase 1: What is this? */
  projectName: string;
  summary: string;
  techStack: string[];

  /** Phase 2: How is it organized? */
  layers: AtlasLayer[];
  connections: AtlasConnection[];

  /** Phase 3: How things flow */
  flows: AtlasFlow[];

  /** Phase 4: Where to go next */
  suggestions: AtlasSuggestion[];
}

export class AtlasValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: string[]
  ) {
    super(message);
    this.name = "AtlasValidationError";
  }
}

export function validateAtlas(data: unknown): SystemAtlas {
  const issues: string[] = [];
  const d = data as Record<string, unknown>;

  if (!d || typeof d !== "object") {
    throw new AtlasValidationError("Atlas data is not an object", [
      "expected object",
    ]);
  }

  if (typeof d.projectName !== "string" || d.projectName.length === 0)
    issues.push("missing or empty 'projectName'");
  if (typeof d.summary !== "string" || d.summary.length === 0)
    issues.push("missing or empty 'summary'");

  if (!Array.isArray(d.techStack)) issues.push("missing 'techStack' array");
  if (!Array.isArray(d.layers)) issues.push("missing 'layers' array");
  if (!Array.isArray(d.connections)) issues.push("missing 'connections' array");
  if (!Array.isArray(d.flows)) issues.push("missing 'flows' array");

  // Validate layers have required fields
  if (Array.isArray(d.layers)) {
    for (const [i, raw] of (d.layers as unknown[]).entries()) {
      const layer = raw as Record<string, unknown>;
      if (typeof layer?.id !== "string") issues.push(`layer[${i}]: missing id`);
      if (typeof layer?.name !== "string") issues.push(`layer[${i}]: missing name`);
    }
  }

  // Validate flows have required fields
  if (Array.isArray(d.flows)) {
    for (const [i, raw] of (d.flows as unknown[]).entries()) {
      const flow = raw as Record<string, unknown>;
      if (typeof flow?.id !== "string") issues.push(`flow[${i}]: missing id`);
      if (typeof flow?.name !== "string") issues.push(`flow[${i}]: missing name`);
      if (!Array.isArray(flow?.steps)) issues.push(`flow[${i}]: missing steps array`);
    }
  }

  if (issues.length > 0) {
    throw new AtlasValidationError(
      `Invalid atlas: ${issues[0]}${issues.length > 1 ? ` (+${issues.length - 1} more)` : ""}`,
      issues
    );
  }

  const atlas = data as SystemAtlas;
  return {
    version: 1,
    id: atlas.id || "atlas",
    generatedAt: atlas.generatedAt || new Date().toISOString(),
    projectName: atlas.projectName,
    summary: atlas.summary,
    techStack: atlas.techStack || [],
    layers: atlas.layers || [],
    connections: atlas.connections || [],
    flows: atlas.flows || [],
    suggestions: Array.isArray(atlas.suggestions) ? atlas.suggestions : [],
  };
}
