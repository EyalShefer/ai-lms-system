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
  baseURL: `${window.location.origin}/api/openai`,
  timeout: 60000, // Default timeout: 1 minute
  maxRetries: 2
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

export const mapSystemItemToBlock = (item: any) => {
  if (!item) return null;

  // 1. ROBUST DATA NORMALIZATION
  console.log("Raw AI Item for Mapping:", JSON.stringify(item)); // DEBUG LOG

  // Handle different AI nesting styles (Direct object vs 'data' wrapper vs 'interactive_question' wrapper)
  // Sometimes AI returns data: { data: { ... } }
  const rawData = item.data?.data || item.data || item.interactive_question || item;

  // Extract Type
  const type = item.selected_interaction || item.type || rawData.type || 'multiple_choice';

  // Extract Question Text (Handle all known variations - Check Root AND Data)
  const questionText =
    rawData.question?.text || // Handle { question: { text: "..." } }
    rawData.question ||
    item.question ||
    rawData.question_text ||
    rawData.text ||
    rawData.instruction ||
    "שאלה ללא טקסט";

  const commonMetadata = {
    bloomLevel: item.bloom_level || "General",
    feedbackCorrect: rawData.feedback_correct || rawData.feedback || "תשובה נכונה!",
    feedbackIncorrect: rawData.feedback_incorrect || "נסו שוב.",
    sourceReference: rawData.source_reference || rawData.source_reference_hint || null
  };

  // === CASE A: MULTIPLE CHOICE / TRUE-FALSE ===
  if (type === 'multiple_choice' || type === 'true_false' || type === 'teach_then_ask') {
    // Robust Options Extraction
    let options: any[] = [];
    if (Array.isArray(rawData.options)) options = rawData.options;
    else if (Array.isArray(item.options)) options = item.options; // Check root as fallback
    else if (Array.isArray(rawData.choices)) options = rawData.choices;
    else if (Array.isArray(rawData.answers)) options = rawData.answers;

    // Normalize Options to Strings for Content, Keep Rich Data in Metadata
    const normalizedOptions = options.map((o: any) => typeof o === 'string' ? o : (o.text || o.label || ""));

    // Fallback if empty options
    if (normalizedOptions.length < 2) {
      console.warn("Invalid options detected, adding specific fallback placeholders");
      normalizedOptions.push("אפשרות א", "אפשרות ב");
    }

    // Robust Correct Answer Extraction
    let correctAnswer = "";

    // 1. Check for "is_correct" flag in rich objects
    const correctOptObj = options.find((o: any) => typeof o === 'object' && (o.is_correct || o.isCorrect === true));
    if (correctOptObj) {
      correctAnswer = correctOptObj.text || correctOptObj.label;
    }
    // 2. Check for explicit correct answer string
    else if (rawData.correct_answer && typeof rawData.correct_answer === 'string') {
      correctAnswer = rawData.correct_answer;
    }
    // 3. Check for correct index
    else if (rawData.correct_index !== undefined && normalizedOptions[rawData.correct_index]) {
      correctAnswer = normalizedOptions[rawData.correct_index];
    }
    // 4. Fallback to first option
    else {
      correctAnswer = normalizedOptions[0];
    }

    return {
      id: uuidv4(),
      type: 'multiple-choice',
      content: {
        question: questionText,
        options: normalizedOptions,
        correctAnswer: correctAnswer
      },
      metadata: {
        ...commonMetadata,
        score: 10,
        progressiveHints: rawData.progressive_hints || [],
        richOptions: options.some(o => typeof o === 'object') ? options : undefined
      }
    };
  }

  // === CASE B: OPEN QUESTION ===
  if (type === 'open_question' || type === 'open_ended') {
    return {
      id: uuidv4(),
      type: 'open-question',
      content: { question: questionText },
      metadata: {
        ...commonMetadata,
        modelAnswer: rawData.model_answer || rawData.teacher_guidelines || rawData.answer_key || "התשובה נמצאת בחומר הלימוד.",
        score: 20
      }
    };
  }

  // === CASE C: ORDERING / SEQUENCING ===
  if (type === 'ordering' || type === 'sequencing') {
    const rawItems = rawData.items || rawData.steps || rawData.correct_order || [];
    // Ensure items are strings
    const items = rawItems.map((i: any) => {
      if (typeof i === 'string') return i;
      return i.text || i.step || i.content || i.description || JSON.stringify(i);
    });

    // Valid Sequence Check
    if (items.length < 2) {
      console.warn("Ordering items missing or too few, adding fallback.");
      items.push("פריט ראשון לדוגמה", "פריט שני לדוגמה");
    }

    return {
      id: uuidv4(),
      type: 'ordering',
      content: {
        instruction: questionText !== "שאלה ללא טקסט" ? questionText : "סדרו את היומיום לפי הסדר הנכון:",
        correct_order: items
      },
      metadata: { ...commonMetadata, score: 15 }
    };
  }

  // === CASE D: CATEGORIZATION / GROUPING / MATCHING ===
  if (type === 'categorization' || type === 'grouping' || type === 'matching') {
    let categories: string[] = [];
    let items: any[] = [];

    // Handle Matching (Pairs)
    if (type === 'matching' || rawData.pairs) {
      const pairs = rawData.pairs || [];
      const uniqueCats = new Set<string>();
      pairs.forEach((p: any) => uniqueCats.add(p.right || p.category));
      categories = Array.from(uniqueCats);
      items = pairs.map((p: any) => ({
        text: p.left || p.item,
        category: p.right || p.category
      }));
    }
    // Handle Standard Grouping
    else {
      categories = rawData.groups || rawData.categories || ["קטגוריה 1", "קטגוריה 2"];
      const rawItems = rawData.items || [];
      // Map items with group index if needed
      items = rawItems.map((item: any) => {
        // If item is object with 'category' prop
        if (typeof item === 'object' && item.category) {
          return { text: item.text || item.content, category: item.category };
        }
        // If item has group_index
        if (typeof item === 'object' && item.group_index !== undefined && categories[item.group_index]) {
          return { text: item.text || item.content, category: categories[item.group_index] };
        }
        // Fallback: If AI returns items as simple strings but didn't assign categories, we can't guess.
        // But if AI returns { text: "X", group: "Y" } handle that.
        if (typeof item === 'object' && item.group) return { text: item.text, category: item.group };

        // Fallback for simple strings (default to first category to prevent crash, or mark as Uncategorized)
        return {
          text: typeof item === 'string' ? item : (item.text || JSON.stringify(item)),
          category: categories[0] || "כללי"
        };
      });
    }

    // Fallback for empty items
    if (items.length === 0) {
      console.warn("Categorization items missing, adding callback.");
      categories = ["קטגוריה לדוגמה"];
      items = [{ text: "פריט לדוגמה", category: "קטגוריה לדוגמה" }];
    }

    return {
      id: uuidv4(),
      type: 'categorization',
      content: {
        question: questionText !== "שאלה ללא טקסט" ? questionText : "מיינו את הפריטים לקטגוריות:",
        categories: categories,
        items: items
      },
      metadata: { ...commonMetadata, score: 20 }
    };
  }

  return null;
};

// === PERFORMANCE OPTIMIZATION START ===

// 1. Generate Skeleton (Fast Structure)
export const generateUnitSkeleton = async (
  topic: string,
  gradeLevel: string,
  activityLength: 'short' | 'medium' | 'long',
  sourceText?: string
) => {
  let stepCount = 5;
  let structureGuide = "";

  if (activityLength === 'short') {
    stepCount = 3;
    structureGuide = `
      STEP 1: Foundation (Remember/Understand). Type: memory_game OR multiple_choice.
      STEP 2: Connection (Apply/Analyze). Type: fill_in_blanks OR categorization.
      STEP 3: Synthesis (Evaluate/Create). Type: open_question OR multiple_choice (scenario).
    `;
  } else if (activityLength === 'long') {
    stepCount = 7;
    structureGuide = `
      STEPS 1-2: Foundation. Type: memory_game / multiple_choice / true_false.
      STEPS 3-5: Connection. Type: fill_in_blanks / ordering / categorization / matching.
      STEPS 6-7: Synthesis. Type: open_question / multiple_choice.
    `;
  } else {
    // Medium
    stepCount = 5;
    structureGuide = `
      STEPS 1-2: Foundation (Remember). Type: memory_game OR multiple_choice.
      STEPS 3-4: Connection (Analyze). Type: fill_in_blanks OR categorization.
      STEP 5: Synthesis (Create). Type: open_question.
    `;
  }

  const contextPart = sourceText
    ? `BASE CONTENT ON THIS TEXT ONLY:\n"""${sourceText.substring(0, 15000)}"""\nIgnore outside knowledge if it contradicts the text.`
    : `Topic: "${topic}"`;

  const prompt = `
    Role: Pedagogical Architect (The Brain).
    Task: Create a "Skeleton" for a learning unit.
    ${contextPart}
    Target Audience: ${gradeLevel}.
    Count: Exactly ${stepCount} steps.
    Language: Hebrew.

    MISSION:
    1. **Holistic Analysis:** Read the ENTIRE source text first. Understand the "Big Picture".
    2. **SEGMENTATION STRATEGY (CRITICAL):**
       - **Action:** Divorce the Source Text into ${stepCount} DISTINCT, NON-OVERLAPPING logical chunks (Chunk A, Chunk B, Chunk C...).
       - **Constraint:** Chunk A must end completely before Chunk B begins.
       - **Anti-Merging:** Do NOT compress distinct major events (e.g., "Industrial Revolution" and "WWII") into one step. Split them.
       - **Anti-Repetition:** If Step 1 covers "Middle Ages", Step 2 MUST NOT mention "Middle Ages".

    3. **Topic Policing (The Output):**
       - For each step, define a strict **narrative_focus** (Allowed Content) and **forbidden_topics** (Banned Content from future/past steps).

    4. **Structure Guide:**
    ${structureGuide}

    Output JSON Structure:
    {
      "unit_title": "String",
      "steps": [
        {
          "step_number": 1,
          "title": "Unique Title for Chunk A",
          "narrative_focus": "Discuss ONLY [Specific Concept A]. Do not mention [Concept B].",
          "forbidden_topics": ["Concept B", "Concept C", "Future Events"],
          "bloom_level": "Remember",
          "suggested_interaction_type": "memory_game" // OR multiple_choice
        },
        // ...
      ]
    }
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const text = completion.choices[0].message.content || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error("Skeleton Gen Error:", e);
    return null;
  }
};

// 2. Generate Single Step Content (Detailed & Slow - Run in Parallel)
export const generateStepContent = async (
  topic: string,
  stepInfo: any,
  gradeLevel: string,
  sourceText?: string,
  fileData?: any
) => {
  const contextText = sourceText ? `Source Material:\n"""${sourceText.substring(0, 3000)}..."""` : `Topic: ${topic}`;

  const prompt = `
    Role: Content Writer & Teacher.
    Task: Write FULL content for ONE step of a unit.
    Step Info: ${JSON.stringify(stepInfo)}
    Target Audience: ${gradeLevel}.
    Language: Hebrew.

    ${contextText}

    MANDATORY REQUIREMENTS:
    1. **Pedagogy:** Strictly follow the Bloom Level (${stepInfo.bloom_level}) and Interaction Type (${stepInfo.suggested_interaction_type}).
    2. **TOPIC POLICING (Crucial):**
       - **Narrative Focus:** ${stepInfo.narrative_focus || "Discuss the current step's topic only."}
       - **FORBIDDEN TOPICS:** ${JSON.stringify(stepInfo.forbidden_topics || [])}
       - **Rule:** Do NOT mention, summarize, or preview the forbidden topics. Stay in your lane.
    
    3. **Complexity Adaptation (Age: ${gradeLevel}):** 
       - Simplify academic text. Rewrite long paragraphs.
       - **Age Adaptation (Grades 1-6):** Every technical term MUST have a concrete analogy (e.g., "Chlorophyll is like a solar panel").
       - **Tone (Grade 7+):** STRICTLY NEGATIVE CONSTRAINT: Do NOT use "Second-Person" narrative (e.g., "Imagine yourself...", "How would you feel..."). Use an **Objective, Historical Tone**.

    4. **Strict Grounding (Anti-Hallucination):**
       - **Rule:** Use ONLY the provided Source Text.
       - **Prohibition:** Do NOT add external examples (e.g., "Cyberbullying", "Smartphones") unless they appear in the Source Text.
       - **Fact Check:** If it's not in the PDF, it doesn't exist for this lesson.

    5. **Micro-Learning Progression (Anti-Amnesia):**
       - Treat this step as "Chapter ${stepInfo.step_number}" of a continuous story.
       - Focus ONLY on the new sub-topic found in the Source Text.

    6. **Interaction Specific Rules:**
       - **Ordering (Anti-Spoiler):** The 'teach_content' MUST be a narrative story (paragraphs). NO BULLET POINTS. Items must be paraphrased.
       - **Categorization:** Categories must be **Function/Binary** (e.g., "Cause/Effect", "Problem/Solution"). do NOT use abstract themes.
       - **Open Question:** Provide "Evaluator Guidelines" instead of a static answer. **MUST BE IN HEBREW.**
       - **Fill Blanks (Cloze):** Use for "Understand" level. Remove KEYWORDS that require context to guess.
       - **True/False:** Use for "Interpretation". "Does the text imply X?".
       - **Language:** OUTPUT VALUES MUST BE IN HEBREW. \`model_answer\` must be in Hebrew.

    7. **Scaffolding:**
       - **Progressive Hints:** Provide 3 levels (General, Specific, Almost Answer).
       - **Feedback:** Explain WHY an answer is wrong with a text reference.
       - **Source Reference:** Quote the text.

    Output FORMAT (JSON ONLY):
    {
       "step_number": ${stepInfo.step_number},
       "bloom_level": "${stepInfo.bloom_level}", 
       "teach_content": "Full explanation text (Simplified for ${gradeLevel}, Narrative flow, complying with Focus)...",
       "selected_interaction": "${stepInfo.suggested_interaction_type}", 
       "data": {
          "progressive_hints": ["Hint 1", "Hint 2", "Hint 3"],
          "source_reference_hint": "See section '...'",
          
          // EXAMPLES (MUST FOLLOW):
          // IF Multiple Choice / True False:
          // "question": "The question string",
          // "options": [{ "text": "A", "is_correct": true, "feedback": "..." }, { "text": "B", "is_correct": false }]

          // IF Linking/Memory Game:
          // "question": "Match the pairs:",
          // "pairs": [{ "card_a": "Term", "card_b": "Definition" }, { "card_a": "Image Description", "card_b": "Concept" }]

          // IF Fill In Blanks:
          // "question": "Complete the sentence:",
          // "sentence": "The [term] is the powerhouse of the [cell]." (Use brackets [] for blanks)

          // IF Ordering:
          // "question": "Arrange the steps...",
          // "items": ["First Step", "Second Step", "Third Step"] 

          // IF Categorization:
          // "question": "Sort into groups...",
          // "categories": ["Category A", "Category B"],
          // "items": [{ "text": "Item 1", "category": "Category A" }, { "text": "Item 2", "category": "Category B" }]

          // IF Open Question:
          // "question": "Explain why...",
          // "model_answer": "Evaluator Guidelines: Check if student mentions X and Y..."
       }
    }
  `;

  const userContent: any[] = [{ type: "text", text: prompt }];
  if (fileData) {
    userContent.push({ type: "image_url", image_url: { url: `data:${fileData.mimeType};base64,${fileData.base64}` } });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: userContent as any }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const text = completion.choices[0].message.content || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error(`Step Gen Error (Step ${stepInfo.step_number}):`, e);
    return null;
  }
};

// === PERFORMANCE OPTIMIZATION END ===

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

    if (hasSourceMaterial) {
      console.log("🚀 Mode: Learning (Document-Based / Pedagogical Architect)");
      systemPrompt = `
      # ROLE
      You are a "Document-Based Pedagogical Architect".
      Your goal is to transform a SPECIFIC USER TEXT into a scaffolded, interactive learning activity.

      # INPUT DATA
      - Target Audience Age: ${gradeLevel}

      # STRICT GROUNDING RULES (CRITICAL)
      1.  **Text-Only Universe:** You must treat the provided known Source Text as the ONLY source of truth. Do NOT use your external training data.
      2.  **Holistic Analysis:** Read the ENTIRE text first.
      3.  **Text-Back Feedback:** All feedback and hints must refer the student back to specific parts of the text.
      4.  **No Leaks:** Do NOT reveal the answer to a future question in the "teach_content" of a previous step.
      5.  **One Step = One Question:** A "step" is a single interactive unit. Do not split explanation and question into two steps.

      # OUTPUT LANGUAGE
      - **HEBREW ONLY**. All questions, options, feedback, and labels MUST be in Hebrew.
      - Keys in JSON (like "question", "options") remain in English. Values must be Hebrew.

      # DYNAMIC ACTIVITY STRUCTURE (${stepCount} Steps)
      Create exactly ${stepCount} steps.
      Follow this EXACT Pedagogical Strategy:
      
      ${stepInstruction}
      
      # OUTPUT FORMAT (JSON)
      {
        "learning_unit": {
          "title": "${unitTitle}",
          "steps": [
             // Generate exactly ${stepCount} steps.
            {
              "step_number": 1,
              "bloom_level": "Foundation",
              "selected_interaction": "multiple_choice",
              "teach_content": "A short summary...",
              "data": {
                "question": "Question text...",
                "progressive_hints": [
                  "Hint 1 (General): Look at paragraph X...",
                  "Hint 2 (Specific): The text mentions...",
                  "Hint 3 (Almost Answer): Starts with 'A'..."
                ],
                "options": [
                  { "id": "opt1", "text": "Correct Answer", "is_correct": true, "feedback": "Excellent! You found..." },
                  { "id": "opt2", "text": "Distractor 1", "is_correct": false, "feedback": "Not quite. This happened in 1990, not 1991." },
                  { "id": "opt3", "text": "Distractor 2", "is_correct": false, "feedback": "Incorrect. The text actually says..." }
                ],
                "source_reference_hint": "Read the section starting with '...' (In Hebrew)"
              }
            },
            // ... Continue for all ${stepCount} steps
          ]
        }
      }

      # INTERACTION SPECIFIC RULES
      - **Ordering Questions (CRITICAL):**
        1. **Chronological Authority:** If the text mentions events out of order (e.g., "B happened after A"), you must order them LOGICALLY (A then B), NOT by their appearance in the text.
        2. **Process over Description:** Only ask to order steps in a process, timeline, or lifecycle. Do NOT ask to order arbitrary list items just because they appear in a list.
        3. **Valid Sequence:** Ensure the sequence has ONE indisputable logical order.
      
      - **Categorization/Grouping (CRITICAL):**
        1. **Exclusive Categories:** Ensure items belong UNDISPUTABLY to only one category based on the text.
        2. **Avoid Semantic Traps:** Do NOT use distractors that sound logically correct (synonyms/related terms) if the text distinguishes them. For example, if "A does X" and "B does Y", do not list B as a candidate for X just because X and Y are similar, unless the distinction is sharp and clear.
        3. **Unambiguous Mapping:** If multiple terms describe similar things, ensure the category definition is specific enough to exclude the "almost correct" answers.

      # APPENDIX: DATA STRUCTURES
      - IF \`ordering\`: { "instruction": "Order these events in their logical/chronological sequence:", "items": ["Step 1", "Step 2", "Step 3"], "correct_sequence": ["Step 1", "Step 2", "Step 3"] }
        (Note: Provide the items in the 'items' array. The system assumes a correct Order check).
      - IF \`matching\`: { "instruction": "Match the term to its definition in the text:", "pairs": [{"left": "Term", "right": "Definition"}] }
      `;

      // User Message Construction for Document-Based
      if (sourceText) {
        userMessageContent.push({ type: "text", text: `Source Text: \n"""${sourceText}"""\n\nTask: Create Document - Based Learning Activity for "${unitTitle}".` });
      } else {
        // Fallback if image but no text (shouldn't happen with hasSourceMaterial logic but safe to keep)
        userMessageContent.push({ type: "text", text: `Task: Create Activity based on the attached image content.` });
      }

    } else {
      // === EXISTING STORYTELLER MODE (No Source Text) ===
      console.log("🚀 Mode: Learning (Storyteller / Topic-Based)");

      systemPrompt = `
        # ROLE
        You are an expert Pedagogical Architect and engaging Storyteller.
        Subject: ${subject}. Target Audience: ${gradeLevel}.
      Language: Hebrew.
  
        # GOAL
        Create a ${stepCount} -step scaffolded learning activity.
        Do NOT use the same question type for every step.Analyze the content and select the BEST interaction type.
  
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
                "progressive_hints": ["Hint 1", "Hint 2", "Hint 3"],
                "options": [
                  { "id": "o1", "text": "Opt1", "is_correct": true, "feedback": "Good job!" },
                  { "id": "o2", "text": "Opt2", "is_correct": false, "feedback": "Hint..." }
                ],
                // "correct_answer" is now implicit in options, but keep for fallback
              }
            },
            // ... Generate exactly ${stepCount} steps following the strategy above
          ]
        }
      }
  
        # APPENDIX: DATA STRUCTURE RULES
        - ** ordering **: "items" list in CORRECT order.
        - ** grouping **: "items" list with "group_index" mapping to "groups".
        - ** matching **: treat as ** grouping ** (Left side = groups, Right side = items).
        - ** open_question **: "data" has "question" and "model_answer".
  
        # OUTPUT FORMAT(JSON ONLY)
        Return a VALID JSON object with the "learning_unit" root.
      `;

      userMessageContent.push({ type: "text", text: `Task: Create Learning Journey for "${unitTitle}"(Topic: ${courseTopic}).` });
    }

  }
  // === MODE 2: EXAM / ASSESSMENT (Old Logic) ===
  else {
    console.log("📝 Mode: Exam (Assessment)");

    const taxonomyInstruction = taxonomy
      ? `\n4.BLOOM'S TAXONOMY DISTRIBUTION (MANDATORY):
        - Knowledge / Recall: ~${taxonomy.knowledge}%
          - Application / Analysis: ~${taxonomy.application}%
            - Evaluation / Creation: ~${taxonomy.evaluation}%
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
          "content": { "options": ["A", "B"], "correct_answer": "A" }
        }
      ]
          
          ${taxonomyInstruction}
          Create 6 - 8 items.
        `;
      if (sourceText) {
        userMessageContent.push({ type: "text", text: `Source Text: \n"""${sourceText}"""\n\nTask: Generate Exam for "${unitTitle}" based on this text.` });
      } else {
        userMessageContent.push({ type: "text", text: `Task: Generate Exam for "${unitTitle}" based on this image.` });
      }
    } else {
      systemPrompt = `
        You are a captivating Storyteller and Private Tutor.
        Subject: ${subject}. Target Audience: ${gradeLevel}.
      Language: Hebrew.

        TASK: Create a specific "Learning Journey"(NOT A QUIZ).

          TONE & STYLE:
      - Fascinating, engaging, and narrative - driven.
        - Do NOT use dry "textbook" language.Use phrases like "Imagine that...", "Surprisingly...", "Let's dive into...".
        - The "content_to_read" must feel like a micro - story or a fascinating fact, not a definition.
        
        For the topic: "${courseTopic}", Unit: "${unitTitle}".

        Create a JSON with "learning_unit" containing "cards".
        CRITICAL: Teach first, then ask.

        # EXAMPLE JSON(STRICTLY FOLLOW THIS STRUCTURE)
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

        # OUTPUT FORMAT(JSON ONLY)
        Return a VALID JSON object with the "learning_unit" root.Do not wrap in markdown code blocks.
      `;
      // User string remains simple to avoid overriding system instructions
      userMessageContent.push({ type: "text", text: `Topic: ${courseTopic}. Create the Learning Journey.` });
    }
  }

  // Common Image Attachment
  if (fileData) {
    const dataUrl = `data:${fileData.mimeType}; base64, ${fileData.base64} `;
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
      response_format: { type: "json_object" },
    }, {
      timeout: 180000 // Extended timeout for full unit generation (3 minutes)
    });

    const responseText = completion.choices[0].message.content || "[]";
    let generatedItems: any[] = []; // Stores the final list of items to map
    const blocks: any[] = [];

    // Parse Response
    try {
      const parsed = JSON.parse(responseText);

      // === NEW LOGIC: Dynamic Learning Unit ===
      if (mode === 'learning') {
        console.log("🚀 Parsing Strategy: Dynamic Learning Unit (Robust)");

        const steps = parsed.learning_unit?.steps || parsed.learning_unit?.cards || [];

        if (Array.isArray(steps)) {
          steps.forEach((step: any) => {

            // 1. Content Block (The Teach) - PRESERVED LOGIC
            if (step.teach_content || step.content_to_read) {
              blocks.push({
                id: uuidv4(),
                type: 'text',
                content: step.teach_content || step.content_to_read,
                metadata: { note: `Step ${step.step_number || ''}: ${step.bloom_level || ''} ` }
              });
            }

            // 2. Interaction Block (The Ask) - ROBUST EXTRACTION
            // Create a Block from whatever data is present (step.data, step.interactive_question, or step itself)
            const interactionBlock = mapSystemItemToBlock(step);
            if (interactionBlock) {
              blocks.push(interactionBlock);
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
      content: `# מתחילים! 🚀\nהפעילות בנושא ** ${unitTitle}** יוצאת לדרך.\nלפניכם תרגול קצר וממוקד.בהצלחה!`,
      metadata: {}
    });


    const selectedPersona = taxonomy && (taxonomy as any).botPersona ? BOT_PERSONAS[(taxonomy as any).botPersona as keyof typeof BOT_PERSONAS] : BOT_PERSONAS.socratic;

    if (includeBot) {
      blocks.push({
        id: uuidv4(),
        type: 'interactive-chat',
        content: { title: selectedPersona.name, description: `עזרה בנושאי ${subject} ` },
        metadata: {
          botPersona: selectedPersona.id,
          initialMessage: selectedPersona.initialMessage,
          systemPrompt: `${selectedPersona.systemPrompt} \n\nנושא השיעור: ${unitTitle} \nקהל יעד: ${gradeLevel} `
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

/**
 * "The Tutor" - Micro-Agent for checking open questions in real-time.
 */
export const checkOpenQuestionAnswer = async (
  question: string,
  userAnswer: string,
  modelAnswer: string,
  sourceText: string = "" // Optional context
): Promise<{ status: "correct" | "partial" | "incorrect"; feedback: string }> => {

  if (!OPENAI_API_KEY) return { status: "partial", feedback: "שגיאה בחיבור ל-AI. נסה שוב." };

  const prompt = `
  # ROLE
  You are a supportive tutor checking a student's answer based on a text.
  DO NOT GIVE THE ANSWER. GUIDE THE STUDENT TO IT.
  Output Language: Hebrew.

  # INPUT
  - Source Text (Context): """${sourceText.substring(0, 1000)}..."""
  - Question: "${question}"
  - Model Answer (Hidden from student): "${modelAnswer}"
  - Student's Answer: "${userAnswer}"

  # TASK
  Analyze the student's answer and categorize it into one of 3 states:

  1.  **CORRECT**: The student understood the core concept.
      * *Action:* Praise and confirm.
  2.  **PARTIALLY CORRECT**: The student got some parts right but missed key details.
      * *Action:* Acknowledge the correct part, then ask a guiding question to help them find the missing part in the text.
  3.  **INCORRECT / IRRELEVANT**: The answer is wrong or off-topic.
      * *Action:* Give a specific hint pointing to the relevant paragraph without revealing the answer.

  # OUTPUT FORMAT (JSON ONLY)
  {
    "status": "correct" | "partial" | "incorrect",
    "feedback_to_student": "WRITE HERE: The personalized message (in Hebrew). E.g., 'אתה צודק לגבי הכלכלה, אבל מה לגבי המצב הפוליטי?'"
  }
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const res = JSON.parse(completion.choices[0].message.content || "{}");
    return {
      status: res.status !== undefined ? res.status : "partial",
      feedback: res.feedback_to_student || "תודה על התשובה."
    };

  } catch (e) {
    console.error("Tutor Error:", e);
    return { status: "partial", feedback: "שגיאה בבדיקת התשובה. המשיכו לנסות." };
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
      messages: [{ role: "user", content: `Suggest a creative, safe, educational image prompt(English) for: "${context.substring(0, 300)}".` }]
    });
    return res.choices[0].message.content || "Educational illustration";
  } catch (e) { return "Educational illustration"; }
};

export const generateSingleOpenQuestion = async (context: string) => {
  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{
        role: "user", content: `Create 1 challenging open-ended question about: "${context}".
      Language: Hebrew.
      JSON format: { 
        "question": "The question text", 
        "modelAnswer": "A detailed, comprehensive expected answer based on the text/context. Do NOT just say 'The answer is in the text'. Write the actual answer." 
      }` }],
      response_format: { type: "json_object" }
    });
    return JSON.parse(res.choices[0].message.content || "{}");
  } catch (e) { return null; }
};

export const generateSingleMultipleChoiceQuestion = async (context: string) => {
  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: `Create 1 multiple - choice question about: "${context}".Language: Hebrew.JSON format: { question, options, correctAnswer } ` }],
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
    title: `חיזוק: ${originalUnit.title} `,
    type: 'remedial',
    baseContent: 'תוכן מותאם אישית...',
    activityBlocks: [
      {
        id: uuidv4(),
        type: 'text',
        content: `זיהיתי קושי בנושא "${originalUnit.title}".בוא ננסה לגשת לזה מזווית אחרת עם הסברים מפושטים יותר.`
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