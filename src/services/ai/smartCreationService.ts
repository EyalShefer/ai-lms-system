/**
 * Smart Content Creation Service
 * AI-powered conversation for intelligent content creation
 */

import { callGeminiJSON, ChatMessage } from '../ProxyService';

// Types
export interface CollectedData {
    intent: 'create' | 'advise' | 'question' | null;
    productType: 'lesson' | 'exam' | 'activity' | 'podcast' | null;
    topic: string | null;
    grade: string | null;
    subject: string | null;
    activityLength: 'short' | 'medium' | 'long' | null;
    profile: 'balanced' | 'educational' | 'game' | null;
    difficultyLevel: 'support' | 'core' | 'enrichment' | null; // תמיכה/ליבה/העשרה
    constraints: string[];
}

export interface ContentOption {
    id: number;
    title: string;
    description: string;
    productType: 'lesson' | 'exam' | 'activity';
    profile: 'balanced' | 'educational' | 'game';
    activityLength: 'short' | 'medium' | 'long';
    difficultyLevel: 'support' | 'core' | 'enrichment'; // תמיכה/ליבה/העשרה
    questionCount: number;
    estimatedTime: string;
    questionTypes: string[];
}

export interface AIResponse {
    type: 'question' | 'options' | 'info' | 'ready';
    message: string;
    quickReplies?: string[];
    options?: ContentOption[];
    collectedData?: Partial<CollectedData>;
}

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

// System prompt for the AI
const SYSTEM_PROMPT = `אתה עוזר חכם ליצירת תוכן לימודי במערכת Wizdi. תפקידך לעזור למורים ליצור תוכן מותאם בצורה יעילה וממוקדת.

## יכולות המערכת:
- שיעור (lesson): מערך שיעור מלא למורה עם פתיחה (Hook), הקניה (Direct Instruction), תרגול מונחה (Guided Practice), תרגול עצמאי (Independent Practice), דיון וסיכום
- פעילות (activity): תרגול אינטראקטיבי לתלמידים עם שאלות מגוונות ומשחקים
- מבחן (exam): שאלון הערכה לבדיקת ידע עם ציונים ומשוב

## ⭐ שלוש רמות קושי (הוראה דיפרנציאלית):
המערכת יכולה לייצר תוכן ב-3 רמות קושי שונות:

### רמה 1: תמיכה (הבנה) - לתלמידים מתקשים
- שפה פשוטה מאוד - משפטים קצרים (עד 10 מילים)
- שאלות ישירות - התשובה מופיעה במפורש בטקסט
- מסיחים ברורים כשגויים, קל לפסול אותם
- כולל רמזים פרוגרסיביים
- רמות בלום: Remember, Understand
- מתאים ל: תלמידים עם קשיי קריאה/הבנת הנקרא, לקויי למידה, עולים חדשים

### רמה 2: ליבה (יישום) - לתלמידים טיפוסיים
- שפה מותאמת לגיל - משפטים עד 15 מילים
- דורש הבנה - לא רק איתור מידע
- מסיחים אמינים שדורשים חשיבה
- רמות בלום: Understand, Apply, Analyze
- מתאים ל: רוב התלמידים בכיתה

### רמה 3: העשרה (העמקה) - לתלמידים מתקדמים
- שפה אקדמית ומורכבת
- חשיבה ביקורתית - הערכה, סינתזה
- מסיחים שכולם נראים אמינים
- שאלות "למה" ו"איך", לא רק "מה"
- רמות בלום: Analyze, Evaluate, Create
- מתאים ל: מחוננים, תלמידים מתקדמים, מי שרוצה אתגר

## סוגי שאלות זמינים:
- משחקיים: memory_game (משחק זיכרון), matching (התאמה), ordering (סידור)
- לימודיים: multiple_choice (בחירה מרובה), true_false (נכון/לא נכון), fill_in_blanks (השלמה), open_question (שאלה פתוחה)
- מתקדמים: categorization (מיון לקטגוריות), sentence_builder (בניית משפט), table_completion (השלמת טבלה)

## פרופילים:
- balanced: מיקס מאוזן של כל סוגי השאלות
- educational: דגש על הערכה ומשוב מפורט (בלי משחקים)
- game: דגש על אינטראקטיביות, משחקים וחוויה מהנה

## אורך פעילות:
- short: 3 שאלות (~10 דקות)
- medium: 5 שאלות (~15-20 דקות)
- long: 7 שאלות (~25-30 דקות)

## כיתות: א׳-י״ב, מכינה, סטודנטים

## התנהגות חשובה:
1. זהה את כוונת המורה: יצירה (create), בקשת ייעוץ (advise), או שאלה כללית (question)
2. **חשוב מאוד**: תמיד שאל לאיזו רמת קושי הפעילות מיועדת (תמיכה/ליבה/העשרה) - אלא אם המורה כבר ציינה
3. אם חסר מידע קריטי - שאל שאלה אחת ממוקדת וקצרה
4. כשיש מספיק מידע (נושא + סוג + כיתה + רמה) - הצע 2-3 אפשרויות קונקרטיות
5. התאם את ההצעות לגיל התלמידים, לנושא ולרמת הקושי
6. היה קצר, חם וידידותי - מקסימום 2-3 משפטים לכל תשובה
7. אם המורה מבקש ייעוץ - תן רעיונות יצירתיים ומעניינים
8. הבן הקשר: אם המורה אומר "כיתה ד" - זה grade, אם אומר "מתמטיקה" - זה subject
9. אם המורה מזכירה "תלמידים מתקשים", "לקויי למידה", "הבנת הנקרא" - זה רמז לרמה 1 (תמיכה)
10. אם המורה מזכירה "מחוננים", "מתקדמים", "אתגר" - זה רמז לרמה 3 (העשרה)
11. אם המורה שואלת "מה ההבדל בין הרמות?" - הסבר בקצרה ושאל לאיזו רמה היא צריכה

## פורמט תשובה (JSON):
{
  "type": "question" | "options" | "info",
  "message": "הודעה קצרה למורה",
  "quickReplies": ["אפשרות 1", "אפשרות 2", "אפשרות 3"],  // רק אם type=question
  "options": [...],  // רק אם type=options
  "collectedData": {  // תמיד - מה הבנת מהשיחה
    "intent": "create" | "advise" | "question" | null,
    "productType": "lesson" | "exam" | "activity" | null,
    "topic": "הנושא" | null,
    "grade": "כיתה X" | null,
    "subject": "מקצוע" | null,
    "activityLength": "short" | "medium" | "long" | null,
    "profile": "balanced" | "educational" | "game" | null,
    "difficultyLevel": "support" | "core" | "enrichment" | null
  }
}

## דוגמאות:

קלט: "רוצה פעילות על ט״ו בשבט"
תשובה:
{
  "type": "question",
  "message": "מעולה! לאיזו כיתה ולאיזו רמה?",
  "quickReplies": ["כיתה ד׳ - ליבה", "כיתה ד׳ - תמיכה", "כיתה ה׳ - ליבה", "כיתה אחרת"],
  "collectedData": {
    "intent": "create",
    "productType": "activity",
    "topic": "ט״ו בשבט"
  }
}

קלט: "פעילות לתלמידים שמתקשים בהבנת הנקרא על ט״ו בשבט"
תשובה:
{
  "type": "question",
  "message": "מבינה - פעילות ברמת תמיכה לתלמידים מתקשים. לאיזו כיתה?",
  "quickReplies": ["כיתה ג׳", "כיתה ד׳", "כיתה ה׳"],
  "collectedData": {
    "intent": "create",
    "productType": "activity",
    "topic": "ט״ו בשבט",
    "difficultyLevel": "support"
  }
}

קלט: "מה ההבדל בין הרמות?"
תשובה:
{
  "type": "info",
  "message": "יש 3 רמות:\\n\\n🟢 **תמיכה** - שפה פשוטה, שאלות ישירות, רמזים - לתלמידים מתקשים\\n🔵 **ליבה** - רמה רגילה, דורש הבנה - לרוב הכיתה\\n🔴 **העשרה** - אתגר, חשיבה ביקורתית - למתקדמים\\n\\nלאיזו רמה את צריכה?",
  "quickReplies": ["תמיכה", "ליבה", "העשרה", "את שלושתן"],
  "collectedData": {
    "intent": "question"
  }
}

קלט: "כיתה ד׳, רמת ליבה"
תשובה (עם הקשר קודם של ט״ו בשבט):
{
  "type": "options",
  "message": "הנה 3 אפשרויות לפעילות ט״ו בשבט לכיתה ד׳ ברמת ליבה:",
  "options": [
    {
      "id": 1,
      "title": "חידון 7 המינים",
      "description": "שאלות על 7 המינים שבהם נשתבחה ארץ ישראל - זיהוי, מאפיינים ומשמעות",
      "productType": "activity",
      "profile": "educational",
      "activityLength": "medium",
      "difficultyLevel": "core",
      "questionCount": 5,
      "estimatedTime": "15 דקות",
      "questionTypes": ["multiple_choice", "true_false", "matching"]
    },
    {
      "id": 2,
      "title": "משחק התאמה - עצים ופירות",
      "description": "התאמת פירות לעצים, זיהוי עצים לפי תמונות ומיון לקטגוריות",
      "productType": "activity",
      "profile": "game",
      "activityLength": "medium",
      "difficultyLevel": "core",
      "questionCount": 5,
      "estimatedTime": "15 דקות",
      "questionTypes": ["matching", "categorization", "memory_game"]
    },
    {
      "id": 3,
      "title": "מסע בזמן - היסטוריית החג",
      "description": "סידור אירועים בציר הזמן, השוואה בין מנהגים ושאלות על משמעות החג",
      "productType": "activity",
      "profile": "balanced",
      "activityLength": "medium",
      "difficultyLevel": "core",
      "questionCount": 5,
      "estimatedTime": "20 דקות",
      "questionTypes": ["ordering", "multiple_choice", "fill_in_blanks"]
    }
  ],
  "collectedData": {
    "intent": "create",
    "productType": "activity",
    "topic": "ט״ו בשבט",
    "grade": "כיתה ד׳",
    "difficultyLevel": "core",
    "profile": "balanced"
  }
}

קלט: "את שלושתן" (אחרי שאלה על רמות)
תשובה:
{
  "type": "info",
  "message": "מעולה! אפשרות ההוראה הדיפרנציאלית תייצר 3 גרסאות של אותה פעילות - לכל רמה בנפרד. זה מושלם אם יש לך כיתה הטרוגנית. לאיזו כיתה ועל איזה נושא?",
  "quickReplies": ["כיתה ד׳", "כיתה ה׳", "ספרו לי על הנושא"],
  "collectedData": {
    "intent": "create",
    "difficultyLevel": "all"
  }
}`;

/**
 * Analyze teacher input and generate appropriate response
 */
export async function analyzeTeacherIntent(
    userMessage: string,
    conversationHistory: ConversationMessage[],
    currentData: CollectedData
): Promise<AIResponse> {
    // Build conversation context
    const historyText = conversationHistory
        .slice(-6) // Keep last 6 messages for context
        .map(m => `${m.role === 'user' ? 'מורה' : 'עוזר'}: ${m.content}`)
        .join('\n');

    const currentDataText = Object.entries(currentData)
        .filter(([_, v]) => v !== null && (Array.isArray(v) ? v.length > 0 : true))
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join(', ');

    const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content: `היסטוריית שיחה:
${historyText || '(שיחה חדשה)'}

מידע שנאסף עד כה: ${currentDataText || '(אין עדיין)'}

הודעה חדשה מהמורה: "${userMessage}"

ענה בפורמט JSON בלבד.`
        }
    ];

    try {
        const response = await callGeminiJSON<AIResponse>(messages, {
            temperature: 0.7
        });

        // Validate and normalize response
        return normalizeResponse(response);
    } catch (error) {
        console.error('Smart creation AI error:', error);
        // Return fallback response
        return {
            type: 'question',
            message: 'סליחה, לא הבנתי. מה תרצו ליצור היום - שיעור, פעילות או מבחן?',
            quickReplies: ['שיעור', 'פעילות אינטראקטיבית', 'מבחן'],
            collectedData: {}
        };
    }
}

/**
 * Normalize and validate AI response
 */
function normalizeResponse(response: any): AIResponse {
    // Ensure type is valid
    const validTypes = ['question', 'options', 'info', 'ready'];
    const type = validTypes.includes(response.type) ? response.type : 'question';

    // Ensure message exists
    const message = response.message || 'איך אוכל לעזור?';

    // Normalize collected data
    const collectedData: Partial<CollectedData> = {};
    if (response.collectedData) {
        if (response.collectedData.intent) collectedData.intent = response.collectedData.intent;
        if (response.collectedData.productType) collectedData.productType = response.collectedData.productType;
        if (response.collectedData.topic) collectedData.topic = response.collectedData.topic;
        if (response.collectedData.grade) collectedData.grade = response.collectedData.grade;
        if (response.collectedData.subject) collectedData.subject = response.collectedData.subject;
        if (response.collectedData.activityLength) collectedData.activityLength = response.collectedData.activityLength;
        if (response.collectedData.profile) collectedData.profile = response.collectedData.profile;
        if (response.collectedData.difficultyLevel) collectedData.difficultyLevel = response.collectedData.difficultyLevel;
    }

    const result: AIResponse = {
        type,
        message,
        collectedData
    };

    // Add quick replies if present
    if (response.quickReplies && Array.isArray(response.quickReplies)) {
        result.quickReplies = response.quickReplies.slice(0, 4); // Max 4 quick replies
    }

    // Add options if present and valid
    if (response.options && Array.isArray(response.options)) {
        result.options = response.options.map((opt: any, index: number) => ({
            id: opt.id || index + 1,
            title: opt.title || `אפשרות ${index + 1}`,
            description: opt.description || '',
            productType: opt.productType || 'activity',
            profile: opt.profile || 'balanced',
            activityLength: opt.activityLength || 'medium',
            difficultyLevel: opt.difficultyLevel || 'core',
            questionCount: opt.questionCount || 5,
            estimatedTime: opt.estimatedTime || '15 דקות',
            questionTypes: opt.questionTypes || ['multiple_choice']
        }));
    }

    return result;
}

/**
 * Prepare wizard data from selected option and collected data
 */
export function prepareWizardData(
    selectedOption: ContentOption,
    collectedData: CollectedData
): any {
    // Map profile to question preferences
    const getQuestionPreferences = (profile: string, questionTypes: string[]) => {
        switch (profile) {
            case 'educational':
                return {
                    profile: 'educational',
                    allowedTypes: ['multiple_choice', 'true_false', 'fill_in_blanks', 'ordering', 'categorization', 'open_question', 'matching', 'table_completion'],
                    priorityTypes: ['multiple_choice', 'open_question', 'fill_in_blanks']
                };
            case 'game':
                return {
                    profile: 'game',
                    allowedTypes: ['memory_game', 'ordering', 'categorization', 'matching', 'sentence_builder', 'true_false'],
                    priorityTypes: ['memory_game', 'categorization', 'matching']
                };
            case 'balanced':
            default:
                return {
                    profile: 'balanced',
                    allowedTypes: questionTypes.length > 0 ? questionTypes : ['multiple_choice', 'true_false', 'fill_in_blanks', 'ordering', 'categorization', 'memory_game', 'matching'],
                    priorityTypes: questionTypes.length > 0 ? questionTypes.slice(0, 3) : ['multiple_choice', 'fill_in_blanks', 'categorization']
                };
        }
    };

    // Map difficulty level to taxonomy distribution
    const getTaxonomyForLevel = (level: string | null) => {
        switch (level) {
            case 'support': // תמיכה - Remember, Understand
                return {
                    knowledge: 60,
                    application: 30,
                    evaluation: 10
                };
            case 'enrichment': // העשרה - Analyze, Evaluate, Create
                return {
                    knowledge: 15,
                    application: 35,
                    evaluation: 50
                };
            case 'core': // ליבה - Understand, Apply, Analyze
            default:
                return {
                    knowledge: 30,
                    application: 50,
                    evaluation: 20
                };
        }
    };

    const questionPreferences = getQuestionPreferences(selectedOption.profile, selectedOption.questionTypes);

    // Check if user wants all 3 levels (differentiated teaching)
    const isDifferentiated = (collectedData.difficultyLevel as any) === 'all';

    // Get appropriate taxonomy based on difficulty level
    const taxonomy = getTaxonomyForLevel(isDifferentiated ? 'core' : selectedOption.difficultyLevel);

    return {
        mode: 'topic',
        file: null,
        pastedText: '',
        title: collectedData.topic || selectedOption.title,
        originalTopic: collectedData.topic || selectedOption.title,
        textbookSelection: null,
        settings: {
            subject: collectedData.subject || 'כללי',
            grade: collectedData.grade || 'כיתה ה׳',
            targetAudience: collectedData.grade || 'כיתה ה׳',
            activityLength: selectedOption.activityLength,
            taxonomy,
            includeBot: false,
            botPersona: null,
            courseMode: selectedOption.productType === 'exam' ? 'exam' : 'learning',
            productType: selectedOption.productType,
            isDifferentiated, // Will create 3 levels if true
            difficultyLevel: isDifferentiated ? null : selectedOption.difficultyLevel, // Single level if not differentiated
            questionPreferences
        },
        targetAudience: collectedData.grade || 'כיתה ה׳'
    };
}

/**
 * Merge new collected data with existing
 */
export function mergeCollectedData(
    existing: CollectedData,
    newData: Partial<CollectedData>
): CollectedData {
    return {
        intent: newData.intent ?? existing.intent,
        productType: newData.productType ?? existing.productType,
        topic: newData.topic ?? existing.topic,
        grade: newData.grade ?? existing.grade,
        subject: newData.subject ?? existing.subject,
        activityLength: newData.activityLength ?? existing.activityLength,
        profile: newData.profile ?? existing.profile,
        difficultyLevel: newData.difficultyLevel ?? existing.difficultyLevel,
        constraints: [...existing.constraints, ...(newData.constraints || [])]
    };
}

/**
 * Get initial empty collected data
 */
export function getInitialCollectedData(): CollectedData {
    return {
        intent: null,
        productType: null,
        topic: null,
        grade: null,
        subject: null,
        activityLength: null,
        profile: null,
        difficultyLevel: null,
        constraints: []
    };
}
