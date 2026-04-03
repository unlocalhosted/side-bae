/**
 * Backward-compatibility shim.
 *
 * All logic has moved to src/ai/claude-code-provider.ts.
 * This file re-exports under the old names so existing imports keep working
 * until consumers are migrated to the AIProvider interface.
 */

export { ClaudeCodeProvider as ClaudeAdapter } from "../ai/claude-code-provider.js";
export type { ClaudeCodeProviderOptions as ClaudeAdapterOptions } from "../ai/claude-code-provider.js";
export type { GenerationProgress, QueryOptions } from "../ai/types.js";
export type { AIProviderStatus as ClaudeStatus } from "../ai/provider.js";

// Re-export the standalone function under its old name
export { checkClaudeStatus } from "./adapter-compat.js";
