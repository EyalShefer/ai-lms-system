# Adaptive Differential Learning System (ADLS) Specification
## Technical & Pedagogical Architecture Document

**Version:** 1.0.0
**Date:** December 31, 2025
**Author:** Senior EdTech Architect & AI Learning Scientist

---

## 1. Executive Summary
The transition from a linear "content consumption" model to an **Adaptive Differential Learning System (ADLS)** represents a fundamental shift in our pedagogical architecture. We are moving from a static "One Size Fits All" approach to a dynamic "Knowledge Graph" traversal, where the system acts as a real-time tutor that observes, analyzes, and adapts to every student interaction.

This specification outlines the **"Wizdi Adaptive Engine"**, a system capable of scaffolding struggling learners while continuously challenging advanced students (Zone of Proximal Development), scalable to thousands of concurrent sessions.

---

## 2. Pedagogical Framework: The "Brain" Logic

### 2.1 Theoretical Foundations
To ensure pedagogical validity, the system relies on three core theoretical models:

1.  **Item Response Theory (IRT):**
    *   We move beyond binary scoring (0/1). Every question is a measuring instrument defined by:
        *   **Difficulty ($\beta$):** Probability of a correct answer.
        *   **Discrimination ($\alpha$):** How well it differentiates high vs. low performers.
        *   **Guessing Parameter ($c$):** Probability of guessing correctly (lower for Open Questions/Ordering).

2.  **Zone of Proximal Development (ZPD):**
    *   **The Golden Rule:** The system aims to serve content where the probability of success is **~60-70%**.
    *   **Too Easy (>90%):** Boredom → Advance Difficulty.
    *   **Too Hard (<40%):** Frustration → Activate Scaffolding/Remediation.

3.  **Bayesian Knowledge Tracing (BKT):**
    *   The "Student Model" is not a static score but a probabilistic state.
    *   $P(L_n)$: Probability the student knows the skill after step $n$.
    *   We update this probability after *every* interaction, accounting for "Slipping" (knew it but faltered) and "Guessing" (didn't know but got lucky).

### 2.2 Defining Mastery
A concept is marked as **"Mastered"** only when:
*   $P(L) > 0.95$ (High probability of knowledge).
*   **Consistency:** Correct answers across 3 distinct difficulty levels.
*   **Fluency:** Response time converges to the "Expert Baseline" (fast and accurate).

---

## 3. System Architecture & Data Structure

### 3.1 The "Smart Question" Schema
The atomic unit of the system is no longer a simple text block but a context-aware **Smart Learning Item**.

**JSON Schema Definition:**
```json
{
  "id": "q_algebra_105",
  "content": {
    "question_text": "Solve: 2x + 4 = 10",
    "type": "multiple_choice"
  },
  "metadata": {
    "topic": "linear_equations",
    "difficulty_level": 0.45,  // IRT Parameter (0.0 - 1.0)
    "bloom_taxonomy": "apply", // Cognitive Level
    "estimated_time_sec": 45
  },
  "adaptive_logic": {
    "distractors": [
      {
        "value": "x=7",
        "error_tag": "arithmetic_error",
        "next_action": "retry_with_hint"
      },
      {
        "value": "x=3",
        "error_tag": null, // Correct Answer
        "next_action": "increase_difficulty"
      },
      {
        "value": "x=14",
        "error_tag": "conceptual_error_order_of_ops",
        "feedback": "Remember to subtract 4 before dividing.",
        "next_action": "remediate_concept" // Trigger 'remediate_order_of_ops'
      }
    ]
  },
  "relations": {
    "prerequisite_skills": ["basic_arithmetic", "variable_concept"],
    "scaffolding_id": "q_algebra_105_easy", // Pre-generated simpler version
    "enrichment_id": "q_algebra_105_hard"   // Pre-generated harder version
  }
}
```

### 3.2 The Student Model (Vector State)
We must expand `profileService.ts` to track granular state vectors rather than just global accuracy.

| Attribute | Type | Description |
| :--- | :--- | :--- |
| **Proficiency Vector** | `Map<TopicID, 0.0-1.0>` | Real-time mastery score per micro-topic. |
| **Error Fingerprint** | `Map<ErrorTag, Count>` | Frequency of specific logical fallacies (e.g., `sign_error` vs `concept_error`). |
| **Fluency Rate** | `float` | Avg response time vs. expected time. |
| **Confidence Index** | `0.0-1.0` | Derived from consistency and explicit confidence checks. |

### 3.3 The Policy Engine (Algorithm)
The backend logic (Cloud Function) executed between steps:

> **Algorithm: Next Step Selection**
> 1.  **Evaluation:** Receive `(Correct/Incorrect, Time, AnswerID)`.
> 2.  **Update Model:** Apply BKT update to `ProficiencyVector`.
> 3.  **Strategy Selection:**
>     *   *Correct + Fast* → **Challenge** (Difficulty +0.1, Enrichment).
>     *   *Correct + Slow* → **Reinforce** (Same Difficulty, Fluency Check).
>     *   *Incorrect + Slip Tag* → **Retry** (Same Question + Hint).
>     *   *Incorrect + Concept Tag* → **Remediate** (Switch to Explanation/Scaffolding).
> 4.  **Query Next:** `SELECT * FROM Questions WHERE topic=X AND difficulty≈NewDiff AND exclude=History`.

---

## 4. UI/UX Implications: The "Sequential View"

To enable true adaptivity, the frontend must transition from a **List View** (`map` over all blocks) to a **Wizard/Sequential View** (State Machine).

### 4.1 The "Wizard Mode" Necessity
*   **Current State:** Student sees Questions 1-5. They can skip Q1 and do Q5.
*   **Problem:** This breaks the dependency graph. Q2's existence depends on Q1's outcome.
*   **New State:** Student sees **only Q(current)**.
*   **Mechanism:**
    *   Submission triggers a `POST /nextStep`.
    *   Server responds with the next JSON block.
    *   UI renders the new block with a transition animation.

### 4.2 Engagement Maintenance
*   **Goal Gradient Effect:** Since the "finish line" is hidden/dynamic, we must show progress differently.
*   **Mastery Bar:** Instead of "Questions: 1/10", show "Topic Mastery: 45%". The bar fills as they demonstrate understanding (via BKT probability).
*   **Streaks & Micro-Feedback:** Use the existing Gamification Service to reward *effort* and *improvement*, not just completion.

### 4.3 Gamified Feedback Loop (The "Dopamine Cycle")
To ensure student persistence in an undefined-length session, we implement specific micro-interactions:
*   **Three-State Button:** The primary action button morphs through states: "Check" (Lime) → "Correct/Continue" (Green) or "Incorrect/Review" (Red). This reduces cognitive load.
*   **Immediate Gratification:** XP "floaters" and Streak "flames" appear immediately upon success, providing visceral confirmation of competence.
*   **Combos:** Consecutive correct answers trigger a multiplier effect, encouraging focus and reducing "guessing" behavior.
*   **Adaptive Toasts:** When the system (BKT) detects a significant leap in mastery ($P(L) > 0.8$), a visual "Challenge Unlocked" toast appears, explicitly informing the user that the system is adapting to their high performance.

---

## 5. Teacher's Role & Generative AI Pipeline

Teachers cannot manually author complex branching logic. We will use **Gemini 1.5 Pro** as a "Content Multiplier".

### 5.1 The "Content Factory" Pipeline
**Input:** Teacher writes **1 Base Question**.
**Process:** System acts as a factory using the following AI Prompt:

```markdown
**System Instruction:**
You are an expert Pedagogical AI Engine.
**Goal:** Transform raw teacher input into a "Smart Learning Item" JSON.

**Task:**
1.  **Difficulty:** Rate 0.0-1.0.
2.  **Bloom:** Classify taxonomy level.
3.  **Distractors:** Generate 3 plausible wrong answers with specific `error_tags` (e.g., "calculation_error", "misconception").
4.  **Variants:**
    *   **Scaffolding:** A simpler version (Level -1).
    *   **Enrichment:** A harder version (Level +1).

**Output:** Strict JSON matching schema.
```

### 5.2 The Insight Engine (Reporting)
Teachers receive a "Pedagogical Insight Report" rather than a raw score sheet.

**Prompt Logic:**
*   **Input:** Student's JSON Session Log (interactions, times, error_tags).
*   **Analysis:** Compare `response_time` vs `correctness`. Identify failing `error_tags`.
*   **Output:**
    *   "Executive Summary": Mastery Level.
    *   "Weakness Analysis": Specific conceptual gaps (e.g., "Consistently fails negative numbers").
    *   "Actionable Recommendation": "Assign 'Negative Numbers' remediation unit."

---

## 6. Implementation Roadmap

### Phase 1: Data Enrichment (The Foundation)
*   **Task:** Run a batch job on existing Firestore content.
*   **Action:** Feed every Question Block through the **Content Factory Pipeline** to generate `metadata`, `distractors`, and `error_tags`.
*   **Result:** A "Smart" database ready for querying.

### Phase 2: Player Refactor (The Interface)
*   **Task:** Create `SequentialCoursePlayer.tsx`.
*   **Action:** Implement a State Machine (`currentStep`, `history`) instead of a rendered list.
*   **Action:** Implement `handleNextStep()` which fetches the next block from the server.

### Phase 3: The Brain (The Logic)
*   **Task:** Implement `getNextQuestion` Cloud Function.
*   **Action:** Logic to receive `(userId, result)` and return `(nextBlock)`.
*   **Action:** Integrate `BKT` logic into `profileService.ts`.

### Phase 4: Teacher Dashboard 2.0
*   **Task:** Visualize the "Mastery Vector".
*   **Action:** Render the AI Insight Reports generated by the Insight Engine.

---

## 7. Scalability & Technology Recommendations
*   **Database:** Continue with **Firestore** for Student Profiles (Documents) and Content.
    *   *Optimization:* Use **Collection Groups** for cross-course querying of questions by difficulty/topic.
*   **State Management:** Move session state to **Redis** (or Firestore with atomic writes) to handle high-frequency updates during exams.
*   **Compute:** Firebase Cloud Functions (Gen 2) for the Policy Engine.

---

**Signed,**
*EdTech Architecture Team*
