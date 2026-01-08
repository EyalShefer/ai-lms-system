
// src/services/ai/prompts.ts

export const BOT_PERSONAS = {
  teacher: {
    id: 'teacher',
    name: 'המורה המלווה',
    systemPrompt: "אתה מורה אדיב, סבלני ומקצועי. פנה תמיד בלשון יחיד (אתה/את). אם התלמיד טועה, תקן אותו בעדינות והסבר את הטעות. עודד אותו להמשיך.",
    initialMessage: "היי! אני כאן אם משהו לא ברור בחומר. מוזמן לשאול כל שאלה! 👋"
  },
  socratic: {
    id: 'socratic',
    name: 'המנחה הסוקרטי',
    systemPrompt: "אתה מנחה בשיטה הסוקרטית. המטרה שלך היא לגרות חשיבה. לעולם אל תיתן תשובה ישירה או סיכום מוכן. אם התלמיד שואל, ענה בשאלה מכווינה או ברמז. תוביל אותו לתשובה צעד אחר צעד. היה סקרן ומעורר מחשבה.",
    initialMessage: "שלום. אני כאן כדי לעזור לך לחשוב. שאל אותי, ואעזור לך למצוא את התשובה בעצמך. 🧠"
  },
  concise: {
    id: 'concise',
    name: 'התמציתי',
    systemPrompt: "אתה עוזר לימודי יעיל ותמציתי. ענה אך ורק על מה שנשאלת. תשובות קצרות, ממוקדות (מקסימום 2-3 משפטים). בלי הקדמות מיותרות ובלי 'סמול טוק'.",
    initialMessage: "היי. אני כאן לתשובות קצרות ומדויקות. מה השאלה? ⚡"
  },
  coach: {
    id: 'coach',
    name: 'המאמן המאתגר',
    systemPrompt: "אתה מאמן קשוח אך הוגן. תפקידך לאתגר את התלמיד. אם הוא עונה נכון, הקשה עליו עם שאלת המשך ('האם זה תמיד נכון?'). השתמש בדוגמאות מחיי היומיום. אל תסתפק בתשובות שטחיות.",
    initialMessage: "מוכן לאתגר? אני לא אעשה לך חיים קלים, אבל אתה תצא מפה חד יותר. בוא נתחיל! 🏆"
  }
};

export const generatePedagogicalPrompt = (personaId: string) => {
  const persona = BOT_PERSONAS[personaId as keyof typeof BOT_PERSONAS] || BOT_PERSONAS.socratic;
  return `SYSTEM: ${persona.systemPrompt}\nROLE: ${persona.name}`;
};

export const getSkeletonPrompt = (
  contextPart: string,
  gradeLevel: string,
  personalityInstruction: string,
  mode: string,
  productType: string,
  stepCount: number,
  bloomSteps: string[],
  structureGuide: string
) => `
    Task: Create a "Skeleton" for a learning unit.
    ${contextPart}
    Target Audience: ${gradeLevel}.
    ${personalityInstruction}
    Mode: ${mode === 'exam' || productType === 'exam' ? 'STRICT EXAMINATION / TEST MODE' : (productType === 'game' ? 'GAMIFICATION / PLAY MODE' : 'Learning/Tutorial Mode')}
    Count: Exactly ${stepCount} steps.
    Language: Hebrew.
    
    BLOOM TAXONOMY REQUIREMENTS:
    ${JSON.stringify(bloomSteps)}

    MISSION:
    1. **Holistic Analysis:** Read the ENTIRE source text first. Understand the "Big Picture".
    2. **SEGMENTATION STRATEGY (CRITICAL):**
       - **Scan First:** Identify ALL distinct case studies, periods, or sub-topics.
       - **Anti-Bias Rule:** You MUST include ALL major distinct stories found.
       - **Action:** Divorce the Source Text into ${stepCount} DISTINCT, NON-OVERLAPPING logical chunks.
       - **Constraint:** Chunk A must end completely before Chunk B begins.

    3. **ZERO-TEXT-WALL POLICY (V4 ANTI-BATCHING):**
       ${(mode === 'exam' || productType === 'exam')
    ? `- **EXAM MODE / ASSESSMENT ONLY:**
           - **Structure:** Question Block ONLY. No introduction text.
           - **Content:** Do NOT output 'teach_content'. Output strictly assessment items.
           - **Logic:** Each step is a test item.`
    : (productType === 'game'
      ? `- **GAME MODE / INTERACTIVE ONLY:**
             - **Structure:** 100% Interaction. No long text explanations.
             - **Content:** Gamified challenges.
             - **Logic:** Fun, pacing, engaging.`
      : `- **CRITICAL:** You must ensure that the user interacts FREQUENTLY.
             - **Rule:** If the narrative has more distinct chunks than the requested ${stepCount} steps, you MUST Insert 'multiple_choice' or 'true_false' steps in between to ensure coverge without merging topics.
             - **Structure:** Text Chunk -> Question -> Text Chunk -> Question.`)}

    4. **Topic Policing:**
       - For each step, define a strict **narrative_focus** (Allowed Content) and **forbidden_topics** (Banned Content).

    5. **LOGIC SAFETY:**
       - **Categorization:** Categories must be MUTUALLY EXCLUSIVE.
       - **Ordering:** Must be based on objective criteria.

    6. **Structure Guide:**
    ${structureGuide}

    9. **INTERACTION DIVERSITY RULE (CRITICAL - NO REPETITION):**
       - You MUST vary the interaction types across steps. NEVER use the same type twice in a row.
       - **Available Types by Bloom Level:**
         * Remember: memory_game, multiple_choice, true_false, fill_in_blank
         * Understand: multiple_choice, fill_in_blank, matching
         * Apply: categorization, ordering, fill_in_blank
         * Analyze: categorization, ordering, open_question
         * Evaluate/Create: open_question
       - **Diversity Algorithm:** If Step N uses "multiple_choice", Step N+1 MUST use a DIFFERENT type.
       - **Distribution Target:** For ${stepCount} steps, aim for at least 3 different interaction types.

    Output JSON Structure:
    {
      "unit_title": "String",
      "steps": [
        {
          "step_number": 1,
          "title": "Unique Title for Chunk A",
          "narrative_focus": "${mode === 'exam' ? 'Assessment Topic A' : 'Discuss ONLY [Specific Concept A]'} . Do not mention [Concept B].",
          "forbidden_topics": ["Concept B", "Concept C", "Future Events"],
          "bloom_level": "Remember",
          "suggested_interaction_type": "memory_game"
        },
        {
          "step_number": 2,
          "title": "Unique Title for Chunk B",
          "narrative_focus": "...",
          "forbidden_topics": ["..."],
          "bloom_level": "Understand",
          "suggested_interaction_type": "fill_in_blank"
        },
        {
          "step_number": 3,
          "title": "Unique Title for Chunk C",
          "narrative_focus": "...",
          "forbidden_topics": ["..."],
          "bloom_level": "Apply",
          "suggested_interaction_type": "categorization"
        }
      ]
    }

    **IMPORTANT:** The example above shows DIFFERENT interaction types for each step. Follow this pattern!
  `;

export const getStepContentPrompt = (
  contextText: string,
  examEnforcer: string,
  stepInfo: any,
  mode: string,
  linguisticConstraints: string,
  gradeLevel: string
) => `
    ${contextText}
    ${examEnforcer}

    **TARGET AUDIENCE: ${gradeLevel}**

    MANDATORY REQUIREMENTS:

    1. **LANGUAGE ADAPTATION (CRITICAL - HARD CONSTRAINT):**
    ${linguisticConstraints}

    2. **Pedagogy:** Strictly follow the Bloom Level (${stepInfo.bloom_level}) and Interaction Type (${stepInfo.suggested_interaction_type}).

    3. **ZERO-TEXT-WALL RULE (V4 Anti-Batching):**
       - **CRITICAL:** You must NEVER output two distinct text chunks consecutively without a question.
       - **Focus:** Discuss ONLY: ${stepInfo.narrative_focus || "current step's topic"}.
       - **BAN:** Do NOT mention: ${JSON.stringify(stepInfo.forbidden_topics || [])}.
       ${mode === 'exam'
    ? `- **EXAM MODE:** Do NOT output 'teach_content'. Set it to null or empty string. Focus entirely on the Question.`
    : `- **Constraint:** If the text requires multiple paragraphs, ensure the question relates to the *entire* chunk or breaks it down.`
  }

       - **Tone Override:** ${mode === 'exam' ? 'Objective, Examiner Tone (No Humor)' : 'Follow the Linguistic Constraints for this grade level'}.

  4. ** STRICT GROUNDING(Anti - Hallucination V3):**
       - ** Rule:** Use ONLY the provided Source Text.If it's not in the PDF, it doesn't exist.

    5. ** Micro - Learning Progression:**
    - Treat this step as "Chapter ${stepInfo.step_number}". Do not repeat definitions from previous chapters.
      ${mode === 'exam' ? '- **EXAM MODE:** TONE must be objective, examiner tone. No "Wizdi-Bot" persona.' : ''}

  6. ** Logic & Interaction Rules:**
       - ** Ordering:** The 'teach_content' MUST be a narrative story.Items must be paraphrased.
       - ** Categorization:** Categories must be ** MUTUALLY EXCLUSIVE **.
       - ** OPEN QUESTION RUBRIC:** Provide a detailed \`model_answer\` with 3-4 bullet points.
       - ** TEACHER GUIDELINES (CRITICAL):** For EVERY question, provide \`teacher_guidelines\` with:
         * **What to look for:** Key concepts the student must mention
         * **Common mistakes:** What students typically get wrong
         * **Follow-up questions:** 2-3 probing questions if the answer is incomplete
         * **Differentiation:** How to scaffold for struggling students or challenge advanced ones
       - **Language:** OUTPUT VALUES MUST BE IN HEBREW.
       - **Language:** OUTPUT VALUES MUST BE IN HEBREW.
       
    8. **PEDAGOGICAL SAFETY VALVE (BLOOM-PRESERVING FALLBACK):**
       - **Rule:** If the Source Text lacks the data structure required for the requested Interaction Type (e.g., requested "Ordering" but text has no clear sequence), you MUST trigger a Fallback.
       - **CRITICAL:** The Fallback must preserve the cognitive load (Bloom Level).
       
       **CASE A: REQUESTED "Ordering" (Apply/Analyze)**
       - FAILURE CONDITION: Text lists items without a clear objective sequence.
       - FALLBACK ACTION: Switch to "Categorization" (if items differ by type) OR "Fill-in-Blanks" (Cloze).
       
       **CASE B: REQUESTED "Categorization" (Apply/Analyze)**
       - FAILURE CONDITION: All items belong to a single category or are ambiguous.
       - FALLBACK ACTION: Switch to "Fill-in-Blanks" (Contextual inference).
       
       **CASE C: REQUESTED "Memory Game" (Remember)**
       - FAILURE CONDITION: Cannot find 6 distinct pairs.
       - FALLBACK ACTION: Switch to "Multiple Choice" (Fact recall) or "True/False" (Fact verification).
       
       **GENERAL RULE:**
       - NEVER return empty or broken JSON logic (e.g., categories=["None"]).
       - ALWAYS prefer a valid "Lower-Type" over an Invalid "Higher-Type".
       - IF ALL ELSE FAILS: Fallback to "Multiple Choice".

    7. **Scaffolding:**
       ${mode === 'exam'
    ? `- **EXAM MODE:** Do NOT generate 'progressive_hints'. Return empty array [].`
    : `- **Level 1 Hint:** Point to the specific text part.\n- **Level 2 Hint:** Rephrase content.`}
       - **Feedback:** Explain WHY specific wrong choice is incorrect.

    Output FORMAT (JSON ONLY):
    {
       "step_number": ${stepInfo.step_number},
       "bloom_level": "${stepInfo.bloom_level}", 
       "teach_content": ${mode === 'exam' ? "null" : "\"Full explanation text (Simplified for ${gradeLevel})...\""},
       "teacher_tip": "A short, actionable tip for the teacher on how to facilitate this specific step effectively (in Hebrew), based on the content.",
       "selected_interaction": "${stepInfo.suggested_interaction_type}", 
       "data": {
          "progressive_hints": ["Hint 1", "Hint 2"],
          "source_reference_hint": "See section '...'",
          // DYNAMIC STRUCTURE BASED ON INTERACTION TYPE:
          // 1. MULTIPLE CHOICE / TRUE_FALSE:
          // { "question": "...", "options": ["A", "B", "C", "D"], "correct_answer": "A" }
          
          // 2. CATEGORIZATION:
          // { "question": "Sort the items...", "categories": ["Cat1", "Cat2"], "items": [{ "text": "Item1", "category": "Cat1" }] }
          
          // 3. ORDERING:
          // { "instruction": "Order the events...", "correct_order": ["Event 1", "Event 2", "Event 3"] }
          
          // 4. FILL IN BLANKS:
          // { "text": "The [Sun] is hot." } (MUST use brackets [] for hidden words, do NOT use underscores)
          
          // 5. MEMORY GAME:
          // { "question": "Match the pairs...", "pairs": [{ "card_a": "Term", "card_b": "Def" }] }
          
          // 6. OPEN QUESTION:
          // {
          //   "question": "...",
          //   "model_answer": "...",
          //   "teacher_guidelines": "🎯 מה לחפש: [מושגי מפתח]\n❌ טעויות נפוצות: [דוגמאות]\n❓ שאלות המשך: 1) ... 2) ...\n🎓 התאמה: [הצעות לדיפרנציאציה]",
          //   "points": 10
          // }
          
          // 7. AUDIO RESPONSE (Simulated Oral Exam):
          // { "question": "Explain in your own words...", "max_duration": 60 }
       }
    }
`;

export const getPodcastPrompt = (topic: string, sourceText: string) => `
      generate a "Deep Dive" podcast script between two hosts, Dan and Noa.
      Topic: ${topic || "The provided text"}
      Source Material: """${sourceText.substring(0, 15000)}"""
      
      Characters:
      - Dan: Enthusiastic, uses analogies, asks the "dumb" questions to clarify things.
      - Noa: The expert, skeptical but clear, brings the data.
      
      Format: JSON matching:
      {
        "title": "Fun Title",
        "lines": [
          { "speaker": "Dan", "text": "...", "emotion": "Excited" },
          { "speaker": "Noa", "text": "...", "emotion": "Neutral" }
        ]
      }
      
      Language: Hebrew.
      Length: Approx 10-15 exchanges.
      Style: Conversational, fun, like "NotebookLM".
`;

export const getValidationPrompt = (targetAudience: string, lessonJson: any) => `
    User Instruction:
    Attached is a JSON representing an educational lesson.
    Target Audience: ${targetAudience}.

    Analyze the content strictly against the PEDAGOGICAL MATRIX and STRUCTURAL GUIDELINES provided in the system prompt.
    
    Returns a JSON with this EXACT structure (no markdown):
    {
      "status": "PASS" | "REJECT",
      "metrics": {
        "cefr_level": "string",
        "readability_score": number, // 0-100
        "cognitive_load": "Low" | "Medium" | "High"
      },
      "issues": [
        {
          "module_index": number, // index of the step/module with issue
          "issue_type": "string",
          "description": "string",
          "suggested_fix": "string"
        }
      ]
    }

    Lesson Content to Validate:
    ${JSON.stringify(lessonJson)}
`;

export const getTutorPrompt = (mode: string, sourceText: string, question: string, modelAnswer: string, userAnswer: string) => `
  # ROLE
  # ROLE
  ${mode === 'exam' ? "You are a Strict Examiner." : "You are a supportive tutor checking a student's answer based on a text."}
  ${mode === 'exam' ? "Provide objective feedback based strictly on the Model Answer." : "DO NOT GIVE THE ANSWER. GUIDE THE STUDENT TO IT."}
  Output Language: Hebrew.

  # INPUT
      - Source Text(Context): """${sourceText.substring(0, 1000)}..."""
        - Question: "${question}"
          - Model Answer(Hidden from student): "${modelAnswer}"
            - Student's Answer: "${userAnswer}"

  # TASK
  Analyze the student's answer and categorize it into one of 3 states:

    1. ** CORRECT **: The student understood the core concept.
      * * Action:* Praise and confirm.
  2. ** PARTIALLY CORRECT **: The student got some parts right but missed key details.
      * * Action:* Acknowledge the correct part, then ask a guiding question to help them find the missing part in the text.
  3. ** INCORRECT / IRRELEVANT **: The answer is wrong or off - topic.
      * * Action:* Give a specific hint pointing to the relevant paragraph without revealing the answer.

  # OUTPUT FORMAT(JSON ONLY)
    {
      "status": "correct" | "partial" | "incorrect",
        "feedback_to_student": "WRITE HERE: The personalized message (in Hebrew). E.g., 'אתה צודק לגבי הכלכלה, אבל מה לגבי המצב הפוליטי?'"
    }
`;

export const getRefinementPrompt = (content: string, instruction: string) => `
    Act as an expert pedagogical editor.
    Original text: "${content}"
    Instruction: ${instruction}
    Output language: Hebrew.
      Goal: Improve clarity, accuracy, and engagement.
`;

export const getCategorizationPrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
    Create a detailed Categorization Activity.
  ${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
    Target Audience: ${gradeLevel}.
Language: Hebrew.

  Task: Sort items into 2 - 4 distinct categories.
    Rules:
1. Categories must be distinct(e.g., "True/False", "Cause/Effect", "Before/After").
    2. If exact categories aren't found, categorize by "General Concept" vs "Specific Detail".
3. Output JSON MUST be valid.

    JSON Output Example:
{
  "question": "Sort the following items:",
    "categories": ["Mammals", "Reptiles"],
      "items": [{ "text": "Dog", "category": "Mammals" }, { "text": "Snake", "category": "Reptiles" }]
}
`;

export const getOrderingPrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
    Create an Ordering / Sequencing Activity.
  ${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
    Target Audience: ${gradeLevel}.
Language: Hebrew.

  Task: Extract a logical sequence.
    Rules:
1. If no Chronological Sequence exists, order by "Priority", "Complexity", or "Logical Steps".
    2. Items must be concise strings.

    JSON Output Example:
{
  "instruction": "Order the steps of the process:",
    "correct_order": ["Step 1: Initiation", "Step 2: Planning", "Step 3: Execution"]
}
`;

export const getFillInBlanksPrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
    Create a Fill -in -the - Blanks(Cloze) Text.
  ${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
    Target Audience: ${gradeLevel}.
Language: Hebrew.

  Task: Write a summary paragraph about "${topic}".
    Rules:
1. Use[brackets] to hide key concepts.
    2. MUST have at least 3 hidden words.
    3. Context MUST make the hidden word guessable.
    4. Text should be roughly 40 - 60 words.

    JSON Output Example:
{
  "text": "The capital of [France] is [Paris]."
}
`;

export const getMemoryGamePrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
    Create a Memory Game(Matching Pairs).
  ${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
    Target Audience: ${gradeLevel}.
Language: Hebrew.

  Task: Create 6 matching pairs.
    Rules:
1. If no detailed definitions exist, match "Term" to "Category" or "Event" to "Date".
    2. JSON must generally valid.
    
    JSON Output Example:
{
  "pairs": [
    { "card_a": "Sun", "card_b": "Star" },
    { "card_a": "Moon", "card_b": "Satellite" }
  ]
}
`;

export const getStudentAnalysisPrompt = (studentName: string, courseTopic: string, submissionData: string) => `
Role: Educational Psychologist & Data Analyst.
  Task: Analyze student performance based on telemetry data.
    Student: ${studentName}.
Topic: ${courseTopic}.

DATA:
    ${submissionData}

    METRICS TO ANALYZE:
1. ** Time per Question:** (Fast = Impulsive ? / Slow = Struggling or Deep Thinker?)
2. ** Attempts:** (Many attempts = Persistence or Guessing ?)
3. ** Hints:** (Usage of hints = Resourcefulness or Dependency ?)
4. ** Mistakes:** (Pattern recognition - e.g. "struggles with ordering").

    OUTPUT FORMAT(JSON ONLY):
{
  "strengths": ["List 2-3 specific strengths"],
    "weaknesses": ["List 2-3 specific weaknesses"],
      "psychologicalProfile": "Impulsive" | "Persistent" | "Deep Thinker" | "Hesitant",
        "recommendedFocus": "Specific sub-topic to review...",
          "engagementScore": 0 - 100(Based on completion and effort)
}
`;

export const getSingleMCQPrompt = (sourceText: string, gradeLevel: string) => `
    Based on the following text(Podcast Script), create a single Multiple Choice Question.

  TEXT:
"""${sourceText.substring(0, 5000)}"""

    Target Audience: ${gradeLevel}.
Language: Hebrew.

  Goal: Test understanding of the core message.
    
    OUTPUT JSON:
{
  "question": "The question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A"
}
`;

export const getSingleOpenQuestionPrompt = (sourceText: string, gradeLevel: string) => `
    Based on the following text(Podcast Script), create a single Open - Ended Question.

  TEXT:
"""${sourceText.substring(0, 5000)}"""

    Target Audience: ${gradeLevel}.
Language: Hebrew.

  Goal: Encourage deep thinking or opinion.

    CRITICAL: You MUST provide pedagogical guidelines for the teacher.

    OUTPUT JSON:
{
  "question": "The open question text",
  "model_answer": "A model answer or key points to look for.",
  "teacher_guidelines": "🎯 מה לחפש בתשובה: [רשימת מושגי מפתח שהתלמיד חייב להזכיר]\n❌ טעויות נפוצות: [דוגמאות לאמירות שגויות שתלמידים עושים]\n❓ שאלות המשך אם התשובה חלקית:\n   1. [שאלה מכוונת ראשונה]\n   2. [שאלה מכוונת שנייה]\n   3. [שאלה מאתגרת לתלמידים מתקדמים]\n🎓 דיפרנציאציה:\n   • תלמידים מתקשים: [הצעה לפישוט או רמז]\n   • תלמידים מתקדמים: [הצעה להרחבה או אתגר]"
}
`;

export const getClassAnalysisPrompt = (studentsJson: string) => `
Role: Senior Educational Consultant.
  Task: Analyze CLASS performance based on aggregated student data.
    
    DATA SAMPLES(Anonymized):
    ${studentsJson}

MISSION:
    Identify PATTERNS in the class.
1. Are they generally impulsive or hesitant ?
  2. Is there a specific topic they all struggle with?
    3. What is the emotional state of the class (Engagement) ?

      OUTPUT FORMAT(JSON ONLY):
{
  "strongSkills": ["List 2-3 skills the CLASS excels at"],
    "weakSkills": ["List 2-3 skills the CLASS struggles with"],
      "actionItems": ["List 2 practical teaching strategies for tomorrow"],
        "classVibe": "Competitive" | "Collaborative" | "Struggling" | "Curious"
}
`;

export const getStudentReportPrompt = (studentData: string) => `
    Create a personal student report based on this data:
    ${studentData}

    Language: Hebrew.
    Tone: Encouraging, professional, pedagogical.
    Output JSON Structure:
    {
      "studentName": "Name",
      "summary": "A personal paragraph summarizing the student's progress",
      "criteria": {
        "knowledge": "Assessment of knowledge acquisition",
        "depth": "Assessment of analytical depth",
        "expression": "Assessment of capability to express ideas",
        "recommendations": "Actionable advice for improvement"
      }
    }
`;

export const getAutoFixPrompt = (issues: string, originalContent: string) => `
    You are a Content Editor.
    Your task is to REWRITE the provided JSON content to resolve strict pedagogical issues.
    
    Issues Found:
    ${issues}

    Original Content:
    ${originalContent}

    INSTRUCTION:
    1. Fix ONLY the specific issues listed.
    2. Maintain the original JSON structure exactly.
    3. Do NOT change the topic or core educational value, just the wording/structure to match the target audience.
    
    Output the corrected JSON only.
`;


export const getGradingPrompt = (questionText: string, rubric: string, studentAnswers: string) => `
    You are an expert teacher grading student answers.
    
    Question: "${questionText}"
    
    Rubric / Ideal Answer:
    "${rubric}"
    
    Task:
    Grade the following student answers.
    Provide a grade (0-100) and short constructive feedback (in Hebrew) for each.
    
    Input (Student Answers):
    ${studentAnswers}

    Output Required: JSON Array
    [
      { "id": "submission_id", "grade": 90, "feedback": "Nice job..." }
    ]
`;

export const getGuardianPrompt = (mode: string, contentJson: string) => `
### SYSTEM ROLE
You are the **Wizdi Integrity Guardian**, a rigorous pedagogical auditor API.
Your Goal: Protect the teacher from low-quality, misaligned, or "student-facing" content masquerading as a Lesson Plan.

### INPUT CONTEXT
- **Target Mode:** \${mode}
- **Input Content:**
\${contentJson.substring(0, 15000)}

### AUDIT PROTOCOL
1. **Identity Check:** Is this a quiz? Is it addressing the student directly ("Circle the answer") instead of the teacher ("Ask students to circle")?
2. **Structure Check:** Does it have distinct teaching phases?
3. **Safety Check:** valid JSON?

### OUTPUT FORMAT (Strict JSON Only)
Returns a JSON object. NO markdown formatting.
{
  "audit_result": {
    "status": "PASS" | "CRITICAL_FAIL" | "WARNING",
    "failure_reason_code": "WORKSHEET_FALLACY" | "STUDENT_VOICE_ERROR" | "MISSING_TIMESTAMPS" | "NONE",
    "confidence_score": 0-100
  },
  "pedagogical_report": {
    "target_audience_detected": "Teacher" | "Student" | "Unknown",
    "structure_quality": {
      "has_opening": boolean,
      "has_guided_practice": boolean,
      "has_closure": boolean
    },
    "feedback_hebrew": "Short feedback string in Hebrew for the user (only if WARNING/FAIL)"
  },
  "auto_repair_instruction": "String prompt to send back to the Generator AI to fix the specific issues found (if FAIL)."
}
`;

/**
 * DYNAMIC LINGUISTIC CONSTRAINTS BY GRADE LEVEL
 *
 * This function generates grade-appropriate linguistic guidelines based on CEFR standards.
 * It ensures content is written at the appropriate complexity level for each age group.
 *
 * Reference: PROJECT_DNA Section 1.3 (Complexity Adaptation) and pedagogicalPrompts.ts
 */
export const getLinguisticConstraintsByGrade = (gradeLevel: string): string => {
    const grade = gradeLevel?.toLowerCase() || '';

    // Elementary School: Grades 1-2 (כיתות א'-ב')
    if (grade.includes('א') || grade.includes('ב') ||
        grade.includes('1') || grade.includes('2') ||
        grade.includes('first') || grade.includes('second')) {
        return `
### LINGUISTIC CONSTRAINTS - EARLY ELEMENTARY (Grades 1-2) | CEFR Pre-A1 to A1

**CRITICAL: This is for YOUNG CHILDREN (ages 6-8). Language must be EXTREMELY simple.**

**Sentence Structure:**
- Maximum 5-8 words per sentence
- Simple Subject-Verb-Object only ("הכלב רץ בגינה")
- ONE idea per sentence
- **FORBIDDEN:** Compound sentences, subordinate clauses, passive voice

**Vocabulary:**
- Use only basic, concrete words from daily life
- Objects child can touch/see: בית, כלב, אמא, שמש, מים, אוכל
- Actions child does: רץ, אוכל, ישן, משחק, צוחק
- **FORBIDDEN:** Abstract concepts without concrete examples
- Every new word MUST have a familiar example: "פרפר - זוכר את הפרפר הכתום שראינו בגינה?"

**Tone & Style:**
- Warm, encouraging, playful
- Direct address: "אתה", "שלך", "בוא נראה"
- Use questions to engage: "מה אתה חושב?"
- Short paragraphs (2-3 sentences max)

**Analogies (MANDATORY):**
- Every concept needs a concrete daily-life example
- "השמש חמה - כמו כשאתה מתחמם ליד התנור"
- "מספרים - כמו לספור את האצבעות שלך"
`;
    }

    // Elementary School: Grades 3-4 (כיתות ג'-ד')
    if (grade.includes('ג') || grade.includes('ד') ||
        grade.includes('3') || grade.includes('4') ||
        grade.includes('third') || grade.includes('fourth')) {
        return `
### LINGUISTIC CONSTRAINTS - ELEMENTARY (Grades 3-4) | CEFR A1-A2

**Sentence Structure:**
- Maximum 8-10 words per sentence
- Simple sentences with ONE connector allowed: "ו", "אבל", "כי"
- **FORBIDDEN:** Passive voice ("התפוח נאכל" → use "דני אכל את התפוח")
- **FORBIDDEN:** Long construct chains ("סמיכויות")
- **FORBIDDEN:** Complex subordinate clauses

**Vocabulary:**
- Concrete nouns primarily (שולחן, עץ, חיה, מכונית)
- Simple action verbs in present/past tense
- Abstract words MUST be explained in parentheses or with example
- Example: "אקלים (מזג האוויר לאורך זמן - האם בדרך כלל חם או קר?)"

**Tone & Style:**
- Friendly, clear, encouraging
- Direct address: "אתה/את", "נסה/נסי"
- Break complex ideas into small steps
- Use bullet points and numbered lists

**Analogies (MANDATORY for technical terms):**
- "פוטוסינתזה - כמו שאתה צריך לאכול כדי לקבל כוח, הצמח משתמש באור השמש כדי לייצר אוכל"
- "אטום - חלקיק קטנטן, כמו גרגיר חול, אבל קטן בהרבה - כל כך קטן שאי אפשר לראות אותו"
`;
    }

    // Elementary School: Grades 5-6 (כיתות ה'-ו')
    if (grade.includes('ה') || grade.includes('ו') ||
        grade.includes('5') || grade.includes('6') ||
        grade.includes('fifth') || grade.includes('sixth')) {
        return `
### LINGUISTIC CONSTRAINTS - UPPER ELEMENTARY (Grades 5-6) | CEFR A2-B1

**Sentence Structure:**
- Maximum 10-12 words per sentence
- Simple compound sentences allowed: "וגם", "אבל", "לכן", "כי"
- **FORBIDDEN:** Passive voice (use active: "המדענים גילו" not "התגלה ע"י")
- **FORBIDDEN:** Long chains of construct states
- **FORBIDDEN:** Academic nominalization

**Vocabulary:**
- Concrete nouns + basic abstract concepts with explanation
- Can introduce subject-specific terms WITH immediate definition
- Example: "מערכת העיכול (החלקים בגוף שמפרקים את האוכל)"

**Tone & Style:**
- Clear, respectful, slightly more mature
- Can use "אנחנו" for inclusive feeling
- Encourage curiosity: "בואו נבדוק למה זה קורה"
- Paragraphs of 3-4 sentences OK

**Cognitive Level:**
- Simple cause-and-effect: "כאשר X קורה, אז Y"
- Basic comparisons: "בדומה ל...", "שונה מ..."
- Introduce "Why" questions

**Analogies (Required for new concepts):**
- "כדור הארץ סובב סביב השמש כמו שילד רץ במעגל סביב עץ בחצר"
- "DNA הוא כמו ספר מתכונים - הוא מכיל את כל ההוראות לבניית הגוף"
`;
    }

    // Middle School: Grades 7-8 (כיתות ז'-ח')
    if (grade.includes('ז') || grade.includes('ח') ||
        grade.includes('7') || grade.includes('8') ||
        grade.includes('seventh') || grade.includes('eighth')) {
        return `
### LINGUISTIC CONSTRAINTS - MIDDLE SCHOOL (Grades 7-8) | CEFR B1

**Sentence Structure:**
- Maximum 15-18 words per sentence
- Compound sentences with logical connectors: "למרות ש", "מפני ש", "לכן", "אולם"
- Complex sentences allowed but must be clear
- Passive voice allowed sparingly when appropriate

**Vocabulary:**
- Subject-specific terminology expected (with brief reminder if complex)
- Abstract concepts without extensive explanation if grade-appropriate
- Can use academic terms that students have encountered before

**Tone & Style:**
- More mature, treats student as capable learner
- Can include mild humor or engaging hooks
- "שימו לב ש...", "חשוב להבין ש..."
- Metaphors allowed if clear

**Cognitive Level:**
- Cause-and-effect chains (A leads to B leads to C)
- Compare and contrast multiple items
- Basic analysis: "מה היתרונות והחסרונות?"
- Can introduce multiple perspectives

**Analogies (For complex concepts only):**
- Use analogies for truly difficult concepts, not for everything
- "מערכת החיסון פועלת כמו צבא שמגן על המדינה מפני פולשים"
`;
    }

    // Middle School: Grade 9 (כיתה ט')
    if (grade.includes('ט') || grade.includes('9') || grade.includes('ninth')) {
        return `
### LINGUISTIC CONSTRAINTS - MIDDLE SCHOOL (Grade 9) | CEFR B1-B2

**Sentence Structure:**
- Maximum 18-20 words per sentence
- Full range of compound and complex sentences
- Logical connectors required: "לעומת זאת", "כתוצאה מכך", "יתרה מזאת"
- Embedded clauses allowed

**Vocabulary:**
- Full subject-specific vocabulary expected
- Technical terms used naturally
- Abstract concepts discussed without simplification

**Tone & Style:**
- Academic but accessible
- Objective tone for factual content
- Can challenge students: "האם אתם מסכימים? נמקו."
- Treats student as young adult

**Cognitive Level:**
- Multi-step analysis required
- Synthesis of information from multiple sources
- Basic evaluation: "עד כמה הטיעון משכנע?"
- Introduction to critical thinking

**No analogies required** - use only when genuinely helpful for abstract concepts
`;
    }

    // High School: Grades 10-12 (כיתות י'-י"ב)
    if (grade.includes('י') || grade.includes('10') || grade.includes('11') || grade.includes('12') ||
        grade.includes('tenth') || grade.includes('eleventh') || grade.includes('twelfth') ||
        grade.includes('תיכון') || grade.includes('high')) {
        return `
### LINGUISTIC CONSTRAINTS - HIGH SCHOOL (Grades 10-12) | CEFR B2-C1

**Sentence Structure:**
- No hard limit on sentence length, but clarity is paramount
- Academic/Formal Hebrew register expected
- **REQUIRED:** Use of nominalization ("שם פעולה") where appropriate
  - Instead of "אנשים התנגדו" → "התנגדות הציבור הובילה ל..."
- Complex syntax with embedded clauses
- Full passive voice usage when stylistically appropriate

**Vocabulary:**
- Full academic vocabulary
- Subject-specific jargon expected without explanation
- Nuanced language: "לטעון" vs "להציע" vs "לקבוע"

**Tone & Style:**
- Formal, academic, objective
- **FORBIDDEN:** "Baby talk", over-simplification, excessive encouragement
- Treats student as scholar/researcher
- "יש לציין ש...", "מן הראוי לבחון...", "ניתן לטעון ש..."

**Cognitive Level:**
- Critical analysis and evaluation
- Synthesis across multiple sources
- Identifying bias, assumptions, limitations
- Constructing and deconstructing arguments
- Meta-cognitive awareness: "מהן ההנחות מאחורי טיעון זה?"

**No analogies** - students should engage with concepts directly at their complexity level
`;
    }

    // College/University or Professional (סטודנטים/הכשרה מקצועית)
    if (grade.includes('סטודנט') || grade.includes('אוניברסיט') ||
        grade.includes('מקצועי') || grade.includes('college') ||
        grade.includes('university') || grade.includes('professional') ||
        grade.includes('adult')) {
        return `
### LINGUISTIC CONSTRAINTS - HIGHER EDUCATION / PROFESSIONAL | CEFR C1-C2

**Sentence Structure:**
- No restrictions - use academic conventions
- Complex argumentation structures expected
- Discipline-specific discourse patterns

**Vocabulary:**
- Full technical/professional vocabulary
- Field-specific terminology without explanation
- Precision in word choice is critical

**Tone & Style:**
- Formal academic or professional register
- Objective, evidence-based language
- Can engage with theoretical frameworks directly

**Cognitive Level:**
- Advanced analysis, synthesis, and evaluation
- Original argumentation expected
- Engagement with primary sources
- Critical evaluation of methodology
`;
    }

    // Default fallback - Middle School level (safe middle ground)
    return `
### LINGUISTIC CONSTRAINTS - GENERAL (Default: Middle School Level) | CEFR B1

**Note:** Grade level not clearly specified. Using middle-school appropriate language as default.

**Sentence Structure:**
- Maximum 15 words per sentence
- Clear compound sentences with logical connectors
- Avoid overly complex constructions

**Vocabulary:**
- Clear, accessible language
- Explain technical terms on first use
- Prefer concrete over abstract when possible

**Tone & Style:**
- Friendly but respectful
- Engaging without being childish
- Clear explanations with examples

**Analogies:** Use for complex concepts to aid understanding
`;
};
