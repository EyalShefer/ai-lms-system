import OpenAI from "openai";
import { v4 as uuidv4 } from 'uuid';

// --- אתחול הקליינט של OpenAI ---
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("Missing VITE_OPENAI_API_KEY in .env file");
}

// הגדרה המאפשרת עבודה מהדפדפן (לצורך פיתוח) דרך ה-Proxy המקומי
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
  // --- תיקון קריטי: שימוש בכתובת מלאה כדי למנוע שגיאת Invalid URL ---
  baseURL: `${window.location.origin}/api/openai`
});

// המודל הנבחר - GPT-4o-mini (הכי משתלם, מהיר וחכם)
const MODEL_NAME = "gpt-4o-mini";

// --- פונקציית עזר: ניקוי JSON ---
const cleanJsonString = (text: string): string => {
  try {
    // 1. הסרת Markdown ותווים מיותרים
    let clean = text.replace(/```json|```/g, '').trim();

    // 2. חילוץ התוכן שבין הסוגריים המסולסלים/מרובעים החיצוניים ביותר
    const firstBrace = clean.indexOf('{');
    const firstBracket = clean.indexOf('[');
    let startIndex = -1;
    let endIndex = -1;

    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      startIndex = firstBracket;
      endIndex = clean.lastIndexOf(']') + 1;
    } else if (firstBrace !== -1) {
      startIndex = firstBrace;
      endIndex = clean.lastIndexOf('}') + 1;
    }

    if (startIndex !== -1 && endIndex !== -1) {
      clean = clean.substring(startIndex, endIndex);
    }

    // 3. תיקונים עדינים למחרוזת
    clean = clean.replace(/}\s*{/g, '}, {');

    return clean;
  } catch (e) {
    console.error("JSON cleaning failed, returning original:", e);
    return text;
  }
};

// --- יצירת תמונה (DALL-E 3) ---
export const generateAiImage = async (prompt: string): Promise<Blob | null> => {
  if (!OPENAI_API_KEY) {
    console.error("OpenAI API Key missing for image generation");
    return null;
  }

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json"
    });

    const base64Data = response.data[0].b64_json;
    if (base64Data) {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: "image/png" });
    }
    return null;
  } catch (e) {
    console.error("Error generating image (DALL-E 3):", e);
    return null;
  }
};

// --- המרה למבנה המערכת ---
const mapSystemItemToBlock = (item: any) => {
  const commonMetadata = {
    bloomLevel: item.bloom_level,
    feedbackCorrect: item.feedback_correct,
    feedbackIncorrect: item.feedback_incorrect,
    sourceReference: item.source_reference
  };

  if (item.type === 'multiple_choice' || item.type === 'true_false') {
    let options = item.content.options || [];
    let correctAnswer = "";
    if (typeof item.content.correct_index === 'number' && options[item.content.correct_index]) {
      correctAnswer = options[item.content.correct_index];
    } else {
      correctAnswer = options[0] || "";
    }
    return {
      id: uuidv4(),
      type: 'multiple-choice',
      content: { question: item.question_text, options: options, correctAnswer: correctAnswer },
      metadata: { ...commonMetadata, score: 10 }
    };
  }

  if (item.type === 'open_question') {
    return {
      id: uuidv4(),
      type: 'open-question',
      content: { question: item.question_text },
      metadata: {
        ...commonMetadata,
        modelAnswer: item.content.key_points ? item.content.key_points.join('\n') : "תשובה מלאה",
        hint: item.content.hint,
        score: 20
      }
    };
  }

  if (item.type === 'sorting' || item.type === 'sequencing') {
    const isSorting = item.type === 'sorting';
    return {
      id: uuidv4(),
      type: 'multiple-choice',
      content: {
        question: item.question_text + (isSorting ? " (בחר את ההתאמה הנכונה)" : " (בחר את הסדר הנכון)"),
        options: isSorting
          ? ["התאמה נכונה של הפריטים לקטגוריות", "התאמה שגויה", "התאמה חלקית", "אף תשובה אינה נכונה"]
          : ["הסדר הנכון כפי שנלמד", "סדר הפוך", "סדר אקראי א", "סדר אקראי ב"],
        correctAnswer: isSorting ? "התאמה נכונה של הפריטים לקטגוריות" : "הסדר הנכון כפי שנלמד"
      },
      metadata: { ...commonMetadata, note: "הומר אוטומטית משאלת מיון/רצף" }
    };
  }

  return null;
};

// --- פונקציה 1: יצירת סילבוס ---
export const generateCoursePlan = async (
  topic: string,
  gradeLevel: string,
  fileData?: { base64: string; mimeType: string },
  subject: string = "כללי"
) => {
  const plan = [
    {
      id: uuidv4(),
      title: "פעילות אינטראקטיבית",
      learningUnits: [
        {
          id: uuidv4(),
          title: topic || "פעילות למידה",
          type: 'practice',
          activityBlocks: []
        }
      ]
    }
  ];

  try {
    const firstUnit = plan[0].learningUnits[0];
    const contentBlocks = await generateFullUnitContent(
      firstUnit.title,
      topic,
      gradeLevel,
      fileData,
      subject
    );
    firstUnit.activityBlocks = contentBlocks;
  } catch (e) {
    console.error("Error generating initial content:", e);
  }
  return plan;
};

// --- פונקציה 2: יצירת תוכן מלא ליחידה (OpenAI) ---
export const generateFullUnitContent = async (
  unitTitle: string,
  courseTopic: string,
  gradeLevel: string = "כללי",
  fileData?: { base64: string; mimeType: string },
  subject: string = "כללי"
) => {

  const systemPrompt = `
    You are an expert pedagogical content generator for the subject: ${subject}.
    Target Audience: ${gradeLevel}.
    Language: Hebrew (Ivrit).
    
    Subject Lens: Analyze the topic "${courseTopic}" strictly through the perspective of ${subject}.
    
    Source Material: ${fileData ? "Base all questions on the provided image/document." : "Use your general knowledge."}

    Output Format: Provide a VALID JSON array of objects. Do not wrap in markdown.
    Schema per item:
    {
      "id": 1,
      "bloom_level": "Knowledge" | "Understanding" | "Analysis",
      "type": "multiple_choice" | "true_false" | "open_question" | "sorting" | "sequencing",
      "question_text": "Hebrew question...",
      "source_reference": "Reference if applicable",
      "feedback_correct": "Positive feedback",
      "feedback_incorrect": "Constructive feedback",
      "content": {
          "options": ["Opt1", "Opt2", "Opt3", "Opt4"], 
          "correct_index": 0, 
          "hint": "Hebrew hint",
          "key_points": ["Point 1", "Point 2"]
      }
    }
    Create 6-8 diverse items.
  `;

  const userMessageContent: any[] = [
    { type: "text", text: `Create learning content for topic: ${courseTopic}, Unit: ${unitTitle}.` }
  ];

  if (fileData) {
    const dataUrl = `data:${fileData.mimeType};base64,${fileData.base64}`;
    userMessageContent.push({
      type: "image_url",
      image_url: {
        url: dataUrl
      }
    });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessageContent as any }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const responseText = completion.choices[0].message.content || "[]";

    let generatedItems;
    try {
      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed)) {
        generatedItems = parsed;
      } else {
        generatedItems = Object.values(parsed)[0];
      }
    } catch (e) {
      generatedItems = JSON.parse(cleanJsonString(responseText));
    }

    const blocks: any[] = [];

    // בלוק פתיחה
    blocks.push({
      id: uuidv4(),
      type: 'text',
      content: `### ברוכים הבאים לשיעור ב${subject}\n**נושא:** ${unitTitle}\nמותאם עבור ${gradeLevel}.`,
      metadata: {}
    });

    // בוט מלווה
    blocks.push({
      id: uuidv4(),
      type: 'interactive-chat',
      content: { title: "המורה הוירטואלי", description: `עזרה בנושאי ${subject}` },
      metadata: {
        botPersona: 'teacher',
        initialMessage: `שלום! אני המורה ל${subject}. איך אפשר לעזור בנושא ${unitTitle}?`,
        systemPrompt: `אתה מורה ל${subject} בכיתה ${gradeLevel}. ענה בעברית רק בהקשר ל${courseTopic}.`
      }
    });

    if (Array.isArray(generatedItems)) {
      generatedItems.forEach((item: any) => {
        const block = mapSystemItemToBlock(item);
        if (block) blocks.push(block);
      });
    }

    return blocks;

  } catch (e) {
    console.error("OpenAI Error:", e);
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
    Goal: Improve clarity, accuracy, and engagement.
  `;

  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }]
    });
    return res.choices[0].message.content || content;
  } catch (e) {
    console.error("Refine Error:", e);
    return content;
  }
};

// --- פונקציה 4: יצירת שאלות מתוך טקסט ---
export const generateQuestionsFromText = async (text: string, type: string) => {
  const prompt = `
    Based on the text below, create 3 ${type} questions.
    Text: "${text.substring(0, 1000)}..."
    Language: Hebrew.
    Output: JSON Object containing an array of questions.
  `;

  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });
    const parsed = JSON.parse(res.choices[0].message.content || "{}");
    return Object.values(parsed).find(val => Array.isArray(val)) || [];
  } catch (e) {
    console.error("Generate Questions Error:", e);
    return [];
  }
};

// --- פונקציה 5: הצעת פרומפט לתמונה ---
export const generateImagePromptBlock = async (context: string) => {
  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: `Suggest a creative, safe, educational image prompt (English) for: "${context.substring(0, 300)}".` }]
    });
    return res.choices[0].message.content || "Educational illustration";
  } catch (e) { return "Educational illustration"; }
};

// --- פונקציה 6: יצירת שאלה פתוחה בודדת ---
export const generateSingleOpenQuestion = async (context: string) => {
  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: `Create 1 challenging open-ended question about: "${context}". Language: Hebrew. JSON format: {question, modelAnswer}` }],
      response_format: { type: "json_object" }
    });
    return JSON.parse(res.choices[0].message.content || "{}");
  } catch (e) { return { question: "שגיאה ביצירה", modelAnswer: "" }; }
};

// --- פונקציה 7: יצירת שאלה אמריקאית בודדת ---
export const generateSingleMultipleChoiceQuestion = async (context: string) => {
  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: `Create 1 multiple-choice question about: "${context}". Language: Hebrew. JSON format: {question, options, correctAnswer}` }],
      response_format: { type: "json_object" }
    });
    return JSON.parse(res.choices[0].message.content || "{}");
  } catch (e) { return { question: "שגיאה ביצירה", options: [], correctAnswer: "" }; }
};

// --- פונקציה 8: יצירת יחידה אדפטיבית ---
export const generateAdaptiveUnit = async (originalUnit: any, weakness: string) => {
  return {
    id: uuidv4(),
    title: `חיזוק: ${originalUnit.title}`,
    type: 'remedial',
    baseContent: 'תוכן מותאם אישית...',
    activityBlocks: [
      {
        id: uuidv4(),
        type: 'text',
        content: `זיהיתי קושי בנושא "${originalUnit.title}". בוא ננסה לגשת לזה מזווית אחרת עם הסברים מפושטים יותר.`
      }
    ]
  };
};

// --- פונקציה 9: ניתוח כיתתי ---
export const generateClassAnalysis = async (studentsData: any[]) => {
  const prompt = `
    Analyze the following class performance data:
    ${JSON.stringify(studentsData).substring(0, 3000)}
    
    Task: Provide a deep pedagogical analysis in Hebrew.
    Output JSON Structure:
    {
      "classOverview": "General summary of the class performance trends",
      "strongSkills": ["List of skills/topics where the class excelled"],
      "weakSkills": ["List of skills/topics that need reinforcement"],
      "actionItems": ["Concrete, actionable recommendations for the teacher for next lesson"]
    }
  `;

  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });
    return JSON.parse(res.choices[0].message.content || "{}");
  } catch (e) {
    console.error("Class Analysis Error:", e);
    return null;
  }
};

// --- פונקציה 10: דוח תלמיד אישי ---
export const generateStudentReport = async (studentData: any) => {
  const prompt = `
    Create a personal student report based on this data:
    ${JSON.stringify(studentData)}
    
    Language: Hebrew.
    Tone: Encouraging, professional, pedagogical.
    Output JSON Structure:
    {
      "studentName": "Name",
      "summary": "A personal paragraph summarizing the student's progress",
      "criteria": {
        "knowledge": "Assessment of knowledge acquisition",
        "depth": "Assessment of analytical depth",
        "expression": "Assessment of capability to express ideas",
        "recommendations": "Actionable advice for improvement"
      }
    }
  `;

  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });
    return JSON.parse(res.choices[0].message.content || "{}");
  } catch (e) {
    console.error("Student Report Error:", e);
    return null;
  }
};