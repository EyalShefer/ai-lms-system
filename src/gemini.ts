import type { Course } from "./courseTypes";
import { v4 as uuidv4 } from 'uuid';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("Missing Gemini API Key! Check .env file.");
}

const MODEL_NAME = "gemini-2.0-flash";
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

// --- ממשק ההגדרות (חשוב לייצא אותו) ---
export interface GenerationConfig {
  modulesCount: number;
  unitsPerModule: number;
  questionDistribution: {
    knowledge: number; // %
    application: number; // %
    reasoning: number; // %
  };
  includeSampleQuestion?: string;
  totalScore: number;
}

async function callGeminiDirect(promptText: string): Promise<string> {
  console.log("📡 Calling Gemini 2.0 Flash (JSON Mode)...");

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      safetySettings: SAFETY_SETTINGS,
      generationConfig: {
        temperature: 0.4, // ירדנו קצת ליציבות
        maxOutputTokens: 8192,
        responseMimeType: "application/json" // <--- השינוי הקריטי: כפיית מצב JSON
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Google Error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function getPedagogicalGuidelines(gradeLevel: string): string {
  return `Target Audience: ${gradeLevel}. Language: Hebrew. Tone: Engaging and Educational.`;
}

export async function generateCourseWithGemini(
  topic: string,
  gradeLevel: string,
  subject: string,
  sourceMaterial: string = "",
  config?: GenerationConfig
): Promise<Course> {

  // קיצור קל של הטקסט למניעת חריגת טוקנים שקוטעת את ה-JSON
  const hasSource = sourceMaterial.length > 0;
  const cleanSource = sourceMaterial.replace(/"/g, "'").substring(0, 45000);

  // הגדרות ברירת מחדל
  const modulesCount = config?.modulesCount || 3;
  const unitsCount = config?.unitsPerModule || 3;
  const totalScore = config?.totalScore || 100;

  let promptContext = hasSource
    ? `SOURCE MATERIAL (Base ALL content on this):\n"""${cleanSource}"""`
    : `TOPIC: "${topic}"`;

  const promptText = `
    Role: Expert Curriculum Developer.
    Task: Create a structured Hebrew course/exam JSON.
    Target: ${gradeLevel} | Subject: ${subject}
    ${promptContext}
    ${getPedagogicalGuidelines(gradeLevel)}

    --- CONFIGURATION ---
    1. Structure: Create exactly ${modulesCount} Modules. Each Module must have ${unitsCount} Units.
    2. Bloom's Taxonomy Mix: 
       - Knowledge: ${config?.questionDistribution.knowledge || 30}%
       - Application: ${config?.questionDistribution.application || 50}%
       - Reasoning: ${config?.questionDistribution.reasoning || 20}%
    3. Style: ${config?.includeSampleQuestion ? `Mimic style: "${config.includeSampleQuestion}"` : "Standard academic."}

    --- CRITICAL JSON RULES ---
    1. Output MUST be valid JSON.
    2. **ESCAPE DOUBLE QUOTES**: If writing Hebrew text containing quotes (e.g. "word"), use backslash (e.g. \"word\").
    3. NO MARKDOWN: Do not wrap in \`\`\`json ... \`\`\`. Just raw JSON.
    4. NO TRAILING COMMAS.

    --- SCORING ---
    - Assign "score" to questions. Sum must be ${totalScore}.

    --- SCHEMA ---
    {
      "title": "Hebrew Title",
      "targetAudience": "${gradeLevel}",
      "syllabus": [
        {
          "title": "Module Name",
          "learningUnits": [
            {
               "title": "Unit Name", "type": "practice", "baseContent": "Explanation...", 
               "activityBlocks": [
                   { 
                       "type": "multiple-choice", 
                       "content": { "question": "...", "options": ["A","B","C","D"], "correctAnswer": "A" }, 
                       "metadata": { "bloomLevel": "knowledge", "score": 5, "aiPrompt": "..." } 
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

    // ניקויים ליתר ביטחון, למרות ש-JSON Mode אמור לטפל בזה
    text = text.trim();
    if (text.startsWith('```json')) text = text.replace(/```json/g, "").replace(/```/g, "");
    if (text.startsWith('```')) text = text.replace(/```/g, "");

    const courseData = JSON.parse(text) as Course;

    // --- מנגנון ה-UUID וניקוד ---
    courseData.id = uuidv4();
    courseData.teacherId = "";
    courseData.mode = 'learning';

    let calculatedTotal = 0;
    let questionCount = 0;

    courseData.syllabus = (courseData.syllabus || []).map(mod => ({
      ...mod,
      id: uuidv4(),
      learningUnits: (mod.learningUnits || []).map(unit => ({
        ...unit,
        id: uuidv4(),
        activityBlocks: (unit.activityBlocks || []).map(block => {
          const isQuestion = block.type === 'multiple-choice' || block.type === 'open-question';
          if (isQuestion) {
            questionCount++;
            const rawScore = block.metadata?.score || 0;
            block.metadata = { ...block.metadata, score: Number(rawScore) };
            calculatedTotal += Number(rawScore);
          }
          return { ...block, id: uuidv4() };
        })
      }))
    }));

    // נרמול ניקוד (אם ה-AI פספס בחישוב)
    if (questionCount > 0 && Math.abs(calculatedTotal - totalScore) > 2) {
      console.log(`Normalizing score from ${calculatedTotal} to ${totalScore}`);
      const factor = totalScore / calculatedTotal;
      courseData.syllabus.forEach(mod => {
        mod.learningUnits.forEach(unit => {
          unit.activityBlocks.forEach(block => {
            if (block.metadata?.score) {
              block.metadata.score = Math.round(block.metadata.score * factor);
            }
          });
        });
      });
    }

    return courseData;
  } catch (error) {
    console.error("Generation Failed:", error);
    throw error;
  }
}

// --- שאר הפונקציות ---

export async function generateQuestionsFromText(text: string, type: 'multiple-choice' | 'open-question'): Promise<any[]> {
  // גם כאן נשתמש ב-responseMimeType ליציבות
  const promptText = type === 'multiple-choice'
    ? `Create 2 multiple-choice questions in HEBREW based on: "${text.substring(0, 2000)}...". Output JSON array.`
    : `Create 1 OPEN-ENDED question in HEBREW based on: "${text.substring(0, 2000)}...". Output JSON array.`;

  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        safetySettings: SAFETY_SETTINGS,
        generationConfig: { temperature: 0.5, maxOutputTokens: 2048, responseMimeType: "application/json" }
      })
    });
    const data = await response.json();
    const resText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    return JSON.parse(resText);
  } catch (e) { return []; }
}

export async function generateImagePromptBlock(lessonContent: string): Promise<string> {
  try {
    // כאן אנחנו רוצים טקסט פשוט, לא JSON
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Create a descriptive prompt (in English) for AI image generator based on: "${lessonContent.substring(0, 1000)}..."` }] }],
        safetySettings: SAFETY_SETTINGS
      })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Error";
  } catch (e) { return "Error"; }
}

export async function refineContentWithPedagogy(text: string, skill: string): Promise<string> {
  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Rewrite in HEBREW to enhance "${skill}": "${text.substring(0, 1000)}".` }] }],
        safetySettings: SAFETY_SETTINGS
      })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || text;
  } catch (e) { return text; }
}

export async function gradeStudentAnswer(question: string, studentAnswer: string, modelAnswer: string): Promise<{ grade: number; feedback: string }> {
  try {
    const prompt = `Act as a teacher. Grade answer. Question: "${question}" Model Answer: "${modelAnswer}" Student Answer: "${studentAnswer}" Output JSON ONLY: { "grade": 0-100, "feedback": "Hebrew" }`;
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: SAFETY_SETTINGS,
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    const data = await response.json();
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
  } catch (e) { return { grade: 0, feedback: "שגיאה בבדיקה." }; }
}

export async function generateClassAnalysis(studentsData: any[]): Promise<any> {
  try {
    const prompt = `Act as Analyst. Analyze: ${JSON.stringify(studentsData)} Output JSON ONLY: { "classOverview": "...", "weakSkills": [], "strongSkills": [], "studentInsights": [], "actionItems": [] }`;
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: SAFETY_SETTINGS,
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    const data = await response.json();
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
  } catch (e) { return null; }
}

export async function generateStudentReport(studentData: any): Promise<any> {
  try {
    const prompt = `Act as Pedagogical Expert. Create REPORT for: ${JSON.stringify(studentData)}. JSON: { "studentName": "...", "summary": "...", "criteria": { "knowledge": "...", "depth": "...", "agility": "...", "expression": "...", "recommendations": "..." }, "finalGradeLabel": "..." }`;
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: SAFETY_SETTINGS,
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    const data = await response.json();
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
  } catch (e) { return null; }
}