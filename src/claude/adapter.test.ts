import { describe, expect, it } from "vitest";
import { ClaudeAdapter } from "./adapter.js";

describe("ClaudeAdapter", () => {
  it("constructs with default options", () => {
    const adapter = new ClaudeAdapter({
      workspaceRoot: "/tmp/test",
    });
    expect(adapter).toBeDefined();
  });

  it("constructs with custom model and budget", () => {
    const adapter = new ClaudeAdapter({
      workspaceRoot: "/tmp/test",
      model: "opus",
      maxBudgetUsd: 1.0,
    });
    expect(adapter).toBeDefined();
  });
});
