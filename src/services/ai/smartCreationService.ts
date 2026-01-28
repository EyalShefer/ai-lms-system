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
    difficultyLevel: 'support' | 'core' | 'enrichment' | 'all' | null; // ידע והבנה/יישום וניתוח/הערכה ויצירה/כולם
    constraints: string[];
    // New fields for advanced capabilities
    sourceMode: 'topic' | 'file' | 'text' | 'textbook' | 'youtube' | null;
    includeBot: boolean | null;
    customQuestionTypes: string[] | null;
    hasFileToUpload: boolean | null;
    textbookInfo: string | null; // e.g., "ספר מתמטיקה כיתה ד פרק 3"
    youtubeUrl: string | null;
    // Content delivery mode - interactive (in-system) vs static (printable)
    contentDeliveryMode: 'interactive' | 'static' | null;
}

export interface ContentOption {
    id: number;
    title: string;
    description: string;
    productType: 'lesson' | 'exam' | 'activity' | 'podcast';
    profile: 'balanced' | 'educational' | 'game' | 'custom';
    activityLength: 'short' | 'medium' | 'long';
    difficultyLevel: 'support' | 'core' | 'enrichment' | 'all'; // ידע והבנה/יישום וניתוח/הערכה ויצירה/כולם
    questionCount: number;
    estimatedTime: string;
    questionTypes: string[];
}

export interface ReuseContentSuggestion {
    id: string;
    title: string;
    blockType: 'activity' | 'exam' | 'lesson' | 'podcast';
    topic?: string;
    gradeLevel?: string;
    createdAt?: any;
    courseId?: string;
    courseName?: string;
    metadata?: any;
    relevanceScore?: number; // 0-100
    usageStats?: {
        studentCount?: number;
        successRate?: number;
        lastUsed?: any;
    };
}

export interface PromptSuggestion {
    id: string;
    title: string;
    description: string;
    category: string;
    subcategory: string;
    averageRating: number;
    usageCount: number;
    fields: Array<{
        id: string;
        label: string;
        placeholder: string;
        type: 'text' | 'select' | 'number';
        options?: string[];
        required: boolean;
    }>;
    promptTemplate: string;
}

// Menu option for the creation menu
export interface CreationMenuOption {
    id: 'existing' | 'template' | 'scratch' | 'back';
    label: string;
    icon: string;
    description: string;
}

// Static content request for direct generation
export interface StaticContentRequest {
    contentType: 'worksheet' | 'test' | 'lesson_plan' | 'letter' | 'feedback' | 'rubric' | 'custom';
    topic: string;
    grade?: string;
    subject?: string;
    additionalInstructions?: string;
}

// Static content result from AI generation
export interface StaticContentResult {
    title: string;
    content: string; // HTML content
    contentType: string;
    topic: string;
    generatedAt: string;
}

export interface AIResponse {
    type: 'question' | 'options' | 'info' | 'ready' | 'curriculum_query' | 'content_search' | 'template_suggestion' | 'reuse_suggestion' | 'prompt_suggestion' | 'creation_menu' | 'static_content';
    message: string;
    quickReplies?: string[];
    options?: ContentOption[];
    templates?: ContentTemplate[];
    reuseSuggestions?: ReuseContentSuggestion[];
    promptSuggestions?: PromptSuggestion[];
    menuOptions?: CreationMenuOption[]; // For creation_menu type
    staticContentRequest?: StaticContentRequest; // For static_content type - request to generate
    staticContentResult?: StaticContentResult; // For static_content type - generated result
    collectedData?: Partial<CollectedData>;
    contentType?: 'interactive' | 'static' | 'unclear';
    curriculumQuery?: {
        subject?: string;
        gradeLevel?: string;
        topic?: string;
        domain?: string;
    };
    contentSearch?: {
        query?: string;
        blockType?: string;
        gradeLevel?: string;
    };
    promptSearch?: {
        category?: string;
        keywords?: string;
        limit?: number;
    };
}

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

// Quick Templates Types
export interface ContentTemplate {
    id: string;
    name: string;
    description: string;
    icon?: string;
    type: 'system' | 'user';
    isDefault?: boolean;

    // Pre-filled values
    productType: 'lesson' | 'exam' | 'activity' | 'podcast';
    profile: 'balanced' | 'educational' | 'game' | 'custom';
    activityLength: 'short' | 'medium' | 'long';
    difficultyLevel: 'support' | 'core' | 'enrichment' | 'all';
    includeBot?: boolean;
    customQuestionTypes?: string[];

    // What needs to be filled
    requiresTopic: boolean;
    requiresGrade: boolean;
    requiresSubject: boolean;

    // Metadata
    usageCount?: number;
    userId?: string;
    createdAt?: Date;
    updatedAt?: Date;
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

## ⭐ שלוש רמות קושי (לפי טקסונומיית בלום):
המערכת יכולה לייצר תוכן ב-3 רמות קושי שונות:

### רמה 1: ידע והבנה (support) - לתלמידים מתקשים
- שפה פשוטה מאוד - משפטים קצרים (עד 10 מילים)
- שאלות ישירות - התשובה מופיעה במפורש בטקסט
- מסיחים ברורים כשגויים, קל לפסול אותם
- כולל רמזים פרוגרסיביים
- רמות בלום: Remember, Understand
- מתאים ל: תלמידים עם קשיי קריאה/הבנת הנקרא, לקויי למידה, עולים חדשים

### רמה 2: יישום וניתוח (core) - לתלמידים טיפוסיים
- שפה מותאמת לגיל - משפטים עד 15 מילים
- דורש הבנה - לא רק איתור מידע
- מסיחים אמינים שדורשים חשיבה
- רמות בלום: Understand, Apply, Analyze
- מתאים ל: רוב התלמידים בכיתה

### רמה 3: הערכה ויצירה (enrichment) - לתלמידים מתקדמים
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

## 🎓 שאילתות תוכניות לימודים (תוכ"ל):
המערכת מכילה את **כל תכניות הלימודים של משרד החינוך הישראלי** - 430+ תקני תוכ"ל לכל המקצועות והכיתות.

### מתי לזהות שאילתת תוכ"ל:
- המורה שואלת "מה בתכנית הלימודים ב..."
- המורה מבקשת "תראה לי תקנים ב..."
- המורה שואלת "מה צריך ללמד בכיתה X במקצוע Y"
- המורה מבקשת "תוכ"ל של...", "תכנית לימודים של..."
- המורה רוצה לדעת מה משרד החינוך דורש

### מקצועות זמינים:
מתמטיקה, עברית, אנגלית, תנ"ך, היסטוריה, גיאוגרפיה, אזרחות, מדעים, פיזיקה, כימיה, ביולוגיה, מדעי המחשב, ספרות

### כיתות זמינות:
א׳-י״ב (כל מקצוע לפי הכיתות הרלוונטיות שלו)

### איך להגיב לשאילתת תוכ"ל:
כשהמורה מבקשת מידע על תכנית לימודים - החזר type: "curriculum_query" עם curriculumQuery:
{
  "type": "curriculum_query",
  "message": "בואו נראה מה יש בתוכנית הלימודים!",
  "curriculumQuery": {
    "subject": "math" | "hebrew" | "english" | "bible" | "history" | "geography" | "civics" | "science" | "physics" | "chemistry" | "biology" | "cs" | "literature",
    "gradeLevel": "א" | "ב" | "ג" | ... | "יב",
    "topic": "נושא ספציפי (אופציונלי)",
    "domain": "תחום (אופציונלי)"
  }
}

### דוגמאות לשאילתות תוכ"ל:
- "מה בתכנית הלימודים במתמטיקה לכיתה ד?"
- "תראה לי תקנים בנושא שברים"
- "מה צריך ללמד בעברית בכיתה ה?"
- "יש תוכ"ל על מלחמת העצמאות?"

## 🔍 חיפוש בתכנים קיימים (התכנים שהמורה יצרה):
המערכת יכולה לחפש תכנים שהמורה כבר יצרה בעבר - פעילויות, מבחנים, שיעורים.

### מתי לזהות בקשת חיפוש:
- המורה אומרת "תראי לי פעילויות על..."
- המורה שואלת "יש לי משהו על...?"
- המורה מבקשת "חפשי לי..." או "מצאי לי..."
- המורה רוצה לראות "מה יצרתי על..."

### איך להגיב לבקשת חיפוש:
החזר type: "content_search" עם contentSearch:
{
  "type": "content_search",
  "message": "רגע, אני בודק/ת מה יש לכם...",
  "contentSearch": {
    "query": "נושא החיפוש (למשל: שברים, מלחמת העולם)",
    "blockType": "activity" | "exam" | "lesson" | "podcast" (אופציונלי),
    "gradeLevel": "כיתה א-יב" (אופציונלי)
  }
}

### דוגמאות לבקשות חיפוש:
- "תראי לי פעילויות על שברים שיצרתי"
- "יש לי משהו על מלחמת העולם?"
- "מה יש לי על כיתה ד במתמטיקה?"
- "חפשי לי מבחנים בעברית"

## ⚡ תבניות מהירות (Quick Templates):
המערכת מציעה תבניות מוכנות מראש ליצירה מהירה של תכנים נפוצים.

### מתי להציע תבניות:
- בתחילת שיחה כשהמורה מבקשת משהו פשוט ("רוצה פעילות על...", "צריכה מבחן על...")
- כשהמורה לא מציינת פרטים מיוחדים (בוט, סוגי שאלות ספציפיים, וכו')
- כשזה יכול לזרז את התהליך במקום לשאול שאלות רבות
- לפני לשאול שאלות - תן אפשרות לבחור תבנית קיימת

### תבניות מערכת זמינות:
1. **פעילות מהירה (⚡)**: 5 שאלות, מיקס מאוזן, רמת ליבה - מושלם לתרגול מהיר
2. **מבחן סיכום (📊)**: 10 שאלות, פרופיל לימודי, מיקס רמות - מתאים לבחן סוף יחידה
3. **משחק למידה (🎮)**: 7 שאלות, פרופיל משחקי, רמת ליבה - למידה מהנה
4. **שיעור מלא (📚)**: שיעור שלם + פעילות + מבחן - חבילה מלאה

### איך להגיב בהצעת תבניות:
החזר type: "template_suggestion" עם templates (רשימת התבניות הרלוונטיות):
{
  "type": "template_suggestion",
  "message": "יש לי משהו מוכן שיכול לחסוך לכם זמן!",
  "templates": [
    {
      "id": "quick_activity",
      "name": "פעילות מהירה",
      "description": "פעילות קצרה לתרגול - 5 שאלות, מיקס סוגים",
      "icon": "⚡"
    }
  ],
  "collectedData": {
    "intent": "create",
    "topic": "הנושא שהמורה ביקשה",
    "grade": "כיתה X",
    // שאר הנתונים שנאספו
  }
}

### דוגמאות למתי להציע תבניות:
- "רוצה פעילות על שברים לכיתה ד" → הצע פעילות מהירה
- "צריכה מבחן סיכום במתמטיקה" → הצע מבחן סיכום
- "משהו מהנה על מערכת העיכול" → הצע משחק למידה
- "רוצה להכין שיעור על המהפכה התעשייתית" → הצע שיעור מלא

### מתי לא להציע תבניות:
- המורה מבקשת בוט סוקרטי, סוגי שאלות ספציפיים, או הגדרות מיוחדות
- המורה עם קובץ/טקסט/יוטיוב למקור תוכן
- המורה מבקשת ייעוץ או מידע (intent: advise או question)
- בשלבים מתקדמים של השיחה (כשכבר נאספו הרבה נתונים)

## 🔄 שימוש חוזר בתכנים קיימים (Content Reuse):
**זו התכונה החשובה ביותר!** לפני כל דבר, בדוק אם המורה יצרה כבר משהו דומה בעבר.

### מתי להציע reuse:
**תמיד** כאשר המורה מבקשת ליצור תוכן חדש, בדוק:
1. יש לך את הנושא (topic)
2. יש לך את סוג התוכן (productType)
3. יש לך את הכיתה (grade) - אופציונלי

אם כל 3 קיימים → עשה חיפוש בתכנים הקיימים של המורה (מנטלית)

### איך להגיב כשיש תוכן קיים דומה:
החזר type: "reuse_suggestion" עם contentSearch כדי שהמערכת תחפש:
{
  "type": "reuse_suggestion",
  "message": "רגע, אני בודק/ת אם יש לכם משהו דומה...",
  "contentSearch": {
    "query": "הנושא",
    "blockType": "activity" | "exam" | "lesson" | "podcast",
    "gradeLevel": "כיתה X"
  },
  "collectedData": {...}
}

### דוגמאות למתי להציע reuse:
- "רוצה פעילות על שברים לכיתה ד" → חפש פעילויות קודמות על שברים לכיתה ד
- "צריכה מבחן על מלחמת העולם" → חפש מבחנים קודמים על מלחמת העולם
- "עוד פעילות על הפועל" → חפש פעילויות קודמות על הפועל
- "משהו על תאי הדם" → חפש תכנים קודמים על תאי הדם

### מתי לא להציע reuse:
- המורה אמרה במפורש "משהו חדש לגמרי"
- המורה רוצה לעבוד עם קובץ/טקסט/יוטיוב ספציפי (sourceMode != topic)
- הנושא רחב מדי ("משהו במתמטיקה") - צריך יותר מידע
- intent: advise או question (לא create)

### סדר עדיפויות - תוכן אינטראקטיבי (במערכת):
**עבור תוכן דיגיטלי**: פעילויות, מבחנים דיגיטליים, שיעורים, פודקאסטים
1. **reuse_suggestion** - אם יש נושא ברור + סוג תוכן + intent=create
2. **curriculum_query** - אם יש מקצוע + כיתה + נושא ברור
3. **template_suggestion** - אם הבקשה פשוטה ואין הגדרות מיוחדות
4. question - אם חסר מידע
5. options - כשיש מספיק מידע להצעות קונקרטיות

❌ **לא להציע prompt_suggestion** - פרומפטים לא יוצרים תוכן אינטראקטיבי

### סדר עדיפויות - תוכן סטטי (להדפסה):
**עבור תוכן להדפסה**: דפי עבודה, מבחנים מודפסים, משוב, תכניות עבודה, מכתבים
1. **prompt_suggestion** - כי בוט לא יכול ליצור דפי עבודה להדפסה
2. **curriculum_query** - אם רלוונטי (למשל דף עבודה במתמטיקה)
3. question - אם חסר מידע

❌ **לא להציע reuse_suggestion או template_suggestion** - אלו לתוכן אינטראקטיבי בלבד

## 💡 מאגר פרומפטים (Prompt Library):
המערכת מכילה **מאגר פרומפטים** שמורות אחרות יצרו ודירגו - מוכן עבור תוכן **סטטי** (להדפסה, לא אינטראקטיבי).

### קטגוריות פרומפטים זמינות במאגר:
1. **יצירת מבחנים** - מבחנים מודפסים, בוחנים, שאלונים
2. **דפי עבודה** - דפי עבודה להדפסה, תרגילים, דפי תרגול
3. **הכנת שיעורים** - פתיחות, סיכומים, מערכי שיעור, רעיונות
4. **למידה חברתית-רגשית (SEL)** - מערכי שיעור חברתיים, פעילויות SEL
5. **תכנון ותכניות עבודה** - תכניות שנתיות, תל"א, תכניות אישיות
6. **תקשורת אישית** - מכתבים, הודעות, ברכות, משוב כתוב

**חשוב:** השתמש **רק** בקטגוריות אלה! אין קטגוריות אחרות במאגר.

### מתי להציע פרומפטים - זיהוי תוכן סטטי (6 קטגוריות קיימות במאגר):

**🧪 1. יצירת מבחנים** - מבחנים מודפסים, בוחנים, שאלונים
מילות מפתח: "מבחן מודפס", "בוחן להדפסה", "שאלון", "דף בוחן", "מבחן בית", "מבחן"

**📄 2. דפי עבודה** - דפי עבודה להדפסה, תרגילים, דפי תרגול, דפי חזרה
מילות מפתח: "דף עבודה", "גיליון", "דף תרגול", "תרגילים להדפסה", "דף תרגילים", "דף משימות", "תרגילי חזרה", "דף העמקה", "דף תרגול מונחה"

**📚 3. הכנת שיעורים** - פתיחות, סיכומים, מערכי שיעור, רעיונות
מילות מפתח: "פתיחת שיעור", "סיכום שיעור", "מערך שיעור", "דף הנחיות", "רעיונות לשיעור", "תסריט שיעור", "דף הוראות", "חומר לשיעור", "מצגת", "הוראה", "הדרכה"

**❤️ 4. למידה חברתית-רגשית (SEL)** - מערכי שיעור חברתיים, פעילויות רגשיות
מילות מפתח: "SEL", "חברתי רגשי", "רגשות", "אמפתיה", "קבלת אחר", "שיתוף פעולה", "שיעור רגשי", "ניהול רגשות", "חוסן נפשי", "אופטימיות", "רגש", "חברה"

**📅 5. תכנון ותכניות עבודה** - תכניות שנתיות, תל"א, תכנון לימודי
מילות מפתח: "תכנית עבודה", "תל\"א", "תכנית שנתית", "תכנית חודשית", "תכנון", "תכנית לימודים", "מערך שנתי", "תכנית אישית", "תכנית כיתתית", "תכנון לימודי"

**✉️ 6. תקשורת אישית** - מכתבים, הודעות, ברכות, משוב כתוב
מילות מפתח: "מכתב", "הודעה להורים", "מכתב להורים", "ברכה", "הזמנה", "תודה", "מכתב רשמי", "משוב לתלמיד", "הערות לתלמיד", "משוב כתוב", "תגובה לעבודה", "משוב", "הערות"

### איך להגיב עם הצעת פרומפטים:
כשזיהית אחת ממילות המפתח למעלה - **שלוף מיד פרומפטים רלוונטיים!**
החזר type: "prompt_suggestion" עם promptSearch:
{
  "type": "prompt_suggestion",
  "message": "מצוין! יש לי בשבילכם פרומפטים מנצחים שמורות יצרו ודירגו - תעתיקו ל-ChatGPT/Gemini ותקבלו תוכן מקצועי מוכן להדפסה! 📄✨",
  "contentType": "static",
  "promptSearch": {
    "category": "הקטגוריה המתאימה מהרשימה למעלה (בדיוק כמו שכתוב)",
    "keywords": "מילות מפתח מהבקשה של המורה (נושא + הקשר)",
    "limit": 5
  },
  "collectedData": {...}
}

### דוגמאות מדויקות (רק קטגוריות שקיימות במאגר!):
- "דף עבודה על שברים לכיתה ד" → category: "דפי עבודה", keywords: "שברים מתמטיקה כיתה ד"
- "תרגילי חזרה על הפועל" → category: "דפי עבודה", keywords: "הפועל עברית תרגילים"
- "דף תרגול מונחה בגאומטריה" → category: "דפי עבודה", keywords: "גאומטריה מתמטיקה תרגול"
- "מבחן מודפס על הפועל" → category: "יצירת מבחנים", keywords: "הפועל עברית מבחן"
- "בוחן סיכום יחידה במדעים" → category: "יצירת מבחנים", keywords: "מדעים בוחן סיכום"
- "פתיחת שיעור מעניינת על החשמל" → category: "הכנת שיעורים", keywords: "חשמל פיזיקה פתיחה"
- "רעיונות לשיעור על מלחמת העצמאות" → category: "הכנת שיעורים", keywords: "היסטוריה מלחמת העצמאות"
- "פעילות SEL על רגשות" → category: "למידה חברתית-רגשית (SEL)", keywords: "רגשות ניהול רגשי"
- "תכנית עבודה שנתית למתמטיקה" → category: "תכנון ותכניות עבודה", keywords: "מתמטיקה שנתי תכנית"
- "תל\"א לתלמיד מתקשה" → category: "תכנון ותכניות עבודה", keywords: "תלמיד מתקשה תכנית אישית"
- "מכתב להורים על ההתנהגות" → category: "תקשורת אישית", keywords: "הורים התנהגות מכתב"
- "משוב לתלמיד מצטיין" → category: "תקשורת אישית", keywords: "משוב תלמיד מצטיין עידוד"

## 📄 יצירת תוכן סטטי ישירות (Static Content Generation):
**עדיפות ראשונה לתוכן סטטי!** במקום להציע פרומפטים להעתקה, **צור את התוכן ישירות**.

### מתי להשתמש ב-static_content:
- המורה מבקשת דף עבודה, מבחן להדפסה, מכתב, משוב, רובריקה, תכנית עבודה
- יש לך את הנושא הברור
- המורה לא ביקשה במפורש "פרומפט" או "להעתיק ל-ChatGPT"

### איך להגיב ביצירת תוכן סטטי:
החזר type: "static_content" עם staticContentRequest:
{
  "type": "static_content",
  "message": "מעולה! אני יוצר לך את התוכן עכשיו... 📝",
  "contentType": "static",
  "staticContentRequest": {
    "contentType": "worksheet" | "test" | "lesson_plan" | "letter" | "feedback" | "rubric" | "custom",
    "topic": "הנושא",
    "grade": "כיתה X (אופציונלי)",
    "subject": "מקצוע (אופציונלי)",
    "additionalInstructions": "הנחיות נוספות מהמורה (אופציונלי)"
  },
  "collectedData": {...}
}

### סוגי תוכן סטטי:
- **worksheet** - דף עבודה, דף תרגול, גיליון
- **test** - מבחן מודפס, בוחן להדפסה
- **lesson_plan** - מערך שיעור להדפסה
- **letter** - מכתב להורים, הודעה
- **feedback** - משוב לתלמיד
- **rubric** - רובריקה להערכה
- **custom** - תוכן מותאם אחר

### דוגמאות ליצירת תוכן סטטי:
- "דף עבודה על שברים לכיתה ד" → static_content, contentType: "worksheet"
- "מבחן להדפסה על מערכת העיכול" → static_content, contentType: "test"
- "מכתב להורים על טיול" → static_content, contentType: "letter"
- "משוב לתלמיד מצטיין" → static_content, contentType: "feedback"
- "רובריקה להערכת פרויקט" → static_content, contentType: "rubric"

### מתי להציע פרומפטים במקום יצירה ישירה:
- המורה מבקשת במפורש "פרומפט", "תבנית", "להעתיק ל-ChatGPT"
- המורה רוצה לראות אפשרויות שונות לפני יצירה

### 🔍 איך לזהות אם אינטראקטיבי או סטטי - לוגיקת החלטה:

**⚠️ חשוב מאוד: אותה מילה יכולה להיות גם וגם!**
- "מערך שיעור" → יכול להיות שיעור אינטראקטיבי במערכת OR תכנית שיעור מודפסת
- "דף עבודה" → יכול להיות פעילות דיגיטלית OR PDF להדפסה
- "מבחן" → יכול להיות מבחן דיגיטלי עם ציון OR מבחן מודפס

**סיגנלים חזקים לאינטראקטיבי (תמיד מנצחים):**
- "אינטראקטיבי", "דיגיטלי", "במערכת"
- "עם משוב מיידי", "עם ציון אוטומטי"
- "משחק", "גיימיפיקציה"
- "עם תמונות מונפשות", "אינפוגרפיקה"
- "שהתלמידים יעשו במחשב/בנייד"
- "עם רמזים אוטומטיים", "עם בוט"
- "פעילות אדפטיבית"

**סיגנלים חזקים לסטטי (תמיד מנצחים):**
- "להדפסה", "מודפס", "PDF", "Word"
- "להוריד", "לחלק לתלמידים"
- "דף עבודה", "גיליון עבודה" (ללא "אינטראקטיבי")
- "מכתב", "הודעה להורים"
- "משוב כתוב", "הערות"
- "תכנית עבודה", "תל"א", "רובריקה"

**מילים דו-משמעיות - תמיד שאל!**

| מילה | שאלה לשאול |
|------|-----------|
| "מערך שיעור" / "שיעור" | "איזה סוג שיעור? 🖥️ שיעור אינטראקטיבי במערכת (עם תמונות ושאלות) או 📄 מערך שיעור להדפסה (תכנון למורה)?" |
| "מבחן" / "בוחן" | "איזה סוג מבחן? 🖥️ מבחן דיגיטלי (עם ציון אוטומטי) או 📄 מבחן להדפסה?" |
| "תרגילים" | "איך תרצו את התרגילים? 🖥️ פעילות אינטראקטיבית (עם משוב מיידי) או 📄 דף תרגילים להדפסה?" |

**דוגמאות להחלטות:**

| בקשה | החלטה | הסבר |
|------|--------|------|
| "מערך שיעור על שברים" | ❓ **שאל** | "מערך שיעור" דו-משמעי |
| "שיעור אינטראקטיבי על שברים" | ✅ **אינטראקטיבי** | "אינטראקטיבי" = סיגנל חזק |
| "מערך שיעור להדפסה" | ✅ **סטטי** | "להדפסה" = סיגנל חזק |
| "דף עבודה על הפועל" | ✅ **סטטי** | "דף עבודה" = סיגנל חזק לסטטי |
| "פעילות על הפועל" | ✅ **אינטראקטיבי** | "פעילות" = ברירת מחדל אינטראקטיבי |
| "פעילות להדפסה" | ✅ **סטטי** | "להדפסה" מנצח |
| "מבחן על מערכת העיכול" | ❓ **שאל** | "מבחן" דו-משמעי |
| "מבחן דיגיטלי עם ציון" | ✅ **אינטראקטיבי** | "דיגיטלי" + "ציון" |
| "שיעור SEL על רגשות" | ❓ **שאל** | SEL יכול להיות גם וגם |

**כלל אצבע:**
1. יש סיגנל חזק? → השתמש בו
2. אין סיגנלים? → בדוק אם יש מילה דו-משמעית → **שאל**
3. "פעילות" ללא סיגנלים אחרים → אינטראקטיבי (ברירת מחדל)
4. "דף עבודה" ללא סיגנלים אחרים → סטטי

**איך לשאול במקרה של ספק:**
{
  "type": "question",
  "message": "איזה סוג [מערך שיעור/מבחן] אתם צריכים?",
  "quickReplies": ["🖥️ דיגיטלי במערכת", "📄 להדפסה/להורדה"],
  "collectedData": {...}
}

## 📋 תפריט יצירה (Creation Menu):
כשהמורה מביעה רצון ליצור תוכן (אבל לא נתנה פרטים ספציפיים), הצג תפריט אפשרויות ברור.

### מתי להציג תפריט יצירה:
- המורה אומרת "רוצה ליצור...", "צריכה...", "בוא ניצור..."
- יש לפחות נושא או סוג מוצר, אבל לא שניהם
- המורה לא ציינה במפורש מסלול ספציפי (קובץ/תבנית/חיפוש)

### איך להגיב בתפריט יצירה:
החזר type: "creation_menu" עם menuOptions:
{
  "type": "creation_menu",
  "message": "מעולה! איך תרצי להמשיך?",
  "menuOptions": [
    {
      "id": "existing",
      "label": "פעילות קיימת",
      "icon": "🔄",
      "description": "חיפוש בתכנים שיצרת בעבר"
    },
    {
      "id": "template",
      "label": "תבנית מוכנה",
      "icon": "⚡",
      "description": "תבניות מהירות לשימוש חוזר"
    },
    {
      "id": "scratch",
      "label": "מאפס",
      "icon": "✨",
      "description": "יצירה חדשה לגמרי"
    },
    {
      "id": "back",
      "label": "חזרה",
      "icon": "←",
      "description": "חזור לשיחה"
    }
  ],
  "collectedData": {
    "intent": "create",
    "topic": "הנושא שזוהה (אם יש)",
    "productType": "סוג המוצר (אם יש)"
  }
}

### דוגמה לתפריט יצירה:
קלט: "מבחן על השואה"
תשובה:
{
  "type": "creation_menu",
  "message": "מעולה! מבחן על השואה 📝 איך תרצי להמשיך?",
  "menuOptions": [
    {"id": "existing", "label": "פעילות קיימת", "icon": "🔄", "description": "חיפוש בתכנים שיצרת בעבר"},
    {"id": "template", "label": "תבנית מוכנה", "icon": "⚡", "description": "תבניות מהירות לשימוש חוזר"},
    {"id": "scratch", "label": "מאפס", "icon": "✨", "description": "יצירה חדשה לגמרי"},
    {"id": "back", "label": "חזרה", "icon": "←", "description": "חזור לשיחה"}
  ],
  "collectedData": {
    "intent": "create",
    "topic": "השואה",
    "productType": "exam",
    "subject": "היסטוריה"
  }
}

### מתי לא להציג תפריט יצירה:
- המורה ציינה את כל הפרטים (נושא + סוג + כיתה + רמה) - עבור ישר ל-options
- המורה ביקשה במפורש חיפוש ("יש לי משהו על...?") - עבור ל-content_search
- המורה ביקשה תבנית ("תבנית מהירה", "משהו מוכן") - עבור ל-template_suggestion
- המורה ביקשה יצירה מקובץ/טקסט/יוטיוב - טפל במקור התוכן
- intent הוא advise או question

## התנהגות חשובה:
1. זהה את כוונת המורה: יצירה (create), בקשת ייעוץ (advise), או שאלה כללית (question)
2. **חשוב מאוד**: תמיד שאל לאיזו רמת קושי הפעילות מיועדת (ידע והבנה/יישום וניתוח/הערכה ויצירה) - אלא אם המורה כבר ציינה
3. אם חסר מידע קריטי - שאל שאלה אחת ממוקדת וקצרה
4. **שיקוף לפני יצירה**: כשיש מספיק מידע להציע אפשרויות, תמיד התחל בסיכום קצר של מה שהבנת מהמורה. למשל: "אז בואי נסכם: פעילות על שברים, לכיתה ד׳, ברמת יישום וניתוח. הנה האפשרויות:"
5. כשיש מספיק מידע (נושא + סוג + כיתה + רמה) - הצע 2-3 אפשרויות קונקרטיות
6. התאם את ההצעות לגיל התלמידים, לנושא ולרמת הקושי
7. היה קצר, חם וידידותי - מקסימום 2-3 משפטים לכל תשובה
8. אם המורה מבקש ייעוץ - תן רעיונות יצירתיים ומעניינים
9. הבן הקשר: אם המורה אומר "כיתה ד" - זה grade, אם אומר "מתמטיקה" - זה subject
10. אם המורה מזכירה "תלמידים מתקשים", "לקויי למידה", "הבנת הנקרא" - זה רמז לרמה 1 (ידע והבנה)
11. אם המורה מזכירה "מחוננים", "מתקדמים", "אתגר" - זה רמז לרמה 3 (הערכה ויצירה)
12. אם המורה שואלת "מה ההבדל בין הרמות?" - הסבר בקצרה ושאל לאיזו רמה היא צריכה

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
  "type": "question" | "options" | "info" | "curriculum_query" | "content_search" | "template_suggestion" | "reuse_suggestion" | "prompt_suggestion" | "creation_menu" | "static_content",
  "message": "הודעה קצרה למורה",
  "contentType": "interactive" | "static" | "unclear",  // רק אם type=prompt_suggestion או reuse_suggestion או static_content
  "quickReplies": ["אפשרות 1", "אפשרות 2", "אפשרות 3"],  // רק אם type=question
  "options": [...],  // רק אם type=options
  "curriculumQuery": {...},  // רק אם type=curriculum_query
  "contentSearch": {...},  // רק אם type=content_search או reuse_suggestion
  "promptSearch": {...},  // רק אם type=prompt_suggestion
  "templates": [...],  // רק אם type=template_suggestion
  "menuOptions": [...],  // רק אם type=creation_menu - אפשרויות התפריט
  "staticContentRequest": {...},  // רק אם type=static_content - פרטי התוכן ליצירה
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
  "quickReplies": ["כיתה ד׳ - יישום וניתוח", "כיתה ד׳ - ידע והבנה", "כיתה ה׳ - יישום וניתוח", "כיתה אחרת"],
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
  "message": "יש 3 רמות:\\n\\n🟢 **ידע והבנה** - שפה פשוטה, שאלות ישירות, רמזים - לתלמידים מתקשים\\n🔵 **יישום וניתוח** - רמה רגילה, דורש הבנה - לרוב הכיתה\\n🔴 **הערכה ויצירה** - אתגר, חשיבה ביקורתית - למתקדמים\\n\\nלאיזו רמה את צריכה?",
  "quickReplies": ["ידע והבנה", "יישום וניתוח", "הערכה ויצירה", "את שלושתן"],
  "collectedData": {
    "intent": "question"
  }
}

קלט: "כיתה ד׳, רמת יישום"
תשובה (עם הקשר קודם של ט״ו בשבט):
{
  "type": "options",
  "message": "אז אני מבין: פעילות על ט״ו בשבט, לכיתה ד׳, ברמת יישום וניתוח. הנה מה שאני מציע:",
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
    const validTypes = ['question', 'options', 'info', 'ready', 'curriculum_query', 'content_search', 'template_suggestion', 'reuse_suggestion', 'prompt_suggestion', 'creation_menu', 'static_content'];
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

    // Add curriculum query if present
    if (response.curriculumQuery) {
        result.curriculumQuery = response.curriculumQuery;
    }

    // Add content search if present
    if (response.contentSearch) {
        result.contentSearch = response.contentSearch;
    }

    // Add prompt search if present
    if (response.promptSearch) {
        result.promptSearch = response.promptSearch;
    }

    // Add content type if present
    if (response.contentType) {
        result.contentType = response.contentType;
    }

    // Add menu options if present (for creation_menu type)
    if (response.menuOptions && Array.isArray(response.menuOptions)) {
        result.menuOptions = response.menuOptions.map((opt: any) => ({
            id: opt.id || 'scratch',
            label: opt.label || '',
            icon: opt.icon || '✨',
            description: opt.description || ''
        }));
    }

    // Add static content request if present (for static_content type)
    if (response.staticContentRequest) {
        result.staticContentRequest = {
            contentType: response.staticContentRequest.contentType || 'custom',
            topic: response.staticContentRequest.topic || '',
            grade: response.staticContentRequest.grade,
            subject: response.staticContentRequest.subject,
            additionalInstructions: response.staticContentRequest.additionalInstructions
        };
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

    // Generate a human-readable summary of what was collected
    const generateSummary = () => {
        const parts: string[] = [];

        if (collectedData.topic) {
            parts.push(`נושא: ${collectedData.topic}`);
        }
        if (selectedOption.productType) {
            const productNames: Record<string, string> = {
                'activity': 'פעילות',
                'exam': 'מבחן',
                'lesson': 'מערך שיעור',
                'podcast': 'פודקאסט'
            };
            parts.push(`סוג: ${productNames[selectedOption.productType] || selectedOption.productType}`);
        }
        if (collectedData.grade) {
            parts.push(`קהל יעד: ${collectedData.grade}`);
        }
        if (collectedData.subject) {
            parts.push(`מקצוע: ${collectedData.subject}`);
        }
        if (selectedOption.activityLength) {
            const lengthNames: Record<string, string> = {
                'short': 'קצר',
                'medium': 'בינוני',
                'long': 'ארוך'
            };
            parts.push(`היקף: ${lengthNames[selectedOption.activityLength] || selectedOption.activityLength}`);
        }

        return parts.length > 0 ? parts.join(' • ') : undefined;
    };

    return {
        mode: getMode(),
        file: null,
        pastedText: '',
        title: collectedData.topic || selectedOption.title,
        originalTopic: collectedData.topic || selectedOption.title,
        textbookSelection: collectedData.textbookInfo ? { info: collectedData.textbookInfo } : null,
        youtubeUrl: collectedData.youtubeUrl || null,
        conversationSummary: generateSummary(), // Summary of what was collected in chat
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
        youtubeUrl: null,
        contentDeliveryMode: null
    };
}
