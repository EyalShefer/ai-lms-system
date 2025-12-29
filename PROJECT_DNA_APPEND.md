
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
- **Content:**
    - **Teach Content:** **BANNED**. No teaching blocks allowed.
    - **Tone:** Neutral, Objective, "Strict Examiner".
    - **Hints:** **FORBIDDEN**. Empty array `[]`.
    - **Feedback:** Discriminative ("Correct. X matches Y because...").
- **Bloom Taxonomy:** Focuses on higher order (Analyze, Evaluate).

## 13.4 Trigger Logic
- **Cloud Function:** `generateLessonPlan` accepts `data.mode` ('learning' | 'assessment').
- **Brain (Stage 1):** Switches strategy from "Divorce to Teach" to "Scan to Test".
- **Hands (Stage 2):** Switches system prompt to enforce "No Hints" and "No Teach Content".
