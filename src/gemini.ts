import type { Course } from "./courseTypes";

// טעינת המפתח
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("Missing Gemini API Key! Check .env file.");
}

// שימוש במודל 2.0
const MODEL_NAME = "gemini-2.0-flash";
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

async function callGeminiDirect(promptText: string): Promise<string> {
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
    throw new Error(`Google Error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// --- פונקציית התאמה לגיל ---
function getPedagogicalGuidelines(gradeLevel: string): string {
  if (gradeLevel.includes("יסודי") || gradeLevel.includes("ד׳") || gradeLevel.includes("ה׳") || gradeLevel.includes("ו׳")) {
    return `
        ADAPTATION STRATEGY: **Concrete & Visual**
        - Critical Thinking: Attached to concrete examples.
        - Language: Simple syntax.
        - Tone: Encouraging, storytelling.
        `;
  }
  else if (gradeLevel.includes("חטיבת ביניים") || gradeLevel.includes("ז׳") || gradeLevel.includes("ח׳") || gradeLevel.includes("ט׳")) {
    return `
        ADAPTATION STRATEGY: **Relatability & Identity**
        - Critical Thinking: Cause-and-effect, dilemmas.
        - Language: Rich but accessible.
        - Tone: Conversational mentor.
        `;
  }
  else {
    return `
        ADAPTATION STRATEGY: **Abstraction & Nuance**
        - Critical Thinking: Ambiguity, synthesis.
        - Language: Academic.
        - Tone: Professional.
        `;
  }
}

// --- 1. יצירת קורס מלא (הגרסה המוגנת ב-100%) ---
export async function generateCourseWithGemini(
  topic: string,
  gradeLevel: string,
  subject: string,
  sourceMaterial: string = ""
): Promise<Course> {

  const hasSource = sourceMaterial.length > 0;

  const cleanSource = sourceMaterial
    .replace(/"/g, "'")
    .replace(/\n/g, " ")
    .replace(/\\/g, "")
    .substring(0, 80000);

  let promptContext = hasSource
    ? `SOURCE MATERIAL (Base content ONLY on this):\n"""${cleanSource}"""`
    : `TOPIC: "${topic}"`;

  const pedagogicalInstructions = getPedagogicalGuidelines(gradeLevel);

  const promptText = `
    Act as a Senior Curriculum Developer.
    Create a DEEP, MULTI-LAYERED online course in HEBREW.

    Context:
    - Target Audience: ${gradeLevel}
    - Subject Domain: ${subject}
    ${promptContext}

    --- PEDAGOGICAL GUIDELINES ---
    ${pedagogicalInstructions}

    PEDAGOGICAL STRUCTURE (Each module MUST have 3 units):
    1. **Acquisition:** Explanation + Image.
    2. **Practice:** Multiple Choice questions.
    3. **Test:** Open-Ended question (Deep Dive).

    CRITICAL INSTRUCTIONS FOR BLOCKS:
    - **NEVER** write questions inside a 'text' block. 
    - **ALWAYS** use 'multiple-choice' or 'open-question' block types.
    - **IMAGES:** Include 'image' blocks with descriptive 'aiPrompt'.
    
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
              "title": "...",
              "type": "acquisition", 
              "baseContent": "...",
              "activityBlocks": [
                 { "type": "text", "content": "..." },
                 { "type": "image", "content": "...", "metadata": { "aiPrompt": "..." } }
              ] 
            }
          ]
        }
      ]
    }
  `;

  try {
    let text = await callGeminiDirect(promptText);

    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) text = text.substring(firstBrace, lastBrace + 1);

    const courseData = JSON.parse(text) as Course;
    courseData.id = Date.now().toString();

    // --- ההגנה המוחלטת (Bulletproof Parsing) ---
    // אנחנו משתמשים ב- || [] (או מערך ריק) כדי להבטיח שאף לולאה לא תרוץ על undefined

    courseData.syllabus = courseData.syllabus || [];

    courseData.syllabus.forEach(mod => {
      mod.learningUnits = mod.learningUnits || []; // הגנה 1

      mod.learningUnits.forEach(unit => {
        unit.activityBlocks = unit.activityBlocks || []; // הגנה 2

        unit.activityBlocks.forEach((block) => {
          block.id = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        });
      });
    });
    // ---------------------------------------------------

    return courseData;
  } catch (error) {
    console.error("Generation Failed:", error);
    throw error;
  }
}

// --- שאר הפונקציות ---

export async function generateQuestionsFromText(text: string, type: 'multiple-choice' | 'open-question'): Promise<any[]> {
  let promptText = "";
  if (type === 'multiple-choice') {
    promptText = `TASK: Create 2 multiple-choice questions in HEBREW based on: "${text.substring(0, 2000)}...". OUTPUT JSON ARRAY ONLY: [{"question": "...", "options": ["a","b","c","d"], "correctAnswer": "a"}]`;
  } else {
    promptText = `TASK: Create 1 OPEN-ENDED question in HEBREW based on: "${text.substring(0, 2000)}...". OUTPUT JSON ARRAY ONLY: [{"question": "...", "modelAnswer": "..."}]`;
  }
  try {
    let resultText = await callGeminiDirect(promptText);
    resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstBracket = resultText.indexOf('[');
    const lastBracket = resultText.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) return JSON.parse(resultText.substring(firstBracket, lastBracket + 1));
    return JSON.parse(resultText);
  } catch (error) { return []; }
}

export async function generateImagePromptBlock(lessonContent: string): Promise<string> {
  const promptText = `Create a descriptive prompt (in English) for AI image generator based on: "${lessonContent.substring(0, 1000)}..."`;
  try { return (await callGeminiDirect(promptText)).trim(); } catch (error) { return "Error"; }
}

export async function refineContentWithPedagogy(text: string, skill: string): Promise<string> {
  const promptText = `Rewrite in HEBREW to enhance "${skill}": "${text.substring(0, 1000)}".`;
  try { return (await callGeminiDirect(promptText)).trim(); } catch (error) { return text; }
}

export async function gradeStudentAnswer(question: string, studentAnswer: string, modelAnswer: string): Promise<{ grade: number; feedback: string }> {
  const promptText = `Act as a teacher. Grade answer. Question: "${question}" Model Answer: "${modelAnswer}" Student Answer: "${studentAnswer}" Output JSON ONLY: { "grade": 0-100, "feedback": "Hebrew" }`;
  try {
    let text = await callGeminiDirect(promptText);
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) { return { grade: 0, feedback: "שגיאה בבדיקה." }; }
}

export async function generateClassAnalysis(studentsData: any[]): Promise<any> {
  const promptText = `Act as Analyst. Analyze: ${JSON.stringify(studentsData)} Output JSON ONLY: { "classOverview": "...", "weakSkills": [], "strongSkills": [], "studentInsights": [], "actionItems": [] }`;
  try {
    let text = await callGeminiDirect(promptText);
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) { return null; }
}

export async function generateStudentReport(studentData: any): Promise<any> {
  const promptText = `Act as Pedagogical Expert. Create SUMMATIVE ASSESSMENT report for: ${JSON.stringify(studentData)} Criteria: Knowledge, Depth, Agility, Expression, Recommendations. OUTPUT JSON ONLY: { "studentName": "...", "summary": "...", "criteria": { "knowledge": "...", "depth": "...", "agility": "...", "expression": "...", "recommendations": "..." }, "finalGradeLabel": "..." }`;
  try {
    let text = await callGeminiDirect(promptText);
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) { return null; }

}