/**
 * Streaming Server for SSE Content Generation
 *
 * This module provides Server-Sent Events (SSE) support for real-time
 * content streaming from Gemini AI to the client.
 *
 * Architecture:
 * - Express server running on Cloud Run
 * - SSE endpoints for each content type
 * - Streaming Gemini responses chunk by chunk
 * - Firebase Auth integration for security
 */

import express from 'express';
import corsMiddleware from 'cors';
import * as logger from 'firebase-functions/logger';
import { getAuth } from 'firebase-admin/auth';
import { GoogleGenAI } from '@google/genai';
import { getSkeletonPrompt, getStepContentPrompt, getLinguisticConstraintsByGrade } from '../ai/prompts';

// ============================================================
// CONFIGURATION
// ============================================================

const GEMINI_MODEL = 'gemini-3-pro-preview';
const GEMINI_FLASH_MODEL = 'gemini-2.0-flash';  // Fast model for skeleton generation
const CORS_ORIGINS = [
  'https://ai-lms-pro.web.app',
  'https://ai-lms-pro.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:3000'
];

// ============================================================
// TYPES
// ============================================================

export interface StreamRequest {
  type: 'lesson' | 'exam' | 'activity' | 'differentiated' | 'podcast';
  prompt: string;
  systemPrompt?: string;
  options?: {
    temperature?: number;
    maxTokens?: number;
    gradeLevel?: string;
    subject?: string;
    topic?: string;
    isDifferentiated?: boolean;
    activityLength?: string;
  };
}

export interface StreamChunk {
  type: 'text' | 'json_partial' | 'json_complete' | 'error' | 'done' | 'progress';
  content: string;
  metadata?: {
    chunkIndex?: number;
    totalExpected?: number;
    itemType?: string;
    level?: string;
    // Activity streaming fields
    phase?: 'skeleton' | 'steps' | 'complete' | 'content' | 'parallel_start';
    stepNumber?: number;
    totalSteps?: number;
    stepCount?: number;
    skeleton?: any;
    // Timing metrics
    duration?: number;
    totalTime?: number;
    skeletonTime?: number;
    contentTime?: number;
    // Lesson streaming
    method?: string;
  };
}

// ============================================================
// GEMINI STREAMING CLIENT
// ============================================================

let geminiClient: GoogleGenAI | null = null;

const getGeminiClient = (): GoogleGenAI => {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    geminiClient = new GoogleGenAI({ apiKey });
    logger.info('Gemini streaming client initialized');
  }
  return geminiClient;
};

/**
 * Stream content from Gemini and yield chunks
 */
export async function* streamFromGemini(
  prompt: string,
  systemPrompt?: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    useFastModel?: boolean;  // Use Flash model for faster generation
  } = {}
): AsyncGenerator<string, void, unknown> {
  const client = getGeminiClient();

  // Build full prompt
  let fullPrompt = systemPrompt ? `${systemPrompt}\n\n` : '';
  fullPrompt += prompt;

  // Choose model based on speed requirements
  const model = options.useFastModel ? GEMINI_FLASH_MODEL : GEMINI_MODEL;

  try {
    const response = await client.models.generateContentStream({
      model,
      contents: fullPrompt,
      config: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 16384
      }
    });

    // Stream chunks as they arrive
    for await (const chunk of response) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        yield text;
      }
    }
  } catch (error: any) {
    logger.error(`Gemini streaming error (${model}):`, error);
    throw error;
  }
}

// ============================================================
// SSE HELPERS
// ============================================================

/**
 * Send an SSE event to the client
 */
function sendSSE(res: express.Response, event: string, data: StreamChunk): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Verify Firebase ID token
 */
async function verifyAuth(req: express.Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    logger.warn('Auth token verification failed:', error);
    return null;
  }
}

// ============================================================
// EXPRESS APP
// ============================================================

export const app = express();

// Middleware
app.use(corsMiddleware({
  origin: CORS_ORIGINS,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'streaming-server' });
});

// ============================================================
// STREAMING ENDPOINTS
// ============================================================

/**
 * Main streaming endpoint
 * POST /stream/content
 *
 * Streams content generation in real-time using SSE
 */
app.post('/stream/content', async (req, res) => {
  // Verify authentication
  const userId = await verifyAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const streamRequest = req.body as StreamRequest;

  if (!streamRequest.prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  logger.info(`🌊 Starting stream for user ${userId}`, {
    type: streamRequest.type,
    promptLength: streamRequest.prompt.length
  });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Send initial progress event
  sendSSE(res, 'progress', {
    type: 'progress',
    content: 'Starting generation...',
    metadata: { chunkIndex: 0 }
  });

  try {
    let chunkIndex = 0;
    let fullContent = '';

    // Stream from Gemini
    for await (const chunk of streamFromGemini(
      streamRequest.prompt,
      streamRequest.systemPrompt,
      {
        temperature: streamRequest.options?.temperature,
        maxTokens: streamRequest.options?.maxTokens
      }
    )) {
      fullContent += chunk;
      chunkIndex++;

      // Send text chunk
      sendSSE(res, 'chunk', {
        type: 'text',
        content: chunk,
        metadata: { chunkIndex }
      });
    }

    // Try to parse as JSON if applicable
    let parsedJson = null;
    try {
      // Clean up potential JSON
      let jsonText = fullContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const jsonMatch = jsonText.match(/\{[\s\S]*\}/) || jsonText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedJson = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Not valid JSON, that's okay
    }

    // Send completion event
    sendSSE(res, 'done', {
      type: 'done',
      content: parsedJson ? JSON.stringify(parsedJson) : fullContent,
      metadata: {
        chunkIndex: chunkIndex + 1,
        totalExpected: chunkIndex + 1
      }
    });

    logger.info(`✅ Stream completed for user ${userId}`, {
      type: streamRequest.type,
      totalChunks: chunkIndex,
      contentLength: fullContent.length
    });

  } catch (error: any) {
    logger.error('Streaming error:', error);
    sendSSE(res, 'error', {
      type: 'error',
      content: error.message || 'Generation failed'
    });
  }

  res.end();
});

/**
 * Differentiated content streaming endpoint
 * POST /stream/differentiated
 *
 * Streams 3-level differentiated content (support, core, enrichment)
 * Uses the SAME quality prompts as /stream/activity but with learningLevel parameter
 * Uses PARALLEL generation for 3x faster results
 */
app.post('/stream/differentiated', async (req, res) => {
  // Verify authentication
  const userId = await verifyAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { topic, gradeLevel, subject, sourceText, productType, activityLength, questionPreferences, contentTone } = req.body;

  if (!topic && !sourceText) {
    res.status(400).json({ error: 'topic or sourceText is required' });
    return;
  }

  const stepCount = activityLength === 'short' ? 3 : (activityLength === 'long' ? 7 : 5);

  logger.info(`🧬 Starting UPGRADED differentiated stream for user ${userId}`, {
    topic,
    gradeLevel,
    stepCount,
    productType
  });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Hebrew level names with their learning level values
  const levels = [
    { key: 'support', name: 'הבנה', learningLevel: 'הבנה' },
    { key: 'core', name: 'יישום', learningLevel: 'יישום' },
    { key: 'enrichment', name: 'העמקה', learningLevel: 'העמקה' }
  ];

  // Send initial progress
  sendSSE(res, 'progress', {
    type: 'progress',
    content: 'מייצר 3 רמות במקביל (באיכות גבוהה)...',
    metadata: { totalExpected: 3, stepCount }
  });

  const questionTypes = questionPreferences?.allowedTypes?.join(', ') ||
    'multiple_choice, true_false, matching, memory_game, categorization, ordering, fill_in_blank, open_question';

  try {
    const startTime = Date.now();

    // 🚀 PARALLEL GENERATION using SAME flow as /stream/activity
    const generateLevelWithFullFlow = async (level: typeof levels[0]) => {
      const levelStartTime = Date.now();

      // ============ PHASE 1: GENERATE SKELETON (using full prompts) ============
      const skeletonPrompt = buildActivitySkeletonPrompt(
        topic,
        gradeLevel,
        sourceText,
        stepCount,
        undefined, // mode
        productType || 'activity',
        contentTone || 'friendly',
        level.learningLevel // Pass learning level for differentiated constraints
      );

      // Use FLASH model for skeleton
      let skeletonContent = '';
      for await (const chunk of streamFromGemini(skeletonPrompt, undefined, {
        temperature: 0.7,
        maxTokens: 4096,
        useFastModel: true
      })) {
        skeletonContent += chunk;
      }

      // Parse skeleton
      let skeleton: any = null;
      try {
        let jsonText = skeletonContent
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          skeleton = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        logger.warn(`Failed to parse skeleton for level ${level.key}:`, e);
        skeleton = {
          unit_title: topic,
          steps: Array.from({ length: stepCount }, (_, i) => ({
            step_number: i + 1,
            title: `שלב ${i + 1}`,
            narrative_focus: topic,
            bloom_level: 'Understand',
            suggested_interaction_type: 'multiple_choice'
          }))
        };
      }

      const skeletonTime = Date.now() - levelStartTime;
      logger.info(`📋 [${level.key}] Skeleton generated in ${skeletonTime}ms with ${skeleton.steps?.length || 0} steps`);

      // ============ PHASE 2: GENERATE ALL STEPS IN PARALLEL ============
      const stepPromises = (skeleton.steps || []).map(async (step: any, index: number) => {
        const stepPrompt = buildStepContentPrompt(
          topic,
          gradeLevel,
          sourceText,
          step,
          undefined, // mode
          questionTypes,
          productType || 'activity',
          contentTone || 'friendly',
          level.learningLevel // Pass learning level for differentiated constraints
        );

        let stepContent = '';
        for await (const chunk of streamFromGemini(stepPrompt, undefined, {
          temperature: 0.7,
          maxTokens: 4096
        })) {
          stepContent += chunk;
        }

        // Parse step content
        let parsed: any = null;
        try {
          let jsonText = stepContent
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          logger.warn(`[${level.key}] Failed to parse step ${index + 1}:`, e);
          parsed = { error: 'parse_failed' };
        }

        // 🛡️ VALIDATION: Ensure step has valid interaction type and data
        parsed = validateAndFixActivityStep(parsed, step, index + 1, topic);

        // Ensure learning_level is set
        if (parsed && !parsed.error) {
          parsed.learning_level = level.learningLevel;
        }

        return {
          stepNumber: index + 1,
          ...step,
          ...parsed,
          learning_level: level.learningLevel
        };
      });

      const completedSteps = await Promise.all(stepPromises);
      completedSteps.sort((a, b) => a.stepNumber - b.stepNumber);

      const levelTime = Date.now() - levelStartTime;
      logger.info(`✅ [${level.key}] Level completed in ${levelTime}ms with ${completedSteps.length} steps`);

      return {
        level,
        skeleton,
        steps: completedSteps,
        metadata: {
          generationTime: levelTime,
          stepCount: completedSteps.length
        }
      };
    };

    // Run all 3 levels in parallel
    const results = await Promise.all(levels.map(level => generateLevelWithFullFlow(level)));

    // Send results for each level
    for (const result of results) {
      sendSSE(res, 'level_start', {
        type: 'progress',
        content: `${result.level.name} מוכן`,
        metadata: { level: result.level.key }
      });

      // Send full result with skeleton and steps (same format as /stream/activity)
      sendSSE(res, 'level_complete', {
        type: 'json_complete',
        content: JSON.stringify({
          title: result.skeleton?.unit_title || topic,
          steps: result.steps,
          skeleton: result.skeleton,
          context_image_prompt: result.skeleton?.context_image_prompt,
          learning_level: result.level.learningLevel,
          metadata: result.metadata
        }),
        metadata: { level: result.level.key }
      });
    }

    // Send final done event
    const totalTime = Date.now() - startTime;
    sendSSE(res, 'done', {
      type: 'done',
      content: 'כל הרמות נוצרו בהצלחה (באיכות גבוהה)',
      metadata: {
        totalExpected: 3,
        totalTime,
        stepCount // Use existing property name instead of stepCountPerLevel
      }
    });

    logger.info(`✅ Upgraded differentiated stream completed for user ${userId} in ${totalTime}ms`);

  } catch (error: any) {
    logger.error('Differentiated streaming error:', error);
    sendSSE(res, 'error', {
      type: 'error',
      content: error.message || 'Generation failed'
    });
  }

  res.end();
});

/**
 * Lesson plan streaming endpoint (Master Teacher V2)
 * POST /stream/lesson
 *
 * Streams full lesson plan generation with PARALLEL part generation.
 * Returns the same format as generateTeacherLessonParallel:
 * - lesson_metadata, hook, direct_instruction (Part 1)
 * - guided_practice, independent_practice, discussion, summary (Part 2)
 *
 * Uses Flash model for Hook and Summary, Pro for core instruction and practice.
 */
app.post('/stream/lesson', async (req, res) => {
  // Verify authentication
  const userId = await verifyAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { topic, gradeLevel, subject, sourceText, sourceType } = req.body;

  if (!topic) {
    res.status(400).json({ error: 'topic is required' });
    return;
  }

  // Determine source type
  const effectiveSourceType = sourceType ||
    (sourceText && sourceText.includes('TRANSCRIPT:') ? 'YOUTUBE' :
     sourceText && sourceText.length > 100 ? 'TEXT_FILE' : 'TOPIC_ONLY');

  logger.info(`📚 Starting Master Teacher lesson stream for user ${userId}`, {
    topic,
    gradeLevel,
    sourceType: effectiveSourceType
  });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const startTime = Date.now();

    // ============ PARALLEL GENERATION: Part 1 + Part 2 ============
    sendSSE(res, 'progress', {
      type: 'progress',
      content: 'מייצר מערך שיעור במקביל...',
      metadata: { phase: 'parallel_start' }
    });

    // Build prompts for both parts
    const part1Prompt = buildMasterTeacherPart1Prompt(topic, gradeLevel, sourceText, effectiveSourceType);
    const part2Prompt = buildMasterTeacherPart2Prompt(topic, gradeLevel, sourceText);

    // Generate both parts in parallel
    const [part1Result, part2Result] = await Promise.all([
      // Part 1: Hook + Direct Instruction (use Flash for hook metadata, Pro for instruction)
      (async () => {
        sendSSE(res, 'part_start', {
          type: 'progress',
          content: 'מייצר פתיחה והוראה ישירה...',
          metadata: { itemType: 'part1' }
        });

        let content = '';
        for await (const chunk of streamFromGemini(part1Prompt, undefined, {
          temperature: 0.7,
          maxTokens: 8192,
          useFastModel: false  // Use Pro for quality content
        })) {
          content += chunk;
        }

        // Parse JSON with robust extraction
        let parsed = null;
        try {
          parsed = robustJsonParse(content, 'Part1');
        } catch (e) {
          logger.warn('Failed to parse Part1:', e);
        }

        // Validate and ensure required fields exist
        if (parsed) {
          parsed = validateAndFixPart1(parsed, topic, gradeLevel);
          sendSSE(res, 'part1_complete', {
            type: 'json_complete',
            content: JSON.stringify(parsed),
            metadata: { itemType: 'part1', duration: Date.now() - startTime }
          });
        }

        return parsed;
      })(),

      // Part 2: Practice + Discussion + Summary
      (async () => {
        sendSSE(res, 'part_start', {
          type: 'progress',
          content: 'מייצר תרגול וסיכום...',
          metadata: { itemType: 'part2' }
        });

        let content = '';
        for await (const chunk of streamFromGemini(part2Prompt, undefined, {
          temperature: 0.7,
          maxTokens: 8192,
          useFastModel: false  // Use Pro for quality content
        })) {
          content += chunk;
        }

        logger.info(`📝 Part2 raw content length: ${content.length} chars`);

        // Parse JSON with robust extraction
        let parsed = null;
        try {
          parsed = robustJsonParse(content, 'Part2');
          logger.info(`✅ Part2 parsed successfully. Keys: ${parsed ? Object.keys(parsed).join(', ') : 'null'}`);
        } catch (e) {
          logger.warn('Failed to parse Part2:', e);
          logger.warn(`Part2 content preview: ${content.substring(0, 500)}`);
        }

        // Log what AI actually returned BEFORE validation
        logger.info(`🔎 Part2 BEFORE validation:`);
        logger.info(`   independent_practice exists: ${!!parsed?.independent_practice}`);
        logger.info(`   interactive_blocks: ${JSON.stringify(parsed?.independent_practice?.interactive_blocks || 'MISSING').substring(0, 500)}`);
        logger.info(`   guided_practice.example_questions: ${JSON.stringify(parsed?.guided_practice?.example_questions || 'MISSING').substring(0, 300)}`);

        // Validate and fix Part2 - ALWAYS run to ensure required fields exist
        parsed = validateAndFixPart2(parsed || {}, topic);
        logger.info(`📋 Part2 after validation. Keys: ${Object.keys(parsed).join(', ')}`);
        logger.info(`   guided_practice exists: ${!!parsed.guided_practice}`);
        logger.info(`   discussion exists: ${!!parsed.discussion}`);
        logger.info(`   summary exists: ${!!parsed.summary}`);

        sendSSE(res, 'part2_complete', {
          type: 'json_complete',
          content: JSON.stringify(parsed),
          metadata: { itemType: 'part2', duration: Date.now() - startTime }
        });

        return parsed;
      })()
    ]);

    // Combine into full lesson plan
    // Part2 is now ALWAYS validated inside its async function, so we can use it directly
    const finalPart1 = part1Result || validateAndFixPart1({}, topic, gradeLevel);
    const finalPart2 = part2Result || validateAndFixPart2({}, topic);

    logger.info(`📊 Final assembly - Part1 result: ${part1Result ? 'OK' : 'FALLBACK'}, Part2 result: ${part2Result ? 'OK' : 'FALLBACK'}`);

    const fullLessonPlan = {
      lesson_metadata: finalPart1.lesson_metadata,
      hook: finalPart1.hook,
      direct_instruction: finalPart1.direct_instruction,
      guided_practice: finalPart2.guided_practice,
      independent_practice: finalPart2.independent_practice,
      discussion: finalPart2.discussion,
      summary: finalPart2.summary
    };

    logger.info(`📊 Full lesson plan sections: ${Object.keys(fullLessonPlan).filter(k => fullLessonPlan[k as keyof typeof fullLessonPlan]).join(', ')}`);
    logger.info(`   guided_practice?.teacher_facilitation_script: ${fullLessonPlan.guided_practice?.teacher_facilitation_script ? 'EXISTS' : 'MISSING'}`);
    logger.info(`   independent_practice?.interactive_blocks: ${fullLessonPlan.independent_practice?.interactive_blocks?.length || 0} blocks`);
    logger.info(`   discussion?.questions length: ${fullLessonPlan.discussion?.questions?.length || 0}`);
    logger.info(`   summary?.takeaway_sentence: ${fullLessonPlan.summary?.takeaway_sentence ? 'EXISTS' : 'MISSING'}`);

    const totalTime = Date.now() - startTime;

    // Send full lesson plan
    sendSSE(res, 'done', {
      type: 'json_complete',
      content: JSON.stringify(fullLessonPlan),
      metadata: {
        totalTime,
        method: 'streaming_parallel'
      }
    });

    logger.info(`✅ Lesson stream completed for user ${userId} in ${totalTime}ms`);

  } catch (error: any) {
    logger.error('Lesson streaming error:', error);
    sendSSE(res, 'error', {
      type: 'error',
      content: error.message || 'Generation failed'
    });
  }

  res.end();
});

/**
 * Build Master Teacher Part 1 Prompt (Hook + Metadata + Direct Instruction)
 */
function buildMasterTeacherPart1Prompt(
  topic: string,
  gradeLevel: string | undefined,
  sourceText: string | undefined,
  sourceType: string
): string {
  const contentToInject = sourceType === 'TOPIC_ONLY' ? topic : (sourceText?.substring(0, 15000) || topic);
  const grade = gradeLevel || 'כיתה ה';

  return `You are a Master Teacher creating PART 1 of a lesson plan (Hook + Direct Instruction).

CONTEXT:
- Topic: "${topic}"
- Grade: "${grade}"
- Source: ${sourceType === 'YOUTUBE' ? 'YouTube video' : sourceType === 'TEXT_FILE' ? 'Text document' : 'Topic only'}
${sourceType !== 'TOPIC_ONLY' ? `- Content: """${contentToInject}"""` : ''}

Generate ONLY these sections in Hebrew:

1. LESSON_METADATA:
   - title: Catchy lesson title about the SUBJECT MATTER (Hebrew, no prefix)
     CRITICAL: Title must be about the CONTENT topic (e.g., "פסולת ומחזור", "מחזור המים")
     DO NOT create titles about META-SKILLS (e.g., "ניתוח טקסט מידעי", "הבנת הנקרא")
   - target_audience: "${grade}"
   - duration: "45 min"
   - subject: Subject area
   - learning_objectives: 2-3 specific objectives about the CONTENT

2. HOOK (5 min):
   - script_for_teacher: Engaging opening script (80-120 words, conversational Hebrew)
   - media_asset: { type: "${sourceType === 'YOUTUBE' ? 'youtube_timestamp' : 'illustration'}", content: "${sourceType === 'YOUTUBE' ? 'timestamp range' : 'detailed image prompt for curiosity-provoking visual'}" }
   - classroom_management_tip: One practical tip

3. DIRECT_INSTRUCTION (15 min):
   - slides: Array of 3-4 slides, each with:
     * slide_title: Hebrew title
     * bullet_points_for_board: 3-5 points
     * script_to_say: 80-120 words conversational Hebrew
     * media_asset: { type: "none", content: "" }
     * timing_estimate: e.g., "3-5 דקות"
     * differentiation_note: Tips for struggling/advanced students

OUTPUT: Valid JSON only (no markdown, no explanations).
{
  "lesson_metadata": { ... },
  "hook": { ... },
  "direct_instruction": { "slides": [...] }
}`;
}

/**
 * Build Master Teacher Part 2 Prompt (Practice + Discussion + Summary)
 */
function buildMasterTeacherPart2Prompt(
  topic: string,
  gradeLevel: string | undefined,
  sourceText: string | undefined
): string {
  const contentToInject = sourceText ? sourceText.substring(0, 10000) : topic;
  const grade = gradeLevel || 'כיתה ה';

  return `You are a Master Teacher creating PART 2 of a lesson plan (Practice + Discussion + Summary).

CONTEXT:
- Topic: "${topic}"
- Grade: "${grade}"
- Learning Objectives:
  - הבנת ${topic}
  - יישום עקרונות ${topic}
- Content reference: """${contentToInject}"""

⚠️ CRITICAL: You MUST fill ALL fields with real Hebrew content. Empty or placeholder values are NOT acceptable!

Generate these sections in Hebrew:

1. GUIDED_PRACTICE (10 min):
   - teacher_facilitation_script: 2-3 sentences explaining how to introduce practice
   - example_questions: EXACTLY 2 questions, each with ALL these fields:
     * question_text: The actual question in Hebrew
     * expected_answer: The correct answer
     * common_mistakes: Array of 1-2 common wrong answers
     * follow_up_prompt: A follow-up question
   - worked_example: { problem: "specific problem", solution_steps: ["שלב 1", "שלב 2", "שלב 3"], key_points: ["נקודה 1", "נקודה 2"] }
   - differentiation_strategies: { for_struggling_students: "specific help", for_advanced_students: "specific challenge" }
   - assessment_tips: ["tip 1", "tip 2"]

2. INDEPENDENT_PRACTICE (10 min - Digital activities):
   - introduction_text: Brief instructions in Hebrew
   - interactive_blocks: Generate EXACTLY 2 activities. Choose 2 DIFFERENT types:

     OPTION A - multiple-choice (MUST have exactly 4 options):
     {
       "type": "multiple-choice",
       "data": {
         "question": "שאלה ספציפית בעברית?",
         "options": ["תשובה א", "תשובה ב", "תשובה ג", "תשובה ד"],
         "correct_answer": "תשובה א"
       }
     }

     OPTION B - categorization (MUST have 4+ items):
     {
       "type": "categorization",
       "data": {
         "question": "מיינו את הפריטים לקטגוריות:",
         "categories": ["קטגוריה 1", "קטגוריה 2"],
         "items": [
           { "text": "פריט 1", "category": "קטגוריה 1" },
           { "text": "פריט 2", "category": "קטגוריה 2" },
           { "text": "פריט 3", "category": "קטגוריה 1" },
           { "text": "פריט 4", "category": "קטגוריה 2" }
         ]
       }
     }

     OPTION C - fill_in_blanks:
     {
       "type": "fill_in_blanks",
       "data": {
         "text": "משפט עם ___ מילים ___ חסרות",
         "word_bank": ["מילה1", "מילה2", "מסיח1", "מסיח2"]
       }
     }

     OPTION D - ordering (MUST have 4+ items):
     {
       "type": "ordering",
       "data": {
         "instruction": "סדרו את השלבים בסדר הנכון:",
         "correct_order": ["שלב 1", "שלב 2", "שלב 3", "שלב 4"]
       }
     }

   - estimated_duration: "10-15 דקות"

3. DISCUSSION (5 min):
   - questions: Array of 3 STRING questions (NOT objects!), easy to hard:
     ["שאלה קלה?", "שאלה בינונית?", "שאלה מאתגרת?"]
   - facilitation_tips: Array of 2 STRING tips:
     ["טיפ 1", "טיפ 2"]

4. SUMMARY (5 min):
   - takeaway_sentence: One memorable Hebrew sentence
   - visual_summary: { "type": "infographic", "content": "Detailed prompt about ${topic} - describe the key concepts to visualize" }
   - homework_suggestion: Optional homework in Hebrew

OUTPUT: Valid JSON only. Fill EVERY field with real content!`;
}

/**
 * Validate and fix Part2 response (ensures all required fields exist)
 */
/**
 * Robust JSON parser that handles various Gemini output formats
 */
function robustJsonParse(content: string, partName: string): any {
  // Step 1: Clean up markdown code blocks
  let cleanContent = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Step 2: Try direct parse first
  try {
    return JSON.parse(cleanContent);
  } catch (e) {
    // Continue to more aggressive parsing
  }

  // Step 3: Find JSON object boundaries (handle nested objects)
  const firstBrace = cleanContent.indexOf('{');
  if (firstBrace === -1) {
    logger.warn(`${partName}: No JSON object found in response`);
    return null;
  }

  // Find matching closing brace
  let braceCount = 0;
  let lastBrace = -1;
  for (let i = firstBrace; i < cleanContent.length; i++) {
    if (cleanContent[i] === '{') braceCount++;
    if (cleanContent[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        lastBrace = i;
        break;
      }
    }
  }

  if (lastBrace === -1) {
    logger.warn(`${partName}: Unbalanced braces in JSON`);
    // Try to fix by adding closing braces
    const openBraces = (cleanContent.match(/{/g) || []).length;
    const closeBraces = (cleanContent.match(/}/g) || []).length;
    cleanContent += '}'.repeat(openBraces - closeBraces);
    lastBrace = cleanContent.lastIndexOf('}');
  }

  const jsonStr = cleanContent.substring(firstBrace, lastBrace + 1);

  // Step 4: Try to parse extracted JSON
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Step 5: Try to fix common JSON errors
    let fixedJson = jsonStr
      // Fix trailing commas
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      // Fix missing quotes on keys (simple cases)
      .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
      // Fix single quotes
      .replace(/'/g, '"');

    try {
      return JSON.parse(fixedJson);
    } catch (e2) {
      logger.error(`${partName}: Failed to parse JSON even after fixes`, {
        originalLength: content.length,
        extractedLength: jsonStr.length
      });
      return null;
    }
  }
}

/**
 * Validate and fix Part1 result to ensure all required fields exist
 */
function validateAndFixPart1(result: any, topic: string, gradeLevel?: string): any {
  const grade = gradeLevel || 'כיתה ה';

  // Ensure lesson_metadata exists with all required fields
  if (!result.lesson_metadata) {
    result.lesson_metadata = {};
  }
  result.lesson_metadata.title = result.lesson_metadata.title || topic;
  result.lesson_metadata.target_audience = result.lesson_metadata.target_audience || grade;
  result.lesson_metadata.duration = result.lesson_metadata.duration || '45 min';
  result.lesson_metadata.subject = result.lesson_metadata.subject || 'כללי';

  // CRITICAL: Ensure learning_objectives exists
  if (!result.lesson_metadata.learning_objectives || !Array.isArray(result.lesson_metadata.learning_objectives)) {
    result.lesson_metadata.learning_objectives = [
      `להבין את המושגים המרכזיים של ${topic}`,
      `ליישם את העקרונות שנלמדו בהקשרים שונים`
    ];
  }

  // Ensure hook exists with all required fields
  if (!result.hook) {
    result.hook = {};
  }
  result.hook.script_for_teacher = result.hook.script_for_teacher || `היום נלמד על ${topic}. מי יכול לנחש למה זה חשוב?`;
  result.hook.classroom_management_tip = result.hook.classroom_management_tip || 'ודאו שכל התלמידים קשובים לפני שמתחילים';

  // Ensure media_asset exists (even if minimal)
  if (!result.hook.media_asset) {
    result.hook.media_asset = {
      type: 'illustration',
      content: `Educational illustration representing ${topic}`
    };
  }

  // Ensure direct_instruction exists with slides
  if (!result.direct_instruction) {
    result.direct_instruction = {};
  }
  if (!result.direct_instruction.slides || !Array.isArray(result.direct_instruction.slides) || result.direct_instruction.slides.length === 0) {
    result.direct_instruction.slides = [
      {
        slide_title: `מבוא ל${topic}`,
        bullet_points_for_board: [`הגדרה של ${topic}`, 'מאפיינים עיקריים', 'דוגמאות מהחיים'],
        script_to_say: `בואו נתחיל בלהבין מה זה ${topic}. זהו נושא חשוב שנפגוש בהמשך חיינו.`,
        media_asset: { type: 'none', content: '' },
        timing_estimate: '5 דקות',
        differentiation_note: 'לתלמידים מתקשים - הדגימו עם דוגמאות מוחשיות'
      },
      {
        slide_title: 'מושגי יסוד',
        bullet_points_for_board: ['מושג ראשון', 'מושג שני', 'הקשר ביניהם'],
        script_to_say: 'עכשיו נלמד את המושגים החשובים שצריך להכיר.',
        media_asset: { type: 'none', content: '' },
        timing_estimate: '5 דקות',
        differentiation_note: 'לתלמידים מתקדמים - בקשו דוגמאות נוספות'
      }
    ];
  }

  return result;
}

function validateAndFixPart2(result: any, topic: string): any {
  // Ensure guided_practice exists with all required fields
  if (!result.guided_practice) {
    result.guided_practice = {};
  }
  result.guided_practice.teacher_facilitation_script = result.guided_practice.teacher_facilitation_script ||
    `עכשיו נתרגל יחד. אני אציג שאלה ונפתור אותה צעד אחר צעד.`;
  result.guided_practice.example_questions = result.guided_practice.example_questions || [
    {
      question_text: `שאלה לדוגמה על ${topic}`,
      expected_answer: 'תשובה לדוגמה',
      common_mistakes: ['טעות נפוצה 1'],
      follow_up_prompt: 'האם אתם מבינים למה?'
    }
  ];
  result.guided_practice.worked_example = result.guided_practice.worked_example || {
    problem: `בעיה לדוגמה בנושא ${topic}`,
    solution_steps: ['שלב 1: הבנת הבעיה', 'שלב 2: פתרון', 'שלב 3: בדיקה'],
    key_points: ['נקודה חשובה 1', 'נקודה חשובה 2']
  };
  result.guided_practice.differentiation_strategies = result.guided_practice.differentiation_strategies || {
    for_struggling_students: 'חזרו על ההסבר עם דוגמה נוספת',
    for_advanced_students: 'בקשו מהם להסביר לחבר'
  };
  result.guided_practice.assessment_tips = result.guided_practice.assessment_tips || [
    'שימו לב לתלמידים שמתקשים',
    'בקשו מתלמידים להסביר את הפתרון'
  ];

  // Ensure discussion.questions is array of strings
  if (result.discussion?.questions) {
    result.discussion.questions = result.discussion.questions.map((q: any) => {
      if (typeof q === 'string') return q;
      if (typeof q === 'object') return q.question || q.text || q.question_text || `שאלה על ${topic}`;
      return `שאלה על ${topic}`;
    });
  } else {
    result.discussion = result.discussion || {};
    result.discussion.questions = [`מה למדתם היום על ${topic}?`, `איך אפשר ליישם את מה שלמדנו?`, `מה הפתיע אתכם?`];
  }

  // Ensure discussion.facilitation_tips is array of strings
  if (result.discussion?.facilitation_tips) {
    result.discussion.facilitation_tips = result.discussion.facilitation_tips.map((tip: any) => {
      if (typeof tip === 'string') return tip;
      if (typeof tip === 'object') return tip.tip || tip.text || 'עודדו תלמידים להרחיב';
      return 'עודדו תלמידים להרחיב';
    });
  } else {
    result.discussion.facilitation_tips = ['שאלו "למה אתה חושב ככה?"', 'תנו זמן לחשיבה לפני תשובות'];
  }

  // Ensure independent_practice has valid interactive_blocks
  if (!result.independent_practice?.interactive_blocks || result.independent_practice.interactive_blocks.length === 0) {
    result.independent_practice = result.independent_practice || {};
    result.independent_practice.introduction_text = result.independent_practice.introduction_text || `בצעו את הפעילויות הבאות על ${topic}:`;
    result.independent_practice.interactive_blocks = [
      {
        type: 'multiple-choice',
        data: {
          question: `מהי הנקודה המרכזית שלמדנו היום בנושא ${topic}?`,
          options: [
            `הבנת העקרונות הבסיסיים של ${topic}`,
            'נושא לא קשור ללמידה',
            'מידע שגוי לחלוטין',
            'אף תשובה אינה נכונה'
          ],
          correct_answer: `הבנת העקרונות הבסיסיים של ${topic}`
        }
      },
      {
        type: 'ordering',
        data: {
          instruction: `סדרו את השלבים בסדר הנכון ללמידת ${topic}:`,
          correct_order: [
            'הכרת המושגים הבסיסיים',
            'הבנת הקשרים בין המושגים',
            'יישום הידע בדוגמאות',
            'סיכום והפקת מסקנות'
          ]
        }
      }
    ];
    result.independent_practice.estimated_duration = '10-15 דקות';
  }

  // Ensure summary exists
  if (!result.summary?.takeaway_sentence) {
    result.summary = result.summary || {};
    result.summary.takeaway_sentence = `היום למדנו על ${topic} והבנו את החשיבות שלו.`;
  }
  if (!result.summary?.visual_summary) {
    result.summary.visual_summary = {
      type: 'infographic',
      content: `Create an infographic summarizing the key concepts of ${topic}`
    };
  }

  return result;
}

/**
 * Validate and fix activity step content
 * Ensures each step has valid interaction type and data
 * Provides fallback content if AI response is invalid
 */
function validateAndFixActivityStep(
  parsed: any,
  stepInfo: any,
  stepNumber: number,
  topic: string
): any {
  // If parsing completely failed, create fallback step
  if (!parsed || parsed.error === 'parse_failed') {
    logger.warn(`🔧 Step ${stepNumber} parse failed - creating fallback content`);
    return createFallbackStep(stepInfo, stepNumber, topic);
  }

  // Validate selected_interaction exists and is valid
  const validInteractions = [
    'multiple_choice', 'multiple-choice',
    'true_false', 'true-false', 'true_false_speed',
    'ordering', 'sequencing',
    'categorization', 'grouping',
    'matching',
    'fill_in_blank', 'fill-in-blank', 'fill_blanks', 'fill-blanks',
    'open_question', 'open-question', 'open_ended',
    'memory_game', 'memory-game',
    'teach_then_ask'
  ];

  let interactionType = parsed.selected_interaction ||
                        parsed.data?.selected_interaction ||
                        stepInfo.suggested_interaction_type ||
                        'multiple_choice';

  // Normalize the interaction type
  interactionType = interactionType.replace(/-/g, '_').toLowerCase();

  if (!validInteractions.includes(interactionType)) {
    logger.warn(`🔧 Step ${stepNumber} has invalid interaction type "${interactionType}" - defaulting to multiple_choice`);
    interactionType = 'multiple_choice';
  }

  // Ensure parsed has selected_interaction
  parsed.selected_interaction = interactionType;

  // Ensure data object exists
  if (!parsed.data) {
    parsed.data = {};
  }

  // Validate data based on interaction type
  switch (interactionType) {
    case 'multiple_choice':
    case 'multiple-choice':
    case 'true_false':
    case 'true-false':
    case 'true_false_speed':
    case 'teach_then_ask':
      parsed.data = validateMultipleChoice(parsed.data, topic, stepNumber);
      break;

    case 'ordering':
    case 'sequencing':
      parsed.data = validateOrdering(parsed.data, topic, stepNumber);
      break;

    case 'categorization':
    case 'grouping':
      parsed.data = validateCategorization(parsed.data, topic, stepNumber);
      break;

    case 'matching':
      parsed.data = validateMatching(parsed.data, topic, stepNumber);
      break;

    case 'fill_in_blank':
    case 'fill-in-blank':
    case 'fill_blanks':
    case 'fill-blanks':
      parsed.data = validateFillInBlank(parsed.data, topic, stepNumber);
      break;

    case 'open_question':
    case 'open-question':
    case 'open_ended':
      parsed.data = validateOpenQuestion(parsed.data, topic, stepNumber);
      break;

    case 'memory_game':
    case 'memory-game':
      parsed.data = validateMemoryGame(parsed.data, topic, stepNumber);
      break;

    default:
      // Fallback to multiple choice validation
      parsed.data = validateMultipleChoice(parsed.data, topic, stepNumber);
  }

  return parsed;
}

/**
 * Create a complete fallback step when parsing fails
 */
function createFallbackStep(stepInfo: any, stepNumber: number, topic: string): any {
  return {
    selected_interaction: 'multiple_choice',
    bloom_level: stepInfo.bloom_level || 'ידע',
    teach_content: '',
    data: {
      question: `שאלה ${stepNumber} בנושא ${topic}`,
      options: [
        `תשובה נכונה בנושא ${topic}`,
        'תשובה שגויה א',
        'תשובה שגויה ב',
        'תשובה שגויה ג'
      ],
      correct_answer: `תשובה נכונה בנושא ${topic}`,
      feedback_correct: 'כל הכבוד! תשובה נכונה.',
      feedback_incorrect: 'לא נכון, נסה שוב.'
    }
  };
}

/**
 * Validate multiple choice data
 */
function validateMultipleChoice(data: any, topic: string, stepNumber: number): any {
  // Ensure question exists
  if (!data.question || typeof data.question !== 'string' || data.question.trim() === '') {
    data.question = data.question_text || data.text || `שאלה ${stepNumber} בנושא ${topic}`;
  }

  // Ensure options array exists with at least 2 options
  if (!Array.isArray(data.options) || data.options.length < 2) {
    logger.warn(`🔧 Step ${stepNumber} MC: Invalid options - creating fallback`);
    data.options = [
      `תשובה נכונה בנושא ${topic}`,
      'תשובה שגויה א',
      'תשובה שגויה ב',
      'תשובה שגויה ג'
    ];
    data.correct_answer = data.options[0];
  }

  // Normalize options to strings
  data.options = data.options.map((opt: any) => {
    if (typeof opt === 'string') return opt;
    return opt.text || opt.label || opt.content || String(opt);
  });

  // Ensure correct_answer exists and matches an option
  if (!data.correct_answer || !data.options.includes(data.correct_answer)) {
    // Try to find correct answer by is_correct flag
    if (Array.isArray(data.options)) {
      const correctOpt = data.options.find((o: any) =>
        typeof o === 'object' && (o.is_correct || o.isCorrect)
      );
      if (correctOpt) {
        data.correct_answer = typeof correctOpt === 'string' ? correctOpt : correctOpt.text;
      }
    }
    // Fallback to first option
    if (!data.correct_answer || !data.options.includes(data.correct_answer)) {
      data.correct_answer = data.options[0];
    }
  }

  // Ensure feedback exists
  data.feedback_correct = data.feedback_correct || 'כל הכבוד! תשובה נכונה.';
  data.feedback_incorrect = data.feedback_incorrect || 'לא נכון, נסה שוב.';

  return data;
}

/**
 * Validate ordering/sequencing data
 */
function validateOrdering(data: any, topic: string, stepNumber: number): any {
  // Ensure instruction exists
  if (!data.instruction && !data.question) {
    data.instruction = `סדרו את השלבים הבאים בסדר הנכון - ${topic}:`;
  }
  data.instruction = data.instruction || data.question;

  // Ensure correct_order array exists with at least 2 items
  let items = data.correct_order || data.items || data.steps || [];

  // Normalize to strings
  items = items.map((item: any) => {
    if (typeof item === 'string') return item;
    return item.text || item.step || item.content || String(item);
  }).filter((item: string) => item && item.trim() !== '');

  if (items.length < 2) {
    logger.warn(`🔧 Step ${stepNumber} Ordering: Invalid items - creating fallback`);
    items = [
      'שלב ראשון',
      'שלב שני',
      'שלב שלישי',
      'שלב רביעי'
    ];
  }

  data.correct_order = items;
  data.feedback_correct = data.feedback_correct || 'מצוין! סידרת נכון.';
  data.feedback_incorrect = data.feedback_incorrect || 'לא בסדר הנכון, נסה שוב.';

  return data;
}

/**
 * Validate categorization/grouping data
 */
function validateCategorization(data: any, topic: string, stepNumber: number): any {
  // Ensure instruction exists
  data.instruction = data.instruction || data.question || `מיינו את הפריטים לקטגוריות - ${topic}:`;

  // Ensure categories exist
  if (!Array.isArray(data.categories) || data.categories.length < 2) {
    logger.warn(`🔧 Step ${stepNumber} Categorization: Invalid categories - creating fallback`);
    data.categories = ['קטגוריה א', 'קטגוריה ב'];
  }

  // Ensure items exist with category assignments
  if (!Array.isArray(data.items) || data.items.length < 2) {
    data.items = [
      { text: 'פריט 1', category: data.categories[0] },
      { text: 'פריט 2', category: data.categories[1] }
    ];
  }

  // Normalize items to have text and category
  data.items = data.items.map((item: any, idx: number) => {
    if (typeof item === 'string') {
      return { text: item, category: data.categories[idx % data.categories.length] };
    }
    return {
      text: item.text || item.content || String(item),
      category: item.category || item.group || data.categories[0]
    };
  });

  return data;
}

/**
 * Validate matching data (line drawing)
 */
function validateMatching(data: any, topic: string, stepNumber: number): any {
  data.instruction = data.instruction || data.question || `התאימו בין הפריטים - ${topic}:`;

  // Handle new format (leftItems/rightItems)
  if (data.leftItems || data.left_items) {
    data.leftItems = data.leftItems || data.left_items || [];
    data.rightItems = data.rightItems || data.right_items || [];
    data.correctMatches = data.correctMatches || data.correct_matches || [];

    if (data.leftItems.length < 2) {
      data.leftItems = [{ id: '1', text: 'פריט 1' }, { id: '2', text: 'פריט 2' }];
      data.rightItems = [{ id: 'a', text: 'התאמה 1' }, { id: 'b', text: 'התאמה 2' }];
      data.correctMatches = [{ left: '1', right: 'a' }, { left: '2', right: 'b' }];
    }
    return data;
  }

  // Handle old format (pairs)
  if (!Array.isArray(data.pairs) || data.pairs.length < 2) {
    logger.warn(`🔧 Step ${stepNumber} Matching: Invalid pairs - creating fallback`);
    data.pairs = [
      { left: 'פריט 1', right: 'התאמה 1' },
      { left: 'פריט 2', right: 'התאמה 2' }
    ];
  }

  return data;
}

/**
 * Validate fill-in-blank data
 */
function validateFillInBlank(data: any, topic: string, stepNumber: number): any {
  // Ensure text with blanks exists
  if (!data.text_with_blanks && !data.sentence) {
    data.text_with_blanks = `משפט לדוגמה בנושא ${topic} עם _____ למילוי.`;
  }
  data.text_with_blanks = data.text_with_blanks || data.sentence;

  // Ensure correct_answers exists
  if (!Array.isArray(data.correct_answers) || data.correct_answers.length === 0) {
    data.correct_answers = data.answer ? [data.answer] : ['תשובה'];
  }

  // Ensure distractors exist (optional but helpful)
  if (!Array.isArray(data.distractors)) {
    data.distractors = ['הסחה 1', 'הסחה 2'];
  }

  return data;
}

/**
 * Validate open question data
 */
function validateOpenQuestion(data: any, topic: string, stepNumber: number): any {
  // Ensure question exists
  if (!data.question || typeof data.question !== 'string') {
    data.question = data.question_text || data.text || `שאלה פתוחה ${stepNumber} בנושא ${topic}`;
  }

  // Ensure model answer/guidelines exist
  if (!data.model_answer && !data.teacher_guidelines) {
    data.model_answer = 'התשובה צריכה להתייחס לנקודות המרכזיות בחומר הלימוד.';
  }

  return data;
}

/**
 * Validate memory game data
 */
function validateMemoryGame(data: any, topic: string, stepNumber: number): any {
  data.instruction = data.instruction || `משחק זיכרון - ${topic}`;

  // Ensure pairs exist
  if (!Array.isArray(data.pairs) || data.pairs.length < 3) {
    logger.warn(`🔧 Step ${stepNumber} Memory: Invalid pairs - creating fallback`);
    data.pairs = [
      { term: 'מושג 1', match: 'הגדרה 1' },
      { term: 'מושג 2', match: 'הגדרה 2' },
      { term: 'מושג 3', match: 'הגדרה 3' }
    ];
  }

  return data;
}

// ============================================================
// PROMPT BUILDERS
// ============================================================

// NOTE: buildDifferentiatedPrompt was removed and replaced with the full
// activity flow (skeleton + steps) using buildActivitySkeletonPrompt and
// buildStepContentPrompt with the learningLevel parameter.

function buildLessonPartPrompt(
  topic: string,
  gradeLevel: string,
  subject: string,
  sourceText: string | undefined,
  part: string
): string {
  const partDescriptions: Record<string, string> = {
    hook: 'פתיחה מעוררת עניין - שאלה מפתיעה, סיפור קצר, או דילמה שתעורר סקרנות',
    instruction: 'הוראה ישירה - הסבר ברור של המושגים המרכזיים עם דוגמאות',
    practice: 'תרגול מודרך - פעילויות אינטראקטיביות לתרגול החומר',
    summary: 'סיכום ורפלקציה - חיבור הנקודות המרכזיות ושאלות לחשיבה'
  };

  return `אתה מורה מומחה. צור ${partDescriptions[part]} לשיעור.

נושא: ${topic}
כיתה: ${gradeLevel}
מקצוע: ${subject}
${sourceText ? `\nחומר מקור:\n${sourceText}` : ''}

צור תוכן מותאם לגיל התלמידים עם שפה ברורה.

החזר JSON בפורמט:
{
  "title": "כותרת הקטע",
  "content": "תוכן טקסטואלי",
  "blocks": [
    {
      "type": "text|question|activity",
      "content": "..."
    }
  ]
}

החזר רק JSON תקין.`;
}

function getPartName(part: string): string {
  const names: Record<string, string> = {
    hook: 'פתיחה',
    instruction: 'הוראה',
    practice: 'תרגול',
    summary: 'סיכום'
  };
  return names[part] || part;
}

// ============================================================
// PODCAST STREAMING ENDPOINT
// ============================================================

/**
 * Podcast streaming endpoint
 * POST /stream/podcast
 *
 * Streams podcast script generation (Dan & Noa dialogue)
 */
app.post('/stream/podcast', async (req, res) => {
  // Verify authentication
  const userId = await verifyAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { topic, gradeLevel, sourceText, activityLength } = req.body;

  if (!topic) {
    res.status(400).json({ error: 'topic is required' });
    return;
  }

  logger.info(`🎙️ Starting podcast stream for user ${userId}`, {
    topic,
    gradeLevel,
    activityLength
  });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial progress
  sendSSE(res, 'progress', {
    type: 'progress',
    content: 'מתחיל לייצר סקריפט פודקאסט...',
    metadata: { itemType: 'podcast' }
  });

  try {
    const prompt = buildPodcastPrompt(topic, gradeLevel, sourceText, activityLength);
    let fullContent = '';
    let chunkIndex = 0;

    // Stream from Gemini
    for await (const chunk of streamFromGemini(prompt, undefined, {
      temperature: 0.8, // Higher creativity for dialogue
      maxTokens: 8192
    })) {
      fullContent += chunk;
      chunkIndex++;

      sendSSE(res, 'chunk', {
        type: 'text',
        content: chunk,
        metadata: { chunkIndex, itemType: 'podcast' }
      });
    }

    // Try to parse as JSON
    let parsedScript = null;
    try {
      let jsonText = fullContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedScript = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      logger.warn('Failed to parse podcast script as JSON');
    }

    // Send completion event
    sendSSE(res, 'done', {
      type: parsedScript ? 'json_complete' : 'text',
      content: parsedScript ? JSON.stringify(parsedScript) : fullContent,
      metadata: { itemType: 'podcast' }
    });

    logger.info(`✅ Podcast stream completed for user ${userId}`);

  } catch (error: any) {
    logger.error('Podcast streaming error:', error);
    sendSSE(res, 'error', {
      type: 'error',
      content: error.message || 'Podcast generation failed'
    });
  }

  res.end();
});

/**
 * Build podcast prompt
 */
function buildPodcastPrompt(
  topic: string,
  gradeLevel: string | undefined,
  sourceText: string | undefined,
  activityLength: string | undefined
): string {
  // Determine dialogue length based on activityLength
  const exchangeCount = activityLength === 'short' ? '8-10' :
                        activityLength === 'long' ? '18-22' : '12-15';

  return `צור סקריפט לפודקאסט "צלילה לעומק" בין שני מנחים: דן ונועה.

נושא: ${topic}
${gradeLevel ? `קהל יעד: תלמידי ${gradeLevel}` : ''}
${sourceText ? `\nחומר מקור:\n"""${sourceText.substring(0, 15000)}"""` : ''}

תפקידים:
- דן: נלהב, משתמש באנלוגיות, שואל שאלות "תמימות" כדי להבהיר דברים
- נועה: המומחית, ספקנית אך ברורה, מביאה את הנתונים

הנחיות:
- כתוב בעברית טבעית ומדוברת
- צור בערך ${exchangeCount} חילופי דברים
- הסגנון: שיחתי, כיפי, כמו NotebookLM
- התאם את השפה לרמת הקהל
- כלול הומור קל ודוגמאות מהחיים

החזר JSON בפורמט:
{
  "title": "כותרת יצירתית לפרק",
  "lines": [
    { "speaker": "דן", "text": "...", "emotion": "נלהב" },
    { "speaker": "נועה", "text": "...", "emotion": "ניטרלי" }
  ]
}

החזר רק JSON תקין, ללא טקסט נוסף.`;
}

// ============================================================
// SINGLE ACTIVITY STREAMING ENDPOINT
// ============================================================

/**
 * Single activity streaming endpoint
 * POST /stream/activity
 *
 * Streams a complete activity with skeleton and all step content in one call.
 * Uses PARALLEL generation for all steps simultaneously.
 *
 * This replaces the old flow of:
 * 1. generateStudentUnitSkeleton (Cloud Function)
 * 2. generateStepContent x N (Cloud Functions, sequential)
 *
 * With a single streaming call that:
 * 1. Generates skeleton (fast)
 * 2. Generates all steps in PARALLEL
 * 3. Streams progress updates to the client
 */
app.post('/stream/activity', async (req, res) => {
  // Verify authentication
  const userId = await verifyAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const {
    topic,
    gradeLevel,
    subject,
    sourceText,
    activityLength,
    mode,
    productType, // activity | lesson | exam - determines content style
    questionPreferences,
    contentTone // friendly | professional | playful | neutral
  } = req.body;

  if (!topic && !sourceText) {
    res.status(400).json({ error: 'topic or sourceText is required' });
    return;
  }

  const stepCount = activityLength === 'short' ? 3 : (activityLength === 'long' ? 7 : 5);

  logger.info(`🚀 Starting STREAMING activity generation for user ${userId}`, {
    topic,
    gradeLevel,
    stepCount,
    hasSourceText: !!sourceText
  });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const startTime = Date.now();

    // ============ PHASE 1: GENERATE SKELETON ============
    sendSSE(res, 'progress', {
      type: 'progress',
      content: 'מייצר מבנה פעילות...',
      metadata: { phase: 'skeleton', stepCount }
    });

    const skeletonPrompt = buildActivitySkeletonPrompt(
      topic,
      gradeLevel,
      sourceText,
      stepCount,
      mode,
      productType || 'activity', // Pass productType for content style decisions
      contentTone || 'friendly' // Pass contentTone for writing style
    );

    // Use FLASH model for skeleton - it's just structure, not content
    // This significantly reduces skeleton generation time (27s -> ~8s)
    // NOTE: Steps still use Pro model for quality content
    // EXAM MODE: Use lower temperature (0.3) for deterministic output
    const isExamMode = mode === 'exam' || productType === 'exam';
    let skeletonContent = '';
    for await (const chunk of streamFromGemini(skeletonPrompt, undefined, {
      temperature: isExamMode ? 0.3 : 0.7,
      maxTokens: 4096,
      useFastModel: true  // Flash for skeleton only
    })) {
      skeletonContent += chunk;
    }

    // Parse skeleton
    let skeleton: any = null;
    try {
      logger.info(`📝 Skeleton content length: ${skeletonContent.length} chars`);
      logger.info(`📝 Skeleton content preview: ${skeletonContent.substring(0, 300)}`);

      let jsonText = skeletonContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];
        try {
          skeleton = JSON.parse(jsonStr);
        } catch (firstError: any) {
          // Try to fix common JSON issues from LLM output
          logger.warn(`First parse failed: ${firstError.message}. Attempting auto-fix...`);
          jsonStr = jsonStr
            // Fix unescaped newlines inside strings
            .replace(/(?<!\\)\\n/g, '\\n')
            // Fix unescaped quotes inside strings (common LLM mistake)
            .replace(/:\s*"([^"]*?)(?<!\\)"([^"]*?)"/g, ': "$1\\"$2"')
            // Remove trailing commas
            .replace(/,(\s*[}\]])/g, '$1')
            // Fix missing commas between properties
            .replace(/"\s*\n\s*"/g, '",\n"')
            .replace(/}\s*\n\s*{/g, '},\n{');

          skeleton = JSON.parse(jsonStr);
          logger.info('✅ JSON auto-fix successful');
        }
      } else {
        logger.error('No JSON match found in skeleton. Full content:', skeletonContent);
      }
    } catch (e: any) {
      logger.error('Failed to parse skeleton. Error:', e.message);
      logger.error('Skeleton content was:', skeletonContent.substring(0, 1000));
      throw new Error(`Failed to parse activity skeleton: ${e.message}`);
    }

    if (!skeleton || !skeleton.steps || !Array.isArray(skeleton.steps)) {
      logger.error('Invalid skeleton structure. Got:', JSON.stringify(skeleton).substring(0, 500));
      throw new Error('Invalid skeleton format - missing steps array');
    }

    const skeletonTime = Date.now() - startTime;
    logger.info(`📋 Skeleton generated in ${skeletonTime}ms with ${skeleton.steps.length} steps`);

    // Send skeleton to client
    sendSSE(res, 'skeleton_complete', {
      type: 'json_complete',
      content: JSON.stringify(skeleton),
      metadata: {
        phase: 'skeleton',
        duration: skeletonTime,
        stepCount: skeleton.steps.length
      }
    });

    // ============ PHASE 2: GENERATE ALL STEPS IN PARALLEL ============
    sendSSE(res, 'progress', {
      type: 'progress',
      content: `מייצר ${skeleton.steps.length} צעדים במקביל...`,
      metadata: { phase: 'content', totalSteps: skeleton.steps.length }
    });

    const questionTypes = questionPreferences?.allowedTypes?.join(', ') ||
      'multiple_choice, true_false, matching, memory_game, categorization, ordering, fill_in_blank, open_question';

    // Generate all steps in parallel
    const stepPromises = skeleton.steps.map(async (step: any, index: number) => {
      const stepPrompt = buildStepContentPrompt(
        topic,
        gradeLevel,
        sourceText,
        step,
        mode,
        questionTypes,
        productType || 'activity', // Pass productType for content style decisions
        contentTone || 'friendly' // Pass contentTone for writing style
      );

      // EXAM MODE: Use lower temperature (0.3) for deterministic output
      let stepContent = '';
      for await (const chunk of streamFromGemini(stepPrompt, undefined, {
        temperature: isExamMode ? 0.3 : 0.7,
        maxTokens: 4096
      })) {
        stepContent += chunk;
      }

      // Parse step content
      let parsed: any = null;
      try {
        let jsonText = stepContent
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        logger.warn(`Failed to parse step ${index + 1}:`, e);
        parsed = { error: 'parse_failed', rawContent: stepContent };
      }

      // 🛡️ VALIDATION: Ensure step has valid interaction type and data
      parsed = validateAndFixActivityStep(parsed, step, index + 1, topic);

      // EXAM ENFORCER: Ensure exam mode content has no hints or teaching content
      // This is a safety net in case the AI ignores the prompt instructions
      if (isExamMode && parsed && !parsed.error) {
        // Remove teach_content - exams should have no teaching
        if (parsed.teach_content) {
          parsed.teach_content = '';
        }
        // Remove hints - exams should have no scaffolding
        if (parsed.data && parsed.data.progressive_hints) {
          parsed.data.progressive_hints = [];
        }
        if (parsed.progressive_hints) {
          parsed.progressive_hints = [];
        }
        // Log if we had to enforce
        if (parsed.teach_content || (parsed.data?.progressive_hints?.length > 0)) {
          logger.warn(`🛡️ Exam Enforcer: Removed hints/teach_content from step ${index + 1}`);
        }
      }

      return {
        stepNumber: index + 1,
        ...step,
        ...parsed
      };
    });

    // Wait for all steps to complete
    const completedSteps = await Promise.all(stepPromises);

    // Sort by step number and send each one
    completedSteps.sort((a, b) => a.stepNumber - b.stepNumber);

    for (const step of completedSteps) {
      sendSSE(res, 'step_complete', {
        type: 'json_complete',
        content: JSON.stringify(step),
        metadata: {
          phase: 'content',
          stepNumber: step.stepNumber,
          totalSteps: skeleton.steps.length
        }
      });
    }

    // ============ PHASE 3: SEND FINAL RESULT ============
    const totalTime = Date.now() - startTime;

    const finalResult = {
      title: skeleton.unit_title || topic,
      steps: completedSteps,
      skeleton: skeleton,  // Include full skeleton with context_image_prompt
      context_image_prompt: skeleton.context_image_prompt,  // Expose at top level for convenience
      metadata: {
        topic,
        gradeLevel,
        stepCount: completedSteps.length,
        generationTime: totalTime,
        method: 'streaming_parallel'
      }
    };

    sendSSE(res, 'done', {
      type: 'json_complete',
      content: JSON.stringify(finalResult),
      metadata: {
        phase: 'complete',
        totalTime,
        skeletonTime,
        contentTime: totalTime - skeletonTime,
        stepCount: completedSteps.length
      }
    });

    logger.info(`✅ Activity stream completed for user ${userId} in ${totalTime}ms`, {
      skeletonTime,
      contentTime: totalTime - skeletonTime,
      stepCount: completedSteps.length
    });

  } catch (error: any) {
    logger.error('Activity streaming error:', error);
    sendSSE(res, 'error', {
      type: 'error',
      content: error.message || 'Activity generation failed'
    });
  }

  res.end();
});

/**
 * Build activity skeleton prompt - uses the full prompt from prompts.ts
 *
 * @param productType - 'activity' | 'lesson' | 'exam' - determines content style:
 *   - activity: 100% interactive, minimal text, context_image_prompt required
 *   - lesson: teach_content + questions, infographics allowed
 *   - exam: questions only, no hints, no teach_content
 */
function buildActivitySkeletonPrompt(
  topic: string,
  gradeLevel: string | undefined,
  sourceText: string | undefined,
  stepCount: number,
  mode: string | undefined,
  productType: string, // activity | lesson | exam
  contentTone: string = 'friendly', // friendly | professional | playful | neutral
  learningLevel?: string // Optional: 'הבנה' | 'יישום' | 'העמקה' for differentiated content
): string {
  const contextPart = sourceText
    ? `BASE CONTENT ON THIS TEXT ONLY:\n"""${sourceText.substring(0, 15000)}"""\nIgnore outside knowledge if it contradicts the text.`
    : `Topic: "${topic}"`;

  // Build tone instruction based on contentTone
  const toneInstructions: Record<string, string> = {
    friendly: 'חם, ידידותי ומעודד. פנה ישירות לתלמיד בלשון יחיד. השתמש בשפה פשוטה ונגישה.',
    professional: 'מקצועי וממוקד. ישיר וללא הקדמות מיותרות. עניני.',
    playful: 'משחקי וקליל. ניתן להשתמש בהומור קל, להפוך את הלמידה לחוויה מהנה.',
    neutral: 'ניטרלי וישיר. ללא סגנון מיוחד, פשוט ותכליתי.'
  };
  const personalityInstruction = `**WRITING TONE:** ${toneInstructions[contentTone] || toneInstructions.friendly}`;

  // Adjust Bloom levels based on learning level for differentiated content
  let bloomLevels: string[];
  if (learningLevel === 'הבנה') {
    bloomLevels = ['Remember', 'Understand', 'Remember', 'Understand', 'Remember'];
  } else if (learningLevel === 'העמקה') {
    bloomLevels = ['Apply', 'Analyze', 'Evaluate', 'Create', 'Evaluate'];
  } else {
    // Default or יישום
    bloomLevels = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate'];
  }
  const bloomSteps = Array.from({ length: stepCount }, (_, i) =>
    bloomLevels[i % bloomLevels.length]
  );

  const structureGuide = `
    - Step 1: Introduction/Overview (Remember level)
    - Steps 2-${Math.ceil(stepCount/2)}: Core concepts (Understand/Apply)
    - Steps ${Math.ceil(stepCount/2)+1}-${stepCount}: Application/Analysis
  `;

  // Use the full prompt from prompts.ts
  return getSkeletonPrompt(
    contextPart,
    gradeLevel || 'כיתה ה',
    personalityInstruction,
    mode || 'learning',
    productType, // Pass actual productType instead of deriving from mode
    stepCount,
    bloomSteps,
    structureGuide,
    learningLevel // Pass learning level for differentiated constraints
  );
}

/**
 * Build step content prompt - uses the full prompt from prompts.ts
 *
 * @param productType - 'activity' | 'lesson' | 'exam' - determines content style:
 *   - activity: NO teach_content, NO infographics, only scenario_image for dilemmas
 *   - lesson: teach_content required, infographics allowed
 *   - exam: NO teach_content, NO hints, NO images
 */
function buildStepContentPrompt(
  topic: string,
  gradeLevel: string | undefined,
  sourceText: string | undefined,
  stepInfo: any,
  mode: string | undefined,
  questionTypes: string,
  productType: string, // activity | lesson | exam
  contentTone: string = 'friendly', // friendly | professional | playful | neutral
  learningLevel?: string // Optional: 'הבנה' | 'יישום' | 'העמקה' for differentiated content
): string {
  const contextText = sourceText
    ? `Source text:\n"""${sourceText.substring(0, 5000)}"""\n\nTopic: ${topic}`
    : `Topic: ${topic}`;

  // Check both mode AND productType for exam (either can indicate exam mode)
  const isExam = mode === 'exam' || productType === 'exam';
  const examEnforcer = isExam
    ? `**EXAM MODE ACTIVE:** This is an assessment. No teaching content, no hints. Just questions.`
    : '';

  // Use full linguistic constraints based on grade level (from prompts.ts)
  // This provides detailed CEFR-aligned language guidelines for each age group
  const linguisticConstraints = getLinguisticConstraintsByGrade(gradeLevel || 'כיתה ה');

  // Use the full prompt from prompts.ts
  return getStepContentPrompt(
    contextText,
    examEnforcer,
    stepInfo,
    mode || 'learning',
    linguisticConstraints,
    gradeLevel || 'כיתה ה',
    productType, // Pass productType for content style decisions
    contentTone, // Pass contentTone for writing style
    learningLevel // Pass learning level for differentiated constraints
  );
}

// Export the app
export default app;
