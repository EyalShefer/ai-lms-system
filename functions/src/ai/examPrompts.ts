/**
 * EXAM-SPECIFIC PROMPTS
 *
 * This module contains all prompts dedicated to ASSESSMENT/EXAM generation.
 * These are completely separate from learning prompts to ensure:
 * 1. No hints or scaffolding leak into exams
 * 2. Deterministic output (low temperature)
 * 3. Strict, objective tone
 *
 * Architecture: 3-Stage Pipeline
 * - Stage 1: Exam Architect (The Brain) - Plans the test structure
 * - Stage 2: Exam Generator (The Hands) - Creates individual questions
 * - Stage 3: Exam Guardian (The Validator) - Ensures exam integrity
 */

/**
 * STAGE 1: EXAM ARCHITECT PROMPT
 *
 * Role: Strategic Test Planner
 * Goal: Create a skeleton of exam questions covering all major topics
 * Temperature: 0.3 (deterministic)
 */
export const getExamArchitectPrompt = (
    contextPart: string,
    gradeLevel: string,
    stepCount: number,
    bloomSteps: string[],
    structureGuide: string
) => `
Role: Senior Assessment Designer (Exam Architect).
Task: Create a "Test Plan" (Exam Skeleton) - NOT a teaching plan.

${contextPart}
Target Audience: ${gradeLevel}.
Count: Exactly ${stepCount} assessment items.
Language: Hebrew.
Temperature: LOW (0.3) - Deterministic output required.

MISSION:
1. **Holistic Analysis:**
   - Read the ENTIRE source material first.
   - Identify ALL key concepts, facts, and processes that require verification.

2. **ASSESSMENT STRATEGY (Critical):**
   - **Goal:** Verify mastery, not teach.
   - **Scan For:** Distinct topics, facts, processes that can be TESTED.
   - **Segmentation:** Divide content into ${stepCount} testable units.
   - **Anti-Bias Rule:** Cover ALL major topics fairly (no over-sampling from first section).
   - **Constraint:** Each question tests ONE distinct concept.

3. **EXAM-ONLY POLICY:**
   - **Structure:** Questions ONLY. No introduction, no explanations.
   - **Content:** You are creating a TEST, not a lesson.
   - **Tone:** Neutral, Objective, Formal (Examiner voice).
   - **NO:** Teaching blocks, hints, scaffolding, or "Wizdi-Bot" persona.

4. **Topic Policing:**
   - For each question, define:
     * **assessment_focus:** What specific knowledge/skill is being tested?
     * **forbidden_topics:** What must NOT appear in this question to avoid overlap?

5. **LOGIC SAFETY:**
   - **Categorization:** Categories must be MUTUALLY EXCLUSIVE.
   - **Ordering:** Must be based on objective, verifiable criteria (chronology, steps, hierarchy).
   - **Multiple Choice:** Distractors must be plausible but clearly wrong.

6. **BLOOM TAXONOMY REQUIREMENTS:**
   ${JSON.stringify(bloomSteps)}

7. **Structure Guide:**
   ${structureGuide}

8. **POINTS ALLOCATION (Critical for Fairness):**
   Points MUST reflect cognitive demand:

   **Bloom Level Multipliers:**
   - Remember/Understand: 1.0x - 1.2x base points
   - Apply/Analyze: 1.5x - 1.7x base points
   - Evaluate/Create: 2.0x - 2.2x base points

   **Base Points by Type:**
   - Multiple Choice / True-False: 5 points
   - Fill in Blanks: 7 points
   - Ordering / Categorization: 10 points
   - Open Question: 15 points

   **Examples:**
   - Remember + Multiple Choice = 5 × 1.0 = 5 points
   - Apply + Categorization = 10 × 1.5 = 15 points
   - Evaluate + Open Question = 15 × 2.0 = 30 points

9. **TIME ESTIMATION (for Teacher Planning):**
   Each question must have estimated time:
   - Multiple Choice: 2 min (× Bloom modifier)
   - True-False: 1 min
   - Fill in Blanks: 3 min
   - Ordering: 4 min
   - Categorization: 5 min
   - Open Question: 8-16 min (depending on Bloom)

Output JSON Structure (STRICT):
{
  "exam_title": "String (concise exam title)",
  "total_points": number,
  "estimated_duration_minutes": number,
  "coverage_matrix": {
    "topic_name": {
      "question_numbers": [1, 2],
      "bloom_levels": ["Remember", "Apply"],
      "total_points": number
    }
  },
  "steps": [
    {
      "step_number": 1,
      "title": "Question 1 Title (topic being tested)",
      "assessment_focus": "Test ONLY [Specific Concept A]. E.g., 'Verify understanding of photosynthesis process.'",
      "forbidden_topics": ["Concept B", "Concept C"],
      "bloom_level": "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create",
      "suggested_interaction_type": "multiple_choice" | "true_false" | "ordering" | "categorization" | "fill_in_blanks" | "open_question",
      "points": number,
      "estimated_time_minutes": number,
      "difficulty_level": "easy" | "medium" | "hard"
    }
  ]
}

CRITICAL RULES:
- NO "teach_content" in output
- NO "progressive_hints" in output
- Focus on VERIFICATION of knowledge, not instruction
`;

/**
 * STAGE 2: EXAM GENERATOR PROMPT
 *
 * Role: Question Writer (The Hands)
 * Goal: Create a single rigorous exam question based on architect's plan
 * Temperature: 0.3 (deterministic)
 */
export const getExamGeneratorPrompt = (
    contextText: string,
    stepInfo: any,
    gradeLevel: string
) => `
Role: Professional Exam Question Writer.
Task: Create ONE rigorous exam question.
Input: Question specifications from Exam Architect.

${contextText}

MANDATORY REQUIREMENTS:

1. **EXAM MODE - CRITICAL:**
   - You are creating a TEST question, NOT a teaching moment.
   - **BAN:** Do NOT output any 'teach_content'. Set it to empty string "".
   - **BAN:** Do NOT provide 'progressive_hints'. Set to empty array [].
   - **Tone:** Neutral, Objective, Formal (Examiner voice - NOT friendly teacher).

2. **ASSESSMENT FOCUS:**
   - Test ONLY: ${stepInfo.assessment_focus || stepInfo.narrative_focus || "the specified concept"}.
   - Do NOT mention: ${JSON.stringify(stepInfo.forbidden_topics || [])}.
   - Bloom Level: ${stepInfo.bloom_level} - match cognitive demand exactly.

3. **PEDAGOGY:**
   - Interaction Type: ${stepInfo.suggested_interaction_type} (STRICT - no fallback without reason).
   - Age Adaptation (${gradeLevel}): Use age-appropriate terminology, but maintain formal tone.

4. **STRICT GROUNDING (Anti-Hallucination):**
   - Use ONLY the provided Source Text.
   - If information is not in the source, it doesn't exist.
   - Do NOT add external knowledge or examples.

5. **QUESTION QUALITY STANDARDS:**
   - **Multiple Choice:**
     * Question must be clear and unambiguous.
     * Exactly 4 options (A, B, C, D).
     * One correct answer, three plausible distractors.
     * **Distractors MUST target specific misconceptions** (CRITICAL for quality).
     * Each distractor must have a pedagogical purpose documented in metadata.

     **Distractor Analysis Format:**
     \`\`\`json
     {
       "question": "...",
       "options": ["correct", "distractor1", "distractor2", "distractor3"],
       "correct_answer": "correct",
       "distractor_analysis": {
         "distractor1": "מטרה: תלמיד שמערבב בין X ל-Y",
         "distractor2": "מטרה: תלמיד ששכח את שלב Z",
         "distractor3": "מטרה: חישוב שגוי (הפוך את הנוסחה)"
       }
     }
     \`\`\`

   - **True/False:**
     * Statement must be clearly true or clearly false (no ambiguity).
     * Avoid "always" or "never" unless factually accurate.

   - **Ordering:**
     * Items must have ONE objectively correct sequence.
     * Based on chronology, process steps, or hierarchy.

   - **Categorization:**
     * Categories must be MUTUALLY EXCLUSIVE.
     * Each item belongs to exactly ONE category.

   - **Fill in Blanks (Cloze):**
     * Use [brackets] for hidden words.
     * Context must make the answer inferrable but not obvious.

   - **Open Question:**
     * Provide detailed \`model_answer\` with 3-4 key points.
     * Include \`teacher_guidelines\` with grading rubric (see below).

6. **ANALYTIC RUBRIC (for Open Questions) - CRITICAL:**
   Open questions MUST include a detailed analytic rubric with multiple criteria.

   **Structure:**
   \`\`\`json
   {
     "question": "השאלה...",
     "total_points": ${stepInfo.points || 10},
     "rubric_type": "analytic",
     "criteria": [
       {
         "criterion_name": "זיהוי מושג מרכזי",
         "weight_points": ${Math.floor((stepInfo.points || 10) * 0.3)},
         "levels": {
           "excellent": {
             "points": ${Math.floor((stepInfo.points || 10) * 0.3)},
             "description": "מזהה ומסביר במדויק + מביא דוגמה"
           },
           "good": {
             "points": ${Math.floor((stepInfo.points || 10) * 0.3 * 0.7)},
             "description": "מזהה ומסביר במדויק, אך ללא דוגמה"
           },
           "partial": {
             "points": ${Math.floor((stepInfo.points || 10) * 0.3 * 0.4)},
             "description": "מזהה את המושג אך ההסבר חלקי"
           },
           "missing": {
             "points": 0,
             "description": "לא מזהה או מזהה באופן שגוי"
           }
         }
       },
       {
         "criterion_name": "הסבר תהליך",
         "weight_points": ${Math.floor((stepInfo.points || 10) * 0.4)},
         "levels": { ... }
       },
       {
         "criterion_name": "קשר לחיי היומיום",
         "weight_points": ${Math.floor((stepInfo.points || 10) * 0.3)},
         "levels": { ... }
       }
     ],
     "model_answer": "דוגמה לתשובה מצוינת (לא להעתיק!)",
     "common_mistakes": [
       "טעות 1: מערבב בין X ל-Y",
       "טעות 2: חושב ש-Z קורה לפני W"
     ]
   }
   \`\`\`

   **Guidelines:**
   - Divide total points into 2-4 criteria
   - Each criterion has 4 levels: excellent (100%), good (70%), partial (40%), missing (0%)
   - Criteria should be independent and measurable
   - Total of all criteria weights = total question points

7. **PEDAGOGICAL SAFETY VALVE (Fallback):**
   - IF the Source Text lacks data for requested type (e.g., no sequence for "Ordering"):
     * Fallback to a type that preserves Bloom Level.
     * Example: "Ordering" (Apply) → "Categorization" (Apply) or "Fill-in-Blanks" (Apply).
   - NEVER return empty/broken JSON.
   - Document fallback reason in metadata.

8. **EXAM INTEGRITY:**
   - NO hints, tips, or guidance to the student.
   - NO "Did you know?" or educational asides.
   - NO feedback that reveals the answer (feedback only after submission by teacher).

Output FORMAT (JSON ONLY):
{
   "step_number": ${stepInfo.step_number},
   "bloom_level": "${stepInfo.bloom_level}",
   "teach_content": "",  // MUST BE EMPTY for exams
   "selected_interaction": "${stepInfo.suggested_interaction_type}",
   "points": ${stepInfo.points || 10},
   "data": {
      "progressive_hints": [],  // MUST BE EMPTY for exams
      "source_reference_hint": "See section '...' in source material",

      // DYNAMIC STRUCTURE BASED ON INTERACTION TYPE:

      // 1. MULTIPLE CHOICE:
      // {
      //   "question": "השאלה...",
      //   "options": ["אופציה א'", "אופציה ב'", "אופציה ג'", "אופציה ד'"],
      //   "correct_answer": "אופציה א'",
      //   "feedback_correct": "נכון! הסבר קצר למה זו התשובה.",
      //   "feedback_incorrect": "לא נכון. רמז כללי מבלי לחשוף את התשובה.",
      //   "distractor_analysis": {
      //     "אופציה ב'": "טעות נפוצה: חושבים ש-X גורם ל-Y",
      //     "אופציה ג'": "טעות תפיסתית: מערבבים בין A ל-B",
      //     "אופציה ד'": "הנחה שגויה: מניחים ש-Z קורה תמיד"
      //   },
      //   "estimated_time_minutes": ${stepInfo.estimated_time_minutes || 2},
      //   "difficulty_level": "${stepInfo.difficulty_level || 'medium'}"
      // }

      // 2. TRUE_FALSE:
      // {
      //   "question": "המשפט...",
      //   "correct_answer": true | false,
      //   "feedback_correct": "נכון!",
      //   "feedback_incorrect": "לא נכון."
      // }

      // 3. ORDERING:
      // {
      //   "instruction": "סדר את השלבים...",
      //   "correct_order": ["שלב 1", "שלב 2", "שלב 3"]
      // }

      // 4. CATEGORIZATION:
      // {
      //   "question": "מיין את הפריטים...",
      //   "categories": ["קטגוריה א'", "קטגוריה ב'"],
      //   "items": [
      //     { "text": "פריט 1", "category": "קטגוריה א'" },
      //     { "text": "פריט 2", "category": "קטגוריה ב'" }
      //   ]
      // }

      // 5. FILL IN BLANKS:
      // {
      //   "text": "השמש היא [כוכב] והירח הוא [לוויין]."
      // }

      // 6. OPEN QUESTION:
      // {
      //   "question": "השאלה...",
      //   "model_answer": "תשובה לדוגמה עם כל הנקודות החשובות...",
      //   "teacher_guidelines": "🎯 מה לחפש: ...\n❌ טעויות נפוצות: ...\n📊 חלוקת ציון: ...",
      //   "points": ${stepInfo.points || 10}
      // }
   }
}

LANGUAGE: All output values MUST be in Hebrew.
TEMPERATURE: 0.3 (deterministic).
`;

/**
 * STAGE 3: EXAM GUARDIAN PROMPT
 *
 * Role: Quality Assurance for Exam Integrity
 * Goal: Verify that generated content is a pure exam (no teaching, no hints)
 * Temperature: 0.1 (very strict)
 */
export const getExamGuardianPrompt = (contentJson: string) => `
### SYSTEM ROLE
You are the **Exam Integrity Guardian** - a rigorous quality assurance system.
Your Goal: Ensure that the generated content is a PURE EXAM with zero teaching elements.

### INPUT
Generated Exam Content (JSON):
${contentJson.substring(0, 15000)}

### AUDIT PROTOCOL

**Phase 1: CRITICAL FAIL CONDITIONS**
Check for exam-breaking violations. If ANY are TRUE, report CRITICAL_FAIL immediately:

1. **The "Hints Leak" Error:**
   - Does ANY question contain "progressive_hints" with values?
   - Rule: Exams must have ZERO hints. (progressive_hints must be [] or null)
   - Status: PASS | FAIL

2. **The "Teaching Content" Error:**
   - Does ANY question contain "teach_content" with text?
   - Rule: Exams are for TESTING, not teaching. (teach_content must be "" or null)
   - Status: PASS | FAIL

3. **The "Friendly Tone" Error:**
   - Does the text use informal, encouraging language? (e.g., "בואו נחשוב", "נסו לזכור")
   - Rule: Exam tone must be neutral and formal.
   - Status: PASS | FAIL

4. **The "Answer Reveal" Error:**
   - Does ANY feedback reveal the correct answer before grading?
   - Rule: Feedback can only explain AFTER submission, not guide TO the answer.
   - Status: PASS | FAIL

**Phase 2: FAIRNESS & ACCESSIBILITY CHECK**
Before quality assessment, check for bias:

1. **Cultural Bias:**
   - Do questions assume Western culture knowledge?
   - Examples to avoid: Christmas, Thanksgiving, baseball, American history
   - Status: PASS | WARN | FAIL

2. **Gender Bias:**
   - Does text use inclusive language?
   - Avoid stereotypes (nurse=female, engineer=male)
   - Status: PASS | WARN | FAIL

3. **Socioeconomic Bias:**
   - Do questions assume resources (computer, travel, private tutor)?
   - Status: PASS | WARN | FAIL

4. **Accessibility:**
   - Are there images without alt-text descriptions?
   - Is language overly complex for age group?
   - Status: PASS | WARN | FAIL

**Phase 3: QUALITY ASSESSMENT**
Only if Phase 1 & 2 passed, evaluate quality:

1. **Coverage Verification:**
   - Are all major topics from source material represented?
   - Score: 0-100

2. **Bloom Level Accuracy:**
   - Do questions match their declared Bloom level?
   - Score: 0-100

3. **Question Clarity:**
   - Are questions unambiguous and clear?
   - Score: 0-100

4. **Distractor Quality (for Multiple Choice):**
   - Are wrong answers plausible but clearly incorrect?
   - Do distractors target specific misconceptions?
   - Score: 0-100

5. **Rubric Quality (for Open Questions):**
   - Is there an analytic rubric with multiple criteria?
   - Are criteria measurable and independent?
   - Score: 0-100

### OUTPUT FORMAT (Strict JSON):
{
  "status": "PASS" | "CRITICAL_FAIL" | "WARNING",
  "critical_fail_reason": null | "Hints Leak" | "Teaching Content" | "Friendly Tone" | "Answer Reveal",
  "phase1_checks": {
    "hints_leak": { "status": "PASS" | "FAIL", "details": "..." },
    "teaching_content": { "status": "PASS" | "FAIL", "details": "..." },
    "tone_check": { "status": "PASS" | "FAIL", "details": "..." },
    "answer_reveal": { "status": "PASS" | "FAIL", "details": "..." }
  },
  "phase2_fairness": {
    "cultural_bias": { "status": "PASS" | "WARN" | "FAIL", "details": "..." },
    "gender_bias": { "status": "PASS" | "WARN" | "FAIL", "details": "..." },
    "socioeconomic_bias": { "status": "PASS" | "WARN" | "FAIL", "details": "..." },
    "accessibility": { "status": "PASS" | "WARN" | "FAIL", "details": "..." }
  },
  "phase3_scores": {
    "coverage": 0-100,
    "bloom_accuracy": 0-100,
    "question_clarity": 0-100,
    "distractor_quality": 0-100,
    "rubric_quality": 0-100
  },
  "overall_quality_score": 0-100,
  "feedback_hebrew": "סיכום קצר בעברית של הממצאים",
  "issues": [
    { "question_number": number, "severity": "CRITICAL" | "WARNING" | "INFO", "description": "..." }
  ],
  "auto_repair_instruction": "If CRITICAL_FAIL, provide instructions for the Generator to fix specific issues"
}

TEMPERATURE: 0.1 (very strict evaluation).
LANGUAGE: feedback_hebrew and descriptions in Hebrew.
`;

/**
 * HELPER: Get Exam Structure Guide based on length
 */
export const getExamStructureGuide = (stepCount: number): string => {
    if (stepCount <= 3) {
        // Short Exam
        return `
SHORT EXAM STRUCTURE (${stepCount} questions):
- Question 1: Foundation (Remember/Understand) - Type: multiple_choice OR true_false
- Question 2: Application (Apply/Analyze) - Type: categorization OR ordering OR fill_in_blanks
- Question 3: Higher-Order (Evaluate/Create) - Type: open_question OR complex multiple_choice
        `;
    } else if (stepCount >= 7) {
        // Long Exam
        return `
LONG EXAM STRUCTURE (${stepCount} questions):
- Questions 1-2: Foundation (Remember) - Type: multiple_choice, true_false, fill_in_blanks
- Questions 3-5: Application (Apply/Analyze) - Type: ordering, categorization, multiple_choice
- Questions 6-7: Higher-Order (Evaluate/Create) - Type: open_question, complex scenarios
        `;
    } else {
        // Medium Exam (5 questions)
        return `
MEDIUM EXAM STRUCTURE (${stepCount} questions):
- Questions 1-2: Foundation (Remember/Understand) - Type: multiple_choice, true_false
- Questions 3-4: Application (Apply/Analyze) - Type: categorization, ordering, fill_in_blanks
- Question 5: Higher-Order (Evaluate/Create) - Type: open_question
        `;
    }
};

/**
 * HELPER: Get Bloom Steps for Exam based on taxonomy
 *
 * FIXED: Math.round() bug - now uses floor + smart remainder distribution
 */
export const getExamBloomSteps = (stepCount: number, taxonomy?: { knowledge: number; application: number; evaluation: number }): string[] => {
    const defaultTaxonomy = taxonomy || { knowledge: 20, application: 40, evaluation: 40 };

    // Use floor for all to avoid over-allocation
    let knowledgeCount = Math.floor(stepCount * (defaultTaxonomy.knowledge / 100));
    let applicationCount = Math.floor(stepCount * (defaultTaxonomy.application / 100));
    let evaluationCount = Math.floor(stepCount * (defaultTaxonomy.evaluation / 100));

    // Distribute remainder to highest priority levels (evaluation > application > knowledge)
    let remainder = stepCount - (knowledgeCount + applicationCount + evaluationCount);

    while (remainder > 0) {
        // Prioritize higher-order thinking
        if (defaultTaxonomy.evaluation >= defaultTaxonomy.application &&
            defaultTaxonomy.evaluation >= defaultTaxonomy.knowledge) {
            evaluationCount++;
        } else if (defaultTaxonomy.application >= defaultTaxonomy.knowledge) {
            applicationCount++;
        } else {
            knowledgeCount++;
        }
        remainder--;
    }

    const bloomLevels: string[] = [];

    // Fill array with appropriate Bloom levels
    for (let i = 0; i < knowledgeCount; i++) {
        bloomLevels.push(i % 2 === 0 ? 'Remember' : 'Understand');
    }
    for (let i = 0; i < applicationCount; i++) {
        bloomLevels.push(i % 2 === 0 ? 'Apply' : 'Analyze');
    }
    for (let i = 0; i < evaluationCount; i++) {
        bloomLevels.push(i % 2 === 0 ? 'Evaluate' : 'Create');
    }

    return bloomLevels;
};

/**
 * HELPER: Calculate points for a question based on Bloom level and question type
 *
 * Formula: basePoints[questionType] × bloomMultiplier[bloomLevel]
 *
 * Ensures higher-order thinking gets more points
 */
export const calculateQuestionPoints = (bloomLevel: string, questionType: string): number => {
    const bloomMultipliers: { [key: string]: number } = {
        'Remember': 1.0,
        'Understand': 1.2,
        'Apply': 1.5,
        'Analyze': 1.7,
        'Evaluate': 2.0,
        'Create': 2.2
    };

    const basePoints: { [key: string]: number } = {
        'multiple_choice': 5,
        'true_false': 5,
        'fill_in_blanks': 7,
        'ordering': 10,
        'categorization': 10,
        'open_question': 15
    };

    const multiplier = bloomMultipliers[bloomLevel] || 1.0;
    const base = basePoints[questionType] || 10;

    return Math.round(base * multiplier);
};

/**
 * HELPER: Get time estimation for a question
 *
 * Returns estimated time in minutes based on question type and Bloom level
 */
export const estimateQuestionTime = (bloomLevel: string, questionType: string): number => {
    const baseTime: { [key: string]: number } = {
        'multiple_choice': 2,
        'true_false': 1,
        'fill_in_blanks': 3,
        'ordering': 4,
        'categorization': 5,
        'open_question': 8
    };

    const bloomModifiers: { [key: string]: number } = {
        'Remember': 1.0,
        'Understand': 1.1,
        'Apply': 1.3,
        'Analyze': 1.5,
        'Evaluate': 1.7,
        'Create': 2.0
    };

    const base = baseTime[questionType] || 5;
    const modifier = bloomModifiers[bloomLevel] || 1.0;

    return Math.round(base * modifier);
};
