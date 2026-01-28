// Micro Activity Types for Frontend

// We use 'any' for ActivityBlock to avoid circular dependency
type ActivityBlockRef = any;

// Supported micro activity types
export type MicroActivityType =
  | 'memory_game'
  | 'matching'
  | 'categorization'
  | 'ordering'
  | 'sentence_builder'
  | 'drag_and_drop'
  | 'fill_in_blanks'
  | 'multiple_choice'
  | 'true_false'
  | 'open_question'
  | 'matrix'
  | 'highlight'
  | 'text_selection'
  | 'table_completion'
  | 'mindmap'
  | 'infographic';

// Metadata for micro activity type
export interface MicroActivityTypeInfo {
  type: MicroActivityType;
  name: string;
  icon: string;
  description: string;
  category: 'game' | 'question' | 'text' | 'visual';
  defaultItemCount: number;
}

// All micro activity types with their metadata
export const MICRO_ACTIVITY_TYPES: MicroActivityTypeInfo[] = [
  { type: 'memory_game', name: 'זיכרון', icon: '🎴', description: 'משחק זיכרון עם זוגות', category: 'game', defaultItemCount: 6 },
  { type: 'matching', name: 'התאמה', icon: '🔗', description: 'חבר בין פריטים תואמים', category: 'game', defaultItemCount: 6 },
  { type: 'categorization', name: 'מיון', icon: '📊', description: 'מיין פריטים לקטגוריות', category: 'game', defaultItemCount: 8 },
  { type: 'ordering', name: 'סידור', icon: '🔢', description: 'סדר בסדר הנכון', category: 'game', defaultItemCount: 5 },
  { type: 'sentence_builder', name: 'בניית משפט', icon: '✏️', description: 'בנה משפט ממילים מעורבבות', category: 'game', defaultItemCount: 1 },
  { type: 'drag_and_drop', name: 'גרור והנח', icon: '🎯', description: 'גרור פריטים למקום הנכון', category: 'game', defaultItemCount: 6 },
  { type: 'fill_in_blanks', name: 'השלמת חסר', icon: '📝', description: 'השלם את המילים החסרות', category: 'question', defaultItemCount: 4 },
  { type: 'multiple_choice', name: 'רב-ברירה', icon: '❓', description: 'בחר תשובה אחת נכונה', category: 'question', defaultItemCount: 4 },
  { type: 'true_false', name: 'נכון/לא נכון', icon: '✅', description: 'קבע אם הטענה נכונה', category: 'question', defaultItemCount: 5 },
  { type: 'open_question', name: 'שאלה פתוחה', icon: '💭', description: 'ענה בחופשיות', category: 'question', defaultItemCount: 1 },
  { type: 'matrix', name: 'מטריצה', icon: '🔲', description: 'טבלה עם שאלות ואפשרויות', category: 'question', defaultItemCount: 4 },
  { type: 'highlight', name: 'סימון', icon: '🖍️', description: 'סמן את החלקים הנכונים בטקסט', category: 'text', defaultItemCount: 3 },
  { type: 'text_selection', name: 'בחירת טקסט', icon: '✂️', description: 'בחר מילים או משפטים מהטקסט', category: 'text', defaultItemCount: 3 },
  { type: 'table_completion', name: 'השלמת טבלה', icon: '📋', description: 'השלם תאים חסרים בטבלה', category: 'text', defaultItemCount: 6 },
  { type: 'mindmap', name: 'מפת חשיבה', icon: '🗺️', description: 'מפה ויזואלית של מושגים', category: 'visual', defaultItemCount: 1 },
  { type: 'infographic', name: 'אינפוגרפיקה', icon: '📊', description: 'סיכום ויזואלי של המידע', category: 'visual', defaultItemCount: 1 }
];

// Source for micro activity content
export interface MicroActivitySource {
  type: 'text' | 'file' | 'topic';
  content: string;
  fileUrl?: string;
  fileName?: string;
}

// Micro Activity
export interface MicroActivity {
  id: string;
  teacherId: string;
  type: MicroActivityType;
  title: string;
  block: ActivityBlockRef;
  gradeLevel: string;
  subject?: string;
  source: MicroActivitySource;
  createdAt: Date | any;
  updatedAt: Date | any;
  usageCount: number;
  shareCode?: string;
  isPublic: boolean;
}

// Request to generate micro activity
export interface GenerateMicroActivityRequest {
  type: MicroActivityType;
  source: MicroActivitySource;
  gradeLevel: string;
  teacherId: string;
  subject?: string;
}

// Response from generating micro activity
export interface GenerateMicroActivityResponse {
  success: boolean;
  microActivity?: MicroActivity;
  error?: string;
}

// Get info for a micro activity type
export function getMicroActivityTypeInfo(type: MicroActivityType): MicroActivityTypeInfo | undefined {
  return MICRO_ACTIVITY_TYPES.find(t => t.type === type);
}

// Get types by category
export function getMicroActivityTypesByCategory(category: MicroActivityTypeInfo['category']): MicroActivityTypeInfo[] {
  return MICRO_ACTIVITY_TYPES.filter(t => t.category === category);
}
