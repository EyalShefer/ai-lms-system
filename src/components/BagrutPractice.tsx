/**
 * BagrutPractice Component
 * קומפוננטה ראשית לתרגול בגרויות
 */

import React, { useState, useEffect } from 'react';
import {
    IconBook,
    IconSchool,
    IconTarget,
    IconChevronRight,
    IconChevronLeft,
    IconCheck,
    IconX,
    IconBulb,
    IconClock,
    IconTrophy,
    IconRefresh,
    IconPlayerPlay
} from '@tabler/icons-react';
import type {
    BagrutSubject,
    BagrutQuestion,
    BagrutPracticeModule,
    BagrutChapter,
    BagrutStudentProgress,
    BagrutAssignment
} from '../shared/types/bagrutTypes';
import { BAGRUT_SUBJECT_LABELS } from '../shared/types/bagrutTypes';
import * as bagrutService from '../services/bagrutService';

// ============================================
// TYPES
// ============================================

interface BagrutPracticeProps {
    studentId: string;
    initialSubject?: BagrutSubject;
    assignmentId?: string;
    onExit?: () => void;
}

type PracticeView = 'subject-select' | 'chapter-select' | 'practice' | 'results';

// ============================================
// SUBJECT ICONS
// ============================================

const SUBJECT_ICONS: Record<BagrutSubject, React.ReactNode> = {
    civics: <IconSchool size={32} />,
    literature: <IconBook size={32} />,
    bible: <IconBook size={32} />,
    hebrew: <IconBook size={32} />,
    english: <IconBook size={32} />,
    history: <IconBook size={32} />
};

// Using wizdi color palette for subjects - card-glass style with colored accents
const SUBJECT_COLORS: Record<BagrutSubject, { iconBg: string; borderColor: string; textColor: string; hoverBorder: string }> = {
    civics: {
        iconBg: 'bg-[#2B59C3]',
        borderColor: 'border-[#2B59C3]',
        textColor: 'text-[#2B59C3]',
        hoverBorder: 'hover:border-[#1e40af]'
    },
    literature: {
        iconBg: 'bg-[#8B5CF6]',
        borderColor: 'border-[#8B5CF6]',
        textColor: 'text-[#8B5CF6]',
        hoverBorder: 'hover:border-[#7C3AED]'
    },
    bible: {
        iconBg: 'bg-amber-500',
        borderColor: 'border-amber-500',
        textColor: 'text-amber-600',
        hoverBorder: 'hover:border-amber-600'
    },
    hebrew: {
        iconBg: 'bg-emerald-500',
        borderColor: 'border-emerald-500',
        textColor: 'text-emerald-600',
        hoverBorder: 'hover:border-emerald-600'
    },
    english: {
        iconBg: 'bg-rose-500',
        borderColor: 'border-rose-500',
        textColor: 'text-rose-600',
        hoverBorder: 'hover:border-rose-600'
    },
    history: {
        iconBg: 'bg-[#00C2FF]',
        borderColor: 'border-[#00C2FF]',
        textColor: 'text-[#0891b2]',
        hoverBorder: 'hover:border-[#0891b2]'
    }
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function BagrutPractice({ studentId, initialSubject, assignmentId, onExit }: BagrutPracticeProps) {
    // State
    const [view, setView] = useState<PracticeView>(initialSubject ? 'chapter-select' : 'subject-select');
    const [selectedSubject, setSelectedSubject] = useState<BagrutSubject | null>(initialSubject || null);
    const [selectedModule, setSelectedModule] = useState<BagrutPracticeModule | null>(null);
    const [selectedChapter, setSelectedChapter] = useState<BagrutChapter | null>(null);
    const [questions, setQuestions] = useState<BagrutQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [showAnswer, setShowAnswer] = useState(false);
    const [hintsShown, setHintsShown] = useState(0);
    const [progress, setProgress] = useState<BagrutStudentProgress | null>(null);
    const [loading, setLoading] = useState(false);
    const [modules, setModules] = useState<BagrutPracticeModule[]>([]);
    const [startTime, setStartTime] = useState<number>(0);
    const [results, setResults] = useState<{
        correct: number;
        partial: number;
        total: number;
        timeSeconds: number;
    } | null>(null);
    // Self-assessment for open-ended questions (fallback when AI unavailable)
    const [selfAssessments, setSelfAssessments] = useState<Record<string, 'correct' | 'partial' | 'incorrect'>>({});
    // AI evaluations for open questions
    const [aiEvaluations, setAiEvaluations] = useState<Record<string, {
        status: 'correct' | 'partial' | 'incorrect';
        score: number;
        feedback: string;
    }>>({});
    // Loading state for AI evaluation
    const [evaluatingAnswer, setEvaluatingAnswer] = useState(false);
    // Assignment mode state
    const [currentAssignment, setCurrentAssignment] = useState<BagrutAssignment | null>(null);
    const [isAssignmentMode, setIsAssignmentMode] = useState(!!assignmentId);

    // Load assignment when assignmentId is provided
    useEffect(() => {
        if (assignmentId) {
            loadAssignment(assignmentId);
        }
    }, [assignmentId]);

    // Load modules when subject changes
    useEffect(() => {
        if (selectedSubject && !isAssignmentMode) {
            loadModules(selectedSubject);
        }
    }, [selectedSubject, isAssignmentMode]);

    // Load progress when module changes
    useEffect(() => {
        if (selectedModule && studentId) {
            loadProgress();
        }
    }, [selectedModule, studentId]);

    // ============================================
    // DATA LOADING
    // ============================================

    async function loadAssignment(assignId: string) {
        setLoading(true);
        try {
            const assignment = await bagrutService.getBagrutAssignmentById(assignId);
            if (!assignment) {
                alert('המשימה לא נמצאה');
                onExit?.();
                return;
            }

            setCurrentAssignment(assignment);
            setSelectedSubject(assignment.subject);
            setIsAssignmentMode(true);

            // Load the module
            const mods = await bagrutService.getBagrutModules({ subject: assignment.subject });
            const assignmentModule = mods.find(m => m.id === assignment.moduleId);

            if (!assignmentModule) {
                alert('המודול לא נמצא');
                onExit?.();
                return;
            }

            setSelectedModule(assignmentModule);

            // Collect all question IDs from the assigned chapters
            const questionIds: string[] = [];
            assignment.chapterIds.forEach(chapterId => {
                const chapter = assignmentModule.chapters.find(c => c.id === chapterId);
                if (chapter) {
                    questionIds.push(...chapter.questionIds);
                }
            });

            if (questionIds.length === 0) {
                alert('אין שאלות במשימה זו');
                onExit?.();
                return;
            }

            // Load all questions
            const qs = await bagrutService.getBagrutQuestionsByIds(questionIds);
            setQuestions(qs);
            setCurrentQuestionIndex(0);
            setAnswers({});
            setSelfAssessments({});
            setAiEvaluations({});
            setShowAnswer(false);
            setHintsShown(0);
            setStartTime(Date.now());
            setView('practice');

        } catch (error) {
            console.error('Error loading assignment:', error);
            alert('שגיאה בטעינת המשימה');
            onExit?.();
        } finally {
            setLoading(false);
        }
    }

    async function loadModules(subject: BagrutSubject) {
        setLoading(true);
        try {
            const mods = await bagrutService.getBagrutModules({ subject, isPublic: true });
            setModules(mods);

            // Auto-select if only one module
            if (mods.length === 1) {
                setSelectedModule(mods[0]);
            }
        } catch (error) {
            console.error('Error loading modules:', error);
        } finally {
            setLoading(false);
        }
    }

    async function loadProgress() {
        if (!selectedModule) return;
        try {
            const prog = await bagrutService.getOrCreateStudentProgress(studentId, selectedModule.id);
            setProgress(prog);
        } catch (error) {
            console.error('Error loading progress:', error);
        }
    }

    async function loadChapterQuestions(chapter: BagrutChapter) {
        setLoading(true);
        try {
            const qs = await bagrutService.getBagrutQuestionsByIds(chapter.questionIds);
            setQuestions(qs);
            setCurrentQuestionIndex(0);
            setAnswers({});
            setSelfAssessments({});
            setAiEvaluations({});
            setShowAnswer(false);
            setHintsShown(0);
            setStartTime(Date.now());
            setView('practice');
        } catch (error) {
            console.error('Error loading questions:', error);
        } finally {
            setLoading(false);
        }
    }

    // ============================================
    // HANDLERS
    // ============================================

    function handleSubjectSelect(subject: BagrutSubject) {
        setSelectedSubject(subject);
        setView('chapter-select');
    }

    function handleChapterSelect(chapter: BagrutChapter) {
        setSelectedChapter(chapter);
        loadChapterQuestions(chapter);
    }

    function handleAnswerChange(answer: string) {
        if (!questions[currentQuestionIndex]) return;
        setAnswers(prev => ({
            ...prev,
            [questions[currentQuestionIndex].id]: answer
        }));
    }

    function handleShowHint() {
        const currentQ = questions[currentQuestionIndex];
        if (currentQ?.hints && hintsShown < currentQ.hints.length) {
            setHintsShown(prev => prev + 1);
        }
    }

    async function handleCheckAnswer() {
        const currentQ = questions[currentQuestionIndex];
        const currentAnswer = answers[currentQ.id] || '';

        // For open questions, use AI evaluation
        if (currentQ.questionType !== 'multiple-choice' && currentAnswer.trim()) {
            setEvaluatingAnswer(true);
            try {
                const evaluation = await bagrutService.evaluateBagrutAnswer(
                    currentQ.question,
                    currentAnswer,
                    currentQ.modelAnswer || '',
                    currentQ.sourceText || '',
                    currentQ.rubric,
                    currentQ.points
                );

                setAiEvaluations(prev => ({
                    ...prev,
                    [currentQ.id]: {
                        status: evaluation.status,
                        score: evaluation.score,
                        feedback: evaluation.feedback
                    }
                }));
            } catch (error) {
                console.error('AI evaluation failed:', error);
                // AI failed - will fall back to self-assessment
            } finally {
                setEvaluatingAnswer(false);
            }
        }

        setShowAnswer(true);
    }

    function handleSelfAssessment(assessment: 'correct' | 'partial' | 'incorrect') {
        const currentQ = questions[currentQuestionIndex];
        // Self-assessment is used as fallback when AI evaluation is not available
        setSelfAssessments(prev => ({
            ...prev,
            [currentQ.id]: assessment
        }));
    }

    function handleNextQuestion() {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setShowAnswer(false);
            setHintsShown(0);
        } else {
            // Calculate results
            const timeSeconds = Math.round((Date.now() - startTime) / 1000);
            let correct = 0;
            let partial = 0;

            questions.forEach(q => {
                const answer = answers[q.id];
                if (q.questionType === 'multiple-choice' && q.correctOptionIndex !== undefined) {
                    // Auto-grade multiple choice
                    if (answer === q.options?.[q.correctOptionIndex]) {
                        correct++;
                    }
                } else {
                    // Use AI evaluation if available, otherwise self-assessment
                    const aiEval = aiEvaluations[q.id];
                    if (aiEval) {
                        if (aiEval.status === 'correct') correct++;
                        else if (aiEval.status === 'partial') partial++;
                    } else {
                        const selfAssessment = selfAssessments[q.id];
                        if (selfAssessment === 'correct') correct++;
                        else if (selfAssessment === 'partial') partial++;
                    }
                }
            });

            setResults({
                correct,
                partial,
                total: questions.length,
                timeSeconds
            });
            setView('results');
        }
    }

    function handleRestart() {
        setCurrentQuestionIndex(0);
        setAnswers({});
        setSelfAssessments({});
        setAiEvaluations({});
        setShowAnswer(false);
        setHintsShown(0);
        setStartTime(Date.now());
        setResults(null);
        setView('practice');
    }

    function handleBackToChapters() {
        setView('chapter-select');
        setQuestions([]);
        setResults(null);
    }

    // ============================================
    // RENDER FUNCTIONS
    // ============================================

    function renderSubjectSelect() {
        const subjects: BagrutSubject[] = ['civics', 'literature', 'bible', 'hebrew', 'english', 'history'];

        return (
            <div className="p-6 md:p-8">
                {/* Header with gradient */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#2B59C3] text-white mb-4">
                        <IconSchool size={32} />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold text-[#2B59C3] mb-2">
                        תרגול לבגרות
                    </h1>
                    <p className="text-slate-600">
                        בחר מקצוע להתחיל לתרגל
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {subjects.map(subject => {
                        const colors = SUBJECT_COLORS[subject];
                        return (
                            <button
                                key={subject}
                                onClick={() => handleSubjectSelect(subject)}
                                className={`
                                    card-glass p-6 transition-all
                                    hover:scale-[1.03] hover:shadow-xl
                                    border-2 ${colors.borderColor} ${colors.hoverBorder}
                                    focus:outline-none focus:ring-2 focus:ring-[#00C2FF] focus:ring-offset-2
                                `}
                            >
                                <div className="flex flex-col items-center gap-3">
                                    <div className={`w-14 h-14 rounded-2xl ${colors.iconBg} text-white flex items-center justify-center`}>
                                        {SUBJECT_ICONS[subject]}
                                    </div>
                                    <span className={`text-lg font-bold ${colors.textColor}`}>
                                        {BAGRUT_SUBJECT_LABELS[subject]}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    function renderChapterSelect() {
        if (!selectedModule) {
            return (
                <div className="p-6 md:p-8 text-center">
                    <div className="card-glass p-8 max-w-md mx-auto">
                        <p className="text-slate-600 mb-4">אין מודולים זמינים למקצוע זה</p>
                        <button
                            onClick={() => setView('subject-select')}
                            className="btn-lip-action px-6 py-3"
                        >
                            חזרה לבחירת מקצוע
                        </button>
                    </div>
                </div>
            );
        }

        const subjectColors = selectedSubject ? SUBJECT_COLORS[selectedSubject] : SUBJECT_COLORS.civics;

        return (
            <div className="p-6 md:p-8">
                <button
                    onClick={() => setView('subject-select')}
                    className="flex items-center gap-2 text-slate-600 hover:text-[#2B59C3] mb-6 font-medium transition-colors"
                >
                    <IconChevronRight size={20} />
                    חזרה למקצועות
                </button>

                <div className="card-glass p-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl ${subjectColors.iconBg} text-white flex items-center justify-center`}>
                            {selectedSubject && SUBJECT_ICONS[selectedSubject]}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[#2B59C3]">
                                {BAGRUT_SUBJECT_LABELS[selectedSubject!]}
                            </h1>
                            <p className="text-slate-600">{selectedModule.title}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    {selectedModule.chapters.map((chapter, index) => {
                        const chapterProgress = progress?.chapterProgress?.[chapter.id];
                        const isCompleted = chapterProgress?.status === 'completed';
                        const isInProgress = chapterProgress?.status === 'in_progress';

                        return (
                            <button
                                key={chapter.id}
                                onClick={() => handleChapterSelect(chapter)}
                                className={`
                                    w-full card-glass p-4 text-right transition-all
                                    hover:shadow-lg hover:scale-[1.01]
                                    focus:outline-none focus:ring-2 focus:ring-[#00C2FF] focus:ring-offset-2
                                    ${isCompleted ? 'border-l-4 border-l-emerald-500' : ''}
                                    ${isInProgress ? 'border-l-4 border-l-amber-500' : ''}
                                `}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <span className={`
                                            w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg
                                            ${isCompleted ? 'bg-emerald-100 text-emerald-600' :
                                              isInProgress ? 'bg-amber-100 text-amber-600' :
                                              'bg-slate-100 text-slate-400'}
                                        `}>
                                            {isCompleted ? <IconCheck size={20} /> : index + 1}
                                        </span>
                                        <div>
                                            <h3 className="font-bold text-slate-800">
                                                {chapter.title}
                                            </h3>
                                            <p className="text-sm text-slate-500">
                                                {chapter.totalQuestions} שאלות
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {chapterProgress?.bestScore !== undefined && chapterProgress.bestScore > 0 && (
                                            <span className={`
                                                px-3 py-1 rounded-full text-sm font-bold
                                                ${chapterProgress.bestScore >= 56 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}
                                            `}>
                                                {Math.round(chapterProgress.bestScore)}%
                                            </span>
                                        )}
                                        <IconChevronLeft size={20} className="text-slate-400" />
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    function renderPractice() {
        if (questions.length === 0) {
            return (
                <div className="p-6 md:p-8 text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-[#8B5CF6] border-t-transparent rounded-full mx-auto" />
                    <p className="text-slate-500 mt-4">טוען שאלות...</p>
                </div>
            );
        }

        const currentQuestion = questions[currentQuestionIndex];
        const currentAnswer = answers[currentQuestion.id] || '';

        return (
            <div className="p-6 md:p-8">
                {/* Assignment banner */}
                {isAssignmentMode && currentAssignment && (
                    <div className="card-glass p-4 mb-6 border-r-4 border-r-[#8B5CF6]">
                        <div className="flex items-center gap-3">
                            <IconSchool size={24} className="text-[#8B5CF6]" />
                            <div>
                                <h2 className="font-bold text-slate-800">{currentAssignment.title}</h2>
                                {currentAssignment.teacherName && (
                                    <p className="text-sm text-slate-500">מורה: {currentAssignment.teacherName}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={isAssignmentMode ? onExit : handleBackToChapters}
                        className="flex items-center gap-2 text-slate-600 hover:text-[#2B59C3] font-medium transition-colors"
                    >
                        <IconChevronRight size={20} />
                        {isAssignmentMode ? 'יציאה' : 'חזרה'}
                    </button>

                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500 font-medium">
                            שאלה {currentQuestionIndex + 1} / {questions.length}
                        </span>
                        <span className="px-3 py-1 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-full text-sm font-bold">
                            {currentQuestion.points} נק'
                        </span>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-200 rounded-full mb-6 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#00C2FF] rounded-full transition-all duration-500"
                        style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                    />
                </div>

                {/* Source text if exists */}
                {currentQuestion.sourceText && (
                    <div className="card-glass p-5 mb-6 border-r-4 border-r-[#2B59C3]">
                        <p className="text-sm text-slate-500 mb-2 font-medium">
                            {currentQuestion.sourceReference || 'קטע מקור'}
                        </p>
                        <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                            {currentQuestion.sourceText}
                        </p>
                    </div>
                )}

                {/* Question */}
                <div className="mb-6">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 leading-relaxed">
                        {currentQuestion.question}
                    </h2>

                    {/* Multiple choice options */}
                    {currentQuestion.questionType === 'multiple-choice' && currentQuestion.options && (
                        <div className="space-y-3">
                            {currentQuestion.options.map((option, index) => {
                                const isSelected = currentAnswer === option;
                                const isCorrect = index === currentQuestion.correctOptionIndex;
                                const showCorrectness = showAnswer;

                                let optionStyle = 'card-glass hover:shadow-md hover:scale-[1.01]';
                                let iconBg = 'bg-slate-100 text-slate-500';

                                if (isSelected && !showCorrectness) {
                                    optionStyle = 'card-glass border-2 border-[#8B5CF6] bg-[#8B5CF6]/5';
                                    iconBg = 'bg-[#8B5CF6] text-white';
                                } else if (showCorrectness) {
                                    if (isCorrect) {
                                        optionStyle = 'card-glass border-2 border-emerald-500 bg-emerald-50';
                                        iconBg = 'bg-emerald-500 text-white';
                                    } else if (isSelected && !isCorrect) {
                                        optionStyle = 'card-glass border-2 border-rose-500 bg-rose-50';
                                        iconBg = 'bg-rose-500 text-white';
                                    }
                                }

                                return (
                                    <button
                                        key={index}
                                        onClick={() => !showAnswer && handleAnswerChange(option)}
                                        disabled={showAnswer}
                                        className={`
                                            w-full p-4 text-right transition-all
                                            focus:outline-none focus:ring-2 focus:ring-[#00C2FF] focus:ring-offset-2
                                            ${optionStyle}
                                        `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`w-9 h-9 flex items-center justify-center rounded-xl font-bold transition-colors ${iconBg}`}>
                                                {String.fromCharCode(1488 + index)}
                                            </span>
                                            <span className="flex-1 text-slate-700">{option}</span>
                                            {showCorrectness && isCorrect && (
                                                <IconCheck className="text-emerald-500" size={24} />
                                            )}
                                            {showCorrectness && isSelected && !isCorrect && (
                                                <IconX className="text-rose-500" size={24} />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Text answer textarea - for open, source-analysis, essay questions */}
                    {(['open', 'source-analysis', 'essay', 'fill-in-blanks'].includes(currentQuestion.questionType)) && (
                        <textarea
                            value={currentAnswer}
                            onChange={(e) => handleAnswerChange(e.target.value)}
                            disabled={showAnswer}
                            placeholder={
                                currentQuestion.questionType === 'essay'
                                    ? "כתוב את החיבור שלך כאן..."
                                    : currentQuestion.questionType === 'source-analysis'
                                    ? "ענה על השאלות לפי קטע המקור..."
                                    : "כתוב את תשובתך כאן..."
                            }
                            className={`w-full p-4 card-glass resize-none focus:ring-2 focus:ring-[#00C2FF] focus:border-transparent transition-all ${
                                currentQuestion.questionType === 'essay' ? 'h-64' : 'h-40'
                            }`}
                            dir="rtl"
                        />
                    )}
                </div>

                {/* Hints */}
                {currentQuestion.hints && currentQuestion.hints.length > 0 && (
                    <div className="mb-6">
                        {hintsShown > 0 && (
                            <div className="space-y-2 mb-3">
                                {currentQuestion.hints.slice(0, hintsShown).map((hint, index) => (
                                    <div key={index} className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                                        <div className="flex items-center gap-2 text-amber-600 mb-1">
                                            <IconBulb size={18} />
                                            <span className="text-sm font-bold">רמז {index + 1}</span>
                                        </div>
                                        <p className="text-slate-700">{hint}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!showAnswer && hintsShown < currentQuestion.hints.length && (
                            <button
                                onClick={handleShowHint}
                                className="flex items-center gap-2 text-amber-600 hover:text-amber-700 font-medium transition-colors"
                            >
                                <IconBulb size={18} />
                                <span>הצג רמז ({hintsShown}/{currentQuestion.hints.length})</span>
                            </button>
                        )}
                    </div>
                )}

                {/* AI Evaluation feedback (for open questions) */}
                {showAnswer && currentQuestion.questionType !== 'multiple-choice' && aiEvaluations[currentQuestion.id] && (
                    <div className={`p-5 rounded-2xl mb-6 ${
                        aiEvaluations[currentQuestion.id].status === 'correct'
                            ? 'bg-emerald-50 border border-emerald-200'
                            : aiEvaluations[currentQuestion.id].status === 'partial'
                            ? 'bg-amber-50 border border-amber-200'
                            : 'bg-rose-50 border border-rose-200'
                    }`}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                aiEvaluations[currentQuestion.id].status === 'correct'
                                    ? 'bg-emerald-500'
                                    : aiEvaluations[currentQuestion.id].status === 'partial'
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                            } text-white`}>
                                {aiEvaluations[currentQuestion.id].status === 'correct' && <IconCheck size={24} />}
                                {aiEvaluations[currentQuestion.id].status === 'partial' && <IconBulb size={24} />}
                                {aiEvaluations[currentQuestion.id].status === 'incorrect' && <IconX size={24} />}
                            </div>
                            <div>
                                <h3 className={`font-bold ${
                                    aiEvaluations[currentQuestion.id].status === 'correct'
                                        ? 'text-emerald-700'
                                        : aiEvaluations[currentQuestion.id].status === 'partial'
                                        ? 'text-amber-700'
                                        : 'text-rose-700'
                                }`}>
                                    {aiEvaluations[currentQuestion.id].status === 'correct' && 'תשובה נכונה!'}
                                    {aiEvaluations[currentQuestion.id].status === 'partial' && 'תשובה חלקית'}
                                    {aiEvaluations[currentQuestion.id].status === 'incorrect' && 'צריך לשפר'}
                                </h3>
                                <span className="text-sm text-slate-500">
                                    ניקוד: {aiEvaluations[currentQuestion.id].score} / {currentQuestion.points}
                                </span>
                            </div>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {aiEvaluations[currentQuestion.id].feedback}
                        </p>
                    </div>
                )}

                {/* Model answer */}
                {showAnswer && currentQuestion.modelAnswer && (
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl mb-6">
                        <h3 className="font-bold text-slate-600 mb-2 flex items-center gap-2">
                            <IconCheck size={20} />
                            תשובה לדוגמה
                        </h3>
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {currentQuestion.modelAnswer}
                        </p>
                    </div>
                )}

                {/* Self-assessment fallback (only when AI evaluation failed) */}
                {showAnswer && currentQuestion.questionType !== 'multiple-choice' && !aiEvaluations[currentQuestion.id] && (
                    <div className="card-glass p-5 mb-6">
                        <h3 className="font-bold text-slate-700 mb-3 text-center">
                            איך הייתה התשובה שלך?
                        </h3>
                        <p className="text-sm text-slate-500 text-center mb-3">
                            ההערכה האוטומטית לא זמינה כרגע. בחר בעצמך:
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleSelfAssessment('correct')}
                                className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                                    selfAssessments[currentQuestion.id] === 'correct'
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                }`}
                            >
                                ✓ נכון
                            </button>
                            <button
                                onClick={() => handleSelfAssessment('partial')}
                                className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                                    selfAssessments[currentQuestion.id] === 'partial'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                }`}
                            >
                                ~ חלקי
                            </button>
                            <button
                                onClick={() => handleSelfAssessment('incorrect')}
                                className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                                    selfAssessments[currentQuestion.id] === 'incorrect'
                                        ? 'bg-rose-500 text-white'
                                        : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                }`}
                            >
                                ✗ לא נכון
                            </button>
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                    {evaluatingAnswer ? (
                        // Loading state during AI evaluation
                        <div className="flex-1 py-4 rounded-full font-bold text-lg bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center gap-3">
                            <div className="animate-spin w-5 h-5 border-2 border-[#8B5CF6] border-t-transparent rounded-full" />
                            מעריך את התשובה...
                        </div>
                    ) : !showAnswer ? (
                        <button
                            onClick={handleCheckAnswer}
                            disabled={!currentAnswer}
                            className={`
                                flex-1 py-4 rounded-full font-bold text-lg transition-all
                                ${currentAnswer
                                    ? 'btn-lip-action'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                            `}
                        >
                            בדוק תשובה
                        </button>
                    ) : (
                        <button
                            onClick={handleNextQuestion}
                            disabled={
                                currentQuestion.questionType !== 'multiple-choice' &&
                                !aiEvaluations[currentQuestion.id] &&
                                !selfAssessments[currentQuestion.id]
                            }
                            className={`flex-1 py-4 rounded-full font-bold text-lg transition-all ${
                                currentQuestion.questionType !== 'multiple-choice' &&
                                !aiEvaluations[currentQuestion.id] &&
                                !selfAssessments[currentQuestion.id]
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-emerald-500 hover:bg-emerald-600 text-white border-b-4 border-emerald-600 active:border-b-0 active:translate-y-1'
                            }`}
                        >
                            {currentQuestionIndex < questions.length - 1 ? 'שאלה הבאה' : 'סיים תרגול'}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    function renderResults() {
        if (!results) return null;

        // Calculate score: full points for correct, half for partial
        const totalScore = results.correct + (results.partial * 0.5);
        const percentage = Math.round((totalScore / results.total) * 100);
        const minutes = Math.floor(results.timeSeconds / 60);
        const seconds = results.timeSeconds % 60;
        const passed = percentage >= 56;

        return (
            <div className="p-6 md:p-8 text-center">
                <div className="card-glass p-8 mb-6">
                    <div className={`
                        w-28 h-28 mx-auto rounded-3xl flex items-center justify-center mb-6
                        ${passed
                            ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                            : 'bg-gradient-to-br from-amber-400 to-amber-600'}
                    `}>
                        {passed ? (
                            <IconTrophy size={56} className="text-white" />
                        ) : (
                            <IconTarget size={56} className="text-white" />
                        )}
                    </div>

                    <h1 className={`text-3xl font-bold mb-3 ${passed ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {passed ? 'כל הכבוד!' : 'צריך עוד תרגול'}
                    </h1>

                    <div className={`text-6xl font-black mb-3 ${passed ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {percentage}%
                    </div>

                    <div className="space-y-1 text-slate-600">
                        <p className="text-lg">
                            <span className="text-emerald-600 font-bold">{results.correct}</span> נכונות
                            {results.partial > 0 && (
                                <>, <span className="text-amber-600 font-bold">{results.partial}</span> חלקיות</>
                            )}
                            {' '}מתוך {results.total} שאלות
                        </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 mt-4 text-slate-500">
                        <IconClock size={20} />
                        <span className="font-medium">{minutes}:{seconds.toString().padStart(2, '0')}</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    {currentAssignment?.allowRetry !== false && (
                        <button
                            onClick={handleRestart}
                            className="flex-1 btn-lip-action py-4 flex items-center justify-center gap-2"
                        >
                            <IconRefresh size={20} />
                            תרגל שוב
                        </button>
                    )}
                    <button
                        onClick={isAssignmentMode ? onExit : handleBackToChapters}
                        className="flex-1 btn-lip-primary py-4"
                    >
                        {isAssignmentMode ? 'סיום' : 'חזרה לפרקים'}
                    </button>
                </div>
            </div>
        );
    }

    // ============================================
    // MAIN RENDER
    // ============================================

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="animate-spin w-12 h-12 border-4 border-[#8B5CF6] border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-[60vh]" dir="rtl">
            <div className="max-w-2xl mx-auto">
                {view === 'subject-select' && renderSubjectSelect()}
                {view === 'chapter-select' && renderChapterSelect()}
                {view === 'practice' && renderPractice()}
                {view === 'results' && renderResults()}
            </div>
        </div>
    );
}
