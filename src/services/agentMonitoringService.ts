/**
 * Agent Monitoring Service
 *
 * Service for tracking and monitoring the Curriculum Agent's activity,
 * including generation requests, activities created, and quality metrics.
 */

import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    onSnapshot,
    Timestamp,
    getCountFromServer
} from 'firebase/firestore';
import { db } from '../firebase';

// Types
export interface GenerationRequest {
    id: string;
    userId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    subject: 'hebrew' | 'science';
    gradeLevel: 'ה' | 'ו';
    topic?: string;
    activityCount: number;
    bloomLevels: string[];
    activityTypes?: string[];
    result?: {
        activitiesCreated: number;
        activityIds: string[];
        qualityScores: number[];
        errors?: string[];
    };
    error?: string;
    createdAt: Timestamp;
    startedAt?: Timestamp;
    completedAt?: Timestamp;
}

export interface AgentActivity {
    id: string;
    subject: 'hebrew' | 'science';
    gradeLevel: 'ה' | 'ו';
    topic: string;
    activityType: string;
    bloomLevel: string;
    qualityScore: number;
    reviewStatus: 'auto_approved' | 'pending_review' | 'approved' | 'rejected';
    usageCount: number;
    averageRating: number;
    createdAt: Timestamp;
}

export interface AgentStats {
    totalActivities: number;
    activitiesBySubject: {
        hebrew: number;
        science: number;
    };
    activitiesByGrade: {
        'ה': number;
        'ו': number;
    };
    averageQualityScore: number;
    qualityDistribution: {
        excellent: number;  // 80+
        good: number;       // 70-79
        fair: number;       // 60-69
    };
    totalRequests: number;
    completedRequests: number;
    failedRequests: number;
    pendingRequests: number;
}

export interface CurriculumStandard {
    id: string;
    subject: 'hebrew' | 'science';
    gradeLevel: 'ה' | 'ו';
    domain: string;
    topic: string;
    title: string;
    description: string;
    learningObjectives: string[];
}

// ============================================
// Generation Requests
// ============================================

/**
 * Get all generation requests (for admin)
 */
export async function getAllGenerationRequests(limitCount: number = 50): Promise<GenerationRequest[]> {
    const q = query(
        collection(db, 'activity_generation_queue'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as GenerationRequest));
}

/**
 * Get requests by status
 */
export async function getRequestsByStatus(status: GenerationRequest['status']): Promise<GenerationRequest[]> {
    const q = query(
        collection(db, 'activity_generation_queue'),
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
        limit(100)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as GenerationRequest));
}

/**
 * Subscribe to real-time generation requests updates
 */
export function subscribeToGenerationRequests(
    callback: (requests: GenerationRequest[]) => void,
    limitCount: number = 20
): () => void {
    const q = query(
        collection(db, 'activity_generation_queue'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
    );

    return onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as GenerationRequest));
        callback(requests);
    });
}

// ============================================
// Activities
// ============================================

/**
 * Get all activities from the bank (for admin)
 */
export async function getAllActivities(limitCount: number = 100): Promise<AgentActivity[]> {
    const q = query(
        collection(db, 'activity_bank'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as AgentActivity));
}

/**
 * Get activities by review status
 */
export async function getActivitiesByReviewStatus(
    status: AgentActivity['reviewStatus']
): Promise<AgentActivity[]> {
    const q = query(
        collection(db, 'activity_bank'),
        where('reviewStatus', '==', status),
        orderBy('createdAt', 'desc'),
        limit(100)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as AgentActivity));
}

/**
 * Subscribe to real-time activities updates
 */
export function subscribeToActivities(
    callback: (activities: AgentActivity[]) => void,
    limitCount: number = 50
): () => void {
    const q = query(
        collection(db, 'activity_bank'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
    );

    return onSnapshot(q, (snapshot) => {
        const activities = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AgentActivity));
        callback(activities);
    });
}

// ============================================
// Statistics
// ============================================

/**
 * Get agent statistics
 */
export async function getAgentStats(): Promise<AgentStats> {
    // Get all activities
    const activitiesSnapshot = await getDocs(collection(db, 'activity_bank'));
    const activities = activitiesSnapshot.docs.map(doc => doc.data() as AgentActivity);

    // Get all requests
    const requestsSnapshot = await getDocs(collection(db, 'activity_generation_queue'));
    const requests = requestsSnapshot.docs.map(doc => doc.data() as GenerationRequest);

    // Calculate statistics
    const stats: AgentStats = {
        totalActivities: activities.length,
        activitiesBySubject: {
            hebrew: activities.filter(a => a.subject === 'hebrew').length,
            science: activities.filter(a => a.subject === 'science').length
        },
        activitiesByGrade: {
            'ה': activities.filter(a => a.gradeLevel === 'ה').length,
            'ו': activities.filter(a => a.gradeLevel === 'ו').length
        },
        averageQualityScore: activities.length > 0
            ? activities.reduce((sum, a) => sum + (a.qualityScore || 0), 0) / activities.length
            : 0,
        qualityDistribution: {
            excellent: activities.filter(a => a.qualityScore >= 80).length,
            good: activities.filter(a => a.qualityScore >= 70 && a.qualityScore < 80).length,
            fair: activities.filter(a => a.qualityScore >= 60 && a.qualityScore < 70).length
        },
        totalRequests: requests.length,
        completedRequests: requests.filter(r => r.status === 'completed').length,
        failedRequests: requests.filter(r => r.status === 'failed').length,
        pendingRequests: requests.filter(r => r.status === 'pending' || r.status === 'processing').length
    };

    return stats;
}

// ============================================
// Curriculum Standards
// ============================================

/**
 * Get all curriculum standards
 */
export async function getCurriculumStandards(): Promise<CurriculumStandard[]> {
    console.log('📚 Fetching curriculum standards...');
    try {
        const snapshot = await getDocs(collection(db, 'curriculum_standards'));
        console.log(`📚 Found ${snapshot.size} curriculum standards`);
        const standards = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as CurriculumStandard));
        return standards;
    } catch (error) {
        console.error('❌ Error fetching curriculum standards:', error);
        throw error;
    }
}

/**
 * Get standards by subject
 */
export async function getStandardsBySubject(subject: 'hebrew' | 'science'): Promise<CurriculumStandard[]> {
    const q = query(
        collection(db, 'curriculum_standards'),
        where('subject', '==', subject)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as CurriculumStandard));
}
