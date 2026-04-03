export type {
  AIProvider,
  AIProviderCapabilities,
  AIProviderStatus,
} from "./provider.js";

export type { GenerationProgress, QueryOptions } from "./types.js";

export { ClaudeCodeProvider } from "./claude-code-provider.js";
export type { ClaudeCodeProviderOptions } from "./claude-code-provider.js";

export { VSCodeLMProvider } from "./vscode-lm-provider.js";
export type { VSCodeLMProviderOptions } from "./vscode-lm-provider.js";

export { createProvider } from "./create-provider.js";
export type { ProviderChoice, ProviderConfig } from "./create-provider.js";
