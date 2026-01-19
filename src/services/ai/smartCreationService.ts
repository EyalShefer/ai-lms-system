/**
 * Smart Content Creation Service
 * AI-powered conversation for intelligent content creation
 */

import { callGeminiJSONFast, type ChatMessage } from '../ProxyService';

// Types
export interface CollectedData {
    intent: 'create' | 'advise' | 'question' | null;
    productType: 'lesson' | 'exam' | 'activity' | 'podcast' | null;
    topic: string | null;
    grade: string | null;
    subject: string | null;
    activityLength: 'short' | 'medium' | 'long' | null;
    profile: 'balanced' | 'educational' | 'game' | 'custom' | null;
    difficultyLevel: 'support' | 'core' | 'enrichment' | 'all' | null; // הבנה/יישום/העמקה/כולם
    constraints: string[];
    // New fields for advanced capabilities
    sourceMode: 'topic' | 'file' | 'text' | 'textbook' | 'youtube' | null;
    includeBot: boolean | null;
    customQuestionTypes: string[] | null;
    hasFileToUpload: boolean | null;
    textbookInfo: string | null; // e.g., "ספר מתמטיקה כיתה ד פרק 3"
    youtubeUrl: string | null;
}

export interface ContentOption {
    id: number;
    title: string;
    description: string;
    productType: 'lesson' | 'exam' | 'activity' | 'podcast';
    profile: 'balanced' | 'educational' | 'game' | 'custom';
    activityLength: 'short' | 'medium' | 'long';
    difficultyLevel: 'support' | 'core' | 'enrichment' | 'all'; // הבנה/יישום/העמקה/כולם
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

## יכולות המערכת - סוגי מוצרים:
- שיעור (lesson): מערך שיעור מלא למורה עם פתיחה (Hook), הקניה (Direct Instruction), תרגול מונחה (Guided Practice), תרגול עצמאי (Independent Practice), דיון וסיכום
- פעילות (activity): תרגול אינטראקטיבי לתלמידים עם שאלות מגוונות ומשחקים
- מבחן (exam): שאלון הערכה לבדיקת ידע עם ציונים ומשוב
- פודקאסט (podcast): פרק אודיו עם שני מגישים (דן ונועה) שמסבירים את הנושא בצורה מעניינת ונגישה

## מקורות תוכן אפשריים:
- נושא חופשי (topic): המערכת תייצר תוכן על בסיס הידע שלה + AI
- קובץ (file): המורה יעלה קובץ PDF/תמונה/טקסט והמערכת תייצר על בסיסו
- טקסט להדבקה (text): המורה תדביק טקסט ישירות והמערכת תעבד אותו
- ספר לימוד (textbook): בחירה מספרי הלימוד המועלים למערכת (עם בחירת פרקים)
- YouTube (youtube): המערכת תתמלל סרטון ותייצר תוכן על בסיסו

## אפשרויות מתקדמות:
- בוט מלווה (includeBot): בוט סוקרטי שמלווה את התלמיד ונותן רמזים
- סוגי שאלות מותאמים (custom): בחירה ספציפית של סוגי שאלות רצויים

## ⭐ שלוש רמות קושי (הוראה דיפרנציאלית):
המערכת יכולה לייצר תוכן ב-3 רמות קושי שונות:

### רמה 1: הבנה - לתלמידים מתקשים
- שפה פשוטה מאוד - משפטים קצרים (עד 10 מילים)
- שאלות ישירות - התשובה מופיעה במפורש בטקסט
- מסיחים ברורים כשגויים, קל לפסול אותם
- כולל רמזים פרוגרסיביים
- רמות בלום: Remember, Understand
- מתאים ל: תלמידים עם קשיי קריאה/הבנת הנקרא, לקויי למידה, עולים חדשים

### רמה 2: יישום - לתלמידים טיפוסיים
- שפה מותאמת לגיל - משפטים עד 15 מילים
- דורש הבנה - לא רק איתור מידע
- מסיחים אמינים שדורשים חשיבה
- רמות בלום: Understand, Apply, Analyze
- מתאים ל: רוב התלמידים בכיתה

### רמה 3: העמקה - לתלמידים מתקדמים
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
2. **חשוב מאוד**: תמיד שאל לאיזו רמת קושי הפעילות מיועדת (הבנה/יישום/העמקה) - אלא אם המורה כבר ציינה
3. אם חסר מידע קריטי - שאל שאלה אחת ממוקדת וקצרה
4. כשיש מספיק מידע (נושא + סוג + כיתה + רמה) - הצע 2-3 אפשרויות קונקרטיות
5. התאם את ההצעות לגיל התלמידים, לנושא ולרמת הקושי
6. היה קצר, חם וידידותי - מקסימום 2-3 משפטים לכל תשובה
7. אם המורה מבקש ייעוץ - תן רעיונות יצירתיים ומעניינים
8. הבן הקשר: אם המורה אומר "כיתה ד" - זה grade, אם אומר "מתמטיקה" - זה subject
9. אם המורה מזכירה "תלמידים מתקשים", "לקויי למידה", "הבנת הנקרא" - זה רמז לרמה 1 (הבנה)
10. אם המורה מזכירה "מחוננים", "מתקדמים", "אתגר" - זה רמז לרמה 3 (העמקה)
11. אם המורה שואלת "מה ההבדל בין הרמות?" - הסבר בקצרה ושאל לאיזו רמה היא צריכה

## זיהוי מקורות תוכן:
12. אם המורה אומרת "יש לי קובץ", "רוצה להעלות", "יש לי PDF" - סמן sourceMode: "file" ו-hasFileToUpload: true
13. אם המורה אומרת "יש לי טקסט", "רוצה להדביק" - סמן sourceMode: "text"
14. אם המורה מזכירה "מתוך ספר הלימוד", "מהספר של..." - סמן sourceMode: "textbook"
15. אם המורה נותנת לינק יוטיוב או אומרת "יש לי סרטון" - סמן sourceMode: "youtube"

## זיהוי אפשרויות מתקדמות:
16. אם המורה מבקשת "עם בוט", "עם עזרה", "עם רמזים אוטומטיים" - סמן includeBot: true
17. אם המורה מבקשת סוגי שאלות ספציפיים ("רק בחירה מרובה", "בלי משחקים", "רק שאלות פתוחות") - סמן customQuestionTypes
18. אם המורה מבקשת "פודקאסט" או "משהו לשמיעה" - סמן productType: "podcast"

## פורמט תשובה (JSON):
{
  "type": "question" | "options" | "info",
  "message": "הודעה קצרה למורה",
  "quickReplies": ["אפשרות 1", "אפשרות 2", "אפשרות 3"],  // רק אם type=question
  "options": [...],  // רק אם type=options
  "collectedData": {  // תמיד - מה הבנת מהשיחה
    "intent": "create" | "advise" | "question" | null,
    "productType": "lesson" | "exam" | "activity" | "podcast" | null,
    "topic": "הנושא" | null,
    "grade": "כיתה X" | null,
    "subject": "מקצוע" | null,
    "activityLength": "short" | "medium" | "long" | null,
    "profile": "balanced" | "educational" | "game" | "custom" | null,
    "difficultyLevel": "support" | "core" | "enrichment" | "all" | null,
    "sourceMode": "topic" | "file" | "text" | "textbook" | "youtube" | null,
    "includeBot": true | false | null,
    "hasFileToUpload": true | false | null,
    "customQuestionTypes": ["multiple_choice", "open_question", ...] | null,
    "youtubeUrl": "https://..." | null
  }
}

## דוגמאות:

קלט: "רוצה פעילות על ט״ו בשבט"
תשובה:
{
  "type": "question",
  "message": "מעולה! לאיזו כיתה ולאיזו רמה?",
  "quickReplies": ["כיתה ד׳ - יישום", "כיתה ד׳ - הבנה", "כיתה ה׳ - יישום", "כיתה אחרת"],
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
  "message": "מבינה - פעילות ברמת הבנה לתלמידים מתקשים. לאיזו כיתה?",
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
  "message": "יש 3 רמות:\\n\\n🟢 **הבנה** - שפה פשוטה, שאלות ישירות, רמזים - לתלמידים מתקשים\\n🔵 **יישום** - רמה רגילה, דורש הבנה - לרוב הכיתה\\n🔴 **העמקה** - אתגר, חשיבה ביקורתית - למתקדמים\\n\\nלאיזו רמה את צריכה?",
  "quickReplies": ["הבנה", "יישום", "העמקה", "את שלושתן"],
  "collectedData": {
    "intent": "question"
  }
}

קלט: "כיתה ד׳, רמת יישום"
תשובה (עם הקשר קודם של ט״ו בשבט):
{
  "type": "options",
  "message": "הנה 3 אפשרויות לפעילות ט״ו בשבט לכיתה ד׳ ברמת יישום:",
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
}

קלט: "רוצה פודקאסט על מלחמת העצמאות"
תשובה:
{
  "type": "question",
  "message": "רעיון מעולה! פודקאסט עם דן ונועה על מלחמת העצמאות. לאיזו כיתה?",
  "quickReplies": ["כיתה ו׳", "כיתה ז׳", "כיתה ח׳"],
  "collectedData": {
    "intent": "create",
    "productType": "podcast",
    "topic": "מלחמת העצמאות",
    "subject": "היסטוריה"
  }
}

קלט: "יש לי קובץ PDF שרוצה להפוך לפעילות"
תשובה:
{
  "type": "question",
  "message": "מצוין! אעביר אותך להעלאת הקובץ. לאיזו כיתה ואיזה סוג פעילות?",
  "quickReplies": ["כיתה ד׳ - פעילות משחקית", "כיתה ה׳ - מבחן", "כיתה ו׳ - שיעור"],
  "collectedData": {
    "intent": "create",
    "sourceMode": "file",
    "hasFileToUpload": true
  }
}

קלט: "רוצה מבחן עם בוט שעוזר לתלמידים"
תשובה:
{
  "type": "question",
  "message": "רעיון נהדר! מבחן עם בוט סוקרטי שנותן רמזים. על איזה נושא ולאיזו כיתה?",
  "quickReplies": ["כיתה ה׳", "כיתה ו׳", "נושא ספציפי"],
  "collectedData": {
    "intent": "create",
    "productType": "exam",
    "includeBot": true
  }
}

קלט: "רוצה פעילות רק עם שאלות פתוחות ובחירה מרובה"
תשובה:
{
  "type": "question",
  "message": "הבנתי - פעילות עם שאלות פתוחות ובחירה מרובה בלבד. על איזה נושא?",
  "quickReplies": ["מתמטיקה", "מדעים", "היסטוריה"],
  "collectedData": {
    "intent": "create",
    "productType": "activity",
    "profile": "custom",
    "customQuestionTypes": ["open_question", "multiple_choice"]
  }
}

קלט: "יש לי סרטון ביוטיוב שרוצה להפוך לשיעור"
תשובה:
{
  "type": "question",
  "message": "מעולה! שלחי את הלינק ליוטיוב ואני אתמלל ואייצר שיעור ממנו.",
  "quickReplies": [],
  "collectedData": {
    "intent": "create",
    "productType": "lesson",
    "sourceMode": "youtube"
  }
}

קלט: "מתוך ספר הלימוד במתמטיקה פרק השברים"
תשובה:
{
  "type": "question",
  "message": "אעביר אותך לבחירה מספר הלימוד. לאיזו כיתה ומה סוג התוכן?",
  "quickReplies": ["כיתה ד׳ - פעילות", "כיתה ה׳ - מבחן", "כיתה ו׳ - שיעור"],
  "collectedData": {
    "intent": "create",
    "sourceMode": "textbook",
    "subject": "מתמטיקה",
    "textbookInfo": "פרק השברים"
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
        const response = await callGeminiJSONFast<AIResponse>(messages, {
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
        // New fields
        if (response.collectedData.sourceMode) collectedData.sourceMode = response.collectedData.sourceMode;
        if (response.collectedData.includeBot !== undefined) collectedData.includeBot = response.collectedData.includeBot;
        if (response.collectedData.hasFileToUpload !== undefined) collectedData.hasFileToUpload = response.collectedData.hasFileToUpload;
        if (response.collectedData.customQuestionTypes) collectedData.customQuestionTypes = response.collectedData.customQuestionTypes;
        if (response.collectedData.textbookInfo) collectedData.textbookInfo = response.collectedData.textbookInfo;
        if (response.collectedData.youtubeUrl) collectedData.youtubeUrl = response.collectedData.youtubeUrl;
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
    const getQuestionPreferences = (profile: string, questionTypes: string[], customTypes?: string[] | null) => {
        // If custom types are specified, use them
        if (profile === 'custom' && customTypes && customTypes.length > 0) {
            return {
                profile: 'custom',
                allowedTypes: customTypes,
                priorityTypes: customTypes.slice(0, 3)
            };
        }

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
            case 'support': // הבנה - Remember, Understand
                return {
                    knowledge: 60,
                    application: 30,
                    evaluation: 10
                };
            case 'enrichment': // העמקה - Analyze, Evaluate, Create
                return {
                    knowledge: 15,
                    application: 35,
                    evaluation: 50
                };
            case 'core': // יישום - Understand, Apply, Analyze
            default:
                return {
                    knowledge: 30,
                    application: 50,
                    evaluation: 20
                };
        }
    };

    const questionPreferences = getQuestionPreferences(
        selectedOption.profile,
        selectedOption.questionTypes,
        collectedData.customQuestionTypes
    );

    // Check if user wants all 3 levels (differentiated teaching)
    const isDifferentiated = (collectedData.difficultyLevel as any) === 'all' || selectedOption.difficultyLevel === 'all';

    // Get appropriate taxonomy based on difficulty level
    const taxonomy = getTaxonomyForLevel(isDifferentiated ? 'core' : selectedOption.difficultyLevel);

    // Determine mode based on sourceMode
    const getMode = () => {
        switch (collectedData.sourceMode) {
            case 'file': return 'upload';
            case 'text': return 'text';
            case 'textbook': return 'textbook';
            case 'youtube': return 'multimodal';
            default: return 'topic';
        }
    };

    return {
        mode: getMode(),
        file: null,
        pastedText: '',
        title: collectedData.topic || selectedOption.title,
        originalTopic: collectedData.topic || selectedOption.title,
        textbookSelection: collectedData.textbookInfo ? { info: collectedData.textbookInfo } : null,
        youtubeUrl: collectedData.youtubeUrl || null,
        settings: {
            subject: collectedData.subject || 'כללי',
            grade: collectedData.grade || 'כיתה ה׳',
            targetAudience: collectedData.grade || 'כיתה ה׳',
            activityLength: selectedOption.activityLength,
            taxonomy,
            includeBot: collectedData.includeBot || false,
            botPersona: collectedData.includeBot ? 'socratic' : null,
            courseMode: selectedOption.productType === 'exam' ? 'exam' : 'learning',
            productType: selectedOption.productType,
            isDifferentiated, // Will create 3 levels if true
            difficultyLevel: isDifferentiated ? null : selectedOption.difficultyLevel, // Single level if not differentiated
            questionPreferences
        },
        targetAudience: collectedData.grade || 'כיתה ה׳',
        // Flags for UI to handle
        requiresFileUpload: collectedData.hasFileToUpload || false,
        requiresTextPaste: collectedData.sourceMode === 'text',
        requiresTextbookSelection: collectedData.sourceMode === 'textbook',
        requiresYoutubeUrl: collectedData.sourceMode === 'youtube' && !collectedData.youtubeUrl
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
        constraints: [...existing.constraints, ...(newData.constraints || [])],
        // New fields
        sourceMode: newData.sourceMode ?? existing.sourceMode,
        includeBot: newData.includeBot ?? existing.includeBot,
        customQuestionTypes: newData.customQuestionTypes ?? existing.customQuestionTypes,
        hasFileToUpload: newData.hasFileToUpload ?? existing.hasFileToUpload,
        textbookInfo: newData.textbookInfo ?? existing.textbookInfo,
        youtubeUrl: newData.youtubeUrl ?? existing.youtubeUrl
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
        constraints: [],
        // New fields
        sourceMode: null,
        includeBot: null,
        customQuestionTypes: null,
        hasFileToUpload: null,
        textbookInfo: null,
        youtubeUrl: null
    };
}
