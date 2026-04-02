# Ubiquitous Language

## Tour system

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Tour** | A guided, narrative explanation of code through interconnected stops in a codebase | Walkthrough, guide, tutorial |
| **Node** | A single stop in a tour, bound to a code region with an explanation | Stop, step, card, waypoint |
| **Edge** | A directed connection between two nodes, labeled with a continuation phrase | Link, connection, transition |
| **Entry node** | The first node visited when a tour begins | Start node, root |
| **Query** | The original user question that triggered tour generation | Prompt, question, input |
| **Tracked file** | A file examined during tour generation, pinned to a specific commit hash | Watched file, scanned file |

## Tour navigation

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Breadcrumb** | The ordered path of nodes visited during navigation | History, trail (reserved for investigations) |
| **Arrived via** | The edge label describing how the user reached the current node | Transition label, path label |
| **Edge visit state** | Whether a target is **new** (unvisited), **partial** (visited but has unvisited descendants), or **complete** (fully explored) | Status, progress |
| **Tour card** | The webview UI panel displaying the current node's content and navigation controls | Panel, detail view |
| **Summary** | An overview shown at tour start: graph visualization, file list, total node count | Introduction, overview |

## Lesson system

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Lesson** | An interactive, progressive teaching session about a codebase topic | Course, tutorial, module |
| **Lesson plan** | The high-level outline of a lesson: ordered steps with target files and concepts | Curriculum, syllabus |
| **Step** | A single teaching unit within a lesson, bound to a code region and a pedagogical layer | Stage, slide, section |
| **Step content** | The teaching material generated on-demand for a step: explanation, prompt, and answer format | Material, content block |
| **Step response** | AI feedback to the learner's answer: correctness judgment plus 2-3 sentence explanation | Feedback, evaluation, grade |
| **Learnable concept** | A discoverable topic in a codebase worth teaching (e.g., "Virtual Scrolling Engine") | Skill, topic, module |
| **Check result** | Whether a learner demonstrated understanding of a specific concept | Score, assessment |

## Lesson taxonomy

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Layer** | The pedagogical role of a step: **outcome**, **architecture**, **rationale**, **insight**, or **challenge** | Level, type, category |
| **Depth** | The prerequisite knowledge level: **foundational**, **intermediate**, or **advanced** | Difficulty, tier |
| **Step status** | Lifecycle state of a step: **upcoming**, **active**, **completed**, or **skipped** | Progress, phase |
| **Input type** | How the learner responds: **text** (free-form), **choice** (multiple choice), or **none** (read-only) | Answer format, response mode |

## Investigation system

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Investigation** | A guided bug diagnosis and fix workflow that progresses through sequential phases | Debug session, triage |
| **Phase** | A named stage in the investigation workflow, always in order: orient, investigate, diagnose, propose, verify, revise, ship, recap | Step (reserved for lessons), stage |
| **Investigation step** | A single unit of work within a phase, containing findings, a prompt, and optional suggested edit | Action, task |
| **Turn** | A single exchange in investigation history, from either the **investigator** (AI) or the **user** | Message, exchange |
| **Trail** | The breadcrumb of files examined during investigation, each tagged as context, problem, or fix | History, path |
| **Suggested edit** | A proposed code change with `oldText` and `newText` for applying a fix | Patch, diff, fix |
| **Report** | A markdown PR-ready summary generated at investigation end | Summary, write-up |

## Investigation phases

| Phase | Definition |
| --- | --- |
| **Orient** | Understand the issue context and reproduce the problem |
| **Investigate** | Scan relevant code to build a mental model |
| **Diagnose** | Identify the root cause |
| **Propose** | Suggest a fix with a suggested edit |
| **Verify** | Run tests to confirm the fix works |
| **Revise** | Adjust the fix based on test results |
| **Ship** | Create a PR for the fix |
| **Recap** | Summarize what was found and fixed |

## Feature discovery

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Feature** | A top-level capability or module discovered in a codebase | Component, service |
| **Feature tree** | A hierarchical representation of features, rendered in VS Code's tree view | Feature list, module map |
| **Recent change** | A logical grouping of git commits representing a single feature or fix | Diff, changelog entry |

## Node classification

| Term | Definition | Used in |
| --- | --- | --- |
| **kind** | A node's role in an investigation tour: **context**, **problem**, or **solution** | Investigation tours |
| **layer** | A node's pedagogical role in a lesson tour: **outcome**, **architecture**, **rationale**, **insight**, or **challenge** | Lesson tours |
| **concepts** | Named patterns or techniques a node teaches (e.g., "Observer Pattern", "Token Validation") | Both tours and lessons |
| **takeaway** | A single key sentence the learner should remember from a node | Tours |

## Sessions and engines

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Tour engine** | The stateful navigator that tracks position, history, and visit states within a tour | Controller, manager |
| **Lesson session** | The stateful orchestrator that manages lesson plan execution, step content generation, and learner responses | Lesson controller, lesson manager |
| **Investigation session** | The stateful orchestrator that manages phase progression and turn history | Investigation controller |
| **Tour player** | The top-level coordinator that connects sessions/engines to the webview UI | Renderer, presenter |

## Relationships

- A **Tour** contains one **entry node** and a map of **nodes** connected by **edges**
- A **Node** belongs to exactly one **Tour** and has zero or more outgoing **edges**
- An **Edge** connects a source **node** to a target **node** with a labeled continuation phrase
- A **Lesson plan** contains an ordered sequence of **steps**; each **step** generates **step content** on demand
- A **Lesson** produces a **Tour** for replay, where each **step** becomes a **node** tagged with its **layer**
- An **Investigation** progresses through **phases** in fixed order; each phase produces one or more **investigation steps**
- An **Investigation** produces a **Tour** for replay, where phases map to **node kinds** (orient/investigate -> context, diagnose -> problem, propose/revise/verify -> solution)
- A **Feature tree** is a hierarchical grouping of **features**; selecting a feature can launch a **Tour**, **Lesson**, or **Investigation**
- A **Learnable concept** is discovered by scanning the codebase and can be used to start a **Lesson**
- A **Recent change** groups git commits into a logical unit and can be used to generate a **Tour**

## Example dialogue

> **Dev:** "When a user clicks a feature in the **feature tree**, what happens?"
>
> **Domain expert:** "It depends on what they choose. They can generate a **tour** to understand the feature, start a **lesson** to learn the patterns it uses, or launch an **investigation** if there's a bug."
>
> **Dev:** "So a **tour** and a **lesson** are different things? They both show code with explanations."
>
> **Domain expert:** "They're structurally similar -- both produce **nodes** -- but a **tour** is a narrative you navigate freely via **edges**, while a **lesson** is a linear sequence of **steps** with prompts and answers. A **lesson** has **layers** and **depth** to scaffold teaching. A **tour** has **edges** and **breadcrumbs** for exploration."
>
> **Dev:** "And an **investigation**?"
>
> **Domain expert:** "An **investigation** is a guided workflow that moves through fixed **phases** -- orient, investigate, diagnose, propose, verify, revise, ship, recap. Each phase produces **investigation steps** with findings. The user participates via **turns**. At the end, all three -- tours, lessons, and investigations -- can be saved as a **tour document** for replay."
>
> **Dev:** "So the **tour document** is the universal persistence format?"
>
> **Domain expert:** "Exactly. An investigation tour uses **kind** (context/problem/solution) on its nodes. A lesson tour uses **layer** (outcome/architecture/rationale/insight/challenge). A standard tour uses neither -- just **edges** and **concepts**."

## Flagged ambiguities

- **"Step"** is used in both lessons (`LessonPlanStep`, `StepContent`) and investigations (`InvestigationStep`), but they are distinct concepts. A lesson **step** is a teaching unit with a prompt and expected answer. An investigation **step** is a finding within a **phase**. The types are explicitly separate, but verbal discussion should qualify: "lesson step" vs "investigation step."

- **"Node"** appears in three contexts: `TourNode` (tour stop), `TourGraphNode` (lightweight visualization), and `FeatureTreeNode` (sidebar tree item). Only `TourNode` is a core domain concept. The others are UI/rendering artifacts. In domain discussions, **node** should always mean a tour stop.

- **"Trail"** (investigation breadcrumb of files examined) vs **"breadcrumb"** (tour navigation history) -- these are analogous concepts in different modes. A **trail** tracks files with a classification (context/problem/fix). A **breadcrumb** tracks visited nodes. Don't interchange them.

- **"Concepts"** is used both as a property name (`node.concepts`, `step.concepts`) meaning "named patterns this code demonstrates" and colloquially to mean "ideas." In domain discussions, **concept** should always refer to a named, tagged pattern (e.g., "Observer Pattern", "Token Validation").

- **"Summary"** has three meanings: (1) tour start overview (`TourSummary`), (2) one-line step recap in lessons (`StepResponse.summary`), and (3) recent change description (`RecentChange.summary`). Context usually disambiguates, but prefer **tour summary**, **step summary**, or **change summary** when precision matters.

- **"Report"** is investigation-specific -- the markdown PR summary generated at recap. Don't use "report" for tour summaries or lesson recaps.
