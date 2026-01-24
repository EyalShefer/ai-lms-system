/**
 * Bagrut Practice Types
 * סוגי נתונים למערכת תרגול בגרויות
 *
 * Architecture:
 * - BagrutQuestion: Stored in activity_bank (reusable questions)
 * - BagrutPracticeModule: The student-facing practice experience
 * - BagrutChapter: Groups questions by topic within a subject
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

/**
 * Bagrut subjects - מקצועות בגרות נתמכים (טקסט בלבד בשלב ראשון)
 */
export type BagrutSubject =
    | 'civics'      // אזרחות
    | 'literature'  // ספרות
    | 'bible'       // תנ"ך
    | 'hebrew'      // עברית
    | 'english'     // אנגלית
    | 'history';    // היסטוריה

/**
 * תרגום מקצועות לעברית
 */
export const BAGRUT_SUBJECT_LABELS: Record<BagrutSubject, string> = {
    civics: 'אזרחות',
    literature: 'ספרות',
    bible: 'תנ"ך',
    hebrew: 'עברית',
    english: 'אנגלית',
    history: 'היסטוריה'
};

/**
 * סוגי שאלות בבגרות
 */
export type BagrutQuestionType =
    | 'open'                // שאלה פתוחה
    | 'multiple-choice'     // רב-ברירה (אמריקאית)
    | 'source-analysis'     // ניתוח קטע מקור
    | 'essay'               // חיבור
    | 'fill-in-blanks'      // השלמת חסר
    | 'matching';           // התאמה

/**
 * רמות קושי
 */
export type BagrutDifficulty = 1 | 2 | 3; // 1=קל, 2=בינוני, 3=קשה

/**
 * יחידות לימוד (לבגרות)
 */
export type BagrutUnits = 1 | 2 | 3 | 4 | 5;

/**
 * מועדי בחינה
 */
export type BagrutSeason = 'summer' | 'winter' | 'spring';

// ============================================
// RUBRIC (מחוון)
// ============================================

/**
 * פריט במחוון - קריטריון בודד להערכה
 */
export interface RubricItem {
    id: string;
    criterion: string;      // הקריטריון (מה נבדק)
    maxPoints: number;      // ניקוד מקסימלי
    levels: RubricLevel[];  // רמות הביצוע
}

/**
 * רמת ביצוע במחוון
 */
export interface RubricLevel {
    points: number;         // ניקוד לרמה זו
    description: string;    // תיאור הרמה
}

// ============================================
// BAGRUT QUESTION (Activity Bank)
// ============================================

/**
 * שאלת בגרות - נשמרת ב-activity_bank
 * ניתנת לשימוש חוזר במודולים שונים
 */
export interface BagrutQuestion {
    id: string;

    // --- מטא-דאטה ---
    subject: BagrutSubject;
    chapter: string;                    // "זכויות האדם", "תקופת בית שני"
    topic: string;                      // נושא ספציפי יותר
    questionType: BagrutQuestionType;
    points: number;                     // 10, 15, 20, 25...
    difficulty: BagrutDifficulty;
    units?: BagrutUnits;                // יחידות לימוד (3/4/5)

    // --- תוכן השאלה ---
    sourceText?: string;                // קטע מקור (אם יש)
    sourceReference?: string;           // "מגילת העצמאות", "חוק יסוד..."
    question: string;                   // השאלה עצמה
    subQuestions?: BagrutSubQuestion[]; // תת-שאלות (א, ב, ג...)

    // --- לשאלות אמריקאיות ---
    options?: string[];
    correctOptionIndex?: number;

    // --- תשובות ומחוון ---
    modelAnswer: string;                // תשובה לדוגמה
    rubric: RubricItem[];               // מחוון להערכה
    keywords?: string[];                // מילות מפתח לתשובה טובה
    commonMistakes?: string[];          // טעויות נפוצות

    // --- הנחיות לתלמיד ---
    hints?: string[];                   // רמזים מדורגים
    timeEstimate?: number;              // זמן משוער בדקות

    // --- מקור ומעקב ---
    yearReference?: string;             // "קיץ 2024", "חורף 2023"
    questionNumber?: string;            // "שאלה 3", "3281-1"
    season?: BagrutSeason;
    year?: number;

    // --- סטטיסטיקות ---
    usageCount: number;
    avgScore?: number;                  // ציון ממוצע (0-100)
    avgTimeSeconds?: number;            // זמן ממוצע לפתרון

    // --- ניהול ---
    createdAt: any;                     // Firestore Timestamp
    updatedAt: any;
    createdBy: string;                  // teacherId או 'system'
    reviewStatus: 'draft' | 'reviewed' | 'approved';
    tags?: string[];
}

/**
 * תת-שאלה (א, ב, ג...)
 */
export interface BagrutSubQuestion {
    id: string;
    label: string;                      // "א", "ב", "ג"
    question: string;
    points: number;
    modelAnswer?: string;
    keywords?: string[];
}

// ============================================
// BAGRUT PRACTICE MODULE (Student Experience)
// ============================================

/**
 * מודול תרגול בגרות - החוויה של התלמיד
 */
export interface BagrutPracticeModule {
    id: string;

    // --- מידע בסיסי ---
    subject: BagrutSubject;
    title: string;                      // "תרגול בגרות אזרחות"
    description?: string;
    targetUnits?: BagrutUnits;          // 2/3/4/5 יחידות

    // --- מבנה ---
    chapters: BagrutChapter[];

    // --- הגדרות תרגול ---
    settings: BagrutPracticeSettings;

    // --- ניהול ---
    teacherId?: string;                 // null = מודול מערכת
    isPublic: boolean;                  // זמין לכל המורים
    createdAt: any;
    updatedAt: any;
}

/**
 * פרק במודול בגרות
 */
export interface BagrutChapter {
    id: string;
    title: string;                      // "פרק א - יסודות הדמוקרטיה"
    description?: string;
    order: number;                      // סדר הצגה

    // --- שאלות ---
    questionIds: string[];              // מפנה ל-activity_bank

    // --- הגדרות ---
    practiceMode: BagrutPracticeMode;
    requiredScore?: number;             // ציון מינימלי למעבר (0-100)

    // --- סטטיסטיקות ---
    totalQuestions: number;
    avgDifficulty?: number;
}

/**
 * מצבי תרגול
 */
export type BagrutPracticeMode =
    | 'sequential'      // לפי סדר
    | 'random'          // אקראי
    | 'adaptive'        // מותאם לרמת התלמיד
    | 'exam-simulation'; // סימולציית בחינה

/**
 * הגדרות תרגול
 */
export interface BagrutPracticeSettings {
    showHints: boolean;                 // להציג רמזים
    showModelAnswer: boolean;           // להציג תשובה לדוגמה אחרי מענה
    showRubric: boolean;                // להציג מחוון
    allowRetry: boolean;                // לאפשר ניסיון נוסף
    maxRetries?: number;                // מקסימום ניסיונות
    timeLimit?: number;                 // הגבלת זמן (דקות)
    shuffleQuestions: boolean;          // לערבב שאלות
    shuffleOptions: boolean;            // לערבב תשובות (ברב-ברירה)
}

// ============================================
// STUDENT PROGRESS (מעקב התקדמות)
// ============================================

/**
 * התקדמות תלמיד במודול בגרות
 */
export interface BagrutStudentProgress {
    id: string;
    studentId: string;
    moduleId: string;
    subject: BagrutSubject;

    // --- התקדמות כללית ---
    startedAt: any;
    lastActivityAt: any;
    completedAt?: any;

    // --- סטטיסטיקות ---
    totalQuestionsAttempted: number;
    totalQuestionsCorrect: number;
    averageScore: number;               // 0-100
    totalTimeSeconds: number;

    // --- לפי פרק ---
    chapterProgress: Record<string, BagrutChapterProgress>;

    // --- נקודות חולשה/חוזקה ---
    weakTopics: string[];
    strongTopics: string[];
    recommendedNextChapter?: string;
}

/**
 * התקדמות בפרק ספציפי
 */
export interface BagrutChapterProgress {
    chapterId: string;
    status: 'not_started' | 'in_progress' | 'completed';
    questionsAttempted: number;
    questionsCorrect: number;
    bestScore: number;
    lastAttemptAt?: any;
    attempts: number;
}

/**
 * תשובת תלמיד לשאלת בגרות
 */
export interface BagrutQuestionResponse {
    id: string;
    studentId: string;
    questionId: string;
    moduleId: string;
    chapterId: string;

    // --- התשובה ---
    answer: string;                     // תשובת התלמיד
    selectedOptionIndex?: number;       // לשאלות אמריקאיות

    // --- הערכה ---
    score: number;                      // ניקוד שהתקבל
    maxScore: number;                   // ניקוד מקסימלי
    isCorrect: boolean;                 // לשאלות אמריקאיות

    // --- AI Feedback ---
    aiFeedback?: string;                // משוב AI
    aiRubricScores?: Record<string, number>; // ציון לכל קריטריון
    matchedKeywords?: string[];         // מילות מפתח שנמצאו

    // --- מטא ---
    timeSpentSeconds: number;
    hintsUsed: number;
    attemptNumber: number;
    submittedAt: any;
}

// ============================================
// EXAM SIMULATION (סימולציית בחינה)
// ============================================

/**
 * סימולציית בחינת בגרות מלאה
 */
export interface BagrutExamSimulation {
    id: string;
    studentId: string;
    moduleId: string;
    subject: BagrutSubject;

    // --- הגדרות הבחינה ---
    questionnaire: string;              // "שאלון 34281"
    totalPoints: number;                // סה"כ נקודות
    timeLimit: number;                  // זמן בדקות

    // --- שאלות ---
    questionIds: string[];
    requiredQuestions: number;          // כמה חובה לענות

    // --- מצב ---
    status: 'not_started' | 'in_progress' | 'submitted' | 'graded';
    startedAt?: any;
    submittedAt?: any;
    gradedAt?: any;

    // --- תוצאות ---
    responses: Record<string, BagrutQuestionResponse>;
    totalScore?: number;
    percentage?: number;
    passed?: boolean;

    // --- משוב ---
    overallFeedback?: string;
    strengthAreas?: string[];
    improvementAreas?: string[];
}

// ============================================
// BAGRUT ASSIGNMENTS (משימות תרגול)
// ============================================

/**
 * משימת תרגול בגרות שנשלחת על ידי מורה
 */
export interface BagrutAssignment {
    id: string;
    teacherId: string;
    teacherName?: string;

    // --- תוכן המשימה ---
    title: string;                        // "תרגול פרק זכויות האזרח"
    description?: string;                 // הוראות נוספות
    subject: BagrutSubject;
    moduleId: string;
    chapterIds: string[];                 // פרקים לתרגול
    questionCount?: number;               // כמה שאלות לענות (אופציונלי)

    // --- תאריכים ---
    createdAt: any;
    dueDate?: any;                        // תאריך הגשה

    // --- מי מקבל ---
    assigneeType: 'all' | 'class' | 'students';
    classId?: string;                     // אם assigneeType === 'class'
    studentIds?: string[];                // אם assigneeType === 'students'

    // --- הגדרות ---
    isActive: boolean;
    minPassingScore?: number;             // ציון מינימלי לעבור (ברירת מחדל: 56)
    allowRetry: boolean;                  // האם מותר לנסות שוב
    showAnswersAfter: 'immediate' | 'due_date' | 'never';
}

/**
 * התקדמות תלמיד במשימת בגרות
 */
export interface BagrutAssignmentProgress {
    id: string;                           // `${assignmentId}_${studentId}`
    assignmentId: string;
    studentId: string;
    studentName?: string;

    // --- מצב ---
    status: 'not_started' | 'in_progress' | 'completed';
    startedAt?: any;
    completedAt?: any;

    // --- תוצאות ---
    questionsAnswered: number;
    questionsCorrect: number;
    questionsPartial: number;
    score: number;                        // 0-100
    passed: boolean;

    // --- פירוט לפי פרק ---
    chapterScores: Record<string, {
        questionsAnswered: number;
        questionsCorrect: number;
        score: number;
    }>;

    // --- נסיונות ---
    attempts: number;
    bestScore: number;
}

// ============================================
// CURRICULUM MAPPING (מיפוי לתכנית הלימודים)
// ============================================

/**
 * מיפוי פרק בגרות לתכנית הלימודים
 */
export interface BagrutCurriculumMapping {
    subject: BagrutSubject;
    chapter: string;
    officialChapterNumber?: string;     // "פרק א", "יחידה 2"
    curriculumStandardIds: string[];    // קישור ל-curriculum_standards
    learningObjectives: string[];
    requiredPriorKnowledge?: string[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * יוצר שאלת בגרות ריקה
 */
export function createEmptyBagrutQuestion(subject: BagrutSubject): Partial<BagrutQuestion> {
    return {
        subject,
        chapter: '',
        topic: '',
        questionType: 'open',
        points: 15,
        difficulty: 2,
        question: '',
        modelAnswer: '',
        rubric: [],
        usageCount: 0,
        reviewStatus: 'draft',
        createdBy: 'system'
    };
}

/**
 * יוצר הגדרות תרגול ברירת מחדל
 */
export function getDefaultPracticeSettings(): BagrutPracticeSettings {
    return {
        showHints: true,
        showModelAnswer: true,
        showRubric: false,
        allowRetry: true,
        maxRetries: 3,
        shuffleQuestions: false,
        shuffleOptions: true
    };
}

/**
 * מחשב ציון עובר לפי מקצוע
 */
export function getPassingScore(subject: BagrutSubject): number {
    // כל המקצועות: 56 ציון עובר
    return 56;
}
