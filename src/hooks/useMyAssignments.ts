import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { StudentTask, StudentTaskSubmission, TaskStatus } from '../shared/types/courseTypes';

export type AssignmentStatus = 'new' | 'in_progress' | 'completed' | 'submitted' | 'graded';
export type AssignmentType = 'standard' | 'remediation' | 'challenge';

// Combined view of task + submission for the student dashboard
export interface StudentAssignment {
    id: string;
    taskId: string;
    submissionId?: string;

    // Task info
    courseId: string;
    courseTitle: string;
    unitId?: string;
    unitTitle?: string;
    title: string;
    instructions?: string;
    teacherName: string;

    // Status
    status: AssignmentStatus;
    progress: number;

    // Timing
    assignedDate?: any;
    dueDate?: any;
    submittedAt?: any;

    // Scoring
    maxPoints: number;
    score?: number;
    percentage?: number;

    // Task type
    taskType: 'activity' | 'exam' | 'practice';
    groupType?: AssignmentType;

    // Flags
    isOverdue?: boolean;
    isNew?: boolean;

    // Source tracking
    source?: 'teacher_assigned' | 'direct_link';
}

export interface GroupedAssignments {
    new: StudentAssignment[];
    inProgress: StudentAssignment[];
    completed: StudentAssignment[];
}

// Interface for direct link submissions (from 'submissions' collection)
interface DirectSubmission {
    id: string;
    courseId: string;
    studentId: string;
    studentName: string;
    score?: number;
    maxScore?: number;
    courseTopic?: string;
    submittedAt?: any;
    status?: string;
    answers?: Record<string, any>;
}

export const useMyAssignments = (studentId: string | undefined) => {
    const [assignments, setAssignments] = useState<GroupedAssignments>({
        new: [],
        inProgress: [],
        completed: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newTasksCount, setNewTasksCount] = useState(0);

    useEffect(() => {
        if (!studentId) {
            setLoading(false);
            return;
        }

        // Listen to tasks assigned to all students (teacher-assigned)
        const tasksQuery = query(
            collection(db, 'student_tasks'),
            orderBy('assignedAt', 'desc')
        );

        // Listen to this student's task_submissions (for teacher-assigned tasks)
        const taskSubmissionsQuery = query(
            collection(db, 'task_submissions'),
            where('studentId', '==', studentId)
        );

        // Listen to this student's direct submissions (from direct links - WhatsApp/email)
        const directSubmissionsQuery = query(
            collection(db, 'submissions'),
            where('studentId', '==', studentId)
        );

        let tasks: StudentTask[] = [];
        let taskSubmissions: StudentTaskSubmission[] = [];
        let directSubmissions: DirectSubmission[] = [];

        const processData = () => {
            console.log('📊 useMyAssignments processing:', {
                studentId,
                tasksCount: tasks.length,
                taskSubmissionsCount: taskSubmissions.length,
                directSubmissionsCount: directSubmissions.length
            });

            // Create a map of task submissions by taskId
            const taskSubmissionMap = new Map<string, StudentTaskSubmission>();
            taskSubmissions.forEach(sub => {
                taskSubmissionMap.set(sub.taskId, sub);
            });

            // Filter tasks that are assigned to this student (or all)
            const relevantTasks = tasks.filter(task => {
                const isRelevant = task.assignedTo === 'all' ||
                       task.studentIds?.includes(studentId) ||
                       task.assignedTo === 'group';
                return isRelevant;
            });

            // Combine teacher-assigned tasks with their submissions
            const teacherAssigned: StudentAssignment[] = relevantTasks.map(task => {
                const submission = taskSubmissionMap.get(task.id);
                const now = new Date();
                const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : (task.dueDate ? new Date(task.dueDate) : null);
                const isOverdue = dueDate ? now > dueDate : false;

                // Determine status
                let status: AssignmentStatus = 'new';
                if (submission) {
                    if (submission.status === 'graded') status = 'graded';
                    else if (submission.status === 'submitted') status = 'submitted';
                    else if (submission.progress > 0) status = 'in_progress';
                }

                // Check if task is new (assigned within last 24 hours and not started)
                const assignedAt = task.assignedAt?.toDate ? task.assignedAt.toDate() : new Date();
                const isNew = status === 'new' && (now.getTime() - assignedAt.getTime()) < 24 * 60 * 60 * 1000;

                return {
                    id: task.id,
                    taskId: task.id,
                    submissionId: submission?.id,
                    courseId: task.courseId,
                    courseTitle: task.courseTitle,
                    unitId: task.unitId,
                    unitTitle: task.unitTitle,
                    title: task.title,
                    instructions: task.instructions,
                    teacherName: task.teacherName,
                    status,
                    progress: submission?.progress || 0,
                    assignedDate: task.assignedAt,
                    dueDate: task.dueDate,
                    submittedAt: submission?.submittedAt,
                    maxPoints: task.maxPoints,
                    score: submission?.score,
                    percentage: submission?.percentage,
                    taskType: task.taskType,
                    isOverdue,
                    isNew,
                    source: 'teacher_assigned' as const
                };
            });

            // Get courseIds from teacher-assigned tasks to avoid duplicates
            const teacherAssignedCourseIds = new Set(teacherAssigned.map(t => t.courseId));

            // Convert direct submissions to StudentAssignment format
            // Only include if not already assigned by teacher
            const directAssigned: StudentAssignment[] = directSubmissions
                .filter(sub => !teacherAssignedCourseIds.has(sub.courseId))
                .map(sub => {
                    const submittedAt = sub.submittedAt?.toDate ? sub.submittedAt.toDate() :
                                       (sub.submittedAt?.seconds ? new Date(sub.submittedAt.seconds * 1000) : new Date());

                    return {
                        id: `direct_${sub.id}`,
                        taskId: sub.courseId,
                        submissionId: sub.id,
                        courseId: sub.courseId,
                        courseTitle: sub.courseTopic || 'פעילות',
                        title: sub.courseTopic || 'פעילות מקישור',
                        teacherName: '',
                        status: 'submitted' as AssignmentStatus,
                        progress: 100,
                        submittedAt: sub.submittedAt,
                        maxPoints: sub.maxScore || 100,
                        score: sub.score,
                        percentage: sub.score,
                        taskType: 'activity' as const,
                        isOverdue: false,
                        isNew: false,
                        source: 'direct_link' as const
                    };
                });

            // Combine both sources
            const combined: StudentAssignment[] = [...teacherAssigned, ...directAssigned];

            // Sort: new/in_progress by due date, completed by submission date
            combined.sort((a, b) => {
                // Completed items at the end
                const aCompleted = a.status === 'submitted' || a.status === 'graded';
                const bCompleted = b.status === 'submitted' || b.status === 'graded';
                if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

                // New items at the top
                if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;

                // Then by due date or submission date
                if (aCompleted && bCompleted) {
                    // Sort completed by submission date (newest first)
                    const subA = a.submittedAt?.seconds || 0;
                    const subB = b.submittedAt?.seconds || 0;
                    return subB - subA;
                }

                const dueDateA = a.dueDate?.seconds || 0;
                const dueDateB = b.dueDate?.seconds || 0;
                return dueDateA - dueDateB; // Ascending (earliest due first)
            });

            // Group
            const grouped: GroupedAssignments = {
                new: [],
                inProgress: [],
                completed: []
            };

            combined.forEach(assign => {
                if (assign.status === 'submitted' || assign.status === 'graded') {
                    grouped.completed.push(assign);
                } else if (assign.status === 'in_progress') {
                    grouped.inProgress.push(assign);
                } else {
                    grouped.new.push(assign);
                }
            });

            console.log('📊 useMyAssignments grouped results:', {
                new: grouped.new.length,
                inProgress: grouped.inProgress.length,
                completed: grouped.completed.length,
                directLinkCompleted: grouped.completed.filter(a => a.source === 'direct_link').length
            });

            setAssignments(grouped);
            setNewTasksCount(grouped.new.filter(a => a.isNew).length);
            setLoading(false);
        };

        // Subscribe to teacher-assigned tasks
        const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
            tasks = [];
            snapshot.forEach((doc) => {
                tasks.push({ id: doc.id, ...doc.data() } as StudentTask);
            });
            processData();
        }, (err) => {
            console.error("Error fetching tasks:", err);
            setError(err.message);
            setLoading(false);
        });

        // Subscribe to task submissions (for teacher-assigned)
        const unsubTaskSubmissions = onSnapshot(taskSubmissionsQuery, (snapshot) => {
            taskSubmissions = [];
            snapshot.forEach((doc) => {
                taskSubmissions.push({ id: doc.id, ...doc.data() } as StudentTaskSubmission);
            });
            processData();
        }, (err) => {
            console.error("Error fetching task submissions:", err);
            // Don't set error - submissions might just be empty
        });

        // Subscribe to direct submissions (from direct links)
        const unsubDirectSubmissions = onSnapshot(directSubmissionsQuery, (snapshot) => {
            directSubmissions = [];
            snapshot.forEach((doc) => {
                directSubmissions.push({ id: doc.id, ...doc.data() } as DirectSubmission);
            });
            processData();
        }, (err) => {
            console.error("Error fetching direct submissions:", err);
            // Don't set error - direct submissions might just be empty
        });

        return () => {
            unsubTasks();
            unsubTaskSubmissions();
            unsubDirectSubmissions();
        };
    }, [studentId]);

    return { assignments, loading, error, newTasksCount };
};
