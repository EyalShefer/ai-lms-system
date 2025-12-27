🚀 **SYSTEM PRESERVATION PROMPT (FOR AGENT)** 🚀
You are working on the "AI LMS System". Before writing ANY code, you must acknowledge the following CORE SYSTEMS. Do not break them while fixing new bugs:

# 1. 🧠 PEDAGOGICAL CORE (The Brain)
- **Logic:** The `generateUnitSkeleton` function MUST strictly follow Bloom's Taxonomy.
- **Rule:** Never generate random steps. You must strictly adhere to the following Matrix:

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

# 2. 💾 DATA INTEGRITY (The Memory)
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