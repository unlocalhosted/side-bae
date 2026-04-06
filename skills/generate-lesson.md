# Side Bae: Generate a Full Lesson

Generate an interactive lesson with teaching content and quiz questions for every step. The output is a single JSON file consumed by the Side Bae VS Code extension — no AI needed at playback time.

## How to use

```
/side-bae-lesson [subject]
```

Example: `/side-bae-lesson how the virtual scroll engine works`

## Instructions

You are creating a complete, self-contained lesson. This means generating BOTH the lesson plan AND all teaching content + quiz questions in one pass.

### Step 1: Explore the codebase

Read the relevant source files. Understand the subject thoroughly before planning. Follow imports. Read callers, not just definitions. Understand the connections between files.

### Step 2: Plan the lesson

Create as many steps as the subject requires, ordered from foundational to advanced. A small utility might need 4 steps; a complex system needs 15-20+. Do NOT cap arbitrarily.

1. First steps: set the scene — what does this feature/module do? Where does data enter?
2. Middle steps: how is it built, what patterns are used, what decisions were made?
3. Later steps: the clever parts — optimizations, patterns, edge case handling
4. Final step: the most interesting/advanced concept — the payoff

### Step 3: Generate content for each step

For each step, write a vivid explanation and ONE quiz question.

**Voice**: Sound like a sharp friend, not documentation. Reference specific code with `backticks`. Bold **key concepts** on first mention. Explain WHY, not just WHAT. Use concrete-before-abstract: show the code, explain behavior, then name the pattern.

**Guided discovery approach** — CRITICAL:

NEVER lecture then quiz. Instead, guide the learner to discover the concept themselves:

BAD (lecture-then-quiz):
"This is the Observer Pattern. Subscribers register callbacks, and when state changes, all callbacks fire. Now, which pattern is this using?"

GOOD (guided discovery):
"Look at `listeners` on line 42. When `state` changes, every function in that array gets called. And `subscribe()` returns a function that removes the listener. You're looking at the **Observer Pattern** in action — objects observe state, and get notified when it changes."

The learner should feel like THEY understood it, not that you recited a textbook.

**Code references — CRITICAL**:
The learner sees the actual source file open in their editor with the relevant lines highlighted. Do NOT include fenced code blocks (```) or large code excerpts in your explanation. Instead, reference code inline: mention `functionName()`, `variableName`, `TypeName` in backticks. Point the reader to what they can see: "Look at line 42 — notice how `dispatch()` fires before the state actually updates."

The editor IS the code view. Your explanation is the narrative companion, not a code viewer.

**Question rules based on pedagogical layer** — MANDATORY:

You MUST select inputType based on the layer:
- "outcome" or "architecture" layers → `inputType: "choice"` (concept recognition, factual recall)
- "rationale", "insight", or "challenge" layers → `inputType: "text"` (learner explains in own words)
- If the layer is unspecified → alternate: use "text" if the previous step used "choice", and vice versa

**A lesson that is 100% multiple-choice is a BAD lesson.** The learner needs to articulate reasoning, not just pick letters. Aim for roughly 40-60% text questions.

For choice questions: provide 3-4 options, set `correctIndex`, and write `correctExplanation` + `incorrectExplanation`.
For text questions: write a `prompt` that asks WHY or HOW (not just WHAT), and provide a thorough `modelAnswer` — shown after the learner submits for self-assessment.

### Completeness — CRITICAL

DO NOT skip logical progressions. If the code shows a clear progression (base case → variant 1 → variant 2 → variant 3), include EVERY step in that progression. Each builds incremental understanding that the next step depends on. Skipping intermediate steps creates logical gaps — the learner won't understand step N+2 if they missed step N+1.

If full coverage requires 15 or 20 steps, generate all of them. Completeness beats brevity. There is NO step count cap.

Before finalizing, verify: could a reader follow your steps in order without any "wait, where did that come from?" moments? If not, you're missing a step.

### Self-check before outputting

1. Does the lesson cover the subject end-to-end, not just the obvious parts?
2. Are text questions and choice questions mixed (not 100% either)?
3. Does every `modelAnswer` provide genuine insight beyond "the correct answer is X"?
4. Do explanations reference code inline (no fenced code blocks)?
5. Could a learner follow the steps sequentially without knowledge gaps?
6. Is every file path real and every line number accurate?

## Output Schema

Write the output to `.side-bae/{id}.full-lesson.json` where `{id}` is a kebab-case slug.

```json
{
  "version": 1,
  "id": "string — kebab-case identifier",
  "subject": "string — what this lesson teaches",
  "generatedAt": "string — ISO 8601 timestamp",
  "depth": "foundational | intermediate | advanced",
  "concepts": ["string — named concepts/patterns covered"],
  "synopsis": "string — one-paragraph summary of what the learner will gain",
  "steps": [
    {
      "plan": {
        "id": "step-1",
        "title": "string — short step title",
        "file": "string — relative file path",
        "startLine": 1,
        "endLine": 30,
        "concepts": ["string — concepts taught"],
        "layer": "outcome | architecture | rationale | insight | challenge"
      },
      "content": {
        "explanation": "string — markdown teaching content. No fenced code blocks. Reference code inline with backticks.",
        "prompt": "string — question for the learner",
        "inputType": "text | choice | none",
        "options": ["string — choice options (if choice)"],
        "correctIndex": 0,
        "correctExplanation": "string — shown on correct choice",
        "incorrectExplanation": "string — shown on wrong choice",
        "modelAnswer": "string — REQUIRED for text questions. Thorough answer for self-assessment."
      }
    }
  ]
}
```

### Rules

- Every step must reference a real file with accurate 1-based line numbers — verify by reading the file
- Step IDs: "step-1", "step-2", etc.
- Mix choice and text questions — never all one type. Aim for 40-60% text.
- `modelAnswer` is REQUIRED for all text questions — it's the learner's only feedback in offline mode
- `correctIndex`, `correctExplanation`, `incorrectExplanation` are REQUIRED for all choice questions
- Exclude node_modules, dist, build artifacts
- Explanations must NOT contain fenced code blocks — the learner sees the real file in their editor
- Each explanation should be 3-6 sentences minimum with genuine insight
