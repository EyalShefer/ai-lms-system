import { getFirestore, collection, addDoc, onSnapshot, doc } from "firebase/firestore";
import { getApp } from "firebase/app";
import OpenAI from "openai";
import { v4 as uuidv4 } from 'uuid';
import { PEDAGOGICAL_SYSTEM_PROMPT, STRUCTURAL_SYSTEM_PROMPT, EXAM_MODE_SYSTEM_PROMPT } from './prompts/pedagogicalPrompts';
import type { ValidationResult } from './shared/types/courseTypes';
import { getFunctions } from "firebase/functions";
import { cleanJsonString, mapSystemItemToBlock } from './shared/utils/geminiParsers';
import { auth } from './firebase';

export const functions = getFunctions(getApp());
// if (window.location.hostname === "localhost") {
//     connectFunctionsEmulator(functions, "127.0.0.1", 5001);
// }

// --- אתחול הקליינט של OpenAI (עבור פונקציות עזר ותמונות) ---
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("Missing VITE_OPENAI_API_KEY in .env file");
}

// Helper to get Firebase Auth token
async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return await user.getIdToken();
}

// Create OpenAI client with custom fetch that adds auth token
export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
  baseURL: `${window.location.origin}/api/openai`,
  timeout: 60000,
  maxRetries: 2,
  fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
    // Get auth token and add to headers
    const token = await getAuthToken();
    const headers = new Headers(init?.headers || {});
    headers.set('Authorization', `Bearer ${token}`);

    return fetch(url, {
      ...init,
      headers
    });
  }
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

// Output cleaned via shared parser
// export const cleanJsonString ... (Moved to shared/utils/geminiParsers)

// Helper for Wizdi Pyramid
// Helper for Wizdi Pyramid (Dynamic based on Wizard Settings)
// Helper for Wizdi Pyramid (Dynamic based on Wizard Settings)
const getBloomDistribution = (count: number, requestedDistribution?: Record<string, number>): string[] => {
  // If no preference, use default Pyramid
  if (!requestedDistribution) {
    switch (count) {
      case 3: return ["Remember (Foundation)", "Analyze (Process)", "Create (Synthesis)"];
      case 5: return ["Remember", "Remember", "Apply", "Analyze", "Create"];
      case 7: return ["Remember", "Remember", "Apply", "Apply", "Analyze", "Evaluate", "Create"];
      default: return Array(count).fill("Mix of Levels");
    }
  }

  // Use Dynamic Distribution from Wizard
  // usage: { "Remember": 20, "Apply": 50, "Analyze": 30 }
  const totalPercentage = Object.values(requestedDistribution).reduce((a, b) => a + b, 0);
  const distribution: string[] = [];

  Object.entries(requestedDistribution).forEach(([level, percent]) => {
    const numItems = Math.round((percent / totalPercentage) * count);
    for (let i = 0; i < numItems; i++) distribution.push(level);
  });

  // Fill gap or trim excess
  while (distribution.length < count) distribution.push("Apply"); // Safety fill
  return distribution.slice(0, count).sort(); // Sort isn't pedagogical sorting, the skeleton generation does that
};



/**
 * Maps the raw, chaotic JSON returned by AI into a strict, UI-ready Content Block.
 * NOW IMPORTED FROM SHARED UTILS
 */
export { mapSystemItemToBlock };

// === PERFORMANCE OPTIMIZATION START ===

// 1. Generate Skeleton (Fast Structure)
// 1. Generate Skeleton (Fast Structure)
import type { UnitSkeleton, SkeletonStep, TeacherLessonPlan } from './shared/types/gemini.types';

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
  mode: 'learning' | 'exam' = 'learning',
  bloomPreferences?: Record<string, number>,
  productType: 'lesson' | 'game' | 'exam' = 'lesson',
  studentProfile?: any // StudentAnalyticsProfile (Using any to avoid circular dependency issues if strict)
): Promise<UnitSkeleton | null> => {
  // console.log(`🤖 gemini.ts: Generating Skeleton. Mode: ${mode}, Product: ${productType}, Length: ${activityLength}`);

  // Personality Injection
  let personalityInstruction = "";
  if (studentProfile?.confirmedTraits && studentProfile.confirmedTraits.length > 0) {
    personalityInstruction = `\n    PERSONALIZATION OVERRIDE:\n    The student has confirmed traits: ${JSON.stringify(studentProfile.confirmedTraits)}.\n    ADAPT THE SKELETON TO THESE PREFERENCES (e.g. if 'Visual Learner', prefer visual blocks. If 'Competitive', increase difficulty).`;
    // console.log("Injecting Personality:", personalityInstruction);
  }

  let stepCount = 5;
  let structureGuide = "";

  if (productType === 'exam' || mode === 'exam') {
    // === EXAM PRODUCT / MODE STRUCTURE ===
    // Force strict structure for exams
    stepCount = activityLength === 'short' ? 3 : (activityLength === 'long' ? 7 : 5);

    structureGuide = `
      STEP 1: Knowledge Check. Type: multiple_choice OR true_false (Strict).
      STEP 2: Application. Type: categorization OR ordering.
      STEP 3-${stepCount}: Synthesis/Audio. Type: open_question OR audio_response. NO teaching content.
      `;
  } else if (productType === 'game') {
    // === GAME PRODUCT STRUCTURE ===
    // Focus on INTERACTIVE blocks only.
    if (activityLength === 'short') {
      stepCount = 3;
      structureGuide = `
        STEP 1: Speed Challenge. Type: true_false_speed OR memory_game.
        STEP 2: Puzzle Challenge. Type: ordering OR categorization.
        STEP 3: Master Challenge. Type: memory_game OR categorization (Hard).
      `;
    } else {
      // Medium/Long
      stepCount = activityLength === 'long' ? 7 : 5;
      structureGuide = `
        STEPS 1-2: Warmup Games. Type: memory_game / true_false_speed.
        STEPS 3-4: Logic Puzzles. Type: ordering / categorization / matching.
        STEPS 5-${stepCount}: Boss Levels. Type: categorization / matching (Complex).
      `;
    }
  } else {
    // === STANDARD LESSON STRUCTURE ===
    if (activityLength === 'short') {
      stepCount = 3;
      structureGuide = `
        STEP 1: Introduction & Exposition (Teach + Check). Type: multiple_choice (as Knowledge Check). DO NOT use memory_game.
        STEP 2: Deep Dive (Understand). Type: fill_in_blanks (Conceptual Cloze).
        STEP 3: Conclusion & Reflection. Type: open_question.
      `;
    } else if (activityLength === 'long') {
      stepCount = 7;
      structureGuide = `
        STEPS 1-2: Exposition & Concepts. Type: multiple_choice (Knowledge Check) / true_false.
        STEPS 3-5: Application & Practice. Type: fill_in_blanks / categorization / ordering.
        STEPS 6-7: Synthesis & Critical Thinking. Type: open_question / multiple_choice (Complex Scenario).
      `;
    } else {
      // Medium
      stepCount = 5;
      structureGuide = `
        STEPS 1-2: Core Concepts (Teach). Type: multiple_choice (Concept Check) OR true_false (Misconception Buster).
        STEPS 3-4: Analysis (Apply). Type: fill_in_blanks OR categorization.
        STEP 5: Synthesis (Create/Evaluate). Type: open_question OR audio_response.
      `;
    }
  }

  const contextPart = sourceText
    ? `BASE CONTENT ON THIS TEXT ONLY:\n"""${sourceText.substring(0, 15000)}"""\nIgnore outside knowledge if it contradicts the text.`
    : `Topic: "${topic}"`;

  const bloomSteps = getBloomDistribution(stepCount, bloomPreferences);

  const prompt = `
    Task: Create a "Skeleton" for a learning unit.
    ${contextPart}
    Target Audience: ${gradeLevel}.
    ${personalityInstruction}
    Mode: ${mode === 'exam' || productType === 'exam' ? 'STRICT EXAMINATION / TEST MODE' : (productType === 'game' ? 'GAMIFICATION / PLAY MODE' : 'Learning/Tutorial Mode')}
    Count: Exactly ${stepCount} steps.
    Language: Hebrew.
    
    BLOOM TAXONOMY REQUIREMENTS:
    ${JSON.stringify(bloomSteps)}

    MISSION:
    1. **Holistic Analysis:** Read the ENTIRE source text first. Understand the "Big Picture".
    2. **SEGMENTATION STRATEGY (CRITICAL):**
       - **Scan First:** Identify ALL distinct case studies, periods, or sub-topics.
       - **Anti-Bias Rule:** You MUST include ALL major distinct stories found.
       - **Action:** Divorce the Source Text into ${stepCount} DISTINCT, NON-OVERLAPPING logical chunks.
       - **Constraint:** Chunk A must end completely before Chunk B begins.

    3. **ZERO-TEXT-WALL POLICY (V4 ANTI-BATCHING):**
       ${(mode === 'exam' || productType === 'exam')
      ? `- **EXAM MODE / ASSESSMENT ONLY:**
           - **Structure:** Question Block ONLY. No introduction text.
           - **Content:** Do NOT output 'teach_content'. Output strictly assessment items.
           - **Logic:** Each step is a test item.`
      : (productType === 'game'
        ? `- **GAME MODE / INTERACTIVE ONLY:**
             - **Structure:** 100% Interaction. No long text explanations.
             - **Content:** Gamified challenges.
             - **Logic:** Fun, pacing, engaging.`
        : `- **CRITICAL:** You must ensure that the user interacts FREQUENTLY.
             - **Rule:** If the narrative has more distinct chunks than the requested ${stepCount} steps, you MUST Insert 'multiple_choice' or 'true_false' steps in between to ensure coverge without merging topics.
             - **Structure:** Text Chunk -> Question -> Text Chunk -> Question.`)}

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
      "goals": ["Goal 1 (Understand)", "Goal 2 (Practice)", "Goal 3 (Analyze)"],
      "steps": [
        {
          "step_number": 1,
          "title": "Unique Title for Chunk A",
          "narrative_focus": "${mode === 'exam' ? 'Assessment Topic A' : 'Discuss ONLY [Specific Concept A]'} . Do not mention [Concept B].",
          "forbidden_topics": ["Concept B", "Concept C", "Future Events"],
          "bloom_level": "Remember",
          "suggested_interaction_type": "${mode === 'exam' ? 'multiple_choice' : 'memory_game'}"
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
    const result = JSON.parse(cleanJsonString(text)) as UnitSkeleton;

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
// 2. Generate Single Step Content (Detailed & Slow - Run in Parallel)
import type { StepContentResponse } from './shared/types/gemini.types';

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

  // INJECT EXAM ENFORCER
  const examEnforcer = mode === 'exam' ? EXAM_MODE_SYSTEM_PROMPT : "";

  const prompt = `
    ${contextText}
    ${examEnforcer}

    MANDATORY REQUIREMENTS:
  1. ** Pedagogy:** Strictly follow the Bloom Level(${stepInfo.bloom_level}) and Interaction Type(${stepInfo.suggested_interaction_type}).
    2. ** ZERO - TEXT - WALL RULE(V4 Anti - Batching):**
       - ** CRITICAL:** You must NEVER output two distinct text chunks consecutively without a question.
       - ** Focus:** Discuss ONLY: ${stepInfo.narrative_focus || "current step's topic"}.
       - ** BAN:** Do NOT mention: ${JSON.stringify(stepInfo.forbidden_topics || [])}.
       ${mode === 'exam'
      ? `- **EXAM MODE:** Do NOT output 'teach_content'. Set it to null or empty string. Focus entirely on the Question.`
      : `- **Constraint:** If the text requires multiple paragraphs, ensure the question relates to the *entire* chunk or breaks it down.`
    }

    ${getLinguisticConstraints(gradeLevel)}

       - ** Age Adaptation(Grades 1 - 6):** Every technical term MUST have a concrete analogy.
       - ** Tone Override:** ${mode === 'exam' ? 'Objective, Examiner Tone (No Humor)' : 'As per Linguistic Constraints above'}.

  4. ** STRICT GROUNDING(Anti - Hallucination V3):**
       - ** Rule:** Use ONLY the provided Source Text.If it's not in the PDF, it doesn't exist.

    5. ** Micro - Learning Progression:**
    - Treat this step as "Chapter ${stepInfo.step_number}". Do not repeat definitions from previous chapters.
      ${mode === 'exam' ? '- **EXAM MODE:** TONE must be objective, examiner tone. No "Wizdi-Bot" persona.' : ''}

  6. ** Logic & Interaction Rules:**
       - ** Ordering:** The 'teach_content' MUST be a narrative story.Items must be paraphrased.
       - ** Categorization:** Categories must be ** MUTUALLY EXCLUSIVE **.
       - ** OPEN QUESTION RUBRIC:** Provide a detailed \`model_answer\` with 3-4 bullet points.
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
       "teach_content": ${mode === 'exam' ? "null" : "\"Full explanation text (Simplified for ${gradeLevel})...\""},
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
    // console.log(`🧩 STEP ${stepInfo.step_number} RAW:`, text); // DEBUG
    const result = JSON.parse(cleanJsonString(text)) as StepContentResponse;

    // === 🛡️ PEDAGOGICAL ENFORCER (CODE LEVEL OVERRIDE) ===
    if (mode === 'exam' && result) {
      // FORCE EMPTY STRING to prevent any prompt leakage
      result.teach_content = "";

      // FORCE EMPTY HINTS
      if (result.data) {
        result.data.progressive_hints = [];
        // Only allow source reference if it's explicitly strictly needed, but generally strip it too for strict exams
        // We'll keep source_reference_hint as it might be needed for "Open Book" style, 
        // but progressive hints (coaching) are definitely banned.
      }
    }
    // =======================================================

    return result;
  } catch (e) {
    console.error(`Step Gen Error (Step ${stepInfo.step_number}):`, e);
    return null;
  }
};

// === PERFORMANCE OPTIMIZATION END ===

// === PERFORMANCE OPTIMIZATION END ===

/**
 * 2b. Generate Teacher Lesson Plan (Master Teacher V2)
 * 
 * Distinct architecture from Student Activity.
 * Focuses on Frontal Instruction, Discussion, and Board Plans.
 */
export const generateTeacherStepContent = async (
  topic: string,
  sourceText: string,
  gradeLevel: string,
  sourceType: 'YOUTUBE' | 'TEXT_FILE' | 'TOPIC_ONLY',
  fileData?: any
): Promise<TeacherLessonPlan | null> => {
  // console.log(`🧑‍🏫 Generating Teacher Lesson. Type: ${sourceType}`);

  const contentToInject = sourceType === 'TOPIC_ONLY' ? topic : sourceText.substring(0, 20000);

  const prompt = `
    System Prompt: Master Teacher Lesson Architect V3 (Enhanced)

    🎭 IDENTITY:
    You are Michal Rosen, a veteran Israeli master teacher with 15 years of classroom experience.
    You create lesson plans that are:
    - Ultra-practical (every sentence is actionable)
    - Visually rich (auto-generated images, infographics, diagrams)
    - Interactive (embedded practice activities)
    - Field-tested (includes classroom management tips)

    YOUR CLIENT: A busy teacher preparing tomorrow's lesson.
    YOUR GOAL: Create a complete, ready-to-use lesson plan they can pick up 5 minutes before class.

    INPUT CONTEXT:
    SOURCE_TYPE: "${sourceType}"
    CONTENT: """${contentToInject}"""
    GRADE_LEVEL: "${gradeLevel}"
    DURATION: "45 Minutes"

    ⚙️ VISUAL GENERATION STRATEGY:

    CASE A: If SOURCE_TYPE == "YOUTUBE":
    - Use specific video timestamps
    - Example: "Play video 02:30-03:45 to show photosynthesis process"

    CASE B: If SOURCE_TYPE == "TEXT_FILE" or "TOPIC_ONLY":
    - Generate AI image prompts for DALL-E 3
    - Be SPECIFIC and VISUAL
    - Good: "A colorful diagram showing the water cycle with labeled arrows: evaporation from ocean, condensation in clouds, precipitation as rain, collection in rivers"
    - Bad: "An image about water cycle"

    🎯 IMAGE PROMPT GUIDELINES:
    - Start with art style: "Educational diagram", "Photorealistic", "Colorful illustration for grade ${gradeLevel}"
    - Include specific visual elements: colors, labels, arrows, comparisons
    - Keep culturally neutral and age-appropriate
    - Hebrew text in images should be minimal (use English labels)

    🎨 TONE & LANGUAGE REQUIREMENTS:
    - Use second person: "תגיד לתלמידים..." (not "המורה יגיד...")
    - Conversational Hebrew: "עכשיו זה הזמן ל..." (not "בשלב זה יש לבצע...")
    - Specific instructions: "כתוב על הלוח בגודל 5 ס\"מ" (not just "כתוב על הלוח")

    📊 GRADE-SPECIFIC ADAPTATION:
    ${gradeLevel.includes('א') || gradeLevel.includes('ב') || gradeLevel.includes('ג') ? `
    - Primary grades (א-ג): Use concrete examples from playground/family/pets
    - Max sentence length: 10 words
    - Add gestures: "(עשה תנועה של...)"
    - Repeat key concepts twice
    ` : gradeLevel.includes('ד') || gradeLevel.includes('ה') || gradeLevel.includes('ו') ? `
    - Upper elementary (ד-ו): Mix concrete and abstract
    - Encourage "turn and talk" moments
    - Max sentence length: 15 words
    ` : `
    - Secondary: Academic tone OK
    - Encourage debate and critical thinking
    - Reference current events
    `}

    🎯 CLASSROOM MANAGEMENT EMBEDS:
    Sprinkle these throughout the script:
    - In Hook: "⏱️ [TIP: אם הכיתה רועשת, המתן 10 שניות בשקט]"
    - In Instruction: "👀 [CHECK: סרוק את הכיתה - האם כולם מבינים?]"
    - In Practice: "🔄 [IF STUCK: חזור על הדוגמה ב-slow motion]"

    🚫 CRITICAL CONSTRAINTS:
    - NO student-facing language (say "תבקש מהתלמידים" not "פתחו את הספר")
    - NO quizzes in Hook/Instruction (save for Guided Practice)
    - NO gamification mentions
    - Script must be readable aloud naturally

    ═══════════════════════════════════════════════════════════════

    STRUCTURE (Enhanced 5-Step Model):

    1. THE HOOK (5 min)
    Goal: Engagement + Set learning objectives
    Output:
    - Engaging script (story/question/demonstration)
    - AI image prompt for visual hook
    - Classroom management tip
    - Learning objectives (2-3 bullet points)

    2. DIRECT INSTRUCTION (15 min)
    Goal: Frontal Teaching with Visual Support
    Output: 3-4 Teaching Slides, each with:
    - Slide title
    - Bullet points for board (3-5 items)
    - Script to say (conversational, 80-120 words)
    - AI image prompt for diagram/illustration
    - Timing estimate (e.g., "3-5 minutes")
    - Differentiation note (tips for struggling/advanced students)

    3. GUIDED PRACTICE (15 min) - INTERACTIVE ACTIVITIES
    Goal: Hands-on practice with immediate feedback
    Output:
    - Teacher transition script
    - Suggested interactive activity types (choose 2-3 from list):
      * multiple-choice (for concept checking)
      * memory_game (for vocabulary/definitions)
      * fill_in_blanks (for completing key sentences)
      * ordering (for sequencing events/steps)
      * categorization (for sorting concepts)
      * drag_and_drop (for matching items to zones)
      * hotspot (for exploring labeled diagrams)
      * open-question (for deeper thinking)
    - Brief description of what each activity should assess

    4. DISCUSSION (5 min)
    Goal: Oral Assessment + Critical Thinking
    Output:
    - 2-3 open-ended questions (increasing difficulty)
    - Facilitation tips (e.g., "Ask follow-up: 'Why do you think that?'")

    5. SUMMARY (5 min)
    Goal: Closure + Retention
    Output:
    - ONE memorable takeaway sentence (for notebooks)
    - AI image prompt for visual summary/infographic
    - Optional homework suggestion

    OUTPUT FORMAT (JSON Schema): Generate valid JSON in Hebrew (except for field keys).

    {
      "lesson_metadata": {
        "title": "String (Hebrew - catchy lesson title)",
        "target_audience": "${gradeLevel}",
        "duration": "45 min",
        "subject": "String (e.g., מדעים, היסטוריה)",
        "learning_objectives": [
          "מטרת למידה 1",
          "מטרת למידה 2"
        ]
      },
      "hook": {
        "script_for_teacher": "String (Hebrew - engaging opening script, 80-120 words)",
        "media_asset": {
          "type": "${sourceType === 'YOUTUBE' ? 'youtube_timestamp' : 'ai_generated_image'}",
          "content": "${sourceType === 'YOUTUBE' ? 'Start: 00:00, End: 02:00' : 'DETAILED DALL-E 3 prompt for educational image'}",
          "prompt": "Same as content (for AI images)"
        },
        "classroom_management_tip": "⏱️ [TIP: specific tip in Hebrew]"
      },
      "direct_instruction": {
        "slides": [
          {
            "slide_title": "String (Hebrew)",
            "bullet_points_for_board": ["Point 1", "Point 2", "Point 3"],
            "script_to_say": "String (Hebrew - conversational, 80-120 words)",
            "media_asset": {
              "type": "${sourceType === 'YOUTUBE' ? 'youtube_timestamp' : 'ai_generated_image'}",
              "content": "DETAILED image prompt or timestamp",
              "prompt": "Same as content"
            },
            "timing_estimate": "3-5 דקות",
            "differentiation_note": "💡 לתלמידים מתקשים: [tip]. לתלמידים מתקדמים: [challenge]"
          }
        ]
      },
      "guided_practice": {
        "teacher_instruction": "String (Hebrew - transition script)",
        "wizdi_tool_reference": "Interactive Activity Generator",
        "suggested_block_types": [
          "multiple-choice",
          "memory_game"
        ]
      },
      "discussion": {
        "questions": [
          "שאלה 1 (קלה)",
          "שאלה 2 (בינונית)",
          "שאלה 3 (מאתגרת)"
        ],
        "facilitation_tips": [
          "שאל המשך: 'למה אתה חושב ככה?'",
          "אם אין תשובות, תן דוגמה"
        ]
      },
      "summary": {
        "takeaway_sentence": "String (Hebrew - one memorable sentence for notebooks)",
        "visual_summary": {
          "type": "infographic",
          "content": "DETAILED prompt for visual summary with key concepts",
          "prompt": "Same as content"
        },
        "homework_suggestion": "String (optional, Hebrew)"
      }
    }
  `;

  const userContent: any[] = [{ type: "text", text: prompt }];

  // If we have an image file (and it's not a video transcript), we can pass it
  if (fileData && sourceType === 'TEXT_FILE') {
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
    const result = JSON.parse(cleanJsonString(text)) as TeacherLessonPlan;

    return result;

  } catch (e) {
    console.error("Teacher Lesson Gen Error:", e);
    return null;
  }
};

/**
 * Generates visual assets (images/infographics) for lesson plan using DALL-E 3
 *
 * @param lessonPlan - The generated TeacherLessonPlan with image prompts
 * @returns Updated lesson plan with generated image URLs
 */
export const generateLessonVisuals = async (lessonPlan: TeacherLessonPlan): Promise<TeacherLessonPlan> => {
  console.log("🎨 Starting AI image generation for lesson plan...");

  const updatedPlan = { ...lessonPlan };
  const imagePromises: Promise<void>[] = [];

  // Helper function to generate a single image
  const generateImage = async (prompt: string): Promise<string | null> => {
    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        size: "1024x1024",
        quality: "standard",
        n: 1,
        response_format: "b64_json"
      });

      if (response.data[0].b64_json) {
        // Convert base64 to data URL
        return `data:image/png;base64,${response.data[0].b64_json}`;
      }
      return null;
    } catch (error) {
      console.error("Image generation failed for prompt:", prompt, error);
      return null;
    }
  };

  // 1. Generate Hook Image
  if (updatedPlan.hook.media_asset?.type === 'ai_generated_image' && updatedPlan.hook.media_asset.prompt) {
    imagePromises.push(
      generateImage(updatedPlan.hook.media_asset.prompt).then(url => {
        if (url && updatedPlan.hook.media_asset) {
          updatedPlan.hook.media_asset.url = url;
          updatedPlan.hook.media_asset.status = 'generated';
        } else if (updatedPlan.hook.media_asset) {
          updatedPlan.hook.media_asset.status = 'failed';
        }
      })
    );
  }

  // 2. Generate Direct Instruction Slide Images
  updatedPlan.direct_instruction.slides.forEach((slide, index) => {
    if (slide.media_asset?.type === 'ai_generated_image' && slide.media_asset.prompt) {
      imagePromises.push(
        generateImage(slide.media_asset.prompt).then(url => {
          if (url && updatedPlan.direct_instruction.slides[index].media_asset) {
            updatedPlan.direct_instruction.slides[index].media_asset!.url = url;
            updatedPlan.direct_instruction.slides[index].media_asset!.status = 'generated';
          } else if (updatedPlan.direct_instruction.slides[index].media_asset) {
            updatedPlan.direct_instruction.slides[index].media_asset!.status = 'failed';
          }
        })
      );
    }
  });

  // 3. Generate Summary Visual
  if (updatedPlan.summary.visual_summary?.type === 'infographic' && updatedPlan.summary.visual_summary.prompt) {
    imagePromises.push(
      generateImage(updatedPlan.summary.visual_summary.prompt).then(url => {
        if (url && updatedPlan.summary.visual_summary) {
          updatedPlan.summary.visual_summary.url = url;
          updatedPlan.summary.visual_summary.status = 'generated';
        } else if (updatedPlan.summary.visual_summary) {
          updatedPlan.summary.visual_summary.status = 'failed';
        }
      })
    );
  }

  // Wait for all images to generate (in parallel)
  await Promise.all(imagePromises);

  const successCount = imagePromises.length - imagePromises.filter((_, i) =>
    updatedPlan.hook.media_asset?.status === 'failed'
  ).length;

  console.log(`✅ Generated ${successCount}/${imagePromises.length} images successfully`);

  return updatedPlan;
};

/**
 * Automatically generates interactive activity blocks based on AI suggestions
 *
 * @param suggestedTypes - Array of block types suggested by AI (e.g., ['multiple-choice', 'memory_game'])
 * @param sourceText - The lesson content to base activities on
 * @param topic - The lesson topic
 * @param gradeLevel - Target grade level
 * @returns Array of generated ActivityBlocks
 */
export const generateInteractiveBlocks = async (
  suggestedTypes: string[],
  sourceText: string,
  topic: string,
  gradeLevel: string
): Promise<any[]> => {
  console.log(`🎮 Auto-generating ${suggestedTypes.length} interactive blocks...`);

  const promises = suggestedTypes.map(async (blockType) => {
    try {
      // Build specific prompt based on block type
      let prompt = '';

      switch (blockType) {
        case 'multiple-choice':
          prompt = `
            Create a multiple-choice question based on this content.
            Topic: ${topic}
            Content: """${sourceText.substring(0, 2000)}"""
            Grade Level: ${gradeLevel}

            Requirements:
            - Question must test understanding (not just memory)
            - 4 options with only 1 correct answer
            - Distractors should be plausible but clearly wrong
            - Include brief explanation for correct answer

            Output JSON:
            {
              "question": "השאלה בעברית",
              "options": ["אופציה 1", "אופציה 2", "אופציה 3", "אופציה 4"],
              "correct_answer": "אופציה נכונה",
              "feedback_correct": "הסבר למה זו התשובה הנכונה",
              "feedback_incorrect": "הסבר מה לא נכון"
            }
          `;
          break;

        case 'memory_game':
          prompt = `
            Create a memory matching game with 6 pairs based on this content.
            Topic: ${topic}
            Content: """${sourceText.substring(0, 2000)}"""
            Grade Level: ${gradeLevel}

            Requirements:
            - 6 pairs of related terms (term-definition, concept-example, etc.)
            - Pairs must be clearly related but not identical
            - Use vocabulary appropriate for ${gradeLevel}

            Output JSON:
            {
              "pairs": [
                {"card_a": "מושג", "card_b": "הגדרה"},
                {"card_a": "מושג 2", "card_b": "הגדרה 2"}
              ]
            }
          `;
          break;

        case 'fill_in_blanks':
          prompt = `
            Create a fill-in-the-blanks exercise based on this content.
            Topic: ${topic}
            Content: """${sourceText.substring(0, 2000)}"""
            Grade Level: ${gradeLevel}

            Requirements:
            - Create a paragraph (40-60 words) summarizing key concepts
            - Hide 3-5 key terms using [brackets]
            - Context should make hidden words guessable

            Output JSON:
            {
              "text": "טקסט עם [מילה1] חסרה ו[מילה2] נוספת."
            }
          `;
          break;

        case 'ordering':
          prompt = `
            Create a sequencing/ordering activity based on this content.
            Topic: ${topic}
            Content: """${sourceText.substring(0, 2000)}"""
            Grade Level: ${gradeLevel}

            Requirements:
            - 4-6 items in a logical sequence (chronological, process steps, etc.)
            - Each item should be a short phrase (5-10 words)
            - Sequence must be objectively correct (not opinion-based)

            Output JSON:
            {
              "instruction": "סדרו את השלבים לפי הסדר הנכון:",
              "correct_order": ["שלב 1", "שלב 2", "שלב 3", "שלב 4"]
            }
          `;
          break;

        case 'categorization':
          prompt = `
            Create a categorization activity based on this content.
            Topic: ${topic}
            Content: """${sourceText.substring(0, 2000)}"""
            Grade Level: ${gradeLevel}

            Requirements:
            - 2-3 clear, mutually exclusive categories
            - 6-8 items to categorize
            - Categories must be clearly defined

            Output JSON:
            {
              "question": "מיינו את הפריטים הבאים לקטגוריות:",
              "categories": ["קטגוריה 1", "קטגוריה 2"],
              "items": [
                {"text": "פריט 1", "category": "קטגוריה 1"},
                {"text": "פריט 2", "category": "קטגוריה 2"}
              ]
            }
          `;
          break;

        case 'open-question':
          prompt = `
            Create an open-ended question based on this content.
            Topic: ${topic}
            Content: """${sourceText.substring(0, 2000)}"""
            Grade Level: ${gradeLevel}

            Requirements:
            - Question should encourage critical thinking or application
            - Provide a model answer (3-4 sentences)
            - Include teacher guidelines for assessment

            Output JSON:
            {
              "question": "שאלה פתוחה בעברית",
              "model_answer": "תשובה לדוגמה עם 3-4 משפטים",
              "teacher_guidelines": "🎯 מה לחפש: [מושגי מפתח]\\n❌ טעויות נפוצות: [דוגמאות]\\n❓ שאלות המשך: 1) ... 2) ..."
            }
          `;
          break;

        case 'drag_and_drop':
          prompt = `
            Create a drag-and-drop activity based on this content.
            Topic: ${topic}
            Content: """${sourceText.substring(0, 2000)}"""
            Grade Level: ${gradeLevel}

            Requirements:
            - 3-4 drop zones (target areas)
            - 6-8 draggable items
            - Each item belongs to exactly one zone
            - Clear visual/conceptual distinction between zones

            Output JSON:
            {
              "instruction": "גררו כל פריט לאזור הנכון:",
              "zones": [
                {"id": "zone1", "label": "אזור 1", "color": "#E0F2FE"},
                {"id": "zone2", "label": "אזור 2", "color": "#FEF3C7"}
              ],
              "items": [
                {"id": "item1", "text": "פריט 1", "correctZone": "zone1"},
                {"id": "item2", "text": "פריט 2", "correctZone": "zone2"}
              ],
              "feedback_correct": "כל הפריטים במקום הנכון!",
              "feedback_incorrect": "בדקו שוב את הפריטים המסומנים באדום"
            }
          `;
          break;

        case 'hotspot':
          prompt = `
            Create a hotspot (clickable image areas) activity based on this content.
            Topic: ${topic}
            Content: """${sourceText.substring(0, 2000)}"""
            Grade Level: ${gradeLevel}

            Requirements:
            - Suggest an image URL or description for the base image
            - 3-5 clickable areas with coordinates (x, y, width, height as percentages)
            - Each hotspot reveals educational information
            - Clear instructions for students

            Output JSON:
            {
              "instruction": "לחצו על החלקים השונים בתמונה כדי ללמוד עליהם:",
              "image_description": "תיאור התמונה הנדרשת (לדוגמה: דיאגרמה של מחזור המים)",
              "image_prompt": "Educational diagram of [topic] with labeled parts, clean illustration style, suitable for grade ${gradeLevel}",
              "hotspots": [
                {
                  "id": "spot1",
                  "label": "חלק 1",
                  "x": 20,
                  "y": 30,
                  "width": 15,
                  "height": 15,
                  "feedback": "הסבר על חלק זה בתמונה (2-3 משפטים)"
                },
                {
                  "id": "spot2",
                  "label": "חלק 2",
                  "x": 60,
                  "y": 40,
                  "width": 15,
                  "height": 15,
                  "feedback": "הסבר על חלק זה"
                }
              ]
            }
          `;
          break;

        default:
          console.warn(`Unknown block type: ${blockType}, skipping`);
          return null;
      }

      // Call OpenAI to generate the block content
      const response = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7
      });

      const rawContent = JSON.parse(cleanJsonString(response.choices[0].message.content || "{}"));

      // Map to ActivityBlock structure
      const block = {
        id: uuidv4(),
        type: blockType,
        content: rawContent,
        metadata: {
          bloomLevel: blockType === 'open-question' ? 'evaluate' : 'apply',
          score: blockType === 'open-question' ? 10 : 5,
          autoGenerated: true
        }
      };

      return block;

    } catch (error) {
      console.error(`Failed to generate ${blockType}:`, error);
      return null;
    }
  });

  const results = await Promise.all(promises);
  const validBlocks = results.filter(b => b !== null);

  console.log(`✅ Generated ${validBlocks.length}/${suggestedTypes.length} interactive blocks`);

  return validBlocks;
};

/**
 * Regenerates a single image based on a new or edited prompt
 *
 * @param prompt - The DALL-E 3 prompt for the image
 * @returns Base64 data URL of the generated image, or null on failure
 */
export const regenerateImage = async (prompt: string): Promise<string | null> => {
  console.log(`🎨 Regenerating image with prompt: "${prompt.substring(0, 50)}..."`);

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: "1024x1024",
      quality: "standard",
      n: 1,
      response_format: "b64_json"
    });

    if (response.data && response.data[0]?.b64_json) {
      const imageUrl = `data:image/png;base64,${response.data[0].b64_json}`;
      console.log("✅ Image regenerated successfully");
      return imageUrl;
    }

    console.error("❌ Image generation returned no data");
    return null;

  } catch (error) {
    console.error("❌ Image regeneration failed:", error);
    return null;
  }
};


import type { DialogueScript } from './shared/types/gemini.types';

/**
 * Generates a "Deep Dive" Podcast Script (Dan & Noa)
 */
export const generatePodcastScript = async (sourceText: string, topic?: string): Promise<DialogueScript | null> => {
  try {
    const prompt = `
      generate a "Deep Dive" podcast script between two hosts, Dan and Noa.
      Topic: ${topic || "The provided text"}
      Source Material: """${sourceText.substring(0, 15000)}"""
      
      Characters:
      - Dan: Enthusiastic, uses analogies, asks the "dumb" questions to clarify things.
      - Noa: The expert, skeptical but clear, brings the data.
      
      Format: JSON matching:
      {
        "title": "Fun Title",
        "lines": [
          { "speaker": "Dan", "text": "...", "emotion": "Excited" },
          { "speaker": "Noa", "text": "...", "emotion": "Neutral" }
        ]
      }
      
      Language: Hebrew.
      Length: Approx 10-15 exchanges.
      Style: Conversational, fun, like "NotebookLM".
      `;

    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const text = completion.choices[0].message.content || "{}";
    return JSON.parse(text) as DialogueScript;

  } catch (e) {
    console.error("Podcast Gen Error:", e);
    return null;
  }
};

// --- PHASE 2 IMPL: Pedagogical Validation ---

export const validateContent = async (
  lessonJson: any,
  targetAudience: string
): Promise<ValidationResult> => {
  // console.log("🔍 Validating content for:", targetAudience);

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
  // console.log("🔧 Attempting Auto-Fix...", validationResult.issues);

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
    // console.log(`🔒 Validation Loop: Attempt ${attempts + 1}/${maxRetries + 1}`);

    // 1. Validate
    const validation = await validateContent(content, targetAudience);
    // console.log("📊 Validation Status:", validation.status);

    if (validation.status === 'PASS') {
      // console.log("✅ Content Passed Validation!");
      // PERSIST VALIDATION METRICS
      if (content && typeof content === 'object') {
        if (!content.metadata) content.metadata = {};
        content.metadata.aiValidation = validation.metrics;
      }
      return content;
    }

    // 2. Reject -> Attempt Fix
    console.warn("⚠️ Content Rejected. Issues:", validation.issues);

    if (attempts < maxRetries) {
      // console.log("🛠️ Attempting Auto-Fix...");
      content = await attemptAutoFix(content, validation);
    } else {
      console.error("❌ Max Retries Reached. Content Generation Failed.");
      throw new Error("Pedagogical Validation Failed: Content could not be auto-corrected to meet standards.");
    }

    attempts++;
  }
};

/**
 * Generates the High-Level Structure (Syllabus) ONLY.
 * Used for "Progressive Skeleton" loading (Lesson Plan Mode).
 */
export const generateCourseSyllabus = async (
  topic: string,
  gradeLevel: string,
  activityLength: 'short' | 'medium' | 'long' = 'medium',
  subject: string = 'General',
  sourceText?: string,
  productType: 'lesson' | 'game' | 'exam' = 'game' // Default to game for backward compatibility
): Promise<any[]> => {
  // console.log("🏗️ Generating Syllabus Structure (Skeleton)...");

  // FORCE SINGLE UNIT FOR TEACHER LESSON PLAN
  const unitCount = productType === 'lesson'
    ? 1
    : (activityLength === 'short' ? 3 : (activityLength === 'long' ? 8 : 5));

  const prompt = `
      Task: Create a Syllabus (Table of Contents) for a Lesson Plan.
      Topic: "${topic}"
      Subject: ${subject}
      Target Audience: ${gradeLevel}
      Count: Exactly ${unitCount} distinct Learning Units.
      Language: Hebrew.

      ${sourceText ? `Base strict on source text found in context (first 10k chars).` : ''}

      Structure:
      - Divide the topic into logical "Phases" or "Modules".
      - Each Module contains 1-2 Learning Units.
      - Total Learning Units: ${unitCount}.

      Output JSON:
      {
        "modules": [
          {
            "title": "Module Title (e.g., 'Phase 1: Introduction')",
            "units": [
              { "title": "Unit Title (e.g., 'Core Concepts')" }
            ]
          }
        ]
      }
    `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Strong model for structure
      messages: [
        { role: "system", content: "You are a Curriculum Architect. Output strict JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const text = completion.choices[0].message.content || "{}";
    const result = JSON.parse(cleanJsonString(text));

    // Map to internal Module[] structure
    return (result.modules || []).map((m: any) => ({
      id: uuidv4(),
      title: m.title,
      learningUnits: (m.units || []).map((u: any) => ({
        id: uuidv4(),
        title: u.title,
        type: 'practice',
        activityBlocks: [], // EMPTY INITIALLY
        metadata: { status: 'pending' } // Ready for queue
      }))
    }));

  } catch (e) {
    console.error("Syllabus Gen Error:", e);
    // Fallback: Single Module, Single Unit
    return [{
      id: uuidv4(),
      title: "מערך השיעור",
      learningUnits: [{
        id: uuidv4(),
        title: topic,
        type: 'practice',
        activityBlocks: [],
        metadata: { status: 'pending' }
      }]
    }];
  }
};

// --- פונקציה 1: יצירת סילבוס (גרסת ענן - Firestore Queue) ---
export const generateCoursePlan = async (
  topic: string,
  gradeLevel: string,
  fileData?: { base64: string; mimeType: string },
  subject: string = "כללי",
  sourceText?: string, // טקסט שחולץ (PDF/Doc)
  includeBot: boolean = true, // האם לכלול בוט
  productType?: string, // 🆕 Product Type (lesson/exam/game/podcast)
  activityLength?: string, // 🆕 Activity Length
  taxonomy?: any // 🆕 Taxonomy settings
) => {
  // console.log("Starting cloud generation for:", topic);

  // קבלת ה-DB
  const db = getFirestore(getApp());

  try {
    // 🆕 CRITICAL: Route to correct queue based on product type
    const queuePath = productType === 'exam'
      ? "exam_generation_queue"       // ✨ NEW: Dedicated exam queue
      : "course_generation_queue";     // Existing learning/game queue

    console.log(`📤 Routing to queue: ${queuePath} (productType: ${productType})`);

    // 1. יצירת מסמך בקשה בתור
    const docRef = await addDoc(collection(db, queuePath), {
      topic,
      gradeLevel,
      subject,
      fileData: fileData || null,
      sourceText: sourceText || null,
      activityLength: activityLength || 'medium', // 🆕
      taxonomy: taxonomy || null, // 🆕
      productType: productType || null, // 🆕
      status: "pending",
      createdAt: new Date(),
    });

    // console.log("Request queued with ID:", docRef.id);

    // 2. האזנה לשינויים במסמך
    return new Promise<any[]>((resolve, reject) => {
      const unsubscribe = onSnapshot(doc(db, queuePath, docRef.id), (snapshot) => {
        const data = snapshot.data();

        if (!data) return;

        // console.log("Generation status:", data.status);

        if (data.status === "completed" && data.result) {
          unsubscribe();

          // --- CLIENT-SIDE PROCESSING ---
          // console.log("!!! PROCESSING RESULTS CLIENT SIDE !!!", { includeBot, blocksRaw: data.result.length });
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
        // console.log("🚀 Parsing Strategy: Dynamic Learning Unit (Robust)");

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
  # ROLE
  ${mode === 'exam' ? "You are a Strict Examiner." : "You are a supportive tutor checking a student's answer based on a text."}
  ${mode === 'exam' ? "Provide objective feedback based strictly on the Model Answer." : "DO NOT GIVE THE ANSWER. GUIDE THE STUDENT TO IT."}
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

// --- PODCAST FOLLOW-UP GENERATORS (Single Block) ---

export const generateSingleMultipleChoiceQuestion = async (
  _topic: string,
  gradeLevel: string,
  _taxonomy: any,
  sourceText: string
): Promise<any | null> => {
  const prompt = `
    Based on the following text (Podcast Script), create a single Multiple Choice Question.
    
    TEXT:
    """${sourceText.substring(0, 5000)}"""

    Target Audience: ${gradeLevel}.
    Language: Hebrew.
    
    Goal: Test understanding of the core message.
    
    OUTPUT JSON:
    {
      "question": "The question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A"
    }
  `;

  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });
    const parsed = JSON.parse(res.choices[0].message.content || "{}");

    if (!parsed.question || !parsed.options || !parsed.correct_answer) return null;

    return {
      id: uuidv4(),
      type: 'multiple-choice',
      content: {
        question: parsed.question,
        options: parsed.options,
        correctAnswer: parsed.correct_answer
      },
      metadata: {
        score: 10,
        difficulty: 1
      }
    };
  } catch (e) {
    console.error("Single MCQ Gen Error:", e);
    return null;
  }
};

export const generateSingleOpenQuestion = async (
  _topic: string,
  gradeLevel: string,
  _taxonomy: any,
  sourceText: string
): Promise<any | null> => {
  const prompt = `
    Based on the following text (Podcast Script), create a single Open-Ended Question.
    
    TEXT:
    """${sourceText.substring(0, 5000)}"""

    Target Audience: ${gradeLevel}.
    Language: Hebrew.
    
    Goal: Encourage deep thinking or opinion.
    
    OUTPUT JSON:
    {
      "question": "The open question text",
      "model_answer": "A model answer or key points to look for."
    }
  `;

  try {
    const res = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });
    const parsed = JSON.parse(res.choices[0].message.content || "{}");

    if (!parsed.question) return null;

    return {
      id: uuidv4(),
      type: 'open-question',
      content: {
        question: parsed.question
      },
      metadata: {
        score: 20,
        modelAnswer: parsed.model_answer || "תשובה פתוחה לשיקול דעת המורה."
      }
    };
  } catch (e) {
    console.error("Single Open Gen Error:", e);
    return null;
  }
};

// --- פונקציה חדשה: חידוד תוכן (Refine) עבור כל סוגי הבלוקים (Universal Refine) ---
export const refineBlockContent = async (
  blockType: string,
  content: any,
  instruction: string
): Promise<any> => {
  console.log(`✨ Refining ${blockType} with instruction: "${instruction}"`);

  const prompt = `
    You are an expert Pedagogical Editor and Content Developer.
    Your Task: Refine the provided JSON content based on the User's Instruction.

    Block Type: ${blockType}
    User Instruction: "${instruction}"

    Current Content (JSON):
    ${JSON.stringify(content, null, 2)}

    RULES:
    1.  **Strict Schema Preservation:** Return JSON that EXACTLY matches the structure of the input content. Do NOT change key names.
    2.  **Pedagogical Quality:** Ensure the refined content is educational, clear, and engaging.
    3.  **Language:** Hebrew (unless instruction specifies otherwise).
    4.  **No Markdown:** Return pure JSON.
    5.  **Fallback:** If the instruction is impossible for this structure, return the original content unchanged but try your best to adapt.

    Output the REFINED JSON ONLY.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const text = completion.choices[0].message.content || "{}";
    const result = JSON.parse(text);

    // Basic validation: Check if empty
    if (Object.keys(result).length === 0) {
      console.warn("Refine returned empty JSON");
      return content;
    }

    return result;

  } catch (e) {
    console.error("Refine Block Error:", e);
    return content; // Return original on error to prevent data loss
  }
};
// --- Differentiated Instruction Generation (V5) ---

export const generateDifferentiatedContent = async (
  topic: string,
  gradeLevel: string,
  sourceText: string,
  subject: string = "כללי"
): Promise<{
  support: any[];
  core: any[];
  enrichment: any[];
} | null> => {
  try {
    const sysPrompt = `
        You are an expert curriculum developer specializing in Differentiated Instruction (Bloom's Taxonomy).
        Your goal is to generate 3 DISTINCT sets of learning activities based on the provided source text.
        
        The 3 levels are:
        1. Level 1: Support (Knowledge & Comprehension). Focus on basics, vocabulary, and simple recall.
        2. Level 2: Core (Application & Analysis). Focus on standard grade-level tasks, applying concepts.
        3. Level 3: Enrichment (Evaluation & Synthesis). Focus on critical thinking, creative projects, and deep analysis.

        OUTPUT FORMAT:
        You must return a single JSON object with exactly these 3 keys:
        {
            "level_1_support": [ Array of 4-5 Activity Objects ],
            "level_2_core": [ Array of 4-5 Activity Objects ],
            "level_3_enrichment": [ Array of 4-5 Activity Objects ]
        }

        Each "Activity Object" must follow the standard schema used in this system:
        {
            "type": "multiple_choice" | "open_question" | "flashcards" | "sorting",
            "question": "...",
            "options": [...], // for multiple choice
            "correct_answer": "...",
            "explanation": "...", // explanation for feedback
            "bloom_level": "knowledge" | "application" | "evaluation"
        }

        STRICT RULES:
        1. "level_1_support" must use simple language and scaffolding. 
        2. "level_3_enrichment" must be challenging.
        3. All content must be in HEBREW.
        4. Return ONLY valid JSON.
        `;

    const userPrompt = `
        Topic: ${topic}
        Grade: ${gradeLevel}
        Subject: ${subject}
        Source Material:
        """${sourceText.slice(0, 15000)}"""
        
        Generate the 3 levels now.
        `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Use a smart model for this complex task
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    const parsed = JSON.parse(content);

    return {
      support: parsed.level_1_support || [],
      core: parsed.level_2_core || [],
      enrichment: parsed.level_3_enrichment || []
    };

  } catch (error) {
    console.error("Error generating differentiated content:", error);
    return null;
  }
};
