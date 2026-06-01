import { describe, expect, it } from "vitest";
import {
  isCodeTourDocument,
  convertCodeTourToTour,
  codeTourIdFromFileName,
} from "./codetour-compat.js";
import { validateTourDocument } from "../types/tour.js";

const GENERATED_AT = "2026-06-02T00:00:00Z";

// The exact CodeTour file an LLM produced when asked for a "code tour" — the
// real-world case this shim exists to absorb.
const SLACK_CODETOUR = {
  $schema: "https://aka.ms/codetour-schema",
  title: "Bots As Session Clients",
  description:
    "A guided tour of how the Slack bot acts as a thin client over the same session APIs.",
  steps: [
    {
      file: "packages/slack-bot/src/index.ts",
      line: 55,
      title: "Create Sessions Through The Control Plane",
      description: "`createSession()` calls the control plane service binding.",
    },
    {
      file: "packages/slack-bot/src/index.ts",
      line: 127,
      title: "Send Prompts As A Client",
      description: "`sendPrompt()` posts Slack content to `/sessions/:id/prompt`.",
    },
    {
      file: "packages/slack-bot/src/index.ts",
      line: 186,
      title: "Map Slack Threads To Sessions",
      description: "`getThreadSessionKey()` shows the adapter boundary.",
    },
  ],
};

describe("isCodeTourDocument", () => {
  it("flags the aka.ms/codetour-schema marker", () => {
    expect(isCodeTourDocument(SLACK_CODETOUR)).toBe(true);
  });

  it("flags a bare steps array with no schema", () => {
    expect(isCodeTourDocument({ title: "x", steps: [{ file: "a.ts", line: 1 }] })).toBe(true);
  });

  it("rejects a native Side Bae tour (has nodes map)", () => {
    const native = {
      $schema: "https://aka.ms/codetour-schema", // even with the marker present
      nodes: { entry: { file: "a.ts", startLine: 1, endLine: 2, edges: [] } },
    };
    expect(isCodeTourDocument(native)).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isCodeTourDocument(null)).toBe(false);
    expect(isCodeTourDocument("steps")).toBe(false);
    expect(isCodeTourDocument(42)).toBe(false);
  });
});

describe("codeTourIdFromFileName", () => {
  it("strips .tour and slugifies", () => {
    expect(codeTourIdFromFileName("bots-as-session-clients.tour")).toBe(
      "bots-as-session-clients"
    );
  });

  it("strips .tour.json", () => {
    expect(codeTourIdFromFileName("My Cool Tour.tour.json")).toBe("my-cool-tour");
  });

  it("falls back for empty/odd names", () => {
    expect(codeTourIdFromFileName("___.tour")).toBe("imported-tour");
  });
});

describe("convertCodeTourToTour", () => {
  it("maps a linear CodeTour into a native graph", () => {
    const tour = convertCodeTourToTour(SLACK_CODETOUR, {
      id: "bots-as-session-clients",
      generatedAt: GENERATED_AT,
    });

    expect(tour.version).toBe(1);
    expect(tour.id).toBe("bots-as-session-clients");
    expect(tour.name).toBe("Bots As Session Clients");
    expect(tour.entryNode).toBe("step-1");
    expect(Object.keys(tour.nodes)).toEqual(["step-1", "step-2", "step-3"]);

    // Same file across all steps → deduplicated to a single tracked file.
    expect(tour.trackedFiles).toEqual([
      { path: "packages/slack-bot/src/index.ts", lastCommit: "" },
    ]);

    // Single `line` becomes startLine === endLine; description → explanation.
    expect(tour.nodes["step-1"].startLine).toBe(55);
    expect(tour.nodes["step-1"].endLine).toBe(55);
    expect(tour.nodes["step-1"].title).toBe("Create Sessions Through The Control Plane");
    expect(tour.nodes["step-1"].explanation).toContain("createSession()");
  });

  it("chains steps with forward 'next' edges and a leaf at the end", () => {
    const tour = convertCodeTourToTour(SLACK_CODETOUR, {
      id: "slack",
      generatedAt: GENERATED_AT,
    });
    expect(tour.nodes["step-1"].edges).toEqual([{ target: "step-2", label: "next" }]);
    expect(tour.nodes["step-2"].edges).toEqual([{ target: "step-3", label: "next" }]);
    expect(tour.nodes["step-3"].edges).toEqual([]);
  });

  it("produces output that passes the real tour validator", () => {
    const tour = convertCodeTourToTour(SLACK_CODETOUR, {
      id: "slack",
      generatedAt: GENERATED_AT,
    });
    expect(() => validateTourDocument(tour)).not.toThrow();
  });

  it("maps a CodeTour selection range to startLine/endLine", () => {
    const tour = convertCodeTourToTour(
      {
        title: "Range",
        steps: [
          {
            file: "a.ts",
            selection: { start: { line: 10 }, end: { line: 24 } },
            description: "A block.",
          },
        ],
      },
      { id: "range", generatedAt: GENERATED_AT }
    );
    expect(tour.nodes["step-1"].startLine).toBe(10);
    expect(tour.nodes["step-1"].endLine).toBe(24);
  });

  it("derives a title when CodeTour omits one", () => {
    const tour = convertCodeTourToTour(
      {
        steps: [{ file: "a.ts", line: 3, description: "This binds the router. Then more." }],
      },
      { id: "x", generatedAt: GENERATED_AT }
    );
    expect(tour.nodes["step-1"].title).toBe("This binds the router.");
  });

  it("skips non-file steps and re-indexes the survivors", () => {
    const tour = convertCodeTourToTour(
      {
        title: "Mixed",
        steps: [
          { description: "Intro with no file anchor." }, // dropped
          { file: "a.ts", line: 1, title: "Real", description: "Real step." },
        ],
      },
      { id: "mixed", generatedAt: GENERATED_AT }
    );
    expect(Object.keys(tour.nodes)).toEqual(["step-1"]);
    expect(tour.entryNode).toBe("step-1");
    expect(tour.nodes["step-1"].title).toBe("Real");
  });

  it("throws when no step anchors to a file", () => {
    expect(() =>
      convertCodeTourToTour(
        { title: "Empty", steps: [{ description: "no file" }, { directory: "src" }] },
        { id: "empty", generatedAt: GENERATED_AT }
      )
    ).toThrow(/no file-anchored steps/);
  });
});
