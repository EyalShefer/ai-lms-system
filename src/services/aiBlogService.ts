/**
 * AI Blog Service
 * Curates, translates, and summarizes AI/EdTech articles for teachers
 * Weekly updates with practical classroom applications
 */

import { db, functions } from '../firebase';
import {
    collection,
    doc,
    getDocs,
    setDoc,
    query,
    orderBy,
    limit,
    where,
    Timestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

export interface AIBlogArticle {
    id: string;
    // Hebrew content (AI-generated)
    title: string;              // Translated title
    summary: string;            // 2-3 sentence summary
    keyPoints: string[];        // 3-5 practical points
    classroomTips: string[];    // "How to use in classroom"

    // Original source
    originalTitle: string;
    originalUrl: string;
    sourceName: string;

    // Metadata
    category: 'tool' | 'research' | 'tip' | 'trend';
    categoryLabel: string;      // Hebrew label
    readingTime: number;        // Minutes
    publishedAt: Timestamp;
    createdAt: Timestamp;

    // Engagement
    viewCount: number;
    helpfulCount: number;
}

// Category labels in Hebrew
export const BLOG_CATEGORIES = {
    tool: { label: 'כלי חדש', icon: '🔧', color: 'bg-blue-100 text-blue-700' },
    research: { label: 'מחקר', icon: '📊', color: 'bg-purple-100 text-purple-700' },
    tip: { label: 'טיפ מעשי', icon: '💡', color: 'bg-amber-100 text-amber-700' },
    trend: { label: 'מגמה', icon: '📈', color: 'bg-green-100 text-green-700' }
};

// Quality sources for AI in education
export const QUALITY_SOURCES = [
    { url: 'https://www.edsurge.com/feeds/articles', name: 'EdSurge', priority: 1 },
    { url: 'https://www.iste.org/feed', name: 'ISTE', priority: 1 },
    { url: 'https://blog.google/technology/ai/rss/', name: 'Google AI', priority: 2 },
    { url: 'https://openai.com/blog/rss.xml', name: 'OpenAI', priority: 2 },
    { url: 'https://www.edweek.org/feed', name: 'Education Week', priority: 1 }
];

/**
 * Fetch blog articles from Firestore
 */
export async function getBlogArticles(limitCount: number = 5): Promise<AIBlogArticle[]> {
    try {
        const blogRef = collection(db, 'aiBlog');
        const q = query(
            blogRef,
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);
        const articles: AIBlogArticle[] = [];

        snapshot.forEach(doc => {
            articles.push({ id: doc.id, ...doc.data() } as AIBlogArticle);
        });

        return articles;
    } catch (error) {
        console.error('Error fetching blog articles:', error);
        return [];
    }
}

/**
 * Get featured/latest article
 */
export async function getFeaturedArticle(): Promise<AIBlogArticle | null> {
    try {
        const blogRef = collection(db, 'aiBlog');
        const q = query(
            blogRef,
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as AIBlogArticle;
    } catch (error) {
        console.error('Error fetching featured article:', error);
        return null;
    }
}

/**
 * Get articles by category
 */
export async function getArticlesByCategory(
    category: AIBlogArticle['category'],
    limitCount: number = 10
): Promise<AIBlogArticle[]> {
    try {
        const blogRef = collection(db, 'aiBlog');
        const q = query(
            blogRef,
            where('category', '==', category),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);
        const articles: AIBlogArticle[] = [];

        snapshot.forEach(doc => {
            articles.push({ id: doc.id, ...doc.data() } as AIBlogArticle);
        });

        return articles;
    } catch (error) {
        console.error('Error fetching articles by category:', error);
        return [];
    }
}

/**
 * Increment view count
 */
export async function incrementViewCount(articleId: string): Promise<void> {
    try {
        const articleRef = doc(db, 'aiBlog', articleId);
        // Use increment would be better but for now just get and update
        const snapshot = await getDocs(query(collection(db, 'aiBlog'), limit(1)));
        // For simplicity, we'll handle this in Cloud Functions
    } catch (error) {
        console.error('Error incrementing view count:', error);
    }
}

/**
 * Mark article as helpful
 */
export async function markAsHelpful(articleId: string): Promise<void> {
    try {
        // Will be implemented with Cloud Function to prevent abuse
    } catch (error) {
        console.error('Error marking as helpful:', error);
    }
}

/**
 * Trigger manual blog article generation (admin only)
 * @param forceRegenerate - If true, deletes existing articles and creates fresh ones
 */
export async function triggerBlogGeneration(forceRegenerate: boolean = false): Promise<{ success: boolean; created: number; message: string }> {
    try {
        const triggerFunc = httpsCallable<{ forceRegenerate?: boolean }, { success: boolean; created: number; message: string }>(
            functions,
            'triggerBlogArticleGeneration'
        );
        const result = await triggerFunc({ forceRegenerate });
        return result.data;
    } catch (error) {
        console.error('Error triggering blog generation:', error);
        throw error;
    }
}
