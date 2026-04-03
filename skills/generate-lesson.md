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

Read the relevant source files. Understand the subject thoroughly before planning.

### Step 2: Plan the lesson

Create 6-10+ steps ordered from foundational to advanced:
1. First steps: set the scene — what does this feature/module do?
2. Middle steps: how is it built, what patterns are used, what decisions were made?
3. Later steps: the clever parts — optimizations, patterns, edge case handling
4. Final step: the most interesting/advanced concept

### Step 3: Generate content for each step

For each step, write a vivid explanation and ONE quiz question.

**Voice**: Sound like a sharp friend, not documentation. Reference specific code with `backticks`. Bold **key concepts** on first mention. Explain WHY, not just WHAT. Use concrete-before-abstract: show the code, explain behavior, then name the pattern.

**Code references**: The learner sees the actual source file in their editor. Do NOT include fenced code blocks in explanations. Instead reference code inline: `functionName()`, `variableName`. Point to what they can see: "Look at line 42 — notice how `dispatch()` fires before..."

**Question rules based on pedagogical layer**:
- "outcome" or "architecture" layers → `inputType: "choice"` (concept recognition)
- "rationale", "insight", or "challenge" layers → `inputType: "text"` (learner explains in own words)
- A lesson that is 100% multiple-choice is a bad lesson

For choice questions: provide 3-4 options, set `correctIndex`, and write `correctExplanation` + `incorrectExplanation`.

For text questions: write a `prompt` that asks WHY or HOW, and provide a `modelAnswer` — a thorough answer shown after the learner submits for self-assessment.

### Completeness

DO NOT skip logical progressions. If the code shows a clear progression, include EVERY step. Completeness beats brevity. If full coverage requires more than 10 steps, generate more.

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
  "synopsis": "string — one-paragraph summary",
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
        "explanation": "string — markdown teaching content",
        "prompt": "string — question for the learner",
        "inputType": "text | choice | none",
        "options": ["string — choice options (if choice)"],
        "correctIndex": 0,
        "correctExplanation": "string — shown on correct choice",
        "incorrectExplanation": "string — shown on wrong choice",
        "modelAnswer": "string — model answer for text questions (self-assessment)"
      }
    }
  ]
}
```

### Rules

- Every step must reference a real file with accurate 1-based line numbers
- Verify files exist by reading them before referencing
- Step IDs: "step-1", "step-2", etc.
- Mix choice and text questions — never all one type
- `modelAnswer` is required for text questions
- `correctIndex`, `correctExplanation`, `incorrectExplanation` required for choice questions
- Exclude node_modules, dist, build artifacts
