/**
 * StudentHomeMobile.tsx
 *
 * Mobile-optimized student dashboard with:
 * - Compact gamification HUD
 * - Large touch-friendly task cards
 * - Bottom sheet for task details
 * - Swipe-friendly task list
 * - 56px+ touch targets for primary actions
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMyAssignments, type StudentAssignment } from '../../hooks/useMyAssignments';
import { formatDueDate } from '../../services/taskAssignmentService';
import { AIStarsSpinner } from '../ui/Loading/AIStarsSpinner';
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
    IconBook,
    IconClipboardCheck,
    IconTarget,
    IconChevronLeft,
    IconX,
    IconHome,
    IconChartBar,
    IconInfoCircle
} from '@tabler/icons-react';

// Mock gamification data
const useGamification = () => {
    return {
        xp: 1450,
        level: 12,
        streak: { current: 14 },
        currency: { gems: 450 },
        league: { name: 'Ruby', rank: 4 },
        dailyGoal: { targetXp: 50, currentXp: 35 }
    };
};

interface StudentHomeMobileProps {
    onSelectAssignment: (assignmentId: string, unitId?: string) => void;
    highlightCourseId?: string | null;
}

const StudentHomeMobile: React.FC<StudentHomeMobileProps> = ({ onSelectAssignment }) => {
    const { currentUser } = useAuth();
    const { assignments, loading, newTasksCount } = useMyAssignments(currentUser?.uid);
    const gameStats = useGamification();
    const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'completed'>('all');
    const [selectedTask, setSelectedTask] = useState<StudentAssignment | null>(null);
    const [showStatsLegend, setShowStatsLegend] = useState(false);

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

    const handleLaunch = () => {
        if (selectedTask) {
            onSelectAssignment(selectedTask.courseId, selectedTask.unitId);
            setSelectedTask(null);
        }
    };

    const getTaskIcon = (type: string) => {
        if (type === 'exam') return <IconClipboardCheck size={24} />;
        if (type === 'practice') return <IconTarget size={24} />;
        return <IconBook size={24} />;
    };

    const getTaskTypeLabel = (type: string) => {
        if (type === 'exam') return 'מבחן';
        if (type === 'practice') return 'תרגול';
        return 'שיעור';
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="text-center">
                    <AIStarsSpinner size="lg" color="primary" className="mx-auto mb-4" />
                    <p className="text-wizdi-royal font-bold">טוען...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24" dir="rtl">
            {/* Compact Header with Gamification */}
            <header className="bg-gradient-to-l from-wizdi-royal to-wizdi-cyan text-white px-4 py-5 safe-area-inset-top">
                {/* Top row: Stats */}
                <div className="flex items-center justify-between mb-4">
                    {/* Info Button */}
                    <button
                        onClick={() => setShowStatsLegend(true)}
                        className="p-2 min-w-[44px] min-h-[44px] hover:bg-white/20 rounded-full transition-colors"
                        aria-label="מקרא - הסבר על הסמלים"
                    >
                        <IconInfoCircle className="w-5 h-5" />
                    </button>

                    {/* Streak */}
                    <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full">
                        <IconFlame className="w-5 h-5 text-orange-300" />
                        <span className="font-bold text-sm">{gameStats.streak.current}</span>
                    </div>

                    {/* XP / Points */}
                    <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full">
                        <IconStar className="w-5 h-5 text-yellow-300" />
                        <span className="font-bold text-sm">{gameStats.xp} XP</span>
                    </div>

                    {/* Gems */}
                    <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full">
                        <IconDiamond className="w-5 h-5 text-cyan-200" />
                        <span className="font-bold text-sm">{gameStats.currency.gems}</span>
                    </div>

                    {/* Notifications */}
                    <button
                        className="relative p-2 min-w-[44px] min-h-[44px]"
                        aria-label={newTasksCount > 0 ? `${newTasksCount} התראות` : 'התראות'}
                    >
                        <IconBell className="w-6 h-6" />
                        {newTasksCount > 0 && (
                            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">
                                {newTasksCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Greeting */}
                <h1 className="text-xl font-black mb-3">
                    היי {currentUser?.displayName?.split(' ')[0] || 'תלמיד/ה'}! 👋
                </h1>

                {/* Daily Goal Progress */}
                <div className="bg-white/10 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">מטרה יומית</span>
                        <span className="text-sm">{gameStats.dailyGoal.currentXp}/{gameStats.dailyGoal.targetXp} XP</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-white rounded-full transition-all"
                            style={{ width: `${Math.min((gameStats.dailyGoal.currentXp / gameStats.dailyGoal.targetXp) * 100, 100)}%` }}
                            role="progressbar"
                            aria-valuenow={gameStats.dailyGoal.currentXp}
                            aria-valuemax={gameStats.dailyGoal.targetXp}
                        />
                    </div>
                </div>
            </header>

            {/* Filter Tabs */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 sticky top-0 z-10">
                <div className="flex gap-2" role="tablist" aria-label="סינון משימות">
                    <button
                        onClick={() => setActiveFilter('all')}
                        role="tab"
                        aria-selected={activeFilter === 'all'}
                        className={`flex-1 py-3 min-h-[48px] rounded-xl font-bold text-sm transition-all ${
                            activeFilter === 'all'
                                ? 'bg-wizdi-royal text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                    >
                        הכל
                    </button>
                    <button
                        onClick={() => setActiveFilter('pending')}
                        role="tab"
                        aria-selected={activeFilter === 'pending'}
                        className={`flex-1 py-3 min-h-[48px] rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1 ${
                            activeFilter === 'pending'
                                ? 'bg-wizdi-royal text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                    >
                        להגשה
                        {pendingCount > 0 && (
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                                activeFilter === 'pending' ? 'bg-white/20' : 'bg-wizdi-royal/10 text-wizdi-royal'
                            }`}>
                                {pendingCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveFilter('completed')}
                        role="tab"
                        aria-selected={activeFilter === 'completed'}
                        className={`flex-1 py-3 min-h-[48px] rounded-xl font-bold text-sm transition-all ${
                            activeFilter === 'completed'
                                ? 'bg-wizdi-royal text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                    >
                        הושלמו
                    </button>
                </div>
            </div>

            {/* Tasks List */}
            <main className="px-4 py-4 space-y-3" role="tabpanel">
                {filteredTasks.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-wizdi-cloud dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            {activeFilter === 'completed' ? (
                                <IconTarget className="w-8 h-8 text-slate-400" />
                            ) : (
                                <IconCheck className="w-8 h-8 text-wizdi-action" />
                            )}
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                            {activeFilter === 'completed' ? 'עדיין אין משימות שהושלמו' : 'אין משימות ממתינות!'}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {activeFilter === 'completed' ? 'התחל לעבוד על המשימות' : 'כל הכבוד! סיימת הכל'}
                        </p>
                    </div>
                ) : (
                    filteredTasks.map((task) => {
                        const isCompleted = task.status === 'submitted' || task.status === 'graded';
                        const isOverdue = task.isOverdue && !isCompleted;
                        const isNew = task.isNew;

                        return (
                            <button
                                key={task.id}
                                onClick={() => setSelectedTask(task)}
                                className={`w-full text-right p-4 bg-white dark:bg-slate-800 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                                    isNew ? 'border-wizdi-cyan shadow-lg shadow-wizdi-cyan/10' :
                                    isOverdue ? 'border-red-200' :
                                    isCompleted ? 'border-slate-100 dark:border-slate-700 opacity-75' :
                                    'border-slate-100 dark:border-slate-700'
                                }`}
                                aria-label={`${getTaskTypeLabel(task.taskType)}: ${task.title}`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Icon */}
                                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                                        isCompleted ? 'bg-wizdi-action/10 text-wizdi-action' :
                                        isOverdue ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                                        'bg-wizdi-royal/10 dark:bg-wizdi-royal/20 text-wizdi-royal'
                                    }`}>
                                        {getTaskIcon(task.taskType)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h3 className={`font-bold truncate ${
                                                isCompleted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-white'
                                            }`}>
                                                {task.title}
                                            </h3>

                                            {/* Status Badge */}
                                            {task.status === 'graded' && (
                                                <span className="px-2 py-0.5 bg-wizdi-action-light text-wizdi-action-dark text-xs font-bold rounded-full flex-shrink-0">
                                                    {task.percentage}%
                                                </span>
                                            )}
                                            {isNew && (
                                                <span className="px-2 py-0.5 bg-wizdi-cyan/20 text-wizdi-cyan text-xs font-bold rounded-full flex-shrink-0">
                                                    חדש
                                                </span>
                                            )}
                                            {isOverdue && (
                                                <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full flex-shrink-0 flex items-center gap-0.5">
                                                    <IconAlertTriangle size={10} /> באיחור
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                            {task.courseTitle}
                                        </p>

                                        {/* Progress bar */}
                                        {task.progress > 0 && task.progress < 100 && (
                                            <div className="mt-2">
                                                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-wizdi-cyan rounded-full"
                                                        style={{ width: `${task.progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Footer */}
                                        <div className="flex items-center justify-between mt-2">
                                            {task.dueDate && !isCompleted ? (
                                                <span className={`text-xs flex items-center gap-1 ${
                                                    isOverdue ? 'text-red-600' : 'text-slate-400'
                                                }`}>
                                                    <IconClock size={12} />
                                                    {formatDueDate(task.dueDate)}
                                                </span>
                                            ) : (
                                                <span />
                                            )}
                                            <span className="text-xs text-wizdi-gold flex items-center gap-1">
                                                <IconStar size={12} className="fill-wizdi-gold" />
                                                {task.maxPoints} נק׳
                                            </span>
                                        </div>
                                    </div>

                                    <IconChevronLeft className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1" />
                                </div>
                            </button>
                        );
                    })
                )}
            </main>

            {/* Task Detail Bottom Sheet */}
            {selectedTask && (
                <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setSelectedTask(null)}
                    />

                    {/* Sheet */}
                    <div className="relative w-full bg-white dark:bg-slate-800 rounded-t-3xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
                        {/* Handle */}
                        <div className="sticky top-0 bg-white dark:bg-slate-800 pt-3 pb-2 px-4 border-b border-slate-100 dark:border-slate-700">
                            <div className="w-12 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-3" />
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-black text-slate-800 dark:text-white">{selectedTask.title}</h2>
                                <button
                                    onClick={() => setSelectedTask(null)}
                                    className="p-2 min-w-[44px] min-h-[44px]"
                                    aria-label="סגור"
                                >
                                    <IconX className="w-6 h-6 text-slate-400" />
                                </button>
                            </div>
                        </div>

                        <div className="p-4">
                            {/* Task info */}
                            <div className="flex items-center gap-2 mb-4">
                                <span className={`p-2 rounded-lg ${
                                    selectedTask.taskType === 'exam' ? 'bg-wizdi-cyan/10 text-wizdi-cyan' :
                                    selectedTask.taskType === 'practice' ? 'bg-wizdi-action/10 text-wizdi-action' :
                                    'bg-wizdi-royal/10 text-wizdi-royal'
                                }`}>
                                    {getTaskIcon(selectedTask.taskType)}
                                </span>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{selectedTask.courseTitle}</p>
                                    {selectedTask.teacherName && (
                                        <p className="text-xs text-slate-400">מורה: {selectedTask.teacherName}</p>
                                    )}
                                </div>
                            </div>

                            {/* Instructions */}
                            {selectedTask.instructions && (
                                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 mb-4">
                                    <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-2 text-sm">הוראות:</h3>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm">{selectedTask.instructions}</p>
                                </div>
                            )}

                            {/* Meta info */}
                            <div className="space-y-3 mb-6">
                                {selectedTask.dueDate && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                            <IconClock size={18} />
                                            מועד הגשה
                                        </span>
                                        <span className={`font-medium ${selectedTask.isOverdue ? 'text-red-600' : 'text-slate-800 dark:text-white'}`}>
                                            {formatDueDate(selectedTask.dueDate)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                        <IconStar size={18} className="text-wizdi-gold" />
                                        ניקוד
                                    </span>
                                    <span className="font-medium text-slate-800 dark:text-white">{selectedTask.maxPoints} נקודות</span>
                                </div>
                            </div>

                            {/* Score if graded */}
                            {selectedTask.status === 'graded' && selectedTask.score !== undefined && (
                                <div className="bg-wizdi-action-light dark:bg-wizdi-action/20 rounded-xl p-4 mb-6 text-center">
                                    <div className="text-3xl font-black text-wizdi-action">{selectedTask.percentage}%</div>
                                    <div className="text-sm text-wizdi-action/80">{selectedTask.score}/{selectedTask.maxPoints} נקודות</div>
                                </div>
                            )}

                            {/* Progress */}
                            {selectedTask.progress > 0 && selectedTask.progress < 100 && (
                                <div className="mb-6">
                                    <div className="flex items-center justify-between text-sm mb-2">
                                        <span className="text-slate-500">התקדמות</span>
                                        <span className="font-medium">{selectedTask.progress}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-wizdi-cyan rounded-full"
                                            style={{ width: `${selectedTask.progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setSelectedTask(null)}
                                    className="flex-1 py-4 min-h-[56px] rounded-xl font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                >
                                    סגור
                                </button>
                                <button
                                    onClick={handleLaunch}
                                    disabled={selectedTask.status === 'graded' || selectedTask.status === 'submitted'}
                                    className={`flex-1 py-4 min-h-[56px] rounded-xl font-bold flex items-center justify-center gap-2 ${
                                        selectedTask.status === 'graded' || selectedTask.status === 'submitted'
                                            ? 'bg-slate-200 dark:bg-slate-600 text-slate-400 cursor-not-allowed'
                                            : 'bg-wizdi-action hover:bg-wizdi-action-hover text-white'
                                    }`}
                                >
                                    <IconPlayerPlayFilled size={20} />
                                    {selectedTask.progress > 0 ? 'המשך' : 'התחל'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Legend Popup */}
            {showStatsLegend && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="stats-legend-title-mobile"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowStatsLegend(false)}
                        aria-hidden="true"
                    />

                    {/* Card */}
                    <div className="bg-white dark:bg-slate-800 w-[90%] max-w-sm rounded-3xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-gradient-to-l from-wizdi-royal to-wizdi-cyan p-4 text-white flex items-center justify-between">
                            <h2 id="stats-legend-title-mobile" className="text-lg font-bold">מה כל סמל אומר?</h2>
                            <button
                                onClick={() => setShowStatsLegend(false)}
                                className="p-2 hover:bg-white/20 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                aria-label="סגור"
                            >
                                <IconX size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-3">
                            {/* Flame - Streak */}
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex-shrink-0">
                                    <IconFlame className="text-orange-500 fill-orange-500 w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">רצף</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        כמה ימים ברצף למדתם. שומרים על הרצף כל יום!
                                    </p>
                                </div>
                            </div>

                            {/* Star - XP */}
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex-shrink-0">
                                    <IconStar className="text-yellow-500 fill-yellow-500 w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">נקודות (XP)</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        נקודות ניסיון שצוברים על כל פעילות. עולים רמה ככל שצוברים יותר!
                                    </p>
                                </div>
                            </div>

                            {/* Diamond - Gems */}
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-wizdi-cyan/10 rounded-xl flex-shrink-0">
                                    <IconDiamond className="text-wizdi-cyan fill-wizdi-cyan w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">יהלומים</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        צוברים יהלומים על למידה וקונים איתם דברים מגניבים בחנות!
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700">
                            <button
                                onClick={() => setShowStatsLegend(false)}
                                className="w-full bg-wizdi-royal text-white py-3 min-h-[48px] rounded-xl font-bold"
                            >
                                הבנתי!
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-2 safe-area-inset-bottom">
                <div className="flex items-center justify-around">
                    <button
                        className="flex flex-col items-center gap-1 min-w-[64px] min-h-[56px] py-2 text-wizdi-royal"
                        aria-label="משימות"
                        aria-current="page"
                    >
                        <IconClipboardCheck className="w-6 h-6" />
                        <span className="text-xs font-bold">משימות</span>
                    </button>

                    <button
                        className="flex flex-col items-center gap-1 min-w-[64px] min-h-[56px] py-2 text-slate-400"
                        aria-label="הישגים"
                    >
                        <IconTrophy className="w-6 h-6" />
                        <span className="text-xs">הישגים</span>
                    </button>

                    <button
                        className="flex flex-col items-center gap-1 min-w-[64px] min-h-[56px] py-2 text-slate-400"
                        aria-label="פרופיל"
                    >
                        <IconHome className="w-6 h-6" />
                        <span className="text-xs">פרופיל</span>
                    </button>
                </div>
            </nav>
        </div>
    );
};

export default StudentHomeMobile;
