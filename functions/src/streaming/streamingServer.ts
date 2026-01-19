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
    phase?: 'skeleton' | 'steps' | 'complete' | 'content';
    stepNumber?: number;
    totalSteps?: number;
    stepCount?: number;
    skeleton?: any;
    // Timing metrics
    duration?: number;
    totalTime?: number;
    skeletonTime?: number;
    contentTime?: number;
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
 * Uses PARALLEL generation for 3x faster results
 */
app.post('/stream/differentiated', async (req, res) => {
  // Verify authentication
  const userId = await verifyAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { topic, gradeLevel, subject, sourceText, productType, activityLength, questionPreferences } = req.body;

  if (!topic) {
    res.status(400).json({ error: 'topic is required' });
    return;
  }

  logger.info(`🧬 Starting PARALLEL differentiated stream for user ${userId}`, {
    topic,
    gradeLevel,
    productType
  });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Hebrew level names: הבנה, יישום, העמקה
  const levels = [
    { key: 'support', name: 'הבנה', bloom: 'remember,understand' },
    { key: 'core', name: 'יישום', bloom: 'apply,analyze' },
    { key: 'enrichment', name: 'העמקה', bloom: 'evaluate,create' }
  ];

  // Send initial progress
  sendSSE(res, 'progress', {
    type: 'progress',
    content: 'מייצר 3 רמות במקביל...',
    metadata: { totalExpected: 3 }
  });

  try {
    // 🚀 PARALLEL GENERATION - Generate all 3 levels simultaneously
    const generateLevel = async (level: typeof levels[0]) => {
      const prompt = buildDifferentiatedPrompt(
        topic,
        gradeLevel,
        subject,
        sourceText,
        level.key,
        level.bloom,
        productType,
        activityLength,
        questionPreferences
      );

      let levelContent = '';

      // Collect all chunks (no streaming per-chunk, just collect)
      for await (const chunk of streamFromGemini(prompt, undefined, {
        temperature: 0.7,
        maxTokens: 8192
      })) {
        levelContent += chunk;
      }

      // Parse JSON
      let parsed: any[] = [];
      try {
        let jsonText = levelContent
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        const jsonMatch = jsonText.match(/\[[\s\S]*\]/) || jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          parsed = Array.isArray(result) ? result : [result];
        }
      } catch (e) {
        logger.warn(`Failed to parse JSON for level ${level.key}`, e);
      }

      return { level, content: parsed };
    };

    // Run all 3 levels in parallel
    const results = await Promise.all(levels.map(level => generateLevel(level)));

    // Send results as each level completes (they all complete ~together)
    for (const result of results) {
      sendSSE(res, 'level_start', {
        type: 'progress',
        content: `${result.level.name} מוכן`,
        metadata: { level: result.level.key }
      });

      sendSSE(res, 'level_complete', {
        type: 'json_complete',
        content: JSON.stringify(result.content),
        metadata: { level: result.level.key }
      });
    }

    // Send final done event
    sendSSE(res, 'done', {
      type: 'done',
      content: 'כל הרמות נוצרו בהצלחה',
      metadata: {
        totalExpected: 3
      }
    });

    logger.info(`✅ Parallel differentiated stream completed for user ${userId}`);

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
 * Lesson plan streaming endpoint
 * POST /stream/lesson
 *
 * Streams lesson plan generation with skeleton first, then content
 */
app.post('/stream/lesson', async (req, res) => {
  // Verify authentication
  const userId = await verifyAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { topic, gradeLevel, subject, sourceText, lessonParts } = req.body;

  if (!topic) {
    res.status(400).json({ error: 'topic is required' });
    return;
  }

  logger.info(`📚 Starting lesson stream for user ${userId}`, {
    topic,
    gradeLevel,
    parts: lessonParts
  });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const parts = lessonParts || ['hook', 'instruction', 'practice', 'summary'];

    for (const part of parts) {
      sendSSE(res, 'part_start', {
        type: 'progress',
        content: `מייצר ${getPartName(part)}...`,
        metadata: { itemType: part }
      });

      const prompt = buildLessonPartPrompt(topic, gradeLevel, subject, sourceText, part);
      let partContent = '';

      for await (const chunk of streamFromGemini(prompt, undefined, {
        temperature: 0.7,
        maxTokens: 4096
      })) {
        partContent += chunk;

        sendSSE(res, 'chunk', {
          type: 'text',
          content: chunk,
          metadata: { itemType: part }
        });
      }

      // Parse and send complete part
      try {
        let jsonText = partContent
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          sendSSE(res, 'part_complete', {
            type: 'json_complete',
            content: JSON.stringify(parsed),
            metadata: { itemType: part }
          });
        }
      } catch (e) {
        sendSSE(res, 'part_complete', {
          type: 'text',
          content: partContent,
          metadata: { itemType: part }
        });
      }
    }

    sendSSE(res, 'done', {
      type: 'done',
      content: 'Lesson plan generated successfully'
    });

    logger.info(`✅ Lesson stream completed for user ${userId}`);

  } catch (error: any) {
    logger.error('Lesson streaming error:', error);
    sendSSE(res, 'error', {
      type: 'error',
      content: error.message || 'Generation failed'
    });
  }

  res.end();
});

// ============================================================
// PROMPT BUILDERS
// ============================================================

function buildDifferentiatedPrompt(
  topic: string,
  gradeLevel: string,
  subject: string,
  sourceText: string | undefined,
  level: string,
  bloomLevels: string,
  productType: string,
  activityLength: string | undefined,
  questionPreferences: any
): string {
  const levelDescriptions: Record<string, string> = {
    support: `רמה תומכת - שאלות בסיסיות ברמות בלום: זכירה והבנה.
השתמש בשפה פשוטה, הוסף רמזים מובנים, והימנע ממסיחים מבלבלים.`,
    core: `רמה רגילה - שאלות ברמות בלום: יישום וניתוח.
השתמש בשפה ברמת הכיתה, צור שאלות מאתגרות אך הוגנות.`,
    enrichment: `רמה מתקדמת - שאלות ברמות בלום: הערכה ויצירה.
השתמש בשפה אקדמית, צור שאלות פתוחות ומאתגרות שדורשות חשיבה מעמיקה.`
  };

  const questionTypes = questionPreferences?.allowedTypes?.join(', ') ||
    'multiple_choice, true_false, matching, ordering';

  return `אתה מומחה בפדגוגיה מותאמת. צור תוכן לימודי ב${levelDescriptions[level]}

נושא: ${topic}
כיתה: ${gradeLevel}
מקצוע: ${subject}
סוג מוצר: ${productType}
אורך פעילות: ${activityLength || 'medium'}
${sourceText ? `\nחומר מקור:\n${sourceText}` : ''}

צור מערך של 3-5 פריטים (שאלות/אינטראקציות) מסוגים: ${questionTypes}

החזר JSON בפורמט הבא:
[
  {
    "type": "question_type",
    "question": "טקסט השאלה",
    "options": ["א", "ב", "ג", "ד"],
    "correctAnswer": "א",
    "hint": "רמז (רק לרמה תומכת)",
    "explanation": "הסבר לתשובה"
  }
]

החזר רק JSON תקין, ללא טקסט נוסף.`;
}

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
    questionPreferences
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
      mode
    );

    // Use FLASH model for skeleton - it's just structure, not content
    // This significantly reduces skeleton generation time (27s -> ~8s)
    // NOTE: Steps still use Pro model for quality content
    let skeletonContent = '';
    for await (const chunk of streamFromGemini(skeletonPrompt, undefined, {
      temperature: 0.7,
      maxTokens: 4096,
      useFastModel: true  // Flash for skeleton only
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
      logger.error('Failed to parse skeleton:', e);
      throw new Error('Failed to parse activity skeleton');
    }

    if (!skeleton || !skeleton.steps || !Array.isArray(skeleton.steps)) {
      throw new Error('Invalid skeleton format');
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
        questionTypes
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
        logger.warn(`Failed to parse step ${index + 1}:`, e);
        parsed = { error: 'parse_failed', rawContent: stepContent };
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
 * Build activity skeleton prompt
 */
function buildActivitySkeletonPrompt(
  topic: string,
  gradeLevel: string | undefined,
  sourceText: string | undefined,
  stepCount: number,
  mode: string | undefined
): string {
  const contextPart = sourceText
    ? `BASE CONTENT ON THIS TEXT ONLY:\n"""${sourceText.substring(0, 15000)}"""\nIgnore outside knowledge if it contradicts the text.`
    : `Topic: "${topic}"`;

  return `Task: Create a "Skeleton" for a learning activity.
${contextPart}

**TARGET AUDIENCE: ${gradeLevel || 'כיתה ה'}**
Mode: ${mode === 'exam' ? 'STRICT EXAMINATION MODE' : 'Learning/Tutorial Mode'}
Count: Exactly ${stepCount} steps.
Language: Hebrew.

Create a learning path with ${stepCount} distinct steps, each focusing on a different aspect of the topic.
Each step should target a different Bloom level for variety.

Output JSON Structure:
{
  "unit_title": "כותרת מותאמת גיל בעברית",
  "context_image_prompt": "A detailed English prompt for generating a context image that represents the topic",
  "steps": [
    {
      "step_number": 1,
      "title": "כותרת הצעד",
      "narrative_focus": "על מה הצעד מתמקד",
      "forbidden_topics": ["נושאים שלא לגעת בהם"],
      "bloom_level": "remember|understand|apply|analyze|evaluate|create",
      "suggested_interaction_type": "multiple_choice|true_false|matching|memory_game|categorization|ordering|fill_in_blank|open_question"
    }
  ]
}

Return ONLY valid JSON, no additional text.`;
}

/**
 * Build step content prompt
 */
function buildStepContentPrompt(
  topic: string,
  gradeLevel: string | undefined,
  sourceText: string | undefined,
  stepInfo: any,
  mode: string | undefined,
  questionTypes: string
): string {
  const contextPart = sourceText
    ? `Source text:\n"""${sourceText.substring(0, 3000)}"""`
    : `Topic: ${topic}`;

  return `Generate content for step ${stepInfo.step_number} of a learning activity.

${contextPart}

Step Information:
- Title: ${stepInfo.title}
- Focus: ${stepInfo.narrative_focus || 'General'}
- Bloom Level: ${stepInfo.bloom_level || 'apply'}
- Suggested Interaction: ${stepInfo.suggested_interaction_type || 'multiple_choice'}
- Forbidden Topics: ${JSON.stringify(stepInfo.forbidden_topics || [])}

Target Audience: ${gradeLevel || 'כיתה ה'}
Mode: ${mode === 'exam' ? 'Examination' : 'Learning'}
Available Question Types: ${questionTypes}

Create engaging content with:
1. A "teach_content" section (2-3 sentences explaining the concept in an engaging way)
2. An interactive question/activity matching the suggested type

Return JSON:
{
  "step_number": ${stepInfo.step_number},
  "bloom_level": "${stepInfo.bloom_level || 'apply'}",
  "teach_content": "הסבר קצר ומעניין בעברית...",
  "selected_interaction": "${stepInfo.suggested_interaction_type || 'multiple_choice'}",
  "data": {
    "progressive_hints": ["רמז 1", "רמז 2"],
    "source_reference_hint": "מקור בטקסט...",
    "question": "שאלה בעברית",
    // Type-specific fields (options, pairs, categories, etc.)
  }
}

Return ONLY valid JSON.`;
}

// Export the app
export default app;
