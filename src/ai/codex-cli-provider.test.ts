import { EventEmitter } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it, beforeEach, vi } from "vitest";
import type { GenerationProgress } from "./types.js";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  spawn: spawnMock,
}));

interface SpawnCall {
  command: string;
  args: string[];
  stdinText?: string;
  killedWith?: string;
  schema?: Record<string, unknown>;
}

interface MockChild extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: { end: (text?: string) => void };
  kill: (signal?: string) => boolean;
}

const spawnCalls: SpawnCall[] = [];

function createChild(call: SpawnCall): MockChild {
  const child = new EventEmitter() as MockChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { end: () => {} };
  child.kill = (signal = "SIGTERM") => {
    call.killedWith = signal;
    setImmediate(() => child.emit("close", null, signal));
    return true;
  };
  return child;
}

function emitClose(child: MockChild, code = 0): void {
  setImmediate(() => child.emit("close", code, null));
}

function emitStdoutLine(child: MockChild, value: unknown): void {
  child.stdout.emit("data", Buffer.from(`${JSON.stringify(value)}\n`));
}

function installSpawnMock(
  execResponse: unknown = { content: "Nice.", summary: "Done." }
): void {
  spawnMock.mockImplementation((command: string, args: string[]) => {
    const call: SpawnCall = { command, args };
    spawnCalls.push(call);
    const child = createChild(call);

    if (args[0] === "--version") {
      child.stdout.emit("data", Buffer.from("codex-cli 0.138.0\n"));
      emitClose(child);
      return child;
    }

    if (args[0] === "login" && args[1] === "status") {
      child.stdout.emit("data", Buffer.from("Logged in using ChatGPT\n"));
      emitClose(child);
      return child;
    }

    if (args[0] === "exec") {
      child.stdin.end = (text = "") => {
        call.stdinText = text;
        setImmediate(async () => {
          const outputPath = args[args.indexOf("--output-last-message") + 1];
          const schemaPath = args[args.indexOf("--output-schema") + 1];
          if (schemaPath) {
            call.schema = JSON.parse(await readFile(schemaPath, "utf-8")) as Record<string, unknown>;
          }
          if (outputPath) {
            await writeFile(outputPath, JSON.stringify(execResponse), "utf-8");
          }
          emitStdoutLine(child, { type: "thread.started", thread_id: "thread_123" });
          emitStdoutLine(child, {
            type: "item.started",
            item: { id: "item_1", type: "command_execution", command: "rg auth" },
          });
          emitStdoutLine(child, {
            type: "item.completed",
            item: { id: "item_2", type: "agent_message", text: JSON.stringify(execResponse) },
          });
          child.emit("close", 0, null);
        });
      };
      return child;
    }

    emitClose(child, 1);
    return child;
  });
}

async function loadCodexProvider() {
  const mod = await import("./codex-cli-provider.js");
  return mod.CodexCliProvider;
}

function progressRecorder() {
  const messages: string[] = [];
  let cancel: (() => void) | undefined;
  const progress: GenerationProgress = {
    onProgress: (message) => messages.push(message),
    onCancel: (callback) => {
      cancel = callback;
    },
  };
  return { progress, messages, cancel: () => cancel?.() };
}

describe("CodexCliProvider", () => {
  beforeEach(() => {
    vi.resetModules();
    spawnMock.mockReset();
    spawnCalls.length = 0;
  });

  it("checks that Codex is installed and logged in without running a model turn", async () => {
    installSpawnMock();
    const CodexCliProvider = await loadCodexProvider();
    const provider = new CodexCliProvider({ workspaceRoot: "/repo" });

    const status = await provider.checkStatus();

    expect(status).toEqual({ available: true, authenticated: true, displayName: "Codex" });
    expect(spawnCalls.map((call) => call.args)).toEqual([
      ["--version"],
      ["login", "status"],
    ]);
  });

  it("reports Codex as unavailable when the CLI cannot be spawned", async () => {
    spawnMock.mockImplementation((command: string, args: string[]) => {
      const call: SpawnCall = { command, args };
      spawnCalls.push(call);
      const child = createChild(call);
      setImmediate(() => child.emit("error", new Error("spawn codex ENOENT")));
      return child;
    });
    const CodexCliProvider = await loadCodexProvider();
    const provider = new CodexCliProvider({ workspaceRoot: "/repo" });

    const status = await provider.checkStatus();

    expect(status.available).toBe(false);
    expect(status.authenticated).toBe(false);
    expect(status.error).toContain("Codex CLI was not found");
  });

  it("runs structured prompts through codex exec with schema output and read-only sandboxing", async () => {
    installSpawnMock({ content: "Looks right.", correct: true, summary: "Understood" });
    const CodexCliProvider = await loadCodexProvider();
    const provider = new CodexCliProvider({ workspaceRoot: "/repo", model: "gpt-test" });
    const { progress, messages } = progressRecorder();

    const response = await provider.generateStepResponse("Check this answer", progress);
    const execCall = spawnCalls.find((call) => call.args[0] === "exec");

    expect(response).toEqual({ content: "Looks right.", correct: true, summary: "Understood" });
    expect(execCall?.command).toBe("codex");
    expect(execCall?.args).toEqual(expect.arrayContaining([
      "exec",
      "--cd",
      "/repo",
      "--json",
      "--output-schema",
      "--output-last-message",
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "--model",
      "gpt-test",
      "--ephemeral",
      "-",
    ]));
    expect(execCall?.schema?.required).toEqual(["content", "summary"]);
    expect(execCall?.stdinText).toContain("Return only the final JSON object");
    expect(messages).toEqual(["Running rg auth"]);
  });

  it("resumes persisted Codex sessions for investigation and lesson turns", async () => {
    installSpawnMock({
      phase: "investigate",
      content: "Following the failing path.",
      awaitsResponse: false,
      isComplete: false,
    });
    const CodexCliProvider = await loadCodexProvider();
    const provider = new CodexCliProvider({ workspaceRoot: "/repo" });
    const { progress } = progressRecorder();

    const step = await provider.generateInvestigationStep("Continue", progress, {
      persistSession: true,
      resumeSessionId: "thread_abc",
    });
    const execCall = spawnCalls.find((call) => call.args[0] === "exec");

    expect(step.sessionId).toBe("thread_123");
    expect(execCall?.args).toContain("resume");
    expect(execCall?.args).toEqual(expect.arrayContaining(["resume", "thread_abc", "-"]));
    expect(execCall?.args).not.toContain("--ephemeral");
  });

  it("maps Codex auth failures to a login-focused recovery message", async () => {
    spawnMock.mockImplementation((command: string, args: string[]) => {
      const call: SpawnCall = { command, args };
      spawnCalls.push(call);
      const child = createChild(call);
      if (args[0] === "exec") {
        child.stdin.end = () => {
          child.stderr.emit("data", Buffer.from("401 Unauthorized: login required"));
          child.emit("close", 1, null);
        };
      } else {
        emitClose(child);
      }
      return child;
    });
    const CodexCliProvider = await loadCodexProvider();
    const provider = new CodexCliProvider({ workspaceRoot: "/repo" });

    await expect(provider.generateStepResponse("Hi", progressRecorder().progress)).rejects.toThrow(
      "Run `codex login`"
    );
  });

  it("cancels in-flight Codex runs by terminating the child process", async () => {
    spawnMock.mockImplementation((command: string, args: string[]) => {
      const call: SpawnCall = { command, args };
      spawnCalls.push(call);
      const child = createChild(call);
      if (args[0] !== "exec") {
        emitClose(child);
      }
      return child;
    });
    const CodexCliProvider = await loadCodexProvider();
    const provider = new CodexCliProvider({ workspaceRoot: "/repo" });
    const recorder = progressRecorder();

    const promise = provider.generateStepResponse("Hi", recorder.progress);
    await vi.waitFor(() => {
      expect(spawnCalls.some((call) => call.args[0] === "exec")).toBe(true);
    });
    recorder.cancel();

    await expect(promise).rejects.toThrow("Query cancelled");
    expect(spawnCalls.find((call) => call.args[0] === "exec")?.killedWith).toBe("SIGTERM");
  });
});

describe("createProvider Codex integration", () => {
  beforeEach(() => {
    vi.resetModules();
    spawnMock.mockReset();
    spawnCalls.length = 0;
  });

  it("constructs Codex explicitly and can auto-detect it after Copilot", async () => {
    installSpawnMock();
    const { createProvider } = await import("./create-provider.js");

    expect(createProvider({ provider: "codex", workspaceRoot: "/repo" }).id).toBe("codex");

    const auto = createProvider({ provider: "auto", workspaceRoot: "/repo" });
    const status = await auto.checkStatus();

    expect(status.displayName).toBe("Codex");
    expect(status.available).toBe(true);
    expect(status.authenticated).toBe(true);
  });
});
