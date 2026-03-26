import { describe, expect, it } from "vitest";
import { ClaudeAdapter } from "./adapter.js";

describe("ClaudeAdapter", () => {
  it("builds correct CLI arguments", () => {
    const adapter = new ClaudeAdapter({
      workspaceRoot: "/tmp/test",
      model: "sonnet",
      maxBudgetUsd: 0.5,
    });

    const args = adapter.buildArgs("test prompt", { type: "object" });

    expect(args).toContain("-p");
    expect(args).toContain("--output-format");
    expect(args).toContain("json");
    expect(args).toContain("--json-schema");
    expect(args).toContain("--model");
    expect(args).toContain("sonnet");
    expect(args).toContain("test prompt");

    // json-schema arg should be valid JSON
    const schemaIndex = args.indexOf("--json-schema") + 1;
    expect(() => JSON.parse(args[schemaIndex]!)).not.toThrow();
  });

  it("uses default model when not specified", () => {
    const adapter = new ClaudeAdapter({
      workspaceRoot: "/tmp/test",
    });

    const args = adapter.buildArgs("test", { type: "object" });
    const modelIndex = args.indexOf("--model") + 1;
    expect(args[modelIndex]).toBe("sonnet");
  });

  it("uses custom model when specified", () => {
    const adapter = new ClaudeAdapter({
      workspaceRoot: "/tmp/test",
      model: "opus",
    });

    const args = adapter.buildArgs("test", { type: "object" });
    const modelIndex = args.indexOf("--model") + 1;
    expect(args[modelIndex]).toBe("opus");
  });
});
