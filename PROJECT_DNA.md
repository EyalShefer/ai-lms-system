🚀 **SYSTEM PRESERVATION PROMPT (FOR AGENT)** 🚀
You are working on the "AI LMS System". Before writing ANY code, you must acknowledge the following CORE SYSTEMS. Do not break them while fixing new bugs:

# 1. 🧠 PEDAGOGICAL CORE (The Brain)
- **Logic:** The `generateUnitSkeleton` function MUST strictly follow Bloom's Taxonomy.
- **Rule:** Never generate random steps. You must strictly adhere to the following Matrix:
- **Logic:** Treat content as a HOLISTIC narrative, not disjointed facts. The Unit must tell a story.

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
- **Logic:** Testing is learning. Never leave a student stuck or confused.
- **Rule 1 (Progressive Hints):** EVERY interaction must include 3 levels of hints:
    1. **General:** Orientation ("Look at the second paragraph").
    2. **Specific:** Conceptual Focus ("Remember that X causes Y").
    3. **Almost Answer:** Strong nudge ("The word starts with T...").
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
- **Rule:** No empty loading states (use Skeletons). Ensure Wizard remains responsive (max-w logic).

# 5. 🧩 MODULE INTEGRITY
- **Rule:** Don't break the [App.tsx](cci:7://file:///c:/Users/eyal.BONUS/Desktop/ai-lms-system/src/App.tsx:0:0-0:0) routing. [handleWizardComplete](cci:1://file:///c:/Users/eyal.BONUS/Desktop/ai-lms-system/src/App.tsx:134:2-267:4) must handle the delicate handoff from Wizard -> Editor without flashing the Dashboard.

**INSTRUCTION:** If a user request contradicts these rules, STOP and warn the user. Prioritize system integrity over quick fixes.

# 6. 🧠 ADVANCED PEDAGOGICAL INTEGRITY (Refinements)
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

# 7. 🏗️ AI ARCHITECTURE (Brain & Hands)
## 7.1 The Core Concept
- **Logic:** To achieve "Parallel Speed" with "Linear Coherence", we split generation into two distinct roles.
## 6.5 Tone & Register (Grade 7+)
- **Rule:** For Grade 7 and above, avoid "Second-Person" narrative (e.g., "Imagine yourself...").
- **Requirement:** Use an **Objective, Historical Tone**. Treat the student as a researcher/scholar, not a child.

## 6.6 Categorization Logic
- **Rule:** Categories must be **Functional** or **Binary** (e.g., "Cause vs Effect", "Problem vs Solution", "Physical vs Digital").
- **Prohibition:** Do NOT use abstract or overlapping categories (e.g., "Feelings" vs "Experiences"). Categories must be mutually exclusive.

# 7. 🏗️ AI ARCHITECTURE (Brain & Hands)
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

# 8. 🛡️ STRICT INTEGRITY PROTOCOLS
## 8.1 Anti-Leakage (Topic Isolation)
- **Constraint:** A step MUST NOT reveal information belonging to future steps.
- **Mechanism:** The Brain assigns `forbidden_topics` which the Hands must explicitly avoid.

## 8.2 Anti-Hallucination (Strict Grounding)
- **Rule:** "If it's not in the Source Text, it doesn't exist."
- **Prohibition:** No external examples (e.g., modern concepts like "cyberbullying" in historical texts) unless explicitly present in the source.

## 8.3 Linguistic & Tonal Integrity
- **Negative Tone Constraint:** For Grade 7+, explicitly BAN "Second-Person" narrative ("Imagine yourself"). Force "Objective/Historical" tone.
- **Language Lock:** All output values, especially `model_answer` and "Evaluator Guidelines", MUST be in Hebrew.
# 9. 🧩 INTERACTION MATRIX & BLOOM MAPPING (Revised)
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