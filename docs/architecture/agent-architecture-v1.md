# Agent Architecture Design Document

**Version:** 1.0
**Date:** 2026-03-31
**Status:** Proposed
**Authors:** Vijay K Singh, Claude

---

## Version History

| Version | Date | Summary |
|---|---|---|
| **1.0** | 2026-03-31 | Initial architecture audit. Documents v0.2.x approach, identifies bottlenecks, proposes v0.3.x optimizations. |

---

## How to Read This Document

This is written as a retrospective design document — not just "what we'll build," but *why the current approach is slow, what we learned from it, and how production AI systems solve the same problems*. Every section follows the pattern:

1. **What we built** — the current implementation
2. **What we assumed** — the mental model we had when building it
3. **What actually happens** — where reality diverges
4. **What we learned** — lessons from the field (with citations)
5. **What we'll change** — the specific improvement

If you're learning AI engineering, the "what we assumed" → "what actually happens" gap is where the most useful lessons live.

---

## Table of Contents

1. [Context: What Side Bae Does](#1-context)
2. [The Speed Problem](#2-the-speed-problem)
3. [Architecture Audit: Seven Lessons Learned](#3-architecture-audit)
   - 3.1 [Lesson: Don't let the LLM discover what you already know](#31-codebase-context)
   - 3.2 [Lesson: One config does not fit all queries](#32-per-query-config)
   - 3.3 [Lesson: System prompts are for caching, not just instructions](#33-system-prompt)
   - 3.4 [Lesson: If you know the file, read it yourself](#34-pre-loaded-content)
   - 3.5 [Lesson: Prefetch with parallelism, not lower quality](#35-prefetch)
   - 3.6 [Lesson: Sessions are cheap; fresh starts are expensive](#36-session-resumption)
   - 3.7 [Lesson: Unbounded history will find your context limit](#37-history-truncation)
4. [Proposed Architecture](#4-proposed-architecture)
5. [Implementation Plan](#5-implementation-plan)
6. [Verification & Targets](#6-verification)
7. [References](#7-references)
8. [Appendix: Design Decisions Log](#8-appendix)

---

## 1. Context

Side Bae is a VS Code extension that uses the Claude Agent SDK to help developers understand unfamiliar codebases. It has three core AI-powered features:

- **Tours** — Claude reads the codebase and generates a navigable graph of code regions with explanations
- **Lessons** — Claude creates a multi-step teaching plan, then generates interactive content for each step (explanations + questions)
- **Investigations** — Claude collaboratively debugs an issue through an 8-phase process (orient → diagnose → fix → ship)

All AI calls flow through a single adapter (`src/claude/adapter.ts`) that wraps the `@anthropic-ai/claude-agent-sdk`. The adapter calls `query()` which spawns a Claude Code subprocess, streams tool activity as progress, and returns structured JSON validated against a schema.

### Current tech stack

| Component | Implementation |
|---|---|
| SDK | `@anthropic-ai/claude-agent-sdk` via `query()` |
| Default model | Haiku (user-configurable: haiku/sonnet/opus) |
| Output format | JSON Schema (`outputFormat: { type: "json_schema", schema }`) |
| Tool access | Read, Grep, Glob, Bash (all queries, always) |
| Budget | $0.50 per query (configurable) |
| Turns | 30 max (all queries, always) |

---

## 2. The Speed Problem

**Every AI operation takes 3-5 minutes.** A lesson with 8 steps makes 68-112 SDK round-trips. The user watches a spinner with tool-activity messages ("Reading tour-engine.ts...", "Scanning for patterns...") but has no way to speed things up.

### Where the time goes (measured for a typical 8-step lesson)

| Phase | SDK Turns | Time | What's happening |
|---|---|---|---|
| Plan generation | 25-40 | 60-120s | Claude blindly scans the codebase |
| Step 1 content | 3-5 | 8-15s | Reads file, generates explanation |
| Step 1 response | 2-3 | 5-8s | Evaluates learner's answer |
| Steps 2-8 content (7x) | 21-35 | 60-100s | Sequential, one at a time |
| Steps 2-8 responses (7x) | 14-21 | 35-60s | Sequential evaluations |
| Schema retries | 2-5 | 5-10s | ~5% structured output failures |
| **Total** | **68-112** | **3-5 min** | |

The breakdown reveals that no single call is slow — it's the *volume* of calls and the *blind exploration* that compound.

---

## 3. Architecture Audit: Seven Lessons Learned

### 3.1 Don't let the LLM discover what you already know

#### What we built

Our prompts tell Claude to explore the codebase:

```
// prompts.ts, buildLessonPlanPrompt (line 289):
"Scan the codebase and create a structured lesson plan with 6-10 steps."

// prompts.ts, buildFeatureDiscoveryPrompt (line 535):
"Analyze this codebase and identify the major features... Look at: Directory structure..."
```

#### What we assumed

We assumed Claude would efficiently scan a codebase — that its tool-use would be targeted and fast. After all, it has Glob, Grep, and Read at its disposal.

#### What actually happens

Claude explores *blindly*. A typical plan generation:
1. `Glob("**/*.ts")` — discover files
2. `Read("package.json")` — understand the project
3. `Read("src/index.ts")` — find entry point
4. `Grep("export class")` — find key classes
5. `Read("src/engine/tour-engine.ts")` — follow an import
6. `Read("src/claude/adapter.ts")` — follow another
7. ... 15-30 more tool calls exploring the dependency graph

**25-40 tool calls** to build a mental model of the codebase. Each is a full inference round-trip (~2-3 seconds). That's 50-120 seconds on exploration alone — before Claude writes a single line of output.

#### What we learned

> *"Aider builds a concise map of your entire git repository, including the most important classes and functions with their types and call signatures."*
> — [Aider Repo Map Documentation](https://aider.chat/docs/repomap.html)

Aider solves this by pre-computing a "repo map" — a lightweight structural reference of the codebase (~1K tokens) built using tree-sitter. Claude sees the map and can jump directly to the right files instead of exploring.

Cursor takes the same approach:

> *"Far more token-efficient, as only necessary data is pulled into the context window."*
> — [Cursor: Dynamic Context Discovery](https://cursor.com/blog/dynamic-context-discovery)

The general principle, from Anthropic's own guidance:

> *"The overall guidance is to be thoughtful and keep your context informative, yet tight."*
> — [Anthropic: Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

#### What we'll change

**New module: `src/claude/codebase-context.ts`**

A local filesystem scan (<100ms, no LLM) that produces a `CodebaseContext`:
- File tree (depth 2-3, gitignore-aware)
- Entry points (from `package.json` main/exports, `src/index.*`)
- Directory summaries (name + file count)
- Package metadata (name, description)

Adaptive for large repos: full tree for <200 files, directory summaries only for 500+.

Injected into prompts so Claude starts with structure instead of scanning:

```
Here is the project structure (pre-scanned):
src/
  claude/     (5 files)
  commands/   (6 files)
  engine/     (4 files)
  views/      (7 files)
  types/      (5 files)

Entry points: src/extension.ts
47 files across 5 directories.

Create a lesson plan about "${subject}". Read ONLY the files
needed for specific steps — do not scan broadly.
```

**Expected savings: 40-80 seconds** (25-40 tool calls → 5-15)

---

### 3.2 One config does not fit all queries

#### What we built

Every call to the SDK uses identical configuration:

```typescript
// adapter.ts, runStructuredQuery (lines 242-258):
query({
  options: {
    maxTurns: 30,
    allowedTools: ["Read", "Grep", "Glob", "Bash"],
    effort: undefined,         // TS SDK defaults to 'high'
    persistSession: false,
  }
});
```

#### What we assumed

A reasonable default would work for everything. 30 turns is generous but safe. All tools might be useful. High effort produces the best results.

#### What actually happens

- **step-response** (evaluating a quiz answer) is a pure text task. It uses zero tools and completes in 1 turn. But it's allocated 30 turns, 4 tools, and `effort: 'high'` — all wasted overhead.
- **feature-discovery** categorizes files. It never needs `Bash`. But Bash definitions consume context tokens.
- **tour-generation** rarely needs more than 15 turns. The extra 15 are headroom that encourages over-exploration.

Each unnecessary tool definition adds tokens to the context. With 4 tools, that's extra inference overhead on *every single call*, even when the tools go unused.

#### What we learned

> *"If you don't set effort, the TypeScript SDK defaults to 'high'."*
> — [Anthropic: Effort Parameter](https://platform.claude.com/docs/en/build-with-claude/effort)

The effort parameter directly controls how many tokens Claude spends thinking. `'low'` produces faster, cheaper responses. `'medium'` is recommended for agentic workflows.

> *"MCP tool definitions... a five-server setup with 58 tools consumes approximately 55K tokens before the conversation even starts."*
> — [Anthropic: Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use)

Tool definitions have real cost. Fewer tools = less context = faster inference.

#### What we'll change

Per-query configuration via a new `QueryOptions` parameter on `runStructuredQuery()`:

| Query Type | `effort` | `maxTurns` | `tools` | Why |
|---|---|---|---|---|
| tour-generation | `medium` | 15 | Read, Grep, Glob | Creative but bounded. No Bash. |
| feature-discovery | `low` | 12 | Read, Grep, Glob | Simple categorization. |
| whats-new | `low` | 10 | Read, Grep, Glob, Bash | Needs `git log`. |
| learnable-concepts | `low` | 15 | Read, Grep, Glob | Scan + categorize. |
| lesson-plan | `medium` | 20 | Read, Grep, Glob | Needs exploration. |
| step-content | `medium` | 3 | Read | Pre-loaded file, Read for cross-file refs. |
| step-response | `low` | 2 | *(none)* | Pure text. Zero tools. |
| investigation | `high` | 20 | Read, Grep, Glob, Bash | Deep analysis. |

**Key API detail:** We use the SDK's `tools` option (restricts which tools *exist*) not just `allowedTools` (auto-approves existing tools). From `sdk.d.ts:884`:

```typescript
tools?: string[] | { type: 'preset'; preset: 'claude_code' };
// "Specify the base set of available built-in tools."
```

---

### 3.3 System prompts are for caching, not just instructions

#### What we built

Each prompt function in `prompts.ts` includes its own voice/tone guidance:

- Tour prompt (lines 8-26): ~400 tokens of voice guidance
- Investigation prompt (lines 99-114): ~300 tokens of similar guidance
- Lesson prompts (lines 429-437): ~200 tokens of the same rules

These repeat on every call. There's no separation between "static instructions that never change" and "dynamic content specific to this query."

#### What we assumed

Prompts are just strings. Put everything the model needs in one place. Simple.

#### What actually happens

Without a `systemPrompt`, the SDK uses a minimal default. Our voice/tone rules (~900 tokens total across prompts) get re-processed from scratch on every call. With `persistSession: false`, there's no KV cache to reuse.

Meanwhile, the same voice rules ("sound like a sharp friend", "use backticks", "explain WHY") appear nearly identically in 4 different prompt builders. That's ~900 tokens of redundancy per session, re-tokenized and re-processed every time.

#### What we learned

> *"Cache reads cost 90% less than regular input tokens."*
> — [Anthropic: Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

> *"11.5s → 2.4s on a 100K-token prompt with caching."*
> — [Anthropic: Prompt Caching Announcement](https://www.anthropic.com/news/prompt-caching)

The 85% improvement is for very long prompts. Our prompts are ~2K tokens, so the raw latency gain is modest (5-15%). But the **cost saving** is real — 90% less on cached tokens — and the **architectural benefit** (separating static from dynamic) is the real win.

**Important nuance:** The `claude_code` preset includes Claude Code's full system prompt — file editing rules, commit practices, security guidelines. That's 3-5K tokens of irrelevant instructions for a teaching assistant. A lean custom string is better.

#### What we'll change

A ~150-token custom system prompt string in the adapter:

```typescript
private sharedSystemPrompt = `You are Side Bae, an AI assistant in a VS Code extension
that teaches developers about codebases through guided tours, interactive lessons,
and bug investigations.

Voice: sound like a sharp friend explaining their favorite codebase over coffee.
- Reference code with backticks, bold key concepts on first mention
- Explain WHY, not just WHAT. Have opinions.
- Concrete before abstract: show code, explain, then name the pattern
- Never announce actions: just do it
- Do not include node_modules, dist, or build artifacts`;
```

Duplicated voice/tone sections removed from all individual prompts. "Do not include node_modules" said once here instead of in every prompt.

---

### 3.4 If you know the file, read it yourself

#### What we built

Step content generation tells Claude to read a file:

```
// prompts.ts, buildStepContentPrompt (line 335):
"The code region is in `${step.file}` lines ${step.startLine}-${step.endLine}. Read this file now."
```

Claude then makes a `Read` tool call, which is a full inference round-trip.

#### What we assumed

Claude should read files because it has the Read tool. That's what tools are for.

#### What actually happens

We already know the exact file and line range — the lesson plan told us. We're asking Claude to make a tool call to discover information we already have. This adds one full inference round-trip (~3-5 seconds) per step for zero new information.

#### What we learned

> *"Token usage dropped from 43,588 to 27,297 tokens (37% reduction), with 19+ fewer inference passes."*
> — [Anthropic: Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use)

The principle: if you know the answer, put it in the prompt. Only use tools for genuinely unknown information.

**But there's a subtlety** (caught during design review): injecting only the highlighted 10-30 lines loses surrounding context. The file has imports, class definitions, type annotations that Claude needs for insightful explanations. And sometimes Claude needs to follow a cross-file import to explain a referenced type.

#### What we'll change

Pre-load the **full file** locally and inject it. Keep `tools: [Read]` with `maxTurns: 3` as fallback for cross-file references:

```typescript
const fileContent = await fs.readFile(join(workspaceRoot, step.file), 'utf-8');

// Prompt includes full file content
// Claude can optionally use Read to follow one import
const result = await runStructuredQuery(prompt, schema, progress, {
  tools: ['Read'],
  maxTurns: 3,
  effort: 'medium',
});
```

**Expected savings: 3-5 seconds per step** (7 steps × 3-5s = 21-35s total)

---

### 3.5 Prefetch with parallelism, not lower quality

#### What we built

We already have a prefetch mechanism (`lesson-session.ts`). After teaching a step, we silently pre-generate the next step's content in the background.

#### What we assumed

Prefetch would overlap with user reading time, making the next step feel instant.

#### What actually happens

Prefetch triggers *after* step content is displayed (tour-player.ts line 265). The user typically reads for 5-15 seconds before answering. If prefetch takes >10 seconds, the user's answer arrives first and aborts the prefetch. **Success rate: ~30-40%.**

The timing is wrong. Prefetch should start **earlier** (during plan display) and reach **further ahead** (N+2, not just N+1).

#### What we learned

An initial design proposed using `effort: 'low'` for prefetch to make it faster. But prefetched content IS what the user sees — there's no higher-quality version generated later. Lower effort would create a visible quality drop on steps 2+ compared to step 1.

**The speed gain from prefetch comes from parallelism** (pre-generating while the user reads), not from reduced quality.

#### What we'll change

1. Prefetch steps 0+1 immediately after plan generation (during plan display)
2. After each step, prefetch N+2 (not just N+1) for more lead time
3. Use `effort: 'medium'` — same quality as live steps
4. Resume the step content session for caching benefits

**Expected result:** Steps 2+ load from cache — user sees content instantly.

---

### 3.6 Sessions are cheap; fresh starts are expensive

#### What we built

Every SDK call uses `persistSession: false`:

```typescript
// adapter.ts line 255:
persistSession: false,
```

This means every call spawns a fresh subprocess, loads a fresh context, and processes the full prompt from scratch.

#### What we assumed

Stateless calls are simpler. We don't need session management complexity.

#### What actually happens

For a lesson with 15+ calls, this means:
- No prompt caching across calls (system prompt + tools re-process every time)
- History must be manually reconstructed in the prompt every turn
- If VS Code reloads mid-lesson, all context is lost

The SDK offers session resumption (`resume: sessionId`) and automatic compaction. We use neither.

#### What we learned

> *"Context caching — KV cache optimization" is one of five core dimensions of context engineering.*
> — [Manus Framework: Context Engineering Lessons](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)

Sessions enable prompt caching, history compaction, and crash recovery — all for the cost of storing a session ID.

**Important subtlety** (caught during design review): resuming a session with a *different* JSON schema than the original call is untested. We scope sessions **per-schema** to avoid conflicts:

- Plan generation: one-shot (no session) — uses `LESSON_PLAN_SCHEMA`
- Step content: shared session across steps 1-N — all use `STEP_CONTENT_SCHEMA`
- Step response: one-shot (no session) — uses `STEP_RESPONSE_SCHEMA`

#### What we'll change

```
Plan gen:    [one-shot, LESSON_PLAN_SCHEMA]
Step 1:      [new session, STEP_CONTENT_SCHEMA]  → captures sessionId
Step 2:      [resume session]
Step 3:      [resume session]
...
Responses:   [one-shot, STEP_RESPONSE_SCHEMA]
```

The SDK's `resume` option (sdk.d.ts:1161) loads conversation history from the specified session. Subsequent prompts only need new user input — not full history reconstruction.

**Expected savings: 20-30 seconds across a full lesson** (subprocess startup + cache hits)

---

### 3.7 Unbounded history will find your context limit

#### What we built

Both `buildLessonTurnPrompt()` and `buildInvestigationTurnPrompt()` iterate over the *entire* conversation history:

```typescript
// prompts.ts line 470:
for (const turn of history) {
  // ... append every turn's content to the prompt
}
```

#### What we assumed

Full history gives Claude the most context to work with. More is better.

#### What actually happens

History grows linearly with turns. A 10-step lesson with answers generates ~20 turns of history. Each turn includes content previews (200 chars), prompts, and responses. By step 8, the history section alone can exceed 5,000 characters.

This isn't a problem *yet* with our current usage. But with session resumption, the SDK handles history internally (including auto-compaction). For the fallback path where sessions can't be resumed, we need a safety net.

#### What we learned

> *"LLMs tend to struggle in distinguishing valuable information when flooded with large amounts of unfiltered information."*
> — [Context Rot Research](https://research.trychroma.com/context-rot)

Models experience "context rot" — accuracy degrades as context grows. A pruned history with 8 recent turns often performs *better* than a complete history with 20 turns.

#### What we'll change

A `truncateHistory()` helper with configurable budget (8 recent turns, 300 chars/turn, 6K total cap). Applied as a safety net in the non-resumed prompt paths.

---

## 4. Proposed Architecture

```
┌──────────────────────────────────────────────────────┐
│                    USER ACTION                        │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│              COMMAND LAYER  (unchanged)               │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│           CLAUDE ADAPTER  (adapter.ts)               │
│                                                      │
│  runStructuredQuery(prompt, schema, progress, opts)   │
│                                                      │
│  Per-query configuration:                            │
│    effort:          low / medium / high               │
│    maxTurns:        2-20 (matched to task)            │
│    tools:           [] / [Read] / [Read,Grep,Glob,…] │
│    systemPrompt:    lean custom string (~150 tokens)  │
│    persistSession:  true for step-content sessions    │
│    resume:          sessionId for steps 2-N           │
│                                                      │
│  Codebase context injected into scan-heavy prompts   │
│  File content pre-loaded for step teaching            │
└───────────────────────┬──────────────────────────────┘
                        │
              ┌─────────┴──────────┐
              ▼                    ▼
┌─────────────────────┐  ┌────────────────────────────┐
│  CODEBASE CONTEXT   │  │    CLAUDE AGENT SDK        │
│  (codebase-context) │  │                            │
│                     │  │  systemPrompt: cached      │
│  Local fs scan      │  │  Scoped tools              │
│  <100ms, cached     │  │  Right-sized maxTurns      │
│  Gitignore-aware    │  │  Effort-matched inference  │
│  Adaptive depth     │  │  Session resumption        │
└─────────────────────┘  │  Auto-compaction           │
                         └────────────────────────────┘
```

### What stays the same

- **Command layer** — unchanged. Commands still guard concurrency, collect input, show progress.
- **Tour engine** — unchanged. DAG navigation, validation, history tracking.
- **Webview layer** — unchanged. The UI doesn't care how fast the data arrives.
- **Schema definitions** — unchanged. Structured output schemas are fine as-is.
- **Model selection** — unchanged. Haiku default is appropriate for this workload.

### What changes

| Component | Current | Proposed |
|---|---|---|
| `adapter.ts` | One-size-fits-all config | Per-query `effort`, `maxTurns`, `tools`, session management |
| `prompts.ts` | Self-contained prompts with repeated voice/tone | Leaner prompts, shared system prompt, codebase context injection |
| `lesson-session.ts` | Sequential steps, late prefetch | Pre-loaded files, early parallel prefetch, session resumption |
| `investigation-session.ts` | Full history reconstruction per turn | Session resumption, history truncation fallback |
| *(new)* `codebase-context.ts` | N/A | Local fs scan for prompt injection |

---

## 5. Implementation Plan

Each phase is independently shippable and testable:

| Phase | Change | Files | Risk | Dependencies |
|---|---|---|---|---|
| **1** | Codebase context pre-scan | `codebase-context.ts` (new), `prompts.ts`, `adapter.ts` | Low | None |
| **2** | Per-query `effort` + `maxTurns` + `tools` | `adapter.ts` | Low | None |
| **3** | `systemPrompt` + prompt trimming | `adapter.ts`, `prompts.ts` | Low | None |
| **4** | Pre-loaded file content for steps | `lesson-session.ts`, `prompts.ts` | Low | None |
| **5** | Aggressive parallel prefetch | `lesson-session.ts`, `tour-player.ts` | Medium | Phase 4 |
| **6** | Session persistence + resumption | `adapter.ts`, `lesson-session.ts`, `investigation-session.ts`, `prompts.ts` | Medium | Phase 3 |
| **7** | History truncation | `prompts.ts` | Low | None |

Phases 1-4 are low-risk (config changes, prompt edits, a new utility module). Phase 5-6 are structural. Phase 7 is a safety net.

---

## 6. Verification & Targets

### Per-phase checks
1. `npm run typecheck` — must pass
2. `npm run test:run` — 29 tests pass
3. `npm run lint` — 0 errors

### End-to-end timing targets

| Feature | v0.2.x (current) | v0.3.x (target) | Improvement |
|---|---|---|---|
| Tour generation | 60-90s | 30-45s | ~50% faster |
| Lesson plan generation | 60-120s | 20-40s | ~60% faster |
| Lesson step content | 8-15s | 2-5s (cached: instant) | ~70% faster |
| Step response eval | 5-8s | 1-2s | ~75% faster |
| Feature discovery | 30-60s | 15-30s | ~50% faster |
| Investigation orient | 15-30s | 10-20s | ~33% faster |
| **Full 8-step lesson** | **~4 min** | **~1.5-2 min** | **~55% faster** |

---

## 7. References

| # | Source | Key Takeaway |
|---|---|---|
| 1 | [Anthropic: Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | "Keep context informative, yet tight" |
| 2 | [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) (Schluntz & Zhang, Dec 2024) | "Simple, composable patterns over complex frameworks" |
| 3 | [Anthropic: Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use) | 37% token reduction with fewer inference passes |
| 4 | [Anthropic: Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) | Cache reads cost 0.1x base tokens; up to 85% latency reduction on long prompts |
| 5 | [Anthropic: Prompt Caching Announcement](https://www.anthropic.com/news/prompt-caching) | 11.5s to 2.4s benchmark on 100K-token prompt |
| 6 | [Anthropic: Effort Parameter](https://platform.claude.com/docs/en/build-with-claude/effort) | TS SDK defaults to 'high'; 'medium' recommended for agentic workflows |
| 7 | [Anthropic: Modifying System Prompts](https://platform.claude.com/docs/en/agent-sdk/modifying-system-prompts) | Lean custom string preferred over heavy presets |
| 8 | [Anthropic: Streaming Output](https://platform.claude.com/docs/en/agent-sdk/streaming-output) | Structured output cannot be streamed; only final JSON available |
| 9 | [Aider: Repo Map](https://aider.chat/docs/repomap.html) | 1K-token structural map replaces blind codebase scanning |
| 10 | [Aider: Building Better Repo Maps](https://aider.chat/2023/10/22/repomap.html) | Tree-sitter + PageRank for relevance ranking |
| 11 | [Cursor: Dynamic Context Discovery](https://cursor.com/blog/dynamic-context-discovery) | "Only necessary data pulled into context window" |
| 12 | [Claude Code MCP Context Bloat](https://medium.com/@joe.njenga/claude-code-just-cut-mcp-context-bloat-by-46-9-51k-tokens-down-to-8-5k-with-new-tool-search-ddf9e905f734) | 46.9% token reduction with dynamic tool discovery (51K → 8.5K) |
| 13 | [Manus: Context Engineering Lessons](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus) | 5 dimensions: offload, reduce, retrieve, isolate, cache |
| 14 | [OpenAI: Practical Guide to Building Agents](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/) | Meet accuracy targets first, then optimize for cost/latency |
| 15 | [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | Design patterns for extended agent operations |
| 16 | [Context Rot Research](https://research.trychroma.com/context-rot) | Model accuracy degrades with increasing unfiltered context |

---

## 8. Appendix: Design Decisions Log

Decisions made during the design review process. Documenting these so future engineers understand *why*, not just *what*.

### Decision 1: Full file injection with Read fallback (not highlighted-lines-only)

**Options considered:**
- (a) Inject only the highlighted 10-30 lines, zero tools
- (b) Inject full file content, zero tools
- **(c) Inject full file content, `tools: [Read]` with `maxTurns: 3`** (chosen)
- (d) Keep current behavior (Claude reads via tool)

**Why (c):** The highlighted lines often reference imports, types, and functions defined elsewhere in the file. Without the full file, Claude's explanations become shallow ("this adds to a set" vs "this tracks visited nodes using a `Set<string>` so the UI can show explore-vs-revisit state"). The Read fallback costs almost nothing if unused but allows Claude to follow one critical import when needed.

### Decision 2: Lean custom system prompt (not `claude_code` preset)

**Options considered:**
- (a) `{ preset: 'claude_code', append: '...' }` — full Claude Code system prompt
- **(b) Custom string (~150 tokens)** (chosen)

**Why (b):** The `claude_code` preset includes 3-5K tokens of file editing rules, commit practices, and security guidelines — irrelevant for a teaching assistant. Loading them violates our own principle of keeping context tight. A 150-token custom string is sufficient.

### Decision 3: Per-schema session scoping (not single session for all calls)

**Options considered:**
- (a) Single session for plan + steps + responses (highest caching, highest risk)
- **(b) Per-schema sessions** (chosen): plan (one-shot), step content (shared session), responses (one-shot)
- (c) No sessions (defer entirely)

**Why (b):** Resuming a session with a different `outputFormat` JSON schema is untested in the SDK. Schema conflicts could cause silent failures. Per-schema scoping gives us caching benefits for the most repetitive calls (step content, 7+ per lesson) without risk.

### Decision 4: Same effort for prefetch as live (not `effort: 'low'`)

**Options considered:**
- (a) `effort: 'low'` for prefetch (faster generation)
- **(b) `effort: 'medium'` for prefetch** (chosen, same as live)

**Why (b):** Prefetched content is what the user sees. There's no second pass at higher quality. If prefetch produces noticeably worse explanations, the user perceives a quality drop on steps 2+ vs step 1. The speed gain comes from *parallelism* (generating while the user reads), not from reduced quality.

### Decision 5: Realistic caching expectations (not 85%)

The 85% latency reduction benchmark is for 100K-token prompts. Our prompts are ~2K tokens with ~150 tokens cacheable in the system prompt. **Realistic benefit: 5-15% latency reduction from caching** on our workload. The primary caching value is cost reduction (90% cheaper cache reads) and architectural separation (static vs dynamic).

### Decision 6: Deferred — progressive UI rendering

Structured output (`json_schema` mode) cannot be streamed incrementally. Progressive rendering would require either dropping structured output or switching to text + manual parsing. The 7 speed improvements should cut total time by ~55%. Progressive UI can be revisited if users still perceive the remaining ~1.5-2 min as too slow.
