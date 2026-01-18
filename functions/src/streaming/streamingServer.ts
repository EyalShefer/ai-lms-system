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
  } = {}
): AsyncGenerator<string, void, unknown> {
  const client = getGeminiClient();

  // Build full prompt
  let fullPrompt = systemPrompt ? `${systemPrompt}\n\n` : '';
  fullPrompt += prompt;

  try {
    const response = await client.models.generateContentStream({
      model: GEMINI_MODEL,
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
    logger.error('Gemini streaming error:', error);
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
 * Each level is generated and streamed separately for immediate feedback
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

  logger.info(`🧬 Starting differentiated stream for user ${userId}`, {
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

  const levels = [
    { key: 'support', name: 'רמה תומכת', bloom: 'remember,understand' },
    { key: 'core', name: 'רמה רגילה', bloom: 'apply,analyze' },
    { key: 'enrichment', name: 'רמה מתקדמת', bloom: 'evaluate,create' }
  ];

  try {
    // Generate each level sequentially but stream each one
    for (const level of levels) {
      // Send level start event
      sendSSE(res, 'level_start', {
        type: 'progress',
        content: `מייצר תוכן ל${level.name}...`,
        metadata: { level: level.key }
      });

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
      let chunkIndex = 0;

      // Stream this level's content
      for await (const chunk of streamFromGemini(prompt, undefined, {
        temperature: 0.7,
        maxTokens: 8192
      })) {
        levelContent += chunk;
        chunkIndex++;

        sendSSE(res, 'chunk', {
          type: 'text',
          content: chunk,
          metadata: {
            chunkIndex,
            level: level.key,
            itemType: productType
          }
        });
      }

      // Try to parse level content as JSON
      try {
        let jsonText = levelContent
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        const jsonMatch = jsonText.match(/\[[\s\S]*\]/) || jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);

          // Send level complete event with parsed content
          sendSSE(res, 'level_complete', {
            type: 'json_complete',
            content: JSON.stringify(parsed),
            metadata: { level: level.key }
          });
        }
      } catch (e) {
        logger.warn(`Failed to parse JSON for level ${level.key}`, e);
        sendSSE(res, 'level_complete', {
          type: 'text',
          content: levelContent,
          metadata: { level: level.key }
        });
      }
    }

    // Send final done event
    sendSSE(res, 'done', {
      type: 'done',
      content: 'All levels generated successfully',
      metadata: {
        totalExpected: 3
      }
    });

    logger.info(`✅ Differentiated stream completed for user ${userId}`);

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

// Export the app
export default app;
