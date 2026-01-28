/**
 * Prompts for Micro Activity Generation
 *
 * These prompts are designed for generating single activity blocks quickly,
 * without the full skeleton/architect flow.
 */

import { MicroActivityType } from '../shared/types/microActivityTypes';

/**
 * Linguistic constraints by grade level
 */
export const GRADE_LINGUISTIC_CONSTRAINTS: Record<string, string> = {
  'א': 'שפה פשוטה מאוד. משפטים קצרים (עד 5 מילים). מילות יסוד בלבד. ללא מונחים מורכבים.',
  'ב': 'שפה פשוטה. משפטים קצרים (עד 7 מילים). אוצר מילים בסיסי. ללא מושגים מופשטים.',
  'ג': 'שפה פשוטה עם מושגים בסיסיים. משפטים בינוניים (עד 10 מילים).',
  'ד': 'שפה ברורה. משפטים בינוניים. אפשר להכניס מושגים חדשים עם הסבר.',
  'ה': 'שפה מגוונת. משפטים מורכבים יותר. מושגים חדשים מותרים.',
  'ו': 'שפה עשירה. אפשר להשתמש במשפטים מורכבים ומושגים מתקדמים.',
  'ז': 'שפה אקדמית מותאמת. מושגים מקצועיים עם הקשר.',
  'ח': 'שפה אקדמית. ניתן להשתמש במונחים מקצועיים.',
  'ט': 'שפה אקדמית מלאה. מושגים מורכבים ומשפטים ארוכים מותרים.',
  'י': 'שפה אקדמית מתקדמת. רמת תיכון.',
  'יא': 'שפה אקדמית מתקדמת. רמת תיכון גבוהה.',
  'יב': 'שפה אקדמית מלאה. רמת בגרות.'
};

/**
 * Base system prompt for all micro activities
 */
export const MICRO_ACTIVITY_SYSTEM_PROMPT = `אתה מחולל פעילויות לימודיות.
המשימה שלך: ליצור פעילות לימודית אחת, איכותית וממוקדת.

כללים:
1. **שפה:** עברית בלבד (לא כולל prompt לתמונות שיהיה באנגלית)
2. **תוכן:** השתמש רק במידע מהמקור שסופק (אם סופק). אל תמציא עובדות.
3. **איכות:** ודא שיש תשובה נכונה אחת ברורה (למעט שאלות פתוחות).
4. **פורמט:** החזר JSON תקין בלבד, ללא הסברים נוספים.

**כללי כתיבה בעברית:**
- סדר מילים טבעי: נושא, פועל, משלים
- לא להתחיל משפט עם נשוא או תואר
- משפטים זורמים וברורים
- ללא סימוני markdown (* או **)
`;

/**
 * Get prompt for specific micro activity type
 */
export function getMicroActivityPrompt(
  type: MicroActivityType,
  sourceText: string,
  gradeLevel: string
): string {
  const linguisticConstraint = GRADE_LINGUISTIC_CONSTRAINTS[gradeLevel] || GRADE_LINGUISTIC_CONSTRAINTS['ו'];

  const baseContext = `
**מקור התוכן:**
${sourceText ? `<source_text>\n${sourceText}\n</source_text>` : 'לא סופק מקור - צור תוכן מבוסס על הנושא שניתן.'}

**קהל יעד:** כיתה ${gradeLevel}
**אילוצי שפה:** ${linguisticConstraint}
`;

  const typePrompt = MICRO_TYPE_PROMPTS[type];
  if (!typePrompt) {
    throw new Error(`Unknown micro activity type: ${type}`);
  }

  return `${MICRO_ACTIVITY_SYSTEM_PROMPT}\n${baseContext}\n${typePrompt}`;
}

/**
 * Type-specific prompts
 */
export const MICRO_TYPE_PROMPTS: Record<MicroActivityType, string> = {

  // ==================== GAMES ====================

  memory_game: `
**משימה:** צור משחק זיכרון עם 6 זוגות.

**הנחיות:**
- כל זוג: card_a (מושג/מילה) ↔ card_b (הגדרה/תרגום/הסבר קצר)
- הזוגות צריכים להיות מגוונים ומכסים היבטים שונים של הנושא
- card_a: קצר (1-3 מילים)
- card_b: קצר (1-5 מילים)
- ודא שכל זוג הוא ייחודי וברור

**פורמט JSON:**
{
  "type": "memory_game",
  "suggestedTitle": "כותרת קצרה למשחק",
  "content": {
    "pairs": [
      { "card_a": "מושג 1", "card_b": "הגדרה 1" },
      { "card_a": "מושג 2", "card_b": "הגדרה 2" },
      { "card_a": "מושג 3", "card_b": "הגדרה 3" },
      { "card_a": "מושג 4", "card_b": "הגדרה 4" },
      { "card_a": "מושג 5", "card_b": "הגדרה 5" },
      { "card_a": "מושג 6", "card_b": "הגדרה 6" }
    ]
  }
}
`,

  matching: `
**משימה:** צור תרגיל התאמה עם 6 זוגות.

**הנחיות:**
- צד שמאל: מושגים/שאלות/מילים
- צד ימין: הגדרות/תשובות/תרגומים (יוצגו בסדר מעורבב)
- כל פריט צריך התאמה אחת ויחידה
- הימנע מהתאמות מעורפלות

**פורמט JSON:**
{
  "type": "matching",
  "suggestedTitle": "כותרת קצרה לתרגיל",
  "content": {
    "instruction": "התאם בין הפריטים משמאל לפריטים מימין",
    "leftItems": [
      { "id": "l1", "text": "פריט שמאל 1" },
      { "id": "l2", "text": "פריט שמאל 2" },
      { "id": "l3", "text": "פריט שמאל 3" },
      { "id": "l4", "text": "פריט שמאל 4" },
      { "id": "l5", "text": "פריט שמאל 5" },
      { "id": "l6", "text": "פריט שמאל 6" }
    ],
    "rightItems": [
      { "id": "r1", "text": "פריט ימין 1" },
      { "id": "r2", "text": "פריט ימין 2" },
      { "id": "r3", "text": "פריט ימין 3" },
      { "id": "r4", "text": "פריט ימין 4" },
      { "id": "r5", "text": "פריט ימין 5" },
      { "id": "r6", "text": "פריט ימין 6" }
    ],
    "correctMatches": [
      { "left": "l1", "right": "r1" },
      { "left": "l2", "right": "r2" },
      { "left": "l3", "right": "r3" },
      { "left": "l4", "right": "r4" },
      { "left": "l5", "right": "r5" },
      { "left": "l6", "right": "r6" }
    ]
  }
}
`,

  categorization: `
**משימה:** צור תרגיל מיון עם 2-3 קטגוריות ו-8 פריטים.

**הנחיות:**
- קטגוריות חייבות להיות מובחנות זו מזו (MUTUALLY EXCLUSIVE)
- כל פריט שייך לקטגוריה אחת בלבד
- חלוקה מאוזנת בין הקטגוריות
- פריטים ברורים וחד-משמעיים

**פורמט JSON:**
{
  "type": "categorization",
  "suggestedTitle": "כותרת קצרה לתרגיל",
  "content": {
    "question": "מיין את הפריטים הבאים לקטגוריות המתאימות",
    "categories": ["קטגוריה א", "קטגוריה ב"],
    "items": [
      { "text": "פריט 1", "category": "קטגוריה א" },
      { "text": "פריט 2", "category": "קטגוריה ב" },
      { "text": "פריט 3", "category": "קטגוריה א" },
      { "text": "פריט 4", "category": "קטגוריה ב" },
      { "text": "פריט 5", "category": "קטגוריה א" },
      { "text": "פריט 6", "category": "קטגוריה ב" },
      { "text": "פריט 7", "category": "קטגוריה א" },
      { "text": "פריט 8", "category": "קטגוריה ב" }
    ]
  }
}
`,

  ordering: `
**משימה:** צור תרגיל סידור עם 5 פריטים.

**הנחיות:**
- הסדר חייב להיות אובייקטיבי וברור (כרונולוגי, לוגי, או לפי גודל)
- ציין בהוראה מה הקריטריון לסידור
- פריטים צריכים להיות שונים מספיק כדי שהסדר יהיה ברור

**פורמט JSON:**
{
  "type": "ordering",
  "suggestedTitle": "כותרת קצרה לתרגיל",
  "content": {
    "instruction": "סדר את הפריטים הבאים בסדר כרונולוגי (מהמוקדם למאוחר)",
    "correct_order": [
      "פריט ראשון",
      "פריט שני",
      "פריט שלישי",
      "פריט רביעי",
      "פריט חמישי"
    ]
  }
}
`,

  sentence_builder: `
**משימה:** צור תרגיל בניית משפט אחד.

**הנחיות:**
- בחר משפט משמעותי מהנושא
- המשפט צריך להיות בעל משמעות לימודית
- 5-10 מילים
- ודא שיש סדר הגיוני אחד נכון

**פורמט JSON:**
{
  "type": "sentence_builder",
  "suggestedTitle": "כותרת קצרה לתרגיל",
  "content": {
    "instruction": "סדר את המילים למשפט נכון",
    "words": ["מילה1", "מילה2", "מילה3", "מילה4", "מילה5"],
    "correctSentence": "מילה1 מילה2 מילה3 מילה4 מילה5"
  }
}
`,

  drag_and_drop: `
**משימה:** צור תרגיל גרור והנח עם 3 אזורים ו-6 פריטים.

**הנחיות:**
- אזורים ברורים ומובחנים
- כל פריט שייך לאזור אחד בלבד
- הוראה ברורה

**פורמט JSON:**
{
  "type": "drag_and_drop",
  "suggestedTitle": "כותרת קצרה לתרגיל",
  "content": {
    "instruction": "גרור כל פריט לאזור המתאים",
    "zones": [
      { "id": "z1", "label": "אזור 1" },
      { "id": "z2", "label": "אזור 2" },
      { "id": "z3", "label": "אזור 3" }
    ],
    "items": [
      { "id": "i1", "text": "פריט 1", "correctZone": "z1" },
      { "id": "i2", "text": "פריט 2", "correctZone": "z2" },
      { "id": "i3", "text": "פריט 3", "correctZone": "z3" },
      { "id": "i4", "text": "פריט 4", "correctZone": "z1" },
      { "id": "i5", "text": "פריט 5", "correctZone": "z2" },
      { "id": "i6", "text": "פריט 6", "correctZone": "z3" }
    ]
  }
}
`,

  // ==================== QUESTIONS ====================

  fill_in_blanks: `
**משימה:** צור תרגיל השלמת חסר עם 4 משפטים.

**הנחיות:**
- כל משפט עם מילה אחת חסרה
- המילה החסרה צריכה להיות מילת מפתח משמעותית
- סמן את החסר עם ___
- ספק את המילה הנכונה

**פורמט JSON:**
{
  "type": "fill_in_blanks",
  "suggestedTitle": "כותרת קצרה לתרגיל",
  "content": {
    "instruction": "השלם את המילים החסרות",
    "sentences": [
      {
        "text": "משפט עם ___ חסרה",
        "answer": "מילה"
      },
      {
        "text": "משפט נוסף עם ___ חסרה",
        "answer": "מילה"
      },
      {
        "text": "משפט שלישי עם ___ חסרה",
        "answer": "מילה"
      },
      {
        "text": "משפט רביעי עם ___ חסרה",
        "answer": "מילה"
      }
    ]
  }
}
`,

  multiple_choice: `
**משימה:** צור 4 שאלות רב-ברירה.

**הנחיות:**
- כל שאלה עם 4 אפשרויות
- תשובה נכונה אחת בלבד
- מסיחים (אפשרויות שגויות) צריכים להיות סבירים אך שגויים בבירור
- שאלות מגוונות שמכסות היבטים שונים של הנושא

**פורמט JSON:**
{
  "type": "multiple_choice",
  "suggestedTitle": "כותרת קצרה לתרגיל",
  "content": {
    "questions": [
      {
        "question": "שאלה 1?",
        "options": ["אפשרות א", "אפשרות ב", "אפשרות ג", "אפשרות ד"],
        "correctAnswer": "אפשרות א"
      },
      {
        "question": "שאלה 2?",
        "options": ["אפשרות א", "אפשרות ב", "אפשרות ג", "אפשרות ד"],
        "correctAnswer": "אפשרות ב"
      },
      {
        "question": "שאלה 3?",
        "options": ["אפשרות א", "אפשרות ב", "אפשרות ג", "אפשרות ד"],
        "correctAnswer": "אפשרות ג"
      },
      {
        "question": "שאלה 4?",
        "options": ["אפשרות א", "אפשרות ב", "אפשרות ג", "אפשרות ד"],
        "correctAnswer": "אפשרות ד"
      }
    ]
  }
}
`,

  true_false: `
**משימה:** צור 5 טענות נכון/לא נכון.

**הנחיות:**
- טענות ברורות וחד-משמעיות
- חלוקה מאוזנת (כ-2-3 נכון, כ-2-3 לא נכון)
- טענות שגויות צריכות להיות שגויות בבירור (לא טריקים)
- הסבר קצר למה הטענה נכונה או שגויה

**פורמט JSON:**
{
  "type": "true_false",
  "suggestedTitle": "כותרת קצרה לתרגיל",
  "content": {
    "instruction": "קבע אם הטענות הבאות נכונות או לא",
    "statements": [
      { "text": "טענה 1", "isTrue": true, "explanation": "הסבר קצר" },
      { "text": "טענה 2", "isTrue": false, "explanation": "הסבר קצר" },
      { "text": "טענה 3", "isTrue": true, "explanation": "הסבר קצר" },
      { "text": "טענה 4", "isTrue": false, "explanation": "הסבר קצר" },
      { "text": "טענה 5", "isTrue": true, "explanation": "הסבר קצר" }
    ]
  }
}
`,

  open_question: `
**משימה:** צור שאלה פתוחה אחת לחשיבה.

**הנחיות:**
- שאלה שדורשת חשיבה והסבר
- לא שאלה עם תשובה של מילה אחת
- ספק תשובה מודל (3-4 נקודות)
- התאם לרמת הכיתה

**פורמט JSON:**
{
  "type": "open_question",
  "suggestedTitle": "כותרת קצרה לשאלה",
  "content": {
    "question": "שאלה פתוחה שדורשת חשיבה והסבר?"
  },
  "metadata": {
    "modelAnswer": "תשובה מודל: 1. נקודה ראשונה 2. נקודה שנייה 3. נקודה שלישית"
  }
}
`,

  matrix: `
**משימה:** צור שאלת מטריצה עם 4 שורות ו-3 עמודות.

**הנחיות:**
- עמודות: אפשרויות תשובה (למשל: נכון/לא נכון/לא יודע, או כן/לא/חלקית)
- שורות: טענות או שאלות
- תשובה נכונה אחת לכל שורה

**פורמט JSON:**
{
  "type": "matrix",
  "suggestedTitle": "כותרת קצרה לתרגיל",
  "content": {
    "instruction": "סמן את התשובה המתאימה לכל שורה",
    "columns": ["אפשרות א", "אפשרות ב", "אפשרות ג"],
    "rows": [
      { "question": "טענה/שאלה 1", "correctAnswer": "אפשרות א" },
      { "question": "טענה/שאלה 2", "correctAnswer": "אפשרות ב" },
      { "question": "טענה/שאלה 3", "correctAnswer": "אפשרות ג" },
      { "question": "טענה/שאלה 4", "correctAnswer": "אפשרות א" }
    ]
  }
}
`,

  // ==================== TEXT ====================

  highlight: `
**משימה:** צור תרגיל סימון בטקסט.

**הנחיות:**
- ספק טקסט קצר (3-5 משפטים)
- הגדר אילו חלקים צריך לסמן (מילים או ביטויים)
- הוראה ברורה מה לחפש

**פורמט JSON:**
{
  "type": "highlight",
  "suggestedTitle": "כותרת קצרה לתרגיל",
  "content": {
    "instruction": "סמן את כל המילים/הביטויים מסוג מסוים",
    "text": "טקסט קצר שמכיל את המילים שצריך לסמן. הטקסט צריך להיות ברור ומובן.",
    "correctHighlights": [
      { "start": 0, "end": 4, "text": "טקסט" },
      { "start": 20, "end": 26, "text": "מילים" }
    ],
    "highlightType": "background"
  }
}
`,

  text_selection: `
**משימה:** צור תרגיל בחירת טקסט.

**הנחיות:**
- ספק טקסט עם מספר משפטים
- הגדר מה צריך לבחור (מילים או משפטים)
- ציין את הבחירות הנכונות

**פורמט JSON:**
{
  "type": "text_selection",
  "suggestedTitle": "כותרת קצרה לתרגיל",
  "content": {
    "instruction": "בחר את המשפטים הנכונים מהטקסט",
    "text": "משפט ראשון. משפט שני. משפט שלישי. משפט רביעי.",
    "selectableUnits": "sentence",
    "correctSelections": ["משפט ראשון.", "משפט שלישי."],
    "minSelections": 1,
    "maxSelections": 3
  }
}
`,

  table_completion: `
**משימה:** צור תרגיל השלמת טבלה.

**הנחיות:**
- טבלה עם 3 עמודות ו-4 שורות
- חלק מהתאים מלאים, חלק ריקים להשלמה
- ציין אילו תאים ניתנים לעריכה ומה התשובה הנכונה

**פורמט JSON:**
{
  "type": "table_completion",
  "suggestedTitle": "כותרת קצרה לתרגיל",
  "content": {
    "instruction": "השלם את התאים החסרים בטבלה",
    "headers": ["עמודה א", "עמודה ב", "עמודה ג"],
    "rows": [
      {
        "cells": [
          { "value": "ערך 1", "editable": false },
          { "value": "", "editable": true, "correctAnswer": "תשובה" },
          { "value": "ערך 3", "editable": false }
        ]
      },
      {
        "cells": [
          { "value": "", "editable": true, "correctAnswer": "תשובה" },
          { "value": "ערך 2", "editable": false },
          { "value": "ערך 3", "editable": false }
        ]
      }
    ]
  }
}
`,

  // ==================== VISUAL ====================

  mindmap: `
**משימה:** צור מפת חשיבה על הנושא.

**הנחיות:**
- נושא מרכזי אחד
- 3-4 תת-נושאים
- 2-3 פרטים לכל תת-נושא
- מבנה היררכי ברור

**פורמט JSON:**
{
  "type": "mindmap",
  "suggestedTitle": "מפת חשיבה: [נושא]",
  "content": {
    "title": "הנושא המרכזי",
    "nodes": [
      { "id": "root", "type": "topic", "data": { "label": "נושא מרכזי" }, "position": { "x": 400, "y": 200 } },
      { "id": "sub1", "type": "subtopic", "data": { "label": "תת-נושא 1" }, "position": { "x": 200, "y": 100 } },
      { "id": "sub2", "type": "subtopic", "data": { "label": "תת-נושא 2" }, "position": { "x": 600, "y": 100 } },
      { "id": "sub3", "type": "subtopic", "data": { "label": "תת-נושא 3" }, "position": { "x": 200, "y": 300 } },
      { "id": "detail1", "type": "detail", "data": { "label": "פרט 1" }, "position": { "x": 100, "y": 50 } },
      { "id": "detail2", "type": "detail", "data": { "label": "פרט 2" }, "position": { "x": 300, "y": 50 } }
    ],
    "edges": [
      { "id": "e1", "source": "root", "target": "sub1" },
      { "id": "e2", "source": "root", "target": "sub2" },
      { "id": "e3", "source": "root", "target": "sub3" },
      { "id": "e4", "source": "sub1", "target": "detail1" },
      { "id": "e5", "source": "sub1", "target": "detail2" }
    ],
    "layoutDirection": "RL"
  }
}
`,

  infographic: `
**משימה:** צור תיאור לאינפוגרפיקה.

**הנחיות:**
- כותרת ברורה
- 4-5 נקודות מפתח
- מידע ויזואלי וקליט
- מתאים להצגה גרפית

**פורמט JSON:**
{
  "type": "infographic",
  "suggestedTitle": "אינפוגרפיקה: [נושא]",
  "content": {
    "title": "כותרת האינפוגרפיקה",
    "subtitle": "תת-כותרת או הסבר קצר",
    "sections": [
      {
        "title": "נקודה 1",
        "content": "הסבר קצר",
        "icon": "chart"
      },
      {
        "title": "נקודה 2",
        "content": "הסבר קצר",
        "icon": "lightbulb"
      },
      {
        "title": "נקודה 3",
        "content": "הסבר קצר",
        "icon": "check"
      },
      {
        "title": "נקודה 4",
        "content": "הסבר קצר",
        "icon": "star"
      }
    ],
    "footer": "סיכום או מסר מסכם"
  }
}
`
};

/**
 * Validation prompt for micro activities (Lite version of Guardian)
 */
export const MICRO_VALIDATION_PROMPT = `
בדוק את הפעילות הלימודית הבאה:

**בדיקות:**
1. האם יש תשובה נכונה ברורה?
2. האם השפה מתאימה לרמת הכיתה?
3. האם התוכן הגיוני ונכון?
4. האם הפורמט תקין?

**החזר JSON:**
{
  "isValid": true/false,
  "issues": ["בעיה 1", "בעיה 2"],
  "suggestions": ["הצעה לשיפור"]
}
`;
