// types/teachingAgent.ts - Teaching Agent Types

import { Timestamp } from 'firebase/firestore';

/**
 * Subject types matching the knowledge base
 */
export type AgentSubject = 'math' | 'hebrew' | 'english' | 'science' | 'history' | 'bible' | 'literature' | 'civics' | 'other';

/**
 * Grade levels (כיתה ה' ומעלה לפי הנחיות המשרד)
 */
export type AgentGrade = 'ה' | 'ו' | 'ז' | 'ח' | 'ט' | 'י' | 'יא' | 'יב';

/**
 * What the agent can do
 */
export type AgentCapability =
  | 'explain'              // מסביר מושגים
  | 'solve_step_by_step'   // פותר תרגילים צעד אחר צעד
  | 'quiz'                 // שואל שאלות תרגול
  | 'check_answer'         // בודק תשובות
  | 'give_hints'           // נותן רמזים
  | 'generate_similar'     // יוצר תרגילים דומים
  | 'summarize'            // מסכם חומר
  | 'practice_conversation'; // מתרגל שיחה (לאנגלית)

/**
 * Agent personality settings
 */
export interface AgentPersonality {
  tone: 'encouraging' | 'neutral' | 'challenging';
  verbosity: 'concise' | 'detailed';
  useEmoji: boolean;
  language: 'hebrew' | 'english' | 'bilingual';
}

/**
 * Knowledge sources the agent has access to
 */
export interface AgentKnowledgeSources {
  textbookIds?: string[];           // ספרים שהסוכן מכיר
  referenceExamIds?: string[];      // מבחנים שהסוכן מכיר
  customKnowledge?: string;         // ידע נוסף שהמורה הוסיף
  topicSummary?: string;            // תקציר הנושאים שהסוכן מכסה
}

/**
 * Teaching Agent - A specialized AI assistant for specific topics
 */
export interface TeachingAgent {
  id: string;

  // זהות הסוכן
  name: string;                     // "עוזר לשברים - כיתה ה'"
  description: string;              // "עוזר בפתרון תרגילי שברים צעד אחר צעד"
  avatar: string;                   // emoji או URL לתמונה

  // התמחות
  subject: AgentSubject;
  gradeRange: AgentGrade[];         // ['ה', 'ו'] - יכול לכסות כמה כיתות
  topics: string[];                 // ['שברים', 'מכנה משותף', 'חיבור שברים']

  // ידע מחובר
  knowledgeSources: AgentKnowledgeSources;

  // אישיות והתנהגות
  personality: AgentPersonality;

  // יכולות
  capabilities: AgentCapability[];

  // הוראות מערכת (system prompt)
  systemPrompt?: string;

  // שיתוף ומטא-דאטה
  createdBy: string;                // teacher ID
  creatorName: string;              // שם המורה
  isPublic: boolean;                // משותף לכולם
  isFeatured?: boolean;             // מומלץ על ידי המערכת

  // סטטיסטיקות
  usageCount: number;
  averageRating: number;
  ratingCount: number;

  // תאריכים
  createdAt: Timestamp;
  updatedAt?: Timestamp;

  // סטטוס
  status: 'active' | 'draft' | 'pending_review';
}

/**
 * Agent category for filtering
 */
export interface AgentCategory {
  id: string;
  name: string;                     // "מתמטיקה"
  icon: string;                     // "🧮"
  subjects: AgentSubject[];
}

/**
 * Mock data for initial development
 */
export const MOCK_AGENTS: Omit<TeachingAgent, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'agent-fractions-5',
    name: 'עוזר שברים',
    description: 'מסביר ופותר תרגילי שברים צעד אחר צעד. מתאים לתלמידי כיתות ה\'-ו\'.',
    avatar: '🥧',
    subject: 'math',
    gradeRange: ['ה', 'ו'],
    topics: ['שברים פשוטים', 'מכנה משותף', 'חיבור וחיסור שברים', 'כפל שברים'],
    knowledgeSources: {
      topicSummary: 'שברים לפי תכנית הלימודים לכיתות ה\'-ו\''
    },
    personality: {
      tone: 'encouraging',
      verbosity: 'detailed',
      useEmoji: true,
      language: 'hebrew'
    },
    capabilities: ['explain', 'solve_step_by_step', 'quiz', 'give_hints'],
    createdBy: 'system',
    creatorName: 'צוות Wizdi',
    isPublic: true,
    isFeatured: true,
    usageCount: 342,
    averageRating: 4.8,
    ratingCount: 56,
    status: 'active'
  },
  {
    id: 'agent-english-conversation',
    name: 'English Buddy',
    description: 'מתרגל שיחה באנגלית ברמה מותאמת. מתקן בעדינות ומעודד להמשיך.',
    avatar: '🗣️',
    subject: 'english',
    gradeRange: ['ה', 'ו', 'ז', 'ח'],
    topics: ['שיחה יומיומית', 'אוצר מילים', 'ביטויים נפוצים'],
    knowledgeSources: {
      topicSummary: 'אנגלית מדוברת לחטיבת ביניים'
    },
    personality: {
      tone: 'encouraging',
      verbosity: 'concise',
      useEmoji: true,
      language: 'bilingual'
    },
    capabilities: ['practice_conversation', 'explain', 'give_hints'],
    createdBy: 'system',
    creatorName: 'צוות Wizdi',
    isPublic: true,
    isFeatured: true,
    usageCount: 218,
    averageRating: 4.6,
    ratingCount: 41,
    status: 'active'
  },
  {
    id: 'agent-bible-analysis',
    name: 'חברותא לתנ"ך',
    description: 'עוזר בניתוח פרקים, מסביר מושגים ומקשר בין סיפורים.',
    avatar: '📜',
    subject: 'bible',
    gradeRange: ['ו', 'ז', 'ח', 'ט'],
    topics: ['ספר בראשית', 'ספר שמות', 'נביאים ראשונים', 'ניתוח פסוקים'],
    knowledgeSources: {
      topicSummary: 'תנ"ך לחטיבת ביניים'
    },
    personality: {
      tone: 'neutral',
      verbosity: 'detailed',
      useEmoji: false,
      language: 'hebrew'
    },
    capabilities: ['explain', 'summarize', 'quiz'],
    createdBy: 'system',
    creatorName: 'צוות Wizdi',
    isPublic: true,
    usageCount: 156,
    averageRating: 4.7,
    ratingCount: 28,
    status: 'active'
  },
  {
    id: 'agent-algebra-junior-high',
    name: 'מורה לאלגברה',
    description: 'פותר משוואות ומסביר את הלוגיקה מאחורי כל צעד.',
    avatar: '📐',
    subject: 'math',
    gradeRange: ['ז', 'ח', 'ט'],
    topics: ['משוואות ממעלה ראשונה', 'אי-שוויונות', 'ביטויים אלגבריים', 'פונקציות'],
    knowledgeSources: {
      topicSummary: 'אלגברה לחטיבת ביניים'
    },
    personality: {
      tone: 'neutral',
      verbosity: 'detailed',
      useEmoji: false,
      language: 'hebrew'
    },
    capabilities: ['explain', 'solve_step_by_step', 'quiz', 'check_answer', 'generate_similar'],
    createdBy: 'system',
    creatorName: 'צוות Wizdi',
    isPublic: true,
    isFeatured: true,
    usageCount: 287,
    averageRating: 4.9,
    ratingCount: 63,
    status: 'active'
  },
  {
    id: 'agent-essay-helper',
    name: 'עוזר כתיבת חיבורים',
    description: 'עוזר לבנות טיעונים, מארגן רעיונות ונותן משוב על טיוטות.',
    avatar: '✍️',
    subject: 'hebrew',
    gradeRange: ['ז', 'ח', 'ט'],
    topics: ['חיבור טיעוני', 'מבנה פסקה', 'פתיחה וסיכום', 'שכנוע'],
    knowledgeSources: {
      topicSummary: 'כתיבה לחטיבת ביניים'
    },
    personality: {
      tone: 'encouraging',
      verbosity: 'detailed',
      useEmoji: false,
      language: 'hebrew'
    },
    capabilities: ['explain', 'check_answer', 'give_hints'],
    createdBy: 'system',
    creatorName: 'צוות Wizdi',
    isPublic: true,
    usageCount: 124,
    averageRating: 4.5,
    ratingCount: 22,
    status: 'active'
  },
  {
    id: 'agent-science-lab',
    name: 'מעבדה וירטואלית',
    description: 'מסביר ניסויים, עוזר להבין תוצאות ומקשר לתיאוריה.',
    avatar: '🔬',
    subject: 'science',
    gradeRange: ['ז', 'ח', 'ט'],
    topics: ['כימיה בסיסית', 'פיזיקה', 'ביולוגיה', 'שיטה מדעית'],
    knowledgeSources: {
      topicSummary: 'מדעים לחטיבת ביניים'
    },
    personality: {
      tone: 'encouraging',
      verbosity: 'detailed',
      useEmoji: true,
      language: 'hebrew'
    },
    capabilities: ['explain', 'quiz', 'summarize'],
    createdBy: 'system',
    creatorName: 'צוות Wizdi',
    isPublic: true,
    usageCount: 98,
    averageRating: 4.4,
    ratingCount: 18,
    status: 'active'
  }
];

/**
 * Agent categories for filtering
 */
export const AGENT_CATEGORIES: AgentCategory[] = [
  { id: 'math', name: 'מתמטיקה', icon: '🧮', subjects: ['math'] },
  { id: 'languages', name: 'שפות', icon: '📝', subjects: ['hebrew', 'english'] },
  { id: 'sciences', name: 'מדעים', icon: '🔬', subjects: ['science'] },
  { id: 'humanities', name: 'מדעי הרוח', icon: '📚', subjects: ['bible', 'history', 'literature', 'civics'] },
];

/**
 * Capability labels in Hebrew
 */
export const CAPABILITY_LABELS: Record<AgentCapability, string> = {
  explain: 'מסביר מושגים',
  solve_step_by_step: 'פותר צעד אחר צעד',
  quiz: 'שואל שאלות',
  check_answer: 'בודק תשובות',
  give_hints: 'נותן רמזים',
  generate_similar: 'יוצר תרגילים',
  summarize: 'מסכם חומר',
  practice_conversation: 'מתרגל שיחה'
};

/**
 * Subject labels in Hebrew
 */
export const SUBJECT_LABELS: Record<AgentSubject, string> = {
  math: 'מתמטיקה',
  hebrew: 'עברית',
  english: 'אנגלית',
  science: 'מדעים',
  history: 'היסטוריה',
  bible: 'תנ"ך',
  literature: 'ספרות',
  civics: 'אזרחות',
  other: 'אחר'
};
