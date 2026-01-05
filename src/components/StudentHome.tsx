import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMyAssignments, type StudentAssignment } from '../hooks/useMyAssignments';
import { formatDueDate } from '../services/taskAssignmentService';
import {
    IconFlame,
    IconDiamond,
    IconTrophy,
    IconCheck,
    IconStar,
    IconPlayerPlayFilled,
    IconShoppingBag,
    IconShieldLock,
    IconClock,
    IconAlertTriangle,
    IconSparkles,
    IconBell,
    IconBook,
    IconClipboardCheck,
    IconTarget,
    IconChevronLeft
} from '@tabler/icons-react';

// --- MOCK GAMIFICATION ENGINE (SIMULATION) ---
const useGamification = () => {
    return {
        xp: 1450,
        level: 12,
        streak: {
            current: 14,
            isFrozen: false,
            freezesAvailable: 2,
            history: [true, true, false, true, true, true, true]
        },
        currency: {
            gems: 450
        },
        league: {
            name: 'Ruby League',
            rank: 4,
            isPromotionZone: true,
            totalParticipants: 30
        },
        dailyGoal: {
            targetXp: 50,
            currentXp: 35
        }
    };
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
                <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                    <IconCheck size={12} /> נבדק
                </span>
            );
        }
        if (task.status === 'submitted') {
            return (
                <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full flex items-center gap-1">
                    <IconClipboardCheck size={12} /> הוגש
                </span>
            );
        }
        if (isOverdue) {
            return (
                <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full flex items-center gap-1">
                    <IconAlertTriangle size={12} /> באיחור
                </span>
            );
        }
        if (isNew) {
            return (
                <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full flex items-center gap-1 animate-pulse">
                    <IconSparkles size={12} /> חדש
                </span>
            );
        }
        if (task.progress > 0) {
            return (
                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                    בתהליך
                </span>
            );
        }
        return null;
    };

    const getTaskIcon = () => {
        if (task.taskType === 'exam') return <IconClipboardCheck size={20} />;
        if (task.taskType === 'practice') return <IconTarget size={20} />;
        return <IconBook size={20} />;
    };

    return (
        <div
            onClick={onClick}
            className={`
                bg-white rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200
                hover:shadow-lg hover:-translate-y-1 hover:border-indigo-300 active:scale-[0.98]
                ${isCompleted ? 'border-gray-200 opacity-75' : isOverdue ? 'border-red-200' : isNew ? 'border-indigo-200 shadow-md shadow-indigo-100' : 'border-gray-200'}
            `}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-xl ${
                    isCompleted ? 'bg-green-100 text-green-600' :
                    isOverdue ? 'bg-red-100 text-red-600' :
                    'bg-indigo-100 text-indigo-600'
                }`}>
                    {getTaskIcon()}
                </div>
                {getStatusBadge()}
            </div>

            {/* Title */}
            <h3 className={`font-bold text-lg mb-1 line-clamp-2 ${isCompleted ? 'text-gray-500' : 'text-gray-900'}`}>
                {task.title}
            </h3>

            {/* Meta info */}
            <p className="text-sm text-gray-500 mb-3">
                {task.courseTitle} {task.teacherName && `• ${task.teacherName}`}
            </p>

            {/* Progress bar (if in progress) */}
            {task.progress > 0 && task.progress < 100 && (
                <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>התקדמות</span>
                        <span>{task.progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${task.progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Score (if graded) */}
            {task.status === 'graded' && task.score !== undefined && (
                <div className="mb-3 bg-green-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-green-600">{task.percentage}%</div>
                    <div className="text-xs text-green-600">{task.score}/{task.maxPoints} נקודות</div>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                {/* Due date */}
                {task.dueDate && !isCompleted && (
                    <div className={`flex items-center gap-1.5 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        <IconClock size={14} />
                        <span>{formatDueDate(task.dueDate)}</span>
                    </div>
                )}
                {isCompleted && task.submittedAt && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-400">
                        <IconCheck size={14} />
                        <span>הוגש</span>
                    </div>
                )}
                {!task.dueDate && !isCompleted && <div />}

                {/* Points */}
                <div className="flex items-center gap-1 text-sm text-amber-600 font-medium">
                    <IconStar size={14} className="fill-amber-400" />
                    <span>{task.maxPoints} נק׳</span>
                </div>
            </div>

            {/* Action hint */}
            {!isCompleted && (
                <div className="mt-3 flex items-center justify-center gap-2 text-indigo-600 font-medium text-sm">
                    <span>{task.progress > 0 ? 'המשך' : 'התחל'}</span>
                    <IconChevronLeft size={16} />
                </div>
            )}
        </div>
    );
};

// Empty State Component
const EmptyState: React.FC<{ type: 'no-tasks' | 'no-pending' | 'no-completed' }> = ({ type }) => {
    const content = {
        'no-tasks': {
            icon: <IconSparkles size={48} className="text-indigo-400" />,
            title: 'אין משימות עדיין!',
            description: 'המורים עדיין לא שלחו לך משימות. בינתיים, אפשר לנוח או לתרגל בחומרים הקיימים.'
        },
        'no-pending': {
            icon: <IconCheck size={48} className="text-green-400" />,
            title: 'כל הכבוד!',
            description: 'סיימת את כל המשימות הממתינות. חכה למשימות חדשות מהמורה.'
        },
        'no-completed': {
            icon: <IconTarget size={48} className="text-gray-400" />,
            title: 'עדיין אין משימות שהושלמו',
            description: 'התחל לעבוד על המשימות שלך ותראה אותן כאן.'
        }
    };

    const c = content[type];

    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="p-4 bg-gray-50 rounded-2xl mb-4">
                {c.icon}
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">{c.title}</h3>
            <p className="text-gray-500 max-w-xs">{c.description}</p>
        </div>
    );
};

const StudentHome: React.FC<StudentHomeProps> = ({ onSelectAssignment, highlightCourseId }) => {
    const { currentUser } = useAuth();
    const { assignments, loading, error, newTasksCount } = useMyAssignments(currentUser?.uid);
    const gameStats = useGamification();
    const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'completed'>('all');
    const [selectedTask, setSelectedTask] = useState<StudentAssignment | null>(null);

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
            <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-indigo-50 to-white">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="text-indigo-600 font-bold animate-pulse">טוען את המשימות שלך...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-32 font-sans text-slate-900 overflow-x-hidden" dir="rtl">

            {/* --- TOP BAR (GAMIFICATION HUD) --- */}
            <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-100 z-40">
                <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
                    {/* League */}
                    <div className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded-xl cursor-pointer transition-colors">
                        <IconTrophy className="text-amber-500 fill-amber-500 w-6 h-6" />
                        <div className="hidden sm:block">
                            <div className="text-[10px] text-gray-400 font-bold uppercase">ליגה</div>
                            <div className="text-sm font-bold text-amber-600">{gameStats.league.name}</div>
                        </div>
                    </div>

                    {/* Streak */}
                    <div className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded-xl cursor-pointer transition-colors">
                        <div className="relative">
                            <IconFlame className="text-orange-500 fill-orange-500 w-6 h-6 animate-pulse" />
                            <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white text-[9px] font-black px-1 rounded-full">
                                {gameStats.streak.current}
                            </div>
                        </div>
                        <span className="hidden sm:block text-sm font-bold text-orange-600">{gameStats.streak.current} ימים</span>
                    </div>

                    {/* Gems */}
                    <div className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded-xl cursor-pointer transition-colors">
                        <IconDiamond className="text-blue-500 fill-blue-500 w-6 h-6" />
                        <span className="text-sm font-bold text-blue-600">{gameStats.currency.gems}</span>
                    </div>

                    {/* Notifications */}
                    <div className="relative hover:bg-gray-50 p-2 rounded-xl cursor-pointer transition-colors">
                        <IconBell className="w-6 h-6 text-gray-400" />
                        {newTasksCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                                {newTasksCount}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-4 pt-6">

                {/* --- GREETING --- */}
                <div className="mb-6">
                    <h1 className="text-2xl font-black text-gray-900">
                        היי {currentUser?.displayName?.split(' ')[0] || 'תלמיד/ה'}!
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {pendingCount > 0
                            ? `יש לך ${pendingCount} משימות ממתינות`
                            : 'אין משימות ממתינות - מעולה!'
                        }
                    </p>
                </div>

                {/* --- DAILY GOAL --- */}
                <div className="mb-6 bg-white border border-gray-200 p-4 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <IconTarget className="text-indigo-600" size={20} />
                            <span className="font-bold text-gray-800">מטרה יומית</span>
                        </div>
                        <span className="text-sm text-gray-500">
                            {gameStats.dailyGoal.currentXp}/{gameStats.dailyGoal.targetXp} XP
                        </span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-l from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((gameStats.dailyGoal.currentXp / gameStats.dailyGoal.targetXp) * 100, 100)}%` }}
                        />
                    </div>
                    {gameStats.dailyGoal.currentXp >= gameStats.dailyGoal.targetXp && (
                        <div className="mt-2 text-center text-green-600 font-medium text-sm flex items-center justify-center gap-1">
                            <IconCheck size={16} /> השגת את המטרה היומית!
                        </div>
                    )}
                </div>

                {/* --- FILTER TABS --- */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    <button
                        onClick={() => setActiveFilter('all')}
                        className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all ${
                            activeFilter === 'all'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
                        }`}
                    >
                        כל המשימות
                    </button>
                    <button
                        onClick={() => setActiveFilter('pending')}
                        className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
                            activeFilter === 'pending'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
                        }`}
                    >
                        להגשה
                        {pendingCount > 0 && (
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                                activeFilter === 'pending' ? 'bg-white/20' : 'bg-indigo-100 text-indigo-600'
                            }`}>
                                {pendingCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveFilter('completed')}
                        className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all ${
                            activeFilter === 'completed'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
                        }`}
                    >
                        הושלמו
                    </button>
                </div>

                {/* --- TASKS GRID --- */}
                {filteredTasks.length === 0 ? (
                    <EmptyState
                        type={
                            activeFilter === 'completed' ? 'no-completed' :
                            activeFilter === 'pending' ? 'no-pending' :
                            'no-tasks'
                        }
                    />
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
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

            {/* --- TASK DETAIL MODAL --- */}
            {selectedTask && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setSelectedTask(null)}
                    />

                    {/* Card */}
                    <div className="bg-white w-full sm:w-[420px] sm:rounded-2xl rounded-t-2xl relative z-10 animate-in slide-in-from-bottom-10 duration-300 shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className={`p-6 text-white ${
                            selectedTask.status === 'graded' ? 'bg-gradient-to-l from-green-500 to-emerald-600' :
                            selectedTask.isOverdue ? 'bg-gradient-to-l from-red-500 to-orange-500' :
                            'bg-gradient-to-l from-indigo-600 to-purple-600'
                        }`}>
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-white/20 rounded-xl">
                                    {selectedTask.taskType === 'exam' ? <IconClipboardCheck size={28} /> :
                                     selectedTask.taskType === 'practice' ? <IconTarget size={28} /> :
                                     <IconBook size={28} />}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold mb-1">{selectedTask.title}</h3>
                                    <p className="text-white/80 text-sm">{selectedTask.courseTitle}</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {/* Instructions */}
                            {selectedTask.instructions && (
                                <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                                    <h4 className="font-bold text-gray-800 mb-2">הוראות מהמורה:</h4>
                                    <p className="text-gray-600 text-sm">{selectedTask.instructions}</p>
                                </div>
                            )}

                            {/* Meta info */}
                            <div className="space-y-3 mb-6">
                                {selectedTask.dueDate && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500 flex items-center gap-2">
                                            <IconClock size={18} />
                                            מועד הגשה
                                        </span>
                                        <span className={`font-medium ${selectedTask.isOverdue ? 'text-red-600' : 'text-gray-800'}`}>
                                            {formatDueDate(selectedTask.dueDate)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-500 flex items-center gap-2">
                                        <IconStar size={18} />
                                        ניקוד מקסימלי
                                    </span>
                                    <span className="font-medium text-gray-800">{selectedTask.maxPoints} נקודות</span>
                                </div>
                                {selectedTask.teacherName && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">מורה</span>
                                        <span className="font-medium text-gray-800">{selectedTask.teacherName}</span>
                                    </div>
                                )}
                            </div>

                            {/* Score display */}
                            {selectedTask.status === 'graded' && selectedTask.score !== undefined && (
                                <div className="mb-6 bg-green-50 rounded-xl p-4 text-center">
                                    <div className="text-4xl font-black text-green-600 mb-1">{selectedTask.percentage}%</div>
                                    <div className="text-green-600">{selectedTask.score}/{selectedTask.maxPoints} נקודות</div>
                                </div>
                            )}

                            {/* Progress display */}
                            {selectedTask.progress > 0 && selectedTask.progress < 100 && (
                                <div className="mb-6">
                                    <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                                        <span>התקדמות נוכחית</span>
                                        <span>{selectedTask.progress}%</span>
                                    </div>
                                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 rounded-full"
                                            style={{ width: `${selectedTask.progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setSelectedTask(null)}
                                    className="px-4 py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                                >
                                    סגור
                                </button>
                                <button
                                    onClick={handleLaunch}
                                    className={`px-4 py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                                        selectedTask.status === 'graded' || selectedTask.status === 'submitted'
                                            ? 'bg-gray-400'
                                            : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                                    }`}
                                >
                                    <IconPlayerPlayFilled size={18} />
                                    {selectedTask.progress > 0 ? 'המשך' : 'התחל'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- BOTTOM NAV (Mobile) --- */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-6 flex justify-around md:hidden z-40">
                <button className="flex flex-col items-center gap-1 text-indigo-600">
                    <IconBook className="w-6 h-6" />
                    <span className="text-[10px] font-bold">משימות</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-indigo-500">
                    <IconShoppingBag className="w-6 h-6" />
                    <span className="text-[10px] font-bold">חנות</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-indigo-500">
                    <IconShieldLock className="w-6 h-6" />
                    <span className="text-[10px] font-bold">פרופיל</span>
                </button>
            </div>

        </div>
    );
};

export default StudentHome;
