/** Shared types for the AI provider abstraction. */

export interface GenerationProgress {
  onProgress: (message: string) => void;
  onCancel: (callback: () => void) => void;
}

/**
 * Hints for provider-specific optimizations.
 * Providers ignore fields they don't support.
 *
 * Claude Code uses: effort, maxTurns, tools, resumeSessionId, persistSession.
 * VS Code LM ignores all of these.
 */
export interface QueryOptions {
  tools?: string[];
  maxTurns?: number;
  effort?: "low" | "medium" | "high";
  resumeSessionId?: string;
  persistSession?: boolean;
}
