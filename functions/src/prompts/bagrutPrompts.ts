/**
 * Bagrut Question Generation Prompts
 * פרומפטים ליצירת שאלות בגרות באמצעות AI
 */

import type { BagrutSubject, BagrutQuestionType, BagrutDifficulty } from '../../../src/shared/types/bagrutTypes';

// ============================================
// SUBJECT-SPECIFIC CONTEXT
// ============================================

/**
 * SUBJECT_CONTEXT - מבוסס על תכניות הלימודים הרשמיות של משרד החינוך
 *
 * מקורות:
 * - אזרחות: https://pop.education.gov.il/tchumey_daat/citizenship/citizenship-high-school/
 * - ספרות: https://pop.education.gov.il/tchumey_daat/safrut/chativa-elyona/pedagogia-safrut2/
 * - תנ"ך: https://meyda.education.gov.il/files/Mazkirut_Pedagogit/tanach/TochnitTashat.pdf
 * - עברית: https://pop.education.gov.il/tchumey_daat/ivrit_havana_habaa_lashon/chativa-elyona/
 * - אנגלית: https://pop.education.gov.il/tchumey_daat/english/chativa-elyona/bagrut-exam/
 * - היסטוריה: https://pop.education.gov.il/tchumey_daat/History/High-School/
 */
export const SUBJECT_CONTEXT: Record<BagrutSubject, {
    hebrewName: string;
    description: string;
    chapters: string[];
    questionStyles: string;
    rubricGuidelines: string;
}> = {
    civics: {
        hebrewName: 'אזרחות',
        description: 'מקצוע העוסק ביסודות הדמוקרטיה, זכויות האדם והאזרח, ומוסדות השלטון בישראל',
        chapters: [
            // פרק 1: מבוא
            'מבוא - מהי מדינה ומה תפקידיה',
            // פרק 2: מדינה יהודית
            'ישראל כמדינה יהודית - סמלים, חוקים וזהות',
            'חוק השבות וחוק האזרחות',
            // פרק 3: מדינה דמוקרטית
            'עקרונות הדמוקרטיה - שלטון העם והכרעת הרוב',
            'תרבות פוליטית דמוקרטית - סובלנות ופלורליזם',
            'זכויות האדם והאזרח - טבעיות ואזרחיות',
            'זכויות קבוצתיות וזכויות חברתיות',
            // פרק 4: המשטר במדינת ישראל
            'הכרזת העצמאות וחוקי היסוד',
            'הרשות המחוקקת - הכנסת',
            'הרשות המבצעת - הממשלה',
            'הרשות השופטת - בתי המשפט',
            'עקרון הפרדת הרשויות ואיזונים',
            'מערכת הבחירות בישראל',
            // פרק 5: אשכולות
            'סוגיות שנויות במחלוקת בחברה הישראלית',
            'יחסי דת ומדינה',
            'מיעוטים בישראל'
        ],
        questionStyles: `
- שאלות על מושגים יסודיים (דמוקרטיה, פלורליזם, סובלנות, הכרעת הרוב)
- ניתוח קטעים מחוקי יסוד ומהכרזת העצמאות
- השוואה בין גישות שונות (ליברלית vs רפובליקנית vs רב-תרבותית)
- יישום עקרונות על מקרים אקטואליים
- דילמות ערכיות בין ערכים מתנגשים (יהודית ודמוקרטית)
- ניתוח רשויות השלטון ותפקידיהן`,
        rubricGuidelines: `
- הבנת המושג/העיקרון (30%)
- יכולת להסביר ולהדגים (30%)
- חשיבה ביקורתית ויישום (25%)
- ארגון ובהירות (15%)`
    },

    literature: {
        hebrewName: 'ספרות',
        description: 'מקצוע העוסק בניתוח יצירות ספרות עברית וכללית',
        chapters: [
            // אשכול א: רומן וסיפור
            'סיפורי ש"י עגנון - האדונית והרוכל, מדירה לדירה, פרנהיים',
            'סיפור עברי מהמחצית הראשונה של המאה ה-20',
            'סיפור עברי מהמחצית השנייה של המאה ה-20',
            'סיפורים מתורגמים',
            'רומן ונובלה - סיפור פשוט, 1984',
            // אשכול ב: דרמה ושירה
            'דרמה - ניתוח מחזות',
            'שירה עברית קלאסית - רחל, אלתרמן, לאה גולדברג',
            'שירה עברית מודרנית - עמיחי, זך',
            'שירת ימי הביניים',
            'שירה עכשווית',
            // מיומנויות
            'אמצעים ספרותיים ורטוריים',
            'ניתוח דמויות ועלילה',
            'נושאים ומוטיבים ביצירה',
            'יצירה שלא נלמדה - קריאה וניתוח עצמאי'
        ],
        questionStyles: `
- ניתוח קטע מתוך יצירה (דמות, עלילה, סגנון)
- זיהוי אמצעים ספרותיים והסבר תפקידם
- השוואה בין יצירות או דמויות
- פרשנות לנושא או מוטיב מרכזי
- ניתוח שיר (מבנה, תוכן, אמצעים, צלילים)
- ניתוח יצירה שלא נלמדה`,
        rubricGuidelines: `
- הבנת היצירה והקטע (25%)
- זיהוי נכון של אמצעים/מאפיינים (25%)
- ניתוח והסבר (30%)
- שפה וסגנון (20%)`
    },

    bible: {
        hebrewName: 'תנ"ך',
        description: 'מקצוע העוסק בלימוד ופרשנות ספרי התנ"ך',
        chapters: [
            // תורה
            'בראשית - סיפורי האבות',
            'בראשית - סיפורי יוסף ואחיו',
            'שמות - יציאת מצרים והתהוות האומה',
            'דברים - נאומי משה והברית',
            // נביאים ראשונים - היסטוריוגרפיה
            'יהושע - כיבוש הארץ',
            'שופטים - תקופת השופטים',
            'שמואל א - שאול ודוד',
            'שמואל ב - מלכות דוד',
            'מלכים - מלכות ישראל ויהודה',
            // נביאים אחרונים - נבואה
            'ישעיהו - נבואות תוכחה ונחמה',
            'ירמיהו - נבואות החורבן',
            'תרי עשר - עמוס, הושע, מיכה',
            // כתובים
            'תהילים - מזמורים נבחרים',
            'משלי - חכמת החיים',
            'איוב - שאלת הצדיק ורע לו',
            'שיבת ציון - עזרא ונחמיה'
        ],
        questionStyles: `
- הבנת פשט הכתוב
- פרשנות מסורתית (רש"י, רמב"ן, אבן עזרא)
- זיהוי מוטיבים ונושאים
- השוואה בין דמויות או אירועים
- ערכים ולקחים העולים מהטקסט
- ניתוח סגנון ספרותי במקרא`,
        rubricGuidelines: `
- הבנת הפשט (25%)
- ידיעת פרשנות (25%)
- ניתוח והסבר (30%)
- קישור לערכים (20%)`
    },

    hebrew: {
        hebrewName: 'עברית',
        description: 'מקצוע העוסק בהבנת הנקרא, הבעה בכתב ולשון',
        chapters: [
            // הבנת הנקרא (שאלון 70%)
            'הבנת הנקרא - טקסטים עיוניים',
            'הבנת הנקרא - טקסטים ספרותיים',
            'הבנת הנקרא - טקסטים בלתי-מילוליים',
            'זיהוי טענות וראיות בטקסט',
            'מבנה הטקסט ואמצעים רטוריים',
            // הבעה (שאלון 30%)
            'כתיבה - חיבור טיעוני',
            'כתיבה - סיכום טקסט',
            'כתיבה - מכתב ונאום',
            // לשון
            'לשון - תחביר המשפט',
            'לשון - מורפולוגיה וצורות הפועל',
            'לשון - אוצר מילים ומשמעויות',
            'לשון - סמנטיקה ופרגמטיקה'
        ],
        questionStyles: `
- שאלות הבנה על טקסט נתון (חסר היכרות מוקדמת)
- זיהוי טענות מרכזיות וראיות תומכות
- שאלות על מבנה הטקסט ואמצעים רטוריים
- שאלות דקדוק ותחביר
- כתיבת פסקה, סיכום או חיבור טיעוני
- ניתוח גרפים וטקסטים לא-מילוליים`,
        rubricGuidelines: `
- הבנת הטקסט (30%)
- דיוק בתשובה (25%)
- ידע לשוני (25%)
- ניסוח ובהירות (20%)`
    },

    english: {
        hebrewName: 'אנגלית',
        description: 'מקצוע העוסק בהבנת הנקרא, כתיבה ולשון באנגלית',
        chapters: [
            // Module E/A - Unseen (70%)
            'Reading Comprehension - Unseen Narrative Text',
            'Reading Comprehension - Unseen Expository Text',
            'Listening Comprehension',
            // Module F/B - Literature
            'Literature - Poetry Analysis',
            'Literature - Short Stories',
            'Literature - Play/Drama',
            // Module G/C - Unseen + Writing
            'Advanced Reading Comprehension',
            'Essay Writing - Argumentative',
            'Essay Writing - Discursive',
            // Language Skills
            'Language - Grammar in Context',
            'Language - Vocabulary and Word Formation',
            'Bridging and Inference Skills'
        ],
        questionStyles: `
- Reading comprehension questions (multiple choice and open)
- Vocabulary in context and word meaning
- Grammar and sentence completion
- Bridging and inference questions
- Short answer questions requiring textual evidence
- Essay writing with clear argument and organization
- Literature analysis (character, theme, literary devices)`,
        rubricGuidelines: `
- Understanding main ideas (25%)
- Identifying details and evidence (25%)
- Language accuracy (25%)
- Expression and organization (25%)`
    },

    history: {
        hebrewName: 'היסטוריה',
        description: 'מקצוע העוסק בהיסטוריה של עם ישראל והעולם',
        chapters: [
            // לאומיות וציונות
            'התנועה הציונית - רעיונות וזרמים',
            'הקונגרסים הציוניים והרצל',
            'העליות לארץ ישראל',
            'ההתיישבות ובניין הארץ',
            // תקופת המנדט
            'ארץ ישראל בתקופת המנדט הבריטי',
            'המאבק על העצמאות',
            // מלחמת העולם השנייה והשואה
            'עליית הנאציזם באירופה',
            'מלחמת העולם השנייה',
            'השואה - רקע, מהלך וזיכרון',
            'ניצולי השואה והעפלה',
            // הקמת המדינה
            'הכרזת המדינה ומלחמת העצמאות',
            'קליטת העלייה ההמונית',
            // ישראל בעשורים הראשונים
            'חברה וכלכלה בישראל',
            'מלחמות ישראל - סיני, ששת הימים, יום כיפור',
            // יחסי חוץ
            'הסכסוך הישראלי-ערבי',
            'הסכמי שלום ותהליכים מדיניים'
        ],
        questionStyles: `
- שאלות על תהליכים היסטוריים (סיבה ותוצאה)
- ניתוח מקורות ראשוניים (מסמכים, תמונות, עדויות)
- השוואה בין תקופות או אירועים
- הערכת משמעות היסטורית
- זיהוי נקודות מפנה
- קישור בין אירועים לתהליכים רחבים`,
        rubricGuidelines: `
- ידע עובדתי (25%)
- הבנת תהליכים (30%)
- ניתוח מקורות (25%)
- ארגון וטיעון (20%)`
    }
};

// ============================================
// QUESTION TYPE TEMPLATES
// ============================================

export const QUESTION_TYPE_TEMPLATES: Record<BagrutQuestionType, {
    description: string;
    structure: string;
    example: string;
}> = {
    'open': {
        description: 'שאלה פתוחה הדורשת תשובה מפורטת בכתב',
        structure: `השאלה צריכה:
- להיות ברורה וחד-משמעית
- לדרוש הסבר, ניתוח או השוואה
- לאפשר מספר זוויות תשובה נכונות
- לכלול הנחיות לגבי היקף התשובה (מספר נקודות/משפטים)`,
        example: `הסבר מהו עקרון הפרדת הרשויות ומדוע הוא חשוב במדינה דמוקרטית. הבא שתי דוגמאות ליישום העיקרון במדינת ישראל. (15 נקודות)`
    },

    'multiple-choice': {
        description: 'שאלה עם ארבע אפשרויות תשובה, אחת נכונה',
        structure: `השאלה צריכה:
- להיות ברורה ותמציתית
- לכלול 4 אפשרויות סבירות
- המסיחים (תשובות שגויות) צריכים להיות אמינים
- להימנע מ"כל התשובות נכונות" או "אף תשובה"`,
        example: `מהו התפקיד העיקרי של הכנסת?
א. לבחור את ראש הממשלה
ב. לחוקק חוקים ולפקח על הממשלה
ג. לשפוט עבריינים
ד. לנהל את מדיניות החוץ`
    },

    'source-analysis': {
        description: 'ניתוח קטע מקור (טקסט, מסמך, ציטוט)',
        structure: `השאלה צריכה:
- להציג קטע מקור אותנטי או מייצג
- לשאול שאלות על הקטע עצמו
- לדרוש הבנה, פרשנות ויישום
- לכלול 2-3 תת-שאלות`,
        example: `קרא את הקטע מתוך הכרזת העצמאות:
"מדינת ישראל... תקיים שוויון זכויות חברתי ומדיני גמור לכל אזרחיה בלי הבדל דת, גזע ומין"

א. מהו העיקרון המרכזי העולה מהקטע? (5 נקודות)
ב. הסבר כיצד עיקרון זה בא לידי ביטוי בחוקי יסוד של ישראל. (10 נקודות)`
    },

    'essay': {
        description: 'חיבור או תשובה מורחבת',
        structure: `השאלה צריכה:
- להגדיר נושא ברור לכתיבה
- לכלול הנחיות למבנה (פתיחה, גוף, סיכום)
- לציין היקף נדרש (מילים/פסקאות)
- לתת קריטריונים להערכה`,
        example: `כתוב חיבור בנושא: האם יש להגביל את חופש הביטוי ברשתות החברתיות?
- פתח בהצגת הנושא
- הצג לפחות שתי טענות בעד ושתי טענות נגד
- הבע את עמדתך המנומקת
- היקף: 250-300 מילים`
    },

    'fill-in-blanks': {
        description: 'השלמת מילים או ביטויים חסרים',
        structure: `השאלה צריכה:
- להציג טקסט עם חסרים ברורים
- החסרים צריכים לבדוק ידע או הבנה
- לספק בנק מילים (אופציונלי)
- כל חסר שווה ניקוד ברור`,
        example: `השלם את המשפטים הבאים:
הרשות _______ אחראית על חקיקת חוקים בישראל.
הרשות _______ אחראית על ביצוע החוקים.
הרשות _______ אחראית על פרשנות החוקים.`
    },

    'matching': {
        description: 'התאמה בין פריטים משני טורים',
        structure: `השאלה צריכה:
- להציג שני טורים ברורים
- מספר פריטים שווה או עודף באחד הטורים
- קשרים לוגיים ברורים
- הנחיות ברורות`,
        example: `התאם בין המושג לבין ההגדרה:
1. פלורליזם     א. הכרה בזכות הרוב להכריע
2. הכרעת הרוב   ב. קבלת מגוון דעות ואורחות חיים
3. שלטון החוק   ג. כפיפות כל האזרחים והשלטון לחוק`
    }
};

// ============================================
// DIFFICULTY GUIDELINES
// ============================================

export const DIFFICULTY_GUIDELINES: Record<BagrutDifficulty, {
    description: string;
    cognitiveLevel: string;
    languageLevel: string;
}> = {
    1: {
        description: 'קל - שאלות בסיסיות לבדיקת ידע והבנה',
        cognitiveLevel: 'זכירה והבנה (Remember, Understand)',
        languageLevel: 'שפה פשוטה, משפטים קצרים, מונחים בסיסיים'
    },
    2: {
        description: 'בינוני - שאלות הדורשות יישום וניתוח',
        cognitiveLevel: 'יישום וניתוח (Apply, Analyze)',
        languageLevel: 'שפה סטנדרטית, מושגים מקצועיים, הקשרים'
    },
    3: {
        description: 'קשה - שאלות הדורשות סינתזה והערכה',
        cognitiveLevel: 'סינתזה והערכה (Evaluate, Create)',
        languageLevel: 'שפה מורכבת, ניתוח רב-שכבתי, טיעון'
    }
};

// ============================================
// MAIN GENERATION PROMPT
// ============================================

export function generateBagrutQuestionPrompt(params: {
    subject: BagrutSubject;
    chapter: string;
    topic: string;
    questionType: BagrutQuestionType;
    difficulty: BagrutDifficulty;
    points: number;
}): string {
    const subjectInfo = SUBJECT_CONTEXT[params.subject];
    const typeInfo = QUESTION_TYPE_TEMPLATES[params.questionType];
    const difficultyInfo = DIFFICULTY_GUIDELINES[params.difficulty];

    return `# יצירת שאלת בגרות

## הקשר
אתה מומחה ביצירת שאלות בגרות במקצוע **${subjectInfo.hebrewName}**.
המטרה: ליצור שאלת תרגול איכותית בסגנון בחינות הבגרות של משרד החינוך בישראל.

## פרטי השאלה
- **מקצוע**: ${subjectInfo.hebrewName}
- **פרק/נושא**: ${params.chapter}
- **תת-נושא**: ${params.topic}
- **סוג שאלה**: ${typeInfo.description}
- **רמת קושי**: ${difficultyInfo.description}
- **ניקוד**: ${params.points} נקודות

## הנחיות לסוג השאלה
${typeInfo.structure}

**דוגמה:**
${typeInfo.example}

## הנחיות לרמת הקושי
- **רמה קוגניטיבית**: ${difficultyInfo.cognitiveLevel}
- **רמת שפה**: ${difficultyInfo.languageLevel}

## סגנונות שאלות אופייניים למקצוע
${subjectInfo.questionStyles}

## הנחיות למחוון
${subjectInfo.rubricGuidelines}

## פורמט התשובה (JSON)
החזר את השאלה בפורמט JSON הבא:
\`\`\`json
{
    "question": "טקסט השאלה המלא",
    "sourceText": "קטע מקור אם רלוונטי, אחרת null",
    "sourceReference": "מקור הקטע אם רלוונטי",
    "subQuestions": [
        {
            "label": "א",
            "question": "תת-שאלה",
            "points": 5,
            "modelAnswer": "תשובה לדוגמה",
            "keywords": ["מילת מפתח 1", "מילת מפתח 2"]
        }
    ],
    "options": ["אפשרות א", "אפשרות ב", "אפשרות ג", "אפשרות ד"],
    "correctOptionIndex": 1,
    "modelAnswer": "תשובה מלאה לדוגמה",
    "rubric": [
        {
            "criterion": "הבנת המושג",
            "maxPoints": 5,
            "levels": [
                {"points": 5, "description": "הסבר מלא ומדויק"},
                {"points": 3, "description": "הסבר חלקי"},
                {"points": 0, "description": "לא הבין"}
            ]
        }
    ],
    "keywords": ["מילות מפתח לתשובה טובה"],
    "commonMistakes": ["טעות נפוצה 1", "טעות נפוצה 2"],
    "hints": [
        "רמז כללי",
        "רמז ספציפי יותר",
        "רמז שכמעט נותן את התשובה"
    ],
    "timeEstimate": 10
}
\`\`\`

## כללים חשובים
1. השאלה חייבת להיות בעברית תקנית ובהירה
2. התאם את רמת השפה והמורכבות לרמת הקושי
3. המחוון חייב להיות ברור ואובייקטיבי
4. תשובה לדוגמה חייבת להיות מלאה ומדויקת
5. הרמזים צריכים להיות מדורגים מכללי לספציפי
6. אל תשתמש בשאלות מבחינות קיימות - צור שאלות מקוריות

צור את השאלה:`;
}

// ============================================
// BATCH GENERATION PROMPT
// ============================================

export function generateBagrutQuestionBatchPrompt(params: {
    subject: BagrutSubject;
    chapter: string;
    count: number;
    includeTypes: BagrutQuestionType[];
    difficulties: BagrutDifficulty[];
}): string {
    const subjectInfo = SUBJECT_CONTEXT[params.subject];

    return `# יצירת מערך שאלות בגרות

## הקשר
צור ${params.count} שאלות בגרות במקצוע **${subjectInfo.hebrewName}** לפרק **${params.chapter}**.

## דרישות
- **סוגי שאלות**: ${params.includeTypes.map(t => QUESTION_TYPE_TEMPLATES[t].description).join(', ')}
- **רמות קושי**: ${params.difficulties.map(d => DIFFICULTY_GUIDELINES[d].description).join(', ')}
- **מגוון נושאים**: כסה נושאים שונים בתוך הפרק

## סגנונות מומלצים למקצוע
${subjectInfo.questionStyles}

## הנחיות למחוון
${subjectInfo.rubricGuidelines}

## פורמט התשובה
החזר מערך JSON של שאלות, כל שאלה במבנה המלא (כולל question, modelAnswer, rubric, hints וכו').

\`\`\`json
{
    "questions": [
        {
            "questionType": "open",
            "difficulty": 2,
            "points": 15,
            "topic": "נושא ספציפי",
            "question": "...",
            "modelAnswer": "...",
            "rubric": [...],
            "hints": [...],
            ...
        }
    ]
}
\`\`\`

צור את השאלות:`;
}

// ============================================
// ANSWER EVALUATION PROMPT
// ============================================

export function generateAnswerEvaluationPrompt(params: {
    subject: BagrutSubject;
    question: string;
    modelAnswer: string;
    rubric: Array<{ criterion: string; maxPoints: number }>;
    studentAnswer: string;
    keywords?: string[];
}): string {
    const subjectInfo = SUBJECT_CONTEXT[params.subject];

    return `# הערכת תשובת תלמיד

## הקשר
אתה מעריך תשובה לשאלת בגרות במקצוע **${subjectInfo.hebrewName}**.

## השאלה
${params.question}

## תשובה לדוגמה
${params.modelAnswer}

## מחוון הערכה
${params.rubric.map(r => `- ${r.criterion}: עד ${r.maxPoints} נקודות`).join('\n')}

${params.keywords ? `## מילות מפתח צפויות\n${params.keywords.join(', ')}` : ''}

## תשובת התלמיד
${params.studentAnswer}

## הנחיות להערכה
1. הערך את התשובה לפי כל קריטריון במחוון
2. זהה מילות מפתח שהתלמיד השתמש בהן
3. ציין נקודות חוזק ונקודות לשיפור
4. תן ציון כולל מנומק

## פורמט התשובה (JSON)
\`\`\`json
{
    "totalScore": 12,
    "maxScore": 15,
    "percentage": 80,
    "rubricScores": {
        "הבנת המושג": {"score": 4, "maxScore": 5, "feedback": "הסבר טוב אך חסר פרט אחד"},
        "דוגמאות": {"score": 5, "maxScore": 5, "feedback": "דוגמאות מצוינות"},
        "ניסוח": {"score": 3, "maxScore": 5, "feedback": "יש לשפר את הבהירות"}
    },
    "matchedKeywords": ["דמוקרטיה", "זכויות"],
    "strengths": ["הבנה טובה של העיקרון", "דוגמאות רלוונטיות"],
    "improvements": ["לפרט יותר בהסבר", "לשפר את מבנה התשובה"],
    "overallFeedback": "תשובה טובה שמראה הבנה של הנושא. כדאי להוסיף עוד פרטים ולארגן את התשובה בצורה ברורה יותר."
}
\`\`\`

הערך את התשובה:`;
}

// ============================================
// EXPORT CHAPTER MAPPING FOR SEEDING
// ============================================

export function getSubjectChapters(subject: BagrutSubject): string[] {
    return SUBJECT_CONTEXT[subject].chapters;
}

export function getAllSubjects(): BagrutSubject[] {
    return Object.keys(SUBJECT_CONTEXT) as BagrutSubject[];
}
