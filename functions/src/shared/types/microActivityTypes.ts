import { ActivityBlock } from './courseTypes';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * סוגי מיקרו-פעילויות נתמכים
 */
export type MicroActivityType =
  // משחקים ופעילויות אינטראקטיביות
  | 'memory_game'      // משחק זיכרון
  | 'matching'         // התאמה
  | 'categorization'   // מיון לקטגוריות
  | 'ordering'         // סידור בסדר
  | 'sentence_builder' // בניית משפט
  | 'drag_and_drop'    // גרור והנח
  // שאלות קלאסיות
  | 'fill_in_blanks'   // השלמת חסר
  | 'multiple_choice'  // רב-ברירה
  | 'true_false'       // נכון/לא נכון
  | 'open_question'    // שאלה פתוחה
  | 'matrix'           // מטריצה
  // עבודה עם טקסט
  | 'highlight'        // סימון בטקסט
  | 'text_selection'   // בחירת טקסט
  | 'table_completion' // השלמת טבלה
  // ויזואליזציה
  | 'mindmap'          // מפת חשיבה
  | 'infographic';     // אינפוגרפיקה

/**
 * מטא-דאטה לסוג מיקרו-פעילות
 */
export interface MicroActivityTypeInfo {
  type: MicroActivityType;
  name: string;           // שם בעברית
  icon: string;           // אייקון
  description: string;    // תיאור קצר
  category: 'game' | 'question' | 'text' | 'visual';
  defaultItemCount: number; // כמות פריטים ברירת מחדל
}

/**
 * רשימת כל סוגי המיקרו-פעילויות עם המטא-דאטה שלהם
 */
export const MICRO_ACTIVITY_TYPES: MicroActivityTypeInfo[] = [
  // משחקים ופעילויות אינטראקטיביות
  {
    type: 'memory_game',
    name: 'זיכרון',
    icon: '🎴',
    description: 'משחק זיכרון עם זוגות',
    category: 'game',
    defaultItemCount: 6
  },
  {
    type: 'matching',
    name: 'התאמה',
    icon: '🔗',
    description: 'חבר בין פריטים תואמים',
    category: 'game',
    defaultItemCount: 6
  },
  {
    type: 'categorization',
    name: 'מיון',
    icon: '📊',
    description: 'מיין פריטים לקטגוריות',
    category: 'game',
    defaultItemCount: 8
  },
  {
    type: 'ordering',
    name: 'סידור',
    icon: '🔢',
    description: 'סדר בסדר הנכון',
    category: 'game',
    defaultItemCount: 5
  },
  {
    type: 'sentence_builder',
    name: 'בניית משפט',
    icon: '✏️',
    description: 'בנה משפט ממילים מעורבבות',
    category: 'game',
    defaultItemCount: 1
  },
  {
    type: 'drag_and_drop',
    name: 'גרור והנח',
    icon: '🎯',
    description: 'גרור פריטים למקום הנכון',
    category: 'game',
    defaultItemCount: 6
  },
  // שאלות קלאסיות
  {
    type: 'fill_in_blanks',
    name: 'השלמת חסר',
    icon: '📝',
    description: 'השלם את המילים החסרות',
    category: 'question',
    defaultItemCount: 4
  },
  {
    type: 'multiple_choice',
    name: 'רב-ברירה',
    icon: '❓',
    description: 'בחר תשובה אחת נכונה',
    category: 'question',
    defaultItemCount: 4
  },
  {
    type: 'true_false',
    name: 'נכון/לא נכון',
    icon: '✅',
    description: 'קבע אם הטענה נכונה',
    category: 'question',
    defaultItemCount: 5
  },
  {
    type: 'open_question',
    name: 'שאלה פתוחה',
    icon: '💭',
    description: 'ענה בחופשיות',
    category: 'question',
    defaultItemCount: 1
  },
  {
    type: 'matrix',
    name: 'מטריצה',
    icon: '🔲',
    description: 'טבלה עם שאלות ואפשרויות',
    category: 'question',
    defaultItemCount: 4
  },
  // עבודה עם טקסט
  {
    type: 'highlight',
    name: 'סימון',
    icon: '🖍️',
    description: 'סמן את החלקים הנכונים בטקסט',
    category: 'text',
    defaultItemCount: 3
  },
  {
    type: 'text_selection',
    name: 'בחירת טקסט',
    icon: '✂️',
    description: 'בחר מילים או משפטים מהטקסט',
    category: 'text',
    defaultItemCount: 3
  },
  {
    type: 'table_completion',
    name: 'השלמת טבלה',
    icon: '📋',
    description: 'השלם תאים חסרים בטבלה',
    category: 'text',
    defaultItemCount: 6
  },
  // ויזואליזציה
  {
    type: 'mindmap',
    name: 'מפת חשיבה',
    icon: '🗺️',
    description: 'מפה ויזואלית של מושגים',
    category: 'visual',
    defaultItemCount: 1
  },
  {
    type: 'infographic',
    name: 'אינפוגרפיקה',
    icon: '📊',
    description: 'סיכום ויזואלי של המידע',
    category: 'visual',
    defaultItemCount: 1
  }
];

/**
 * מקור התוכן למיקרו-פעילות
 */
export interface MicroActivitySource {
  type: 'text' | 'file' | 'topic';
  content: string;        // טקסט, נושא, או תיאור
  fileUrl?: string;       // URL של קובץ שהועלה
  fileName?: string;      // שם הקובץ המקורי
}

/**
 * מיקרו-פעילות
 */
export interface MicroActivity {
  id: string;
  teacherId: string;

  // מה זה
  type: MicroActivityType;
  title: string;

  // התוכן עצמו - ActivityBlock קיים
  block: ActivityBlock;

  // מטא-דאטה
  gradeLevel: string;
  subject?: string;
  source: MicroActivitySource;

  // ניהול
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  usageCount: number;

  // שיתוף
  shareCode?: string;
  isPublic: boolean;
}

/**
 * בקשת יצירת מיקרו-פעילות
 */
export interface GenerateMicroActivityRequest {
  type: MicroActivityType;
  source: MicroActivitySource;
  gradeLevel: string;
  teacherId: string;
  subject?: string;
}

/**
 * תוצאת יצירת מיקרו-פעילות
 */
export interface GenerateMicroActivityResponse {
  success: boolean;
  microActivity?: MicroActivity;
  error?: string;
}

/**
 * Helper: קבלת מידע על סוג מיקרו-פעילות
 */
export function getMicroActivityTypeInfo(type: MicroActivityType): MicroActivityTypeInfo | undefined {
  return MICRO_ACTIVITY_TYPES.find(t => t.type === type);
}

/**
 * Helper: קבלת סוגים לפי קטגוריה
 */
export function getMicroActivityTypesByCategory(category: MicroActivityTypeInfo['category']): MicroActivityTypeInfo[] {
  return MICRO_ACTIVITY_TYPES.filter(t => t.category === category);
}
