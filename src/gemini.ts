import type { Course } from "./courseTypes";

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

// 1. יצירת קורס
export async function generateCourseWithGemini(topic: string, gradeLevel: string, subject: string, sourceMaterial: string = ""): Promise<Course> {
  const cleanSource = sourceMaterial.replace(/"/g, "'").replace(/\n/g, " ").replace(/\\/g, "").substring(0, 80000);
  let promptContext = sourceMaterial ? `SOURCE MATERIAL:\n"""${cleanSource}"""` : `TOPIC: "${topic}"`;

  // שליפת הנחיות פדגוגיות לפי גיל (פונקציה מקוצרת כאן לצורך הקוד, אבל היא קיימת בלוגיקה שלך)
  const pedagogicalInst = "ADAPT CONTENT TO AGE LEVEL: " + gradeLevel;

  const promptText = `
    Act as a Senior Curriculum Developer. Create a structured Hebrew course.
    Target: ${gradeLevel}, Subject: ${subject}
    ${promptContext}
    ${pedagogicalInst}

    STRUCTURE PER MODULE:
    1. Acquisition (Text + Image)
    2. Practice (Multiple Choice)
    3. Test (Open Question)

    RULES: No questions in text blocks. Use specific block types.
    
    JSON Output: { "id": "gen", "title": "...", "targetAudience": "...", "syllabus": [...] }
  `;

  try {
    let text = await callGeminiDirect(promptText);
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
  } catch (error) { throw error; }
}

// 2. שאלות
export async function generateQuestionsFromText(text: string, type: 'multiple-choice' | 'open-question'): Promise<any[]> {
  let promptText = type === 'multiple-choice'
    ? `Create 2 multiple-choice questions in HEBREW based on: "${text.substring(0, 2000)}...". JSON: [{"question": "...", "options": [], "correctAnswer": "..."}]`
    : `Create 1 OPEN-ENDED question in HEBREW based on: "${text.substring(0, 2000)}...". JSON: [{"question": "...", "modelAnswer": "..."}]`;

  try {
    let res = await callGeminiDirect(promptText);
    res = res.replace(/```json/g, "").replace(/```/g, "").trim();
    const first = res.indexOf('['); const last = res.lastIndexOf(']');
    if (first !== -1) return JSON.parse(res.substring(first, last + 1));
    return JSON.parse(res);
  } catch (e) { return []; }
}

// 3. תמונה
export async function generateImagePromptBlock(lessonContent: string): Promise<string> {
  try { return (await callGeminiDirect(`Create English AI image prompt for: "${lessonContent.substring(0, 1000)}..."`)).trim(); } catch (e) { return "Error"; }
}

// 4. שכתוב
export async function refineContentWithPedagogy(text: string, skill: string): Promise<string> {
  try { return (await callGeminiDirect(`Rewrite in HEBREW to enhance "${skill}": "${text.substring(0, 1000)}".`)).trim(); } catch (e) { return text; }
}

// 5. בדיקת תשובה
export async function gradeStudentAnswer(q: string, a: string, m: string): Promise<{ grade: number; feedback: string }> {
  try {
    let text = await callGeminiDirect(`Act as teacher. Grade answer. Q: "${q}" Model: "${m}" Student: "${a}". Output JSON: { "grade": 0-100, "feedback": "Hebrew" }`);
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (e) { return { grade: 0, feedback: "Error" }; }
}

// 6. ניתוח כיתתי
export async function generateClassAnalysis(studentsData: any[]): Promise<any> {
  try {
    let text = await callGeminiDirect(`Act as Analyst. Analyze class: ${JSON.stringify(studentsData)}. Output JSON: { "classOverview": "...", "weakSkills": [], "strongSkills": [], "studentInsights": [], "actionItems": [] }`);
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (e) { return null; }
}

// --- 7. החדש: דוח הערכה אישי לתלמיד (הערכה מסכמת) ---
export async function generateStudentReport(studentData: any): Promise<any> {
  const promptText = `
      Act as a Pedagogical Expert.
      Create a SUMMATIVE ASSESSMENT report for a specific student based on this data:
      ${JSON.stringify(studentData)}

      Analyze based on these 5 criteria:
      1. Knowledge Mastery (דיוק וידע)
      2. Depth & Application (עומק התשובות)
      3. Learning Agility (Did they improve on 2nd attempt? Look at 'attempts' count)
      4. Expression (יכולת הבעה)
      5. Recommendations (המלצות להמשך)

      OUTPUT JSON ONLY:
      {
        "studentName": "Student Name",
        "summary": "פסקה מסכמת אישית...",
        "criteria": {
            "knowledge": "הערכה...",
            "depth": "הערכה...",
            "agility": "הערכה (התייחס לניסיונות חוזרים)...",
            "expression": "הערכה...",
            "recommendations": "הערכה..."
        },
        "finalGradeLabel": "מילולי (למשל: שולט בחומר / נדרש חיזוק)"
      }
    `;
  try {
    let text = await callGeminiDirect(promptText);
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) { return null; }
}