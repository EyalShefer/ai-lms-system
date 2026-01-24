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
    courseMastery?: number; // Course-specific mastery (0.0-1.0) when viewing a specific course
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
    isSimulated?: boolean; // True if this is a simulated student from testing
    simulationProfile?: 'struggling' | 'average' | 'advanced'; // Simulation student type
}

export interface JourneyNode {
    id: string;
    type: 'question' | 'content' | 'הבנה' | 'העמקה' | 'skipped';  // הבנה replaces remediation
    status: 'success' | 'failure' | 'skipped' | 'viewed';
    timestamp: number;
    blockId?: string;
    blockType?: string;
    variantUsed?: 'יישום' | 'הבנה' | 'העמקה';  // Hebrew: Application, Understanding, Deepening
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
                nodeType = 'הבנה';  // Remediation uses הבנה (Understanding) variant
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
 * Enrich journey nodes with adaptive event data (variants, scaffolding)
 *
 * This bridges the gap between session data (which lacks scaffolding info)
 * and adaptive events (which have detailed scaffolding decisions).
 */
const enrichJourneyWithAdaptiveEvents = async (
    userId: string,
    journey: JourneyNode[]
): Promise<JourneyNode[]> => {
    if (journey.length === 0) {
        return journey;
    }

    try {
        // 1. Get recent adaptive events
        const eventsRef = collection(db, 'users', userId, 'adaptive_events');
        const eventsQuery = query(
            eventsRef,
            orderBy('timestamp', 'desc'),
            limit(200) // Get enough events to cover the journey
        );
        const eventsSnap = await getDocs(eventsQuery);

        if (eventsSnap.empty) {
            console.log(`No adaptive events found for user ${userId}`);
            return journey;
        }

        const events = eventsSnap.docs.map(doc => doc.data());

        // 2. Build mapping: blockId -> variant info
        const variantMap: Record<string, 'הבנה' | 'יישום' | 'העמקה'> = {};
        const scaffoldingMap: Record<string, {
            offered: boolean;
            accepted?: boolean;
            declined?: boolean;
        }> = {};

        events.forEach((event: any) => {
            const blockId = event.blockId;
            if (!blockId) return;

            // Map variant selections
            if (event.type === 'variant_selected') {
                variantMap[blockId] = event.data?.variantType;
            }

            // Map scaffolding offers
            if (event.type === 'scaffolding_offered') {
                scaffoldingMap[blockId] = { offered: true };
            }

            // Map scaffolding acceptances
            if (event.type === 'scaffolding_accepted') {
                scaffoldingMap[blockId] = {
                    offered: true,
                    accepted: true,
                    declined: false
                };
                // Also record the variant that was used
                if (event.data?.scaffoldingVariantType) {
                    variantMap[blockId] = event.data.scaffoldingVariantType;
                }
            }

            // Map scaffolding declines
            if (event.type === 'scaffolding_declined') {
                scaffoldingMap[blockId] = {
                    offered: true,
                    accepted: false,
                    declined: true
                };
            }
        });

        // 3. Enrich journey nodes with the mapped data
        const enrichedJourney = journey.map(node => {
            const blockId = node.blockId;
            if (!blockId) return node;

            return {
                ...node,
                variantUsed: variantMap[blockId] || node.variantUsed,
                metadata: {
                    ...node.metadata,
                    scaffoldingOffered: scaffoldingMap[blockId]?.offered || false,
                    scaffoldingAccepted: scaffoldingMap[blockId]?.accepted,
                    scaffoldingDeclined: scaffoldingMap[blockId]?.declined
                }
            };
        });

        console.log(`📊 Enriched ${enrichedJourney.length} journey nodes with adaptive events for user ${userId}`);
        return enrichedJourney;

    } catch (error) {
        console.error('Error enriching journey with adaptive events:', error);
        // Return original journey on error
        return journey;
    }
};

/**
 * Get analytics for all students enrolled in a course
 */
export const getCourseAnalytics = async (courseId: string): Promise<StudentAnalytics[]> => {
    try {
        console.log('🔍 [getCourseAnalytics] Querying enrollments for courseId:', courseId);

        // 1. Get all enrollments for this course
        const enrollmentsRef = collection(db, 'enrollments');
        const enrollmentsQuery = query(
            enrollmentsRef,
            where('courseId', '==', courseId)
        );
        const enrollmentsSnap = await getDocs(enrollmentsQuery);

        console.log('📊 [getCourseAnalytics] Enrollments found:', enrollmentsSnap.size);

        if (enrollmentsSnap.empty) {
            console.log(`❌ No enrollments found for course ${courseId}`);
            return [];
        }

        const studentIds = enrollmentsSnap.docs.map(doc => doc.data().studentId);
        console.log('👥 [getCourseAnalytics] Student IDs from enrollments:', studentIds);

        // 2. Fetch data for each student in parallel
        const analyticsPromises = studentIds.map(studentId => getStudentAnalytics(studentId, courseId));
        const results = await Promise.all(analyticsPromises);

        console.log('✅ [getCourseAnalytics] Analytics fetched for', results.filter(r => r !== null).length, 'students');

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

        // 3. Get proficiency
        const proficiencyRef = doc(db, 'users', studentId, 'profile', 'proficiency');
        const proficiencySnap = await getDoc(proficiencyRef);
        const proficiency = proficiencySnap.exists() ? proficiencySnap.data() : null;

        // 4. Get error fingerprint
        const errorRef = doc(db, 'users', studentId, 'profile', 'error_fingerprint');
        const errorSnap = await getDoc(errorRef);
        const errorFingerprint = errorSnap.exists() ? errorSnap.data() : null;

        // 5. Get recent sessions (for journey trace)
        // Sessions are stored in top-level 'sessions' collection with userId field
        const sessionsRef = collection(db, 'sessions');

        // Simple query with userId only (no orderBy to avoid index requirement)
        // Sort and filter client-side
        const sessionsQuery = query(
            sessionsRef,
            where('userId', '==', studentId)
        );

        const sessionsSnap = await getDocs(sessionsQuery);
        let sessions = sessionsSnap.docs.map(doc => ({
            ...doc.data(),
            // Convert startedAt to startTime for compatibility
            startTime: doc.data().startedAt?.toMillis?.() || Date.now()
        }));

        // Client-side filter by courseId if provided
        if (courseId) {
            sessions = sessions.filter(s => s.courseId === courseId);
            console.log(`📊 [getStudentAnalytics] Filtered to ${sessions.length} sessions for courseId ${courseId}`);
        }

        // Client-side sort by startedAt (newest first)
        sessions.sort((a, b) => {
            const aTime = a.startedAt?.toMillis?.() || 0;
            const bTime = b.startedAt?.toMillis?.() || 0;
            return bTime - aTime;
        });

        // Limit to 20 most recent
        sessions = sessions.slice(0, 20);

        // 6. Calculate derived metrics
        const mastery = proficiency?.topics || {};

        // If courseId is provided, use course-specific mastery and accuracy
        // Otherwise, use global values
        let avgMastery: number;
        let accuracy: number;

        let totalQuestionsAttempted: number;
        let avgResponseTimeSec: number;
        let hintDependency: number;

        if (courseId && sessions.length > 0) {
            // Course-specific mastery from proficiency
            avgMastery = mastery[courseId] || 0;

            // Course-specific accuracy from sessions
            totalQuestionsAttempted = sessions.reduce((sum, s) => sum + (s.totalQuestions || 0), 0);
            const correctAnswers = sessions.reduce((sum, s) => sum + (s.correctAnswers || 0), 0);
            accuracy = totalQuestionsAttempted > 0 ? correctAnswers / totalQuestionsAttempted : 0;

            // Course-specific average response time
            const totalInteractions = sessions.reduce((sum, s) => sum + (s.interactions?.length || 0), 0);
            const totalTime = sessions.reduce((sum, s) => {
                const sessionTime = s.interactions?.reduce((t: number, i: any) => t + (i.timeSpentSec || 0), 0) || 0;
                return sum + sessionTime;
            }, 0);
            avgResponseTimeSec = totalInteractions > 0 ? totalTime / totalInteractions : 0;

            // Course-specific hint dependency
            const totalHintsUsed = sessions.reduce((sum, s) => {
                const sessionHints = s.interactions?.reduce((h: number, i: any) => h + (i.hintsUsed || 0), 0) || 0;
                return sum + sessionHints;
            }, 0);
            hintDependency = totalQuestionsAttempted > 0 ? totalHintsUsed / totalQuestionsAttempted : 0;

            console.log(`📊 [getStudentAnalytics] Course-specific metrics for ${courseId}:`, {
                mastery: (avgMastery * 100).toFixed(1) + '%',
                accuracy: (accuracy * 100).toFixed(1) + '%',
                correctAnswers,
                totalQuestions: totalQuestionsAttempted,
                avgResponseTime: avgResponseTimeSec.toFixed(1) + 's',
                hintDependency: (hintDependency * 100).toFixed(1) + '%'
            });
        } else {
            // Global metrics (average across all courses)
            avgMastery = Object.values(mastery).length > 0
                ? Object.values(mastery as Record<string, number>).reduce((a, b) => a + b, 0) / Object.values(mastery).length
                : 0.5;
            accuracy = stats?.performance?.global_accuracy_rate || 0.5;
            totalQuestionsAttempted = stats?.performance?.total_questions_attempted || 0;
            avgResponseTimeSec = stats?.performance?.average_response_time_sec || 0;
            hintDependency = stats?.behavioral?.hint_dependency_score || 0;
        }

        const riskLevel = calculateRiskLevel(accuracy, hintDependency, avgMastery);

        console.log(`🎯 [getStudentAnalytics] Risk calculation for ${studentId}:`, {
            accuracy: (accuracy * 100).toFixed(1) + '%',
            hintDependency: (hintDependency * 100).toFixed(1) + '%',
            avgMastery: (avgMastery * 100).toFixed(1) + '%',
            riskLevel,
            courseId: courseId || 'none'
        });

        // 7. Build journey from sessions
        const journey = sessionsToJourney(sessions);

        // 7.5. Enrich journey with adaptive events (variants, scaffolding)
        const enrichedJourney = await enrichJourneyWithAdaptiveEvents(studentId, journey);

        // 8. Construct analytics object
        return {
            id: studentId,
            name: userData.displayName || userData.name || 'תלמיד',
            email: userData.email,
            avatar: userData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentId}`,
            mastery: mastery as Record<string, number>,
            courseMastery: courseId ? avgMastery : undefined, // Course-specific mastery when viewing a specific course
            lastActive: stats?.engagement?.last_active_at?.toDate?.()?.toISOString() ||
                userData.lastLogin?.toDate?.()?.toISOString() ||
                new Date().toISOString(),
            riskLevel,
            journey: enrichedJourney,
            performance: {
                accuracy,
                avgResponseTime: avgResponseTimeSec,
                totalQuestions: totalQuestionsAttempted,
                hintDependency
            },
            errorPatterns: errorFingerprint?.errorTags || {},
            isSimulated: userData.isSimulated || false,
            simulationProfile: userData.simulationProfile
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
 * 1. Struggling - needs הבנה (Understanding), high risk
 * 2. Average - uses יישום (Application/original), medium risk
 * 3. Advanced - gets העמקה (Deepening), low risk
 */
const MOCK_STUDENTS = [
    {
        id: 'demo-struggling',
        name: 'דני כהן',
        email: 'dani@demo.wizdi.co',
        risk: 'high' as const,
        profile: 'struggling',
        expectedVariant: 'הבנה',
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
        expectedVariant: 'יישום',
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
        expectedVariant: 'העמקה',
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
 * Generate mock journey for testing with variant information
 * - Struggling students (high risk) → get הבנה (Understanding) variants
 * - Average students (medium risk) → get יישום (Application) variants
 * - Advanced students (low risk) → get העמקה (Deepening) variants
 */
const generateMockJourney = (risk: 'low' | 'medium' | 'high'): JourneyNode[] => {
    const nodes: JourneyNode[] = [];
    const now = Date.now();
    let time = now - 1000 * 60 * 60;

    // Determine primary variant based on risk level
    const primaryVariant: 'הבנה' | 'יישום' | 'העמקה' =
        risk === 'high' ? 'הבנה' :
        risk === 'low' ? 'העמקה' : 'יישום';

    for (let i = 1; i <= 8; i++) {
        const success = risk === 'low' ? Math.random() > 0.1 :
            risk === 'medium' ? Math.random() > 0.4 :
                Math.random() > 0.7;

        // Add content block first (every other question)
        if (i % 2 === 1) {
            nodes.push({
                id: `content-${i}`,
                type: 'content',
                status: 'viewed',
                timestamp: time,
                connection: 'direct',
                variantUsed: primaryVariant
            });
            time += 1000 * 60 * 2;
        }

        // Determine variant for this question
        // Sometimes the system adjusts mid-activity based on performance
        let questionVariant = primaryVariant;
        if (risk === 'high' && i > 4 && Math.random() > 0.7) {
            // Struggling student improving - might get יישום
            questionVariant = 'יישום';
        } else if (risk === 'low' && !success) {
            // Advanced student struggling on one - might get יישום
            questionVariant = 'יישום';
        }

        nodes.push({
            id: `step-${i}`,
            type: 'question',
            status: success ? 'success' : 'failure',
            timestamp: time,
            connection: 'direct',
            variantUsed: questionVariant
        });
        time += 1000 * 60 * 5;

        if (!success) {
            // Remediation question - student usually succeeds (80%) on easier reinforcement question
            const remediationSuccess = Math.random() > 0.2;
            nodes.push({
                id: `remedial-${i}`,
                type: 'הבנה',  // Remediation uses הבנה (Understanding) level
                status: remediationSuccess ? 'success' : 'failure',
                timestamp: time,
                connection: 'branched',
                variantUsed: 'הבנה' // Remediation is always הבנה (Understanding)
            });
            time += 1000 * 60 * 3;
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
    console.log('🎯 [getSmartCourseAnalytics] Starting for courseId:', courseId);
    const realData = await getCourseAnalytics(courseId);

    if (realData.length > 0) {
        console.log(`✅ [getSmartCourseAnalytics] Loaded ${realData.length} real students for course ${courseId}`);
        return realData;
    }

    console.warn(`⚠️ [getSmartCourseAnalytics] No real data found, using mock data for course ${courseId}`);
    return getMockCourseAnalytics(courseId);
};
