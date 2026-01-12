import * as logger from "firebase-functions/logger";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import OpenAI from "openai";
import { getSkeletonPrompt, getStepContentPrompt, getPodcastPrompt, getGuardianPrompt, getLinguisticConstraintsByGrade } from "../ai/prompts";
import { mapSystemItemToBlock, cleanJsonString } from "../shared/utils/geminiParsers";
import { getCached, setCache, getSkeletonCacheKey, getStepContentCacheKey } from "../services/cacheService";
import { getOpenAIClient } from "../utils/connectionPool";
import { KnowledgeService } from "../services/knowledgeBase";

// Helper to convert grade level string to Knowledge Base grade format
const gradeToKBFormat = (gradeLevel: string): 'א' | 'ב' | 'ג' | 'ד' | 'ה' | 'ו' | 'ז' | 'ח' | 'ט' | 'י' | 'יא' | 'יב' | null => {
    if (!gradeLevel) return null;
    const g = gradeLevel.toLowerCase();

    // Map various formats to Knowledge Base grade format
    const gradeMap: Record<string, 'א' | 'ב' | 'ג' | 'ד' | 'ה' | 'ו' | 'ז' | 'ח' | 'ט' | 'י' | 'יא' | 'יב'> = {
        // Hebrew letter formats
        'א': 'א', 'ב': 'ב', 'ג': 'ג', 'ד': 'ד', 'ה': 'ה', 'ו': 'ו',
        'ז': 'ז', 'ח': 'ח', 'ט': 'ט', 'י': 'י', 'יא': 'יא', 'יב': 'יב',
        // Full Hebrew class names
        "כיתה א": 'א', "כיתה א׳": 'א', "כיתה א'": 'א',
        "כיתה ב": 'ב', "כיתה ב׳": 'ב', "כיתה ב'": 'ב',
        "כיתה ג": 'ג', "כיתה ג׳": 'ג', "כיתה ג'": 'ג',
        "כיתה ד": 'ד', "כיתה ד׳": 'ד', "כיתה ד'": 'ד',
        "כיתה ה": 'ה', "כיתה ה׳": 'ה', "כיתה ה'": 'ה',
        "כיתה ו": 'ו', "כיתה ו׳": 'ו', "כיתה ו'": 'ו',
        "כיתה ז": 'ז', "כיתה ז׳": 'ז', "כיתה ז'": 'ז',
        "כיתה ח": 'ח', "כיתה ח׳": 'ח', "כיתה ח'": 'ח',
        "כיתה ט": 'ט', "כיתה ט׳": 'ט', "כיתה ט'": 'ט',
        "כיתה י": 'י', "כיתה י׳": 'י', "כיתה י'": 'י',
        "כיתה יא": 'יא', "כיתה י״א": 'יא', "כיתה יא'": 'יא',
        "כיתה יב": 'יב', "כיתה י״ב": 'יב', "כיתה יב'": 'יב',
        // English/number formats
        '1': 'א', '2': 'ב', '3': 'ג', '4': 'ד', '5': 'ה', '6': 'ו',
        '7': 'ז', '8': 'ח', '9': 'ט', '10': 'י', '11': 'יא', '12': 'יב',
        'first': 'א', 'second': 'ב', 'third': 'ג', 'fourth': 'ד',
        'fifth': 'ה', 'sixth': 'ו', 'seventh': 'ז', 'eighth': 'ח',
        'ninth': 'ט', 'tenth': 'י', 'eleventh': 'יא', 'twelfth': 'יב',
    };

    // Direct match
    if (gradeMap[g]) return gradeMap[g];

    // Search for partial match
    for (const [key, value] of Object.entries(gradeMap)) {
        if (g.includes(key)) return value;
    }

    return null;
};

// Note: In a real migration, we would ideally move the 'geminiApi.ts' logic 
// fully to a 'service' file in the backend. For this "Vault" phase, 
// we will implement the specific 'generateLessonPlan' endpoint which matches 
// what 'generateUnitSkeleton' did in the frontend.

// Since `generateUnitSkeleton` in frontend was doing the heavy lifting of calling the API,
// we will recreate that orchestration here.

export const createAiController = (openaiApiKey: any) => {

    const MODEL_NAME = "gpt-4o-mini";
    // --- 1. Generate Teacher Lesson PLAN (Teacher View) ---
    // Formerly 'generateUnitSkeleton' - Renamed to avoid confusion with Student Unit
    const generateTeacherLessonPlan = onCall({ cors: true, secrets: [openaiApiKey] }, async (request) => {
        const openai = getOpenAIClient(openaiApiKey.value()); // Use connection pool
        const { topic, gradeLevel, activityLength, sourceText, mode, productType } = request.data;
        const durationMap: Record<string, string> = { short: "45 min", medium: "90 min", long: "120 min" };

        logger.info(`Vault: Generating TEACHER Lesson Plan (Architect) for ${topic}`);

        // --- NEW ARCHITECT PROMPT (User Defined) ---
        const ARCHITECT_PROMPT = `
System Prompt: The Pedagogical Lesson Architect
Role: You are an expert Pedagogical Architect and Instructional Designer for the "Wizdi" system. Your mission is to process raw content and synthesize it into a high-level Teacher's Lesson Plan that is ENGAGING, ALIVE, and INSPIRES LEARNING.

Core Philosophy:
Audience: You are writing for the TEACHER, not the student.
Tone: Professional, directive, helpful, and structured.
Goal: To provide a step-by-step script that helps the teacher manage the class time effectively while keeping students ENGAGED throughout.

Input Data:
Topic: ${topic}
Grade Level: ${gradeLevel}
Duration: ${durationMap[activityLength || 'medium']}
Source Material: """${(sourceText || "").substring(0, 10000)}"""

═══════════════════════════════════════════════════════════════════
🎯 THE 10 ENGAGEMENT PRINCIPLES (חובה לשלב בכל שיעור!)
═══════════════════════════════════════════════════════════════════

**PRINCIPLE 1: פתיחה מסקרנת (Captivating Hook)**
The opening is EVERYTHING. Students decide in the first 60 seconds if the lesson is worth their attention.
NEVER: "מה אתם יודעים על...", "היום נלמד על...", "פתחו ספרים בעמוד..."
ALWAYS: Start with surprise, curiosity, or challenge!

**PRINCIPLE 2: קישור לעולם התלמידים (Personal Relevance)**
Every concept MUST connect to students' actual lives:
- Social media examples (TikTok, Instagram, YouTube)
- Gaming references (Fortnite, Minecraft, Roblox logic)
- Daily situations (school drama, family moments, friendships)
- Pop culture (trending songs, memes, viral content)
Ask: "איפה אתם פוגשים את זה בחיים האמיתיים?"

**PRINCIPLE 3: מעורבות פעילה (Active Participation)**
Students must DO something every 5-7 minutes maximum!
Types of micro-activities:
- הצבעה: "מי חושב ש... הרימו יד"
- דיון בזוגות: "30 שניות - דברו עם השכן"
- כתיבה מהירה: "כתבו מילה אחת על הלוח/דף"
- תנועה: "קומו אם אתם מסכימים, שבו אם לא"
- Poll: "אצבע אחת = אפשרות א', שתיים = אפשרות ב'"

**PRINCIPLE 4: גיוון בדרכי הוראה (Teaching Variety)**
NEVER more than 10 minutes of the same method!
Must include at least 3 different modalities:
- שמיעה: הרצאה, סיפור, שיר, פודקאסט
- ראייה: תמונה, סרטון, תרשים, הדגמה
- עשייה: כתיבה, ציור, בנייה, ניסוי
- תנועה: משחק, הצבעה פיזית, שינוי מקום
- דיבור: דיון, הסבר לחבר, שאלות

**PRINCIPLE 5: משימה עם אתגר (Cognitive Challenge)**
Every lesson needs at least ONE question without a clear answer:
- "מה היה קורה אם...?"
- "איך הייתם פותרים את...?"
- "למה לדעתכם...?"
- "מה ההבדל בין... ל...?"
Mark these as "🧠 שאלת אתגר" in the lesson plan.

**PRINCIPLE 6: תחושת משמעות (The WHY Factor)**
At the START of each new concept, explain WHY it matters:
- קשר להווה: "בזכות זה תבינו למה..."
- קשר לעתיד: "זה יעזור לכם כשתהיו..."
- קשר לחיים: "בלי זה, לא הייתם יכולים..."
NEVER assume students know why something is important!

**PRINCIPLE 7: הומור ואווירה טובה (Light & Positive Atmosphere)**
Include at least ONE moment of lightness per lesson:
- בדיחה קשורה לנושא
- מם או תמונה מצחיקה רלוונטית
- "טעות נפוצה ומצחיקה: ..."
- סיפור אישי קצר ומשעשע
- "אני יודע שזה נשמע מוזר, אבל..."
Humor = memory! Students remember what made them smile.

**PRINCIPLE 8: קצב נכון (Pacing & Rhythm)**
Mark "⚡ נקודת מעבר" every 10 minutes in the lesson plan.
Include teacher notes for energy management:
- "אם רואים עייפות - זה הזמן לפעילות פיזית קצרה"
- "שינוי קצב: עברו מהרצאה לעבודה בזוגות"
- "רגע אנרגיה: שאלו שאלה פרובוקטיבית"

**PRINCIPLE 9: בחירה לתלמידים (Student Choice)**
Include at least ONE choice point per lesson:
- "בחרו שאלה מתוך 3 לענות עליה"
- "בחרו איך להציג: ציור / כתיבה / הסבר בע"פ"
- "בחרו את הדוגמה שאתם רוצים לנתח"
- "החליטו: לעבוד לבד או בזוג"
Choice = ownership = engagement!

**PRINCIPLE 10: סיום חזק (Powerful Closure)**
NEVER end with "יש שאלות?" or just summarizing!
Choose ONE powerful ending type:
- 🔮 Cliffhanger: "בשיעור הבא נגלה למה... (ורמז מסקרן)"
- 🤔 שאלת חשיבה: "עד השיעור הבא, חשבו על..."
- 💡 תגלית: "הדבר הכי מפתיע שלמדנו היום..."
- 🎫 Exit Ticket: "לפני שיוצאים - כתבו משפט אחד על..."
- 🔗 חיבור רגשי: "למה זה חשוב לנו כבני אדם..."

═══════════════════════════════════════════════════════════════════

Part 1: Pedagogical Processing Instructions
Structure the lesson based on the "5E Model" or Direct Instruction flow:
1. Hook (Opening) - Apply PRINCIPLE 1 + PRINCIPLE 7
2. Knowledge (Body) - Apply PRINCIPLES 2, 4, 6
3. Guided Practice - Apply PRINCIPLES 3, 5, 9
4. Independent Practice - Apply PRINCIPLES 3, 5, 9
5. Closure (Assessment) - Apply PRINCIPLE 10

**CRITICAL - CREATIVE HOOK GUIDELINES (Part 1.5):**
The opening/hook is the MOST IMPORTANT part of the lesson. It MUST capture students' attention immediately.

NEVER use boring openings like "שאלו את התלמידים מה הם יודעים על..." or "התחילו בדיון פתוח".

INSTEAD, choose ONE of these creative hook types (REQUIRED - pick the most fitting):

**Type A: Visual Hook (תמונה/סרטון)**
- Show a surprising image or short video clip (30-60 sec)
- Ask: "מה אתם רואים? מה קורה כאן? למה זה קרה?"
- Example for ט"ו בשבט: "הציגו תמונה של עץ יבש לצד עץ פורח - 'מה ההבדל? למה?'"

**Type B: Mystery/Riddle Hook (חידה/תעלומה)**
- Present a riddle, mystery, or brain teaser related to the topic
- Example: "יש לי שורשים אבל אני לא צמח. יש לי עלים אבל אני לא ספר. מי אני?"
- Or: "הנה עובדה מוזרה: [fact]. איך זה יכול להיות?"

**Type C: Quick Game/Challenge (משחקון)**
- 2-3 minute interactive game or challenge
- Example: "משחק אסוציאציות: אני אומר 'עץ' - כל אחד כותב 3 מילים תוך 30 שניות"
- Or: "חידון בזק: 5 שאלות נכון/לא נכון על [נושא] - מי מקבל הכי הרבה?"

**Type D: Provocation/Dilemma Hook (פרובוקציה/דילמה)**
- Make a controversial statement or present a moral dilemma
- Example: "אני טוען ש[טענה מפתיעה]. מי מסכים? מי מתנגד? למה?"
- Or: "דמיינו שאתם [סיטואציה]... מה הייתם עושים?"

**Type E: Hands-On Hook (חוויה מעשית)**
- Start with a quick hands-on activity or demonstration
- Example: "כל אחד מקבל [חומר]. יש לכם דקה לבנות/לעשות [משימה]"
- Or: "צפו בניסוי הזה... [הדגמה] - מה קרה? למה?"

**Type F: Personal Connection Hook (חיבור אישי)**
- Connect to students' lives with a surprising twist
- Example: "מי אכל [משהו] השבוע? אתם יודעים מאיפה זה מגיע? בואו נגלה..."
- Or: "העלו את היד אם [שאלה אישית רלוונטית]..."

The Bridge to System Tools (Crucial):
- When the lesson reaches the Practice phase, you must explicitly prompt the teacher to launch the "Interactive Activity".
- When the lesson reaches the Assessment phase, prompt the teacher to launch the "Test Generator".

Part 3: Media Guidelines
- Hook (Opening): Suggest a YouTube video search query OR image search query if relevant.
- Direct Instruction: No media needed (teacher-led).
- Practice: No media needed (activity-focused).
- Summary/Closure: ONE infographic to visually summarize the lesson.
  * Choose infographic type based on content:
    - "flowchart" - for processes, steps, algorithms
    - "timeline" - for historical events, chronological sequences
    - "comparison" - for comparing concepts, pros/cons
    - "cycle" - for recurring processes, loops

Part 4: Output Generation (Hebrew JSON)
Generate a JSON object with the following structure. Strict JSON.
IMPORTANT: Every step MUST include engagement_elements based on the 10 Principles!
{
  "title": "Lesson Title",
  "metadata": {
      "grade": "${gradeLevel}",
      "duration": "${durationMap[activityLength || 'medium']}",
      "objectives": ["obj1", "obj2"],
      "keywords": ["key1", "key2"],
      "engagement_summary": {
          "principles_applied": ["list which of the 10 principles are prominently featured"],
          "total_active_moments": 5,
          "modalities_used": ["שמיעה", "ראייה", "עשייה", "תנועה", "דיבור"]
      }
  },
  "media_plan": {
      "hook_video_query": "search query for YouTube (or null if not needed)",
      "hook_image_query": "search query for image (or null if not needed)",
      "summary_infographic_type": "flowchart | timeline | comparison | cycle",
      "summary_infographic_description": "Brief description of what the infographic should show"
  },
  "steps": [
      {
          "step_number": 1,
          "title": "פתיחה וגירוי",
          "duration": "0-5 min",
          "type": "frontal",
          "hook_type": "visual | mystery | game | provocation | hands_on | personal",
          "teacher_instructions": "DETAILED creative opening script - NOT a generic 'ask students what they know' - include the EXACT activity/question/riddle/challenge with specific wording",
          "materials_needed": ["list of materials if any"],
          "system_tool": null,
          "engagement_elements": {
              "personal_relevance": "דוגמה ספציפית מעולמם של התלמידים (TikTok/משחקים/חיי יומיום)",
              "active_participation": {
                  "type": "הצבעה | דיון בזוגות | כתיבה | תנועה | poll",
                  "instruction": "ההוראה המדויקת לפעילות"
              },
              "why_it_matters": "הסבר קצר למה הנושא חשוב (null אם לא רלוונטי לשלב זה)",
              "humor_element": "אלמנט הומוריסטי אם יש (null אם אין)",
              "challenge_question": "🧠 שאלת אתגר אם רלוונטי (null אם אין)",
              "student_choice": {
                  "enabled": false,
                  "options": [],
                  "instruction": null
              },
              "pacing_note": "⚡ הערה לקצב/אנרגיה אם צריך"
          }
      },
      {
          "step_number": 2,
          "title": "הקניה והוראה",
          "duration": "5-20 min",
          "type": "frontal",
          "teacher_instructions": "Explanation content with VARIETY - include teaching modality changes!",
          "system_tool": null,
          "engagement_elements": {
              "personal_relevance": "קישור לחיי התלמידים",
              "active_participation": {
                  "type": "דיון בזוגות",
                  "instruction": "כל 7 דקות - 30 שניות דיון עם השכן"
              },
              "why_it_matters": "למה זה חשוב להם",
              "humor_element": "טעות נפוצה מצחיקה או בדיחה קשורה",
              "challenge_question": null,
              "student_choice": {
                  "enabled": false,
                  "options": [],
                  "instruction": null
              },
              "pacing_note": "⚡ אחרי 10 דקות - שנו פעילות!"
          }
      },
      {
          "step_number": 3,
          "title": "תרגול כיתתי",
          "duration": "20-35 min",
          "type": "interactive",
          "teacher_instructions": "Group activity instructions with CHOICE elements...",
          "system_tool": "Interactive Activity",
          "engagement_elements": {
              "personal_relevance": null,
              "active_participation": {
                  "type": "עבודה בקבוצות",
                  "instruction": "חלוקה לקבוצות של 3-4"
              },
              "why_it_matters": null,
              "humor_element": null,
              "challenge_question": "🧠 שאלת אתגר לקבוצות מתקדמות",
              "student_choice": {
                  "enabled": true,
                  "options": ["אפשרות א", "אפשרות ב", "אפשרות ג"],
                  "instruction": "כל קבוצה בוחרת שאלה אחת מתוך 3"
              },
              "pacing_note": null
          }
      },
      {
          "step_number": 4,
          "title": "סיכום והערכה",
          "duration": "35-45 min",
          "type": "assessment",
          "teacher_instructions": "POWERFUL closing - not just summary!",
          "system_tool": "Test Generator",
          "closure": {
              "type": "cliffhanger | reflection | exit_ticket | insight | emotional",
              "content": "התוכן המדויק של הסיום החזק",
              "follow_up": "משימה או שאלה להמשך (אם רלוונטי)"
          },
          "engagement_elements": {
              "personal_relevance": "חיבור אישי לסיום",
              "active_participation": {
                  "type": "exit_ticket",
                  "instruction": "כל תלמיד כותב משפט אחד לפני יציאה"
              },
              "why_it_matters": "למה מה שלמדנו היום חשוב",
              "humor_element": null,
              "challenge_question": null,
              "student_choice": {
                  "enabled": false,
                  "options": [],
                  "instruction": null
              },
              "pacing_note": null
          }
      }
  ]
}
`;

        try {
            const completion = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [
                    { role: "system", content: "You are the Wizdi Pedagogical Architect." },
                    { role: "user", content: ARCHITECT_PROMPT }
                ],
                response_format: { type: "json_object" }
            });

            const rawContent = completion.choices[0].message.content;
            if (!rawContent) throw new Error("Empty response from AI");

            const architectJson = JSON.parse(cleanJsonString(rawContent));

            // --- MAP TO FRONTEND SHELL ---
            const mappedSteps = architectJson.steps.map((s: any) => ({
                step_number: s.step_number,
                title: `${s.title} (${s.duration})`,
                type: s.type === 'interactive' ? 'interactive' : (s.type === 'assessment' ? 'quiz' : 'text'),
                description: s.teacher_instructions,
                system_tool: s.system_tool,
                // New fields for creative hooks
                hook_type: s.hook_type || null,
                materials_needed: s.materials_needed || [],
                // NEW: Engagement elements from 10 Principles
                engagement_elements: s.engagement_elements || null,
                // NEW: Closure details for final step
                closure: s.closure || null
            }));

            // Extract media plan (new feature)
            const mediaPlan = architectJson.media_plan || {
                hook_video_query: null,
                hook_image_query: null,
                summary_infographic_type: 'flowchart',
                summary_infographic_description: `סיכום ויזואלי של ${architectJson.title}`
            };

            // Extract engagement summary from metadata
            const metadata = {
                ...architectJson.metadata,
                engagement_summary: architectJson.metadata?.engagement_summary || {
                    principles_applied: [],
                    total_active_moments: 0,
                    modalities_used: []
                }
            };

            return {
                title: architectJson.title,
                steps: mappedSteps,
                metadata: metadata,
                media_plan: mediaPlan // Include media plan for frontend to use
            };

        } catch (error: any) {
            logger.error("Vault Architect (Lesson Plan) Error:", error);
            throw new HttpsError('internal', error.message);
        }
    });

    // --- 2. Generate STUDENT Unit Skeleton (Interactive Flow) ---
    // Ported from frontend/gemini.ts to Fix "Split Brain"
    const generateStudentUnitSkeleton = onCall({ cors: true, secrets: [openaiApiKey] }, async (request) => {
        const openai = getOpenAIClient(openaiApiKey.value()); // Use connection pool
        const { topic, gradeLevel, activityLength, sourceText, mode, productType, bloomPreferences, studentProfile } = request.data;

        logger.info(`Vault: Generating STUDENT Unit Skeleton for ${topic} (Mode: ${mode})`);

        // Check cache first (skip if sourceText provided - custom content)
        if (!sourceText && !bloomPreferences) {
            const cacheKey = getSkeletonCacheKey(topic, gradeLevel, activityLength === 'short' ? 3 : (activityLength === 'long' ? 7 : 5), mode || 'learning');
            const cached = await getCached(cacheKey);

            if (cached) {
                logger.info(`Cache hit for skeleton: ${cacheKey}`);
                return cached;
            }
        }

        // Helper for Bloom Distribution (Inlined from frontend)
        const getBloomDistribution = (count: number, requestedDistribution?: Record<string, number>): string[] => {
            if (!requestedDistribution) {
                switch (count) {
                    case 3: return ["Remember (Foundation)", "Analyze (Process)", "Create (Synthesis)"];
                    case 5: return ["Remember", "Remember", "Apply", "Analyze", "Create"];
                    case 7: return ["Remember", "Remember", "Apply", "Apply", "Analyze", "Evaluate", "Create"];
                    default: return Array(count).fill("Mix of Levels");
                }
            }
            const totalPercentage = Object.values(requestedDistribution).reduce((a, b) => a + b, 0);
            const distribution: string[] = [];
            Object.entries(requestedDistribution).forEach(([level, percent]) => {
                const numItems = Math.round((percent / totalPercentage) * count);
                for (let i = 0; i < numItems; i++) distribution.push(level);
            });
            while (distribution.length < count) distribution.push("Apply");
            return distribution.slice(0, count).sort();
        };

        // Personality Injection
        let personalityInstruction = "";
        if (studentProfile?.confirmedTraits && studentProfile.confirmedTraits.length > 0) {
            personalityInstruction = `\n    PERSONALIZATION OVERRIDE:\n    The student has confirmed traits: ${JSON.stringify(studentProfile.confirmedTraits)}.\n    ADAPT THE SKELETON TO THESE PREFERENCES (e.g. if 'Visual Learner', prefer visual blocks. If 'Competitive', increase difficulty).`;
        }

        let stepCount = 5;
        let structureGuide = "";

        if (productType === 'exam' || mode === 'exam') {
            stepCount = activityLength === 'short' ? 3 : (activityLength === 'long' ? 7 : 5);
            structureGuide = `
              STEP 1: Knowledge Check. Type: multiple_choice OR true_false (Strict).
              STEP 2: Application. Type: categorization OR ordering.
              STEP 3-${stepCount}: Synthesis/Audio. Type: open_question OR audio_response. NO teaching content.
            `;
        } else if (productType === 'game') {
            if (activityLength === 'short') {
                stepCount = 3;
                structureGuide = `
                  STEP 1: Speed Challenge. Type: true_false_speed OR memory_game.
                  STEP 2: Puzzle Challenge. Type: ordering OR categorization.
                  STEP 3: Master Challenge. Type: memory_game OR categorization (Hard).
                `;
            } else {
                stepCount = activityLength === 'long' ? 7 : 5;
                structureGuide = `
                  STEPS 1-2: Warmup Games. Type: memory_game / true_false_speed.
                  STEPS 3-4: Logic Puzzles. Type: ordering / categorization / matching.
                  STEPS 5-${stepCount}: Boss Levels. Type: categorization / matching (Complex).
                `;
            }
        } else {
            // Standard Lesson
            if (activityLength === 'short') {
                stepCount = 3;
                structureGuide = `
                  STEP 1: Introduction & Exposition (Teach + Check). Type: multiple_choice.
                  STEP 2: Deep Dive (Understand). Type: fill_in_blanks.
                  STEP 3: Conclusion & Reflection. Type: open_question.
                `;
            } else if (activityLength === 'long') {
                stepCount = 7;
                structureGuide = `
                  STEPS 1-2: Exposition. Type: multiple_choice / true_false.
                  STEPS 3-5: Practice. Type: fill_in_blanks / categorization / ordering.
                  STEPS 6-7: Synthesis. Type: open_question / multiple_choice.
                `;
            } else {
                stepCount = 5;
                structureGuide = `
                  STEPS 1-2: Core Concepts. Type: multiple_choice OR true_false.
                  STEPS 3-4: Analysis. Type: fill_in_blanks OR categorization.
                  STEP 5: Synthesis. Type: open_question.
                `;
            }
        }

        // Fetch Knowledge Base context if no sourceText provided
        let knowledgeBaseContext = "";
        const kbGrade = gradeToKBFormat(gradeLevel);
        if (!sourceText && topic && kbGrade) {
            try {
                logger.info(`🔍 Fetching Knowledge Base context for topic: "${topic}", grade: ${kbGrade}`);
                const knowledgeService = new KnowledgeService(openaiApiKey.value());
                knowledgeBaseContext = await knowledgeService.searchForPromptContext(topic, kbGrade, {
                    includeTeacherGuide: true,
                    maxChunks: 5
                });
                if (knowledgeBaseContext) {
                    logger.info(`📚 Knowledge Base returned ${knowledgeBaseContext.length} chars of context`);
                }
            } catch (kbError: any) {
                logger.warn(`Knowledge Base lookup failed (continuing without): ${kbError.message}`);
            }
        }

        // Build context: prioritize sourceText, then Knowledge Base, then just topic
        let contextPart: string;
        if (sourceText) {
            contextPart = `BASE CONTENT ON THIS TEXT ONLY:\n"""${sourceText.substring(0, 15000)}"""\nIgnore outside knowledge if it contradicts the text.`;
        } else if (knowledgeBaseContext) {
            contextPart = `Topic: "${topic}"\n\n**STRICT CURRICULUM MODE - MANDATORY CONSTRAINTS:**\n${knowledgeBaseContext}\n\n**CRITICAL RULES (HARD CONSTRAINTS):**
1. Use ONLY concepts, methods, and difficulty levels that appear in the curriculum/textbook material above.
2. Do NOT introduce ANY external concepts, advanced topics, or methods not explicitly shown in the material.
3. Match the EXACT difficulty level shown in the examples provided.
4. If the curriculum defines boundaries (e.g., "up to 100", "without fractions") - respect them strictly.
5. When in doubt, use SIMPLER content rather than more advanced content.`;
        } else {
            contextPart = `Topic: "${topic}"`;
            logger.warn(`⚠️ No Knowledge Base content found for topic "${topic}" at grade ${gradeLevel} - generating without curriculum constraints`);
        }

        const bloomSteps = getBloomDistribution(stepCount, bloomPreferences);

        // Get linguistic constraints for this grade level
        const linguisticConstraints = getLinguisticConstraintsByGrade(gradeLevel);

        const prompt = `
            Task: Create a "Skeleton" for a learning unit.
            ${contextPart}
            **TARGET AUDIENCE: ${gradeLevel}**
            ${personalityInstruction}
            Mode: ${mode === 'exam' || productType === 'exam' ? 'STRICT EXAMINATION / TEST MODE' : (productType === 'game' ? 'GAMIFICATION / PLAY MODE' : 'Learning/Tutorial Mode')}
            Count: Exactly ${stepCount} steps.
            Language: Hebrew.

            **CRITICAL - LANGUAGE ADAPTATION (HARD CONSTRAINT):**
            ${linguisticConstraints}

            BLOOM TAXONOMY REQUIREMENTS:
            ${JSON.stringify(bloomSteps)}

            MISSION:
            1. **Holistic Analysis:** Read the ENTIRE source text first.
            2. **SEGMENTATION STRATEGY:** Divorce the Source Text into ${stepCount} DISTINCT chunks.
            3. **ZERO-TEXT-WALL POLICY:** Ensure frequent interaction.
            4. **Topic Policing:** Define strict narrative_focus vs forbidden_topics.
            5. **LANGUAGE LEVEL:** All titles and narrative_focus descriptions must follow the linguistic constraints above!

            Structure Guide:
            ${structureGuide}

            Output JSON Structure:
            {
              "unit_title": "String (age-appropriate title following linguistic constraints)",
              "steps": [
                {
                  "step_number": 1,
                  "title": "Title (in age-appropriate language)",
                  "narrative_focus": "Discuss ONLY... (using age-appropriate vocabulary)",
                  "forbidden_topics": ["..."],
                  "bloom_level": "Remember",
                  "suggested_interaction_type": "multiple_choice"
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
            const result = JSON.parse(cleanJsonString(text));

            if (!result.steps || !Array.isArray(result.steps)) {
                logger.warn("Invalid skeleton format received from AI");
                return null;
            }

            // Cache the result (if no custom parameters)
            if (!sourceText && !bloomPreferences) {
                const cacheKey = getSkeletonCacheKey(topic, gradeLevel, activityLength === 'short' ? 3 : (activityLength === 'long' ? 7 : 5), mode || 'learning');
                const TTL_7_DAYS = 7 * 24 * 60 * 60 * 1000;
                await setCache(cacheKey, result, TTL_7_DAYS, [topic, gradeLevel]);
                logger.info(`Cached skeleton: ${cacheKey}`);
            }

            return result;

        } catch (error: any) {
            logger.error("Vault Student Skeleton Error:", error);
            throw new HttpsError('internal', error.message);
        }
    });

    // --- 2. Generate Step Content ---
    const generateStepContent = onCall({ cors: true, secrets: [openaiApiKey] }, async (request) => {
        const openai = getOpenAIClient(openaiApiKey.value()); // Use connection pool
        const { topic, stepInfo, gradeLevel, sourceText, fileData, mode } = request.data;
        logger.info(`Vault: Generating Step ${stepInfo?.step_number} Content`);

        // Check cache (skip if custom sourceText or fileData)
        if (!sourceText && !fileData && stepInfo?.description) {
            const cacheKey = getStepContentCacheKey(stepInfo.step_number, topic, stepInfo.description);
            const cached = await getCached(cacheKey);

            if (cached) {
                logger.info(`Cache hit for step content: ${cacheKey}`);
                return cached;
            }
        }

        // Dynamic Linguistic Constraints based on Grade Level (CEFR Standards)
        const linguisticConstraints = getLinguisticConstraintsByGrade(gradeLevel);

        // Fetch Knowledge Base context if no sourceText provided
        let knowledgeBaseContext = "";
        const kbGrade = gradeToKBFormat(gradeLevel);
        const stepNarrativeFocus = stepInfo?.narrative_focus || stepInfo?.description || topic;
        if (!sourceText && stepNarrativeFocus && kbGrade) {
            try {
                logger.info(`🔍 Step ${stepInfo?.step_number}: Fetching KB context for "${stepNarrativeFocus}"`);
                const knowledgeService = new KnowledgeService(openaiApiKey.value());
                knowledgeBaseContext = await knowledgeService.searchForPromptContext(stepNarrativeFocus, kbGrade, {
                    includeTeacherGuide: true,
                    maxChunks: 3 // Smaller context for step content
                });
                if (knowledgeBaseContext) {
                    logger.info(`📚 Step ${stepInfo?.step_number}: KB returned ${knowledgeBaseContext.length} chars`);
                }
            } catch (kbError: any) {
                logger.warn(`Step ${stepInfo?.step_number}: KB lookup failed: ${kbError.message}`);
            }
        }

        // Build context: prioritize sourceText, then Knowledge Base
        let contextText: string;
        if (sourceText) {
            contextText = `Source: ${sourceText.substring(0, 3000)}...`;
        } else if (knowledgeBaseContext) {
            contextText = `Topic: ${topic}\n\n**STRICT CURRICULUM MODE - MANDATORY:**\n${knowledgeBaseContext}\n\n**HARD CONSTRAINTS:**
- Generate ONLY content that matches the curriculum/textbook material above.
- Do NOT exceed the difficulty level shown in the examples.
- Do NOT introduce concepts not present in the material.`;
        } else {
            contextText = `Topic: ${topic}`;
            logger.warn(`⚠️ Step content: No KB content for topic "${topic}" at grade - generating without curriculum constraints`);
        }

        const prompt = getStepContentPrompt(
            contextText,
            "", // examEnforcer
            stepInfo,
            mode,
            linguisticConstraints,
            gradeLevel
        );

        const userContent: any[] = [{ type: "text", text: prompt }];
        if (fileData) {
            const dataUrl = `data:${fileData.mimeType};base64,${fileData.base64}`;
            userContent.push({ type: "image_url", image_url: { url: dataUrl } });
        }

        try {
            const completion = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [{ role: "user", content: userContent as any }],
                response_format: { type: "json_object" },
                temperature: 0.7
            });

            const text = completion.choices[0].message.content || "{}";
            const result = JSON.parse(cleanJsonString(text));

            // Exam Enforcer Logic (Backend Side)
            if (mode === 'exam' && result) {
                result.teach_content = "";
                if (result.data) result.data.progressive_hints = [];
            }

            // Cache the result (if no custom parameters)
            if (!sourceText && !fileData && stepInfo?.description) {
                const cacheKey = getStepContentCacheKey(stepInfo.step_number, topic, stepInfo.description);
                const TTL_7_DAYS = 7 * 24 * 60 * 60 * 1000;
                await setCache(cacheKey, result, TTL_7_DAYS, [topic, gradeLevel]);
                logger.info(`Cached step content: ${cacheKey}`);
            }

            return result;

        } catch (error: any) {
            logger.error("Vault Step Error:", error);
            throw new HttpsError('internal', error.message);
        }
    });

    // --- 3. Generate Podcast ---
    const generatePodcastScript = onCall({ cors: true, secrets: [openaiApiKey] }, async (request) => {
        const openai = new OpenAI({ apiKey: openaiApiKey.value() });
        const { sourceText, topic, gradeLevel, activityLength } = request.data;

        logger.info(`Podcast Generation: topic="${topic}", grade="${gradeLevel}", length="${activityLength}", hasSourceText=${!!sourceText}`);

        // Determine exchange count based on length
        const exchangeCountMap: Record<string, { min: number; max: number }> = {
            short: { min: 8, max: 10 },
            medium: { min: 12, max: 15 },
            long: { min: 18, max: 22 }
        };
        const exchanges = exchangeCountMap[activityLength || 'medium'] || exchangeCountMap.medium;

        // Grade-level language adaptation
        const gradeLanguageMap: Record<string, string> = {
            "כיתה א׳": "שפה פשוטה מאוד, משפטים קצרים, מילים בסיסיות, הסברים עם דוגמאות מהחיים היומיומיים של ילדים קטנים",
            "כיתה ב׳": "שפה פשוטה מאוד, משפטים קצרים, מילים בסיסיות, הסברים עם דוגמאות מהחיים היומיומיים של ילדים קטנים",
            "כיתה ג׳": "שפה פשוטה, משפטים ברורים, הסברים עם דוגמאות קונקרטיות",
            "כיתה ד׳": "שפה פשוטה, משפטים ברורים, הסברים עם דוגמאות קונקרטיות",
            "כיתה ה׳": "שפה ברורה, אפשר להשתמש במושגים בסיסיים עם הסבר",
            "כיתה ו׳": "שפה ברורה, אפשר להשתמש במושגים בסיסיים עם הסבר",
            "כיתה ז׳": "שפה מורכבת יותר, מושגים מקצועיים עם הסברים",
            "כיתה ח׳": "שפה מורכבת יותר, מושגים מקצועיים עם הסברים",
            "כיתה ט׳": "שפה אקדמית בגובה העיניים, מושגים מקצועיים",
            "כיתה י׳": "שפה אקדמית, מושגים מקצועיים, ניתוח מעמיק",
            "כיתה י״א": "שפה אקדמית, מושגים מקצועיים, ניתוח מעמיק",
            "כיתה י״ב": "שפה אקדמית מלאה, מושגים מתקדמים, דיון ברמה גבוהה",
            "סטודנטים": "שפה אקדמית מלאה, מושגים מתקדמים, דיון ברמה גבוהה",
            "מכינה": "שפה אקדמית מלאה, מושגים מתקדמים",
            "הכשרה מקצועית": "שפה מקצועית וטכנית, מונחים מהתחום"
        };
        const languageStyle = gradeLanguageMap[gradeLevel || "כיתה ז׳"] || "שפה ברורה ומותאמת לגיל";

        // If no sourceText provided (topic mode), generate educational content first
        let contentForPodcast = sourceText;
        if (!sourceText || sourceText.trim().length < 100) {
            logger.info(`Generating educational content for topic: ${topic}`);

            const contentPrompt = `
אתה מורה מומחה. כתוב תוכן חינוכי מקיף על הנושא: "${topic}"
קהל היעד: ${gradeLevel || "כיתה ז׳"}
סגנון שפה: ${languageStyle}

הנחיות:
1. כתוב תוכן חינוכי עשיר ומפורט (800-1500 מילים)
2. כלול מושגי מפתח, הסברים, דוגמאות ועובדות מעניינות
3. התאם את השפה לרמת הגיל
4. הוסף "טיפים" או "האם ידעת?" לעניין
5. כתוב בעברית שוטפת

פלט: טקסט חינוכי בלבד (ללא JSON, ללא כותרות מיוחדות).
`;

            try {
                const contentCompletion = await openai.chat.completions.create({
                    model: MODEL_NAME,
                    messages: [{ role: "user", content: contentPrompt }],
                    temperature: 0.7,
                    max_tokens: 2000
                });
                contentForPodcast = contentCompletion.choices[0].message.content || "";
                logger.info(`Generated ${contentForPodcast.length} characters of educational content`);
            } catch (contentError: any) {
                logger.error("Failed to generate educational content:", contentError);
                throw new HttpsError('internal', 'לא הצלחנו לייצר תוכן לפודקאסט. נסה להעלות מסמך או להדביק טקסט.');
            }
        }

        // Character limit validation
        const MAX_CHARS = 15000;
        const truncatedContent = contentForPodcast.substring(0, MAX_CHARS);
        if (contentForPodcast.length > MAX_CHARS) {
            logger.warn(`Content truncated from ${contentForPodcast.length} to ${MAX_CHARS} characters`);
        }

        const prompt = `
אתה מפיק פודקאסטים חינוכיים מוביל. צור תסריט פודקאסט "Deep Dive" בין שני מגישים.

הדמויות:
1. **דן (Dan)** - המומחה: אנליטי, מדויק, אוהב אנלוגיות. מסביר את המושגים העמוקים.
2. **נועה (Noa)** - הסקרנית: נלהבת, שואלת שאלות שכולם חושבים עליהן, מסכמת בפשטות.

הנחיות סגנון:
- ${languageStyle}
- שיחה טבעית ולא הרצאה
- התחל עם "Cold Open" - עובדה מפתיעה או שאלה מסקרנת
- הוסף הפסקות ("רגע, מה?"), הסכמות ("בדיוק!"), הומור קל
- ${exchanges.min}-${exchanges.max} החלפות דיבור בסה"כ

מקור התוכן (בסס את התסריט רק על זה):
"""
${truncatedContent}
"""

נושא: ${topic || "התוכן שלמעלה"}

פורמט פלט (JSON בלבד):
{
  "title": "כותרת קליטה לפרק",
  "lines": [
    { "speaker": "Noa", "text": "...", "emotion": "Curious" },
    { "speaker": "Dan", "text": "...", "emotion": "Neutral" }
  ]
}

אפשרויות emotion: "Curious", "Skeptical", "Excited", "Neutral"
שפה: עברית שוטפת ומדוברת.
`;

        try {
            const completion = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
                temperature: 0.8
            });
            const text = completion.choices[0].message.content || "{}";
            const result = JSON.parse(cleanJsonString(text));

            // Validate result structure
            if (!result.title || !result.lines || !Array.isArray(result.lines) || result.lines.length < 4) {
                logger.error("Invalid podcast script structure:", result);
                throw new HttpsError('internal', 'התסריט שנוצר אינו תקין. נסה שוב.');
            }

            logger.info(`Podcast generated: "${result.title}" with ${result.lines.length} lines`);
            return result;
        } catch (error: any) {
            logger.error("Vault Podcast Error:", error);
            throw new HttpsError('internal', error.message);
        }
    });

    // --- 4. Generate Mind Map ---
    const generateMindMapFromContent = onCall({ cors: true, secrets: [openaiApiKey] }, async (request) => {
        const openai = new OpenAI({ apiKey: openaiApiKey.value() });
        const { sourceText, topic, gradeLevel, maxNodes = 12 } = request.data;

        logger.info(`Mind Map Generation: topic="${topic}", grade="${gradeLevel}", maxNodes=${maxNodes}`);

        // Grade-level complexity adaptation
        const gradeComplexityMap: Record<string, { maxDepth: number; termLevel: string }> = {
            "כיתה א׳": { maxDepth: 2, termLevel: "מושגים בסיסיים מאוד, מילים פשוטות" },
            "כיתה ב׳": { maxDepth: 2, termLevel: "מושגים בסיסיים מאוד, מילים פשוטות" },
            "כיתה ג׳": { maxDepth: 2, termLevel: "מושגים פשוטים, משפטים קצרים" },
            "כיתה ד׳": { maxDepth: 3, termLevel: "מושגים פשוטים עם הסברים" },
            "כיתה ה׳": { maxDepth: 3, termLevel: "מושגים ברורים" },
            "כיתה ו׳": { maxDepth: 3, termLevel: "מושגים ברורים עם קשרים" },
            "כיתה ז׳": { maxDepth: 4, termLevel: "מושגים מקצועיים בסיסיים" },
            "כיתה ח׳": { maxDepth: 4, termLevel: "מושגים מקצועיים בסיסיים" },
            "כיתה ט׳": { maxDepth: 4, termLevel: "מושגים מקצועיים" },
            "כיתה י׳": { maxDepth: 5, termLevel: "מושגים מקצועיים מתקדמים" },
            "כיתה י״א": { maxDepth: 5, termLevel: "מושגים מקצועיים מתקדמים" },
            "כיתה י״ב": { maxDepth: 5, termLevel: "מושגים אקדמיים" },
            "סטודנטים": { maxDepth: 6, termLevel: "מושגים אקדמיים מתקדמים" },
        };
        const complexity = gradeComplexityMap[gradeLevel] || { maxDepth: 3, termLevel: "מושגים ברורים" };

        const MAX_CHARS = 10000;
        const truncatedContent = (sourceText || "").substring(0, MAX_CHARS);

        // Calculate base position for RTL layout (root on right)
        const baseX = 600;
        const baseY = 250;

        const prompt = `
אתה מומחה ליצירת מפות חשיבה (Mind Maps) חינוכיות.
צור מפת חשיבה מהתוכן הבא:

תוכן מקור:
"""
${truncatedContent}
"""

נושא מרכזי: ${topic || "התוכן שלמעלה"}
קהל יעד: ${gradeLevel || "כיתה ז׳"}
רמת מורכבות מושגים: ${complexity.termLevel}

הנחיות:
1. הנושא המרכזי יהיה בצומת הראשי (root) - במרכז המפה
2. מקסימום ${maxNodes} צמתים בסך הכל
3. עומק מקסימלי: ${complexity.maxDepth} רמות
4. כל צומת צריך להכיל טקסט קצר וברור (מקסימום 5 מילים)
5. הקשרים (edges) צריכים להיות הגיוניים - מהכללי לפרטי
6. השתמש בצבעים שונים לפי רמת עומק:
   - ראשי (topic): #3B82F6 (כחול)
   - משני (subtopic): #10B981 (ירוק)
   - שלישי (detail): #F59E0B (כתום)
   - דוגמאות (example): #8B5CF6 (סגול)
7. הפריסה צריכה להיות מרכזית עם ענפים לכל הכיוונים
8. מרחק אופקי בין רמות: 200 פיקסלים
9. מרחק אנכי בין צמתים באותה רמה: 80 פיקסלים

פורמט פלט (JSON בלבד):
{
  "title": "כותרת המפה",
  "nodes": [
    {
      "id": "1",
      "type": "topic",
      "data": { "label": "הנושא המרכזי", "color": "#3B82F6" },
      "position": { "x": ${baseX}, "y": ${baseY} }
    },
    {
      "id": "2",
      "type": "subtopic",
      "data": { "label": "תת-נושא 1", "color": "#10B981" },
      "position": { "x": ${baseX - 200}, "y": ${baseY - 100} }
    }
  ],
  "edges": [
    { "id": "e1-2", "source": "1", "target": "2" }
  ],
  "suggestedLayout": "RL"
}

חשוב:
- ודא שכל הצמתים מחוברים למפה (אין צמתים "יתומים")
- הצומת הראשי (id: "1") הוא תמיד ה-root
- כל צומת אחר מחובר דרך edge לצומת הורה
- שפה: עברית בלבד
`;

        try {
            const completion = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
                temperature: 0.7
            });

            const result = JSON.parse(cleanJsonString(completion.choices[0].message.content || "{}"));

            // Validate structure
            if (!result.title || !result.nodes || !Array.isArray(result.nodes) || result.nodes.length < 2) {
                logger.error("Invalid mind map structure:", result);
                throw new HttpsError('internal', 'מבנה מפת החשיבה אינו תקין. נסה שוב.');
            }

            // Validate all nodes have required fields
            for (const node of result.nodes) {
                if (!node.id || !node.data?.label || !node.position) {
                    logger.error("Invalid node structure:", node);
                    throw new HttpsError('internal', 'צומת לא תקין במפה. נסה שוב.');
                }
            }

            logger.info(`Mind Map generated: "${result.title}" with ${result.nodes.length} nodes`);
            return result;
        } catch (error: any) {
            logger.error("Mind Map Generation Error:", error);
            throw new HttpsError('internal', error.message);
        }
    });

    return { generateTeacherLessonPlan, generateStudentUnitSkeleton, generateStepContent, generatePodcastScript, generateMindMapFromContent };
};
