import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from 'uuid';

// אתחול הקליינט של ג'מיני
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

// --- התיקון: שימוש במודל שזמין לך בוודאות (לפי הצילום ששלחת) ---
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// --- Helper: Robust JSON Cleaner ---
const cleanJsonString = (text: string): string => {
  try {
    let clean = text.replace(/```json|```/g, '').trim();
    const firstBrace = clean.indexOf('{');
    const firstBracket = clean.indexOf('[');

    let startIndex = -1;
    let endIndex = -1;

    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      startIndex = firstBracket;
      endIndex = clean.lastIndexOf(']') + 1;
    } else if (firstBrace !== -1) {
      startIndex = firstBrace;
      endIndex = clean.lastIndexOf('}') + 1;
    }

    if (startIndex !== -1 && endIndex !== -1) {
      clean = clean.substring(startIndex, endIndex);
    }

    return clean;
  } catch (e) {
    console.error("JSON Clean Error:", e);
    return text;
  }
};

// --- Helper: Mapping Logic ---
const mapSystemItemToBlock = (item: any) => {
  const commonMetadata = {
    bloomLevel: item.bloom_level,
    feedbackCorrect: item.feedback_correct,
    feedbackIncorrect: item.feedback_incorrect,
    sourceReference: item.source_reference
  };

  if (item.type === 'multiple_choice' || item.type === 'true_false') {
    let options = item.content.options || [];
    let correctAnswer = "";

    if (typeof item.content.correct_index === 'number' && options[item.content.correct_index]) {
      correctAnswer = options[item.content.correct_index];
    } else {
      correctAnswer = options[0] || "";
    }

    return {
      id: uuidv4(),
      type: 'multiple-choice',
      content: {
        question: item.question_text,
        options: options,
        correctAnswer: correctAnswer
      },
      metadata: { ...commonMetadata, score: 10 }
    };
  }

  if (item.type === 'open_question') {
    return {
      id: uuidv4(),
      type: 'open-question',
      content: {
        question: item.question_text
      },
      metadata: {
        ...commonMetadata,
        modelAnswer: item.content.key_points ? item.content.key_points.join('\n') : "תשובה מלאה",
        hint: item.content.hint,
        score: 20
      }
    };
  }

  if (item.type === 'sorting' || item.type === 'sequencing') {
    const isSorting = item.type === 'sorting';
    return {
      id: uuidv4(),
      type: 'multiple-choice',
      content: {
        question: item.question_text + (isSorting ? " (בחר את ההתאמה הנכונה)" : " (בחר את הסדר הנכון)"),
        options: isSorting
          ? ["התאמה נכונה של הפריטים לקטגוריות", "התאמה שגויה", "התאמה חלקית", "אף תשובה אינה נכונה"]
          : ["הסדר הנכון כפי שנלמד", "סדר הפוך", "סדר אקראי א", "סדר אקראי ב"],
        correctAnswer: isSorting ? "התאמה נכונה של הפריטים לקטגוריות" : "הסדר הנכון כפי שנלמד"
      },
      metadata: { ...commonMetadata, note: "הומר אוטומטית משאלת מיון/רצף" }
    };
  }

  return null;
};

// --- פונקציה 1: יצירת שלד הפעילות ---
export const generateCoursePlan = async (
  topic: string,
  gradeLevel: string,
  fileData?: { base64: string; mimeType: string }
) => {
  return [
    {
      id: uuidv4(),
      title: "פעילות אינטראקטיבית",
      learningUnits: [
        {
          id: uuidv4(),
          title: topic || "פעילות למידה",
          type: 'practice',
          activityBlocks: []
        }
      ]
    }
  ];
};

// --- פונקציה 2: יצירת תוכן מלא ליחידה ---
export const generateFullUnitContent = async (
  unitTitle: string,
  courseTopic: string,
  gradeLevel: string = "כללי",
  fileData?: { base64: string; mimeType: string }
) => {

  const systemPrompt = `
    תפקיד (Role):
    אתה מומחה לפדגוגיה דיגיטלית, מעבד תוכן לימודי, ומעצב חווית משתמש (UX). המטרה שלך היא לנתח חומר לימודי ולייצר ממנו פעילות אינטראקטיבית מודולרית ומדויקת.
    
    הנחיה קריטית – מקור האמת (Source of Truth):
    אם סופק מסמך: עליך לבסס את כל השאלות אך ורק עליו. אל תמציא עובדות.
    אם סופק רק נושא: השתמש בידע הפדגוגי שלך.

    התאם את הניסוח לשכבת הגיל: ${gradeLevel}.

    מבנה הפלט הטכני (JSON Output Schema):
    החזר אך ורק מערך JSON תקין (Array of Objects). כל פריט במערך יכלול:
    {
      "id": 1,
      "bloom_level": "Knowledge" | "Understanding" | "Analysis",
      "type": "multiple_choice" | "true_false" | "open_question" | "sorting" | "sequencing",
      "question_text": "ניסוח השאלה...",
      "source_reference": "ציטוט מהמקור (אופציונלי)",
      "feedback_correct": "משוב מחזק...",
      "feedback_incorrect": "הסבר לטעות...",
      "content": {
         // עבור multiple_choice / true_false
         "options": ["אופציה 1", "אופציה 2", "אופציה 3", "אופציה 4"], 
         "correct_index": 0, // אינדקס התשובה הנכונה (0-based)
         
         // עבור open_question
         "hint": "רמז לתלמיד...",
         "key_points": ["נקודה 1", "נקודה 2"]
      }
    }

    Task: צור 6-8 רכיבים מגוונים המכסים את הטקסונומיה (ידע, הבנה, יישום).
    Return ONLY raw JSON. No markdown.
  `;

  const userRequest = `
    הנושא: ${courseTopic}.
    כותרת היחידה: ${unitTitle}.
    ${fileData ? "מצורף קובץ מקור. נתח אותו והתבסס עליו." : "לא צורף קובץ, התבסס על הנושא."}
  `;

  try {
    const parts: any[] = [systemPrompt + "\n" + userRequest];

    if (fileData) {
      parts.push({
        inlineData: {
          data: fileData.base64,
          mimeType: fileData.mimeType
        }
      });
    }

    const result = await model.generateContent(parts);
    const text = cleanJsonString(result.response.text());

    const generatedItems = JSON.parse(text);

    const blocks: any[] = [];

    // בלוק 1: פתיח
    blocks.push({
      id: uuidv4(),
      type: 'text',
      content: `### ברוכים הבאים לפעילות בנושא: ${unitTitle}\nבפעילות זו נלמד ונתרגל את עקרונות הנושא. בהצלחה!`,
      metadata: {}
    });

    // בלוק 2: בוט מלווה
    blocks.push({
      id: uuidv4(),
      type: 'interactive-chat',
      content: {
        title: "המנחה האישי שלך",
        description: "כאן לכל שאלה ועזרה"
      },
      metadata: {
        botPersona: 'teacher',
        initialMessage: `שלום! אני כאן כדי לעזור לך להבין את החומר בנושא ${unitTitle}. אפשר להתחיל?`,
        systemPrompt: `אתה מורה פרטי לכיתה ${gradeLevel} בנושא ${courseTopic}. היה סבלני ומעודד.`
      }
    });

    // המרת השאלות
    if (Array.isArray(generatedItems)) {
      generatedItems.forEach(item => {
        const block = mapSystemItemToBlock(item);
        if (block) blocks.push(block);
      });
    }

    return blocks;

  } catch (e) {
    console.error("Error generating unit content", e);
    return [{
      id: uuidv4(),
      type: 'text',
      content: "אירעה שגיאה ביצירת התוכן. ייתכן שיש עומס על המערכת, אנא נסה שוב.",
      metadata: {}
    }];
  }
};

// --- שאר הפונקציות המקוריות (ללא שינוי, העתק מדויק) ---

export const refineContentWithPedagogy = async (content: string, instruction: string) => {
  const prompt = `Act as an expert pedagogical editor. Original text: "${content}". Instruction: ${instruction}. Language: Hebrew. Return ONLY the refined text.`;
  const result = await model.generateContent(prompt);
  return result.response.text();
};

export const generateQuestionsFromText = async (text: string, type: 'multiple-choice' | 'open-question') => {
  const prompt = `
    Based on the following text: "${text.substring(0, 1000)}..."
    Create 3 ${type === 'multiple-choice' ? 'multiple choice questions' : 'open-ended questions'}.
    Language: Hebrew.
    Return ONLY valid JSON array.
  `;

  try {
    const result = await model.generateContent(prompt);
    const textRes = cleanJsonString(result.response.text());
    return JSON.parse(textRes);
  } catch (e) {
    return [];
  }
};

export const generateImagePromptBlock = async (context: string) => {
  const prompt = `Suggest a creative AI image prompt (in English) to visualize: "${context.substring(0, 200)}". Return ONLY the prompt string.`;
  const result = await model.generateContent(prompt);
  return result.response.text();
};

export const generateAdaptiveUnit = async (originalUnit: any, weakness: string) => {
  return {
    id: uuidv4(),
    title: `חיזוק: ${originalUnit.title}`,
    type: 'remedial',
    baseContent: 'הסבר פשוט יותר...',
    activityBlocks: [
      {
        id: uuidv4(),
        type: 'text',
        content: `נראה שהתקשית בנושא ${originalUnit.title}. בוא ננסה להסביר את זה אחרת...`
      }
    ]
  };
};

export const generateClassAnalysis = async (studentsData: any[]) => {
  const prompt = `Analyze class data (JSON): ${JSON.stringify(studentsData).substring(0, 1000)}. Return JSON: { "classOverview": "...", "strongSkills": [], "weakSkills": [], "actionItems": [] } (Hebrew)`;
  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(cleanJsonString(result.response.text()));
  } catch (e) { return null; }
};

export const generateStudentReport = async (studentData: any) => {
  const prompt = `Create student report (JSON): ${JSON.stringify(studentData)}. Return JSON: { "studentName": "...", "summary": "...", "criteria": { "knowledge": "...", "depth": "...", "expression": "...", "recommendations": "..." } } (Hebrew)`;
  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(cleanJsonString(result.response.text()));
  } catch (e) { return null; }
};

export const generateSingleOpenQuestion = async (context: string) => {
  const prompt = `
      Create a single challenging open-ended question about: "${context}".
      Include a "Model Answer". Language: Hebrew.
      Return ONLY valid JSON: { "question": "...", "modelAnswer": "..." }
    `;
  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(cleanJsonString(result.response.text()));
  } catch (e) {
    return { question: "שגיאה ביצירה", modelAnswer: "" };
  }
};

export const generateSingleMultipleChoiceQuestion = async (context: string) => {
  const prompt = `
      Create a single multiple-choice question about: "${context}".
      Language: Hebrew.
      Return ONLY valid JSON: { "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "..." }
    `;
  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(cleanJsonString(result.response.text()));
  } catch (e) {
    return { question: "שגיאה ביצירה", options: [], correctAnswer: "" };
  }
};