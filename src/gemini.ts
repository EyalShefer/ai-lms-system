import type { Course } from "./courseTypes";

// טעינת המפתח
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("Missing Gemini API Key! Check .env file.");
}

// 🚀 הגדרה קבועה למודל 2.0 (החזק והמהיר)
const MODEL_NAME = "gemini-2.0-flash";
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

// פונקציית עזר לביצוע הבקשה (Fetch ישיר)
async function callGeminiDirect(promptText: string): Promise<string> {
  // לוג כדי שתוכל לוודא בקונסול שאנחנו משתמשים במודל הנכון
  console.log(`📡 Sending request to ${MODEL_NAME}...`);

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      safetySettings: SAFETY_SETTINGS
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Google Error Details:", errorData);
    throw new Error(`Google Error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// --- 1. יצירת קורס מלא ---
export async function generateCourseWithGemini(
  topic: string,
  gradeLevel: string,
  subject: string,
  sourceMaterial: string = ""
): Promise<Course> {

  const hasSource = sourceMaterial.length > 0;
  console.log(`🚀 Generating course via API for: ${topic}`);

  // ניקוי הטקסט מה-PDF
  const cleanSource = sourceMaterial
    .replace(/"/g, "'")
    .replace(/\n/g, " ")
    .replace(/\\/g, "")
    .substring(0, 80000);

  let promptContext = hasSource
    ? `SOURCE MATERIAL (Base content ONLY on this):\n"""${cleanSource}"""`
    : `TOPIC: "${topic}"`;

  const promptText = `
    Act as a Senior Curriculum Developer.
    Create a DEEP, MULTI-LAYERED online course in HEBREW.

    Context:
    - Target Audience: ${gradeLevel}
    - Subject Domain: ${subject}
    ${promptContext}

    PEDAGOGICAL STRUCTURE:
    1. **Acquisition Unit:** Detailed explanation.
    2. **Practice Unit:** Interactive Multiple Choice blocks.
    3. **Test Unit:** Open-Ended question blocks.

    CRITICAL INSTRUCTIONS FOR BLOCKS (READ CAREFULLY):
    1. **Rhetorical Questions:** Can go inside 'text' blocks.
    2. **Assessment Questions:** MUST be separate blocks ('multiple-choice' or 'open-question').
    3. **Images:** Include 'image' blocks with descriptive 'aiPrompt'.
    
    JSON Structure:
    {
      "id": "gen-id",
      "title": "Course Title (Hebrew)",
      "targetAudience": "${gradeLevel}",
      "syllabus": [
        {
          "id": "m1",
          "title": "Module Name",
          "learningUnits": [
            {
              "id": "u1",
              "title": "שם השיעור (הקניה)",
              "type": "acquisition", 
              "baseContent": "Intro...",
              "activityBlocks": [
                 { "type": "text", "content": "הסבר מפורט..." },
                 { "type": "image", "content": "https://placehold.co/600x400?text=Image", "metadata": { "aiPrompt": "..." } }
              ] 
            },
            {
              "id": "u2",
              "title": "תרגול",
              "type": "practice",
              "baseContent": "תרגול:",
              "activityBlocks": [
                 {
                    "type": "multiple-choice",
                    "content": {
                        "question": "שאלה לבדיקת ידע...",
                        "options": ["1", "2", "3", "4"],
                        "correctAnswer": "1"
                    }
                 }
              ]
            },
            {
              "id": "u3",
              "title": "מבחן",
              "type": "test",
              "baseContent": "סיכום:",
              "activityBlocks": [
                 {
                    "type": "open-question",
                    "content": { "question": "שאלה למחשבה..." },
                    "metadata": { "modelAnswer": "..." }
                 }
              ]
            }
          ]
        }
      ]
    }
  `;

  try {
    let text = await callGeminiDirect(promptText);

    // ניקוי JSON
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) text = text.substring(firstBrace, lastBrace + 1);

    const courseData = JSON.parse(text) as Course;
    courseData.id = Date.now().toString();

    courseData.syllabus.forEach(mod => {
      mod.learningUnits.forEach(unit => {
        unit.activityBlocks?.forEach((block) => {
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

// --- 2. שאלות מתוך טקסט ---
export async function generateQuestionsFromText(
  text: string,
  type: 'multiple-choice' | 'open-question'
): Promise<any[]> {

  let promptText = "";

  if (type === 'multiple-choice') {
    promptText = `
          TASK: Create 2 multiple-choice questions in HEBREW based on: "${text.substring(0, 2000)}...".
          OUTPUT JSON ARRAY ONLY: [{"question": "...", "options": ["a","b","c","d"], "correctAnswer": "a"}]
        `;
  } else {
    promptText = `
          TASK: Create 1 OPEN-ENDED question in HEBREW based on: "${text.substring(0, 2000)}...".
          OUTPUT JSON ARRAY ONLY: [{"question": "...", "modelAnswer": "..."}]
        `;
  }

  try {
    let resultText = await callGeminiDirect(promptText);

    resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstBracket = resultText.indexOf('[');
    const lastBracket = resultText.lastIndexOf(']');

    if (firstBracket !== -1 && lastBracket !== -1) {
      return JSON.parse(resultText.substring(firstBracket, lastBracket + 1));
    } else {
      const parsed = JSON.parse(resultText);
      return Array.isArray(parsed) ? parsed : [parsed];
    }
  } catch (error) {
    console.error("Failed to generate questions:", error);
    return [];
  }
}

// --- 3. תמונה ---
export async function generateImagePromptBlock(lessonContent: string): Promise<string> {
  const promptText = `Create a descriptive prompt (in English) for AI image generator: "${lessonContent.substring(0, 1000)}..."`;
  try {
    return (await callGeminiDirect(promptText)).trim();
  } catch (error) { return "Error"; }
}

// --- 4. שכתוב ---
export async function refineContentWithPedagogy(text: string, skill: string): Promise<string> {
  const promptText = `Rewrite in HEBREW to enhance "${skill}": "${text.substring(0, 1000)}".`;
  try {
    return (await callGeminiDirect(promptText)).trim();
  } catch (error) { return text; }
}

// --- 5. בודק ---
export async function gradeStudentAnswer(
  question: string,
  studentAnswer: string,
  modelAnswer: string
): Promise<{ grade: number; feedback: string }> {
  const promptText = `
      Act as a teacher. Grade answer.
      Question: "${question}"
      Model Answer: "${modelAnswer}"
      Student Answer: "${studentAnswer}"
      Output JSON ONLY: { "grade": 0-100, "feedback": "Hebrew" }
    `;
  try {
    let text = await callGeminiDirect(promptText);
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    return { grade: 0, feedback: "שגיאה בבדיקה." };
  }
}

// --- 6. ניתוח כיתתי ---
export async function generateClassAnalysis(studentsData: any[]): Promise<any> {
  const promptText = `
      Act as Analyst. Analyze: ${JSON.stringify(studentsData)}
      Output JSON ONLY: { "classOverview": "...", "weakSkills": [], "strongSkills": [], "studentInsights": [], "actionItems": [] }
    `;
  try {
    let text = await callGeminiDirect(promptText);
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) { return null; }
}