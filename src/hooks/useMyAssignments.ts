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
}

export interface GroupedAssignments {
    new: StudentAssignment[];
    inProgress: StudentAssignment[];
    completed: StudentAssignment[];
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

        // Listen to tasks assigned to all students
        const tasksQuery = query(
            collection(db, 'student_tasks'),
            orderBy('assignedAt', 'desc')
        );

        // Listen to this student's submissions
        const submissionsQuery = query(
            collection(db, 'task_submissions'),
            where('studentId', '==', studentId)
        );

        let tasks: StudentTask[] = [];
        let submissions: StudentTaskSubmission[] = [];

        const processData = () => {
            // Create a map of submissions by taskId
            const submissionMap = new Map<string, StudentTaskSubmission>();
            submissions.forEach(sub => {
                submissionMap.set(sub.taskId, sub);
            });

            // Filter tasks that are assigned to this student (or all)
            const relevantTasks = tasks.filter(task => {
                return task.assignedTo === 'all' ||
                       task.studentIds?.includes(studentId) ||
                       task.assignedTo === 'group';
            });

            // Combine tasks with submissions
            const combined: StudentAssignment[] = relevantTasks.map(task => {
                const submission = submissionMap.get(task.id);
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
                    isNew
                };
            });

            // Sort: new/in_progress by due date, completed by submission date
            combined.sort((a, b) => {
                // Completed items at the end
                const aCompleted = a.status === 'submitted' || a.status === 'graded';
                const bCompleted = b.status === 'submitted' || b.status === 'graded';
                if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

                // New items at the top
                if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;

                // Then by due date
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

            setAssignments(grouped);
            setNewTasksCount(grouped.new.filter(a => a.isNew).length);
            setLoading(false);
        };

        // Subscribe to tasks
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

        // Subscribe to submissions
        const unsubSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
            submissions = [];
            snapshot.forEach((doc) => {
                submissions.push({ id: doc.id, ...doc.data() } as StudentTaskSubmission);
            });
            processData();
        }, (err) => {
            console.error("Error fetching submissions:", err);
            // Don't set error - submissions might just be empty
        });

        return () => {
            unsubTasks();
            unsubSubmissions();
        };
    }, [studentId]);

    return { assignments, loading, error, newTasksCount };
};
