import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export interface FeedbackLog {
    id?: string;
    userId: string;
    userRole: 'student' | 'teacher';
    courseId: string;
    unitId?: string;
    blockId?: string;
    type: 'positive' | 'negative';
    tags?: string[]; // e.g., ['confusing', 'bug', 'boring', 'too_hard']
    comment?: string;
    timestamp?: any;
    context?: {
        blockType?: string;
        gradeLevel?: string;
        [key: string]: any;
    };
}

export interface SystemInsight {
    id: string;
    scope: 'course' | 'global';
    courseId?: string;
    type: 'pedagogical' | 'technical' | 'content';
    severity: 'low' | 'medium' | 'high';
    title: string;
    description: string;
    suggestedAction: string;
    affectedMetric?: string;
    createdAt: any;
}

export const feedbackService = {
    /**
     * Submit a new feedback log
     */
    submitFeedback: async (feedback: Omit<FeedbackLog, 'id' | 'timestamp'>) => {
        try {
            const docRef = await addDoc(collection(db, 'feedback_logs'), {
                ...feedback,
                timestamp: serverTimestamp()
            });
            console.log("Feedback submitted with ID: ", docRef.id);
            return docRef.id;
        } catch (error) {
            console.error("Error submitting feedback: ", error);
            throw error;
        }
    },

    /**
     * Get feedback stats for a specific course (Mock/Basic aggregation)
     */
    getFeedbackForCourse: async (courseId: string) => {
        try {
            const q = query(
                collection(db, 'feedback_logs'),
                where("courseId", "==", courseId),
                orderBy("timestamp", "desc"),
                limit(100)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackLog));
        } catch (error) {
            console.error("Error fetching feedback: ", error);
            return [];
        }
    },

    /**
     * Get aggregated feedback stats
     */
    getFeedbackStats: async (courseId: string) => {
        try {
            const feedbackList = await feedbackService.getFeedbackForCourse(courseId);
            const stats = {
                positive: 0,
                negative: 0,
                tags: {} as Record<string, number>
            };

            feedbackList.forEach(f => {
                if (f.type === 'positive') stats.positive++;
                if (f.type === 'negative') {
                    stats.negative++;
                    f.tags?.forEach(tag => {
                        stats.tags[tag] = (stats.tags[tag] || 0) + 1;
                    });
                }
            });

            return { stats, recent: feedbackList.slice(0, 5) };
        } catch (error) {
            console.error("Error getting stats:", error);
            return { stats: { positive: 0, negative: 0, tags: {} }, recent: [] };
        }
    }
};
