/**
 * Standalone checkClaudeStatus for backward compatibility.
 *
 * extension.ts calls checkClaudeStatus(workspaceRoot) as a free function.
 * The new ClaudeCodeProvider has this as a method, but we keep this wrapper
 * so the old import path works until consumers migrate to AIProvider.
 */

import { ClaudeCodeProvider } from "../ai/claude-code-provider.js";
import type { AIProviderStatus } from "../ai/provider.js";

export async function checkClaudeStatus(
  workspaceRoot: string
): Promise<AIProviderStatus> {
  const provider = new ClaudeCodeProvider({ workspaceRoot });
  return provider.checkStatus();
}
