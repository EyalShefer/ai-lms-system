
// src/services/ai/prompts.ts

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

export const generatePedagogicalPrompt = (personaId: string) => {
  const persona = BOT_PERSONAS[personaId as keyof typeof BOT_PERSONAS] || BOT_PERSONAS.socratic;
  return `SYSTEM: ${persona.systemPrompt}\nROLE: ${persona.name}`;
};

export const getSkeletonPrompt = (
  contextPart: string,
  gradeLevel: string,
  personalityInstruction: string,
  mode: string,
  productType: string,
  stepCount: number,
  bloomSteps: string[],
  structureGuide: string,
  learningLevel?: string // Optional: 'הבנה' | 'יישום' | 'העמקה' for differentiated content
) => {
  // Learning level constraints for differentiated content
  const learningLevelConstraint = learningLevel ? `
    **DIFFERENTIATED LEARNING LEVEL: ${learningLevel}**
    ${learningLevel === 'הבנה' ? `
    - Target: SUPPORT level (struggling students)
    - Bloom Levels: Focus on Remember and Understand ONLY
    - Language: Use SIMPLE vocabulary, shorter sentences
    - Scaffolding: Include MORE hints, built-in support
    - Complexity: Avoid distractors that are too similar, make distinctions clear
    - Questions: Basic recall and comprehension only
    ` : learningLevel === 'יישום' ? `
    - Target: CORE level (average students)
    - Bloom Levels: Focus on Apply and Analyze
    - Language: Grade-appropriate vocabulary
    - Scaffolding: Standard hints (2-3 per question)
    - Complexity: Moderate challenge, fair distractors
    - Questions: Application and analysis required
    ` : `
    - Target: ENRICHMENT level (advanced students)
    - Bloom Levels: Focus on Evaluate and Create
    - Language: Can use more academic/complex vocabulary
    - Scaffolding: Minimal hints (encourage independent thinking)
    - Complexity: Challenging questions, require deep thinking
    - Questions: Open-ended, require justification and synthesis
    `}
    **CRITICAL:** ALL steps must include "learning_level": "${learningLevel}" in their output.
  ` : '';

  return `
    Task: Create a "Skeleton" for a learning unit.
    ${contextPart}
    Target Audience: ${gradeLevel}.
    ${personalityInstruction}
    Mode: ${mode === 'exam' || productType === 'exam' ? 'STRICT EXAMINATION / TEST MODE' : (productType === 'game' ? 'GAMIFICATION / PLAY MODE' : 'Learning/Tutorial Mode')}
    Count: Exactly ${stepCount} steps.
    Language: Hebrew.
    ${learningLevelConstraint}

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

    9. **INTERACTION DIVERSITY RULE (CRITICAL - NO REPETITION):**
       - You MUST vary the interaction types across steps. NEVER use the same type twice in a row.
       - **Available Types by Bloom Level:**
         * Remember: memory_game, multiple_choice, true_false, fill_in_blank, matching, highlight
         * Understand: multiple_choice, fill_in_blank, matching, sentence_builder, highlight, matrix
         * Apply: categorization, ordering, fill_in_blank, sentence_builder, table_completion, image_labeling
         * Analyze: categorization, ordering, open_question, text_selection, table_completion
         * Evaluate/Create: open_question, rating_scale, text_selection
       - **Diversity Algorithm:** If Step N uses "multiple_choice", Step N+1 MUST use a DIFFERENT type.
       - **Distribution Target:** For ${stepCount} steps, aim for at least 3 different interaction types.

    10. **CONTEXT IMAGE (ACTIVITY OPENING) - EXTRACT FROM SOURCE TEXT:**
       Generate a "context_image_prompt" for an opening illustration.

       **CRITICAL PROCESS:**
       1. READ the source text carefully
       2. IDENTIFY the main topic/subject matter (what is this text actually about?)
       3. CREATE an image prompt that shows a REAL-WORLD SCENE directly related to THAT topic

       **Guidelines:**
       - The image must visually represent the ACTUAL content of the source text
       - Show people engaged in activities related to the topic
       - Include relevant objects, tools, or environment from the topic
       - NO text in the image, NO Hebrew characters
       - Style: Semi-realistic educational illustration, warm colors
       - Age-appropriate for ${gradeLevel}
       - Write the prompt in English (2-3 sentences)

       **DO NOT use generic "scientist with microscope" or "student reading" images!**
       The image must be SPECIFIC to whatever the source text discusses.

    Output JSON Structure:
    {
      "unit_title": "String",
      "context_image_prompt": "English description for AI image generation (2-3 sentences, professional scenario related to the topic)",
      "steps": [
        {
          "step_number": 1,
          "title": "Unique Title for Chunk A",
          "narrative_focus": "${mode === 'exam' ? 'Assessment Topic A' : 'Discuss ONLY [Specific Concept A]'} . Do not mention [Concept B].",
          "forbidden_topics": ["Concept B", "Concept C", "Future Events"],
          "bloom_level": "Remember",
          "suggested_interaction_type": "memory_game"
        },
        {
          "step_number": 2,
          "title": "Unique Title for Chunk B",
          "narrative_focus": "...",
          "forbidden_topics": ["..."],
          "bloom_level": "Understand",
          "suggested_interaction_type": "fill_in_blank"
        },
        {
          "step_number": 3,
          "title": "Unique Title for Chunk C",
          "narrative_focus": "...",
          "forbidden_topics": ["..."],
          "bloom_level": "Apply",
          "suggested_interaction_type": "categorization"
        }
      ]
    }

    **IMPORTANT:** The example above shows DIFFERENT interaction types for each step. Follow this pattern!
  `;
};

/**
 * Generate step content prompt based on product type
 *
 * @param productType - Determines content style:
 *   - 'activity': Student-facing interactive content. NO teach_content, NO infographics.
 *                 Only scenario_image for dilemmas/real-world problems.
 *   - 'lesson': Teacher lesson plan. REQUIRES teach_content, allows infographics.
 *   - 'exam': Assessment mode. NO teach_content, NO hints, NO media.
 */
export const getStepContentPrompt = (
  contextText: string,
  examEnforcer: string,
  stepInfo: any,
  mode: string,
  linguisticConstraints: string,
  gradeLevel: string,
  productType: string = 'lesson', // activity | lesson | exam
  contentTone: string = 'friendly', // friendly | professional | playful | neutral
  learningLevel?: string // Optional: 'הבנה' | 'יישום' | 'העמקה' for differentiated content
) => {
  // Build tone instruction based on contentTone
  const toneInstructions: Record<string, string> = {
    friendly: 'חם, ידידותי ומעודד. פנה ישירות לתלמיד בלשון יחיד. השתמש בשפה פשוטה ונגישה.',
    professional: 'מקצועי וממוקד. ישיר וללא הקדמות מיותרות. עניני.',
    playful: 'משחקי וקליל. ניתן להשתמש בהומור קל, להפוך את הלמידה לחוויה מהנה.',
    neutral: 'ניטרלי וישיר. ללא סגנון מיוחד, פשוט ותכליתי.'
  };
  const toneInstruction = toneInstructions[contentTone] || toneInstructions.friendly;

  // Learning level constraint for differentiated content
  const learningLevelConstraint = learningLevel ? `
    **DIFFERENTIATED LEARNING LEVEL: ${learningLevel}**
    - You MUST set "learning_level": "${learningLevel}" in the output JSON.
    ${learningLevel === 'הבנה' ? `
    - Use SIMPLE language and vocabulary
    - Include extra scaffolding and hints
    - Questions should focus on basic recall and understanding
    - Avoid complex distractors
    ` : learningLevel === 'יישום' ? `
    - Use grade-appropriate language
    - Standard scaffolding (2-3 hints)
    - Questions require application and analysis
    ` : `
    - Can use more academic vocabulary
    - Minimal scaffolding (encourage independent thinking)
    - Questions should require synthesis, evaluation, and justification
    - Include open-ended components where appropriate
    `}
  ` : '';

  return `
    ${contextText}
    ${examEnforcer}
    ${learningLevelConstraint}

    **TARGET AUDIENCE: ${gradeLevel}**

    MANDATORY REQUIREMENTS:

    1. **LANGUAGE ADAPTATION (CRITICAL - HARD CONSTRAINT):**
    ${linguisticConstraints}

    2. **Pedagogy:** Strictly follow the Bloom Level (${stepInfo.bloom_level}) and Interaction Type (${stepInfo.suggested_interaction_type}).

    3. **ZERO-TEXT-WALL RULE (V4 Anti-Batching):**
       - **CRITICAL:** You must NEVER output two distinct text chunks consecutively without a question.
       - **Focus:** Discuss ONLY: ${stepInfo.narrative_focus || "current step's topic"}.
       - **BAN:** Do NOT mention: ${JSON.stringify(stepInfo.forbidden_topics || [])}.
       ${mode === 'exam' || productType === 'exam'
    ? `- **EXAM MODE:** Do NOT output 'teach_content'. Set it to null or empty string. Focus entirely on the Question.`
    : productType === 'activity'
    ? `- **STUDENT ACTIVITY MODE:** Do NOT output 'teach_content'. Set it to null or empty string. The activity should be 100% interactive - questions only, no explanatory text blocks.`
    : `- **LESSON MODE:** The 'teach_content' field is REQUIRED. Provide clear explanations before each question.`
  }

       - **Tone Override:** ${mode === 'exam' || productType === 'exam' ? 'Objective, Examiner Tone (No Humor)' : toneInstruction}.

  4. ** STRICT GROUNDING(Anti - Hallucination V3):**
       - ** Rule:** Use ONLY the provided Source Text.If it's not in the PDF, it doesn't exist.

    5. ** Micro - Learning Progression:**
    - Treat this step as "Chapter ${stepInfo.step_number}". Do not repeat definitions from previous chapters.
      ${mode === 'exam' ? '- **EXAM MODE:** TONE must be objective, examiner tone. No "Wizdi-Bot" persona.' : ''}

    **HEBREW WRITING QUALITY RULES (CRITICAL):**
    - **Word Order:** Follow natural Hebrew word order. Subject first, then verb, then object.
      * WRONG: "נחשב ט״ו בשבט הוא יום מיוחד" (starts with predicate)
      * CORRECT: "ט״ו בשבט נחשב ליום מיוחד" OR "ט״ו בשבט הוא יום מיוחד"
    - **No Dangling Subjects:** The subject of the sentence must be clear from the start.
      * WRONG: "נחשב הספר הזה לחשוב"
      * CORRECT: "הספר הזה נחשב לחשוב"
    - **Avoid Passive Ambiguity:** When using passive voice, ensure the sentence flows naturally.
    - **Opening Sentences:** NEVER start an explanation with a predicate or adjective. Start with the topic itself.
      * WRONG: "נחשב לאחד מהחגים החשובים ביותר..."
      * CORRECT: "ט״ו בשבט הוא אחד מהחגים החשובים ביותר..."
    - **Proofread for Flow:** Read each sentence aloud (mentally). If it sounds awkward, rewrite it.

    **TEXT FORMATTING RULES (CRITICAL - NO MARKDOWN):**
    - **FORBIDDEN:** Do NOT use asterisks (*) for any formatting purpose.
    - **FORBIDDEN:** Do NOT use markdown syntax like **bold**, *italic*, or bullet points with *.
    - **For lists:** Use numbered lists (1. 2. 3.) or write as flowing prose.
    - **For emphasis:** Write naturally without special characters. The UI will handle formatting.
    - **For model_answer:** Write clear sentences or numbered points, NOT bullet points with asterisks.
      * WRONG: "* נקודה ראשונה * נקודה שנייה * נקודה שלישית"
      * CORRECT: "1. נקודה ראשונה 2. נקודה שנייה 3. נקודה שלישית"
      * ALSO CORRECT: "התשובה צריכה לכלול: נקודה ראשונה, נקודה שנייה, ונקודה שלישית."
    - **Output plain text only** - no HTML tags, no markdown, just clean Hebrew text.

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

    9. **MEDIA SUGGESTION GUIDELINES (IMAGE/INFOGRAPHIC DECISION):**
       ${productType === 'exam' || mode === 'exam'
    ? `**EXAM MODE:** Do NOT suggest any media. Always return: "suggested_media": { "needed": false }`
    : productType === 'activity'
    ? `**STUDENT ACTIVITY MODE - SCENARIO IMAGES ONLY:**
       - ONLY suggest "scenario_image" for questions that present real-world dilemmas/problems
       - Do NOT suggest "infographic" - infographics are for lesson plans only!
       - Add scenario_image when:
         * Bloom Level is Application, Analysis, Evaluation, or Creation
         * The question presents a decision-making situation
         * Visualization would help students understand the problem BEFORE answering

       **DO NOT add any image for:**
       - "categorization" / "memory_game" / "ordering" / "fill_in_blanks" / "true_false"
       - Simple fact recall questions

       **If you suggest media (ONLY scenario_image for activities):**
       \`"suggested_media": {
          "needed": true,
          "type": "scenario_image",
          "prompt_hint": "Brief description of the scenario to visualize (in English, 2-3 sentences)"
       }\``
    : `**LESSON MODE - FULL MEDIA SUPPORT:**
       Decide whether this step would benefit from a generated image or infographic.

       **ADD scenario_image when:**
       - The question presents a real-world scenario, dilemma, or problem to solve
       - Visualization would help students understand the situation BEFORE answering

       **ADD infographic when:**
       - Content explains a PROCESS with clear steps → type: "flowchart"
       - Content describes HISTORICAL events or chronological sequence → type: "timeline"
       - Content COMPARES two or more concepts/options → type: "comparison"
       - Content describes a RECURRING/CYCLICAL process → type: "cycle"

       **If you suggest media, include in the JSON:**
       \`"suggested_media": {
          "needed": true,
          "type": "scenario_image" | "infographic",
          "infographic_type": "flowchart" | "timeline" | "comparison" | "cycle" (only if type is infographic),
          "prompt_hint": "Brief description of what the image/infographic should show (in English, 2-3 sentences)"
       }\``
  }

       **If no media is needed:**
       \`"suggested_media": { "needed": false }\`

    10. **LEARNING LEVEL (רמת למידה):**
       Based on the Bloom Level, assign the appropriate learning level:
       - Bloom "Remember" or "Understand" (זכירה/הבנה) → learning_level: "הבנה"
       - Bloom "Apply" or "Analyze" (יישום/ניתוח) → learning_level: "יישום"
       - Bloom "Evaluate" or "Create" (הערכה/יצירה) → learning_level: "העמקה"

    Output FORMAT (JSON ONLY):
    {
       "step_number": ${stepInfo.step_number},
       "bloom_level": "${stepInfo.bloom_level}",
       "learning_level": "הבנה" | "יישום" | "העמקה",
       "teach_content": ${(mode === 'exam' || productType === 'exam' || productType === 'activity') ? "null" : `"Full explanation text (Simplified for ${gradeLevel})..."`},
       "selected_interaction": "${stepInfo.suggested_interaction_type}",
       ${productType === 'exam' || mode === 'exam'
    ? `"suggested_media": { "needed": false },`
    : productType === 'activity'
    ? `"suggested_media": {
          "needed": true | false,
          "type": "scenario_image",
          "prompt_hint": "English description of the scenario (if needed=true)"
       },`
    : `"suggested_media": {
          "needed": true | false,
          "type": "scenario_image" | "infographic",
          "infographic_type": "flowchart" | "timeline" | "comparison" | "cycle",
          "prompt_hint": "English description of what to generate (if needed=true)"
       },`
  }
       "data": {
          "learning_level": "הבנה" | "יישום" | "העמקה",
          ${(mode === 'exam' || productType === 'exam') ? '"progressive_hints": [],' : '"progressive_hints": ["Hint 1", "Hint 2"],'}
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
          // {
          //   "question": "...",
          //   "model_answer": "...",
          //   "points": 10
          // }

          // 7. AUDIO RESPONSE (Simulated Oral Exam):
          // { "question": "Explain in your own words...", "max_duration": 60 }

          // === 8 NEW QUESTION TYPES ===

          // 8. MATCHING (מתיחת קו / התאמה):
          // {
          //   "instruction": "התאימו בין הפריטים...",
          //   "leftItems": [{ "id": "1", "text": "פריט 1" }, { "id": "2", "text": "פריט 2" }],
          //   "rightItems": [{ "id": "a", "text": "התאמה 1" }, { "id": "b", "text": "התאמה 2" }],
          //   "correctMatches": [{ "left": "1", "right": "a" }, { "left": "2", "right": "b" }]
          // }

          // 9. HIGHLIGHT (הקפה / סימון בטקסט):
          // {
          //   "instruction": "סמנו את המילים הנכונות...",
          //   "text": "הטקסט המלא עם המילים לסימון",
          //   "correctHighlights": [{ "start": 0, "end": 5, "text": "מילה" }],
          //   "highlightType": "background" | "circle" | "underline"
          // }

          // 10. SENTENCE_BUILDER (בניית משפט ממילים):
          // {
          //   "instruction": "סדרו את המילים למשפט תקין...",
          //   "words": ["היום", "יפה", "מאוד", "השמש"],
          //   "correctSentence": "השמש היום יפה מאוד"
          // }

          // 11. IMAGE_LABELING (תיוג תמונה):
          // {
          //   "instruction": "גררו את התוויות למקומות המתאימים...",
          //   "imageUrl": "https://...",
          //   "labels": [{ "id": "1", "text": "תווית 1" }],
          //   "dropZones": [{ "id": "zone1", "x": 50, "y": 100, "correctLabelId": "1" }]
          // }

          // 12. TABLE_COMPLETION (השלמת טבלה):
          // {
          //   "instruction": "השלימו את הטבלה...",
          //   "headers": ["עמודה 1", "עמודה 2"],
          //   "rows": [
          //     { "cells": [{ "value": "ערך", "editable": false }, { "value": "", "editable": true, "correctAnswer": "תשובה" }] }
          //   ]
          // }

          // 13. TEXT_SELECTION (בחירה מטקסט):
          // {
          //   "instruction": "בחרו את המילים המתאימות...",
          //   "text": "טקסט ארוך עם מילים לבחירה",
          //   "selectableUnits": "word" | "sentence" | "paragraph",
          //   "correctSelections": ["מילה1", "מילה2"],
          //   "minSelections": 1,
          //   "maxSelections": 3
          // }

          // 14. RATING_SCALE (סקאלת דירוג):
          // {
          //   "question": "דרגו את רמת ההסכמה שלכם...",
          //   "minValue": 1,
          //   "maxValue": 5,
          //   "minLabel": "לא מסכים כלל",
          //   "maxLabel": "מסכים מאוד",
          //   "correctAnswer": 4,  // Optional - for questions with correct answer
          //   "showNumbers": true
          // }

          // 15. MATRIX (מטריקס / טבלת שאלות):
          // {
          //   "instruction": "ענו על כל השאלות...",
          //   "columns": ["נכון", "לא נכון", "לא ניתן לדעת"],
          //   "rows": [
          //     { "question": "שאלה 1", "correctAnswer": "נכון" },
          //     { "question": "שאלה 2", "correctAnswer": "לא נכון" }
          //   ]
          // }
       }
    }
`;
};

export const getPodcastPrompt = (topic: string, sourceText: string) => `
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

export const getValidationPrompt = (targetAudience: string, lessonJson: any) => `
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

export const getTutorPrompt = (mode: string, sourceText: string, question: string, modelAnswer: string, userAnswer: string) => `
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

export const getRefinementPrompt = (content: string, instruction: string) => `
אתה עורך פדגוגי מומחה. עליך לשפר את התוכן החינוכי לפי ההוראה שתקבל.

## קלט - JSON מקורי:
${content}

## הוראת המשתמש:
${instruction}

## כללים קריטיים:
1. **שמור על מבנה ה-JSON בדיוק** - החזר את אותם שדות בדיוק כמו בקלט
2. **שנה רק את מה שההוראה מבקשת** - אל תשנה שדות אחרים
3. **שפת הפלט: עברית** (אלא אם ההוראה מבקשת אחרת)
4. **החזר JSON תקין בלבד** - ללא טקסט נוסף, ללא markdown

## הנחיות מיוחדות לשיפור פתיחות שיעור (HOOKS):

אם ההוראה מבקשת לשפר/לשנות פתיחה או "hook", אתה חייב ליצור פתיחה **יצירתית ומרתקת**.

**אסור בתכלית האיסור:**
- "שאלו את התלמידים מה הם יודעים על..."
- "התחילו בדיון פתוח"
- "הציגו את הנושא"
- "מי יכול לנחש?"
- "היום נלמד על..."
- כל פתיחה גנרית ומשעממת

**חובה להוסיף שדה hook_type ולבחור אחד מהסוגים הבאים:**

**"visual" - Visual Hook (תמונה/סרטון)**
- הצגת תמונה מפתיעה או סרטון קצר (30-60 שניות)
- דוגמה: "הציגו תמונה של [משהו מפתיע] ושאלו: 'מה קורה כאן? למה?'"

**"mystery" - Mystery/Riddle Hook (חידה/תעלומה)**
- חידה, תעלומה או שאלה מסקרנת
- דוגמה: "הנה עובדה מוזרה: [עובדה]. איך זה יכול להיות?"

**"game" - Quick Game/Challenge (משחקון מהיר)**
- משחק של 2-3 דקות או אתגר
- דוגמה: "משחק אסוציאציות: כתבו 3 מילים שקשורות ל[נושא] תוך 30 שניות"

**"provocation" - Provocation/Dilemma Hook (פרובוקציה/דילמה)**
- טענה מעוררת מחשבה או דילמה מוסרית
- דוגמה: "אני טוען ש[טענה מפתיעה]. מי מסכים? מי מתנגד?"

**"hands_on" - Hands-On Hook (חוויה מעשית)**
- פעילות מעשית קצרה או הדגמה
- דוגמה: "כל אחד מקבל [חומר]. יש לכם דקה ל[משימה]"

**"personal" - Personal Connection Hook (חיבור אישי)**
- חיבור לחיי התלמידים עם twist מפתיע
- דוגמה: "מי מכם [עשה משהו]? אתם יודעים ש[עובדה מפתיעה]?"

**מבנה ה-hook חייב לכלול:**
{
  "hook_type": "visual" | "mystery" | "game" | "provocation" | "hands_on" | "personal",
  "script_for_teacher": "תסריט מדויק למורה - מה בדיוק לומר/לעשות",
  ...
}

## פלט:
החזר את ה-JSON המשופר בלבד, ללא הסברים.
`;

export const getCategorizationPrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
    Create a detailed Categorization Activity.
  ${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
    Target Audience: ${gradeLevel}.
Language: Hebrew.

  Task: Sort items into 2 - 4 distinct categories.
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

export const getOrderingPrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
    Create an Ordering / Sequencing Activity.
  ${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
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

export const getFillInBlanksPrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
    Create a Fill -in -the - Blanks(Cloze) Text.
  ${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
    Target Audience: ${gradeLevel}.
Language: Hebrew.

  Task: Write a summary paragraph about "${topic}".
    Rules:
1. Use[brackets] to hide key concepts.
    2. MUST have at least 3 hidden words.
    3. Context MUST make the hidden word guessable.
    4. Text should be roughly 40 - 60 words.

    JSON Output Example:
{
  "text": "The capital of [France] is [Paris]."
}
`;

export const getMemoryGamePrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
    Create a Memory Game(Matching Pairs).
  ${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
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

export const getStudentAnalysisPrompt = (studentName: string, courseTopic: string, submissionData: string) => `
Role: Educational Data Analyst.
Task: Analyze student performance based on learning data.
Student: ${studentName}.
Topic: ${courseTopic}.

DATA:
${submissionData}

METRICS TO ANALYZE:
1. Time per Question: Calculate average time spent
2. Attempts: Count average attempts per question
3. Hints: Calculate hint usage rate
4. Mistakes: Identify specific topics or skills with repeated errors

OUTPUT FORMAT (JSON ONLY):
{
  "strengths": ["List 2-3 specific skills the student demonstrated well"],
  "weaknesses": ["List 2-3 specific topics that need more practice"],
  "recommendedFocus": "Specific topic or skill to practice next",
  "learningMetrics": {
    "averageTimePerQuestion": 0,
    "hintUsageRate": 0.0,
    "attemptsPerQuestion": 0,
    "completionRate": 0.0
  }
}
`;

export const getSingleMCQPrompt = (sourceText: string, gradeLevel: string) => `
    Based on the following text(Podcast Script), create a single Multiple Choice Question.

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

export const getSingleOpenQuestionPrompt = (sourceText: string, gradeLevel: string) => `
    Based on the following text(Podcast Script), create a single Open - Ended Question.

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

export const getClassAnalysisPrompt = (studentsJson: string) => `
Role: Senior Educational Consultant.
  Task: Analyze CLASS performance based on aggregated student data.
    
    DATA SAMPLES(Anonymized):
    ${studentsJson}

MISSION:
    Identify PATTERNS in the class.
1. Are they generally impulsive or hesitant ?
  2. Is there a specific topic they all struggle with?

      OUTPUT FORMAT(JSON ONLY):
{
  "strongSkills": ["List 2-3 skills the CLASS excels at"],
    "weakSkills": ["List 2-3 skills the CLASS struggles with"],
      "actionItems": ["List 2 practical teaching strategies for tomorrow"]
}
`;

export const getStudentReportPrompt = (studentData: string) => `
    Create a personal student report based on this data:
    ${studentData}

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

export const getAutoFixPrompt = (issues: string, originalContent: string) => `
    You are a Content Editor.
    Your task is to REWRITE the provided JSON content to resolve strict pedagogical issues.
    
    Issues Found:
    ${issues}

    Original Content:
    ${originalContent}

    INSTRUCTION:
    1. Fix ONLY the specific issues listed.
    2. Maintain the original JSON structure exactly.
    3. Do NOT change the topic or core educational value, just the wording/structure to match the target audience.
    
    Output the corrected JSON only.
`;


export const getGradingPrompt = (questionText: string, rubric: string, studentAnswers: string) => `
    You are an expert teacher grading student answers.
    
    Question: "${questionText}"
    
    Rubric / Ideal Answer:
    "${rubric}"
    
    Task:
    Grade the following student answers.
    Provide a grade (0-100) and short constructive feedback (in Hebrew) for each.
    
    Input (Student Answers):
    ${studentAnswers}

    Output Required: JSON Array
    [
      { "id": "submission_id", "grade": 90, "feedback": "Nice job..." }
    ]
`;

export const getGuardianPrompt = (mode: string, contentJson: string) => `
### SYSTEM ROLE
You are the **Wizdi Integrity Guardian**, a rigorous pedagogical auditor API.
Your Goal: Protect the teacher from low-quality, misaligned, or "student-facing" content masquerading as a Lesson Plan.

### INPUT CONTEXT
- **Target Mode:** \${mode}
- **Input Content:**
\${contentJson.substring(0, 15000)}

### AUDIT PROTOCOL
1. **Identity Check:** Is this a quiz? Is it addressing the student directly ("Circle the answer") instead of the teacher ("Ask students to circle")?
2. **Structure Check:** Does it have distinct teaching phases?
3. **Safety Check:** valid JSON?

### OUTPUT FORMAT (Strict JSON Only)
Returns a JSON object. NO markdown formatting.
{
  "audit_result": {
    "status": "PASS" | "CRITICAL_FAIL" | "WARNING",
    "failure_reason_code": "WORKSHEET_FALLACY" | "STUDENT_VOICE_ERROR" | "MISSING_TIMESTAMPS" | "NONE",
    "confidence_score": 0-100
  },
  "pedagogical_report": {
    "target_audience_detected": "Teacher" | "Student" | "Unknown",
    "structure_quality": {
      "has_opening": boolean,
      "has_guided_practice": boolean,
      "has_closure": boolean
    },
    "feedback_hebrew": "Short feedback string in Hebrew for the user (only if WARNING/FAIL)"
  },
  "auto_repair_instruction": "String prompt to send back to the Generator AI to fix the specific issues found (if FAIL)."
}
`;

/**
 * DYNAMIC LINGUISTIC CONSTRAINTS BY GRADE LEVEL
 *
 * This function generates grade-appropriate linguistic guidelines based on CEFR standards.
 * It ensures content is written at the appropriate complexity level for each age group.
 *
 * Reference: PROJECT_DNA Section 1.3 (Complexity Adaptation) and pedagogicalPrompts.ts
 */
export const getLinguisticConstraintsByGrade = (gradeLevel: string): string => {
    const grade = gradeLevel?.toLowerCase() || '';

    // Elementary School: Grades 1-2 (כיתות א'-ב')
    if (grade.includes('א') || grade.includes('ב') ||
        grade.includes('1') || grade.includes('2') ||
        grade.includes('first') || grade.includes('second')) {
        return `
### LINGUISTIC CONSTRAINTS - EARLY ELEMENTARY (Grades 1-2) | CEFR Pre-A1 to A1

**CRITICAL: This is for YOUNG CHILDREN (ages 6-8). Language must be EXTREMELY simple.**

**Sentence Structure:**
- Maximum 5-8 words per sentence
- Simple Subject-Verb-Object only ("הכלב רץ בגינה")
- ONE idea per sentence
- **FORBIDDEN:** Compound sentences, subordinate clauses, passive voice

**Vocabulary:**
- Use only basic, concrete words from daily life
- Objects child can touch/see: בית, כלב, אמא, שמש, מים, אוכל
- Actions child does: רץ, אוכל, ישן, משחק, צוחק
- **FORBIDDEN:** Abstract concepts without concrete examples
- Every new word MUST have a familiar example: "פרפר - זוכר את הפרפר הכתום שראינו בגינה?"

**Tone & Style:**
- Warm, encouraging, playful
- Direct address: "אתה", "שלך", "בוא נראה"
- Use questions to engage: "מה אתה חושב?"
- Short paragraphs (2-3 sentences max)

**Analogies (MANDATORY):**
- Every concept needs a concrete daily-life example
- "השמש חמה - כמו כשאתה מתחמם ליד התנור"
- "מספרים - כמו לספור את האצבעות שלך"
`;
    }

    // Elementary School: Grades 3-4 (כיתות ג'-ד')
    if (grade.includes('ג') || grade.includes('ד') ||
        grade.includes('3') || grade.includes('4') ||
        grade.includes('third') || grade.includes('fourth')) {
        return `
### LINGUISTIC CONSTRAINTS - ELEMENTARY (Grades 3-4) | CEFR A1-A2

**Sentence Structure:**
- Maximum 8-10 words per sentence
- Simple sentences with ONE connector allowed: "ו", "אבל", "כי"
- **FORBIDDEN:** Passive voice ("התפוח נאכל" → use "דני אכל את התפוח")
- **FORBIDDEN:** Long construct chains ("סמיכויות")
- **FORBIDDEN:** Complex subordinate clauses

**Vocabulary:**
- Concrete nouns primarily (שולחן, עץ, חיה, מכונית)
- Simple action verbs in present/past tense
- Abstract words MUST be explained in parentheses or with example
- Example: "אקלים (מזג האוויר לאורך זמן - האם בדרך כלל חם או קר?)"

**Tone & Style:**
- Friendly, clear, encouraging
- Direct address: "אתה/את", "נסה/נסי"
- Break complex ideas into small steps
- Use bullet points and numbered lists

**Analogies (MANDATORY for technical terms):**
- "פוטוסינתזה - כמו שאתה צריך לאכול כדי לקבל כוח, הצמח משתמש באור השמש כדי לייצר אוכל"
- "אטום - חלקיק קטנטן, כמו גרגיר חול, אבל קטן בהרבה - כל כך קטן שאי אפשר לראות אותו"
`;
    }

    // Elementary School: Grades 5-6 (כיתות ה'-ו')
    if (grade.includes('ה') || grade.includes('ו') ||
        grade.includes('5') || grade.includes('6') ||
        grade.includes('fifth') || grade.includes('sixth')) {
        return `
### LINGUISTIC CONSTRAINTS - UPPER ELEMENTARY (Grades 5-6) | CEFR A2-B1

**Sentence Structure:**
- Maximum 10-12 words per sentence
- Simple compound sentences allowed: "וגם", "אבל", "לכן", "כי"
- **FORBIDDEN:** Passive voice (use active: "המדענים גילו" not "התגלה ע"י")
- **FORBIDDEN:** Long chains of construct states
- **FORBIDDEN:** Academic nominalization

**Vocabulary:**
- Concrete nouns + basic abstract concepts with explanation
- Can introduce subject-specific terms WITH immediate definition
- Example: "מערכת העיכול (החלקים בגוף שמפרקים את האוכל)"

**Tone & Style:**
- Clear, respectful, slightly more mature
- Can use "אנחנו" for inclusive feeling
- Encourage curiosity: "בואו נבדוק למה זה קורה"
- Paragraphs of 3-4 sentences OK

**Cognitive Level:**
- Simple cause-and-effect: "כאשר X קורה, אז Y"
- Basic comparisons: "בדומה ל...", "שונה מ..."
- Introduce "Why" questions

**Analogies (Required for new concepts):**
- "כדור הארץ סובב סביב השמש כמו שילד רץ במעגל סביב עץ בחצר"
- "DNA הוא כמו ספר מתכונים - הוא מכיל את כל ההוראות לבניית הגוף"
`;
    }

    // Middle School: Grades 7-8 (כיתות ז'-ח')
    if (grade.includes('ז') || grade.includes('ח') ||
        grade.includes('7') || grade.includes('8') ||
        grade.includes('seventh') || grade.includes('eighth')) {
        return `
### LINGUISTIC CONSTRAINTS - MIDDLE SCHOOL (Grades 7-8) | CEFR B1

**Sentence Structure:**
- Maximum 15-18 words per sentence
- Compound sentences with logical connectors: "למרות ש", "מפני ש", "לכן", "אולם"
- Complex sentences allowed but must be clear
- Passive voice allowed sparingly when appropriate

**Vocabulary:**
- Subject-specific terminology expected (with brief reminder if complex)
- Abstract concepts without extensive explanation if grade-appropriate
- Can use academic terms that students have encountered before

**Tone & Style:**
- More mature, treats student as capable learner
- Can include mild humor or engaging hooks
- "שימו לב ש...", "חשוב להבין ש..."
- Metaphors allowed if clear

**Cognitive Level:**
- Cause-and-effect chains (A leads to B leads to C)
- Compare and contrast multiple items
- Basic analysis: "מה היתרונות והחסרונות?"
- Can introduce multiple perspectives

**Analogies (For complex concepts only):**
- Use analogies for truly difficult concepts, not for everything
- "מערכת החיסון פועלת כמו צבא שמגן על המדינה מפני פולשים"
`;
    }

    // Middle School: Grade 9 (כיתה ט')
    if (grade.includes('ט') || grade.includes('9') || grade.includes('ninth')) {
        return `
### LINGUISTIC CONSTRAINTS - MIDDLE SCHOOL (Grade 9) | CEFR B1-B2

**Sentence Structure:**
- Maximum 18-20 words per sentence
- Full range of compound and complex sentences
- Logical connectors required: "לעומת זאת", "כתוצאה מכך", "יתרה מזאת"
- Embedded clauses allowed

**Vocabulary:**
- Full subject-specific vocabulary expected
- Technical terms used naturally
- Abstract concepts discussed without simplification

**Tone & Style:**
- Academic but accessible
- Objective tone for factual content
- Can challenge students: "האם אתם מסכימים? נמקו."
- Treats student as young adult

**Cognitive Level:**
- Multi-step analysis required
- Synthesis of information from multiple sources
- Basic evaluation: "עד כמה הטיעון משכנע?"
- Introduction to critical thinking

**No analogies required** - use only when genuinely helpful for abstract concepts
`;
    }

    // High School: Grades 10-12 (כיתות י'-י"ב)
    if (grade.includes('י') || grade.includes('10') || grade.includes('11') || grade.includes('12') ||
        grade.includes('tenth') || grade.includes('eleventh') || grade.includes('twelfth') ||
        grade.includes('תיכון') || grade.includes('high')) {
        return `
### LINGUISTIC CONSTRAINTS - HIGH SCHOOL (Grades 10-12) | CEFR B2-C1

**Sentence Structure:**
- No hard limit on sentence length, but clarity is paramount
- Academic/Formal Hebrew register expected
- **REQUIRED:** Use of nominalization ("שם פעולה") where appropriate
  - Instead of "אנשים התנגדו" → "התנגדות הציבור הובילה ל..."
- Complex syntax with embedded clauses
- Full passive voice usage when stylistically appropriate

**Vocabulary:**
- Full academic vocabulary
- Subject-specific jargon expected without explanation
- Nuanced language: "לטעון" vs "להציע" vs "לקבוע"

**Tone & Style:**
- Formal, academic, objective
- **FORBIDDEN:** "Baby talk", over-simplification, excessive encouragement
- Treats student as scholar/researcher
- "יש לציין ש...", "מן הראוי לבחון...", "ניתן לטעון ש..."

**Cognitive Level:**
- Critical analysis and evaluation
- Synthesis across multiple sources
- Identifying bias, assumptions, limitations
- Constructing and deconstructing arguments
- Meta-cognitive awareness: "מהן ההנחות מאחורי טיעון זה?"

**No analogies** - students should engage with concepts directly at their complexity level
`;
    }

    // College/University or Professional (סטודנטים/הכשרה מקצועית)
    if (grade.includes('סטודנט') || grade.includes('אוניברסיט') ||
        grade.includes('מקצועי') || grade.includes('college') ||
        grade.includes('university') || grade.includes('professional') ||
        grade.includes('adult')) {
        return `
### LINGUISTIC CONSTRAINTS - HIGHER EDUCATION / PROFESSIONAL | CEFR C1-C2

**Sentence Structure:**
- No restrictions - use academic conventions
- Complex argumentation structures expected
- Discipline-specific discourse patterns

**Vocabulary:**
- Full technical/professional vocabulary
- Field-specific terminology without explanation
- Precision in word choice is critical

**Tone & Style:**
- Formal academic or professional register
- Objective, evidence-based language
- Can engage with theoretical frameworks directly

**Cognitive Level:**
- Advanced analysis, synthesis, and evaluation
- Original argumentation expected
- Engagement with primary sources
- Critical evaluation of methodology
`;
    }

    // Default fallback - Middle School level (safe middle ground)
    return `
### LINGUISTIC CONSTRAINTS - GENERAL (Default: Middle School Level) | CEFR B1

**Note:** Grade level not clearly specified. Using middle-school appropriate language as default.

**Sentence Structure:**
- Maximum 15 words per sentence
- Clear compound sentences with logical connectors
- Avoid overly complex constructions

**Vocabulary:**
- Clear, accessible language
- Explain technical terms on first use
- Prefer concrete over abstract when possible

**Tone & Style:**
- Friendly but respectful
- Engaging without being childish
- Clear explanations with examples

**Analogies:** Use for complex concepts to aid understanding
`;
};

// ============================================
// TEXTBOOK-ALIGNED GENERATION PROMPTS
// ============================================

/**
 * Generate a prompt for textbook-aligned content generation
 * Uses exact textbook content, language, and pedagogical style
 */
export const getTextbookAlignedPrompt = (
  textbookContent: string,
  textbookMetadata: {
    title: string;
    selectedChapters: string[];
    grade: string;
    subject: string;
  },
  alignmentLevel: 'flexible' | 'strict'
) => {
  const strictRules = alignmentLevel === 'strict' ? `
**STRICT ALIGNMENT MODE - CRITICAL RULES:**
1. Use ONLY concepts, examples, and exercises that appear in the textbook content below
2. Do NOT introduce ANY external information, examples, or explanations
3. If the textbook uses a specific term (e.g., "חיבור אנכי"), use EXACTLY that term - not synonyms
4. Follow the textbook's exact progression and difficulty level
5. Adapt exercises directly from the textbook patterns - do not create new formats
` : `
**FLEXIBLE ALIGNMENT MODE:**
1. Use the textbook as PRIMARY inspiration and reference
2. Match the textbook's pedagogical style and language level
3. You may extend with similar examples in the same style
4. Maintain consistency with the textbook's terminology
5. New content should feel like it belongs in the same textbook
`;

  return `
# TEXTBOOK-ALIGNED CONTENT GENERATION

You are generating educational content that must be TIGHTLY ALIGNED with a specific textbook.

## SOURCE TEXTBOOK INFORMATION:
- **Title:** ${textbookMetadata.title}
- **Grade Level:** ${textbookMetadata.grade}
- **Subject:** ${textbookMetadata.subject}
- **Selected Chapters:** ${textbookMetadata.selectedChapters.join(', ')}

${strictRules}

## TEXTBOOK CONTENT (PRIMARY SOURCE):
"""
${textbookContent}
"""

## ALIGNMENT REQUIREMENTS:

### 1. LANGUAGE & TERMINOLOGY
- Copy the textbook's exact mathematical/subject vocabulary
- If textbook says "מחסר" don't use "חיסור"; if it says "סכום" use "סכום"
- Match sentence structure and formality level
- Use the same Hebrew register (formal/informal) as the textbook

### 2. PEDAGOGICAL STYLE
- Follow the textbook's teaching approach:
  * If it explains concepts before examples → do the same
  * If it uses visual representations → reference similar visuals
  * If it builds concepts gradually → maintain that progression
- Match the textbook's balance of explanation vs. practice

### 3. EXAMPLES & EXERCISES
- Create examples similar to those in the textbook:
  * Same number ranges (if textbook uses 1-20, stay in that range)
  * Same context types (if textbook uses שקלים, use שקלים)
  * Same difficulty progression
- For exercises, mirror the textbook's:
  * Question formats (word problems vs. pure computation)
  * Scaffolding approach (guided → independent)

### 4. COMMON MISTAKES & TIPS
- If textbook highlights specific common mistakes, address those
- Use the textbook's pedagogical guidance for teachers (if available)

### 5. PAGE REFERENCES
- When possible, include source references: "ראה עמ' X בספר"
- This helps teachers locate related content

## OUTPUT FORMAT:
Generate content following the requested format, but ensure every element
(explanations, questions, examples, hints) is aligned with the textbook style.
`;
};

/**
 * Get a textbook-style explanation prompt
 */
export const getTextbookExplanationPrompt = (
  topic: string,
  textbookContent: string,
  grade: string
) => `
נא להסביר את הנושא "${topic}" בסגנון ספר הלימוד.

**תוכן מספר הלימוד להתבסס עליו:**
${textbookContent}

**הנחיות:**
1. השתמש באותה שפה ומונחים כמו בספר
2. התאם את רמת ההסבר לכיתה ${grade}
3. אם יש בספר דוגמאות דומות - התבסס עליהן
4. שמור על הסגנון הפדגוגי של הספר (צורת הפנייה לתלמיד, רמת הפירוט)

**פלט:** הסבר בעברית בסגנון ספר הלימוד
`;

/**
 * Get a textbook-style exercise generation prompt
 */
export const getTextbookExercisePrompt = (
  topic: string,
  textbookExamples: string,
  exerciseType: string,
  count: number,
  grade: string
) => `
צור ${count} תרגילים מסוג "${exerciseType}" בנושא "${topic}" בסגנון ספר הלימוד.

**דוגמאות מהספר להתבסס עליהן:**
${textbookExamples}

**הנחיות:**
1. חקה את מבנה התרגילים בספר
2. השתמש בטווחי מספרים דומים לאלה בספר
3. השתמש בהקשרים דומים (אם הספר משתמש בפירות - השתמש בפירות)
4. התאם את רמת הקושי לכיתה ${grade}
5. כלול תרגילים בקושי עולה אם זה הסגנון בספר

**פלט:** JSON עם מערך של תרגילים
`;

/**
 * Get context injection template for textbook-aligned generation
 */
export const getTextbookContextInjection = (
  textbookContext: string,
  textbookTitle: string,
  selectedChapters: string[]
) => `
**מקור מרכזי - ספר הלימוד:**
${textbookTitle}
פרקים נבחרים: ${selectedChapters.join(', ')}

---
${textbookContext}
---

**חשוב:** התוכן שנוצר חייב להתבסס על חומר הספר לעיל.
השתמש באותה שפה, מונחים ודוגמאות.
`;

// ============================================
// NEW QUESTION TYPE PROMPTS (8 New Types)
// ============================================

export const getMatchingPrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
Create a Matching Activity (connect items from two columns).
${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
Target Audience: ${gradeLevel}.
Language: Hebrew.

Task: Create pairs that students need to match.
Rules:
1. Create 4-6 pairs of related items.
2. Left column could be: terms, events, people, causes.
3. Right column could be: definitions, dates, descriptions, effects.
4. Each left item has exactly ONE correct match on the right.
5. Make sure matches are unambiguous.

JSON Output:
{
  "instruction": "התאימו בין הפריטים בעמודה השמאלית לפריטים בעמודה הימנית:",
  "leftItems": [
    { "id": "l1", "text": "Item 1" },
    { "id": "l2", "text": "Item 2" }
  ],
  "rightItems": [
    { "id": "r1", "text": "Match 1" },
    { "id": "r2", "text": "Match 2" }
  ],
  "correctMatches": [
    { "left": "l1", "right": "r1" },
    { "left": "l2", "right": "r2" }
  ]
}
`;

export const getHighlightPrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
Create a Text Highlighting Activity (mark correct words/phrases in text).
${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
Target Audience: ${gradeLevel}.
Language: Hebrew.

Task: Write a short paragraph where students need to highlight specific words/phrases.
Rules:
1. Write 2-4 sentences of text.
2. Include 2-5 words/phrases that need to be highlighted.
3. Give clear instruction about WHAT to highlight (e.g., "סמנו את כל הפעלים", "סמנו את הסיבות").
4. Provide exact character positions for correct highlights.

JSON Output:
{
  "instruction": "סמנו את המילים שמתארות [קריטריון]:",
  "text": "הטקסט המלא כאן עם מילים לסימון",
  "correctHighlights": [
    { "start": 5, "end": 10, "text": "מילה1" },
    { "start": 20, "end": 28, "text": "מילה2" }
  ],
  "highlightType": "background"
}
`;

export const getSentenceBuilderPrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
Create a Sentence Building Activity (arrange scrambled words into correct sentence).
${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
Target Audience: ${gradeLevel}.
Language: Hebrew.

Task: Create a meaningful sentence that students need to reconstruct.
Rules:
1. Sentence should be 5-10 words long (appropriate for grade level).
2. Sentence should convey an important concept from the topic.
3. Provide words in scrambled order (not the correct order).
4. For younger grades: shorter sentences, simpler vocabulary.

JSON Output:
{
  "instruction": "סדרו את המילים למשפט תקין:",
  "words": ["word3", "word1", "word4", "word2"],
  "correctSentence": "word1 word2 word3 word4"
}
`;

export const getImageLabelingPrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
Create an Image Labeling Activity (drag labels onto an image).
${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
Target Audience: ${gradeLevel}.
Language: Hebrew.

Task: Design labels for a diagram or image.
Rules:
1. Create 3-6 labels for different parts of an image/diagram.
2. Labels should be short (1-3 words).
3. Provide approximate positions (x,y as percentages 0-100).
4. Describe what image would be needed.

JSON Output:
{
  "instruction": "גררו את התוויות למקומות המתאימים בתמונה:",
  "imageDescription": "תיאור התמונה הדרושה",
  "labels": [
    { "id": "label1", "text": "תווית 1" },
    { "id": "label2", "text": "תווית 2" },
    { "id": "label3", "text": "תווית 3" }
  ],
  "dropZones": [
    { "id": "zone1", "x": 20, "y": 30, "correctLabelId": "label1" },
    { "id": "zone2", "x": 50, "y": 50, "correctLabelId": "label2" },
    { "id": "zone3", "x": 70, "y": 20, "correctLabelId": "label3" }
  ]
}
`;

export const getTableCompletionPrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
Create a Table Completion Activity (fill in missing cells).
${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
Target Audience: ${gradeLevel}.
Language: Hebrew.

Task: Create a table with some cells for students to fill in.
Rules:
1. Table should have 2-4 columns and 2-4 rows.
2. Include a mix of given values and cells to complete.
3. Make headers clear and descriptive.
4. Answers should be inferable from context or knowledge.

JSON Output:
{
  "instruction": "השלימו את התאים החסרים בטבלה:",
  "headers": ["עמודה 1", "עמודה 2", "עמודה 3"],
  "rows": [
    {
      "cells": [
        { "value": "נתון", "editable": false },
        { "value": "", "editable": true, "correctAnswer": "תשובה" },
        { "value": "נתון", "editable": false }
      ]
    },
    {
      "cells": [
        { "value": "", "editable": true, "correctAnswer": "תשובה" },
        { "value": "נתון", "editable": false },
        { "value": "", "editable": true, "correctAnswer": "תשובה" }
      ]
    }
  ]
}
`;

export const getTextSelectionPrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
Create a Text Selection Activity (select correct words/sentences from text).
${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
Target Audience: ${gradeLevel}.
Language: Hebrew.

Task: Write text where students need to select specific parts.
Rules:
1. Write 3-5 sentences of educational content.
2. Define what students should select (e.g., "all adjectives", "main ideas", "causes").
3. List the exact words/sentences that should be selected.
4. Specify the unit of selection (word, sentence, or paragraph).

JSON Output:
{
  "instruction": "בחרו את כל [הקריטריון] מתוך הטקסט:",
  "text": "הטקסט המלא. עם כמה משפטים. וחלקים לבחירה.",
  "selectableUnits": "word",
  "correctSelections": ["מילה1", "מילה2", "מילה3"],
  "minSelections": 1,
  "maxSelections": 5
}
`;

export const getRatingScalePrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
Create a Rating Scale Question (rate on a scale).
${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
Target Audience: ${gradeLevel}.
Language: Hebrew.

Task: Create a rating scale question.
Rules:
1. Question can be opinion-based (no correct answer) or knowledge-based (with correct answer).
2. Use scale 1-5 for simple ratings, 1-10 for precise ratings.
3. Provide clear labels for min and max values.
4. If there's a correct answer, include it.

JSON Output (opinion-based):
{
  "question": "עד כמה אתם מסכימים עם הטענה: [טענה]?",
  "minValue": 1,
  "maxValue": 5,
  "minLabel": "לא מסכים בכלל",
  "maxLabel": "מסכים מאוד",
  "showNumbers": true
}

JSON Output (with correct answer):
{
  "question": "מה רמת החשיבות של [נושא]?",
  "minValue": 1,
  "maxValue": 5,
  "minLabel": "לא חשוב",
  "maxLabel": "חשוב מאוד",
  "correctAnswer": 5,
  "showNumbers": true
}
`;

export const getMatrixPrompt = (topic: string, gradeLevel: string, sourceText?: string) => `
Create a Matrix Question (multiple rows with same options).
${sourceText ? `BASE ON THIS TEXT: """${sourceText.substring(0, 3000)}"""\nIgnore outside knowledge.` : `Topic: "${topic}"`}
Target Audience: ${gradeLevel}.
Language: Hebrew.

Task: Create a matrix/grid question.
Rules:
1. Create 3-5 sub-questions (rows).
2. All rows share the same answer options (columns).
3. Options should be 2-4 choices (e.g., "נכון/לא נכון", "תמיד/לפעמים/אף פעם").
4. Each row has exactly one correct answer.

JSON Output:
{
  "instruction": "סמנו את התשובה הנכונה עבור כל שאלה:",
  "columns": ["נכון", "לא נכון", "לא ניתן לקבוע"],
  "rows": [
    { "question": "טענה ראשונה", "correctAnswer": "נכון" },
    { "question": "טענה שנייה", "correctAnswer": "לא נכון" },
    { "question": "טענה שלישית", "correctAnswer": "נכון" }
  ]
}
`;
