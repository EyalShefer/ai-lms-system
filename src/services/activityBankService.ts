/**
 * Activity Bank Service
 *
 * Frontend service for interacting with the Activity Bank.
 * Provides browsing, searching, rating, and activity generation features.
 */

import {
    collection,
    doc,
    addDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    increment,
    updateDoc,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import type { ActivityBlock, BloomLevel, ActivityBlockType } from '../shared/types/courseTypes';

// ============================================
// Types
// ============================================

export type ActivitySubject = 'hebrew' | 'science';
export type GradeLevel = 'ה' | 'ו';
export type ReviewStatus = 'auto_approved' | 'pending_review' | 'approved' | 'rejected';
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BankActivity {
    id: string;
    version: number;
    subject: ActivitySubject;
    gradeLevel: GradeLevel;
    topic: string;
    subtopic?: string;
    curriculumStandardId: string;
    activityType: ActivityBlockType;
    content: any;
    metadata: any;
    bloomLevel: BloomLevel;
    learningObjectives: string[];
    qualityScore: number;
    guardianResult: any;
    reviewStatus: ReviewStatus;
    generatedBy: 'claude_agent' | 'manual';
    usageCount: number;
    averageRating: number;
    ratingCount: number;
    copiedToCoursesCount: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    tags: string[];
    searchKeywords: string[];
    isFeatured: boolean;
}

export interface CurriculumStandard {
    id: string;
    subject: ActivitySubject;
    gradeLevel: GradeLevel;
    domain: string;
    topic: string;
    title: string;
    description: string;
    learningObjectives: string[];
    recommendedActivityTypes: ActivityBlockType[];
    recommendedBloomLevels: BloomLevel[];
}

export interface ActivityGenerationRequest {
    id: string;
    userId: string;
    status: GenerationStatus;
    subject: ActivitySubject;
    gradeLevel: GradeLevel;
    topic?: string;
    activityCount: number;
    bloomLevels: BloomLevel[];
    activityTypes?: ActivityBlockType[];
    result?: {
        activitiesCreated: number;
        activityIds: string[];
        qualityScores: number[];
        errors?: string[];
        totalTimeMs: number;
    };
    createdAt: Timestamp;
    startedAt?: Timestamp;
    completedAt?: Timestamp;
    error?: string;
}

export interface ActivityRating {
    id: string;
    activityId: string;
    userId: string;
    userName: string;
    rating: number;
    comment?: string;
    createdAt: Timestamp;
}

export interface ActivityFilters {
    subject?: ActivitySubject;
    gradeLevel?: GradeLevel;
    bloomLevel?: BloomLevel;
    activityType?: ActivityBlockType;
    topic?: string;
    minQuality?: number;
    isFeatured?: boolean;
}

// ============================================
// Constants
// ============================================

const ACTIVITY_BANK_COLLECTION = 'activity_bank';
const CURRICULUM_STANDARDS_COLLECTION = 'curriculum_standards';
const ACTIVITY_QUEUE_COLLECTION = 'activity_generation_queue';
const ACTIVITY_RATINGS_COLLECTION = 'activity_ratings';

// ============================================
// Activity Bank - Browsing
// ============================================

/**
 * Get activities from the bank with optional filters
 */
export async function getActivities(
    filters: ActivityFilters = {},
    limitCount: number = 20
): Promise<BankActivity[]> {
    let q = query(
        collection(db, ACTIVITY_BANK_COLLECTION),
        where('reviewStatus', 'in', ['auto_approved', 'approved'])
    );

    if (filters.subject) {
        q = query(q, where('subject', '==', filters.subject));
    }
    if (filters.gradeLevel) {
        q = query(q, where('gradeLevel', '==', filters.gradeLevel));
    }
    if (filters.bloomLevel) {
        q = query(q, where('bloomLevel', '==', filters.bloomLevel));
    }
    if (filters.activityType) {
        q = query(q, where('activityType', '==', filters.activityType));
    }
    if (filters.isFeatured) {
        q = query(q, where('isFeatured', '==', true));
    }

    const snapshot = await getDocs(query(q, orderBy('qualityScore', 'desc'), limit(limitCount)));

    let activities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as BankActivity[];

    // Client-side filtering for complex queries
    if (filters.topic) {
        const topicLower = filters.topic.toLowerCase();
        activities = activities.filter(a =>
            a.topic.toLowerCase().includes(topicLower) ||
            a.searchKeywords.some(k => k.includes(topicLower))
        );
    }

    if (filters.minQuality) {
        activities = activities.filter(a => a.qualityScore >= filters.minQuality!);
    }

    return activities;
}

/**
 * Get a single activity by ID
 */
export async function getActivityById(activityId: string): Promise<BankActivity | null> {
    const docSnap = await getDoc(doc(db, ACTIVITY_BANK_COLLECTION, activityId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as BankActivity;
}

/**
 * Get featured activities for a subject and grade
 */
export async function getFeaturedActivities(
    subject: ActivitySubject,
    gradeLevel: GradeLevel,
    limitCount: number = 5
): Promise<BankActivity[]> {
    const q = query(
        collection(db, ACTIVITY_BANK_COLLECTION),
        where('subject', '==', subject),
        where('gradeLevel', '==', gradeLevel),
        where('isFeatured', '==', true),
        where('reviewStatus', 'in', ['auto_approved', 'approved']),
        limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BankActivity[];
}

/**
 * Get top-rated activities
 */
export async function getTopRatedActivities(
    subject?: ActivitySubject,
    gradeLevel?: GradeLevel,
    limitCount: number = 10
): Promise<BankActivity[]> {
    let q = query(
        collection(db, ACTIVITY_BANK_COLLECTION),
        where('reviewStatus', 'in', ['auto_approved', 'approved'])
    );

    if (subject) {
        q = query(q, where('subject', '==', subject));
    }
    if (gradeLevel) {
        q = query(q, where('gradeLevel', '==', gradeLevel));
    }

    const snapshot = await getDocs(q);
    const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BankActivity[];

    // Sort by average rating client-side
    return activities
        .filter(a => a.ratingCount > 0)
        .sort((a, b) => b.averageRating - a.averageRating)
        .slice(0, limitCount);
}

/**
 * Get most used activities
 */
export async function getMostUsedActivities(
    subject?: ActivitySubject,
    gradeLevel?: GradeLevel,
    limitCount: number = 10
): Promise<BankActivity[]> {
    let q = query(
        collection(db, ACTIVITY_BANK_COLLECTION),
        where('reviewStatus', 'in', ['auto_approved', 'approved'])
    );

    if (subject) {
        q = query(q, where('subject', '==', subject));
    }
    if (gradeLevel) {
        q = query(q, where('gradeLevel', '==', gradeLevel));
    }

    const snapshot = await getDocs(q);
    const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BankActivity[];

    return activities
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, limitCount);
}

/**
 * Search activities by keyword
 */
export async function searchActivities(
    searchTerm: string,
    filters: ActivityFilters = {},
    limitCount: number = 20
): Promise<BankActivity[]> {
    const activities = await getActivities(filters, 100);
    const lowerSearch = searchTerm.toLowerCase();

    return activities
        .filter(a =>
            a.topic.toLowerCase().includes(lowerSearch) ||
            a.searchKeywords.some(k => k.includes(lowerSearch)) ||
            a.tags.some(t => t.toLowerCase().includes(lowerSearch))
        )
        .slice(0, limitCount);
}

// ============================================
// Curriculum Standards
// ============================================

/**
 * Get curriculum standards for filtering/display
 */
export async function getCurriculumStandards(
    subject?: ActivitySubject,
    gradeLevel?: GradeLevel
): Promise<CurriculumStandard[]> {
    let q = query(collection(db, CURRICULUM_STANDARDS_COLLECTION));

    if (subject) {
        q = query(q, where('subject', '==', subject));
    }
    if (gradeLevel) {
        q = query(q, where('gradeLevel', '==', gradeLevel));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CurriculumStandard[];
}

/**
 * Get unique topics from curriculum standards
 */
export async function getAvailableTopics(
    subject: ActivitySubject,
    gradeLevel: GradeLevel
): Promise<string[]> {
    const standards = await getCurriculumStandards(subject, gradeLevel);
    const topics = new Set(standards.map(s => s.topic));
    return Array.from(topics).sort();
}

// ============================================
// Usage Tracking
// ============================================

/**
 * Track when an activity is viewed/used
 */
export async function trackActivityUsage(activityId: string): Promise<void> {
    await updateDoc(doc(db, ACTIVITY_BANK_COLLECTION, activityId), {
        usageCount: increment(1)
    });
}

/**
 * Track when an activity is copied to a course
 */
export async function trackActivityCopied(activityId: string): Promise<void> {
    await updateDoc(doc(db, ACTIVITY_BANK_COLLECTION, activityId), {
        copiedToCoursesCount: increment(1)
    });
}

// ============================================
// Ratings
// ============================================

/**
 * Rate an activity
 */
export async function rateActivity(
    activityId: string,
    userId: string,
    userName: string,
    rating: number,
    comment?: string
): Promise<void> {
    if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
    }

    // Check for existing rating
    const existingQ = query(
        collection(db, ACTIVITY_RATINGS_COLLECTION),
        where('activityId', '==', activityId),
        where('userId', '==', userId)
    );
    const existing = await getDocs(existingQ);

    const activityRef = doc(db, ACTIVITY_BANK_COLLECTION, activityId);
    const activity = await getActivityById(activityId);
    if (!activity) throw new Error('Activity not found');

    const batch = writeBatch(db);

    if (!existing.empty) {
        // Update existing rating
        const oldRating = existing.docs[0].data().rating;
        const ratingRef = doc(db, ACTIVITY_RATINGS_COLLECTION, existing.docs[0].id);

        batch.update(ratingRef, {
            rating,
            comment: comment || null,
            updatedAt: serverTimestamp()
        });

        // Update activity average
        const newTotal = (activity.averageRating * activity.ratingCount) - oldRating + rating;
        batch.update(activityRef, {
            averageRating: newTotal / activity.ratingCount
        });
    } else {
        // Create new rating
        const newRatingRef = doc(collection(db, ACTIVITY_RATINGS_COLLECTION));
        batch.set(newRatingRef, {
            activityId,
            userId,
            userName,
            rating,
            comment: comment || null,
            createdAt: serverTimestamp()
        });

        // Update activity stats
        const newCount = activity.ratingCount + 1;
        const newAverage = ((activity.averageRating * activity.ratingCount) + rating) / newCount;
        batch.update(activityRef, {
            averageRating: newAverage,
            ratingCount: newCount
        });
    }

    await batch.commit();
}

/**
 * Get user's rating for an activity
 */
export async function getUserRatingForActivity(
    activityId: string,
    userId: string
): Promise<ActivityRating | null> {
    const q = query(
        collection(db, ACTIVITY_RATINGS_COLLECTION),
        where('activityId', '==', activityId),
        where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ActivityRating;
}

/**
 * Get all ratings for an activity
 */
export async function getActivityRatings(activityId: string): Promise<ActivityRating[]> {
    const q = query(
        collection(db, ACTIVITY_RATINGS_COLLECTION),
        where('activityId', '==', activityId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ActivityRating[];
}

// ============================================
// Activity Generation
// ============================================

/**
 * Request autonomous activity generation
 */
export async function requestActivityGeneration(
    userId: string,
    params: {
        subject: ActivitySubject;
        gradeLevel: GradeLevel;
        topic?: string;
        activityCount: number;
        bloomLevels: BloomLevel[];
        activityTypes?: ActivityBlockType[];
    }
): Promise<string> {
    if (params.activityCount < 1 || params.activityCount > 10) {
        throw new Error('Activity count must be between 1 and 10');
    }

    // Build request data, excluding undefined values (Firestore doesn't accept undefined)
    const requestData: Record<string, any> = {
        userId,
        status: 'pending',
        subject: params.subject,
        gradeLevel: params.gradeLevel,
        activityCount: params.activityCount,
        bloomLevels: params.bloomLevels,
        createdAt: serverTimestamp()
    };

    // Only add optional fields if they have values
    if (params.topic) {
        requestData.topic = params.topic;
    }
    if (params.activityTypes && params.activityTypes.length > 0) {
        requestData.activityTypes = params.activityTypes;
    }

    const docRef = await addDoc(collection(db, ACTIVITY_QUEUE_COLLECTION), requestData);

    return docRef.id;
}

/**
 * Subscribe to generation status updates
 */
export function subscribeToGenerationStatus(
    requestId: string,
    callback: (status: ActivityGenerationRequest) => void
): () => void {
    return onSnapshot(
        doc(db, ACTIVITY_QUEUE_COLLECTION, requestId),
        (snapshot) => {
            if (snapshot.exists()) {
                callback({ id: snapshot.id, ...snapshot.data() } as ActivityGenerationRequest);
            }
        }
    );
}

/**
 * Get generation request by ID
 */
export async function getGenerationRequest(requestId: string): Promise<ActivityGenerationRequest | null> {
    const docSnap = await getDoc(doc(db, ACTIVITY_QUEUE_COLLECTION, requestId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as ActivityGenerationRequest;
}

/**
 * Get user's generation history
 */
export async function getUserGenerationHistory(
    userId: string,
    limitCount: number = 10
): Promise<ActivityGenerationRequest[]> {
    const q = query(
        collection(db, ACTIVITY_QUEUE_COLLECTION),
        where('userId', '==', userId),
        limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as ActivityGenerationRequest[];

    // Sort by createdAt descending
    return requests.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
    });
}

// ============================================
// Copy Activity to Course
// ============================================

/**
 * Convert a bank activity to an ActivityBlock for use in courses
 */
export function convertBankActivityToBlock(activity: BankActivity): ActivityBlock {
    return {
        id: uuidv4(), // New ID for the course copy
        type: activity.activityType,
        content: activity.content,
        metadata: {
            ...activity.metadata,
            sourceActivityId: activity.id, // Reference to original
            copiedFromBank: true,
            bankActivityVersion: activity.version
        }
    } as ActivityBlock;
}

/**
 * Copy multiple activities to blocks
 */
export async function copyActivitiesToBlocks(
    activityIds: string[]
): Promise<{ blocks: ActivityBlock[]; failed: string[] }> {
    const blocks: ActivityBlock[] = [];
    const failed: string[] = [];

    for (const activityId of activityIds) {
        const activity = await getActivityById(activityId);
        if (activity) {
            blocks.push(convertBankActivityToBlock(activity));
            await trackActivityCopied(activityId);
        } else {
            failed.push(activityId);
        }
    }

    return { blocks, failed };
}

// ============================================
// Real-time Subscriptions
// ============================================

/**
 * Subscribe to activity bank updates
 */
export function subscribeToActivities(
    filters: ActivityFilters,
    callback: (activities: BankActivity[]) => void
): () => void {
    let q = query(
        collection(db, ACTIVITY_BANK_COLLECTION),
        where('reviewStatus', 'in', ['auto_approved', 'approved'])
    );

    if (filters.subject) {
        q = query(q, where('subject', '==', filters.subject));
    }
    if (filters.gradeLevel) {
        q = query(q, where('gradeLevel', '==', filters.gradeLevel));
    }

    return onSnapshot(q, (snapshot) => {
        let activities = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as BankActivity[];

        // Apply additional filters client-side
        if (filters.bloomLevel) {
            activities = activities.filter(a => a.bloomLevel === filters.bloomLevel);
        }
        if (filters.activityType) {
            activities = activities.filter(a => a.activityType === filters.activityType);
        }

        // Sort by quality score
        activities.sort((a, b) => b.qualityScore - a.qualityScore);

        callback(activities);
    });
}

// ============================================
// Statistics
// ============================================

/**
 * Get activity bank statistics
 */
export async function getActivityBankStats(
    subject?: ActivitySubject,
    gradeLevel?: GradeLevel
): Promise<{
    totalActivities: number;
    averageQuality: number;
    byBloomLevel: Record<string, number>;
    byActivityType: Record<string, number>;
}> {
    const activities = await getActivities({ subject, gradeLevel }, 1000);

    const byBloomLevel: Record<string, number> = {};
    const byActivityType: Record<string, number> = {};
    let totalQuality = 0;

    for (const activity of activities) {
        totalQuality += activity.qualityScore;

        byBloomLevel[activity.bloomLevel] = (byBloomLevel[activity.bloomLevel] || 0) + 1;
        byActivityType[activity.activityType] = (byActivityType[activity.activityType] || 0) + 1;
    }

    return {
        totalActivities: activities.length,
        averageQuality: activities.length > 0 ? Math.round(totalQuality / activities.length) : 0,
        byBloomLevel,
        byActivityType
    };
}
