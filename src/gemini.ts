import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from 'uuid';

// אתחול הקליינט של ג'מיני
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

// --- שימוש במודל הגנרי שעבד לך והוכח כיציב ---
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// --- פונקציית עזר: ניקוי JSON ---
// מנקה תגיות Markdown ומחלצת את ה-JSON הנקי מתוך הטקסט
const cleanJsonString = (text: string): string => {
  try {
    let clean = text.replace(/```json|```/g, '').trim();
    const firstBrace = clean.indexOf('{');
    const firstBracket = clean.indexOf('[');

    let startIndex = -1;
    let endIndex = -1;

    // זיהוי האם זה אובייקט או מערך
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

// --- פונקציית עזר: מיפוי פלט המערכת לבלוקים של הפעילות ---
const mapSystemItemToBlock = (item: any) => {
  const commonMetadata = {
    bloomLevel: item.bloom_level,
    feedbackCorrect: item.feedback_correct,
    feedbackIncorrect: item.feedback_incorrect,
    sourceReference: item.source_reference
  };

  // 1. שאלות אמריקאיות / נכון-לא נכון
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

  // 2. שאלות פתוחות
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

  // 3. מיון ורצף (המרה לאמריקאית כרגע)
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

// --- פונקציה 1: יצירת תוכנית הלימודים והתוכן הראשוני ---
export const generateCoursePlan = async (
  topic: string,
  gradeLevel: string,
  fileData?: { base64: string; mimeType: string }
) => {
  // 1. יצירת מבנה בסיסי
  const plan = [
    {
      id: uuidv4(),
      title: "פעילות אינטראקטיבית",
      learningUnits: [
        {
          id: uuidv4(),
          title: topic || "פעילות למידה",
          type: 'practice',
          activityBlocks: [] // נתחיל ריק
        }
      ]
    }
  ];

  // 2. יצירת תוכן עבור היחידה הראשונה מיד (כדי שהמשתמש לא יקבל מסך ריק)
  // התיקון הקריטי: אנחנו מעבירים את gradeLevel לפונקציה שיוצרת את התוכן!
  try {
    const firstUnit = plan[0].learningUnits[0];

    // כאן היתה הבעיה - הגיל לא עבר הלאה
    const contentBlocks = await generateFullUnitContent(
      firstUnit.title,
      topic,
      gradeLevel, // <--- הנה התיקון: מעבירים את הגיל שהתקבל
      fileData
    );

    firstUnit.activityBlocks = contentBlocks;

  } catch (e) {
    console.error("Error generating initial unit content:", e);
  }

  return plan;
};

// --- פונקציה 2: יצירת תוכן מלא ליחידה (הפונקציה הראשית) ---
export const generateFullUnitContent = async (
  unitTitle: string,
  courseTopic: string,
  gradeLevel: string = "כללי",
  fileData?: { base64: string; mimeType: string }
) => {

  // פרומפט מערכת מפורט ומוקפד, כולל הזרקת הגיל
  const systemPrompt = `
    תפקיד (Role):
    אתה מומחה לפדגוגיה דיגיטלית, מעבד תוכן לימודי, ומעצב חווית משתמש (UX). 
    המטרה שלך היא לנתח חומר לימודי ולייצר ממנו פעילות אינטראקטיבית מודולרית ומדויקת.
    
    הנחיה קריטית – התאמה לגיל (Grade Level Adaptation):
    קהל היעד הוא: **${gradeLevel}**.
    עליך להתאים את השפה, את המושגים, את הדוגמאות ואת רמת הקושי של השאלות *בדיוק* לשכבת גיל זו.
    - אם מדובר ביסודי: השתמש בשפה פשוטה, ברורה ומעודדת.
    - אם מדובר בתיכון: השתמש בשפה אקדמית יותר, עם חשיבה ביקורתית.

    הנחיה קריטית – מקור האמת (Source of Truth):
    ${fileData ? "סופק קובץ מקור. עליך לבסס את כל השאלות אך ורק עליו. אל תמציא עובדות שלא מופיעות בקובץ." : "לא סופק קובץ. השתמש בידע הפדגוגי הרחב שלך בנושא."}

    מבנה הפלט הטכני (JSON Output Schema):
    החזר אך ורק מערך JSON תקין (Array of Objects). כל פריט במערך יכלול:
    {
      "id": 1,
      "bloom_level": "Knowledge" | "Understanding" | "Analysis",
      "type": "multiple_choice" | "true_false" | "open_question" | "sorting" | "sequencing",
      "question_text": "ניסוח השאלה...",
      "source_reference": "ציטוט מהמקור (אם יש)",
      "feedback_correct": "משוב מחזק לתשובה נכונה",
      "feedback_incorrect": "הסבר לתיקון הטעות",
      "content": {
         // שדות עבור שאלות סגורות
         "options": ["אופציה 1", "אופציה 2", "אופציה 3", "אופציה 4"], 
         "correct_index": 0, // מספר (0-3)

         // שדות עבור שאלות פתוחות
         "hint": "רמז לתלמיד...",
         "key_points": ["נקודה חשובה 1", "נקודה חשובה 2"]
      }
    }

    המשימה:
    צור 6-8 רכיבים מגוונים המכסים את רמות הטקסונומיה השונות (ידע, הבנה, יישום).
    החזר רק את ה-JSON הגולמי.
  `;

  const userRequest = `
    הנושא: ${courseTopic}.
    כותרת היחידה: ${unitTitle}.
    שכבת הגיל: ${gradeLevel}.
  `;

  try {
    const parts: any[] = [systemPrompt + "\n" + userRequest];

    // הוספת הקובץ אם קיים
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

    // 1. הוספת בלוק פתיחה מותאם גיל
    blocks.push({
      id: uuidv4(),
      type: 'text',
      content: `### ברוכים הבאים לפעילות בנושא: ${unitTitle}\nפעילות זו מותאמת במיוחד עבור ${gradeLevel}. בהצלחה!`,
      metadata: {}
    });

    // 2. הוספת בוט מלווה מותאם גיל
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
        systemPrompt: `אתה מורה פרטי המותאם לכיתה ${gradeLevel} בנושא ${courseTopic}. היה סבלני, השתמש בשפה המותאמת לגיל זה, ועודד את התלמיד.`
      }
    });

    // 3. המרת השאלות שנוצרו לבלוקים
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
      content: "אירעה שגיאה ביצירת התוכן. אנא נסה שוב.",
      metadata: {}
    }];
  }
};

// --- פונקציה 3: שיפור טקסט פדגוגי ---
export const refineContentWithPedagogy = async (content: string, instruction: string) => {
  const prompt = `
    Act as an expert pedagogical editor.
    Original text: "${content}"
    Instruction: ${instruction}
    Output language: Hebrew.
    
    Your goal is to improve the text based on the instruction while maintaining educational value.
    Return ONLY the refined text.
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (e) {
    console.error("Refine Error:", e);
    return content;
  }
};

// --- פונקציה 4: יצירת שאלות מתוך טקסט ---
export const generateQuestionsFromText = async (text: string, type: 'multiple-choice' | 'open-question') => {
  const prompt = `
    Based on the following text: 
    "${text.substring(0, 1000)}..."
    
    Task: Create 3 ${type === 'multiple-choice' ? 'multiple choice questions' : 'open-ended questions'}.
    Language: Hebrew.
    
    Return ONLY a valid JSON array of objects.
    Example format:
    [{"question": "...", "options": ["..."], "correctAnswer": "..."}]
  `;

  try {
    const result = await model.generateContent(prompt);
    const textRes = cleanJsonString(result.response.text());
    return JSON.parse(textRes);
  } catch (e) {
    console.error("Generate Questions Error:", e);
    return [];
  }
};

// --- פונקציה 5: הצעת פרומפט לתמונה ---
export const generateImagePromptBlock = async (context: string) => {
  const prompt = `
    Suggest a creative AI image prompt (in English) to visualize the following context:
    "${context.substring(0, 300)}"
    
    The prompt should be descriptive, artistic, and suitable for an educational setting.
    Return ONLY the prompt string.
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (e) {
    return "A creative educational illustration";
  }
};

// --- פונקציה 6: יצירת יחידה אדפטיבית (חיזוק) ---
export const generateAdaptiveUnit = async (originalUnit: any, weakness: string) => {
  // כאן הלוגיקה פשוטה יותר כרגע, אך משאירים מקום להרחבה
  return {
    id: uuidv4(),
    title: `חיזוק: ${originalUnit.title}`,
    type: 'remedial',
    baseContent: 'הסבר פשוט יותר...',
    activityBlocks: [
      {
        id: uuidv4(),
        type: 'text',
        content: `נראה שהתקשית בנושא ${originalUnit.title}. בוא ננסה להסביר את זה אחרת... (תוכן מותאם יתווסף בהמשך)`
      }
    ]
  };
};

// --- פונקציה 7: ניתוח כיתתי ---
export const generateClassAnalysis = async (studentsData: any[]) => {
  const prompt = `
    Analyze the following class performance data (JSON):
    ${JSON.stringify(studentsData).substring(0, 2000)}
    
    Please provide a pedagogical analysis in Hebrew.
    Return valid JSON with the following structure:
    {
      "classOverview": "General summary of the class performance",
      "strongSkills": ["List of skills the class excelled in"],
      "weakSkills": ["List of skills that need improvement"],
      "actionItems": ["Concrete recommendations for the teacher"]
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(cleanJsonString(result.response.text()));
  } catch (e) {
    console.error("Class Analysis Error:", e);
    return null;
  }
};

// --- פונקציה 8: דוח תלמיד אישי ---
export const generateStudentReport = async (studentData: any) => {
  const prompt = `
    Create a personal student report based on this data (JSON):
    ${JSON.stringify(studentData)}
    
    Language: Hebrew.
    Return valid JSON with structure:
    {
      "studentName": "Name",
      "summary": "Personal feedback paragraph",
      "criteria": {
        "knowledge": "Assessment",
        "depth": "Assessment",
        "expression": "Assessment",
        "recommendations": "Actionable advice"
      }
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(cleanJsonString(result.response.text()));
  } catch (e) {
    console.error("Student Report Error:", e);
    return null;
  }
};

// --- פונקציה 9: יצירת שאלה פתוחה בודדת (Wizdi Magic) ---
export const generateSingleOpenQuestion = async (context: string) => {
  const prompt = `
      Create a single challenging open-ended question about: "${context}".
      Include a "Model Answer" for the teacher.
      Language: Hebrew.
      Return ONLY valid JSON: { "question": "...", "modelAnswer": "..." }
    `;
  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(cleanJsonString(result.response.text()));
  } catch (e) {
    return { question: "שגיאה ביצירה", modelAnswer: "" };
  }
};

// --- פונקציה 10: יצירת שאלה אמריקאית בודדת (Wizdi Magic) ---
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