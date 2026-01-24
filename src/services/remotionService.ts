/**
 * Remotion Video Service
 * Handles video generation, rendering queue, and Firebase Storage integration
 *
 * Pattern follows: lessonMediaService.ts, storageService.ts
 */

import { httpsCallable } from 'firebase/functions';
import { functions, storage, auth } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type {
  RemotionCompositionType,
  RemotionVideoContent,
  RemotionVideoBlock,
  RemotionRenderStatus
} from '../shared/types/courseTypes';

// --- Types ---

export interface VideoGenerationRequest {
  compositionType: RemotionCompositionType;
  props: Record<string, unknown>;
  courseId: string;
  unitId: string;
  lessonTitle: string;
}

export interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  renderTime?: number;
}

export interface RenderProgressCallback {
  (progress: number, status: RemotionRenderStatus): void;
}

// --- Constants ---

const COMPOSITION_DURATIONS: Record<RemotionCompositionType, number> = {
  'explainer': 10,
  'math-visualization': 15,
  'timeline': 20,
  'lesson-summary': 10,
  'quiz-intro': 5,
  // New composition types
  'assignment-steps': 12,
  'objectives-intro': 8,
  'vocabulary': 15,
  'process-steps': 12,
  'comparison': 15
};

// Hebrew labels for composition types
export const COMPOSITION_LABELS: Record<RemotionCompositionType, { label: string; icon: string; description: string }> = {
  'explainer': {
    label: 'הסבר מונפש',
    icon: '📚',
    description: 'סרטון הסבר קצר על מושג'
  },
  'math-visualization': {
    label: 'המחשה מתמטית',
    icon: '🔢',
    description: 'ויזואליזציה של פעולות חשבון'
  },
  'timeline': {
    label: 'ציר זמן',
    icon: '📅',
    description: 'אירועים על ציר זמן מונפש'
  },
  'lesson-summary': {
    label: 'סיכום שיעור',
    icon: '✨',
    description: 'סיכום נקודות המפתח'
  },
  'quiz-intro': {
    label: 'פתיחת מבחן',
    icon: '🎯',
    description: 'הקדמה אנימטיבית למבחן'
  },
  // New composition types
  'assignment-steps': {
    label: 'הוראות משימה',
    icon: '📋',
    description: 'שלבי ביצוע ויזואליים למשימה'
  },
  'objectives-intro': {
    label: 'מטרות השיעור',
    icon: '🎯',
    description: 'פתיחה אנימטיבית - מה נלמד היום'
  },
  'vocabulary': {
    label: 'מילון מונחים',
    icon: '📖',
    description: 'כרטיסיות מונחים אנימטיביות'
  },
  'process-steps': {
    label: 'תהליך שלב-אחר-שלב',
    icon: '⚙️',
    description: 'שלבי תהליך ממוספרים ומונפשים'
  },
  'comparison': {
    label: 'השוואה',
    icon: '⚖️',
    description: 'השוואה ויזואלית בין שני מושגים'
  }
};

// --- Main Functions ---

/**
 * Request video generation via Cloud Function
 * Returns immediately with job ID for progress tracking
 */
export const requestVideoGeneration = async (
  request: VideoGenerationRequest
): Promise<{ jobId: string; estimatedTime: number }> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required');

  try {
    const generateVideo = httpsCallable(functions, 'generateRemotionVideo');
    const result = await generateVideo(request);
    return result.data as { jobId: string; estimatedTime: number };
  } catch (error: any) {
    console.error('Video generation request failed:', error);
    throw new Error(error.message || 'Failed to request video generation');
  }
};

/**
 * Poll for render progress
 * Pattern from variantCacheService.ts
 */
export const pollRenderProgress = async (
  jobId: string,
  onProgress: RenderProgressCallback,
  pollInterval = 2000,
  maxAttempts = 150 // ~5 minutes max
): Promise<VideoGenerationResult> => {
  const checkProgress = httpsCallable(functions, 'checkRemotionProgress');

  return new Promise((resolve, reject) => {
    let attempts = 0;

    const poll = setInterval(async () => {
      attempts++;

      if (attempts > maxAttempts) {
        clearInterval(poll);
        reject(new Error('Render timeout - video generation took too long'));
        return;
      }

      try {
        const result = await checkProgress({ jobId });
        const data = result.data as {
          status: RemotionRenderStatus;
          progress: number;
          videoUrl?: string;
          thumbnailUrl?: string;
          error?: string;
        };

        onProgress(data.progress, data.status);

        if (data.status === 'ready') {
          clearInterval(poll);
          resolve({
            success: true,
            videoUrl: data.videoUrl,
            thumbnailUrl: data.thumbnailUrl
          });
        } else if (data.status === 'error') {
          clearInterval(poll);
          reject(new Error(data.error || 'Render failed'));
        }
      } catch (error: any) {
        clearInterval(poll);
        reject(error);
      }
    }, pollInterval);
  });
};

/**
 * Generate video props from lesson content
 * Uses AI (Gemini) to generate intelligent content for all composition types
 * Falls back to local extraction if AI fails
 */
export const generateVideoPropsFromContent = async (
  lessonContent: string,
  compositionType: RemotionCompositionType,
  targetAudience: string
): Promise<Record<string, unknown>> => {
  // Try AI generation for supported types
  try {
    let aiResult: Record<string, unknown> | null = null;

    switch (compositionType) {
      case 'lesson-summary':
        aiResult = await generateLessonSummaryWithAI(lessonContent, targetAudience);
        break;
      case 'explainer':
        aiResult = await generateExplainerWithAI(lessonContent, targetAudience);
        break;
      case 'timeline':
        aiResult = await generateTimelineWithAI(lessonContent, targetAudience);
        break;
      case 'math-visualization':
        aiResult = await generateMathVisualizationWithAI(lessonContent, targetAudience);
        break;
      // New composition types
      case 'assignment-steps':
        aiResult = await generateAssignmentStepsWithAI(lessonContent, targetAudience);
        break;
      case 'objectives-intro':
        aiResult = await generateObjectivesIntroWithAI(lessonContent, targetAudience);
        break;
      case 'vocabulary':
        aiResult = await generateVocabularyWithAI(lessonContent, targetAudience);
        break;
      case 'process-steps':
        aiResult = await generateProcessStepsWithAI(lessonContent, targetAudience);
        break;
      case 'comparison':
        aiResult = await generateComparisonWithAI(lessonContent, targetAudience);
        break;
    }

    if (aiResult) {
      return aiResult;
    }
  } catch (error) {
    console.warn(`AI generation failed for ${compositionType}, falling back to extraction:`, error);
  }

  // Extract key information from content (fallback for all types)
  const extractedInfo = extractContentInfo(lessonContent);

  return generatePropsFromExtracted(compositionType, extractedInfo, targetAudience);
};

/**
 * Generate lesson summary using AI (Gemini)
 * Creates intelligent summary of key points from the lesson content
 */
const generateLessonSummaryWithAI = async (
  lessonContent: string,
  targetAudience: string
): Promise<Record<string, unknown> | null> => {
  try {
    // Dynamic import to avoid circular dependencies
    const { callAI } = await import('./ProxyService');

    const prompt = `אתה עוזר חינוכי מומחה ליצירת סיכומי שיעורים.

קהל היעד: ${targetAudience}

תוכן השיעור:
${lessonContent.substring(0, 3000)}

צור סיכום שיעור בפורמט JSON עם המבנה הבא:
{
  "lessonTitle": "כותרת קצרה וקליטה לשיעור (עד 50 תווים)",
  "keyPoints": ["נקודה מפתח 1 (עד 60 תווים)", "נקודה מפתח 2", "נקודה מפתח 3", "נקודה מפתח 4", "נקודה מפתח 5"],
  "nextSteps": ["המשך אפשרי 1", "המשך אפשרי 2"],
  "achievements": { "xp": 100, "badges": ["⭐", "📚"] }
}

הנחיות:
- נקודות המפתח צריכות לסכם את הרעיונות המרכזיים של השיעור
- השתמש בשפה פשוטה וברורה המתאימה לקהל היעד
- כל נקודת מפתח צריכה להיות משפט קצר ומובן
- אל תחזור על אותו רעיון פעמיים
- החזר JSON בלבד, ללא הסברים`;

    const response = await callAI('/chat/completions', {
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);

    // Validate required fields
    if (!parsed.lessonTitle || !parsed.keyPoints || parsed.keyPoints.length < 3) {
      console.warn('AI summary missing required fields');
      return null;
    }

    return {
      title: parsed.lessonTitle,
      lessonTitle: parsed.lessonTitle,
      keyPoints: parsed.keyPoints.slice(0, 5), // Max 5 points
      nextSteps: parsed.nextSteps || ['המשך לנושא הבא', 'תרגול נוסף'],
      achievements: parsed.achievements || { xp: 100, badges: ['⭐', '📚'] },
      direction: 'rtl' as const,
      theme: 'light' as const,
      brandColors: {
        primary: '#2B59C3',
        secondary: '#8B5CF6',
        accent: '#00C2FF',
        gold: '#FFD500',
        background: '#F5F9FF'
      }
    };
  } catch (error) {
    console.error('AI lesson summary generation error:', error);
    return null;
  }
};

/**
 * Generate explainer video props using AI
 */
const generateExplainerWithAI = async (
  lessonContent: string,
  targetAudience: string
): Promise<Record<string, unknown> | null> => {
  try {
    const { callAI } = await import('./ProxyService');

    const prompt = `אתה מומחה חינוכי ליצירת הסברים ברורים.

קהל היעד: ${targetAudience}

תוכן השיעור:
${lessonContent.substring(0, 3000)}

צור תוכן לסרטון הסבר בפורמט JSON:
{
  "title": "כותרת המושג (עד 40 תווים)",
  "concept": "הגדרת המושג המרכזי בשיעור (עד 100 תווים)",
  "explanation": "הסבר מפורט וברור של המושג (150-300 תווים)",
  "examples": ["דוגמה 1 (עד 50 תווים)", "דוגמה 2", "דוגמה 3"]
}

הנחיות:
- המושג צריך להיות ברור ותמציתי
- ההסבר צריך להיות פשוט ומובן לקהל היעד
- הדוגמאות צריכות להיות רלוונטיות ומחיי היומיום
- החזר JSON בלבד`;

    const response = await callAI('/chat/completions', {
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (!parsed.title || !parsed.concept || !parsed.explanation) return null;

    return {
      title: parsed.title,
      concept: parsed.concept,
      explanation: parsed.explanation,
      examples: parsed.examples || ['דוגמה ראשונה', 'דוגמה שנייה'],
      direction: 'rtl' as const,
      theme: 'light' as const,
      brandColors: {
        primary: '#2B59C3',
        secondary: '#8B5CF6',
        accent: '#00C2FF',
        gold: '#FFD500',
        background: '#F5F9FF'
      }
    };
  } catch (error) {
    console.error('AI explainer generation error:', error);
    return null;
  }
};

/**
 * Generate timeline video props using AI
 */
const generateTimelineWithAI = async (
  lessonContent: string,
  targetAudience: string
): Promise<Record<string, unknown> | null> => {
  try {
    const { callAI } = await import('./ProxyService');

    const prompt = `אתה מומחה חינוכי ליצירת צירי זמן ותהליכים.

קהל היעד: ${targetAudience}

תוכן השיעור:
${lessonContent.substring(0, 3000)}

צור ציר זמן/תהליך בפורמט JSON:
{
  "title": "כותרת הציר (עד 40 תווים)",
  "events": [
    { "date": "שלב 1", "title": "כותרת קצרה", "description": "תיאור השלב (עד 60 תווים)", "icon": "📍" },
    { "date": "שלב 2", "title": "כותרת קצרה", "description": "תיאור השלב", "icon": "⭐" },
    { "date": "שלב 3", "title": "כותרת קצרה", "description": "תיאור השלב", "icon": "🎯" },
    { "date": "שלב 4", "title": "כותרת קצרה", "description": "תיאור השלב", "icon": "✨" }
  ]
}

הנחיות:
- חלץ 3-5 שלבים/אירועים מרכזיים מהתוכן
- כל שלב צריך להיות ברור ותמציתי
- סדר לפי סדר הגיוני (כרונולוגי או לפי חשיבות)
- בחר אימוג'י מתאים לכל שלב
- החזר JSON בלבד`;

    const response = await callAI('/chat/completions', {
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (!parsed.title || !parsed.events || parsed.events.length < 2) return null;

    return {
      title: parsed.title,
      events: parsed.events.slice(0, 5),
      layout: 'vertical',
      showConnectors: true,
      direction: 'rtl' as const,
      theme: 'light' as const,
      brandColors: {
        primary: '#2B59C3',
        secondary: '#8B5CF6',
        accent: '#00C2FF',
        gold: '#FFD500',
        background: '#F5F9FF'
      }
    };
  } catch (error) {
    console.error('AI timeline generation error:', error);
    return null;
  }
};

/**
 * Generate math visualization video props using AI
 */
const generateMathVisualizationWithAI = async (
  lessonContent: string,
  targetAudience: string
): Promise<Record<string, unknown> | null> => {
  try {
    const { callAI } = await import('./ProxyService');

    const prompt = `אתה מומחה חינוכי להמחשת מושגים מתמטיים.

קהל היעד: ${targetAudience}

תוכן השיעור:
${lessonContent.substring(0, 3000)}

צור המחשה מתמטית בפורמט JSON:
{
  "title": "כותרת הנושא המתמטי (עד 40 תווים)",
  "operation": "סוג הפעולה (addition/subtraction/multiplication/division/general)",
  "problem": "הבעיה או השאלה (לדוגמה: 15 + 7 = ?)",
  "steps": [
    { "formula": "שלב 1", "explanation": "הסבר השלב (עד 50 תווים)", "animation": "fade" },
    { "formula": "שלב 2", "explanation": "הסבר השלב", "animation": "slide" },
    { "formula": "שלב 3", "explanation": "הסבר השלב", "animation": "scale" }
  ],
  "finalAnswer": "התשובה הסופית"
}

הנחיות:
- אם יש בעיה מתמטית בטקסט, השתמש בה
- אם אין, צור דוגמה רלוונטית לנושא
- הסבר כל שלב בצורה ברורה
- animation יכול להיות: fade, slide, scale
- החזר JSON בלבד`;

    const response = await callAI('/chat/completions', {
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (!parsed.title || !parsed.steps || parsed.steps.length < 2) return null;

    return {
      title: parsed.title,
      operation: parsed.operation || 'general',
      problem: parsed.problem || '',
      steps: parsed.steps.slice(0, 5),
      finalAnswer: parsed.finalAnswer || '',
      direction: 'rtl' as const,
      theme: 'light' as const,
      brandColors: {
        primary: '#2B59C3',
        secondary: '#8B5CF6',
        accent: '#00C2FF',
        gold: '#FFD500',
        background: '#F5F9FF'
      }
    };
  } catch (error) {
    console.error('AI math visualization generation error:', error);
    return null;
  }
};

/**
 * Generate assignment steps using AI
 */
const generateAssignmentStepsWithAI = async (
  lessonContent: string,
  targetAudience: string
): Promise<Record<string, unknown> | null> => {
  try {
    const { callAI } = await import('./ProxyService');

    const prompt = `אתה מומחה חינוכי ליצירת הוראות משימה ברורות.

קהל היעד: ${targetAudience}

תוכן השיעור/משימה:
${lessonContent.substring(0, 3000)}

צור הוראות משימה בפורמט JSON:
{
  "taskTitle": "כותרת המשימה (עד 50 תווים)",
  "steps": [
    { "number": 1, "title": "כותרת השלב (עד 30 תווים)", "description": "הסבר השלב (עד 80 תווים)", "icon": "📖" },
    { "number": 2, "title": "כותרת השלב", "description": "הסבר השלב", "icon": "✏️" },
    { "number": 3, "title": "כותרת השלב", "description": "הסבר השלב", "icon": "📝" },
    { "number": 4, "title": "כותרת השלב", "description": "הסבר השלב", "icon": "✅" }
  ],
  "tips": ["טיפ 1 (עד 50 תווים)", "טיפ 2"],
  "dueDate": "לא צוין"
}

הנחיות:
- חלץ את שלבי הביצוע מהתוכן
- כל שלב צריך להיות ברור ופשוט
- השתמש באימוג'י מתאים לכל שלב
- הוסף 2-3 טיפים להצלחה
- החזר JSON בלבד`;

    const response = await callAI('/chat/completions', {
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (!parsed.taskTitle || !parsed.steps || parsed.steps.length < 2) return null;

    return {
      title: parsed.taskTitle,
      taskTitle: parsed.taskTitle,
      steps: parsed.steps.slice(0, 6),
      tips: parsed.tips || ['תכננו את הזמן מראש', 'אל תהססו לשאול שאלות'],
      dueDate: parsed.dueDate,
      direction: 'rtl' as const,
      theme: 'light' as const,
      brandColors: {
        primary: '#2B59C3',
        secondary: '#8B5CF6',
        accent: '#00C2FF',
        gold: '#FFD500',
        background: '#F5F9FF'
      }
    };
  } catch (error) {
    console.error('AI assignment steps generation error:', error);
    return null;
  }
};

/**
 * Generate objectives intro using AI
 */
const generateObjectivesIntroWithAI = async (
  lessonContent: string,
  targetAudience: string
): Promise<Record<string, unknown> | null> => {
  try {
    const { callAI } = await import('./ProxyService');

    const prompt = `אתה מומחה חינוכי לניסוח מטרות לימודיות.

קהל היעד: ${targetAudience}

תוכן השיעור:
${lessonContent.substring(0, 3000)}

צור מטרות שיעור בפורמט JSON:
{
  "lessonTitle": "כותרת השיעור (עד 50 תווים)",
  "objectives": [
    "בסיום השיעור תוכלו להסביר את... (עד 60 תווים)",
    "תוכלו ליישם את...",
    "תוכלו לנתח...",
    "תוכלו להשוות בין..."
  ],
  "welcomeMessage": "מה נלמד היום?",
  "duration": "45 דקות"
}

הנחיות:
- נסח 3-5 מטרות לימודיות ברורות
- התחל כל מטרה במילים: "תוכלו ל..."
- השתמש בפעלים מסדור הבנה, יישום, ניתוח
- כל מטרה צריכה להיות מדידה
- החזר JSON בלבד`;

    const response = await callAI('/chat/completions', {
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (!parsed.lessonTitle || !parsed.objectives || parsed.objectives.length < 2) return null;

    return {
      title: parsed.lessonTitle,
      lessonTitle: parsed.lessonTitle,
      objectives: parsed.objectives.slice(0, 5),
      welcomeMessage: parsed.welcomeMessage || 'מה נלמד היום?',
      duration: parsed.duration,
      direction: 'rtl' as const,
      theme: 'light' as const,
      brandColors: {
        primary: '#2B59C3',
        secondary: '#8B5CF6',
        accent: '#00C2FF',
        gold: '#FFD500',
        background: '#F5F9FF'
      }
    };
  } catch (error) {
    console.error('AI objectives intro generation error:', error);
    return null;
  }
};

/**
 * Generate vocabulary flashcards using AI
 */
const generateVocabularyWithAI = async (
  lessonContent: string,
  targetAudience: string
): Promise<Record<string, unknown> | null> => {
  try {
    const { callAI } = await import('./ProxyService');

    const prompt = `אתה מומחה חינוכי להגדרת מונחים.

קהל היעד: ${targetAudience}

תוכן השיעור:
${lessonContent.substring(0, 3000)}

צור מילון מונחים בפורמט JSON:
{
  "topic": "נושא המונחים (עד 40 תווים)",
  "words": [
    { "term": "מונח 1 (עד 30 תווים)", "definition": "הגדרה (עד 80 תווים)", "example": "דוגמה לשימוש (עד 60 תווים)", "icon": "📚" },
    { "term": "מונח 2", "definition": "הגדרה", "example": "דוגמה", "icon": "🔬" },
    { "term": "מונח 3", "definition": "הגדרה", "example": "דוגמה", "icon": "💡" }
  ]
}

הנחיות:
- חלץ 3-5 מונחים מרכזיים מהתוכן
- כל הגדרה צריכה להיות פשוטה וברורה
- הוסף דוגמה פרקטית לכל מונח
- בחר אימוג'י מתאים לכל מונח
- החזר JSON בלבד`;

    const response = await callAI('/chat/completions', {
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (!parsed.topic || !parsed.words || parsed.words.length < 2) return null;

    return {
      title: parsed.topic,
      topic: parsed.topic,
      words: parsed.words.slice(0, 6),
      showExamples: true,
      direction: 'rtl' as const,
      theme: 'light' as const,
      brandColors: {
        primary: '#2B59C3',
        secondary: '#8B5CF6',
        accent: '#00C2FF',
        gold: '#FFD500',
        background: '#F5F9FF'
      }
    };
  } catch (error) {
    console.error('AI vocabulary generation error:', error);
    return null;
  }
};

/**
 * Generate process steps using AI
 */
const generateProcessStepsWithAI = async (
  lessonContent: string,
  targetAudience: string
): Promise<Record<string, unknown> | null> => {
  try {
    const { callAI } = await import('./ProxyService');

    const prompt = `אתה מומחה חינוכי לפירוק תהליכים לשלבים.

קהל היעד: ${targetAudience}

תוכן השיעור:
${lessonContent.substring(0, 3000)}

צור תהליך שלב-אחר-שלב בפורמט JSON:
{
  "processTitle": "כותרת התהליך (עד 40 תווים)",
  "description": "תיאור קצר של התהליך (עד 80 תווים)",
  "steps": [
    { "number": 1, "title": "כותרת השלב (עד 30 תווים)", "detail": "הסבר מפורט (עד 80 תווים)", "icon": "1️⃣" },
    { "number": 2, "title": "כותרת השלב", "detail": "הסבר מפורט", "icon": "2️⃣" },
    { "number": 3, "title": "כותרת השלב", "detail": "הסבר מפורט", "icon": "3️⃣" }
  ]
}

הנחיות:
- זהה תהליך/אלגוריתם/מתכון מהתוכן
- פרק ל-3-5 שלבים ברורים
- כל שלב צריך להיות פעולה ספציפית
- סדר לפי סדר הביצוע
- החזר JSON בלבד`;

    const response = await callAI('/chat/completions', {
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (!parsed.processTitle || !parsed.steps || parsed.steps.length < 2) return null;

    return {
      title: parsed.processTitle,
      processTitle: parsed.processTitle,
      description: parsed.description || '',
      steps: parsed.steps.slice(0, 6),
      direction: 'rtl' as const,
      theme: 'light' as const,
      brandColors: {
        primary: '#2B59C3',
        secondary: '#8B5CF6',
        accent: '#00C2FF',
        gold: '#FFD500',
        background: '#F5F9FF'
      }
    };
  } catch (error) {
    console.error('AI process steps generation error:', error);
    return null;
  }
};

/**
 * Generate comparison using AI
 */
const generateComparisonWithAI = async (
  lessonContent: string,
  targetAudience: string
): Promise<Record<string, unknown> | null> => {
  try {
    const { callAI } = await import('./ProxyService');

    const prompt = `אתה מומחה חינוכי להשוואות בין מושגים.

קהל היעד: ${targetAudience}

תוכן השיעור:
${lessonContent.substring(0, 3000)}

צור השוואה בין שני מושגים/אפשרויות בפורמט JSON:
{
  "comparisonTitle": "כותרת ההשוואה (עד 50 תווים)",
  "itemA": {
    "name": "שם המושג הראשון (עד 20 תווים)",
    "description": "תיאור קצר (עד 60 תווים)",
    "icon": "🔵",
    "attributes": {
      "קריטריון 1": "ערך א1",
      "קריטריון 2": "ערך א2",
      "קריטריון 3": "ערך א3"
    }
  },
  "itemB": {
    "name": "שם המושג השני",
    "description": "תיאור קצר",
    "icon": "🟢",
    "attributes": {
      "קריטריון 1": "ערך ב1",
      "קריטריון 2": "ערך ב2",
      "קריטריון 3": "ערך ב3"
    }
  },
  "criteria": ["קריטריון 1", "קריטריון 2", "קריטריון 3"]
}

הנחיות:
- זהה שני מושגים/דברים להשוואה מהתוכן
- בחר 3-4 קריטריונים להשוואה
- כל ערך בטבלה צריך להיות קצר וברור
- בחר אימוג'י מתאים לכל צד
- החזר JSON בלבד`;

    const response = await callAI('/chat/completions', {
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (!parsed.comparisonTitle || !parsed.itemA || !parsed.itemB || !parsed.criteria) return null;

    return {
      title: parsed.comparisonTitle,
      comparisonTitle: parsed.comparisonTitle,
      itemA: parsed.itemA,
      itemB: parsed.itemB,
      criteria: parsed.criteria.slice(0, 5),
      direction: 'rtl' as const,
      theme: 'light' as const,
      brandColors: {
        primary: '#2B59C3',
        secondary: '#8B5CF6',
        accent: '#00C2FF',
        gold: '#FFD500',
        background: '#F5F9FF'
      }
    };
  } catch (error) {
    console.error('AI comparison generation error:', error);
    return null;
  }
};

/**
 * Extract key information from lesson content
 */
const extractContentInfo = (content: string): {
  title: string;
  mainConcept: string;
  keyPoints: string[];
  examples: string[];
} => {
  // Clean HTML tags if present
  const cleanContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  // Extract sentences
  const sentences = cleanContent.split(/[.!?]/).filter(s => s.trim().length > 10);

  // First meaningful sentence as title/concept
  const firstSentence = sentences[0]?.trim() || 'מושג לימודי';
  const title = firstSentence.length > 50 ? firstSentence.slice(0, 47) + '...' : firstSentence;

  // Extract key points (sentences with important markers)
  const keyPointMarkers = ['חשוב', 'יש לזכור', 'עיקרי', 'מרכזי', 'משמעות', 'הגדרה', 'כלומר'];
  const keyPoints = sentences
    .filter(s => keyPointMarkers.some(marker => s.includes(marker)) || s.length > 30)
    .slice(0, 5)
    .map(s => s.trim().slice(0, 80));

  // If not enough key points, take first sentences
  if (keyPoints.length < 3) {
    sentences.slice(0, 5 - keyPoints.length).forEach(s => {
      if (!keyPoints.includes(s.trim())) {
        keyPoints.push(s.trim().slice(0, 80));
      }
    });
  }

  // Extract examples (sentences with example markers)
  const exampleMarkers = ['לדוגמה', 'למשל', 'כגון', 'דוגמא', 'כמו'];
  const examples = sentences
    .filter(s => exampleMarkers.some(marker => s.includes(marker)))
    .slice(0, 3)
    .map(s => s.trim().slice(0, 60));

  // If no examples found, create generic ones
  if (examples.length === 0) {
    examples.push('דוגמה מהחיים', 'יישום מעשי', 'מקרה לדוגמה');
  }

  return {
    title,
    mainConcept: sentences[0]?.trim().slice(0, 100) || title,
    keyPoints: keyPoints.length > 0 ? keyPoints : ['נקודה מרכזית 1', 'נקודה מרכזית 2', 'נקודה מרכזית 3'],
    examples
  };
};

/**
 * Generate props based on extracted content
 */
const generatePropsFromExtracted = (
  type: RemotionCompositionType,
  info: { title: string; mainConcept: string; keyPoints: string[]; examples: string[] },
  targetAudience: string
): Record<string, unknown> => {
  const baseProps = {
    title: info.title,
    direction: 'rtl' as const,
    theme: 'light' as const,
    brandColors: {
      primary: '#2B59C3',
      secondary: '#8B5CF6',
      accent: '#00C2FF',
      gold: '#FFD500',
      background: '#F5F9FF'
    }
  };

  switch (type) {
    case 'explainer':
      return {
        ...baseProps,
        concept: info.mainConcept,
        explanation: info.keyPoints.join('. '),
        examples: info.examples
      };

    case 'math-visualization':
      return {
        ...baseProps,
        operation: 'addition',
        problem: info.mainConcept.includes('=') ? info.mainConcept : '10 + 5 = ?',
        steps: info.keyPoints.slice(0, 4).map((point, i) => ({
          formula: point.match(/[\d\+\-\×\÷\=]+/)?.[0] || `שלב ${i + 1}`,
          explanation: point,
          animation: i === 0 ? 'fade' : i === info.keyPoints.length - 1 ? 'scale' : 'slide'
        })),
        finalAnswer: info.keyPoints[info.keyPoints.length - 1] || 'התשובה'
      };

    case 'timeline':
      return {
        ...baseProps,
        events: info.keyPoints.slice(0, 4).map((point, i) => ({
          date: `${i + 1}`,
          title: point.slice(0, 30),
          description: point,
          icon: ['📍', '⭐', '🎯', '✨'][i] || '📌'
        })),
        layout: 'vertical',
        showConnectors: true
      };

    case 'lesson-summary':
      return {
        ...baseProps,
        lessonTitle: info.title,
        keyPoints: info.keyPoints,
        nextSteps: ['המשך לנושא הבא', 'תרגול נוסף'],
        achievements: { xp: 100, badges: ['⭐', '📚'] }
      };

    case 'quiz-intro':
      return {
        ...baseProps,
        quizTitle: info.title,
        questionCount: 5,
        difficulty: 'medium'
      };

    default:
      return baseProps;
  }
};

/**
 * Create a Remotion video block for insertion into lesson
 * Pattern from lessonMediaService.ts
 */
export const createRemotionBlock = (
  compositionType: RemotionCompositionType,
  props: Record<string, unknown>,
  options?: {
    jobId?: string;
    status?: RemotionRenderStatus;
  }
): RemotionVideoBlock => ({
  id: `remotion-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  type: 'remotion-video',
  content: {
    compositionId: `${compositionType}-${Date.now()}`,
    compositionType,
    props,
    duration: COMPOSITION_DURATIONS[compositionType],
    status: options?.status || 'pending',
    jobId: options?.jobId
  }
});

/**
 * Update a Remotion block with render results
 */
export const updateRemotionBlockWithResult = (
  block: RemotionVideoBlock,
  result: VideoGenerationResult
): RemotionVideoBlock => ({
  ...block,
  content: {
    ...block.content,
    status: result.success ? 'ready' : 'error',
    videoUrl: result.videoUrl,
    thumbnailUrl: result.thumbnailUrl,
    error: result.error,
    renderProgress: result.success ? 100 : undefined
  }
});

/**
 * Upload rendered video to Firebase Storage (for local rendering)
 * Pattern from storageService.ts
 */
export const uploadRenderedVideo = async (
  videoBlob: Blob,
  courseId: string,
  unitId: string
): Promise<string> => {
  const MAX_SIZE = 100 * 1024 * 1024; // 100MB
  if (videoBlob.size > MAX_SIZE) {
    throw new Error(`Video too large (${(videoBlob.size / 1024 / 1024).toFixed(2)}MB). Max: 100MB`);
  }

  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required');

  const filename = `${Date.now()}.mp4`;
  const path = `generated_videos/${user.uid}/${courseId}/${unitId}/${filename}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, videoBlob, {
    contentType: 'video/mp4',
    customMetadata: {
      type: 'remotion-video',
      generatedAt: new Date().toISOString(),
      userId: user.uid
    }
  });

  return getDownloadURL(storageRef);
};

/**
 * Get estimated render time for a composition
 */
export const getEstimatedRenderTime = (
  compositionType: RemotionCompositionType
): { seconds: number; label: string } => {
  const duration = COMPOSITION_DURATIONS[compositionType];
  // Estimate: ~3 seconds per second of video + 10 seconds overhead
  const estimatedSeconds = duration * 3 + 10;

  return {
    seconds: estimatedSeconds,
    label: estimatedSeconds < 60
      ? `כ-${estimatedSeconds} שניות`
      : `כ-${Math.ceil(estimatedSeconds / 60)} דקות`
  };
};

/**
 * Check if a composition type is supported
 */
export const isValidCompositionType = (type: string): type is RemotionCompositionType => {
  return ['explainer', 'math-visualization', 'timeline', 'lesson-summary', 'quiz-intro'].includes(type);
};

export default {
  requestVideoGeneration,
  pollRenderProgress,
  generateVideoPropsFromContent,
  createRemotionBlock,
  updateRemotionBlockWithResult,
  uploadRenderedVideo,
  getEstimatedRenderTime,
  isValidCompositionType,
  COMPOSITION_LABELS,
  COMPOSITION_DURATIONS
};
