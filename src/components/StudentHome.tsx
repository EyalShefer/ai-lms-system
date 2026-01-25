import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStudentContext } from '../context/StudentContext';
import { useMyAssignments, type StudentAssignment } from '../hooks/useMyAssignments';
import { formatDueDate } from '../services/taskAssignmentService';
import { AIStarsSpinner } from './ui/Loading/AIStarsSpinner';
import StudentBottomNav from './student/StudentBottomNav';
import {
    IconFlame,
    IconDiamond,
    IconTrophy,
    IconCheck,
    IconStar,
    IconPlayerPlayFilled,
    IconClock,
    IconAlertTriangle,
    IconSparkles,
    IconBell,
    IconClipboardCheck,
    IconTarget,
    IconChevronLeft,
    IconInfoCircle,
    IconX,
    IconBook
} from '@tabler/icons-react';

// League tier display names
const LEAGUE_NAMES: Record<string, string> = {
    'BRONZE': 'ליגת ארד',
    'SILVER': 'ליגת כסף',
    'GOLD': 'ליגת זהב',
    'PLATINUM': 'ליגת פלטינה',
    'DIAMOND': 'ליגת יהלום'
};

interface StudentHomeProps {
    onSelectAssignment: (assignmentId: string, unitId?: string) => void;
    highlightCourseId?: string | null;
}

// Task Card Component
const TaskCard: React.FC<{
    task: StudentAssignment;
    onClick: () => void;
}> = ({ task, onClick }) => {
    const isCompleted = task.status === 'submitted' || task.status === 'graded';
    const isOverdue = task.isOverdue && !isCompleted;
    const isNew = task.isNew;

    const getStatusBadge = () => {
        if (task.status === 'graded') {
            return (
                <span className="px-2.5 py-1 bg-wizdi-action-light text-wizdi-action-dark text-xs font-bold rounded-full flex items-center gap-1" aria-label="נבדק">
                    <IconCheck size={12} aria-hidden="true" /> נבדק
                </span>
            );
        }
        if (task.status === 'submitted') {
            return (
                <span className="px-2.5 py-1 bg-wizdi-cyan/20 text-wizdi-cyan text-xs font-bold rounded-full flex items-center gap-1" aria-label="הוגש">
                    <IconClipboardCheck size={12} aria-hidden="true" /> הוגש
                </span>
            );
        }
        if (isOverdue) {
            return (
                <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full flex items-center gap-1" aria-label="באיחור">
                    <IconAlertTriangle size={12} aria-hidden="true" /> באיחור
                </span>
            );
        }
        if (isNew) {
            return (
                <span className="px-2.5 py-1 bg-wizdi-royal/10 text-wizdi-royal text-xs font-bold rounded-full flex items-center gap-1 animate-pulse motion-reduce:animate-none" aria-label="משימה חדשה">
                    <IconSparkles size={12} aria-hidden="true" /> חדש
                </span>
            );
        }
        if (task.progress > 0) {
            return (
                <span className="px-2.5 py-1 bg-wizdi-gold/20 text-wizdi-gold text-xs font-bold rounded-full" aria-label="בתהליך">
                    בתהליך
                </span>
            );
        }
        return null;
    };

    const getTaskIcon = () => {
        if (task.taskType === 'exam') return <IconClipboardCheck size={20} aria-hidden="true" />;
        if (task.taskType === 'practice') return <IconTarget size={20} aria-hidden="true" />;
        return <IconBook size={20} aria-hidden="true" />;
    };

    const getTaskTypeLabel = () => {
        if (task.taskType === 'exam') return 'מבחן';
        if (task.taskType === 'practice') return 'תרגול';
        return 'שיעור';
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        }
    };

    return (
        <article
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={`${getTaskTypeLabel()}: ${task.title}. ${isCompleted ? 'הושלם' : isOverdue ? 'באיחור' : isNew ? 'חדש' : ''}`}
            className={`
                card-glass rounded-3xl p-6 cursor-pointer transition-all duration-300
                hover:shadow-xl hover:-translate-y-2 hover:border-wizdi-cyan active:scale-[0.98]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2
                motion-reduce:hover:transform-none motion-reduce:active:transform-none
                dark:bg-slate-800/80
                ${isCompleted ? 'opacity-75' : isOverdue ? 'ring-2 ring-red-200' : isNew ? 'ring-2 ring-wizdi-cyan/30 shadow-lg shadow-wizdi-cyan/10' : ''}
            `}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${
                    isCompleted ? 'bg-wizdi-action-light text-wizdi-action' :
                    isOverdue ? 'bg-red-100 text-red-600' :
                    'bg-wizdi-royal/10 text-wizdi-royal'
                }`} aria-hidden="true">
                    {getTaskIcon()}
                </div>
                {getStatusBadge()}
            </div>

            {/* Title */}
            <h3 className={`font-bold text-lg mb-1 line-clamp-2 ${isCompleted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-white'}`}>
                {task.title}
            </h3>

            {/* Meta info */}
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                {task.courseTitle} {task.teacherName && `• ${task.teacherName}`}
            </p>

            {/* Progress bar (if in progress) */}
            {task.progress > 0 && task.progress < 100 && (
                <div className="mb-3" role="progressbar" aria-valuenow={task.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`התקדמות: ${task.progress}%`}>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span>התקדמות</span>
                        <span>{task.progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-l from-wizdi-royal to-wizdi-cyan rounded-full transition-all"
                            style={{ width: `${task.progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Score (if graded) */}
            {task.status === 'graded' && task.score !== undefined && (
                <div className="mb-3 bg-wizdi-action-light dark:bg-wizdi-action/20 rounded-xl p-3 text-center border border-wizdi-action/20" aria-label={`ציון: ${task.percentage}%, ${task.score} מתוך ${task.maxPoints} נקודות`}>
                    <div className="text-2xl font-black text-wizdi-action">{task.percentage}%</div>
                    <div className="text-xs text-wizdi-action/80">{task.score}/{task.maxPoints} נקודות</div>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                {/* Due date */}
                {task.dueDate && !isCompleted && (
                    <div className={`flex items-center gap-1.5 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                        <IconClock size={14} aria-hidden="true" />
                        <span>{formatDueDate(task.dueDate)}</span>
                    </div>
                )}
                {isCompleted && task.submittedAt && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
                        <IconCheck size={14} aria-hidden="true" />
                        <span>הוגש</span>
                    </div>
                )}
                {!task.dueDate && !isCompleted && <div />}

                {/* Points */}
                <div className="flex items-center gap-1 text-sm text-wizdi-gold font-medium">
                    <IconStar size={14} className="fill-wizdi-gold" aria-hidden="true" />
                    <span>{task.maxPoints} נק׳</span>
                </div>
            </div>

            {/* Action hint */}
            {!isCompleted && (
                <div className="mt-4 flex items-center justify-center" aria-hidden="true">
                    <span className="btn-lip-action px-6 py-2 min-h-[36px] text-sm">
                        {task.progress > 0 ? 'המשך' : 'התחל'} <IconChevronLeft size={16} className="inline mr-1" />
                    </span>
                </div>
            )}
        </article>
    );
};

// Empty State Component
const EmptyState: React.FC<{ type: 'no-tasks' | 'no-pending' | 'no-completed' }> = ({ type }) => {
    const content = {
        'no-tasks': {
            icon: <IconSparkles size={48} className="text-wizdi-cyan" />,
            title: 'אין משימות עדיין!',
            description: 'המורים עדיין לא שלחו לך משימות. בינתיים, אפשר לנוח או לתרגל בחומרים הקיימים.'
        },
        'no-pending': {
            icon: <IconCheck size={48} className="text-wizdi-lime" />,
            title: 'כל הכבוד!',
            description: 'סיימת את כל המשימות הממתינות. חכה למשימות חדשות מהמורה.'
        },
        'no-completed': {
            icon: <IconTarget size={48} className="text-slate-400" />,
            title: 'עדיין אין משימות שהושלמו',
            description: 'התחל לעבוד על המשימות שלך ותראה אותן כאן.'
        }
    };

    const c = content[type];

    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="p-4 bg-wizdi-cloud rounded-3xl mb-4 shadow-lg">
                {c.icon}
            </div>
            <h3 className="text-xl font-bold text-wizdi-royal mb-2">{c.title}</h3>
            <p className="text-slate-500 max-w-xs">{c.description}</p>
        </div>
    );
};

const StudentHome: React.FC<StudentHomeProps> = ({ onSelectAssignment, highlightCourseId }) => {
    const { currentUser } = useAuth();
    const { assignments, loading, error, newTasksCount } = useMyAssignments(currentUser?.uid);
    const { gamificationProfile, isLoadingProfile } = useStudentContext();
    const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'completed'>('all');
    const [selectedTask, setSelectedTask] = useState<StudentAssignment | null>(null);
    const [showStatsLegend, setShowStatsLegend] = useState(false);

    // Derived gamification values with fallbacks
    const streak = gamificationProfile?.currentStreak || 0;
    const gems = gamificationProfile?.gems || 0;
    const xp = gamificationProfile?.xp || 0;
    const level = gamificationProfile?.level || 1;
    const leagueTier = gamificationProfile?.leagueTier || 'BRONZE';
    const leagueName = LEAGUE_NAMES[leagueTier] || 'ליגת ארד';
    const leagueWeeklyXp = gamificationProfile?.leagueWeeklyXp || 0;
    // Daily goal: 50 XP target, track today's progress via weeklyXp mod daily
    const dailyTargetXp = 50;
    const dailyCurrentXp = Math.min(leagueWeeklyXp % 100, dailyTargetXp); // Simple approximation

    // Combine all assignments based on filter
    const getFilteredTasks = () => {
        const all = [...assignments.new, ...assignments.inProgress, ...assignments.completed];

        switch (activeFilter) {
            case 'pending':
                return [...assignments.new, ...assignments.inProgress];
            case 'completed':
                return assignments.completed;
            default:
                return all;
        }
    };

    const filteredTasks = getFilteredTasks();
    const pendingCount = assignments.new.length + assignments.inProgress.length;

    const handleTaskClick = (task: StudentAssignment) => {
        setSelectedTask(task);
    };

    const handleLaunch = () => {
        if (selectedTask) {
            onSelectAssignment(selectedTask.courseId, selectedTask.unitId);
            setSelectedTask(null);
        }
    };

    if (loading) {
        return (
            <div className="h-screen flex flex-col items-center justify-center">
                <AIStarsSpinner size="xl" color="primary" className="mb-4" />
                <p className="text-wizdi-royal font-bold animate-pulse">טוען את המשימות שלך...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-32 font-sans text-slate-900 overflow-x-hidden" dir="rtl">

            {/* --- TOP BAR (GAMIFICATION HUD) --- */}
            <header className="sticky top-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-wizdi-cloud dark:border-slate-800 z-sticky" role="banner">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    {/* Info Button */}
                    <button
                        onClick={() => setShowStatsLegend(true)}
                        className="hover:bg-wizdi-cloud dark:hover:bg-slate-800 p-2 min-h-[44px] min-w-[44px] rounded-xl cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-royal"
                        aria-label="מקרא - הסבר על הסמלים"
                    >
                        <IconInfoCircle className="w-6 h-6 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                    </button>

                    {/* League */}
                    <button
                        className="flex items-center gap-2 hover:bg-wizdi-cloud dark:hover:bg-slate-800 p-2 min-h-[44px] rounded-xl cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-gold"
                        aria-label={`ליגה: ${leagueName}, ${leagueWeeklyXp} XP השבוע`}
                    >
                        <IconTrophy className="text-wizdi-gold fill-wizdi-gold w-6 h-6" aria-hidden="true" />
                        <div className="hidden sm:block text-right">
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">ליגה</div>
                            <div className="text-sm font-bold text-wizdi-gold">{leagueName}</div>
                        </div>
                    </button>

                    {/* Streak */}
                    <button
                        className="flex items-center gap-2 hover:bg-wizdi-cloud dark:hover:bg-slate-800 p-2 min-h-[44px] rounded-xl cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                        aria-label={`רצף: ${streak} ימים רצופים`}
                    >
                        <div className="relative">
                            <IconFlame className={`text-orange-500 fill-orange-500 w-6 h-6 ${streak > 0 ? 'animate-pulse motion-reduce:animate-none' : ''}`} aria-hidden="true" />
                            <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white text-[9px] font-black px-1 rounded-full" aria-hidden="true">
                                {streak}
                            </div>
                        </div>
                        <span className="hidden sm:block text-sm font-bold text-orange-600">{streak} ימים</span>
                    </button>

                    {/* Gems */}
                    <button
                        className="flex items-center gap-2 hover:bg-wizdi-cloud dark:hover:bg-slate-800 p-2 min-h-[44px] rounded-xl cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan"
                        aria-label={`${gems} יהלומים`}
                    >
                        <IconDiamond className="text-wizdi-cyan fill-wizdi-cyan w-6 h-6" aria-hidden="true" />
                        <span className="text-sm font-bold text-wizdi-cyan">{gems}</span>
                    </button>

                    {/* Notifications */}
                    <button
                        className="relative hover:bg-wizdi-cloud dark:hover:bg-slate-800 p-2 min-h-[44px] min-w-[44px] rounded-xl cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-royal"
                        aria-label={newTasksCount > 0 ? `${newTasksCount} התראות חדשות` : 'אין התראות חדשות'}
                    >
                        <IconBell className="w-6 h-6 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                        {newTasksCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce motion-reduce:animate-none" aria-hidden="true">
                                {newTasksCount}
                            </div>
                        )}
                    </button>
                </div>
            </header>

            {/* Stats Legend Popup */}
            {showStatsLegend && (
                <div
                    className="fixed inset-0 z-modal flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="stats-legend-title"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowStatsLegend(false)}
                        aria-hidden="true"
                    />

                    {/* Card */}
                    <div className="bg-white dark:bg-slate-800 w-[90%] max-w-md rounded-3xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-gradient-to-l from-wizdi-royal to-wizdi-cyan p-4 text-white flex items-center justify-between">
                            <h2 id="stats-legend-title" className="text-lg font-bold">מה כל סמל אומר?</h2>
                            <button
                                onClick={() => setShowStatsLegend(false)}
                                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                                aria-label="סגור"
                            >
                                <IconX size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-4">
                            {/* Trophy - League */}
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 bg-wizdi-gold/10 rounded-xl flex-shrink-0">
                                    <IconTrophy className="text-wizdi-gold fill-wizdi-gold w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white">ליגה</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        מתחרים עם תלמידים אחרים ומנסים לעלות בדירוג!
                                    </p>
                                </div>
                            </div>

                            {/* Flame - Streak */}
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex-shrink-0">
                                    <IconFlame className="text-orange-500 fill-orange-500 w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white">רצף</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        כמה ימים ברצף למדתם. שומרים על הרצף כל יום!
                                    </p>
                                </div>
                            </div>

                            {/* Diamond - Gems */}
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 bg-wizdi-cyan/10 rounded-xl flex-shrink-0">
                                    <IconDiamond className="text-wizdi-cyan fill-wizdi-cyan w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white">יהלומים</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        צוברים יהלומים על למידה וקונים איתם דברים מגניבים בחנות!
                                    </p>
                                </div>
                            </div>

                            {/* Star - XP */}
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 bg-wizdi-gold/10 rounded-xl flex-shrink-0">
                                    <IconStar className="text-wizdi-gold fill-wizdi-gold w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white">נקודות (XP)</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        נקודות ניסיון שצוברים על כל פעילות. עולים רמה ככל שצוברים יותר!
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700">
                            <button
                                onClick={() => setShowStatsLegend(false)}
                                className="w-full btn-lip-primary py-3 rounded-xl font-bold"
                            >
                                הבנתי!
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-4 pt-6">

                {/* --- GREETING --- */}
                <div className="mb-6">
                    <h1 className="text-2xl font-black text-wizdi-royal">
                        היי {currentUser?.displayName?.split(' ')[0] || 'תלמיד/ה'}!
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {pendingCount > 0
                            ? `יש לך ${pendingCount} משימות ממתינות`
                            : 'אין משימות ממתינות - מעולה!'
                        }
                    </p>
                </div>

                {/* --- DAILY GOAL --- */}
                <div className="mb-6 card-glass p-4 rounded-3xl shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <IconTarget className="text-wizdi-royal" size={20} />
                            <span className="font-bold text-wizdi-royal">מטרה יומית</span>
                        </div>
                        <span className="text-sm text-slate-500">
                            {dailyCurrentXp}/{dailyTargetXp} XP
                        </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-l from-wizdi-royal to-wizdi-cyan rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((dailyCurrentXp / dailyTargetXp) * 100, 100)}%` }}
                        />
                    </div>
                    {dailyCurrentXp >= dailyTargetXp && (
                        <div className="mt-2 text-center text-wizdi-lime font-medium text-sm flex items-center justify-center gap-1">
                            <IconCheck size={16} /> השגת את המטרה היומית!
                        </div>
                    )}
                </div>

                {/* --- FILTER TABS --- */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2" role="tablist" aria-label="סינון משימות">
                    <button
                        onClick={() => setActiveFilter('all')}
                        role="tab"
                        aria-selected={activeFilter === 'all'}
                        aria-controls="tasks-panel"
                        className={`px-4 py-2 min-h-[44px] rounded-full font-bold text-sm whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2 ${
                            activeFilter === 'all'
                                ? 'btn-lip-primary shadow-lg'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-wizdi-cyan'
                        }`}
                    >
                        כל המשימות
                    </button>
                    <button
                        onClick={() => setActiveFilter('pending')}
                        role="tab"
                        aria-selected={activeFilter === 'pending'}
                        aria-controls="tasks-panel"
                        className={`px-4 py-2 min-h-[44px] rounded-full font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2 ${
                            activeFilter === 'pending'
                                ? 'btn-lip-primary shadow-lg'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-wizdi-cyan'
                        }`}
                    >
                        להגשה
                        {pendingCount > 0 && (
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                                activeFilter === 'pending' ? 'bg-white/20' : 'bg-wizdi-royal/10 text-wizdi-royal dark:bg-wizdi-royal/20'
                            }`} aria-label={`${pendingCount} משימות`}>
                                {pendingCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveFilter('completed')}
                        role="tab"
                        aria-selected={activeFilter === 'completed'}
                        aria-controls="tasks-panel"
                        className={`px-4 py-2 min-h-[44px] rounded-full font-bold text-sm whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2 ${
                            activeFilter === 'completed'
                                ? 'btn-lip-primary shadow-lg'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-wizdi-cyan'
                        }`}
                    >
                        הושלמו
                    </button>
                </div>

                {/* --- TASKS GRID --- */}
                <div id="tasks-panel" role="tabpanel" aria-label={`משימות: ${activeFilter === 'all' ? 'כל המשימות' : activeFilter === 'pending' ? 'להגשה' : 'הושלמו'}`}>
                    {filteredTasks.length === 0 ? (
                        <EmptyState
                            type={
                                activeFilter === 'completed' ? 'no-completed' :
                                activeFilter === 'pending' ? 'no-pending' :
                                'no-tasks'
                            }
                        />
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list" aria-label="רשימת משימות">
                            {filteredTasks.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onClick={() => handleTaskClick(task)}
                                />
                            ))}
                        </div>
                    )}
                </div>

            </div>

            {/* --- TASK DETAIL MODAL --- */}
            {selectedTask && (
                <div
                    className="fixed inset-0 z-modal flex items-end sm:items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="task-modal-title"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setSelectedTask(null)}
                        aria-hidden="true"
                    />

                    {/* Card */}
                    <div className="bg-white dark:bg-slate-800 w-full sm:w-[480px] sm:rounded-3xl rounded-t-3xl relative z-10 animate-in slide-in-from-bottom-10 duration-300 shadow-2xl overflow-hidden motion-reduce:animate-none">
                        {/* Header */}
                        <div className={`p-6 text-white ${
                            selectedTask.status === 'graded' ? 'bg-gradient-to-l from-wizdi-action to-wizdi-action-dark' :
                            selectedTask.isOverdue ? 'bg-gradient-to-l from-red-500 to-orange-500' :
                            'bg-gradient-to-l from-wizdi-royal to-wizdi-cyan'
                        }`}>
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-white/20 rounded-xl" aria-hidden="true">
                                    {selectedTask.taskType === 'exam' ? <IconClipboardCheck size={28} /> :
                                     selectedTask.taskType === 'practice' ? <IconTarget size={28} /> :
                                     <IconBook size={28} />}
                                </div>
                                <div className="flex-1">
                                    <h3 id="task-modal-title" className="text-xl font-bold mb-1">{selectedTask.title}</h3>
                                    <p className="text-white/80 text-sm">{selectedTask.courseTitle}</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {/* Instructions */}
                            {selectedTask.instructions && (
                                <div className="mb-4 p-4 bg-wizdi-cloud dark:bg-slate-700 rounded-xl">
                                    <h4 className="font-bold text-wizdi-royal dark:text-wizdi-cyan mb-2">הוראות מהמורה:</h4>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm">{selectedTask.instructions}</p>
                                </div>
                            )}

                            {/* Meta info */}
                            <dl className="space-y-3 mb-6">
                                {selectedTask.dueDate && (
                                    <div className="flex items-center justify-between">
                                        <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                            <IconClock size={18} aria-hidden="true" />
                                            מועד הגשה
                                        </dt>
                                        <dd className={`font-medium ${selectedTask.isOverdue ? 'text-red-600' : 'text-slate-800 dark:text-slate-200'}`}>
                                            {formatDueDate(selectedTask.dueDate)}
                                        </dd>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                        <IconStar size={18} className="text-wizdi-gold" aria-hidden="true" />
                                        ניקוד מקסימלי
                                    </dt>
                                    <dd className="font-medium text-slate-800 dark:text-slate-200">{selectedTask.maxPoints} נקודות</dd>
                                </div>
                                {selectedTask.teacherName && (
                                    <div className="flex items-center justify-between">
                                        <dt className="text-slate-500 dark:text-slate-400">מורה</dt>
                                        <dd className="font-medium text-slate-800 dark:text-slate-200">{selectedTask.teacherName}</dd>
                                    </div>
                                )}
                            </dl>

                            {/* Score display */}
                            {selectedTask.status === 'graded' && selectedTask.score !== undefined && (
                                <div className="mb-6 bg-wizdi-action-light dark:bg-wizdi-action/20 rounded-xl p-4 text-center border border-wizdi-action/20" aria-label={`ציון: ${selectedTask.percentage}%`}>
                                    <div className="text-4xl font-black text-wizdi-action mb-1">{selectedTask.percentage}%</div>
                                    <div className="text-wizdi-action/80">{selectedTask.score}/{selectedTask.maxPoints} נקודות</div>
                                </div>
                            )}

                            {/* Progress display */}
                            {selectedTask.progress > 0 && selectedTask.progress < 100 && (
                                <div className="mb-6" role="progressbar" aria-valuenow={selectedTask.progress} aria-valuemin={0} aria-valuemax={100}>
                                    <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 mb-2">
                                        <span>התקדמות נוכחית</span>
                                        <span>{selectedTask.progress}%</span>
                                    </div>
                                    <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-l from-wizdi-royal to-wizdi-cyan rounded-full"
                                            style={{ width: `${selectedTask.progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setSelectedTask(null)}
                                    className="px-4 py-3 min-h-[44px] rounded-full font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                >
                                    סגור
                                </button>
                                <button
                                    onClick={handleLaunch}
                                    disabled={selectedTask.status === 'graded' || selectedTask.status === 'submitted'}
                                    aria-disabled={selectedTask.status === 'graded' || selectedTask.status === 'submitted'}
                                    className={`flex items-center justify-center gap-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan ${
                                        selectedTask.status === 'graded' || selectedTask.status === 'submitted'
                                            ? 'px-4 py-3 rounded-full font-bold bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                            : 'btn-lip-action px-4 py-3'
                                    }`}
                                >
                                    <IconPlayerPlayFilled size={18} aria-hidden="true" />
                                    {selectedTask.progress > 0 ? 'המשך' : 'התחל'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- BOTTOM NAV (Duolingo-style) --- */}
            <StudentBottomNav variant="dashboard" newTasksCount={newTasksCount} />

        </div>
    );
};

export default StudentHome;
