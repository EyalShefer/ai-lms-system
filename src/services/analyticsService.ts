/**
 * Analytics Service - Real Firestore Integration
 *
 * Provides student analytics data from actual Firestore collections:
 * - Profile data (performance, behavioral metrics)
 * - Proficiency vectors (topic mastery)
 * - Session history (journey trace)
 * - Error fingerprints (mistake patterns)
 */

import { db } from '../firebase';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    orderBy,
    limit
} from 'firebase/firestore';

export interface StudentAnalytics {
    id: string;
    name: string;
    avatar: string;
    email?: string;
    mastery: Record<string, number>; // Topic -> 0.0-1.0
    lastActive: string;
    riskLevel: 'low' | 'medium' | 'high';
    journey: JourneyNode[];
    performance?: {
        accuracy: number;
        avgResponseTime: number;
        totalQuestions: number;
        hintDependency: number;
    };
    errorPatterns?: Record<string, number>;
}

export interface JourneyNode {
    id: string;
    type: 'question' | 'content' | 'remediation' | 'challenge' | 'skipped';
    status: 'success' | 'failure' | 'skipped' | 'viewed';
    timestamp: number;
    blockId?: string;
    blockType?: string;
    variantUsed?: 'original' | 'scaffolding' | 'enrichment';
    metadata?: any;
    connection?: 'direct' | 'branched';
}

/**
 * Calculate risk level based on performance metrics
 */
const calculateRiskLevel = (
    accuracy: number,
    hintDependency: number,
    avgMastery: number
): 'low' | 'medium' | 'high' => {
    // High risk: low accuracy OR high hint dependency OR low mastery
    if (accuracy < 0.4 || hintDependency > 0.7 || avgMastery < 0.3) {
        return 'high';
    }
    // Medium risk: moderate performance
    if (accuracy < 0.7 || hintDependency > 0.4 || avgMastery < 0.6) {
        return 'medium';
    }
    // Low risk: good performance
    return 'low';
};

/**
 * Convert session interactions to journey nodes
 */
const sessionsToJourney = (sessions: any[]): JourneyNode[] => {
    const nodes: JourneyNode[] = [];

    sessions.forEach(session => {
        if (!session.interactions) return;

        session.interactions.forEach((interaction: any) => {
            // Determine node type
            let nodeType: JourneyNode['type'] = 'question';
            if (interaction.type === 'text' || interaction.type === 'video' || interaction.type === 'pdf') {
                nodeType = 'content';
            } else if (interaction.isRemediation) {
                nodeType = 'remediation';
            } else if (interaction.wasSkipped) {
                nodeType = 'skipped';
            }

            // Determine status
            let status: JourneyNode['status'] = 'viewed';
            if (interaction.isCorrect === true) {
                status = 'success';
            } else if (interaction.isCorrect === false) {
                status = 'failure';
            } else if (interaction.wasSkipped) {
                status = 'skipped';
            }

            nodes.push({
                id: interaction.questionId || `node-${nodes.length}`,
                type: nodeType,
                status,
                timestamp: interaction.timestamp || session.startTime,
                blockId: interaction.questionId,
                blockType: interaction.type,
                variantUsed: interaction.variantUsed,
                connection: interaction.isRemediation ? 'branched' : 'direct',
                metadata: {
                    responseTime: interaction.responseTime,
                    hintsUsed: interaction.hintsUsed,
                    attemptCount: interaction.attemptCount
                }
            });
        });
    });

    // Sort by timestamp
    return nodes.sort((a, b) => a.timestamp - b.timestamp);
};

/**
 * Get analytics for all students enrolled in a course
 */
export const getCourseAnalytics = async (courseId: string): Promise<StudentAnalytics[]> => {
    try {
        // 1. Get all enrollments for this course
        const enrollmentsRef = collection(db, 'enrollments');
        const enrollmentsQuery = query(
            enrollmentsRef,
            where('courseId', '==', courseId)
        );
        const enrollmentsSnap = await getDocs(enrollmentsQuery);

        if (enrollmentsSnap.empty) {
            console.log(`No enrollments found for course ${courseId}`);
            return [];
        }

        const studentIds = enrollmentsSnap.docs.map(doc => doc.data().studentId);

        // 2. Fetch data for each student in parallel
        const analyticsPromises = studentIds.map(studentId => getStudentAnalytics(studentId, courseId));
        const results = await Promise.all(analyticsPromises);

        // Filter out null results
        return results.filter((r): r is StudentAnalytics => r !== null);

    } catch (error) {
        console.error('Error fetching course analytics:', error);
        // Fallback to empty array (or could use mock data for dev)
        return [];
    }
};

/**
 * Get detailed analytics for a single student
 */
export const getStudentAnalytics = async (
    studentId: string,
    courseId?: string
): Promise<StudentAnalytics | null> => {
    try {
        // 1. Get user basic info
        const userRef = doc(db, 'users', studentId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            console.warn(`User ${studentId} not found`);
            return null;
        }

        const userData = userSnap.data();

        // 2. Get profile stats
        const statsRef = doc(db, 'users', studentId, 'profile', 'stats');
        const statsSnap = await getDoc(statsRef);
        const stats = statsSnap.exists() ? statsSnap.data() : null;

        // 3. Get proficiency vector
        const proficiencyRef = doc(db, 'users', studentId, 'profile', 'proficiency_vector');
        const proficiencySnap = await getDoc(proficiencyRef);
        const proficiency = proficiencySnap.exists() ? proficiencySnap.data() : null;

        // 4. Get error fingerprint
        const errorRef = doc(db, 'users', studentId, 'profile', 'error_fingerprint');
        const errorSnap = await getDoc(errorRef);
        const errorFingerprint = errorSnap.exists() ? errorSnap.data() : null;

        // 5. Get recent sessions (for journey trace)
        const sessionsRef = collection(db, 'users', studentId, 'sessions');
        let sessionsQuery = query(sessionsRef, orderBy('startTime', 'desc'), limit(20));

        // If courseId provided, filter by it
        if (courseId) {
            sessionsQuery = query(
                sessionsRef,
                where('courseId', '==', courseId),
                orderBy('startTime', 'desc'),
                limit(20)
            );
        }

        const sessionsSnap = await getDocs(sessionsQuery);
        const sessions = sessionsSnap.docs.map(doc => doc.data());

        // 6. Calculate derived metrics
        const mastery = proficiency?.topics || {};
        const avgMastery = Object.values(mastery).length > 0
            ? Object.values(mastery as Record<string, number>).reduce((a, b) => a + b, 0) / Object.values(mastery).length
            : 0.5;

        const accuracy = stats?.performance?.global_accuracy_rate || 0.5;
        const hintDependency = stats?.behavioral?.hint_dependency_score || 0;

        const riskLevel = calculateRiskLevel(accuracy, hintDependency, avgMastery);

        // 7. Build journey from sessions
        const journey = sessionsToJourney(sessions);

        // 8. Construct analytics object
        return {
            id: studentId,
            name: userData.displayName || userData.name || 'תלמיד',
            email: userData.email,
            avatar: userData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentId}`,
            mastery: mastery as Record<string, number>,
            lastActive: stats?.engagement?.last_active_at?.toDate?.()?.toISOString() ||
                userData.lastLogin?.toDate?.()?.toISOString() ||
                new Date().toISOString(),
            riskLevel,
            journey,
            performance: {
                accuracy,
                avgResponseTime: stats?.performance?.average_response_time_sec || 0,
                totalQuestions: stats?.performance?.total_questions_attempted || 0,
                hintDependency
            },
            errorPatterns: errorFingerprint?.errorTags || {}
        };

    } catch (error) {
        console.error(`Error fetching analytics for student ${studentId}:`, error);
        return null;
    }
};

/**
 * Get class-wide mastery summary for heatmap
 */
export const getClassMasteryHeatmap = async (courseId: string): Promise<{
    students: { id: string; name: string }[];
    topics: string[];
    data: number[][]; // [studentIndex][topicIndex] = mastery
}> => {
    const analytics = await getCourseAnalytics(courseId);

    if (analytics.length === 0) {
        return { students: [], topics: [], data: [] };
    }

    // Collect all unique topics
    const topicsSet = new Set<string>();
    analytics.forEach(student => {
        Object.keys(student.mastery).forEach(topic => topicsSet.add(topic));
    });
    const topics = Array.from(topicsSet);

    // Build data matrix
    const students = analytics.map(s => ({ id: s.id, name: s.name }));
    const data = analytics.map(student =>
        topics.map(topic => student.mastery[topic] || 0)
    );

    return { students, topics, data };
};

/**
 * Get at-risk students for a course
 */
export const getAtRiskStudents = async (courseId: string): Promise<StudentAnalytics[]> => {
    const analytics = await getCourseAnalytics(courseId);
    return analytics.filter(s => s.riskLevel === 'high' || s.riskLevel === 'medium');
};

/**
 * Get journey trace for visualization
 */
export const getStudentJourneyTrace = async (
    studentId: string,
    courseId?: string
): Promise<JourneyNode[]> => {
    const analytics = await getStudentAnalytics(studentId, courseId);
    return analytics?.journey || [];
};

// ============================================
// FALLBACK: Mock data for development/testing
// ============================================

const MOCK_TOPICS = ['שברים פשוטים', 'שברים מורכבים', 'עשרוניים', 'אחוזים', 'יחס ופרופורציה'];

/**
 * 3 Demo Students representing different learner profiles:
 * 1. Struggling - needs scaffolding, high risk
 * 2. Average - uses original content, medium risk
 * 3. Advanced - gets enrichment, low risk
 */
const MOCK_STUDENTS = [
    {
        id: 'demo-struggling',
        name: 'דני כהן',
        email: 'dani@demo.wizdi.co',
        risk: 'high' as const,
        profile: 'struggling',
        expectedVariant: 'scaffolding',
        mastery: { base: 0.28, variance: 0.1 },
        performance: {
            accuracy: 0.35,
            avgResponseTime: 38,
            totalQuestions: 42,
            hintDependency: 0.72
        },
        errorPatterns: {
            'שגיאת חישוב': 15,
            'שגיאת סימן': 8,
            'אי הבנת מושג': 6,
            'חיבור שברים ללא מכנה משותף': 4
        }
    },
    {
        id: 'demo-average',
        name: 'מיכל לוי',
        email: 'michal@demo.wizdi.co',
        risk: 'medium' as const,
        profile: 'average',
        expectedVariant: 'original',
        mastery: { base: 0.58, variance: 0.15 },
        performance: {
            accuracy: 0.67,
            avgResponseTime: 22,
            totalQuestions: 65,
            hintDependency: 0.28
        },
        errorPatterns: {
            'שגיאת חישוב': 5,
            'שגיאת רשלנות': 3,
            'שגיאת סימן': 2
        }
    },
    {
        id: 'demo-advanced',
        name: 'יוסי פרץ',
        email: 'yossi@demo.wizdi.co',
        risk: 'low' as const,
        profile: 'advanced',
        expectedVariant: 'enrichment',
        mastery: { base: 0.91, variance: 0.05 },
        performance: {
            accuracy: 0.94,
            avgResponseTime: 11,
            totalQuestions: 85,
            hintDependency: 0.03
        },
        errorPatterns: {
            'שגיאת רשלנות': 2
        }
    }
];

/**
 * Generate mock journey for testing
 */
const generateMockJourney = (risk: 'low' | 'medium' | 'high'): JourneyNode[] => {
    const nodes: JourneyNode[] = [];
    const now = Date.now();
    let time = now - 1000 * 60 * 60;

    for (let i = 1; i <= 5; i++) {
        const success = risk === 'low' ? Math.random() > 0.1 :
            risk === 'medium' ? Math.random() > 0.4 :
                Math.random() > 0.7;

        nodes.push({
            id: `step-${i}`,
            type: 'question',
            status: success ? 'success' : 'failure',
            timestamp: time,
            connection: 'direct'
        });
        time += 1000 * 60 * 5;

        if (!success) {
            nodes.push({
                id: `remedial-${i}`,
                type: 'remediation',
                status: 'viewed',
                timestamp: time,
                connection: 'branched'
            });
            time += 1000 * 60 * 3;

            nodes.push({
                id: `retry-${i}`,
                type: 'question',
                status: 'success',
                timestamp: time,
                connection: 'branched'
            });
            time += 1000 * 60 * 2;
        }
    }
    return nodes;
};

/**
 * Get mock data for development (when Firestore is empty)
 * Returns 3 students with different profiles for testing adaptive features
 */
export const getMockCourseAnalytics = async (_courseId: string): Promise<StudentAnalytics[]> => {
    await new Promise(r => setTimeout(r, 300));

    return MOCK_STUDENTS.map(s => {
        // Generate topic mastery based on student profile
        const mastery: Record<string, number> = {};
        MOCK_TOPICS.forEach(t => {
            const variance = (Math.random() - 0.5) * s.mastery.variance * 2;
            mastery[t] = Math.min(1, Math.max(0, s.mastery.base + variance));
        });

        return {
            id: s.id,
            name: s.name,
            email: s.email,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.id}`,
            mastery,
            lastActive: new Date().toISOString(),
            riskLevel: s.risk,
            journey: generateMockJourney(s.risk),
            performance: s.performance,
            errorPatterns: s.errorPatterns
        };
    });
};

/**
 * Smart analytics getter - uses real data if available, falls back to mock
 */
export const getSmartCourseAnalytics = async (courseId: string): Promise<StudentAnalytics[]> => {
    const realData = await getCourseAnalytics(courseId);

    if (realData.length > 0) {
        console.log(`📊 Loaded ${realData.length} real students for course ${courseId}`);
        return realData;
    }

    console.log(`📊 No real data found, using mock data for course ${courseId}`);
    return getMockCourseAnalytics(courseId);
};
