import type { Course } from "./types";

// פונקציה ראשית ליצירת הקורס
export async function generateCourseWithGemini(topic: string): Promise<Course> {
  console.log("🚀 מתחיל תהליך יצירה עם מודל gemini-2.0-flash...");

  // 1. טעינת המפתח בתוך הפונקציה (כדי לא להקריס את האתר בטעינה)
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  if (!API_KEY) {
    console.error("❌ שגיאה: חסר מפתח API");
    alert("שגיאה חמורה: המפתח VITE_GEMINI_API_KEY חסר בקובץ .env\nאנא וודא שיצרת את הקובץ ושמרת אותו.");
    throw new Error("Missing API Key");
  }

  // 2. הכתובת הישירה למודל החדש שפתוח לך (gemini-2.0-flash)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

  const promptText = `
    Act as a professional Hebrew curriculum developer.
    Create a detailed online course in HEBREW about: "${topic}".
    
    CRITICAL: Return ONLY valid JSON. No markdown code blocks.
    
    JSON Structure:
    {
      "id": "gen-id",
      "title": "כותרת הקורס",
      "targetAudience": "קהל יעד",
      "syllabus": [
        {
          "id": "m1",
          "title": "שם המודול",
          "learningUnits": [
            {
              "id": "u1",
              "title": "שם השיעור",
              "type": "acquisition", 
              "baseContent": "תוכן לימודי מפורט בעברית...",
              "activityBlocks": []
            },
            {
              "id": "u2",
              "title": "בוחן",
              "type": "practice",
              "baseContent": "תרגול",
              "activityBlocks": [
                 {
                    "id": "q1",
                    "type": "multiple-choice",
                    "content": {
                        "question": "שאלה...",
                        "options": ["א", "ב", "ג", "ד"],
                        "correctAnswer": "א"
                    }
                 }
              ]
            }
          ]
        }
      ]
    }
  `;

  const requestBody = {
    contents: [{ parts: [{ text: promptText }] }],
    // ביטול הגנות בטיחות
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ]
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("🚨 שגיאה מגוגל:", errorData);
      throw new Error(`Google Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("התקבלה תשובה ריקה מה-AI");

    // ניקוי JSON
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const courseData = JSON.parse(text) as Course;
    courseData.id = Date.now().toString();

    return courseData;

  } catch (error) {
    console.error("❌ נכשלנו ביצירת הקורס:", error);
    throw error;
  }
}