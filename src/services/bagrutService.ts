/**
 * Bagrut Service
 *
 * Frontend service for Bagrut practice system.
 * Handles questions, practice modules, and student progress.
 */

import {
    collection,
    doc,
    addDoc,
    getDocs,
    getDoc,
    setDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    increment,
    updateDoc,
    Timestamp,
    writeBatch,
    DocumentReference
} from 'firebase/firestore';
import { db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import type {
    BagrutSubject,
    BagrutQuestion,
    BagrutQuestionType,
    BagrutDifficulty,
    BagrutPracticeModule,
    BagrutChapter,
    BagrutStudentProgress,
    BagrutChapterProgress,
    BagrutQuestionResponse,
    BagrutExamSimulation,
    BagrutPracticeSettings,
    getDefaultPracticeSettings,
    BAGRUT_SUBJECT_LABELS,
    BagrutAssignment,
    BagrutAssignmentProgress
} from '../shared/types/bagrutTypes';

// ============================================
// Constants
// ============================================

const BAGRUT_QUESTIONS_COLLECTION = 'bagrut_questions';
const BAGRUT_MODULES_COLLECTION = 'bagrut_modules';
const BAGRUT_PROGRESS_COLLECTION = 'bagrut_progress';
const BAGRUT_RESPONSES_COLLECTION = 'bagrut_responses';
const BAGRUT_SIMULATIONS_COLLECTION = 'bagrut_simulations';
const BAGRUT_ASSIGNMENTS_COLLECTION = 'bagrut_assignments';
const BAGRUT_ASSIGNMENT_PROGRESS_COLLECTION = 'bagrut_assignment_progress';

// ============================================
// Types for Filters
// ============================================

export interface BagrutQuestionFilters {
    subject?: BagrutSubject;
    chapter?: string;
    topic?: string;
    questionType?: BagrutQuestionType;
    difficulty?: BagrutDifficulty;
    minPoints?: number;
    maxPoints?: number;
    year?: number;
    reviewStatus?: 'draft' | 'reviewed' | 'approved';
}

export interface BagrutModuleFilters {
    subject?: BagrutSubject;
    isPublic?: boolean;
    teacherId?: string;
}

// ============================================
// BAGRUT QUESTIONS - CRUD
// ============================================

/**
 * Get questions with filters
 */
export async function getBagrutQuestions(
    filters: BagrutQuestionFilters = {},
    limitCount: number = 50
): Promise<BagrutQuestion[]> {
    let q = query(collection(db, BAGRUT_QUESTIONS_COLLECTION));

    if (filters.subject) {
        q = query(q, where('subject', '==', filters.subject));
    }
    if (filters.chapter) {
        q = query(q, where('chapter', '==', filters.chapter));
    }
    if (filters.questionType) {
        q = query(q, where('questionType', '==', filters.questionType));
    }
    if (filters.difficulty) {
        q = query(q, where('difficulty', '==', filters.difficulty));
    }
    if (filters.reviewStatus) {
        q = query(q, where('reviewStatus', '==', filters.reviewStatus));
    }

    const snapshot = await getDocs(query(q, limit(limitCount)));

    let questions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as BagrutQuestion[];

    // Client-side filtering for complex queries
    if (filters.topic) {
        const topicLower = filters.topic.toLowerCase();
        questions = questions.filter(q =>
            q.topic.toLowerCase().includes(topicLower)
        );
    }
    if (filters.minPoints) {
        questions = questions.filter(q => q.points >= filters.minPoints!);
    }
    if (filters.maxPoints) {
        questions = questions.filter(q => q.points <= filters.maxPoints!);
    }
    if (filters.year) {
        questions = questions.filter(q => q.year === filters.year);
    }

    return questions;
}

/**
 * Get a single question by ID
 */
export async function getBagrutQuestionById(questionId: string): Promise<BagrutQuestion | null> {
    const docSnap = await getDoc(doc(db, BAGRUT_QUESTIONS_COLLECTION, questionId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as BagrutQuestion;
}

/**
 * Get multiple questions by IDs
 */
export async function getBagrutQuestionsByIds(questionIds: string[]): Promise<BagrutQuestion[]> {
    const questions: BagrutQuestion[] = [];

    // Firestore doesn't support 'in' with more than 10 items, so batch
    const batches = [];
    for (let i = 0; i < questionIds.length; i += 10) {
        batches.push(questionIds.slice(i, i + 10));
    }

    for (const batch of batches) {
        const q = query(
            collection(db, BAGRUT_QUESTIONS_COLLECTION),
            where('__name__', 'in', batch)
        );
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => {
            questions.push({ id: doc.id, ...doc.data() } as BagrutQuestion);
        });
    }

    // Maintain order
    return questionIds
        .map(id => questions.find(q => q.id === id))
        .filter(Boolean) as BagrutQuestion[];
}

/**
 * Create a new question
 */
export async function createBagrutQuestion(
    question: Omit<BagrutQuestion, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>
): Promise<string> {
    const docRef = await addDoc(collection(db, BAGRUT_QUESTIONS_COLLECTION), {
        ...question,
        usageCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
}

/**
 * Update a question
 */
export async function updateBagrutQuestion(
    questionId: string,
    updates: Partial<BagrutQuestion>
): Promise<void> {
    await updateDoc(doc(db, BAGRUT_QUESTIONS_COLLECTION, questionId), {
        ...updates,
        updatedAt: serverTimestamp()
    });
}

/**
 * Get available chapters for a subject
 */
export async function getAvailableChapters(subject: BagrutSubject): Promise<string[]> {
    const questions = await getBagrutQuestions({ subject }, 500);
    const chapters = new Set(questions.map(q => q.chapter));
    return Array.from(chapters).sort();
}

/**
 * Get available topics for a chapter
 */
export async function getAvailableTopics(
    subject: BagrutSubject,
    chapter: string
): Promise<string[]> {
    const questions = await getBagrutQuestions({ subject, chapter }, 500);
    const topics = new Set(questions.map(q => q.topic));
    return Array.from(topics).sort();
}

// ============================================
// BAGRUT PRACTICE MODULES
// ============================================

/**
 * Get practice modules
 */
export async function getBagrutModules(
    filters: BagrutModuleFilters = {},
    limitCount: number = 20
): Promise<BagrutPracticeModule[]> {
    let q = query(collection(db, BAGRUT_MODULES_COLLECTION));

    if (filters.subject) {
        q = query(q, where('subject', '==', filters.subject));
    }
    if (filters.isPublic !== undefined) {
        q = query(q, where('isPublic', '==', filters.isPublic));
    }
    if (filters.teacherId) {
        q = query(q, where('teacherId', '==', filters.teacherId));
    }

    const snapshot = await getDocs(query(q, limit(limitCount)));
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as BagrutPracticeModule[];
}

/**
 * Get a module by ID
 */
export async function getBagrutModuleById(moduleId: string): Promise<BagrutPracticeModule | null> {
    const docSnap = await getDoc(doc(db, BAGRUT_MODULES_COLLECTION, moduleId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as BagrutPracticeModule;
}

/**
 * Create a practice module
 */
export async function createBagrutModule(
    module: Omit<BagrutPracticeModule, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
    const docRef = await addDoc(collection(db, BAGRUT_MODULES_COLLECTION), {
        ...module,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
}

/**
 * Update a practice module
 */
export async function updateBagrutModule(
    moduleId: string,
    updates: Partial<BagrutPracticeModule>
): Promise<void> {
    await updateDoc(doc(db, BAGRUT_MODULES_COLLECTION, moduleId), {
        ...updates,
        updatedAt: serverTimestamp()
    });
}

/**
 * Add questions to a chapter
 */
export async function addQuestionsToChapter(
    moduleId: string,
    chapterId: string,
    questionIds: string[]
): Promise<void> {
    const module = await getBagrutModuleById(moduleId);
    if (!module) throw new Error('Module not found');

    const chapterIndex = module.chapters.findIndex(c => c.id === chapterId);
    if (chapterIndex === -1) throw new Error('Chapter not found');

    const updatedChapters = [...module.chapters];
    const existingIds = new Set(updatedChapters[chapterIndex].questionIds);

    for (const qId of questionIds) {
        if (!existingIds.has(qId)) {
            updatedChapters[chapterIndex].questionIds.push(qId);
        }
    }
    updatedChapters[chapterIndex].totalQuestions = updatedChapters[chapterIndex].questionIds.length;

    await updateBagrutModule(moduleId, { chapters: updatedChapters });
}

// ============================================
// STUDENT PROGRESS
// ============================================

/**
 * Get or create student progress for a module
 */
export async function getOrCreateStudentProgress(
    studentId: string,
    moduleId: string
): Promise<BagrutStudentProgress> {
    const progressId = `${studentId}_${moduleId}`;
    const docRef = doc(db, BAGRUT_PROGRESS_COLLECTION, progressId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as BagrutStudentProgress;
    }

    // Create new progress
    const module = await getBagrutModuleById(moduleId);
    if (!module) throw new Error('Module not found');

    const chapterProgress: Record<string, BagrutChapterProgress> = {};
    for (const chapter of module.chapters) {
        chapterProgress[chapter.id] = {
            chapterId: chapter.id,
            status: 'not_started',
            questionsAttempted: 0,
            questionsCorrect: 0,
            bestScore: 0,
            attempts: 0
        };
    }

    const newProgress: Omit<BagrutStudentProgress, 'id'> = {
        studentId,
        moduleId,
        subject: module.subject,
        startedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
        totalQuestionsAttempted: 0,
        totalQuestionsCorrect: 0,
        averageScore: 0,
        totalTimeSeconds: 0,
        chapterProgress,
        weakTopics: [],
        strongTopics: []
    };

    await setDoc(docRef, newProgress);
    return { id: progressId, ...newProgress } as BagrutStudentProgress;
}

/**
 * Update student progress after answering a question
 */
export async function updateStudentProgress(
    studentId: string,
    moduleId: string,
    chapterId: string,
    isCorrect: boolean,
    score: number,
    maxScore: number,
    timeSpentSeconds: number
): Promise<void> {
    const progressId = `${studentId}_${moduleId}`;
    const docRef = doc(db, BAGRUT_PROGRESS_COLLECTION, progressId);

    const progress = await getOrCreateStudentProgress(studentId, moduleId);

    // Update chapter progress
    const chapterProgress = { ...progress.chapterProgress };
    if (chapterProgress[chapterId]) {
        chapterProgress[chapterId].questionsAttempted += 1;
        if (isCorrect) {
            chapterProgress[chapterId].questionsCorrect += 1;
        }
        chapterProgress[chapterId].status = 'in_progress';
        chapterProgress[chapterId].lastAttemptAt = serverTimestamp();

        const newScore = (score / maxScore) * 100;
        if (newScore > chapterProgress[chapterId].bestScore) {
            chapterProgress[chapterId].bestScore = newScore;
        }
    }

    // Calculate new average
    const newTotal = progress.totalQuestionsAttempted + 1;
    const newAverage = ((progress.averageScore * progress.totalQuestionsAttempted) + (score / maxScore) * 100) / newTotal;

    await updateDoc(docRef, {
        totalQuestionsAttempted: increment(1),
        totalQuestionsCorrect: isCorrect ? increment(1) : progress.totalQuestionsCorrect,
        averageScore: newAverage,
        totalTimeSeconds: increment(timeSpentSeconds),
        lastActivityAt: serverTimestamp(),
        chapterProgress
    });
}

/**
 * Get student progress for a subject
 */
export async function getStudentProgressBySubject(
    studentId: string,
    subject: BagrutSubject
): Promise<BagrutStudentProgress[]> {
    const q = query(
        collection(db, BAGRUT_PROGRESS_COLLECTION),
        where('studentId', '==', studentId),
        where('subject', '==', subject)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as BagrutStudentProgress[];
}

// ============================================
// QUESTION RESPONSES
// ============================================

/**
 * Submit a question response
 */
export async function submitQuestionResponse(
    response: Omit<BagrutQuestionResponse, 'id' | 'submittedAt'>
): Promise<string> {
    const docRef = await addDoc(collection(db, BAGRUT_RESPONSES_COLLECTION), {
        ...response,
        submittedAt: serverTimestamp()
    });

    // Update usage count
    await updateDoc(doc(db, BAGRUT_QUESTIONS_COLLECTION, response.questionId), {
        usageCount: increment(1)
    });

    // Update student progress
    await updateStudentProgress(
        response.studentId,
        response.moduleId,
        response.chapterId,
        response.isCorrect,
        response.score,
        response.maxScore,
        response.timeSpentSeconds
    );

    return docRef.id;
}

/**
 * Get student's responses for a chapter
 */
export async function getStudentResponsesForChapter(
    studentId: string,
    moduleId: string,
    chapterId: string
): Promise<BagrutQuestionResponse[]> {
    const q = query(
        collection(db, BAGRUT_RESPONSES_COLLECTION),
        where('studentId', '==', studentId),
        where('moduleId', '==', moduleId),
        where('chapterId', '==', chapterId),
        orderBy('submittedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as BagrutQuestionResponse[];
}

// ============================================
// EXAM SIMULATIONS
// ============================================

/**
 * Create an exam simulation
 */
export async function createExamSimulation(
    studentId: string,
    moduleId: string,
    questionIds: string[],
    timeLimit: number
): Promise<string> {
    const module = await getBagrutModuleById(moduleId);
    if (!module) throw new Error('Module not found');

    const simulation: Omit<BagrutExamSimulation, 'id'> = {
        studentId,
        moduleId,
        subject: module.subject,
        questionnaire: module.title,
        totalPoints: 100,
        timeLimit,
        questionIds,
        requiredQuestions: questionIds.length,
        status: 'not_started',
        responses: {}
    };

    const docRef = await addDoc(collection(db, BAGRUT_SIMULATIONS_COLLECTION), simulation);
    return docRef.id;
}

/**
 * Start an exam simulation
 */
export async function startExamSimulation(simulationId: string): Promise<void> {
    await updateDoc(doc(db, BAGRUT_SIMULATIONS_COLLECTION, simulationId), {
        status: 'in_progress',
        startedAt: serverTimestamp()
    });
}

/**
 * Submit exam simulation
 */
export async function submitExamSimulation(
    simulationId: string,
    responses: Record<string, BagrutQuestionResponse>
): Promise<void> {
    // Calculate total score
    let totalScore = 0;
    let maxPossible = 0;

    for (const response of Object.values(responses)) {
        totalScore += response.score;
        maxPossible += response.maxScore;
    }

    const percentage = maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0;

    await updateDoc(doc(db, BAGRUT_SIMULATIONS_COLLECTION, simulationId), {
        status: 'submitted',
        submittedAt: serverTimestamp(),
        responses,
        totalScore,
        percentage,
        passed: percentage >= 56
    });
}

/**
 * Get student's simulations
 */
export async function getStudentSimulations(
    studentId: string,
    subject?: BagrutSubject
): Promise<BagrutExamSimulation[]> {
    let q = query(
        collection(db, BAGRUT_SIMULATIONS_COLLECTION),
        where('studentId', '==', studentId),
        orderBy('startedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    let simulations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as BagrutExamSimulation[];

    if (subject) {
        simulations = simulations.filter(s => s.subject === subject);
    }

    return simulations;
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get question statistics
 */
export async function getQuestionStats(questionId: string): Promise<{
    usageCount: number;
    avgScore: number;
    avgTimeSeconds: number;
}> {
    const q = query(
        collection(db, BAGRUT_RESPONSES_COLLECTION),
        where('questionId', '==', questionId)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return { usageCount: 0, avgScore: 0, avgTimeSeconds: 0 };
    }

    let totalScore = 0;
    let totalTime = 0;
    let count = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        totalScore += (data.score / data.maxScore) * 100;
        totalTime += data.timeSpentSeconds || 0;
        count++;
    });

    return {
        usageCount: count,
        avgScore: Math.round(totalScore / count),
        avgTimeSeconds: Math.round(totalTime / count)
    };
}

/**
 * Get subject statistics for a student
 */
export async function getStudentSubjectStats(
    studentId: string,
    subject: BagrutSubject
): Promise<{
    totalQuestions: number;
    correctAnswers: number;
    averageScore: number;
    strongChapters: string[];
    weakChapters: string[];
    totalTimeHours: number;
}> {
    const progressList = await getStudentProgressBySubject(studentId, subject);

    let totalQuestions = 0;
    let correctAnswers = 0;
    let totalScore = 0;
    let totalTime = 0;
    const chapterScores: Record<string, number> = {};

    for (const progress of progressList) {
        totalQuestions += progress.totalQuestionsAttempted;
        correctAnswers += progress.totalQuestionsCorrect;
        totalScore += progress.averageScore * progress.totalQuestionsAttempted;
        totalTime += progress.totalTimeSeconds;

        for (const [chapterId, cp] of Object.entries(progress.chapterProgress)) {
            if (cp.questionsAttempted > 0) {
                chapterScores[chapterId] = cp.bestScore;
            }
        }
    }

    // Identify strong and weak chapters
    const sortedChapters = Object.entries(chapterScores)
        .sort((a, b) => b[1] - a[1]);

    const strongChapters = sortedChapters
        .filter(([, score]) => score >= 80)
        .map(([id]) => id);

    const weakChapters = sortedChapters
        .filter(([, score]) => score < 60)
        .map(([id]) => id);

    return {
        totalQuestions,
        correctAnswers,
        averageScore: totalQuestions > 0 ? Math.round(totalScore / totalQuestions) : 0,
        strongChapters,
        weakChapters,
        totalTimeHours: Math.round((totalTime / 3600) * 10) / 10
    };
}

// ============================================
// REAL-TIME SUBSCRIPTIONS
// ============================================

/**
 * Subscribe to student progress updates
 */
export function subscribeToStudentProgress(
    studentId: string,
    moduleId: string,
    callback: (progress: BagrutStudentProgress | null) => void
): () => void {
    const progressId = `${studentId}_${moduleId}`;
    return onSnapshot(
        doc(db, BAGRUT_PROGRESS_COLLECTION, progressId),
        (snapshot) => {
            if (snapshot.exists()) {
                callback({ id: snapshot.id, ...snapshot.data() } as BagrutStudentProgress);
            } else {
                callback(null);
            }
        }
    );
}

/**
 * Subscribe to exam simulation updates
 */
export function subscribeToExamSimulation(
    simulationId: string,
    callback: (simulation: BagrutExamSimulation | null) => void
): () => void {
    return onSnapshot(
        doc(db, BAGRUT_SIMULATIONS_COLLECTION, simulationId),
        (snapshot) => {
            if (snapshot.exists()) {
                callback({ id: snapshot.id, ...snapshot.data() } as BagrutExamSimulation);
            } else {
                callback(null);
            }
        }
    );
}

// ============================================
// HELPERS
// ============================================

/**
 * Get subject label in Hebrew
 */
export function getSubjectLabel(subject: BagrutSubject): string {
    return BAGRUT_SUBJECT_LABELS[subject];
}

/**
 * Calculate passing status
 */
export function isPassingScore(score: number): boolean {
    return score >= 56;
}

/**
 * Format score display
 */
export function formatScore(score: number, maxScore: number): string {
    const percentage = Math.round((score / maxScore) * 100);
    return `${score}/${maxScore} (${percentage}%)`;
}

// ============================================
// AI EVALUATION FOR OPEN QUESTIONS
// ============================================

export interface BagrutAIEvaluation {
    status: 'correct' | 'partial' | 'incorrect';
    score: number;        // 0-100
    feedback: string;     // Hebrew feedback
    keyPointsFound: string[];
    keyPointsMissing: string[];
}

/**
 * Evaluate an open-ended Bagrut answer using AI
 * Uses the existing checkOpenQuestionAnswer infrastructure
 */
export async function evaluateBagrutAnswer(
    question: string,
    studentAnswer: string,
    modelAnswer: string,
    sourceText: string,
    rubric?: string,
    maxPoints: number = 100
): Promise<BagrutAIEvaluation> {
    // Dynamically import to avoid circular dependencies
    const { checkOpenQuestionAnswer } = await import('./ai/geminiApi');

    try {
        // Use exam mode for strict Bagrut evaluation
        const result = await checkOpenQuestionAnswer(
            question,
            studentAnswer,
            modelAnswer,
            sourceText || '',
            'exam'  // Always use exam mode for Bagrut
        );

        // Map the result to BagrutAIEvaluation format
        let score: number;
        let status: 'correct' | 'partial' | 'incorrect';

        switch (result.status) {
            case 'correct':
                score = maxPoints;
                status = 'correct';
                break;
            case 'partial':
                score = Math.round(maxPoints * 0.5);  // 50% for partial
                status = 'partial';
                break;
            default:
                score = 0;
                status = 'incorrect';
        }

        return {
            status,
            score,
            feedback: result.feedback,
            keyPointsFound: [],     // Could be extracted from feedback in future
            keyPointsMissing: []    // Could be extracted from feedback in future
        };

    } catch (error) {
        console.error('Error evaluating Bagrut answer with AI:', error);
        // Return a graceful fallback
        return {
            status: 'partial',
            score: 0,
            feedback: 'לא הצלחנו להעריך את התשובה אוטומטית. נסה שוב או בקש הערכה עצמית.',
            keyPointsFound: [],
            keyPointsMissing: []
        };
    }
}

// ============================================
// TEACHER DASHBOARD DATA
// ============================================

/**
 * Get Bagrut progress for all students of a teacher
 * Used by teacher dashboard
 */
export async function getTeacherBagrutProgress(
    teacherId: string
): Promise<{
    students: Array<{
        studentId: string;
        studentName?: string;
        subjects: Record<BagrutSubject, {
            totalQuestions: number;
            correctAnswers: number;
            averageScore: number;
            weakTopics: string[];
        }>;
    }>;
    subjectStats: Record<BagrutSubject, {
        studentsCount: number;
        avgScore: number;
        commonWeakTopics: string[];
    }>;
}> {
    // Get all students from teacher's classes
    // For now, return progress from bagrut_progress collection
    const progressQuery = query(collection(db, BAGRUT_PROGRESS_COLLECTION));
    const snapshot = await getDocs(progressQuery);

    const studentMap: Record<string, any> = {};
    const subjectStats: Record<string, { scores: number[]; weakTopics: string[] }> = {};

    snapshot.docs.forEach(doc => {
        const data = doc.data() as BagrutStudentProgress;

        // Initialize student if not exists
        if (!studentMap[data.studentId]) {
            studentMap[data.studentId] = {
                studentId: data.studentId,
                subjects: {}
            };
        }

        // Add subject progress
        studentMap[data.studentId].subjects[data.subject] = {
            totalQuestions: data.totalQuestionsAttempted,
            correctAnswers: data.totalQuestionsCorrect,
            averageScore: data.averageScore,
            weakTopics: data.weakTopics
        };

        // Aggregate subject stats
        if (!subjectStats[data.subject]) {
            subjectStats[data.subject] = { scores: [], weakTopics: [] };
        }
        subjectStats[data.subject].scores.push(data.averageScore);
        subjectStats[data.subject].weakTopics.push(...data.weakTopics);
    });

    // Calculate subject averages
    const formattedSubjectStats: Record<BagrutSubject, {
        studentsCount: number;
        avgScore: number;
        commonWeakTopics: string[];
    }> = {} as any;

    for (const [subject, stats] of Object.entries(subjectStats)) {
        const avgScore = stats.scores.length > 0
            ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length)
            : 0;

        // Count topic occurrences to find common weak topics
        const topicCounts: Record<string, number> = {};
        stats.weakTopics.forEach(topic => {
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });

        const commonWeakTopics = Object.entries(topicCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([topic]) => topic);

        formattedSubjectStats[subject as BagrutSubject] = {
            studentsCount: stats.scores.length,
            avgScore,
            commonWeakTopics
        };
    }

    return {
        students: Object.values(studentMap),
        subjectStats: formattedSubjectStats
    };
}

// ============================================
// BAGRUT ASSIGNMENTS (משימות תרגול)
// ============================================

/**
 * Create a new Bagrut assignment
 */
export async function createBagrutAssignment(
    assignment: Omit<BagrutAssignment, 'id' | 'createdAt'>
): Promise<string> {
    const docRef = await addDoc(collection(db, BAGRUT_ASSIGNMENTS_COLLECTION), {
        ...assignment,
        createdAt: serverTimestamp()
    });
    return docRef.id;
}

/**
 * Get assignments created by a teacher
 */
export async function getTeacherAssignments(
    teacherId: string,
    activeOnly: boolean = true
): Promise<BagrutAssignment[]> {
    let q = query(
        collection(db, BAGRUT_ASSIGNMENTS_COLLECTION),
        where('teacherId', '==', teacherId),
        orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    let assignments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as BagrutAssignment[];

    if (activeOnly) {
        assignments = assignments.filter(a => a.isActive);
    }

    return assignments;
}

/**
 * Get assignments for a student
 */
export async function getStudentAssignments(
    studentId: string
): Promise<BagrutAssignment[]> {
    // Get assignments where student is directly assigned
    const directQuery = query(
        collection(db, BAGRUT_ASSIGNMENTS_COLLECTION),
        where('assigneeType', '==', 'students'),
        where('studentIds', 'array-contains', studentId),
        where('isActive', '==', true)
    );

    // Get assignments for all students
    const allQuery = query(
        collection(db, BAGRUT_ASSIGNMENTS_COLLECTION),
        where('assigneeType', '==', 'all'),
        where('isActive', '==', true)
    );

    const [directSnapshot, allSnapshot] = await Promise.all([
        getDocs(directQuery),
        getDocs(allQuery)
    ]);

    const assignments: BagrutAssignment[] = [];

    directSnapshot.docs.forEach(doc => {
        assignments.push({ id: doc.id, ...doc.data() } as BagrutAssignment);
    });

    allSnapshot.docs.forEach(doc => {
        // Avoid duplicates
        if (!assignments.find(a => a.id === doc.id)) {
            assignments.push({ id: doc.id, ...doc.data() } as BagrutAssignment);
        }
    });

    // Sort by due date
    return assignments.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.toMillis() - b.dueDate.toMillis();
    });
}

/**
 * Get assignment by ID
 */
export async function getBagrutAssignmentById(
    assignmentId: string
): Promise<BagrutAssignment | null> {
    const docSnap = await getDoc(doc(db, BAGRUT_ASSIGNMENTS_COLLECTION, assignmentId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as BagrutAssignment;
}

/**
 * Update assignment
 */
export async function updateBagrutAssignment(
    assignmentId: string,
    updates: Partial<BagrutAssignment>
): Promise<void> {
    await updateDoc(doc(db, BAGRUT_ASSIGNMENTS_COLLECTION, assignmentId), updates);
}

/**
 * Get or create assignment progress for a student
 */
export async function getOrCreateAssignmentProgress(
    assignmentId: string,
    studentId: string,
    studentName?: string
): Promise<BagrutAssignmentProgress> {
    const progressId = `${assignmentId}_${studentId}`;
    const docRef = doc(db, BAGRUT_ASSIGNMENT_PROGRESS_COLLECTION, progressId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as BagrutAssignmentProgress;
    }

    // Create new progress
    const newProgress: Omit<BagrutAssignmentProgress, 'id'> = {
        assignmentId,
        studentId,
        studentName,
        status: 'not_started',
        questionsAnswered: 0,
        questionsCorrect: 0,
        questionsPartial: 0,
        score: 0,
        passed: false,
        chapterScores: {},
        attempts: 0,
        bestScore: 0
    };

    await setDoc(docRef, newProgress);
    return { id: progressId, ...newProgress };
}

/**
 * Update assignment progress
 */
export async function updateAssignmentProgress(
    assignmentId: string,
    studentId: string,
    updates: {
        questionsAnswered?: number;
        questionsCorrect?: number;
        questionsPartial?: number;
        chapterId?: string;
        chapterScore?: number;
    }
): Promise<void> {
    const progressId = `${assignmentId}_${studentId}`;
    const docRef = doc(db, BAGRUT_ASSIGNMENT_PROGRESS_COLLECTION, progressId);

    const progress = await getOrCreateAssignmentProgress(assignmentId, studentId);

    // Update chapter scores if provided
    let chapterScores = { ...progress.chapterScores };
    if (updates.chapterId && updates.chapterScore !== undefined) {
        chapterScores[updates.chapterId] = {
            questionsAnswered: (chapterScores[updates.chapterId]?.questionsAnswered || 0) + 1,
            questionsCorrect: (chapterScores[updates.chapterId]?.questionsCorrect || 0) +
                (updates.questionsCorrect ? 1 : 0),
            score: updates.chapterScore
        };
    }

    // Calculate total score
    const totalAnswered = updates.questionsAnswered ?? progress.questionsAnswered;
    const totalCorrect = updates.questionsCorrect ?? progress.questionsCorrect;
    const totalPartial = updates.questionsPartial ?? progress.questionsPartial;

    const score = totalAnswered > 0
        ? Math.round(((totalCorrect + totalPartial * 0.5) / totalAnswered) * 100)
        : 0;

    const updateData: any = {
        status: 'in_progress',
        questionsAnswered: totalAnswered,
        questionsCorrect: totalCorrect,
        questionsPartial: totalPartial,
        score,
        chapterScores,
        passed: score >= 56
    };

    // Update best score
    if (score > progress.bestScore) {
        updateData.bestScore = score;
    }

    await updateDoc(docRef, updateData);
}

/**
 * Complete an assignment
 */
export async function completeAssignment(
    assignmentId: string,
    studentId: string
): Promise<void> {
    const progressId = `${assignmentId}_${studentId}`;
    const docRef = doc(db, BAGRUT_ASSIGNMENT_PROGRESS_COLLECTION, progressId);

    await updateDoc(docRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
        attempts: increment(1)
    });
}

/**
 * Get all progress for an assignment (teacher view)
 */
export async function getAssignmentAllProgress(
    assignmentId: string
): Promise<BagrutAssignmentProgress[]> {
    const q = query(
        collection(db, BAGRUT_ASSIGNMENT_PROGRESS_COLLECTION),
        where('assignmentId', '==', assignmentId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as BagrutAssignmentProgress[];
}

/**
 * Get assignment stats for teacher dashboard
 */
export async function getAssignmentStats(
    assignmentId: string
): Promise<{
    totalStudents: number;
    started: number;
    completed: number;
    avgScore: number;
    passRate: number;
}> {
    const progress = await getAssignmentAllProgress(assignmentId);

    const started = progress.filter(p => p.status !== 'not_started').length;
    const completed = progress.filter(p => p.status === 'completed').length;
    const passed = progress.filter(p => p.passed).length;

    const scores = progress
        .filter(p => p.status === 'completed')
        .map(p => p.score);

    const avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

    return {
        totalStudents: progress.length,
        started,
        completed,
        avgScore,
        passRate: completed > 0 ? Math.round((passed / completed) * 100) : 0
    };
}
