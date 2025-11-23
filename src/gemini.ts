import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { Course } from "./types";

// 🔑 אל תשכח להחזיר את המפתח שלך לכאן!
const API_KEY = "AIzaSyBRc47SYhNfo-AxSqS736JEuhxY1DE8RCI";

const genAI = new GoogleGenerativeAI(API_KEY);

export async function generateCourseWithGemini(topic: string): Promise<Course> {
    // השינוי הקריטי: אנחנו משתמשים במודל החדש (2.0) אבל מכבים את כל ההגנות
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
        ]
    });

    const prompt = `
    You are an expert curriculum designer. 
    Create a comprehensive online course about: "${topic}".
    
    The output must be valid JSON strictly following this structure:
    {
      "id": "generated-id",
      "title": "Course Title",
      "targetAudience": "Target Audience",
      "syllabus": [
        {
          "id": "m1",
          "title": "Module Title",
          "learningUnits": [
            {
              "id": "u1",
              "title": "Unit Title",
              "type": "acquisition", 
              "baseContent": "Detailed educational content in Hebrew (at least 3 paragraphs).",
              "activityBlocks": []
            },
            {
              "id": "u2",
              "title": "Practice Quiz",
              "type": "practice",
              "baseContent": "Practice questions",
              "activityBlocks": [
                 {
                    "id": "q1",
                    "type": "multiple-choice",
                    "content": {
                        "question": "Question text in Hebrew...",
                        "options": ["A", "B", "C", "D"],
                        "correctAnswer": "A"
                    }
                 }
              ]
            }
          ]
        }
      ]
    }

    Rules:
    1. Content MUST be in Hebrew (עברית).
    2. Return ONLY the JSON object, no markdown formatting.
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const cleanJson = text.replace(/```json|```/g, '').trim();
        const courseData = JSON.parse(cleanJson) as Course;

        courseData.id = Date.now().toString();
        return courseData;

    } catch (error) {
        console.error("Gemini Error:", error);
        throw error;
    }
}