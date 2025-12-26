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
        modelAnswer: item.content?.teacher_guidelines || (item?.key_points ? item.key_points.join('\n') : "תשובה מלאה"),
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
  includeBot: boolean = true,
  mode: 'learning' | 'exam' = 'learning', // NEW: Mode parameter defaults to learning
  activityLength: 'short' | 'medium' | 'long' = 'medium' // NEW: Activity length
) => {
  console.log("generateFullUnitContent RECEIVED MODE:", mode, "LENGTH:", activityLength);

  const hasSourceMaterial = !!(fileData || sourceText);
  let systemPrompt = "";
  let userMessageContent: any[] = [];

  // Determine Step Count & Distribution
  let stepInstruction = "";
  let stepCount = 3;

  if (activityLength === 'short') {
    stepCount = 3;
    stepInstruction = `
      ## STEP 1: FOUNDATION (Remember/Understand)
      - **Goal:** Establish facts and definitions.
      - **Allowed Types:** multiple_choice, true_false.

      ## STEP 2: CONNECTION (Apply/Analyze)
      - **Goal:** Understand relationships.
      - **Allowed Types:** ordering, grouping.

      ## STEP 3: SYNTHESIS (Evaluate/Create)
      - **Goal:** Critical thinking.
      - **Allowed Types:** multiple_choice (Scenario), open_question.
      `;
  } else if (activityLength === 'long') {
    stepCount = 7;
    stepInstruction = `
      ## STEPS 1-2: FOUNDATION (Remember/Understand)
      - **Goal:** Solidify base knowledge.
      - **Allowed Types:** multiple_choice, true_false.

      ## STEPS 3-5: CONNECTION (Apply/Analyze)
      - **Goal:** Deep dive into processes and categories.
      - **Allowed Types:** ordering (Process/Timeline), grouping (Categorization), matching.

      ## STEPS 6-7: SYNTHESIS (Evaluate/Create)
      - **Goal:** Complex scenarios and creation.
      - **Allowed Types:** multiple_choice (Complex Scenario), open_question.
      `;
  } else {
    // Medium (Default) - 5 Steps
    stepCount = 5;
    stepInstruction = `
      ## STEPS 1-2: FOUNDATION (Remember/Understand)
      - **Goal:** Establish facts.
      - **Allowed Types:** multiple_choice, true_false.

      ## STEPS 3-4: CONNECTION (Apply/Analyze)
      - **Goal:** Connect concepts.
      - **Allowed Types:** ordering, grouping, matching.

      ## STEP 5: SYNTHESIS (Evaluate/Create)
      - **Goal:** Critical thinking.
      - **Allowed Types:** multiple_choice (Scenario), open_question.
      `;
  }

  // === MODE 1: LEARNING ACTIVITY (The "Journey") ===
  if (mode === 'learning') {
    console.log("🚀 Mode: Learning (Activity)");

    systemPrompt = `
      # ROLE
      You are an expert Pedagogical Architect and engaging Storyteller. 
      Subject: ${subject}. Target Audience: ${gradeLevel}.
      Language: Hebrew.

      # GOAL
      Create a ${stepCount}-step scaffolded learning activity.
      Do NOT use the same question type for every step. Analyze the content and select the BEST interaction type.

      # DYNAMIC INTERACTION STRATEGY
      ${stepInstruction}

      # JSON OUTPUT FORMAT
      {
        "learning_unit": {
          "title": "${unitTitle}",
          "steps": [
            {
              "step_number": 1,
              "bloom_level": "Foundation",
              "selected_interaction": "multiple_choice",
              "teach_content": "Short engaging explanation...",
              "data": {
                "question": "Question text...",
                "options": ["Opt1", "Opt2", "Opt3", "Opt4"],
                "correct_answer": "Opt1",
                "feedback_correct": "Good job!",
                "feedback_incorrect": "Hint..."
              }
            },
            // ... Generate exactly ${stepCount} steps following the strategy above
          ]
        }
      }

      # APPENDIX: DATA STRUCTURE RULES
      - **ordering**: "items" list in CORRECT order.
      - **grouping**: "items" list with "group_index" mapping to "groups".
      - **matching**: treat as **grouping** (Left side = groups, Right side = items).
      - **open_question**: "data" has "question" and "model_answer".

      # OUTPUT FORMAT (JSON ONLY)
      Return a VALID JSON object with the "learning_unit" root.
    `;

    // User Message Construction
    if (sourceText) {
      userMessageContent.push({ type: "text", text: `Source Text:\n"""${sourceText}"""\n\nTask: Create Learning Journey for "${unitTitle}".` });
    } else {
      userMessageContent.push({ type: "text", text: `Task: Create Learning Journey for "${unitTitle}" (Topic: ${courseTopic}).` });
    }

  }
  // === MODE 2: EXAM / ASSESSMENT (Old Logic) ===
  else {
    console.log("📝 Mode: Exam (Assessment)");

    const taxonomyInstruction = taxonomy
      ? `\n4. BLOOM'S TAXONOMY DISTRIBUTION (MANDATORY):
           - Knowledge/Recall: ~${taxonomy.knowledge}%
           - Application/Analysis: ~${taxonomy.application}%
           - Evaluation/Creation: ~${taxonomy.evaluation}%
           Ensure the questions reflect this complexity balance.`
      : "";

    if (hasSourceMaterial) {
      // ... (Existing Site A Prompt Logic)
      systemPrompt = `
          You are a Strict Content Analyst and Pedagogue.
          Target Audience: ${gradeLevel}.
          Language: Hebrew.
          
          TASK: Create a ${mode} unit based ONLY on the provided content.
          
          OUTPUT JSON Array of items:
          [
            {
              "type": "multiple_choice",
              "question_text": "...",
              "content": { "options": ["A","B"], "correct_answer": "A" }
            }
          ]
          
          ${taxonomyInstruction}
          Create 6-8 items.
        `;
      if (sourceText) {
        userMessageContent.push({ type: "text", text: `Source Text:\n"""${sourceText}"""\n\nTask: Generate Exam for "${unitTitle}" based on this text.` });
      } else {
        userMessageContent.push({ type: "text", text: `Task: Generate Exam for "${unitTitle}" based on this image.` });
      }
    } else {
      systemPrompt = `
        You are a captivating Storyteller and Private Tutor.
        Subject: ${subject}. Target Audience: ${gradeLevel}.
        Language: Hebrew.

        TASK: Create a specific "Learning Journey" (NOT A QUIZ).
        
        TONE & STYLE:
        - Fascinating, engaging, and narrative-driven.
        - Do NOT use dry "textbook" language. Use phrases like "Imagine that...", "Surprisingly...", "Let's dive into...".
        - The "content_to_read" must feel like a micro-story or a fascinating fact, not a definition.
        
        For the topic: "${courseTopic}", Unit: "${unitTitle}".

        Create a JSON with "learning_unit" containing "cards".
        CRITICAL: Teach first, then ask.

        # EXAMPLE JSON (STRICTLY FOLLOW THIS STRUCTURE)
        {
          "learning_unit": {
             "title": "Topic Name",
             "cards": [
                {
                  "type": "teach_then_ask",
                  "content_to_read": "Imagine a world where money has lost all value. In 1923 Germany, a loaf of bread cost millions of marks! This chaos made people desperate for a strong leader who promised order.",
                  "interactive_question": {
                     "text": "Why were people in Germany willing to listen to extreme leaders like Hitler?",
                     "options": ["They were bored", "They were desperate for stability", "They wanted to experiment"],
                     "correct_answer": "They were desperate for stability",
                     "feedback_correct": "Exactly! Desperate times often push people toward extreme solutions.",
                     "feedback_incorrect": "Think about the chaos of paying millions for bread. They wanted Order."
                  }
                }
             ]
          }
        }

        # OUTPUT FORMAT (JSON ONLY)
        Return a VALID JSON object with the "learning_unit" root. Do not wrap in markdown code blocks.
      `;
      // User string remains simple to avoid overriding system instructions
      userMessageContent.push({ type: "text", text: `Topic: ${courseTopic}. Create the Learning Journey.` });
    }
  }

  // Common Image Attachment
  if (fileData) {
    const dataUrl = `data:${fileData.mimeType};base64,${fileData.base64}`;
    userMessageContent.push({
      type: "image_url",
      image_url: { url: dataUrl }
    });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessageContent as any }
      ],
      temperature: mode === 'learning' ? 0.7 : 0.3, // Creative for learning, strict for exam
      response_format: { type: "json_object" }
    });

    const responseText = completion.choices[0].message.content || "[]";
    let generatedItems: any[] = []; // Stores the final list of items to map
    const blocks: any[] = [];

    // Parse Response
    try {
      const parsed = JSON.parse(responseText);

      // === NEW LOGIC: Dynamic Learning Unit ===
      if (mode === 'learning') {
        console.log("🚀 Parsing Strategy: Dynamic Learning Unit");

        const steps = parsed.learning_unit?.steps || parsed.learning_unit?.cards || [];

        if (Array.isArray(steps)) {
          steps.forEach((step: any) => {

            // 1. Content Block (The Teach)
            if (step.teach_content) {
              blocks.push({
                id: uuidv4(),
                type: 'text',
                content: step.teach_content,
                metadata: { note: `Step ${step.step_number}: ${step.bloom_level}` }
              });
            }

            // 2. Interaction Block (The Ask)
            const type = step.selected_interaction;
            const data = step.data;

            if (data) {
              const commonMeta = {
                score: 10,
                feedbackCorrect: data.feedback_correct || "Correct!",
                feedbackIncorrect: data.feedback_incorrect || "Try again.",
                bloomLevel: step.bloom_level
              };

              if (type === 'ordering') {
                blocks.push({
                  id: uuidv4(),
                  type: 'ordering',
                  content: {
                    question: data.question || "Order these items:",
                    items: data.items || []
                  },
                  metadata: { ...commonMeta, score: 15 }
                });
              }
              else if (type === 'grouping' || type === 'categorization' || type === 'matching') {
                // Map to 'categorization' block
                let adaptedItems = [];
                let adaptedCategories = data.groups || data.categories || [];

                if (data.items && data.items.length > 0) {
                  if (typeof data.items[0] === 'string') {
                    adaptedItems = data.items.map((t: string) => ({ id: uuidv4(), text: t, categoryId: "unknown" }));
                  } else {
                    adaptedItems = data.items.map((item: any) => ({
                      id: uuidv4(),
                      text: item.text,
                      categoryId: adaptedCategories[item.group_index] || "unknown"
                    }));
                  }
                }

                blocks.push({
                  id: uuidv4(),
                  type: 'categorization',
                  content: {
                    question: data.question || "Sort these items:",
                    categories: adaptedCategories,
                    items: adaptedItems
                  },
                  metadata: { ...commonMeta, score: 20 }
                });
              }
              else if (type === 'open_question') {
                blocks.push({
                  id: uuidv4(),
                  type: 'open-question',
                  content: {
                    question: data.question || "Explain..."
                  },
                  metadata: {
                    ...commonMeta,
                    modelAnswer: data.model_answer || "See teacher guidelines",
                    score: 20
                  }
                });
              }
              else {
                // Fallback: Multiple Choice
                blocks.push({
                  id: uuidv4(),
                  type: 'multiple-choice',
                  content: {
                    question: data.question,
                    options: data.options || ["Yes", "No"],
                    correctAnswer: data.correct_answer || data.options?.[0]
                    // Add implicit feedback if missing in data but present in fallback logic? 
                    // Current prompt asks for feedback in data object, so it should be there.
                  },
                  metadata: commonMeta
                });
              }
            }
          });

          if (blocks.length > 0) return blocks;
        }
      }

      // === FALLBACK: Exam / Legacy Strategy ===
      {
        // Fallback or Exam Mode: Standard Array
        if (Array.isArray(parsed)) {
          generatedItems = parsed;
        } else if (parsed.items && Array.isArray(parsed.items)) { // Common wrapper
          generatedItems = parsed.items;
        } else {
          // Try to find any array in the object
          generatedItems = Object.values(parsed).find(val => Array.isArray(val)) as any[] || [];
        }
      }

    } catch (e) {
      console.error("JSON Parse Error", e);
      generatedItems = [];
    }


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