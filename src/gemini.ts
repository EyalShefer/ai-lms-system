import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { Course } from "./types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("Missing Gemini API Key! Check .env file.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
];

// --- 1. יצירת קורס מלא ---
export async function generateCourseWithGemini(
  topic: string,
  gradeLevel: string,
  subject: string,
  sourceMaterial: string = ""
): Promise<Course> {

  const hasSource = sourceMaterial.length > 0;
  // שימוש במודל יציב
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings: SAFETY_SETTINGS });

  let promptContext = hasSource
    ? `SOURCE MATERIAL:\n"""${sourceMaterial.substring(0, 40000)}"""`
    : `TOPIC: "${topic}"`;

  const promptText = `
    Act as an expert Instructional Designer. Create a RICH online course in HEBREW.
    Target Audience: ${gradeLevel}, Subject: ${subject}
    ${promptContext}

    CRITICAL: 
    1. Content MUST be in Hebrew.
    2. OUTPUT ONLY VALID JSON.

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
              "baseContent": "Intro...",
              "activityBlocks": [
                { "type": "text", "content": "..." }
              ]
            }
          ]
        }
      ]
    }
  `;

  try {
    const result = await model.generateContent(promptText);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) text = text.substring(firstBrace, lastBrace + 1);

    const courseData = JSON.parse(text) as Course;
    courseData.id = Date.now().toString();

    // תיקון: מחקנו את idx שלא היה בשימוש
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

// --- 2. יצירת שאלות ---
export async function generateQuestionsFromText(
  text: string,
  type: 'multiple-choice' | 'open-question'
): Promise<any[]> {

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings: SAFETY_SETTINGS });

  let promptText = "";

  if (type === 'multiple-choice') {
    promptText = `
          TASK: Create 2 multiple-choice questions in HEBREW.
          INPUT TEXT: "${text.substring(0, 2000)}..."
          OUTPUT JSON ARRAY ONLY: [{"question": "...", "options": ["a","b","c","d"], "correctAnswer": "a"}]
        `;
  } else {
    promptText = `
          TASK: Create 1 OPEN-ENDED question in HEBREW.
          INPUT TEXT: "${text.substring(0, 2000)}..."
          OUTPUT JSON ARRAY ONLY: [{"question": "...", "modelAnswer": "..."}]
        `;
  }

  try {
    const result = await model.generateContent(promptText);
    let resultText = result.response.text();

    resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstBracket = resultText.indexOf('[');
    const lastBracket = resultText.lastIndexOf(']');

    if (firstBracket !== -1 && lastBracket !== -1) {
      resultText = resultText.substring(firstBracket, lastBracket + 1);
      return JSON.parse(resultText);
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
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings: SAFETY_SETTINGS });
  const promptText = `Create a descriptive prompt (in English) for AI image generator: "${lessonContent.substring(0, 1000)}..."`;

  try {
    const result = await model.generateContent(promptText);
    return result.response.text()?.trim() || "Error";
  } catch (error) { return "Error"; }
}

// --- 4. שכתוב ---
export async function refineContentWithPedagogy(text: string, skill: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings: SAFETY_SETTINGS });
  const promptText = `Rewrite in HEBREW to enhance "${skill}": "${text.substring(0, 1000)}".`;

  try {
    const result = await model.generateContent(promptText);
    return result.response.text()?.trim() || text;
  } catch (error) { return text; }
}

// --- 5. בודק ---
export async function gradeStudentAnswer(
  question: string,
  studentAnswer: string,
  modelAnswer: string
): Promise<{ grade: number; feedback: string }> {

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings: SAFETY_SETTINGS });

  const promptText = `
      Act as a teacher. Grade student answer.
      Question: "${question}"
      Model Answer: "${modelAnswer}"
      Student Answer: "${studentAnswer}"
      Output JSON ONLY: { "grade": 0-100, "feedback": "Hebrew" }
    `;

  try {
    const result = await model.generateContent(promptText);
    let text = result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    return { grade: 0, feedback: "שגיאה בבדיקה." };
  }
}