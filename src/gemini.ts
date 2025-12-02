import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from 'uuid';

// אתחול הקליינט של ג'מיני
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- פונקציה 1: יצירת סילבוס לקורס (שלד בלבד - לטעינה מהירה) ---
export const generateCoursePlan = async (topic: string, mode: string = 'learning') => {
  const prompt = `
    Create a comprehensive course syllabus for the topic: "${topic}".
    The course mode is: ${mode}.
    
    Return ONLY a valid JSON object with this structure:
    [
      {
        "title": "Module Title",
        "learningUnits": [
          { "title": "Unit Title", "type": "acquisition" },
          { "title": "Unit Title", "type": "practice" }
        ]
      }
    ]
    Create 3 modules, with 2-3 units each.
    Language: Hebrew.
    Do not include markdown formatting. Just the raw JSON array.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text().replace(/```json|```/g, '').trim();

    const rawData = JSON.parse(text);

    // המרה למבנה של המערכת - מתחילים עם רשימת בלוקים ריקה (Lazy Loading)
    return rawData.map((mod: any) => ({
      ...mod,
      id: uuidv4(),
      learningUnits: mod.learningUnits.map((unit: any) => ({
        ...unit,
        id: uuidv4(),
        activityBlocks: [] // יתמלא אוטומטית בכניסה ליחידה
      }))
    }));

  } catch (error) {
    console.error("Error generating course plan:", error);
    throw error;
  }
};

// --- פונקציה 2: יצירת תוכן מלא ליחידה (מופעלת אוטומטית בכניסה ליחידה ריקה) ---
export const generateFullUnitContent = async (unitTitle: string, courseTopic: string) => {
  const prompt = `
      Create rich learning content for a unit titled: "${unitTitle}" (Part of the course: "${courseTopic}").
      Language: Hebrew.
      
      Return ONLY valid JSON with these 3 fields:
      {
        "baseContent": "A detailed explanatory paragraph (5-6 sentences) teaching the core concept.",
        "keyPoints": "A list of 3 key takeaways (bullet points).",
        "challengeQuestion": "A thought-provoking open question about this unit.",
        "challengeAnswer": "The expected answer or key points for the teacher."
      }
    `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    const data = JSON.parse(text);

    // בניית 3 הבלוקים המוכנים
    return [
      // 1. בלוק טקסט ראשי
      {
        id: uuidv4(),
        type: 'text',
        content: data.baseContent,
        metadata: {}
      },
      // 2. בלוק נקודות מפתח
      {
        id: uuidv4(),
        type: 'text',
        content: `**נקודות חשובות לזכור:**\n${data.keyPoints}`,
        metadata: {}
      },
      // 3. בלוק שאלת חשיבה
      {
        id: uuidv4(),
        type: 'open-question',
        content: { question: data.challengeQuestion },
        metadata: { modelAnswer: data.challengeAnswer }
      }
    ];
  } catch (e) {
    console.error("Error generating unit content", e);
    // במקרה שגיאה נחזיר מערך ריק כדי לא לתקוע את המערכת
    return [];
  }
};

// --- פונקציה 3: שיפור טקסט פדגוגי ---
export const refineContentWithPedagogy = async (content: string, instruction: string) => {
  const prompt = `
    Act as an expert pedagogical editor.
    Original text: "${content}"
    Instruction: ${instruction}
    Output language: Hebrew.
    Return ONLY the refined text.
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
};

// --- פונקציה 4: יצירת שאלות מטקסט (רשימה) ---
export const generateQuestionsFromText = async (text: string, type: 'multiple-choice' | 'open-question') => {
  const prompt = `
    Based on the following text: "${text.substring(0, 1000)}..."
    Create 3 ${type === 'multiple-choice' ? 'multiple choice questions' : 'open-ended questions'}.
    Language: Hebrew.
    Return ONLY valid JSON array.
  `;

  try {
    const result = await model.generateContent(prompt);
    const textRes = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(textRes);
  } catch (e) {
    return [];
  }
};

// --- פונקציה 5: הצעת פרומפט לתמונה ---
export const generateImagePromptBlock = async (context: string) => {
  const prompt = `Suggest a creative AI image prompt (in English) to visualize: "${context.substring(0, 200)}". Return ONLY the prompt string.`;
  const result = await model.generateContent(prompt);
  return result.response.text();
};

// --- פונקציה 6: יחידה אדפטיבית ---
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

// --- פונקציה 7: ניתוח כיתתי ---
export const generateClassAnalysis = async (studentsData: any[]) => {
  const prompt = `Analyze class data (JSON): ${JSON.stringify(studentsData).substring(0, 1000)}. Return JSON: { "classOverview": "...", "strongSkills": [], "weakSkills": [], "actionItems": [] } (Hebrew)`;
  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text().replace(/```json|```/g, '').trim());
  } catch (e) { return null; }
};

// --- פונקציה 8: דוח תלמיד ---
export const generateStudentReport = async (studentData: any) => {
  const prompt = `Create student report (JSON): ${JSON.stringify(studentData)}. Return JSON: { "studentName": "...", "summary": "...", "criteria": { "knowledge": "...", "depth": "...", "expression": "...", "recommendations": "..." } } (Hebrew)`;
  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text().replace(/```json|```/g, '').trim());
  } catch (e) { return null; }
};

// --- פונקציה 9: Wizdi Magic - שאלה פתוחה בודדת ---
export const generateSingleOpenQuestion = async (context: string) => {
  const prompt = `
      Create a single challenging open-ended question about: "${context}".
      Include a "Model Answer". Language: Hebrew.
      Return ONLY valid JSON: { "question": "...", "modelAnswer": "..." }
    `;
  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text().replace(/```json|```/g, '').trim());
  } catch (e) {
    return { question: "שגיאה ביצירה", modelAnswer: "" };
  }
};

// --- פונקציה 10: Wizdi Magic - שאלה אמריקאית בודדת ---
export const generateSingleMultipleChoiceQuestion = async (context: string) => {
  const prompt = `
      Create a single multiple-choice question about: "${context}".
      Language: Hebrew.
      Return ONLY valid JSON: { "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "..." }
    `;
  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text().replace(/```json|```/g, '').trim());
  } catch (e) {
    return { question: "שגיאה ביצירה", options: [], correctAnswer: "" };
  }
};