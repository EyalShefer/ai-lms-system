
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
    
    OUTPUT JSON:
{
  "question": "The open question text",
    "model_answer": "A model answer or key points to look for."
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
