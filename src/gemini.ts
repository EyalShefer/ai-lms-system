import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from 'uuid';

// אתחול הקליינט של ג'מיני
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- פונקציה 1: יצירת סילבוס לקורס ---
export const generateCoursePlan = async (topic: string, mode: string = 'learning') => {
  const prompt = `
    Create a comprehensive course syllabus for the topic: "${topic}".
    The course mode is: ${mode} (if 'exam', focus on testing; if 'learning', focus on teaching).
    
    Return ONLY a valid JSON object with this structure:
    [
      {
        "id": "generated-uuid",
        "title": "Module Title",
        "learningUnits": [
          {
            "id": "generated-uuid",
            "title": "Unit Title",
            "type": "acquisition" | "practice" | "test",
            "baseContent": "Brief description of what this unit covers...",
            "activityBlocks": [] 
          }
        ]
      }
    ]
    Create 3-4 modules, with 2-3 units each.
    Language: Hebrew.
    Do not include markdown formatting like \`\`\`json. Just the raw JSON array.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text().replace(/```json|```/g, '').trim();

    const rawData = JSON.parse(text);

    return rawData.map((mod: any) => ({
      ...mod,
      id: uuidv4(),
      learningUnits: mod.learningUnits.map((unit: any) => ({
        ...unit,
        id: uuidv4(),
        activityBlocks: []
      }))
    }));

  } catch (error) {
    console.error("Error generating course plan:", error);
    throw error;
  }
};

// --- פונקציה 2: יצירת תוכן מלא ליחידה ---
export const generateFullUnitContent = async (unitTitle: string, description: string) => {
  return [];
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

// --- פונקציה 4: יצירת שאלות מטקסט ---
export const generateQuestionsFromText = async (text: string, type: 'multiple-choice' | 'open-question') => {
  const prompt = `
    Based on the following text: "${text.substring(0, 1000)}..."
    Create 3 ${type === 'multiple-choice' ? 'multiple choice questions' : 'open-ended questions'}.
    Language: Hebrew.
    Return ONLY valid JSON array:
    ${type === 'multiple-choice' ?
      `[{ "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "The correct option text" }]` :
      `[{ "question": "...", "modelAnswer": "Expected answer key" }]`}
  `;

  try {
    const result = await model.generateContent(prompt);
    const textRes = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(textRes);
  } catch (e) {
    console.error("Error generating questions", e);
    return [];
  }
};

// --- פונקציה 5: הצעת פרומפט לתמונה ---
export const generateImagePromptBlock = async (context: string) => {
  const prompt = `
      Suggest a creative AI image prompt (in English) to visualize this concept: "${context.substring(0, 200)}".
      Return ONLY the prompt string.
    `;
  const result = await model.generateContent(prompt);
  return result.response.text();
};

// --- פונקציה 6: יחידה אדפטיבית ---
export const generateAdaptiveUnit = async (originalUnit: any, weakness: string) => {
  const prompt = `
        A student failed to understand "${originalUnit.title}".
        Weakness detected: ${weakness}.
        Create a "Remedial Unit" (Type: remedial) that explains the concept simply with an analogy.
        Language: Hebrew.
        Return JSON object of a LearningUnit.
    `;

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
  const prompt = `
        Analyze this class data (JSON): ${JSON.stringify(studentsData).substring(0, 1000)}
        Return JSON with:
        {
            "classOverview": "Summary string in Hebrew",
            "strongSkills": ["skill 1", "skill 2"],
            "weakSkills": ["skill 1", "skill 2"],
            "actionItems": ["action 1", "action 2"]
        }
    `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

// --- פונקציה 8: דוח תלמיד ---
export const generateStudentReport = async (studentData: any) => {
  const prompt = `
        Create a report for student: ${JSON.stringify(studentData)}
        Return JSON:
        {
            "studentName": "${studentData.name}",
            "summary": "Hebrew summary paragraph",
            "criteria": {
                "knowledge": "Assessment of knowledge",
                "depth": "Assessment of depth",
                "expression": "Assessment of expression",
                "recommendations": "Future steps"
            }
        }
    `;
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

// --- פונקציה 9: יצירת שאלה פתוחה בודדת (Wizdi Magic) ---
export const generateSingleOpenQuestion = async (context: string) => {
  const prompt = `
      Create a single challenging open-ended question about: "${context}".
      Include a "Model Answer" (rubric) for the teacher.
      Language: Hebrew.
      Return ONLY valid JSON:
      {
        "question": "The question text...",
        "modelAnswer": "The expected answer / key points..."
      }
    `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error("Error generating single question", e);
    return { question: "שגיאה ביצירה", modelAnswer: "" };
  }
};