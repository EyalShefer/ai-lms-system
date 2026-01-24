
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

  # CRITICAL RULE
  NEVER mention "sample answer", "model answer", "תשובה לדוגמא", or "תשובה מודל" in your feedback. The student cannot see this answer.

  # OUTPUT FORMAT(JSON ONLY)
    {
      "status": "correct" | "partial" | "incorrect",
        "feedback_to_student": "WRITE HERE: The personalized message (in Hebrew). E.g., 'אתה צודק לגבי הכלכלה, אבל מה לגבי המצב הפוליטי?'"
    }
`;

export const getRefinementPrompt = (content: string, instruction: string) => `
אתה עורך פדגוגי מומחה. עליך לשפר את התוכן החינוכי לפי ההוראה שתקבל.

## קלט - JSON מקורי:
${content}

## הוראת המשתמש:
${instruction}

## כללים קריטיים:
1. **שמור על מבנה ה-JSON בדיוק** - החזר את אותם שדות בדיוק כמו בקלט
2. **שנה רק את מה שההוראה מבקשת** - אל תשנה שדות אחרים
3. **שפת הפלט: עברית** (אלא אם ההוראה מבקשת אחרת)
4. **החזר JSON תקין בלבד** - ללא טקסט נוסף, ללא markdown
5. **אם התוכן ריק או חסר** (מערכים ריקים, שדות חסרים) - צור תוכן חדש לפי סוג הבלוק והוראת המשתמש!

## כללי כתיבה נכונה בעברית (קריטי!):
- **סדר מילים:** הנושא קודם, אחר כך הפועל. לא להתחיל משפט עם נשוא או תואר.
  * שגוי: "נחשב ט״ו בשבט הוא יום מיוחד"
  * נכון: "ט״ו בשבט נחשב ליום מיוחד" או "ט״ו בשבט הוא יום מיוחד"
- **פתיחת משפטים:** לעולם לא להתחיל הסבר עם "נחשב", "מהווה", "נקרא" וכדומה ללא נושא ברור.
  * שגוי: "נחשב לאחד מהחגים החשובים..."
  * נכון: "ט״ו בשבט הוא אחד מהחגים החשובים..."
- **זרימה טבעית:** קרא כל משפט בקול רם (מנטלית). אם זה נשמע מגושם - שכתב.

## דוגמאות למבני JSON נפוצים:

### שאלת רב-ברירה (multiple-choice):
{
  "question": "טקסט השאלה",
  "options": ["תשובה א", "תשובה ב", "תשובה ג", "תשובה ד"],
  "correctAnswer": "התשובה הנכונה"
}

### שאלה פתוחה (open-question):
{
  "question": "טקסט השאלה",
  "expectedAnswer": "תשובה מודל"
}

### השלמת חסר (fill_in_blanks):
{
  "text": "משפט עם [מילה חסרה] בסוגריים"
}

### סידור/מיון (ordering):
{
  "instruction": "הוראה למשתמש",
  "correct_order": ["פריט 1", "פריט 2", "פריט 3"]
}

### קטגוריזציה (categorization):
{
  "question": "שאלה",
  "categories": ["קטגוריה 1", "קטגוריה 2"],
  "items": [{ "text": "פריט", "category": "קטגוריה 1" }]
}

### משחק זיכרון (memory_game):
{
  "pairs": [
    { "card_a": "מושג ראשון", "card_b": "הגדרה ראשונה" },
    { "card_a": "מושג שני", "card_b": "הגדרה שנייה" }
  ]
}
**חשוב:** אם אין pairs או שהמערך ריק, צור 6 זוגות חדשים על הנושא!

### התאמה (matching):
{
  "instruction": "התאם בין המושגים לבין ההגדרות",
  "leftItems": [
    { "id": "l1", "text": "מושג א" },
    { "id": "l2", "text": "מושג ב" }
  ],
  "rightItems": [
    { "id": "r1", "text": "הגדרה א" },
    { "id": "r2", "text": "הגדרה ב" }
  ],
  "correctMatches": [
    { "left": "l1", "right": "r1" },
    { "left": "l2", "right": "r2" }
  ]
}
**חשוב:** אם אין items או שהמערכים ריקים, צור 5 זוגות התאמה חדשים על הנושא!

### נכון/לא נכון (true_false_speed):
{
  "instruction": "קראו את המשפט והחליטו - אמת או שקר?",
  "statements": [
    { "text": "טענה ראשונה", "is_true": true },
    { "text": "טענה שנייה", "is_true": false },
    { "text": "טענה שלישית", "is_true": true }
  ]
}
**חשוב:** אם אין statements או שהמערך ריק, צור 5 משפטים חדשים על הנושא!

### טקסט/הסבר (text):
{
  "text": "התוכן הטקסטואלי"
}

## הנחיות מיוחדות לשיפור פתיחות שיעור (HOOKS):

אם ההוראה מבקשת לשפר/לשנות פתיחה או "hook", אתה חייב ליצור פתיחה **יצירתית ומרתקת**.

**אסור בתכלית האיסור:**
- "שאלו את התלמידים מה הם יודעים על..."
- "התחילו בדיון פתוח"
- "הציגו את הנושא"
- כל פתיחה גנרית ומשעממת

**חובה לבחור אחד מהסוגים הבאים:**

**Type A: Visual Hook (תמונה/סרטון)**
- הצגת תמונה מפתיעה או סרטון קצר (30-60 שניות)
- דוגמה: "הציגו תמונה של [משהו מפתיע] ושאלו: 'מה קורה כאן? למה?'"

**Type B: Mystery/Riddle Hook (חידה/תעלומה)**
- חידה, תעלומה או שאלה מסקרנת
- דוגמה: "הנה עובדה מוזרה: [עובדה]. איך זה יכול להיות?"

**Type C: Quick Game/Challenge (משחקון מהיר)**
- משחק של 2-3 דקות או אתגר
- דוגמה: "משחק אסוציאציות: כתבו 3 מילים שקשורות ל[נושא] תוך 30 שניות"

**Type D: Provocation/Dilemma Hook (פרובוקציה/דילמה)**
- טענה מעוררת מחשבה או דילמה מוסרית
- דוגמה: "אני טוען ש[טענה מפתיעה]. מי מסכים? מי מתנגד?"

**Type E: Hands-On Hook (חוויה מעשית)**
- פעילות מעשית קצרה או הדגמה
- דוגמה: "כל אחד מקבל [חומר]. יש לכם דקה ל[משימה]"

**Type F: Personal Connection Hook (חיבור אישי)**
- חיבור לחיי התלמידים עם twist מפתיע
- דוגמה: "מי מכם [עשה משהו]? אתם יודעים ש[עובדה מפתיעה]?"

הפתיחה חייבת לכלול תסריט מדויק למורה - מה בדיוק לומר/לעשות.

## פלט:
החזר את ה-JSON המשופר בלבד, ללא הסברים.
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
Role: Educational Data Analyst.
Task: Analyze student performance based on learning data.
Student: ${studentName}.
Topic: ${courseTopic}.

DATA:
${submissionData}

METRICS TO ANALYZE:
1. Time per Question: Calculate average time spent
2. Attempts: Count average attempts per question
3. Hints: Calculate hint usage rate
4. Mistakes: Identify specific topics or skills with repeated errors

OUTPUT FORMAT (JSON ONLY):
{
  "strengths": ["List 2-3 specific skills the student demonstrated well"],
  "weaknesses": ["List 2-3 specific topics that need more practice"],
  "recommendedFocus": "Specific topic or skill to practice next",
  "learningMetrics": {
    "averageTimePerQuestion": 0,
    "hintUsageRate": 0.0,
    "attemptsPerQuestion": 0,
    "completionRate": 0.0
  }
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

      OUTPUT FORMAT(JSON ONLY):
{
  "strongSkills": ["List 2-3 skills the CLASS excels at"],
    "weakSkills": ["List 2-3 skills the CLASS struggles with"],
      "actionItems": ["List 2 practical teaching strategies for tomorrow"]
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

// ============================================================
// MATH-SPECIFIC PROMPTS FOR ELEMENTARY SCHOOL (כיתות א'-ו')
// ============================================================

export const MATH_GRADE_TOPICS: Record<string, string[]> = {
  'א': ['מספרים 1-20', 'חיבור וחיסור עד 10', 'צורות בסיסיות', 'מדידת אורך'],
  'ב': ['מספרים עד 100', 'חיבור וחיסור עד 100', 'כפל פשוט', 'שעון'],
  'ג': ['מספרים עד 1000', 'לוח הכפל', 'חילוק', 'שברים פשוטים (½, ¼, ⅓)'],
  'ד': ['מספרים עד 10000', 'כפל וחילוק מרובה ספרות', 'שברים', 'היקף ושטח'],
  'ה': ['מספרים עשרוניים', 'אחוזים', 'שברים מורכבים', 'נפח', 'ממוצע'],
  'ו': ['מספרים שליליים', 'יחס ופרופורציה', 'אחוזים מתקדם', 'גיאומטריה']
};

export const getMathQuestionPrompt = (
  gradeLevel: string,
  topic: string,
  questionType: string,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
) => `
אתה מומחה פדגוגי ליצירת שאלות מתמטיקה לבית הספר היסודי בישראל.

כיתה: ${gradeLevel}
נושא: ${topic}
סוג שאלה: ${questionType}
רמת קושי: ${difficulty === 'easy' ? 'קל' : difficulty === 'medium' ? 'בינוני' : 'מאתגר'}

## כללים קריטיים:

### 1. התשובה חייבת להיות פשוטה!
- תשובה מספרית בלבד (לא ביטוי אלגברי)
- התלמיד מקליד רק: מספר, או שני מספרים מופרדים בפסיק
- דוגמאות תשובות תקינות: "12", "3, 5", "2.5", "3/4"

### 2. שפה מותאמת גיל
- כיתות א'-ב': משפטים קצרים, מילים פשוטות, הקשר מחיי היומיום
- כיתות ג'-ד': בעיות מילוליות עם הקשר, 2-3 משפטים
- כיתות ה'-ו': בעיות מורכבות יותר, אך עדיין ברורות

### 3. סוגי שאלות לפי questionType:

**multiple-choice:**
{
  "question": "טקסט השאלה",
  "options": ["תשובה א", "תשובה ב", "תשובה ג", "תשובה ד"],
  "correctAnswer": "תשובה א"
}

**open-question (תשובה מספרית):**
{
  "question": "בעיה מילולית שהתשובה שלה היא מספר",
  "expectedAnswer": "42",
  "answerType": "number",
  "tolerance": 0,
  "unit": "ס\"מ"
}

**fill_in_blanks:**
{
  "text": "אם 6 × 7 = [42], אז 7 × 6 = [42]"
}
הערה: המילה בסוגריים מרובעים היא התשובה

**ordering:**
{
  "instruction": "סדרו מהקטן לגדול",
  "correct_order": ["¼", "⅓", "½", "¾"]
}

**categorization:**
{
  "question": "מיינו את המספרים",
  "categories": ["זוגי", "אי-זוגי"],
  "items": [
    { "text": "12", "category": "זוגי" },
    { "text": "15", "category": "אי-זוגי" }
  ]
}

**memory_game:**
{
  "pairs": [
    { "card_a": "3 × 4", "card_b": "12" },
    { "card_a": "5 × 5", "card_b": "25" }
  ]
}

### 4. דוגמאות לפי כיתה:

**כיתה ב' - חיבור:**
"בסל יש 15 תפוחים. אמא הוסיפה עוד 8 תפוחים. כמה תפוחים יש עכשיו בסל?"
תשובה: 23

**כיתה ד' - שטח:**
"מלבן: אורך 8 ס״מ, רוחב 5 ס״מ. מה השטח?"
תשובה: 40

**כיתה ו' - אחוזים:**
"בכיתה 30 תלמידים. 20% נעדרו היום. כמה תלמידים נעדרו?"
תשובה: 6

## פלט JSON:
צור שאלה אחת בפורמט המתאים לסוג השאלה שנבחר.
`;

export const getMathWordProblemPrompt = (gradeLevel: string, operation: string) => `
צור בעיה מילולית במתמטיקה.

כיתה: ${gradeLevel}
פעולה: ${operation}
שפה: עברית

## כללים:
1. הקשר מחיי היומיום של ילד ישראלי (בית ספר, חנות, משפחה, ספורט)
2. מספרים הגיוניים (לא "1,000,000 תפוחים")
3. שאלה אחת ברורה בסוף
4. התשובה היא מספר אחד בלבד

## מבנה הפלט:
{
  "story": "הסיפור/הקשר",
  "question": "השאלה הספציפית",
  "answer": number,
  "unit": "יחידה (אם רלוונטי)",
  "solution_steps": ["שלב 1", "שלב 2"],
  "difficulty": "easy" | "medium" | "hard"
}

## דוגמאות לפעולות:
- חיבור: "יש לי 15 גולות, קיבלתי עוד 8. כמה יש לי?"
- חיסור: "היו 24 עוגיות, אכלנו 9. כמה נשארו?"
- כפל: "בכל שורה 6 כיסאות, יש 4 שורות. כמה כיסאות?"
- חילוק: "48 ממתקים מחלקים ל-6 ילדים שווה. כמה לכל אחד?"
- שברים: "אכלתי חצי פיצה ואחותי רבע. כמה אכלנו ביחד?"
- אחוזים: "ספר עלה 50 ש״ח, יש הנחה של 20%. כמה לשלם?"
`;

export const getMathMultiStepPrompt = (gradeLevel: string, topic: string, steps: number = 3) => `
צור שאלה רב-שלבית במתמטיקה שבודקת את התהליך, לא רק את התוצאה.

כיתה: ${gradeLevel}
נושא: ${topic}
מספר שלבים: ${steps}

## הרעיון:
במקום לשאול "פתור את המשוואה", נפרק לשלבים:
1. שאלה על הזיהוי/הבנה
2. שאלה על הפעולה הנדרשת
3. שאלה על התוצאה

## מבנה הפלט:
{
  "context": "הצגת הבעיה/תרגיל",
  "steps": [
    {
      "step_number": 1,
      "question": "שאלה על הבנת הבעיה",
      "type": "multiple-choice",
      "options": ["א", "ב", "ג", "ד"],
      "correctAnswer": "ב",
      "explanation": "הסבר למה זו התשובה"
    },
    {
      "step_number": 2,
      "question": "שאלה על הפעולה",
      "type": "multiple-choice",
      "options": [...],
      "correctAnswer": "...",
      "explanation": "..."
    },
    {
      "step_number": 3,
      "question": "מהי התשובה הסופית?",
      "type": "open-question",
      "expectedAnswer": "42",
      "explanation": "..."
    }
  ],
  "full_solution": "פתרון מלא שלב אחר שלב",
  "common_mistakes": ["טעות נפוצה 1", "טעות נפוצה 2"]
}

## דוגמה - משוואה פשוטה (כיתה ד'):
קונטקסט: "יוסי חשב: אם אוסיף 7 למספר שחשבתי, אקבל 23. מה המספר?"

שלב 1: "מה הפעולה ההפוכה לחיבור?"
- חיסור ✓
- כפל
- חילוק

שלב 2: "איזה חשבון צריך לעשות?"
- 23 + 7
- 23 - 7 ✓
- 23 × 7

שלב 3: "מה המספר שיוסי חשב?"
תשובה: 16
`;

export const getMathValidationRules = () => ({
  // כללים לוולידציה של תשובות מתמטיות
  numberEquivalence: {
    description: 'בדיקת שוויון מספרי',
    rules: [
      { input: '0.5', equivalents: ['0.5', '0,5', '.5', '1/2', '½'] },
      { input: '0.25', equivalents: ['0.25', '0,25', '.25', '1/4', '¼'] },
      { input: '0.75', equivalents: ['0.75', '0,75', '.75', '3/4', '¾'] },
      { input: '0.333', equivalents: ['0.333', '0.33', '1/3', '⅓'] },
    ]
  },
  fractionFormats: {
    description: 'פורמטים מקובלים לשברים',
    accepted: ['1/2', '½', '1 / 2', '1:2'],
    normalize: (input: string) => input.replace(/\s/g, '').replace(':', '/')
  },
  toleranceByGrade: {
    'א': 0,      // תשובה מדויקת
    'ב': 0,
    'ג': 0,
    'ד': 0,
    'ה': 0.01,   // סטייה קטנה בעשרוניים
    'ו': 0.01
  }
});
