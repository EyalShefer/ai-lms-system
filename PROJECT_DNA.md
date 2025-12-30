🚀 **SYSTEM PRESERVATION PROMPT (FOR AGENT)** 🚀
You are working on the "AI LMS System". Before writing ANY code, you must acknowledge the following CORE SYSTEMS. Do not break them while fixing new bugs:

# 1. 🧠 PEDAGOGICAL CORE (The Wizdi-Bot Standard)
## 1.0 CORE DIRECTIVES ("The Halls of Justice")
1. **Strict Grounding (Anti-Hallucination):**
   - Base all content ONLY on the provided `sourceText`.
   - **Manual Override:** When generating single questions via UI (Open/MC/Cloze, etc.), the full `course.fullBookContent` MUST be passed to the context. Title-only generation is FORBIDDEN.
   - **CRITICAL:** Do NOT invent metaphors, analogies, or "fluff" not present in the source.
2. **The "Interactive-Chunk" Rule (NO WALL OF TEXT):**
   - **CRITICAL:** Every single text chunk MUST be immediately followed by a question.
   - **PROHIBITED:** Do not output two text chunks in a row without a question in between.
   - **The Gap-Fill Rule:** If you have more chunks than requested interaction types, you MUST generate **Multiple Choice** questions for the intermediate chunks to ensure interaction at every step.
3. **The "Distinct-Chunk" Rule (Segmentation):**
   - Scan for ALL distinct logical segments (Case Studies, Periods).
   - **Constraint:** Do NOT merge multiple distinct topics into one step (e.g., "China" and "Alaska" must be separate).
4. **Logic Safety:**
   - **Categorization:** Categories must be **MUTUALLY EXCLUSIVE** (e.g., "Causes" vs "Results"). Never use overlapping categories like "Danger" vs "High Risk".
   - **Ordering:** Must be based on objective criteria found in the text (Time, Complexity).
5. **The "Zero-Text-Wall" Rule (V4 Anti-Batching):**
   - **CRITICAL:** The AI Generation Loop must inject a question after *every* single text chunk.
   - **Prohibition:** It is forbidden to output Text Chunk A -> Text Chunk B -> Question.
   - **Mandate:** The structure must be Text Chunk A -> Question A -> Text Chunk B -> Question B.
   - **Fallback:** If the user did not request enough question types, the AI must auto-generate "Multiple Choice" questions for the intermediate chunks.

## 1.1 The Bloom's Taxonomy Matrix (Strict Mapping)
| Bloom Level | Cognitive Goal | Allowed Interaction Types | Feedback Strategy |
| :--- | :--- | :--- | :--- |
| **Foundation** <br>*(Remember/Understand)* | Establish facts, definitions, and basic concepts. | • **Multiple Choice** (Single Correct)<br>• **True/False**<br>• **Matching** (Term <-> Definition) | **Direct correction.** <br>Explain clearly WHY the answer is correct/incorrect immediately. |
| **Connection** <br>*(Apply/Analyze)* | Understand relationships, processes, and categories. | • **Ordering** (Chronological/Logical)<br>• **Chat/Grouping** (Categorization)<br>• **Scenario MC** (Application) | **Progressive Hints.**<br>Do not give the answer immediately. Guide the user: "Look at paragraph 2...", "Think about the order of operations..." |
| **Synthesis** <br>*(Evaluate/Create)* | Critical thinking, judgment, and creation. | • **Open Question** (Reflection)<br>• **Complex Scenario MC** (Judgment)<br>• **Debate** (Bot Interaction) | **Reflective/Model Answer.**<br>For open questions, provide a "Model Answer" for comparison. Encourage deeper thought ("What if X changed?"). |

## 1.2 Feedback Architecture (Detailed)
- **Immediate Feedback:** Must be provided for *every* closed interaction (MC, Ordering, Matching).
- **Reference Back:** Feedback must explicitly cite the `sourceText` if available (e.g., "As described in the 'History' section...").
- **Bot Persona Nuance:**
    - *Socratic:* Answers a question with a guiding question.
    - *Coach:* Challenges correct answers to ensure deep understanding.
    - *Teacher:* Encourages and simplifies.

## 1.3 Complexity Adaptation (Age Appropriateness)
- **Logic:** The `gradeLevel` parameter is a HARD CONSTRAINT, not a suggestion.
- **Rule:** If the `sourceText` is academic/complex but `gradeLevel` is young (Elementary/Middle School):
    - **MUST:** Rewrite content in simple language.
    - **MUST:** Break long paragraphs into short chunks.
    - **MUST:** Explicitly explain difficult terms.
    - **FORBIDDEN:** Copy-pasting complex blocks without adaptation.
- **Prompt Requirement:** Always include: "ADAPT COMPLEXITY TO TARGET AUDIENCE: ${gradeLevel}".

## 1.4 Pedagogical Scaffolding (Hints & Feedback)
- **Logic:** Testing is learning. Guide the student to the answer WITHOUT giving it away.
- **Rule 1 (Progressive Hints):** EVERY interaction must include 2-3 levels of hints using the **Scaffolding** method:
    1. **Level 1 (Location Pointer):** Point to the specific text segment. "Look closely at the sentence starting with..." (Hebrew: "שים לב למשפט שמתחיל ב...").
    2. **Level 2 (Concept Simplification):** Rephrase the relevant sentence in simpler words. "The text explains X... which option matches?"
    3. **Level 3 (Almost Answer):** Strong nudge if needed.
- **Rule 2 (Feedback Architecture):**
    - **Incorrect:** Explain WHY the specific choice is wrong ("Option B talks about X, but we need Y").
    - **Correct:** Affirmative + brief reinforcement.
- **Rule 2 (Feedback Architecture):**
    - **Incorrect:** Explain WHY it's wrong + **MANDATORY Source Reference** ("As written in line 5...").
    - **Correct:** Affirmative + brief reinforcement.
- **Rule 3 (UI/UX Behavior):**
    - **Hint Timing:** Hints are **HIDDEN** by default. They appear only AFTER a mistake or manual request, to encourage independent thinking.
    - **Open Question Loop:** Must support **"Draft -> Feedback -> Retry"**. The system guides, it doesn't just judge. Allow students to fix their answer.
# 2. 💾 DATA INTEGRITY (The Memory)
## 2.1 Content Integrity (No Empty Blocks)
- **Logic:** The AI is creative but inconsistent. The Code must be Robust.
- **Rule:** Frontend components (Ordering, Categorization) MUST NEVER receive empty items.
- **Implementation:** The Mapping Layer (`mapSystemItemToBlock`) must normalize diverse AI outputs (strings, objects, `text` vs `content` props) into a STRICT schema before data reaches the UI.

## 2.2 Ingestion Wizard Data
- **Logic:** The `course.wizardData` object is the Source of Truth.
- **Rule:** NEVER delete or flatten this object. Always map `wizardData.settings` (like `botPersona`, `activityLength`) to the generation functions.

# 3. 🛡️ SECURITY & AUTH (The Shield)
- **Logic:** All DB writes must pass Firestore Rules (`auth != null`).
- **Rule:** Never bypass `useAuth`. Never expose API Keys (use `openaiProxy`).

# 4. 🎨 UI/UX DNA (The Skin)
- **Logic:** Glassmorphism (`bg-white/90`, `backdrop-blur`) + RTL Alignment.
- **Logic:** Glassmorphism (`bg-white/90`, `backdrop-blur`) + RTL Alignment.
- **Rule 1:** No empty loading states (use Skeletons). Ensure Wizard remains responsive (max-w logic).
- **Rule 2 (Data Safety):** The Editor must implement "Unsaved Changes Protection" (`isDirty` state). A user attempting to leave with unsaved changes must be warned via a distinct alert.
- **Rule 3 (AI Assist):** Every content block type (**Categorization, Ordering, Fill-in-Blanks, Memory Game**) must offer a "Create with AI" button (`handleAutoGenerate...`) to reduce teacher friction.

# 5. 🧩 MODULE INTEGRITY & SYSTEM MAP
## 5.1 Core Modules (The Nervous System)
- **Gemini Service (`src/gemini.ts`):** The Brain & Hands AI Engine. Manages the generation lifecycle, prompt engineering, and parsing logic (`mapSystemItemToBlock`).
- **Unit Editor (`src/components/UnitEditor.tsx`):** The Teacher's Workshop. Handles manual editing, "Unsaved Changes" protection (`isDirty`), and Media Integration (Upload/AI/Link).
- **Course Player:** The Student Experience. Renders the interactive blocks and manages the "Wizdi Pyramid" flow.
- **Citation Service (`src/services/citationService.ts`):** The Grounding Engine. Splits text into paragraphs and enforces the [Inline Citation] protocol.

## 5.2 Routing Rules
- **Rule:** Don't break the [App.tsx](cci:7://file:///c:/Users/eyal.BONUS/Desktop/ai-lms-system/src/App.tsx:0:0-0:0) routing. [handleWizardComplete](cci:1://file:///c:/Users/eyal.BONUS/Desktop/ai-lms-system/src/App.tsx:134:2-267:4) must handle the delicate handoff from Wizard -> Editor without flashing the Dashboard.

# 6. 📜 INLINE CITATIONS & GROUNDING V2
## 6.1 The "NotebookLM" Standard
- **Goal:** Every claim must be verifiable.
- **Mechanism:** `CitationService.chunkText` splits source material into numbered paragraphs ([1], [2], [3]).
- **Rule:** The AI must append `[X]` to every factual statement.
- **UI:** The Course Player must render these citations as clickable links that scroll the Source Text into view (Split View).

## 6.2 Grounding Prompt Protocol
- **Constraint:** System Prompts must include:
  1. **Numbered Context:** The source text pre-processed with IDs.
  2. **Strict Citation Rule:** "Every single claim... MUST be followed by a citation."
  3. **No Outside Knowledge:** "If it's not in the text, it doesn't exist."

**INSTRUCTION:** If a user request contradicts these rules, STOP and warn the user. Prioritize system integrity over quick fixes.

# 7. 🧠 ADVANCED PEDAGOGICAL INTEGRITY (Refinements)
## 6.1 Micro-Learning Progression (The "Anti-Amnesia" Rule)
- **Problem:** Parallel generation causes each step to repeat definitions (Redundancy).
- **Rule:** Each step must assume the previous steps have been read.
- **Implementation:** "Treat this step as Chapter X of a continuous story. Do NOT define terms defined in Chapters 1-(X-1). Focus ONLY on the new sub-topic in the context of the whole."

## 6.2 Implicit Ordering (The "Anti-Spoiler" Rule)
- **Problem:** Numerical lists in text make "Order the steps" questions trivial visual matching tasks.
- **Rule:** IF interaction is `ordering`:
    - **Text:** MUST be written as a narrative flow (paragraphs only). NO numbered lists.
    - **Question:** Items must be paraphrased (synonyms/rephrasing) to force reading comprehension.

## 6.3 Concrete Analogies (Age Adaptation)
- **Target:** Grades 1-6.
- **Rule:** Every abstract/technical term (e.g., "Chlorophyll", "Molecule") MUST be immediately followed by a concrete analogy from daily life (e.g., "like a solar panel on a roof").

## 6.4 Dynamic Feedback Guidelines
- **Open Questions:** Do not provide a static "Correct Answer". Instead, provide "Evaluator Guidelines" for the Tutor AI (e.g., "Check if the student mentioned both X and Y").

# 8. 🏗️ AI ARCHITECTURE (Brain & Hands)
## 7.1 The Core Concept
- **Logic:** To achieve "Parallel Speed" with "Linear Coherence", we split generation into two distinct roles.
## 6.5 Tone & Register (Grade 7+)
- **Rule:** For Grade 7 and above, avoid "Second-Person" narrative (e.g., "Imagine yourself...").
- **Requirement:** Use an **Objective, Historical Tone**. Treat the student as a researcher/scholar, not a child.

## 6.6 Categorization Logic
- **Rule:** Categories must be **Functional** or **Binary** (e.g., "Cause vs Effect", "Problem vs Solution", "Physical vs Digital").
- **Prohibition:** Do NOT use abstract or overlapping categories (e.g., "Feelings" vs "Experiences"). Categories must be mutually exclusive.

# 8. 🏗️ AI ARCHITECTURE (Brain & Hands)
## 7.1 The Core Concept
- **Logic:** To achieve "Parallel Speed" with "Linear Coherence", we split generation into two distinct roles.
- **Rule:** Never let a "Step Bot" (Hands) make global decisions. Never let the "Skeleton Bot" (Brain) write specific content.

## 7.2 The Brain (`generateUnitSkeleton`)
- **Role:** Holistic Commander.
- **Responsibilities:**
    1. **Holistic Analysis:** Reads the *entire* source text to understand the big picture.
    2. **Strict Segmentation ("Divorce"):** Splits the narrative into distinct, NON-OVERLAPPING chunks. Use "Logical Chunking" to prevent merging distinct eras.
    3. **Topic Policing:** Assigns strict `narrative_focus` (Allowed) and `forbidden_topics` (Banned) to each step.
- **Output:** A roadmap with logical boundaries.

## 7.3 The Hands (`generateStepContent`)
- **Role:** Focused Executor.
- **Responsibilities:**
    1. **Blind Obedience:** Writes content *strictly* within the `narrative_focus` provided by the Brain.
    2. **Anti-Amnesia:** Assumes the user read previous steps (no re-definitions).
    3. **Age Adaptation:** Applies "Concrete Analogies" and Simplification.
- **Output:** A single, polished learning block that fits perfectly into the larger puzzle.

# 9. 🛡️ STRICT INTEGRITY PROTOCOLS
## 8.1 Anti-Leakage (Topic Isolation)
- **Constraint:** A step MUST NOT reveal information belonging to future steps.
- **Mechanism:** The Brain assigns `forbidden_topics` which the Hands must explicitly avoid.

## 8.2 Anti-Hallucination (Strict Grounding)
- **Rule:** "If it's not in the Source Text, it doesn't exist."
- **Prohibition:** No external examples (e.g., modern concepts like "cyberbullying" in historical texts) unless explicitly present in the source.

## 8.3 Linguistic & Tonal Integrity
- **Negative Tone Constraint:** For Grade 7+, explicitly BAN "Second-Person" narrative ("Imagine yourself"). Force "Objective/Historical" tone.
- **Language Lock:** All output values, especially `model_answer` and "Evaluator Guidelines", MUST be in Hebrew.

## 8.4 Pedagogical Safety Valve (Bloom-Preserving Fallback)
- **Problem:** Strict Grounding sometimes clashes with rigid Interaction Types (e.g., asking for an Order when text has no sequence).
- **Rule:** If the requested Interaction Type is impossible given the text, the AI MUST trigger a **Bloom-Preserving Fallback**.
- **The Matrix:**
    1. **Ordering (Apply/Analyze) Failed?** -> Fallback to **Categorization** or **Cloze** (Keep Level 2).
    2. **Categorization (Apply/Analyze) Failed?** -> Fallback to **Cloze** (Keep Level 2).
    3. **Memory Game (Remember) Failed?** -> Fallback to **Multiple Choice** (Keep Level 1).
- **Prohibition:** NEVER return broken JSON or empty lists. Better to degrade the *Type* than to break the *App*.
# 10. 🧩 INTERACTION MATRIX & BLOOM MAPPING (Revised)
## 9.1 Remember (Knowledge & Recall)
- **Primary Tool:** `memory_game` (Visual/Text Pairs).
- **Secondary Tool:** `multiple_choice` (Standard).
- **Goal:** Recall facts, definitions, and dates.

## 9.2 Understand (Comprehension)
- **Primary Tool:** `fill_in_blanks` (Contextual Cloze).
- **Secondary Tool:** `true_false` (Interpretation).
    - *Constraint:* Must require interpreting the text, not just Fact Check. "Does the author imply X?" rather than "Is X true?".

## 9.3 Apply & Analyze (Process & Logic)
- **Tool A:** `categorization` (Distinguishing attributes).
- **Tool B:** `ordering` (Logical Sequence / Syllogism).
    - *Constraint:* Focus on PROCESS logic, not rote memorization of dates.

## 9.4 Evaluate & Create (Synthesis)
- **Sole Tool:** `open_question` (Argumentation & Synthesis).
- **Logic:** The only space for original thought and justifiction.

# 11. 🔧 TECHNICAL ARCHITECTURE & STANDARDS (Phase 4)
## 10.1 The "No Any" Policy (Strict Typing)
- **Problem:** `any` types hide bugs and break the "Mirror Reality" principle.
- **Rule:** ALL functional code must use strict TypeScript interfaces defined in `src/types/`.
    - **Forbidden:** Explicit `any`, `unknown` (unless strictly checked).
    - **Authorized Types:** `RawAiItem` (Input), `MappedLearningBlock` (Output), `UnitSkeleton` (Internal).
    - **Status:** *Partial Compliance*. Some legacy blocks in `courseTypes.ts` still use `any`. improving this is a Priority.

## 10.2 The "Mirror Reality" Data Principle
- **Logic:** The code must reflect the data *as it is*, not as we wish it to be.
- **Rule:** Do not force strict schemas on the AI's *output* directly. Map the "Raw" chaotic AI JSON into a "Strict" internal model using a dedicated parser (`mapSystemItemToBlock`).
- **Mechanism:** `RawAiItem` (Union of all possible AI mistakes) -> `MappedLearningBlock` (Strict internal state).

## 10.3 Testing Strategy (Safety Net)
- **Requirement:** No refactoring without a Safety Net.
- **Golden Master Tests:** 
    - Before touching `gemini.ts` or critical logic, run `src/gemini.test.ts`.
    - These snapshot tests guard against regression in the Mapping Logic.
- **Verification:** Unit tests must pass (`npx vitest`) before any commit.

## 10.4 The "Shared Types" Architecture (UI Integration)
- **Logic:** Types should not be trapped in the backend.
- **Rule:** Core Data Structures (`ActivityBlock`, `Assignment`) must live in `src/courseTypes.ts`.
- **Mechanism:** `ActivityBlock` is a **Discriminated Union** (e.g., `{ type: 'multiple-choice', content: MultipleChoiceContent }`). Consumers (UI) MUST use **Type Guards** (e.g., `switch(block.type)`) to access specific content safely.
- **Strict State:** The main `App.tsx` state (`currentAssignment`) must be typed as `Assignment | null`, forbidding `any`.

## 10.5 Development Environment & Auth
- **Problem:** Google/Firebase Auth is difficult to automate or use offline/locally.
- **Solution:** "Mock Login" Bypass.
- **Mechanism:** 
    - `AuthContext` exposes a `mockLogin()` function.
    - A "Dev Login" button appears on the Login screen ONLY when `import.meta.env.DEV` is true.
    - It sets a strict `MOCK_USER` (satisfying Firebase `User` interface) into the global state.
- **Constraint:** This bypass MUST be stripped/disabled in Production builds (guaranteed by `import.meta.env.DEV`).

# 12. 🏗️ ACTIVITY STRUCTURE & PACING (The "Wizdi Pyramid")
Educational activities follow a "Scaffolding" structure to ensure learner confidence and depth:

## 11.1 The Distribution Rules
1. **Foundation (Start):** 30-40% of questions focus on Levels 1 (Remember/Understand).
2. **Process (Middle):** 40% of questions focus on Level 2 (Apply/Analyze).
3. **Synthesis (End):** 20% of questions focus on Level 3 (Evaluate/Create).

## 11.2 The Logic (Hard Constraints)
- **Constraint 1:** Never place a Level 3 question as the first step.
- **Constraint 2:** Specific Distribution by Length:
    - **Short (3 Steps):** 1 Remember -> 1 Analyze -> 1 Create.
    - **Long (7 Steps):** 2 Remember -> 3 Apply/Analyze -> 2 Evaluate/Create.

# 13. 🕹️ OPERATIONAL MODES (V5 Architecture)
## 13.1 Philosophy
The system behaves differently based on the user's explicit intent. We distinguish between **LEARNING** (Pedagogy) and **ASSESSMENT** (Verification).

## 13.2 LEARNING MODE (`mode: 'learning'`)
- **Goal:** Scaffolding, Mentoring, Engagement.
- **Structure:** `Text Chunk -> Question -> Text Chunk -> Question`.
- **Content:**
    - **Teach Content:** Present. Explains concepts before asking.
    - **Tone:** Encouraging, "Wizdi-Bot" Mentor.
    - **Hints:** **MANDATORY**. 2-3 progressive hints per question.
    - **Feedback:** Educational ("Great job! You understood X...").

## 13.3 ASSESSMENT MODE (`mode: 'assessment'`)
- **Goal:** Discrimination, Testing, Verification.
- **Structure:** `Question -> Question -> Question` (Sequence of Items).
- **Strict Protocol:**
    - **Teach Content:** **BANNED**. No teaching blocks allowed.
    - **Tone:** Neutral, Objective, "Strict Examiner".
    - **Hints:** **FORBIDDEN**. Empty array `[]`.
    - **Feedback:** Discriminative ("Correct. X matches Y because...").
- **Blacklisted Activity Types (Strictly Prohibited):**
    - **Interactive Chat:** Risk of answer leakage.
    - **Memory Game:** Gaming mechanic, prone to guessing.
    - **Podcast:** Passive consumption.
    - **Gem Link:** External exit risk.
- **Bloom Taxonomy:** Focuses on higher order (Analyze, Evaluate).

## 13.4 Trigger Logic
- **Cloud Function:** `generateLessonPlan` accepts `data.mode` ('learning' | 'assessment').
- **Brain (Stage 1):** Switches strategy from "Divorce to Teach" to "Scan to Test".
- **Hands (Stage 2):** Switches system prompt to enforce "No Hints" and "No Teach Content".

# 14. 🕵️ STUDENT PROFILING ENGINE ("The Silent Observer")
## 14.1 Philosophy
The system tracks more than just "Correct/Incorrect". It builds a granular behavioral profile to understand *how* the student learns.

## 14.2 Data Schema (Firestore)
- **Path:** `users/{userId}/profile/stats`
- **Performance:**
    - `average_response_time_sec`: Rolling average of thinking time.
    - `global_accuracy_rate`: 0.0 to 1.0.
    - `error_rate_by_topic`: Map of mistakes per topic.
- **Behavioral:**
    - `hint_dependency_score`: (0.0 - 1.0) Do they ask for help immediately?
    - `retry_persistence`: Do they try again after failure?
    - `media_preference`: Score for text vs video vs gamified content.

## 14.3 Telemetry & Aggregation
- **Frontend Hook:** `useStudentTelemetry` tracks precise events (Question Start, Hint Request, Answer Submit).
- **Backend Service:** `profileService.ts` aggregates raw session data into the persistent profile using atomic transactions.

# 15. 🤖 AUTOMATED PROMPT ENGINEERING ("Smart Grouping")
## 15.1 Philosophy
Transforming "Classroom Groups" into "AI Instructions". The teacher clicks a group, the AI receives a tailored persona.

## 15.2 The Logic (LessonDistributor)
| Group Type | Bloom Level | Tone | Scaffolding | Preferred Modules |
| :--- | :--- | :--- | :--- | :--- |
| **Remediation** | Remember / Understand | Encouraging / Mentor | High (More Hints) | Memory Game, Sorting, Simple Quiz |
| **Standard** | Apply / Analyze | Balanced | Standard | Multiple Choice, Matching |
| **Challenge** | Evaluate / Create | Intellectual / Socratic | Low (Less Hints) | Open Questions, Logic Ordering, Escape Room |

## 15.3 Workflow
1. **Selection:** Teacher selects a group in `SmartGroupingPanel`.
2. **Translation:** `generateGroupConfig` converts the group type into specific system prompts ("Break down complex terms", "Ask open questions").
3. **Queueing:** A job is pushed to `lesson_generation_queue` with the `studentIds` list for auto-assignment.
