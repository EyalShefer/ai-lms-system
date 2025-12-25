import { getFirestore, collection, addDoc, onSnapshot, doc } from "firebase/firestore";
import { getApp } from "firebase/app";
import OpenAI from "openai";
import { v4 as uuidv4 } from 'uuid';

// --- אתחול הקליינט של OpenAI (עבור פונקציות עזר ותמונות) ---
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("Missing VITE_OPENAI_API_KEY in .env file");
}

export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
  baseURL: `${window.location.origin}/api/openai`
});

export const BOT_PERSONAS = {
  teacher: {
    id: 'teacher',
    name: 'המורה המלווה',
    systemPrompt: "אתה מורה אדיב, סבלני ומקצועי. פנה תמיד בלשון יחיד (אתה/את). אם התלמיד טועה, תקן אותו בעדינות והסבר את הטעות. עודד אותו להמשיך.",
    initialMessage: "היי! אני כאן אם משהו לא ברור בחומר. מוזמן לשאול כל שאלה! 👋"
  },
  socratic: {
    id: 'socratic',
    name: 'המנחה הסוקרטי',
    systemPrompt: "אתה מנחה בשיטה הסוקרטית. המטרה שלך היא לגרות חשיבה. לעולם אל תיתן תשובה ישירה או סיכום מוכן. אם התלמיד שואל, ענה בשאלה מכווינה או ברמז. תוביל אותו לתשובה צעד אחר צעד. היה סקרן ומעורר מחשבה.",
    initialMessage: "שלום. אני כאן כדי לעזור לך לחשוב. שאל אותי, ואעזור לך למצוא את התשובה בעצמך. 🧠"
  },
  concise: {
    id: 'concise',
    name: 'התמציתי',
    systemPrompt: "אתה עוזר לימודי יעיל ותמציתי. ענה אך ורק על מה שנשאלת. תשובות קצרות, ממוקדות (מקסימום 2-3 משפטים). בלי הקדמות מיותרות ובלי 'סמול טוק'.",
    initialMessage: "היי. אני כאן לתשובות קצרות ומדויקות. מה השאלה? ⚡"
  },
  coach: {
    id: 'coach',
    name: 'המאמן המאתגר',
    systemPrompt: "אתה מאמן קשוח אך הוגן. תפקידך לאתגר את התלמיד. אם הוא עונה נכון, הקשה עליו עם שאלת המשך ('האם זה תמיד נכון?'). השתמש בדוגמאות מחיי היומיום. אל תסתפק בתשובות שטחיות.",
    initialMessage: "מוכן לאתגר? אני לא אעשה לך חיים קלים, אבל אתה תצא מפה חד יותר. בוא נתחיל! 🏆"
  }
};

export const MODEL_NAME = "gpt-4o-mini";

export const cleanJsonString = (text: string): string => {
  try {
    let clean = text.replace(/```json|```/g, '').trim();
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
    clean = clean.replace(/}\s*{/g, '}, {');
    return clean;
  } catch (e) {
    console.error("JSON cleaning failed, returning original:", e);
    return text;
  }
};

const mapSystemItemToBlock = (item: any) => {
  const commonMetadata = {
    bloomLevel: item.bloom_level,
    feedbackCorrect: item.feedback_correct,
    feedbackIncorrect: item.feedback_incorrect,
    sourceReference: item.source_reference
  };

  if (item.type === 'multiple_choice' || item.type === 'true_false') {
    // Robust options extraction
    let options: string[] = [];
    if (item.content && Array.isArray(item.content.options)) {
      options = item.content.options;
    } else if (Array.isArray(item.options)) {
      options = item.options;
    } else if (Array.isArray(item.choices)) {
      options = item.choices;
    } else if (Array.isArray(item.choices)) {
      options = item.choices;
    }

    // Validate options
    if (!options || options.length < 2 || options.some(o => !o || typeof o !== 'string')) {
      console.warn("Invalid options detected, using fallback", options);
      options = ["אפשרות 1", "אפשרות 2", "אפשרות 3", "אפשרות 4"];
    }

    // Robust correct answer extraction
    let correctAnswer = "";
    if (item.content?.correct_index !== undefined && options[item.content.correct_index]) {
      correctAnswer = options[item.content.correct_index];
    } else if (item.correct_index !== undefined && options[item.correct_index]) {
      correctAnswer = options[item.correct_index];
    } else if (item.content?.correct_answer && options.includes(item.content.correct_answer)) {
      correctAnswer = item.content.correct_answer;
    } else {
      correctAnswer = options[0] || "";
    }

    // Randomize Options
    const shuffledOptions = [...options].sort(() => Math.random() - 0.5);

    return {
      id: uuidv4(),
      type: 'multiple-choice',
      content: { question: item.question_text || item.question || "שאלה ללא טקסט", options: shuffledOptions, correctAnswer: correctAnswer },
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
        modelAnswer: item.content?.teacher_guidelines || (item.content?.key_points ? item.content.key_points.join('\n') : "תשובה מלאה"),
        hint: item.content?.hint || "",
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

// --- פונקציה 1: יצירת סילבוס (גרסת ענן - Firestore Queue) ---
export const generateCoursePlan = async (
  topic: string,
  gradeLevel: string,
  fileData?: { base64: string; mimeType: string },
  subject: string = "כללי",
  sourceText?: string, // טקסט שחולץ (PDF/Doc)
  includeBot: boolean = true // האם לכלול בוט
) => {
  console.log("Starting cloud generation for:", topic);

  // קבלת ה-DB
  const db = getFirestore(getApp());

  try {
    // 1. יצירת מסמך בקשה בתור
    const docRef = await addDoc(collection(db, "course_generation_queue"), {
      topic,
      gradeLevel,
      subject,
      fileData: fileData || null,
      sourceText: sourceText || null,
      status: "pending",
      createdAt: new Date(),
    });

    console.log("Request queued with ID:", docRef.id);

    // 2. האזנה לשינויים במסמך
    return new Promise<any[]>((resolve, reject) => {
      const unsubscribe = onSnapshot(doc(db, "course_generation_queue", docRef.id), (snapshot) => {
        const data = snapshot.data();

        if (!data) return;

        console.log("Generation status:", data.status);

        if (data.status === "completed" && data.result) {
          unsubscribe();

          // --- CLIENT-SIDE PROCESSING ---
          console.log("!!! PROCESSING RESULTS CLIENT SIDE !!!", { includeBot, blocksRaw: data.result.length });
          let processedResult = [...data.result];

          // 1. Enforce Bot Toggle & Randomization (Deep Traversal)
          processedResult = processedResult.map((module: any) => ({
            ...module,
            learningUnits: (module.learningUnits || []).map((unit: any) => ({
              ...unit,
              activityBlocks: (unit.activityBlocks || [])
                .filter((block: any) => includeBot || block.type !== 'interactive-chat')
                .map((block: any) => {
                  if (block.type === 'multiple-choice' && Array.isArray(block.content?.options)) {
                    // Shuffle Options
                    const shuffled = [...block.content.options].sort(() => Math.random() - 0.5);
                    return { ...block, content: { ...block.content, options: shuffled } };
                  }
                  return block;
                })
            }))
          }));

          resolve(processedResult);
        } else if (data.status === "error") {
          unsubscribe();
          reject(new Error(data.error || "Unknown error during generation"));
        }
      }, (error) => {
        console.error("Firestore listener error:", error);
        reject(error);
      });
    });

  } catch (e) {
    console.error("Failed to queue request:", e);
    throw e;
  }
};

// --- שאר הפונקציות (נשארו ללא שינוי - Hybrid Mode) ---

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

    const base64Data = response.data?.[0]?.b64_json;
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

export const generateFullUnitContent = async (
  unitTitle: string,
  courseTopic: string,
  gradeLevel: string = "כללי",
  fileData?: { base64: string; mimeType: string },
  subject: string = "כללי",
  sourceText?: string,
  taxonomy?: { knowledge: number; application: number; evaluation: number },
  includeBot: boolean = true
) => {

  const hasSourceMaterial = !!(fileData || sourceText);
  let systemPrompt = "";
  let userMessageContent: any[] = [];

  const taxonomyInstruction = taxonomy
    ? `\n4. BLOOM'S TAXONOMY DISTRIBUTION (MANDATORY):
       - Knowledge/Recall: ~${taxonomy.knowledge}%
       - Application/Analysis: ~${taxonomy.application}%
       - Evaluation/Creation: ~${taxonomy.evaluation}%
       Ensure the questions reflect this complexity balance.`
    : "";

  // --- LOGIC SPLIT: File Agent vs Topic Agent ---

  if (hasSourceMaterial) {
    // === SITE A: FILE AGENT (STRICT) ===
    console.log("🤖 Mode: File Agent (Source Based)");

    systemPrompt = `
      You are a Strict Content Analyst and Pedagogue for the subject: ${subject}.
      Target Audience: ${gradeLevel}.
      Language: Hebrew (Ivrit).
      
      CORE DIRECTIVE:
      Your knowledge base is STRICTLY limited to the provided source material (Text/Image).
      Do NOT use outside knowledge to generate questions.
      
      TASK:
      Create a learning unit based ONLY on the provided content.
      
      OUTPUT REQUIREMENTS:
      1. Provide a VALID JSON array of objects.
      2. For every question, you must be able to internally justify it based on the text.
      3. If the content is insufficient for ${subject}, return a JSON with a single "text" block explaining why.
      
      Schema per item:
      {
        "id": 1,
        "bloom_level": "Knowledge" | "Understanding" | "Analysis",
        "type": "multiple_choice" | "true_false" | "open_question",
        "question_text": "Hebrew question...",
        "source_reference": "Quote or reference from text",
        "feedback_correct": "Positive feedback",
        "feedback_incorrect": "Constructive feedback",
        "content": {
            "options": ["Concrete Answer 1", "Concrete Answer 2", "Concrete Answer 3", "Answer 4"], 
            "correct_index": 0, 
            "hint": "Hebrew hint",
            "teacher_guidelines": "Detailed explanation",
            "key_points": ["Point 1", "Point 2"]
        }
      }
      IMPORTANT:
      - Do NOT create sorting, matching, or sequencing questions.
      - For Multiple Choice: Options must be CONCRETE TEXT ANSWERS (e.g. "To convert sunlight", "Wind", "Coal"). 
      - Do NOT use meta-options like "Option A and B are correct" or "All of the above".
      - Do NOT use abstract options like "The first image", "The sorting order".
      Schema per item:
      {
        "id": 1,
        "bloom_level": "Knowledge" | "Understanding" | "Analysis",
        "type": "multiple_choice" | "true_false" | "open_question" | "sorting" | "sequencing",
        "question_text": "Hebrew question...",
        "source_reference": "Quote or reference from text",
        "feedback_correct": "Positive feedback",
        "feedback_incorrect": "Constructive feedback",
        "content": {
            "options": ["Opt1", "Opt2", "Opt3", "Opt4"], 
            "correct_index": 0, 
            "hint": "Hebrew hint",
            "teacher_guidelines": "Detailed explanation of the correct answer",
            "key_points": ["Point 1", "Point 2"]
        }
      }
      ${taxonomyInstruction}
      Create 6-8 items.
    `;

    if (sourceText) {
      userMessageContent.push({ type: "text", text: `Source Text:\n"""${sourceText}"""\n\nTask: Generate learning unit for "${unitTitle}" based on this text.` });
    } else {
      userMessageContent.push({ type: "text", text: `Task: Generate learning unit for "${unitTitle}" based on this image.` });
    }

    if (fileData) {
      const dataUrl = `data:${fileData.mimeType};base64,${fileData.base64}`;
      userMessageContent.push({
        type: "image_url",
        image_url: { url: dataUrl }
      });
    }

  } else {
    // === SITE B: TOPIC AGENT (CREATIVE) ===
    console.log("🎨 Mode: Topic Agent (Creative)");

    systemPrompt = `
      You are an expert pedagogical content generator for the subject: ${subject}.
      Target Audience: ${gradeLevel}.
      Language: Hebrew (Ivrit).
      Subject Lens: Analyze the topic "${courseTopic}" strictly through the perspective of ${subject}.
      Source Material: Use your general knowledge.
      Output Format: Provide a VALID JSON array of objects. Do not wrap in markdown.
      
      Schema per item:
      {
        "id": 1,
        "bloom_level": "Knowledge" | "Understanding" | "Analysis",
        "type": "multiple_choice" | "true_false" | "open_question",
        "question_text": "Hebrew question...",
        "source_reference": "General Knowledge",
        "feedback_correct": "Positive feedback",
        "feedback_incorrect": "Constructive feedback",
        "content": {
            "options": ["Concrete Answer 1", "Concrete Answer 2", "Concrete Answer 3", "Answer 4"], 
            "correct_index": 0, 
            "hint": "Hebrew hint",
            "teacher_guidelines": "Detailed explanation",
            "key_points": ["Point 1", "Point 2"]
        }
      }
      IMPORTANT:
      - Do NOT create sorting, matching, or sequencing questions.
      - For Multiple Choice: Options must be CONCRETE TEXT ANSWERS.
      - Do NOT use meta-options like "Option A and B are correct" or "All of the above".
      }
      Schema per item:
      {
        "id": 1,
        "bloom_level": "Knowledge" | "Understanding" | "Analysis",
        "type": "multiple_choice" | "true_false" | "open_question" | "sorting" | "sequencing",
        "question_text": "Hebrew question...",
        "source_reference": "General Knowledge",
        "feedback_correct": "Positive feedback",
        "feedback_incorrect": "Constructive feedback",
        "content": {
            "options": ["Opt1", "Opt2", "Opt3", "Opt4"], 
            "correct_index": 0, 
            "hint": "Hebrew hint",
            "teacher_guidelines": "Detailed explanation of the correct answer",
            "key_points": ["Point 1", "Point 2"]
        }
      }
      ${taxonomyInstruction}
      Create 6-8 diverse items.
    `;

    userMessageContent.push({ type: "text", text: `Create learning content for topic: ${courseTopic}, Unit: ${unitTitle}.` });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessageContent as any }
      ],
      temperature: hasSourceMaterial ? 0.3 : 0.7, // Lower temperature for strict file analysis
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

    blocks.push({
      id: uuidv4(),
      type: 'text',
      content: `# מתחילים! 🚀\nהפעילות בנושא **${unitTitle}** יוצאת לדרך.\nלפניכם תרגול קצר וממוקד. בהצלחה!`,
      metadata: {}
    });


    const selectedPersona = taxonomy && (taxonomy as any).botPersona ? BOT_PERSONAS[(taxonomy as any).botPersona as keyof typeof BOT_PERSONAS] : BOT_PERSONAS.socratic;

    if (includeBot) {
      blocks.push({
        id: uuidv4(),
        type: 'interactive-chat',
        content: { title: selectedPersona.name, description: `עזרה בנושאי ${subject}` },
        metadata: {
          botPersona: selectedPersona.id,
          initialMessage: selectedPersona.initialMessage,
          systemPrompt: `${selectedPersona.systemPrompt}\n\nנושא השיעור: ${unitTitle}\nקהל יעד: ${gradeLevel}`
        }
      });
    }

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

export const generateImagePromptBlock = async (context: string) => {
  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: `Suggest a creative, safe, educational image prompt (English) for: "${context.substring(0, 300)}".` }]
    });
    return res.choices[0].message.content || "Educational illustration";
  } catch (e) { return "Educational illustration"; }
};

export const generateSingleOpenQuestion = async (context: string) => {
  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: `Create 1 challenging open-ended question about: "${context}". Language: Hebrew. JSON format: {question, modelAnswer}` }],
      response_format: { type: "json_object" }
    });
    return JSON.parse(res.choices[0].message.content || "{}");
  } catch (e) { return null; }
};

export const generateSingleMultipleChoiceQuestion = async (context: string) => {
  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: `Create 1 multiple-choice question about: "${context}". Language: Hebrew. JSON format: {question, options, correctAnswer}` }],
      response_format: { type: "json_object" }
    });
    const text = res.choices[0].message.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = JSON.parse(cleanJsonString(text));
    }

    // Validate and fix structure if needed
    if (!parsed.options || !Array.isArray(parsed.options)) {
      parsed.options = ["אפשרות 1", "אפשרות 2", "אפשרות 3", "אפשרות 4"];
    }
    return parsed;
  } catch (e) { return null; }
};

export const generateAdaptiveUnit = async (originalUnit: any, _weakness: string) => {
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