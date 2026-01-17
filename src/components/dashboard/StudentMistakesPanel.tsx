/**
 * StudentMistakesPanel - Show actual mistakes the student made
 *
 * This component fetches the student's submission and the course content,
 * then displays each question they got wrong with:
 * - The question text
 * - Their answer
 * - The correct answer
 * - A brief analysis of the mistake type (if available)
 */

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../../firebase';
import {
    IconAlertTriangle,
    IconCheck,
    IconX,
    IconBulb,
    IconChevronDown,
    IconChevronUp,
    IconSparkles,
    IconUsers,
    IconTrendingUp,
    IconTrendingDown
} from '@tabler/icons-react';

interface AnswerData {
    blockId: string;
    questionText: string;
    questionType: string;
    studentAnswer: any;
    correctAnswer: any;
    isCorrect: boolean;
    options?: string[]; // For multiple choice
    errorTag?: string; // From error fingerprint (only for mistakes)
}

// Keep old interface for backward compatibility
interface MistakeData {
    blockId: string;
    questionText: string;
    questionType: string;
    studentAnswer: any;
    correctAnswer: any;
    options?: string[]; // For multiple choice
    errorTag?: string; // From error fingerprint
    classFailRate?: number; // % of class that also got this wrong (0-100)
}

interface StudentMistakesPanelProps {
    studentId: string;
    courseId: string;
    studentName: string;
    classComparison?: ClassComparisonStats; // Optional comparison data
}

// Helper to extract question text from different block structures
const extractQuestionText = (block: any): string => {
    if (!block) return 'שאלה לא זמינה';

    // Direct question field
    if (block.question) return block.question;

    // Content.question
    if (block.content?.question) return block.content.question;

    // Content as string
    if (typeof block.content === 'string') return block.content;

    // Instructions
    if (block.instructions) return block.instructions;

    // Title fallback
    if (block.title) return block.title;

    return 'שאלה לא זמינה';
};

// Helper to get correct answer from block
const extractCorrectAnswer = (block: any): any => {
    if (!block) return null;

    // Multiple choice
    if (block.type === 'multiple-choice') {
        const options = block.options || block.content?.options || [];
        const correctIndex = block.correctIndex ?? block.content?.correctIndex ?? block.correct ?? 0;
        return options[correctIndex] || `תשובה ${correctIndex + 1}`;
    }

    // Fill in blanks / Cloze
    if (block.type === 'fill_in_blanks' || block.type === 'cloze') {
        return block.answers || block.content?.answers || block.correctAnswers || [];
    }

    // Open question - model answer
    if (block.type === 'open-question') {
        return block.metadata?.modelAnswer || block.modelAnswer || 'תשובה פתוחה';
    }

    // Ordering
    if (block.type === 'ordering') {
        return block.correctOrder || block.content?.correctOrder || block.items || [];
    }

    // True/False
    if (block.type === 'true-false') {
        return block.correctAnswer === true ? 'נכון' : 'לא נכון';
    }

    // Categorization
    if (block.type === 'categorization') {
        return block.categories || block.content?.categories || [];
    }

    return block.correctAnswer || block.answer || null;
};

// Helper to format answer for display
const formatAnswer = (answer: any, type: string): string => {
    if (answer === null || answer === undefined) return '-';

    if (Array.isArray(answer)) {
        return answer.join(', ');
    }

    if (typeof answer === 'object') {
        return JSON.stringify(answer);
    }

    return String(answer);
};

// Get Hebrew label for question type
const getQuestionTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
        'multiple-choice': 'רב ברירה',
        'open-question': 'שאלה פתוחה',
        'fill_in_blanks': 'השלמת חסר',
        'cloze': 'השלמת חסר',
        'ordering': 'סידור',
        'true-false': 'נכון/לא נכון',
        'categorization': 'מיון',
        'memory_game': 'משחק זיכרון',
        'matching': 'התאמה'
    };
    return labels[type] || type;
};

// Analyze mistake type based on the answers
const analyzeMistakeType = (
    block: any,
    studentAnswer: any,
    correctAnswer: any
): string | null => {
    // For multiple choice - check if it's a common confusion
    if (block.type === 'multiple-choice') {
        const options = block.options || block.content?.options || [];
        const studentIdx = options.indexOf(studentAnswer);
        const correctIdx = block.correctIndex ?? block.content?.correctIndex ?? 0;

        // Adjacent answer - might indicate uncertainty
        if (Math.abs(studentIdx - correctIdx) === 1) {
            return 'בחירה בתשובה קרובה - ייתכן חוסר ודאות';
        }
    }

    // For fill in blanks - check for spelling/calculation errors
    if (block.type === 'fill_in_blanks' || block.type === 'cloze') {
        if (typeof studentAnswer === 'string' && typeof correctAnswer === 'string') {
            // Very close spelling
            if (levenshteinDistance(studentAnswer, correctAnswer) <= 2) {
                return 'טעות כתיב קלה';
            }
        }
    }

    // For ordering - check if partial order is correct
    if (block.type === 'ordering' && Array.isArray(studentAnswer) && Array.isArray(correctAnswer)) {
        const partialMatches = studentAnswer.filter((item, idx) =>
            idx < correctAnswer.length && item === correctAnswer[idx]
        ).length;

        if (partialMatches > 0 && partialMatches < correctAnswer.length) {
            return `סדר חלקי נכון (${partialMatches}/${correctAnswer.length})`;
        }
    }

    return null;
};

// Simple Levenshtein distance for string comparison
const levenshteinDistance = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
};

// ============ DEMO DATA ============
// Holistic mock mistakes for demo students - provides realistic, educational examples

const DEMO_MISTAKES: Record<string, MistakeData[]> = {
    'demo-struggling': [
        {
            blockId: 'mock-q1',
            questionText: 'מהו סכום הזוויות במשולש?',
            questionType: 'multiple-choice',
            studentAnswer: '360 מעלות',
            correctAnswer: '180 מעלות',
            options: ['90 מעלות', '180 מעלות', '270 מעלות', '360 מעלות'],
            errorTag: 'בלבול עם מרובע',
            classFailRate: 15 // רק 15% טעו - בעיה אישית
        },
        {
            blockId: 'mock-q2',
            questionText: 'פתור את המשוואה: 2x + 5 = 13',
            questionType: 'fill_in_blanks',
            studentAnswer: 'x = 9',
            correctAnswer: 'x = 4',
            errorTag: 'שגיאת חישוב - לא חילק ב-2',
            classFailRate: 45 // 45% טעו - בעיה נפוצה
        },
        {
            blockId: 'mock-q3',
            questionText: 'סדר את השלבים לפתרון משוואה לפי הסדר הנכון',
            questionType: 'ordering',
            studentAnswer: 'איסוף איברים, העברת אגפים, חילוק',
            correctAnswer: 'העברת אגפים, איסוף איברים, חילוק',
            errorTag: 'סדר שגוי של פעולות',
            classFailRate: 60 // 60% טעו - שאלה קשה לכולם
        },
        {
            blockId: 'mock-q4',
            questionText: 'חשב: (-3) × (-4) = ?',
            questionType: 'fill_in_blanks',
            studentAnswer: '-12',
            correctAnswer: '12',
            errorTag: 'שגיאת סימן - כפל שליליים',
            classFailRate: 35 // 35% טעו
        },
        {
            blockId: 'mock-q5',
            questionText: 'האם המשפט הבא נכון: "כל ריבוע הוא מלבן"?',
            questionType: 'true-false',
            studentAnswer: 'לא נכון',
            correctAnswer: 'נכון',
            errorTag: 'אי הבנת מושג - הכלה',
            classFailRate: 70 // 70% טעו - שאלה מבלבלת לכולם!
        }
    ],
    'demo-average': [
        {
            blockId: 'mock-q1',
            questionText: 'מצא את שטח המשולש כאשר הבסיס הוא 8 ס"מ והגובה 6 ס"מ',
            questionType: 'fill_in_blanks',
            studentAnswer: '48 סמ"ר',
            correctAnswer: '24 סמ"ר',
            errorTag: 'שכח לחלק ב-2',
            classFailRate: 40 // 40% טעו
        },
        {
            blockId: 'mock-q2',
            questionText: 'מהו ערכו של x במשוואה: 3(x - 2) = 12?',
            questionType: 'multiple-choice',
            studentAnswer: 'x = 2',
            correctAnswer: 'x = 6',
            options: ['x = 2', 'x = 4', 'x = 6', 'x = 8'],
            errorTag: 'שגיאה בפתיחת סוגריים',
            classFailRate: 25 // 25% טעו
        },
        {
            blockId: 'mock-q3',
            questionText: 'המר 0.75 לשבר פשוט',
            questionType: 'fill_in_blanks',
            studentAnswer: '75/100',
            correctAnswer: '3/4',
            errorTag: 'לא צמצם את השבר',
            classFailRate: 30 // 30% טעו
        }
    ],
    'demo-advanced': [
        {
            blockId: 'mock-q1',
            questionText: 'נתונה הפונקציה f(x) = x² - 4x + 3. מצא את קודקוד הפרבולה.',
            questionType: 'fill_in_blanks',
            studentAnswer: '(2, 1)',
            correctAnswer: '(2, -1)',
            errorTag: 'שגיאת סימן בהצבה',
            classFailRate: 8 // רק 8% טעו - שגיאה נדירה
        }
    ]
};

const DEMO_SUMMARIES: Record<string, string> = {
    'demo-struggling': 'דני מתקשה בעיקר בחישובים עם מספרים שליליים ובהבנת סדר פעולות. מומלץ לתרגל יותר שאלות בסיסיות על כללי הסימנים ולחזק את ההבנה של מבנה משוואות.',
    'demo-average': 'מיכל מבינה את הרעיונות אך טועה בפרטים טכניים - במיוחד בנוסחאות גיאומטריות ובצמצום שברים. תרגול ממוקד על שלבי הפתרון יעזור.',
    'demo-advanced': 'יוסי מצוין! טעות אחת בלבד, נראית כשגיאת רשלנות בהצבת ערכים. ממליץ על תרגילי אתגר ברמה גבוהה יותר.'
};

// Demo class comparison data
const DEMO_CLASS_COMPARISON: Record<string, ClassComparisonStats> = {
    'demo-struggling': {
        studentAccuracy: 0.45,
        classAvgAccuracy: 0.72,
        studentMistakeCount: 5,
        classAvgMistakes: 2.3,
        percentile: 15
    },
    'demo-average': {
        studentAccuracy: 0.70,
        classAvgAccuracy: 0.72,
        studentMistakeCount: 3,
        classAvgMistakes: 2.3,
        percentile: 48
    },
    'demo-advanced': {
        studentAccuracy: 0.92,
        classAvgAccuracy: 0.72,
        studentMistakeCount: 1,
        classAvgMistakes: 2.3,
        percentile: 92
    }
};

export const StudentMistakesPanel: React.FC<StudentMistakesPanelProps> = ({
    studentId,
    courseId,
    studentName,
    classComparison
}) => {
    const [mistakes, setMistakes] = useState<MistakeData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedMistake, setExpandedMistake] = useState<string | null>(null);
    const [summary, setSummary] = useState<string | null>(null);

    useEffect(() => {
        const fetchMistakes = async () => {
            try {
                setLoading(true);
                setError(null);

                // Check if this is a demo student - provide holistic mock data
                if (studentId.startsWith('demo-')) {
                    const demoMistakes = DEMO_MISTAKES[studentId] || [];
                    const demoSummary = DEMO_SUMMARIES[studentId] || null;
                    setMistakes(demoMistakes);
                    setSummary(demoSummary);
                    setLoading(false);
                    return;
                }

                // 1. Fetch the course to get question blocks
                const courseDoc = await getDoc(doc(db, 'courses', courseId));
                if (!courseDoc.exists()) {
                    // Course not found - show empty state instead of error for demo
                    console.log('[StudentMistakesPanel] Course not found:', courseId);
                    setMistakes([]);
                    return;
                }

                const courseData = courseDoc.data();

                // Build a map of blockId -> block data
                const blockMap: Record<string, any> = {};

                // Extract blocks from course structure
                const syllabus = courseData.syllabus || [];
                syllabus.forEach((module: any) => {
                    const units = module.learningUnits || [];
                    units.forEach((unit: any) => {
                        const blocks = unit.activityBlocks || unit.blocks || [];
                        blocks.forEach((block: any) => {
                            if (block.id) {
                                blockMap[block.id] = block;
                            }
                        });
                    });
                });

                // 2. Fetch student's submission
                const submissionsQuery = query(
                    collection(db, 'submissions'),
                    where('courseId', '==', courseId),
                    orderBy('submittedAt', 'desc'),
                    firestoreLimit(10)
                );

                const submissionsSnap = await getDocs(submissionsQuery);

                // Find submission for this student (by name or ID in data)
                let studentSubmission: any = null;
                submissionsSnap.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    // Match by studentId in telemetry or by name
                    if (data.studentId === studentId ||
                        data.studentName === studentName ||
                        data.telemetry?.studentId === studentId) {
                        studentSubmission = { id: docSnap.id, ...data };
                    }
                });

                if (!studentSubmission || !studentSubmission.answers) {
                    // Try to get from stepResults in telemetry
                    if (studentSubmission?.telemetry?.stepResults) {
                        // We have step results but no detailed answers
                        const stepResults = studentSubmission.telemetry.stepResults;
                        const failedBlocks = Object.entries(stepResults)
                            .filter(([_, status]) => status === 'failure')
                            .map(([blockId]) => blockId);

                        const mistakesFromSteps: MistakeData[] = failedBlocks.map(blockId => {
                            const block = blockMap[blockId];
                            return {
                                blockId,
                                questionText: extractQuestionText(block),
                                questionType: block?.type || 'unknown',
                                studentAnswer: 'לא זמין',
                                correctAnswer: extractCorrectAnswer(block),
                                options: block?.options || block?.content?.options
                            };
                        }).filter(m => m.questionText !== 'שאלה לא זמינה');

                        setMistakes(mistakesFromSteps);

                        if (mistakesFromSteps.length > 0) {
                            setSummary(`התלמיד טעה ב-${mistakesFromSteps.length} שאלות. לחץ על שאלה לפרטים נוספים.`);
                        }
                        return;
                    }

                    // No real submissions - generate mock data for demo purposes
                    // Check if this looks like a mock student (starts with 'mock_' or has demo pattern)
                    const isMockStudent = studentId.startsWith('mock_') ||
                                          studentId.startsWith('demo_') ||
                                          studentName.includes('תלמיד') ||
                                          studentName.includes('דמה');

                    if (isMockStudent && Object.keys(blockMap).length > 0) {
                        // Generate mock mistakes from course blocks for demo
                        const questionBlocks = Object.values(blockMap).filter((b: any) =>
                            ['multiple-choice', 'fill_in_blanks', 'ordering', 'true-false'].includes(b.type)
                        );

                        // Pick random 2-3 blocks as "mistakes"
                        const mockMistakeCount = Math.min(Math.floor(Math.random() * 2) + 2, questionBlocks.length);
                        const shuffled = questionBlocks.sort(() => Math.random() - 0.5);
                        const selectedBlocks = shuffled.slice(0, mockMistakeCount);

                        const mockMistakes: MistakeData[] = selectedBlocks.map((block: any) => {
                            const correctAnswer = extractCorrectAnswer(block);
                            let mockStudentAnswer = 'תשובה שגויה';

                            // Generate plausible wrong answer
                            if (block.type === 'multiple-choice') {
                                const options = block.options || block.content?.options || [];
                                const correctIdx = block.correctIndex ?? block.content?.correctIndex ?? 0;
                                // Pick a different option
                                const wrongIdx = (correctIdx + 1) % options.length;
                                mockStudentAnswer = options[wrongIdx] || 'תשובה שגויה';
                            } else if (block.type === 'true-false') {
                                mockStudentAnswer = correctAnswer === 'נכון' ? 'לא נכון' : 'נכון';
                            }

                            return {
                                blockId: block.id,
                                questionText: extractQuestionText(block),
                                questionType: block.type,
                                studentAnswer: mockStudentAnswer,
                                correctAnswer,
                                options: block.options || block.content?.options,
                                errorTag: 'דוגמה להדגמה'
                            };
                        });

                        if (mockMistakes.length > 0) {
                            setMistakes(mockMistakes);
                            setSummary(`(נתוני הדגמה) התלמיד טעה ב-${mockMistakes.length} שאלות`);
                            return;
                        }
                    }

                    setMistakes([]);
                    return;
                }

                // 3. Compare answers and find mistakes
                const answers = studentSubmission.answers;
                const stepResults = studentSubmission.telemetry?.stepResults || {};

                const mistakesList: MistakeData[] = [];

                Object.entries(answers).forEach(([blockId, studentAnswer]) => {
                    const block = blockMap[blockId];
                    if (!block) return;

                    // Check if this was marked as failure
                    const wasFailure = stepResults[blockId] === 'failure';

                    // For question blocks, check if answer is wrong
                    const isQuestionBlock = ['multiple-choice', 'open-question', 'fill_in_blanks',
                        'cloze', 'ordering', 'true-false', 'categorization'].includes(block.type);

                    if (!isQuestionBlock) return;

                    const correctAnswer = extractCorrectAnswer(block);

                    // Determine if wrong (use stepResults if available, otherwise compare)
                    let isWrong = wasFailure;
                    if (!wasFailure && correctAnswer !== null) {
                        // Simple comparison for multiple choice
                        if (block.type === 'multiple-choice') {
                            const options = block.options || block.content?.options || [];
                            const correctIdx = block.correctIndex ?? block.content?.correctIndex ?? 0;
                            isWrong = studentAnswer !== options[correctIdx];
                        }
                    }

                    if (isWrong) {
                        const errorAnalysis = analyzeMistakeType(block, studentAnswer, correctAnswer);

                        mistakesList.push({
                            blockId,
                            questionText: extractQuestionText(block),
                            questionType: block.type,
                            studentAnswer,
                            correctAnswer,
                            options: block.options || block.content?.options,
                            errorTag: errorAnalysis || undefined
                        });
                    }
                });

                setMistakes(mistakesList);

                // Generate summary
                if (mistakesList.length > 0) {
                    const typeGroups = mistakesList.reduce((acc, m) => {
                        acc[m.questionType] = (acc[m.questionType] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);

                    const mainType = Object.entries(typeGroups).sort((a, b) => b[1] - a[1])[0];
                    if (mainType && mainType[1] > 1) {
                        setSummary(`התלמיד מתקשה בעיקר בשאלות מסוג ${getQuestionTypeLabel(mainType[0])} (${mainType[1]} טעויות)`);
                    } else {
                        setSummary(`התלמיד טעה ב-${mistakesList.length} שאלות במגוון סוגים`);
                    }
                }

            } catch (err) {
                console.error('Error fetching mistakes:', err);
                setError('שגיאה בטעינת נתונים');
            } finally {
                setLoading(false);
            }
        };

        if (studentId && courseId) {
            fetchMistakes();
        }
    }, [studentId, courseId, studentName]);

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 bg-slate-200 rounded-xl"></div>
                    <div>
                        <div className="h-4 bg-slate-200 rounded w-32 mb-2"></div>
                        <div className="h-3 bg-slate-100 rounded w-48"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 rounded-2xl p-4 border border-red-200">
                <div className="flex items-center gap-2 text-red-600">
                    <IconAlertTriangle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    if (mistakes.length === 0) {
        return (
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <IconBulb className="w-6 h-6 text-slate-400" />
                </div>
                <h4 className="font-bold text-slate-600 mb-1">אין נתוני טעויות</h4>
                <p className="text-slate-500 text-sm">התלמיד עדיין לא הגיש את המשימה, או שאין נתונים זמינים</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-red-50/50 to-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                            <IconX className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">טעויות עיקריות</h3>
                            <p className="text-sm text-slate-500">{mistakes.length} שאלות שגויות</p>
                        </div>
                    </div>
                </div>

                {/* Summary Insight */}
                {summary && (
                    <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2">
                        <IconBulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">{summary}</p>
                    </div>
                )}
            </div>

            {/* Mistakes List */}
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {mistakes.map((mistake, idx) => {
                    const isExpanded = expandedMistake === mistake.blockId;

                    return (
                        <div key={mistake.blockId} className="bg-white hover:bg-slate-50 transition-colors">
                            <button
                                onClick={() => setExpandedMistake(isExpanded ? null : mistake.blockId)}
                                className="w-full p-4 text-right flex items-start gap-3"
                            >
                                {/* Number Badge */}
                                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                                    <span className="text-sm font-bold text-red-600">{idx + 1}</span>
                                </div>

                                <div className="flex-1 min-w-0">
                                    {/* Question Type + Class Comparison */}
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="text-xs font-bold text-slate-400 uppercase">
                                            {getQuestionTypeLabel(mistake.questionType)}
                                        </span>
                                        {mistake.errorTag && (
                                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                                {mistake.errorTag}
                                            </span>
                                        )}
                                        {/* Class Fail Rate Badge - KEY INSIGHT */}
                                        {mistake.classFailRate !== undefined && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                                mistake.classFailRate >= 50
                                                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                    : mistake.classFailRate >= 30
                                                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                            }`}>
                                                <IconUsers className="w-3 h-3" />
                                                {mistake.classFailRate}% מהכיתה טעו
                                            </span>
                                        )}
                                    </div>

                                    {/* Question Text */}
                                    <p className="text-sm text-slate-700 line-clamp-2">
                                        {mistake.questionText}
                                    </p>

                                    {/* Class insight text - only for high fail rates */}
                                    {mistake.classFailRate !== undefined && mistake.classFailRate >= 50 && (
                                        <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                                            <IconAlertTriangle className="w-3 h-3" />
                                            שאלה מאתגרת לכל הכיתה - לא רק לתלמיד זה
                                        </p>
                                    )}
                                </div>

                                {/* Expand Icon */}
                                <div className="shrink-0 p-1">
                                    {isExpanded ? (
                                        <IconChevronUp className="w-5 h-5 text-slate-400" />
                                    ) : (
                                        <IconChevronDown className="w-5 h-5 text-slate-400" />
                                    )}
                                </div>
                            </button>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="px-4 pb-4 pr-14 animate-in fade-in duration-200">
                                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                                        {/* Student's Answer */}
                                        <div>
                                            <span className="text-xs font-bold text-red-500 block mb-1">תשובת התלמיד:</span>
                                            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                                                {formatAnswer(mistake.studentAnswer, mistake.questionType)}
                                            </div>
                                        </div>

                                        {/* Correct Answer */}
                                        <div>
                                            <span className="text-xs font-bold text-green-600 block mb-1">תשובה נכונה:</span>
                                            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
                                                {formatAnswer(mistake.correctAnswer, mistake.questionType)}
                                            </div>
                                        </div>

                                        {/* Options for multiple choice */}
                                        {mistake.options && mistake.options.length > 0 && (
                                            <div>
                                                <span className="text-xs font-bold text-slate-500 block mb-1">כל האפשרויות:</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {mistake.options.map((opt, i) => (
                                                        <span
                                                            key={i}
                                                            className={`text-xs px-2 py-1 rounded-lg border ${
                                                                opt === mistake.correctAnswer
                                                                    ? 'bg-green-50 border-green-200 text-green-700'
                                                                    : opt === mistake.studentAnswer
                                                                    ? 'bg-red-50 border-red-200 text-red-600'
                                                                    : 'bg-slate-50 border-slate-200 text-slate-500'
                                                            }`}
                                                        >
                                                            {opt}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default StudentMistakesPanel;
