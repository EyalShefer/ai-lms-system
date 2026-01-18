/**
 * Teacher Home Dashboard
 * לוח בקרה בדף הבית המציג סטטוס כיתות/קבוצות לפי אחוז הגשת משימה אחרונה
 */

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { IconChevronLeft, IconClipboardList } from '@tabler/icons-react';
import type { StudentTask, StudentTaskSubmission } from '../../shared/types/courseTypes';

interface ClassStatus {
    classId: string;
    className: string;
    latestTaskId: string | null;
    latestTaskTitle: string | null;
    submissionRate: number; // 0-1
    submittedCount: number;
    totalStudents: number;
    status: 'good' | 'warning' | 'bad' | 'none';
}

interface TeacherHomeDashboardProps {
    onClassClick?: (classId: string, taskId: string) => void;
}

// Status indicator colors (using existing OnlineIndicator style)
const STATUS_COLORS = {
    good: 'bg-blue-500',      // מעל 70%
    warning: 'bg-amber-500',   // 40-70%
    bad: 'bg-red-500',         // מתחת ל-40%
    none: 'bg-slate-300'       // אין משימה
};

const STATUS_LABELS = {
    good: 'רוב הכיתה הגישה',
    warning: 'חלק הגישו',
    bad: 'מעט הגישו',
    none: 'אין משימה פעילה'
};

export const TeacherHomeDashboard: React.FC<TeacherHomeDashboardProps> = ({
    onClassClick
}) => {
    const { currentUser } = useAuth();
    const [classStatuses, setClassStatuses] = useState<ClassStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    useEffect(() => {
        if (!currentUser?.uid) return;

        fetchClassStatuses();
    }, [currentUser?.uid]);

    const fetchClassStatuses = async () => {
        if (!currentUser?.uid) return;

        setLoading(true);
        try {
            // 1. Fetch all tasks for this teacher
            const tasksQuery = query(
                collection(db, 'student_tasks'),
                where('teacherId', '==', currentUser.uid),
                orderBy('assignedAt', 'desc')
            );
            const tasksSnapshot = await getDocs(tasksQuery);

            // Group tasks by class
            const tasksByClass = new Map<string, StudentTask[]>();

            tasksSnapshot.forEach((doc) => {
                const task = { id: doc.id, ...doc.data() } as StudentTask;
                const classKey = task.className || task.courseTitle || 'ללא כיתה';

                if (!tasksByClass.has(classKey)) {
                    tasksByClass.set(classKey, []);
                }
                tasksByClass.get(classKey)!.push(task);
            });

            // 2. For each class, get the latest task and its submission rate
            const statuses: ClassStatus[] = [];

            for (const [className, tasks] of tasksByClass) {
                // Get the most recent task
                const latestTask = tasks[0]; // Already sorted by assignedAt desc

                if (!latestTask) {
                    statuses.push({
                        classId: className,
                        className,
                        latestTaskId: null,
                        latestTaskTitle: null,
                        submissionRate: 0,
                        submittedCount: 0,
                        totalStudents: 0,
                        status: 'none'
                    });
                    continue;
                }

                // Get submissions for this task
                const submissionsQuery = query(
                    collection(db, 'task_submissions'),
                    where('taskId', '==', latestTask.id)
                );
                const submissionsSnapshot = await getDocs(submissionsQuery);

                const submissions: StudentTaskSubmission[] = [];
                submissionsSnapshot.forEach((doc) => {
                    submissions.push({ id: doc.id, ...doc.data() } as StudentTaskSubmission);
                });

                // Calculate submission rate
                const submittedCount = submissions.filter(s =>
                    s.status === 'submitted' || s.status === 'graded'
                ).length;

                // Total students - either from studentIds or from submissions count
                const totalStudents = latestTask.studentIds?.length || submissions.length || 1;
                const submissionRate = totalStudents > 0 ? submittedCount / totalStudents : 0;

                // Determine status
                let status: ClassStatus['status'];
                if (totalStudents === 0 || !latestTask) {
                    status = 'none';
                } else if (submissionRate >= 0.7) {
                    status = 'good';
                } else if (submissionRate >= 0.4) {
                    status = 'warning';
                } else {
                    status = 'bad';
                }

                statuses.push({
                    classId: latestTask.classId || className,
                    className,
                    latestTaskId: latestTask.id,
                    latestTaskTitle: latestTask.title,
                    submissionRate,
                    submittedCount,
                    totalStudents,
                    status
                });
            }

            // Sort: problematic classes first
            statuses.sort((a, b) => {
                const statusOrder = { bad: 0, warning: 1, good: 2, none: 3 };
                return statusOrder[a.status] - statusOrder[b.status];
            });

            setClassStatuses(statuses);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Error fetching class statuses:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-[#111] border border-gray-800 rounded-2xl p-6">
                <div className="animate-pulse space-y-3">
                    <div className="h-5 bg-gray-800 rounded w-24"></div>
                    <div className="h-12 bg-gray-800 rounded"></div>
                    <div className="h-12 bg-gray-800 rounded"></div>
                </div>
            </div>
        );
    }

    if (classStatuses.length === 0) {
        return (
            <div className="bg-[#111] border border-gray-800 rounded-2xl p-6 text-center">
                <IconClipboardList className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">אין משימות פעילות</p>
                <p className="text-gray-500 text-sm mt-1">צרו משימה ושלחו לתלמידים</p>
            </div>
        );
    }

    return (
        <div className="bg-[#111] border border-gray-800 rounded-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">לוח בקרה</h3>
                {lastUpdated && (
                    <span className="text-xs text-gray-500">
                        עודכן {lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>

            {/* Class List */}
            <div className="space-y-2">
                {classStatuses.map((classStatus) => (
                    <button
                        key={classStatus.classId}
                        onClick={() => classStatus.latestTaskId && onClassClick?.(classStatus.classId, classStatus.latestTaskId)}
                        disabled={!classStatus.latestTaskId}
                        className={`
                            w-full flex items-center justify-between p-4 rounded-xl
                            transition-all duration-200
                            ${classStatus.latestTaskId
                                ? 'hover:bg-gray-800/50 cursor-pointer'
                                : 'opacity-60 cursor-default'}
                            bg-gray-900/50 border border-gray-800
                        `}
                    >
                        <div className="flex items-center gap-3">
                            {/* Status Indicator */}
                            <span className="relative flex items-center justify-center">
                                <span className={`
                                    w-3 h-3 rounded-full ${STATUS_COLORS[classStatus.status]}
                                `} />
                                {classStatus.status !== 'none' && classStatus.status !== 'good' && (
                                    <span className={`
                                        absolute w-3 h-3 rounded-full ${STATUS_COLORS[classStatus.status]}
                                        animate-ping opacity-50
                                    `} />
                                )}
                            </span>

                            {/* Class Info */}
                            <div className="text-right">
                                <div className="font-medium text-white">
                                    {classStatus.className}
                                </div>
                                {classStatus.latestTaskTitle && (
                                    <div className="text-xs text-gray-500 mt-0.5">
                                        {classStatus.submittedCount}/{classStatus.totalStudents} הגישו
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Arrow */}
                        {classStatus.latestTaskId && (
                            <IconChevronLeft className="w-5 h-5 text-gray-600" />
                        )}
                    </button>
                ))}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS_COLORS.good}`} />
                    70%+
                </span>
                <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS_COLORS.warning}`} />
                    40-70%
                </span>
                <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS_COLORS.bad}`} />
                    &lt;40%
                </span>
                <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS_COLORS.none}`} />
                    אין משימה
                </span>
            </div>
        </div>
    );
};

export default TeacherHomeDashboard;
