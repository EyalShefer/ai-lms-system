import type { Course } from "./types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("Missing Gemini API Key! Check .env file.");
}

const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

// --- 1. יצירת קורס מלא (התיקון הקריטי כאן!) ---
export async function generateCourseWithGemini(
  topic: string,
  gradeLevel: string,
  subject: string,
  sourceMaterial: string = ""
): Promise<Course> {

  const hasSource = sourceMaterial.length > 0;
  // משתמשים במודל היציב
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

  let promptContext = hasSource
    ? `SOURCE MATERIAL:\n"""${sourceMaterial.substring(0, 40000)}"""`
    : `TOPIC: "${topic}"`;

  const promptText = `
    Act as an expert Instructional Designer. Create a RICH online course in HEBREW.
    Target Audience: ${gradeLevel}, Subject: ${subject}
    ${promptContext}

    CRITICAL INSTRUCTIONS FOR BLOCKS:
    1. **DO NOT write questions inside a 'text' block.** Text blocks are for reading only.
    2. **Quizzes MUST be separate blocks:**
       - Use type: "multiple-choice" for multiple choice questions.
       - Use type: "open-question" for open ended questions.
    3. **Structure:** Every unit must have:
       - Intro Text block.
       - Image block (with AI prompt).
       - Text block (details).
       - At least 1 Interactive Question block.

    JSON Structure:
    {
      "id": "gen-id",
      "title": "Course Title",
      "targetAudience": "${gradeLevel}",
      "syllabus": [
        {
          "id": "m1",
          "title": "Module Name",
          "learningUnits": [
            {
              "id": "u1",
              "title": "Unit Name",
              "type": "acquisition", 
              "baseContent": "Short intro...",
              "activityBlocks": [
                { 
                    "type": "text", 
                    "content": "הסבר מפורט על הנושא..." 
                },
                { 
                    "type": "image", 
                    "content": "https://placehold.co/600x400?text=Image", 
                    "metadata": { "aiPrompt": "A detailed prompt..." } 
                },
                { 
                    "type": "multiple-choice", 
                    "content": {
                        "question": "השאלה עצמה...",
                        "options": ["תשובה 1", "תשובה 2", "תשובה 3", "תשובה 4"],
                        "correctAnswer": "תשובה 1"
                    }
                },
                { 
                    "type": "open-question", 
                    "content": {
                        "question": "שאלה למחשבה..."
                    },
                    "metadata": { "modelAnswer": "התשובה הנכונה..." }
                }
              ]
            }
          ]
        }
      ]
    }
  `;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], safetySettings: SAFETY_SETTINGS })
    });

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    // ניקוי התחלה וסוף
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) text = text.substring(firstBrace, lastBrace + 1);

    const courseData = JSON.parse(text) as Course;
    courseData.id = Date.now().toString();

    // הוספת מזהים ייחודיים
    courseData.syllabus.forEach(mod => {
      mod.learningUnits.forEach(unit => {
        unit.activityBlocks?.forEach((block, idx) => {
          block.id = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        });
      });
    });

    return courseData;
  } catch (error) {
    console.error("Generation Failed:", error);
    throw error;
  }
}

// --- 2. יצירת שאלות מתוך טקסט (ללא שינוי מהפעם הקודמת) ---
export async function generateQuestionsFromText(
  text: string,
  type: 'multiple-choice' | 'open-question'
): Promise<any[]> {

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

  let promptText = "";

  if (type === 'multiple-choice') {
    promptText = `
          TASK: Create 2 multiple-choice questions in HEBREW based on the text below.
          INPUT TEXT: "${text.substring(0, 2000)}..."
      
          CRITICAL: OUTPUT ONLY A RAW JSON ARRAY.
          [
            {
              "question": "השאלה...",
              "options": ["א", "ב", "ג", "ד"],
              "correctAnswer": "א"
            }
          ]
        `;
  } else {
    promptText = `
          TASK: Create 1 OPEN-ENDED question in HEBREW based on the text below.
          INPUT TEXT: "${text.substring(0, 2000)}..."
      
          CRITICAL: OUTPUT ONLY A RAW JSON ARRAY.
          [
            {
              "question": "שאלה פתוחה...",
              "modelAnswer": "תשובה לדוגמה..."
            }
          ]
        `;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], safetySettings: SAFETY_SETTINGS })
    });

    const data = await response.json();
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) throw new Error("No response");

    resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();

    // חילוץ מערך
    let parsedData;
    const firstBracket = resultText.indexOf('[');
    const lastBracket = resultText.lastIndexOf(']');

    if (firstBracket !== -1 && lastBracket !== -1) {
      parsedData = JSON.parse(resultText.substring(firstBracket, lastBracket + 1));
    } else {
      // ניסיון חירום לאובייקט בודד
      const firstBrace = resultText.indexOf('{');
      const lastBrace = resultText.lastIndexOf('}');
      if (firstBrace !== -1) {
        parsedData = [JSON.parse(resultText.substring(firstBrace, lastBrace + 1))];
      }
    }

    if (Array.isArray(parsedData)) {
      return parsedData.map(q => ({
        ...q,
        options: q.options || ["א", "ב", "ג", "ד"],
        correctAnswer: q.correctAnswer || q.options?.[0] || ""
      }));
    }
    return [];

  } catch (error) {
    console.error("Failed to generate questions:", error);
    return [];
  }
}

// --- 3. יצירת תיאור תמונה ---
export async function generateImagePromptBlock(lessonContent: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
  const promptText = `Create a descriptive prompt (in English) for an AI image generator based on: "${lessonContent.substring(0, 1000)}..." Max 50 words. Return ONLY the prompt.`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], safetySettings: SAFETY_SETTINGS })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Error";
  } catch (error) { return "Error"; }
}

// --- 4. שכתוב פדגוגי ---
export async function refineContentWithPedagogy(text: string, skill: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
  const promptText = `Rewrite in HEBREW to enhance "${skill}": "${text.substring(0, 1000)}". Return ONLY the rewritten text.`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], safetySettings: SAFETY_SETTINGS })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
  } catch (error) { return text; }
}

// --- 5. בודק אוטומטי ---
export async function gradeStudentAnswer(
  question: string,
  studentAnswer: string,
  modelAnswer: string
): Promise<{ grade: number; feedback: string }> {

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

  const promptText = `
      Act as a teacher grading a student's exam.
      Question: "${question}"
      Model Answer: "${modelAnswer}"
      Student Answer: "${studentAnswer}"
      
      Output JSON ONLY: { "grade": 0-100, "feedback": "Hebrew feedback" }
    `;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    return { grade: 0, feedback: "שגיאה בבדיקה." };
  }
}