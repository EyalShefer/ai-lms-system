/**
 * Task Assignment Service
 * Handles creating, fetching, and managing student tasks/assignments
 */

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    getDoc,
    getDocs,
    serverTimestamp,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
    StudentTask,
    StudentTaskSubmission,
    TaskStatus,
    TaskAssignmentTarget,
    StudentGroupType
} from '../shared/types/courseTypes';

// Collection names
const TASKS_COLLECTION = 'student_tasks';
const SUBMISSIONS_COLLECTION = 'task_submissions';
const CLASSES_COLLECTION = 'classes';

// --- Task Creation ---

export interface CreateTaskParams {
    teacherId: string;
    teacherName: string;
    courseId: string;
    courseTitle: string;
    unitId?: string;
    unitTitle?: string;
    title: string;
    instructions?: string;
    assignedTo: TaskAssignmentTarget;
    classId?: string;
    className?: string;
    studentIds?: string[];
    groupType?: StudentGroupType;
    dueDate?: Date;
    maxPoints?: number;
    taskType?: 'activity' | 'exam' | 'practice';
    emailReportEnabled?: boolean;
}

export async function createTask(params: CreateTaskParams): Promise<string> {
    const taskData: Omit<StudentTask, 'id'> = {
        teacherId: params.teacherId,
        teacherName: params.teacherName,
        courseId: params.courseId,
        courseTitle: params.courseTitle,
        unitId: params.unitId,
        unitTitle: params.unitTitle,
        title: params.title,
        instructions: params.instructions || '',
        assignedTo: params.assignedTo,
        classId: params.classId,
        className: params.className,
        studentIds: params.studentIds,
        groupType: params.groupType,
        assignedAt: serverTimestamp(),
        dueDate: params.dueDate ? Timestamp.fromDate(params.dueDate) : null,
        maxPoints: params.maxPoints || 100,
        taskType: params.taskType || 'activity',
        emailReportEnabled: params.emailReportEnabled ?? false
    };

    const docRef = await addDoc(collection(db, TASKS_COLLECTION), taskData);

    // If assigning to specific students, create submission records for each
    if (params.assignedTo === 'individual' && params.studentIds?.length) {
        await createSubmissionRecords(docRef.id, params.studentIds);
    }

    return docRef.id;
}

async function createSubmissionRecords(taskId: string, studentIds: string[]) {
    const batch = writeBatch(db);

    for (const studentId of studentIds) {
        const submissionRef = doc(collection(db, SUBMISSIONS_COLLECTION));
        batch.set(submissionRef, {
            taskId,
            studentId,
            status: 'new' as TaskStatus,
            progress: 0,
            createdAt: serverTimestamp()
        });
    }

    await batch.commit();
}

// --- Task Fetching ---

export function subscribeToStudentTasks(
    studentId: string,
    callback: (tasks: StudentTask[]) => void
): () => void {
    // Query tasks assigned to all students OR specifically to this student
    const tasksQuery = query(
        collection(db, TASKS_COLLECTION),
        orderBy('assignedAt', 'desc')
    );

    return onSnapshot(tasksQuery, async (snapshot) => {
        const allTasks: StudentTask[] = [];

        snapshot.forEach((doc) => {
            const data = doc.data() as StudentTask;
            const task = { ...data, id: doc.id };

            // Filter: Include if assigned to 'all' OR student is in studentIds
            const isAssignedToAll = task.assignedTo === 'all';
            const isAssignedToStudent = task.studentIds?.includes(studentId);
            const isInGroup = task.assignedTo === 'group'; // Will need group check

            if (isAssignedToAll || isAssignedToStudent || isInGroup) {
                allTasks.push(task);
            }
        });

        callback(allTasks);
    });
}

export function subscribeToTeacherTasks(
    teacherId: string,
    callback: (tasks: StudentTask[]) => void
): () => void {
    const tasksQuery = query(
        collection(db, TASKS_COLLECTION),
        where('teacherId', '==', teacherId),
        orderBy('assignedAt', 'desc')
    );

    return onSnapshot(tasksQuery, (snapshot) => {
        const tasks: StudentTask[] = [];
        snapshot.forEach((doc) => {
            tasks.push({ id: doc.id, ...doc.data() } as StudentTask);
        });
        callback(tasks);
    });
}

export async function getTaskById(taskId: string): Promise<StudentTask | null> {
    const docRef = doc(db, TASKS_COLLECTION, taskId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as StudentTask;
    }
    return null;
}

// --- Submission Management ---

export async function getOrCreateSubmission(
    taskId: string,
    studentId: string,
    studentName: string
): Promise<StudentTaskSubmission> {
    // Check if submission exists
    const q = query(
        collection(db, SUBMISSIONS_COLLECTION),
        where('taskId', '==', taskId),
        where('studentId', '==', studentId)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as StudentTaskSubmission;
    }

    // Create new submission
    const submissionData: Omit<StudentTaskSubmission, 'id'> = {
        taskId,
        studentId,
        studentName,
        status: 'new',
        progress: 0
    };

    const docRef = await addDoc(collection(db, SUBMISSIONS_COLLECTION), submissionData);
    return { id: docRef.id, ...submissionData } as StudentTaskSubmission;
}

export async function updateSubmissionProgress(
    submissionId: string,
    progress: number,
    lastBlockIndex?: number
): Promise<void> {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    await updateDoc(docRef, {
        progress,
        lastBlockIndex,
        status: progress > 0 ? 'in_progress' : 'new'
    });
}

export async function submitTask(
    submissionId: string,
    data: {
        answers: Record<string, any>;
        score: number;
        maxScore: number;
        telemetry?: StudentTaskSubmission['telemetry'];
    }
): Promise<void> {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    await updateDoc(docRef, {
        status: 'submitted' as TaskStatus,
        submittedAt: serverTimestamp(),
        answers: data.answers,
        score: data.score,
        maxScore: data.maxScore,
        percentage: Math.round((data.score / data.maxScore) * 100),
        progress: 100,
        telemetry: data.telemetry
    });
}

export function subscribeToTaskSubmissions(
    taskId: string,
    callback: (submissions: StudentTaskSubmission[]) => void
): () => void {
    const q = query(
        collection(db, SUBMISSIONS_COLLECTION),
        where('taskId', '==', taskId)
    );

    return onSnapshot(q, (snapshot) => {
        const submissions: StudentTaskSubmission[] = [];
        snapshot.forEach((doc) => {
            submissions.push({ id: doc.id, ...doc.data() } as StudentTaskSubmission);
        });
        callback(submissions);
    });
}

export function subscribeToStudentSubmissions(
    studentId: string,
    callback: (submissions: StudentTaskSubmission[]) => void
): () => void {
    const q = query(
        collection(db, SUBMISSIONS_COLLECTION),
        where('studentId', '==', studentId)
    );

    return onSnapshot(q, (snapshot) => {
        const submissions: StudentTaskSubmission[] = [];
        snapshot.forEach((doc) => {
            submissions.push({ id: doc.id, ...doc.data() } as StudentTaskSubmission);
        });
        callback(submissions);
    });
}

// --- Task Management ---

export async function updateTask(
    taskId: string,
    updates: Partial<StudentTask>
): Promise<void> {
    const docRef = doc(db, TASKS_COLLECTION, taskId);
    await updateDoc(docRef, updates);
}

export async function deleteTask(taskId: string): Promise<void> {
    // Delete the task
    await deleteDoc(doc(db, TASKS_COLLECTION, taskId));

    // Delete all submissions for this task
    const q = query(
        collection(db, SUBMISSIONS_COLLECTION),
        where('taskId', '==', taskId)
    );
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();
}

// --- Grading ---

export async function gradeSubmission(
    submissionId: string,
    score: number,
    feedback?: string,
    gradedBy?: string
): Promise<void> {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    await updateDoc(docRef, {
        status: 'graded' as TaskStatus,
        score,
        teacherFeedback: feedback,
        gradedBy,
        gradedAt: serverTimestamp()
    });
}

// --- Utility Functions ---

export function isTaskOverdue(task: StudentTask): boolean {
    if (!task.dueDate) return false;

    const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    return new Date() > dueDate;
}

export function formatDueDate(dueDate: any): string {
    if (!dueDate) return '';

    const date = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return `באיחור של ${Math.abs(diffDays)} ימים`;
    } else if (diffDays === 0) {
        return 'היום';
    } else if (diffDays === 1) {
        return 'מחר';
    } else if (diffDays <= 7) {
        return `בעוד ${diffDays} ימים`;
    } else {
        return date.toLocaleDateString('he-IL', {
            day: 'numeric',
            month: 'short'
        });
    }
}

export function getTaskStatusColor(status: TaskStatus): string {
    switch (status) {
        case 'new': return 'bg-blue-100 text-blue-700';
        case 'in_progress': return 'bg-amber-100 text-amber-700';
        case 'submitted': return 'bg-purple-100 text-purple-700';
        case 'graded': return 'bg-green-100 text-green-700';
        case 'late': return 'bg-red-100 text-red-700';
        default: return 'bg-gray-100 text-gray-700';
    }
}

export function getTaskStatusLabel(status: TaskStatus): string {
    switch (status) {
        case 'new': return 'חדש';
        case 'in_progress': return 'בתהליך';
        case 'submitted': return 'הוגש';
        case 'graded': return 'נבדק';
        case 'late': return 'באיחור';
        default: return status;
    }
}
