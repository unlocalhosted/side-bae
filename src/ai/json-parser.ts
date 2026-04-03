/**
 * Defensive JSON extraction from free-form LLM text.
 *
 * The VS Code LM API has no native structured output. This module extracts
 * JSON from text using multiple strategies, following Continue's
 * incrementalParseJson pattern.
 */

/**
 * Extract a JSON object from free-form text.
 * Tries: fenced code block → outermost braces → full text parse.
 * Throws with a descriptive message on failure.
 */
export function extractJSON<T = unknown>(text: string): T {
  const trimmed = text.trim();

  // Strategy 1: Extract from ```json ... ``` fenced block
  const fencedMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim()) as T;
    } catch {
      // Fall through to next strategy
    }
  }

  // Strategy 2: Find outermost { } braces
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
    } catch {
      // Fall through to next strategy
    }
  }

  // Strategy 3: Try parsing the entire text as JSON
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // All strategies failed
  }

  throw new Error(
    "Could not extract valid JSON from the response. Try rephrasing your question."
  );
}
