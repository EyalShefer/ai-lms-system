import { getFirestore, collection, addDoc, onSnapshot, doc } from "firebase/firestore";
import { getApp } from "firebase/app";
import OpenAI from "openai";
import { v4 as uuidv4 } from 'uuid';
import { PEDAGOGICAL_SYSTEM_PROMPT, STRUCTURAL_SYSTEM_PROMPT } from './prompts/pedagogicalPrompts';
import type { ValidationResult } from './courseTypes';
import { getFunctions } from "firebase/functions";

export const functions = getFunctions(getApp());
// if (window.location.hostname === "localhost") {
//     connectFunctionsEmulator(functions, "127.0.0.1", 5001);
// }

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

import type { RawAiItem, MappedLearningBlock } from './types/gemini.types';
import type { ActivityBlockType, RichOption } from './courseTypes';

// Helper for Wizdi Pyramid
const getBloomDistribution = (count: number): string[] => {
  switch (count) {
    case 3: return ["Remember (Foundation)", "Analyze (Process)", "Create (Synthesis)"];
    case 5: return ["Remember", "Remember", "Apply", "Analyze", "Create"];
    case 7: return ["Remember", "Remember", "Apply", "Apply", "Analyze", "Evaluate", "Create"];
    default: return Array(count).fill("Mix of Levels");
  }
};

/**
 * Maps the raw, chaotic JSON returned by AI into a strict, UI-ready Content Block.
 * 
 * @param item - The raw JSON object from the AI (RawAiItem).
 * @returns {MappedLearningBlock | null} A strictly typed block ready for the Course Player, or null if invalid.
 */
export const mapSystemItemToBlock = (item: RawAiItem | null): MappedLearningBlock | null => {
  if (!item) return null;

  // 1. ROBUST DATA NORMALIZATION
  console.log("Raw AI Item for Mapping:", JSON.stringify(item)); // DEBUG LOG

  // Handle different AI nesting styles (Direct object vs 'data' wrapper vs 'interactive_question' wrapper)
  // Sometimes AI returns data: { data: { ... } }
  // We use 'as RawAiItem' because the nesting can be recursive and unpredictable, but we know it conforms to the partial shape
  const rawData: RawAiItem = (item.data?.data || item.data || item.interactive_question || item) as RawAiItem;

  // Extract Type
  // Keep as string for loose matching against AI outputs (which might use underscores)
  const typeString = item.selected_interaction || item.type || rawData.type || 'multiple_choice';

  // Extract Question Text (Handle all known variations - Check Root AND Data)
  const questionObj = rawData.question || item.question;
  const questionText =
    (typeof questionObj === 'object' ? questionObj?.text : questionObj) || // Handle { question: { text: "..." } }
    rawData.question_text ||
    rawData.text ||
    rawData.instruction ||
    rawData.text ||
    rawData.instruction;

  // REMOVED GLOBAL FAIL: Allow specific types to default their question text.
  // if (!questionText || questionText.length < 2) {
  //   console.warn("Block skipped: No question text found");
  //   return null; 
  // }

  const commonMetadata = {
    bloomLevel: item.bloom_level || "ידע ומיומנויות יסוד",
    feedbackCorrect: rawData.feedback_correct || rawData.feedback || "כל הכבוד! התשובה תואמת את הטקסט.",
    feedbackIncorrect: rawData.feedback_incorrect || "לא מדויק. כדאי לנסות שוב או להיעזר ברמז המודגש.",
    sourceReference: rawData.source_reference || rawData.source_reference_hint || null
  };

  // === CASE A: MULTIPLE CHOICE / TRUE-FALSE ===
  // Compare against loose strings from AI
  if (typeString === 'multiple_choice' || typeString === 'multiple-choice' || typeString === 'true_false' || typeString === 'teach_then_ask') {
    // Robust Options Extraction
    let options: (string | RichOption)[] = [];
    if (Array.isArray(rawData.options)) options = rawData.options;
    else if (Array.isArray(item.options)) options = item.options; // Check root as fallback
    else if (Array.isArray(rawData.choices)) options = rawData.choices;
    else if (Array.isArray(rawData.answers)) options = rawData.answers;

    // Normalize Options to Strings for Content, Keep Rich Data in Metadata
    const normalizedOptions: string[] = options.map((o) =>
      typeof o === 'string' ? o : (o.text || o.label || "")
    );

    // Fallback if empty options
    if (normalizedOptions.length < 2) {
      if (typeString === 'true_false') {
        normalizedOptions.push("נכון", "לא נכון");
      } else {
        console.warn("Invalid options detected for MC, returning null to force retry/skip");
        return null; // Better to fail than show "Option A"
      }
    }

    // Robust Correct Answer Extraction
    let correctAnswer = "";

    // 1. Check for "is_correct" flag in rich objects
    const correctOptObj = options.find((o) => typeof o === 'object' && (o.is_correct || o.isCorrect === true)) as RichOption | undefined;
    if (correctOptObj) {
      correctAnswer = correctOptObj.text || correctOptObj.label || "";
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

    // Normalize type to accepted enum
    const finalType: ActivityBlockType = typeString === 'true_false' ? 'multiple-choice' : 'multiple-choice';

    return {
      id: uuidv4(),
      type: finalType,
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
  if (typeString === 'open_question' || typeString === 'open-question' || typeString === 'open_ended') {
    return {
      id: uuidv4(),
      type: 'open-question',
      content: { question: questionText },
      metadata: {
        ...commonMetadata,
        modelAnswer: Array.isArray(rawData.model_answer)
          ? rawData.model_answer.join('\n- ')
          : (rawData.model_answer || rawData.teacher_guidelines || rawData.answer_key || "התשובה נמצאת בחומר הלימוד."),
        score: 20
      }
    };
  }

  // === CASE C: ORDERING / SEQUENCING ===
  if (typeString === 'ordering' || typeString === 'sequencing') {
    const rawItems = rawData.items || rawData.steps || rawData.correct_order || [];
    // Ensure items are strings
    const items = rawItems.map((i) => {
      if (typeof i === 'string') return i;
      // i is an object from the union in RawAiItem
      return i.text || i.step || i.content || (i as any).description || JSON.stringify(i);
    });

    // Valid Sequence Check
    if (items.length < 2) {
      console.warn("Ordering items missing or too few. Attempting auto-repair from text.");
      // Fallback: Try to split the question/instruction text into steps
      if (questionText && questionText.length > 20) {
        // Try splitting by newlines first
        let splitText = questionText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
        if (splitText.length < 2) {
          // Try splitting by periods (sentences)
          splitText = questionText.split('.').map(s => s.trim()).filter(s => s.length > 5);
        }

        if (splitText.length >= 2) {
          items.push(...splitText);
          // Update items in the block
        } else {
          return null; // Truly failed
        }
      } else {
        return null; // Fail
      }
    }

    return {
      id: uuidv4(),
      type: 'ordering',
      content: {
        instruction: questionText !== "שאלה ללא טקסט" ? questionText : "סדרו את הצעדים הבאים:",
        correct_order: items
      },
      metadata: { ...commonMetadata, score: 15 }
    };
  }

  // === CASE D: CATEGORIZATION / GROUPING / MATCHING ===
  if (typeString === 'categorization' || typeString === 'grouping' || typeString === 'matching') {
    let categories: string[] = [];
    let items: { text: string; category: string }[] = [];

    // Handle Matching (Pairs)
    if (typeString === 'matching' || rawData.pairs) {
      const pairs = rawData.pairs || [];
      const uniqueCats = new Set<string>();
      pairs.forEach((p) => uniqueCats.add(p.right || p.category || ""));
      categories = Array.from(uniqueCats).filter(Boolean);
      items = pairs.map((p) => ({
        text: p.left || p.item || "",
        category: p.right || p.category || ""
      }));
    }
    // Handle Standard Grouping
    else {
      categories = rawData.groups || rawData.categories || ["קטגוריה 1", "קטגוריה 2"];
      const rawListing = rawData.items || [];

      // Map items with group index if needed
      items = rawListing.map((item) => {
        // If item is object with 'category' prop
        if (typeof item === 'object' && item.category) {
          const txt = item.text || item.content || JSON.stringify(item);
          return { text: txt, category: item.category };
        }
        // If item has group_index
        if (typeof item === 'object' && item.group_index !== undefined && categories[item.group_index]) {
          return { text: item.text || item.content || "", category: categories[item.group_index] };
        }
        // Fallback: If AI returns items as simple strings but didn't assign categories, we can't guess.
        // But if AI returns { text: "X", group: "Y" } handle that.
        if (typeof item === 'object' && item.group) return { text: item.text || JSON.stringify(item), category: item.group };

        // Fallback for simple strings (default to first category to prevent crash, or mark as Uncategorized)
        return {
          text: typeof item === 'string' ? item : (item.text || JSON.stringify(item)),
          category: categories[0] || "כללי"
        };
      });
    }

    // Fallback for empty items
    if (items.length === 0) {
      console.warn("Categorization items missing. Attempting to parse from text.");

      // Auto-Repair: Look for bullet points in text
      const bulletPoints = questionText ? questionText.match(/[-*•]\s?(.+)/g) : null;
      if (bulletPoints && bulletPoints.length >= 2) {
        bulletPoints.forEach(bp => {
          const cleanText = bp.replace(/[-*•]\s?/, '').trim();
          if (cleanText) {
            items.push({ text: cleanText, category: categories[0] || "General" });
          }
        });
      }

      if (items.length === 0) {
        return null; // Truly failed
      }
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

  // === CASE F: FILL IN BLANKS ===
  if (typeString === 'fill_in_blanks' || typeString === 'cloze') {
    return {
      id: uuidv4(),
      type: 'fill_in_blanks',
      content: {
        sentence: rawData.text || rawData.content || questionText || "חסר טקסט להשלמה",
      },
      metadata: {
        ...commonMetadata,
        score: 15,
        wordBank: rawData.word_bank || rawData.options || [] // Optional word bank
      }
    };
  }

  // === CASE G: AUDIO RESPONSE ===
  if (typeString === 'audio_response' || typeString === 'oral_answer' || typeString === 'record_answer') {
    return {
      id: uuidv4(),
      type: 'audio-response',
      content: {
        question: questionText || "הקליטו את תשובתכם:",
        description: rawData.description || "לחצו על כפתור ההקלטה כדי לענות.",
        maxDuration: rawData.max_duration || 60
      },
      metadata: {
        ...commonMetadata,
        score: 20
      }
    };
  }

  // === CASE E: MEMORY GAME ===
  if (typeString === 'memory_game' || typeString === 'memory' || typeString === 'matching_pairs') {
    const pairs = rawData.pairs || rawData.cards || [];

    // Normalize Pairs
    const normalizedPairs: { card_a: string; card_b: string }[] = [];

    if (Array.isArray(pairs)) {
      pairs.forEach((p: any) => {
        if (p.card_a && p.card_b) normalizedPairs.push({ card_a: p.card_a, card_b: p.card_b });
        else if (p.left && p.right) normalizedPairs.push({ card_a: p.left, card_b: p.right });
        else if (Array.isArray(p) && p.length === 2) normalizedPairs.push({ card_a: p[0], card_b: p[1] });
      });
    }

    if (normalizedPairs.length < 2) {
      console.warn("Memory game pairs missing or too few.");
      return null;
    }

    return {
      id: uuidv4(),
      type: 'memory_game',
      content: {
        pair_count: normalizedPairs.length,
        pairs: normalizedPairs,
        question: questionText || "מצאו את הזוגות המתאימים:"
      },
      metadata: { ...commonMetadata, score: 15 }
    };
  }

  return null;
};

// === PERFORMANCE OPTIMIZATION START ===

// 1. Generate Skeleton (Fast Structure)
import type { UnitSkeleton, SkeletonStep } from './types/gemini.types';

/**
 * 1. Generate Skeleton (The "Brain")
 * 
 * Creates the high-level outline of the unit.
 * Responsible for segmentation, topic policing, and ensuring logical flow.
 * 
 * @param topic - The user's input topic.
 * @param gradeLevel - Target audience.
 * @param activityLength - 'short' | 'medium' | 'long'.
 * @param sourceText - (Optional) Grounding text.
 * @returns {Promise<UnitSkeleton | null>} Strict JSON structure or null.
 */
export const generateUnitSkeleton = async (
  topic: string,
  gradeLevel: string,
  activityLength: 'short' | 'medium' | 'long',
  sourceText?: string,
  mode: 'learning' | 'exam' = 'learning'
): Promise<UnitSkeleton | null> => {
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
      STEPS 3-4: Connection (Analyze). Type: fill_in_blanks OR categorization.
      STEP 5: Synthesis (Create). Type: open_question OR audio_response.
    `;
  }

  const contextPart = sourceText
    ? `BASE CONTENT ON THIS TEXT ONLY:\n"""${sourceText.substring(0, 15000)}"""\nIgnore outside knowledge if it contradicts the text.`
    : `Topic: "${topic}"`;

  const prompt = `
    Task: Create a "Skeleton" for a learning unit.
    ${contextPart}
    Target Audience: ${gradeLevel}.
    Mode: ${mode === 'exam' ? 'STRICT EXAMINATION / TEST MODE' : 'Learning/Tutorial Mode'}
    Count: Exactly ${stepCount} steps.
    Language: Hebrew.

    MISSION:
    1. **Holistic Analysis:** Read the ENTIRE source text first. Understand the "Big Picture".
    2. **SEGMENTATION STRATEGY (CRITICAL):**
       - **Scan First:** Identify ALL distinct case studies, periods, or sub-topics.
       - **Anti-Bias Rule:** You MUST include ALL major distinct stories found.
       - **Action:** Divorce the Source Text into ${stepCount} DISTINCT, NON-OVERLAPPING logical chunks.
       - **Constraint:** Chunk A must end completely before Chunk B begins.

    3. **ZERO-TEXT-WALL POLICY (V4 ANTI-BATCHING):**
       ${mode === 'exam'
      ? `- **EXAM MODE:** DO NOT includes 'Teach Content'. Focus strictly on testing/assessment blocks.`
      : `- **CRITICAL:** You must ensure that the user interacts FREQUENTLY.`}
       - **Rule:** If the narrative has more distinct chunks than the requested ${stepCount} steps, you MUST Insert 'multiple_choice' or 'true_false' steps in between to ensure coverge without merging topics.
       - **Structure:** Text Chunk -> Question -> Text Chunk -> Question.

    4. **Topic Policing:**
       - For each step, define a strict **narrative_focus** (Allowed Content) and **forbidden_topics** (Banned Content).

    5. **LOGIC SAFETY:**
       - **Categorization:** Categories must be MUTUALLY EXCLUSIVE.
       - **Ordering:** Must be based on objective criteria.

    6. **Structure Guide:**
    ${structureGuide}

    Output JSON Structure:
    {
      "unit_title": "String",
      "steps": [
        {
          "step_number": 1,
          "title": "Unique Title for Chunk A",
          "narrative_focus": "${mode === 'exam' ? 'Assessment Topic A' : 'Discuss ONLY [Specific Concept A]'} . Do not mention [Concept B].",
          "forbidden_topics": ["Concept B", "Concept C", "Future Events"],
          "bloom_level": "Remember",
          "suggested_interaction_type": "memory_game"
        }
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
    const result = JSON.parse(text) as UnitSkeleton;

    // Basic validation
    if (!result.steps || !Array.isArray(result.steps)) {
      console.warn("Invalid skeleton format received");
      return null;
    }
    return result;

  } catch (e) {
    console.error("Skeleton Gen Error:", e);
    return null;
  }
};

// 2. Generate Single Step Content (Detailed & Slow - Run in Parallel)
import type { StepContentResponse } from './types/gemini.types';

// Helper to generate Grade-Specific Linguistic Constraints
const getLinguisticConstraints = (gradeLevel: string): string => {
  // Normalize grade level (simple heuristic)
  const isElementary = /([3-6]|[ג-ו])['']?$/.test(gradeLevel) || gradeLevel.includes('יסודי') || gradeLevel.includes('Elementary');
  const isHighSchool = /(1[0-2]|['י][אב]?)$/.test(gradeLevel) || gradeLevel.includes('תיכון') || gradeLevel.includes('High School');

  if (isElementary) {
    return `
    3. **LINGUISTIC CONSTRAINTS (Elementary / CEFR A2-B1):**
       - **Structure:** Use ONLY simple sentences (Subject-Verb-Object). Max 10-12 words.
       - **Prohibition:** NO Passive Voice. NO "Construct State Chains" (רצף סמיכויות).
       - **Vocabulary:** Concrete nouns only. Abstract concepts must be explained in parentheses ().
       - **COGNITIVE SHIELD:** If the thought is complex (Bloom Level 4+), SPLIT it into multiple short sentences. DO NOT delete the logic.`;
  }

  if (isHighSchool) {
    return `
    3. **LINGUISTIC CONSTRAINTS (High School / CEFR B2-C1):**
       - **Register:** Academic / Formal Hebrew.
       - **Requirement:** Mandatory use of Nominalization (שם פעולה).
       - **Syntax:** Complex embedded clauses are expected.
       - **Tone:** Academic, authoritative.`;
  }

  // Default to Middle School (Grades 7-9)
  return `
    3. **LINGUISTIC CONSTRAINTS (Middle School / CEFR B1-B2):**
       - **Structure:** Compound sentences allowed (Although/Because/Therefore). Max 20 words.
       - **Tone:** Slight cynicism or humor is allowed here (Wizdi-Bot style).
       - **Focus:** Highlight Cause-and-Effect relationships.`;
};

/**
 * 2. Generate Single Step Content (The "Hands")
 * 
 * Generates the full learning content for a single step based on the Skeleton.
 * 
 * @param topic - The overall course topic.
 * @param stepInfo - The specific skeleton step to expand.
 * @param gradeLevel - Target audience grade.
 * @param sourceText - (Optional) The grounded text to base content on.
 * @param fileData - (Optional) Associated image data.
 * @returns {Promise<StepContentResponse | null>} Strict JSON response or null on failure.
 */
export const generateStepContent = async (
  topic: string,
  stepInfo: SkeletonStep,
  gradeLevel: string,
  sourceText?: string,
  fileData?: any,
  mode: 'learning' | 'exam' = 'learning'
): Promise<StepContentResponse | null> => {
  const contextText = sourceText ? `Source Material:\n"""${sourceText.substring(0, 3000)}..."""` : `Topic: ${topic}`;

  const prompt = `
    ${contextText}

    MANDATORY REQUIREMENTS:
    1. **Pedagogy:** Strictly follow the Bloom Level (${stepInfo.bloom_level}) and Interaction Type (${stepInfo.suggested_interaction_type}).
    2. **ZERO-TEXT-WALL RULE (V4 Anti-Batching):**
       - **CRITICAL:** You must NEVER output two distinct text chunks consecutively without a question.
       - **Focus:** Discuss ONLY: ${stepInfo.narrative_focus || "current step's topic"}.
       - **BAN:** Do NOT mention: ${JSON.stringify(stepInfo.forbidden_topics || [])}.
       ${mode === 'exam'
      ? `- **EXAM MODE:** Do NOT output 'teach_content'. Set it to null or empty string.`
      : `- **Constraint:** If the text requires multiple paragraphs, ensure the question relates to the *entire* chunk or breaks it down.`}

    ${getLinguisticConstraints(gradeLevel)}

       - **Age Adaptation (Grades 1-6):** Every technical term MUST have a concrete analogy.
       - **Tone Override:** ${mode === 'exam' ? 'Objective, Examiner Tone (No Humor)' : 'As per Linguistic Constraints above'}.

    4. **STRICT GROUNDING (Anti-Hallucination V3):**
       - **Rule:** Use ONLY the provided Source Text. If it's not in the PDF, it doesn't exist.

    5. **Micro-Learning Progression:**
       - Treat this step as "Chapter ${stepInfo.step_number}". Do not repeat definitions from previous chapters.
       ${mode === 'exam' ? '- **EXAM MODE:** TONE must be objective, examiner tone. No "Wizdi-Bot" persona.' : ''}

    6. **Logic & Interaction Rules:**
       - **Ordering:** The 'teach_content' MUST be a narrative story. Items must be paraphrased.
       - **Categorization:** Categories must be **MUTUALLY EXCLUSIVE**.
       - **OPEN QUESTION RUBRIC:** Provide a detailed \`model_answer\` with 3-4 bullet points.
       - **Language:** OUTPUT VALUES MUST BE IN HEBREW.
       - **Language:** OUTPUT VALUES MUST BE IN HEBREW.
       
    8. **PEDAGOGICAL SAFETY VALVE (BLOOM-PRESERVING FALLBACK):**
       - **Rule:** If the Source Text lacks the data structure required for the requested Interaction Type (e.g., requested "Ordering" but text has no clear sequence), you MUST trigger a Fallback.
       - **CRITICAL:** The Fallback must preserve the cognitive load (Bloom Level).
       
       **CASE A: REQUESTED "Ordering" (Apply/Analyze)**
       - FAILURE CONDITION: Text lists items without a clear objective sequence.
       - FALLBACK ACTION: Switch to "Categorization" (if items differ by type) OR "Fill-in-Blanks" (Cloze).
       
       **CASE B: REQUESTED "Categorization" (Apply/Analyze)**
       - FAILURE CONDITION: All items belong to a single category or are ambiguous.
       - FALLBACK ACTION: Switch to "Fill-in-Blanks" (Contextual inference).
       
       **CASE C: REQUESTED "Memory Game" (Remember)**
       - FAILURE CONDITION: Cannot find 6 distinct pairs.
       - FALLBACK ACTION: Switch to "Multiple Choice" (Fact recall) or "True/False" (Fact verification).
       
       **GENERAL RULE:**
       - NEVER return empty or broken JSON logic (e.g., categories=["None"]).
       - ALWAYS prefer a valid "Lower-Type" over an Invalid "Higher-Type".
       - IF ALL ELSE FAILS: Fallback to "Multiple Choice".

    7. **Scaffolding:**
       ${mode === 'exam'
      ? `- **EXAM MODE:** Do NOT generate 'progressive_hints'. Return empty array [].`
      : `- **Level 1 Hint:** Point to the specific text part.\n- **Level 2 Hint:** Rephrase content.`}
       - **Feedback:** Explain WHY specific wrong choice is incorrect.

    Output FORMAT (JSON ONLY):
    {
       "step_number": ${stepInfo.step_number},
       "bloom_level": "${stepInfo.bloom_level}", 
       "teach_content": "Full explanation text (Simplified for ${gradeLevel}, Narrative flow, complying with Focus)...",
       "selected_interaction": "${stepInfo.suggested_interaction_type}", 
       "data": {
          "progressive_hints": ["Hint 1", "Hint 2"],
          "source_reference_hint": "See section '...'",
          // DYNAMIC STRUCTURE BASED ON INTERACTION TYPE:
          // 1. MULTIPLE CHOICE / TRUE_FALSE:
          // { "question": "...", "options": ["A", "B", "C", "D"], "correct_answer": "A" }
          
          // 2. CATEGORIZATION:
          // { "question": "Sort the items...", "categories": ["Cat1", "Cat2"], "items": [{ "text": "Item1", "category": "Cat1" }] }
          
          // 3. ORDERING:
          // { "instruction": "Order the events...", "correct_order": ["Event 1", "Event 2", "Event 3"] }
          
          // 4. FILL IN BLANKS:
          // { "text": "The [Sun] is hot." } (MUST use brackets [] for hidden words, do NOT use underscores)
          
          // 5. MEMORY GAME:
          // { "question": "Match the pairs...", "pairs": [{ "card_a": "Term", "card_b": "Def" }] }
          
          // 6. OPEN QUESTION:
          // { "question": "...", "model_answer": "...", "points": 10 }
          
          // 7. AUDIO RESPONSE (Simulated Oral Exam):
          // { "question": "Explain in your own words...", "max_duration": 60 }
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
    return JSON.parse(text) as StepContentResponse;
  } catch (e) {
    console.error(`Step Gen Error (Step ${stepInfo.step_number}):`, e);
    return null;
  }
};

// === PERFORMANCE OPTIMIZATION END ===

// --- PHASE 2 IMPL: Pedagogical Validation ---

export const validateContent = async (
  lessonJson: any,
  targetAudience: string
): Promise<ValidationResult> => {
  console.log("🔍 Validating content for:", targetAudience);

  const prompt = `
    User Instruction:
    Attached is a JSON representing an educational lesson.
    Target Audience: ${targetAudience}.

    Analyze the content strictly against the PEDAGOGICAL MATRIX and STRUCTURAL GUIDELINES provided in the system prompt.
    
    Returns a JSON with this EXACT structure (no markdown):
    {
      "status": "PASS" | "REJECT",
      "metrics": {
        "cefr_level": "string",
        "readability_score": number, // 0-100
        "cognitive_load": "Low" | "Medium" | "High"
      },
      "issues": [
        {
          "module_index": number, // index of the step/module with issue
          "issue_type": "string",
          "description": "string",
          "suggested_fix": "string"
        }
      ]
    }

    Lesson Content to Validate:
    ${JSON.stringify(lessonJson)}
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: PEDAGOGICAL_SYSTEM_PROMPT + "\n\n" + STRUCTURAL_SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1 // Low temperature for consistent validation
    });

    const text = completion.choices[0].message.content || "{}";
    return JSON.parse(text) as ValidationResult;
  } catch (e) {
    console.error("Validation Error:", e);
    // Fallback: Pass if validation fails to run (fail-open) or Reject (fail-closed)?
    // For now, fail-closed to be safe, but with empty issues.
    return {
      status: 'REJECT',
      metrics: { cefr_level: 'Unknown', readability_score: 0, cognitive_load: 'High' },
      issues: [{ module_index: -1, issue_type: 'SystemError', description: 'Validation failed to run', suggested_fix: 'Retry' }]
    };
  }
};

export const attemptAutoFix = async (
  originalJson: any,
  validationResult: ValidationResult
): Promise<any> => {
  console.log("🔧 Attempting Auto-Fix...", validationResult.issues);

  const prompt = `
    You are a Content Editor.
    Your task is to REWRITE the provided JSON content to resolve strict pedagogical issues.
    
    Issues Found:
    ${JSON.stringify(validationResult.issues)}

    Original Content:
    ${JSON.stringify(originalJson)}

    INSTRUCTION:
    1. Fix ONLY the specific issues listed.
    2. Maintain the original JSON structure exactly.
    3. Do NOT change the topic or core educational value, just the wording/structure to match the target audience.
    
    Output the corrected JSON only.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const text = completion.choices[0].message.content || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error("Auto-Fix Error:", e);
    return originalJson; // Return original if fix fails
  }
};

export const safeGenerationWorkflow = async (
  generationFn: () => Promise<any>,
  targetAudience: string,
  maxRetries: number = 2
): Promise<any> => {
  let content = await generationFn();
  let attempts = 0;

  while (attempts <= maxRetries) {
    console.log(`🔒 Validation Loop: Attempt ${attempts + 1}/${maxRetries + 1}`);

    // 1. Validate
    const validation = await validateContent(content, targetAudience);
    console.log("📊 Validation Status:", validation.status);

    if (validation.status === 'PASS') {
      console.log("✅ Content Passed Validation!");
      return content;
    }

    // 2. Reject -> Attempt Fix
    console.warn("⚠️ Content Rejected. Issues:", validation.issues);

    if (attempts < maxRetries) {
      console.log("🛠️ Attempting Auto-Fix...");
      content = await attemptAutoFix(content, validation);
    } else {
      console.error("❌ Max Retries Reached. Content Generation Failed.");
      throw new Error("Pedagogical Validation Failed: Content could not be auto-corrected to meet standards.");
    }

    attempts++;
  }
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

/**
 * @deprecated Use V4 'Brain & Hands' workflow (generateUnitSkeleton -> generateStepContent) instead.
 * This legacy function creates "Text Walls" and violates strict pedagogical standards.
 */
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

  // === DYNAMIC STEP DISTRIBUTION & INSTRUCTION ===
  let stepInstruction = "";
  let stepCount = 5;

  // 1. Determine Base Step Count from Length
  if (activityLength === 'short') stepCount = 3;
  else if (activityLength === 'long') stepCount = 7;

  // 2. Generate Instruction based on Mode
  if (mode === 'learning') {
    // LEARNING MODE: Use Fixed Pedagogical Ratios based on Length
    if (activityLength === 'short') {
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
      // Medium
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
  } else {
    // EXAM MODE: Use Dynamic Taxonomy Percentages from Wizard
    const knowledgePct = taxonomy?.knowledge || 33;
    const applicationPct = taxonomy?.application || 33;
    // Evaluation takes the rest

    const knowledgeSteps = Math.max(1, Math.round((knowledgePct / 100) * stepCount));
    const applicationSteps = Math.max(1, Math.round((applicationPct / 100) * stepCount));
    const evaluationSteps = Math.max(1, stepCount - knowledgeSteps - applicationSteps);

    stepInstruction = `
          ## DISTRIBUTION (Required by User Configuration):
          - **Foundation (Recall):** ${knowledgeSteps} Questions.
          - **Connection (Analysis):** ${applicationSteps} Questions.
          - **Synthesis (Evaluation):** ${evaluationSteps} Questions.
          
          ## BLOCK 1: FOUNDATION (${knowledgeSteps} Qs)
          - Interactions: Multiple Choice, True/False.
          
          ## BLOCK 2: CONNECTION (${applicationSteps} Qs)
          - Interactions: Ordering, Categorization, Fill-in-Blanks.
          
          ## BLOCK 3: SYNTHESIS (${evaluationSteps} Qs)
          - Interactions: Open Question, Complex Scenario MC.
      `;
  }

  // === MODE 1: LEARNING ACTIVITY (The "Journey") ===
  if (mode === 'learning') {
    // WIZDI PYRAMID LOGIC
    const distribution = getBloomDistribution(stepCount);
    stepInstruction = `
      ## WIZDI PYRAMID DISTRIBUTION (Fixed Structure):
      The user requested a ${activityLength} activity (${stepCount} steps).
      You must follow this EXACT cognitive progression:
      ${distribution.map((level: string, i: number) => `${i + 1}. Step ${i + 1}: ${level}`).join('\n      ')}

      ## חוקי אינטראקציה לפי רמה (INTERACTION RULES):
      - **זכירה/הבנה (Remember/Understand):** בחירה מרובה (Multiple Choice), נכון/לא נכון (True/False), משחק זיכרון (Memory Game).
      - **יישום/ניתוח (Apply/Analyze):** סדר פעולות (Ordering), מיון לקטגוריות (Categorization), השלמת חסר (Fill-in-Blanks).
      - **הערכה/יצירה (Evaluate/Create):** שאלה פתוחה (Open Question), תרחיש מורכב (Complex Scenario).
      `;


    if (hasSourceMaterial) {
      console.log("🚀 Mode: Learning (Document-Based / Pedagogical Architect)");
      systemPrompt = `
      ### Role Definition
      You are "Wizdi-Bot," an expert pedagogical AI curriculum developer. 
      Your goal is to transform a SPECIFIC USER TEXT into a scaffolded, interactive learning activity.

      ### I.CORE DIRECTIVES(The "Iron Laws")

    1. ** Strict Data Integrity(Anti - Hallucination):**
          * ** Numbers & Dates:** You must copy ALL numeric data EXACTLY as they appear in the Source Text.
          * ** Constraint:** Do not swap values between two different items.

      2. ** No "Creative Fluff"(Scientific Strictness):**
          * ** Rule:** Do not invent metaphors, similes, or analogies that are not explicitly written in the source text.
          * ** Good:** Using only the explanations provided in the source.

      3. ** The "Zero-Text-Wall" Rule:**
          * ** Structure:** Text Chunk -> Question -> Text Chunk -> Question.
          * ** Constraint:** NEVER output two text chunks consecutively.
          * ** Constraint:** One Step = One Interactive Block.

      4. ** Interaction Variety:**
          * Do not repeat the exact same Interaction Type twice in a row(unless it is "Multiple Choice").

      ### II.DYNAMIC LOGIC & FALLBACK PROTOCOL

      ** 1. Categorization Logic(For "Sorting"):**
      * ** Rule:** Categories must be broad groups(e.g., "Group A" vs "Group B").
      * ** Fallback:** If text lists items without distinct groups -> ** Switch to Fill -in -the - Blanks **.

      ** 2. Ordering Logic(For "Sequence"):**
      * ** Rule:** Only use "Ordering" if the text contains a clear linear process or timeline.
      * ** Fallback:** If text is descriptive(no order) -> ** Switch to Multiple Choice ** or ** Fill -in -the - Blanks **.
      
      ** 3. Memory Game Fallback:**
      * ** Rule:** Must find at least 6 distinct matching pairs.
      * ** Fallback:** If not found -> ** Switch to Multiple Choice **.

      ### III.EXECUTION PLAN
      
      ${stepInstruction}

      ### IV.INPUT DATA
      - Target Audience Age: ${gradeLevel}
      
      ### V.OUTPUT FORMAT(JSON)
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
                // Must include "question" or "instruction"
                "question": "Question text...",
                "progressive_hints": ["Hint 1", "Hint 2"],
                "options": [
                  { "id": "opt1", "text": "Correct", "is_correct": true, "feedback": "Good job!" },
                  { "id": "opt2", "text": "Wrong", "is_correct": false, "feedback": "Try again." }
                ],
                "source_reference_hint": "Read section..."
              }
            }
          ]
      }
    }
      
      # חוקים ספציפיים לאינטראקציות (INTERACTION SPECIFIC RULES)
      - **שאלות סדר (Ordering) - קריטי:**
        1. **סמכות כרונולוגית:** אם הטקסט מזכיר אירועים שלא לפי הסדר, עליך לסדר אותם לוגית/כרונולוגית.
        2. **תהליך ולא סתם רשימה:** בקש לסדר רק צעדים בתהליך, ציר זמן או מחזור חיים. אל תבקש לסדר רשימה שרירותית.
        3. **רצף תקף:** וודא שיש לרצף סדר לוגי אחד ויחיד שאינו משתמע לשתי פנים. הנחיה לתלמיד: "סדרו את האירועים לפי הסדר הנכון..."

      - **מיון לקטגוריות (Categorization) - קריטי:**
        1. **קטגוריות מוציאות (Exclusive):** וודא שכל פריט שייך באופן מובהק וחד משמעי לקטגוריה אחת בלבד לפי הטקסט.
        2. **הימנעות ממלכודות סמנטיות:** אל תשתמש במסיחים שנשמעים נכונים (מילים נרדפות) אם הטקסט לא מבדיל ביניהם בבירור.
        3. **מיפוי חד-ערכי:** אם מונחים שונים מתארים דברים דומים, וודא שהגדרת הקטגוריה ספציפית מספיק כדי להחריג תשובות "כמעט נכונות".

      # PEDAGOGICAL SAFETY VALVE(BLOOM - PRESERVING FALLBACK)
      - ** Rule:** If the Source Text lacks the data structure required for the requested Interaction Type.
      - ** Matrix:**
      1. Ordering -> Categorization OR Cloze.
        2. Categorization -> Cloze.
        3. Memory Game -> Multiple Choice.
      - ** General:** NEVER return broken JSON.Fallback to Multiple Choice if needed.

      # APPENDIX: STRICT DATA STRUCTURES
      - ** Ordering **: { "instruction": "Order these...", "correct_order": ["First Step", "Second Step"] }
      - ** Categorization **: { "question": "Sort...", "categories": ["A", "B"], "items": [{ "text": "X", "category": "A" }, { "text": "Y", "category": "B" }] }
      - ** Memory Game **: { "pairs": [{ "card_a": "Q", "card_b": "A" }, { "card_a": "Term", "card_b": "Def" }] }
      - ** Fill In Blanks **: { "text": "The [Sun] is a star." }
      - ** Multiple Choice **: { "question": "...", "options": ["A", "B"], "correctAnswer": "A" }
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
  sourceText: string = "", // Optional context
  mode: 'learning' | 'exam' = 'learning' // NEW: Mode parameter
): Promise<{ status: "correct" | "partial" | "incorrect"; feedback: string }> => {

  if (!OPENAI_API_KEY) return { status: "partial", feedback: "שגיאה בחיבור ל-AI. נסה שוב." };

  const prompt = `
  # ROLE
  You are a supportive tutor checking a student's answer based on a text.
  DO NOT GIVE THE ANSWER.GUIDE THE STUDENT TO IT.
  Output Language: Hebrew.

  # INPUT
      - Source Text(Context): """${sourceText.substring(0, 1000)}..."""
        - Question: "${question}"
          - Model Answer(Hidden from student): "${modelAnswer}"
            - Student's Answer: "${userAnswer}"

  # TASK
  Analyze the student's answer and categorize it into one of 3 states:

    1. ** CORRECT **: The student understood the core concept.
      * * Action:* Praise and confirm.
  2. ** PARTIALLY CORRECT **: The student got some parts right but missed key details.
      * * Action:* Acknowledge the correct part, then ask a guiding question to help them find the missing part in the text.
  3. ** INCORRECT / IRRELEVANT **: The answer is wrong or off - topic.
      * * Action:* Give a specific hint pointing to the relevant paragraph without revealing the answer.

  # OUTPUT FORMAT(JSON ONLY)
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

export const generateSingleOpenQuestion = async (context: string, sourceText?: string) => {
  const grounding = sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${context}"`;
  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{
        role: "user", content: `Create 1 challenging open - ended question.
      ${grounding}
    Language: Hebrew.
      JSON format(Strictly follow syntax): {
      "question": "The question string (must be at least 10 chars)",
        "modelAnswer": "Detailed answer in Hebrew."
    } ` }],
      response_format: { type: "json_object" }
    });
    const result = JSON.parse(res.choices[0].message.content || "{}");
    if (!result.question || result.question.length < 2) return null; // Validation
    return result;
  } catch (e) { return null; }
};

export const generateSingleMultipleChoiceQuestion = async (context: string, sourceText?: string) => {
  const grounding = sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${context}"`;
  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{
        role: "user", content: `Create 1 multiple - choice question.
      ${grounding}
    Language: Hebrew.
      JSON format(Strictly follow syntax): { "question": "Question string", "options": ["Option 1", "Option 2", "Option 3", "Option 4"], "correctAnswer": "Option 1" } ` }],
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
    if (!parsed.question || parsed.question.length < 2) return null; // Validation: Must have question
    if (!parsed.options || !Array.isArray(parsed.options) || parsed.options.length < 2) {
      console.warn("MC Generation failed validation: Not enough options");
      return null;
    }
    return parsed;
  } catch (e) { return null; }
};

// ==========================================
// NEW GENERATORS (Categorization, Ordering, etc.)
// ==========================================

export const generateCategorizationQuestion = async (topic: string, gradeLevel: string, sourceText?: string) => {
  const grounding = sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`;
  const prompt = `
    Create a detailed Categorization Activity.
      ${grounding}
    Target Audience: ${gradeLevel}.
    Language: Hebrew.

      Task: Create 2 Mutually Exclusive Categories and 6 - 8 items.
        Rules:
    1. Categories must be distinct(e.g., "True/False", "Cause/Effect", "Before/After").
    2. If exact categories aren't found, categorize by "General Concept" vs "Specific Detail".
    3. Output JSON MUST be valid.

    JSON Output Example:
    {
      "question": "Sort the following items:",
        "categories": ["Mammals", "Reptiles"],
          "items": [{ "text": "Dog", "category": "Mammals" }, { "text": "Snake", "category": "Reptiles" }]
    }
    `;
  try {
    const res = await openai.chat.completions.create({ model: MODEL_NAME, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } });
    const result = JSON.parse(res.choices[0].message.content || "{}");
    // Strict Validation
    if (!result.categories || result.categories.length < 2) return null;
    if (!result.items || result.items.length < 2) return null;
    return result;
  } catch { return null; }
};

export const generateOrderingQuestion = async (topic: string, gradeLevel: string, sourceText?: string) => {
  const grounding = sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`;
  const prompt = `
    Create an Ordering / Sequencing Activity.
      ${grounding}
    Target Audience: ${gradeLevel}.
    Language: Hebrew.

      Task: Extract a logical sequence.
        Rules:
    1. If no Chronological Sequence exists, order by "Priority", "Complexity", or "Logical Steps".
    2. Items must be concise strings.

    JSON Output Example:
    {
      "instruction": "Order the steps of the process:",
        "correct_order": ["Step 1: Initiation", "Step 2: Planning", "Step 3: Execution"]
    }
    `;
  try {
    const res = await openai.chat.completions.create({ model: MODEL_NAME, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } });
    const result = JSON.parse(res.choices[0].message.content || "{}");
    // Strict Validation
    if (!result.correct_order || result.correct_order.length < 2) return null;
    return result;
  } catch { return null; }
};

export const generateFillInBlanksQuestion = async (topic: string, gradeLevel: string, sourceText?: string) => {
  const grounding = sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`;
  const prompt = `
    Create a Fill -in -the - Blanks(Cloze) Text.
      ${grounding}
    Target Audience: ${gradeLevel}.
    Language: Hebrew.

      Task: Write a summary paragraph about "${topic}".
        Rules:
    1. Use[brackets] to hide key concepts.
    2. MUST have at least 3 hidden words.
    3. Context MUST make the hidden word guessable.

    JSON Output Example:
    {
      "text": "The capital of [France] is [Paris]."
    }
    `;
  try {
    const res = await openai.chat.completions.create({ model: MODEL_NAME, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } });
    const parsed = JSON.parse(res.choices[0].message.content || "{}");
    // Strict Validation: Must have at least one cloze deletion
    if (!parsed.text || !parsed.text.includes('[') || !parsed.text.includes(']')) return null;
    return parsed.text;
  } catch { return null; }
};

export const generateMemoryGame = async (topic: string, gradeLevel: string, sourceText?: string) => {
  const grounding = sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`;
  const prompt = `
    Create a Memory Game(Matching Pairs).
      ${grounding}
    Target Audience: ${gradeLevel}.
    Language: Hebrew.

      Task: Create 6 matching pairs.
        Rules:
    1. If no detailed definitions exist, match "Term" to "Category" or "Event" to "Date".
    2. JSON must generally valid.
    
    JSON Output Example:
    {
      "pairs": [
        { "card_a": "Sun", "card_b": "Star" },
        { "card_a": "Moon", "card_b": "Satellite" }
      ]
    }
    `;
  try {
    const res = await openai.chat.completions.create({ model: MODEL_NAME, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } });
    const result = JSON.parse(res.choices[0].message.content || "{}");
    // Strict Validation
    if (!result.pairs || result.pairs.length < 3) return null;
    return result;
  } catch { return null; }
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

/**
 * Transcribes an audio file using OpenAI Whisper.
 * Used for student voice answers.
 * @param audioBlob The recorded audio blob.
 * @returns The transcribed text or null on failure.
 */
export const transcribeAudio = async (audioBlob: Blob): Promise<string | null> => {
  if (!OPENAI_API_KEY) {
    console.error("Missing OpenAI Key for transcription");
    return null;
  }

  const formData = new FormData();
  // Whisper requires a filename with extension
  formData.append("file", audioBlob, "recording.webm");
  formData.append("model", "whisper-1");
  formData.append("language", "he"); // Hint for Hebrew

  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("Whisper API Error:", err);
      return null;
    }

    const data = await response.json();
    return data.text || null;

  } catch (e) {
    console.error("Transcription Network Error:", e);
    return null;
  }
};

// --- פונקציה 3: מנתח נתוני תלמידים (Smart Analytics) ---
export const generateStudentAnalysis = async (
  studentName: string,
  submissionData: any, // Contains answers with telemetry
  courseTopic: string
) => {
  const prompt = `
    Role: Educational Psychologist & Data Analyst.
    Task: Analyze student performance based on telemetry data.
    Student: ${studentName}.
    Topic: ${courseTopic}.

    DATA:
    ${JSON.stringify(submissionData, null, 2)}

    METRICS TO ANALYZE:
    1. **Time per Question:** (Fast = Impulsive? / Slow = Struggling or Deep Thinker?)
    2. **Attempts:** (Many attempts = Persistence or Guessing?)
    3. **Hints:** (Usage of hints = Resourcefulness or Dependency?)
    4. **Mistakes:** (Pattern recognition - e.g. "struggles with ordering").

    OUTPUT FORMAT (JSON ONLY):
    {
      "strengths": ["List 2-3 specific strengths"],
      "weaknesses": ["List 2-3 specific weaknesses"],
      "psychologicalProfile": "Impulsive" | "Persistent" | "Deep Thinker" | "Hesitant",
      "recommendedFocus": "Specific sub-topic to review...",
      "engagementScore": 0-100 (Based on completion and effort)
    }
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.5
    });

    const text = completion.choices[0].message.content || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error("Analytics Error:", e);
    return null;
  }
};

// --- פונקציה 4: ניתוח כיתתי (Class Analytics) ---
export const generateClassAnalysis = async (students: any[]) => {
  const prompt = `
    Role: Senior Educational Consultant.
    Task: Analyze CLASS performance based on aggregated student data.
    Count: ${students.length} students.

    DATA SAMPLES (Anonymized):
    ${JSON.stringify(students.map(s => ({ score: s.score, analytics: s.analytics || "No profile" })).slice(0, 15), null, 2)}

    MISSION:
    Identify PATTERNS in the class.
    1. Are they generally impulsive or hesitant?
    2. Is there a specific topic they all struggle with?
    3. What is the emotional state of the class (Engagement)?

    OUTPUT FORMAT (JSON ONLY):
    {
      "strongSkills": ["List 2-3 skills the CLASS excels at"],
      "weakSkills": ["List 2-3 skills the CLASS struggles with"],
      "actionItems": ["List 2 practical teaching strategies for tomorrow"],
      "classVibe": "Competitive" | "Collaborative" | "Struggling" | "Curious"
    }
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.6
    });

    const text = completion.choices[0].message.content || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error("Class Analysis Error:", e);
    return null;
  }
};