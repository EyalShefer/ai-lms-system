/**
 * Curriculum Topic Service
 *
 * Identifies curriculum topics for activity blocks using the Knowledge Base.
 * Links student proficiency tracking to real curriculum chapters rather than generic topics.
 *
 * Topic identification priority:
 * 1. Block has curriculumTopicId → use it
 * 2. Search curriculum docs by content → use chapter name
 * 3. Search student book by content → use chapter name
 * 4. Use bloom level as pseudo-topic (bloom_{level})
 * 5. Fallback to 'general'
 */

import { searchKnowledge, type KnowledgeSearchResult } from './knowledgeBaseService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Cache for curriculum topics to avoid repeated queries
const topicsCache = new Map<string, { topics: string[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cache for topic identification results
const identificationCache = new Map<string, { topic: string | null; timestamp: number }>();
const IDENTIFICATION_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Identifies the curriculum topic for a block based on its content.
 * Uses Knowledge Base semantic search to find the most relevant chapter.
 *
 * @param blockContent - The question text or content of the block
 * @param grade - Grade level (e.g., 'ב', 'ג')
 * @param subject - Subject area (e.g., 'math')
 * @returns The curriculum topic (chapter name) or null if not found
 */
export async function identifyCurriculumTopic(
    blockContent: string,
    grade: string,
    subject: string = 'math'
): Promise<string | null> {
    // Validate input
    if (!blockContent || blockContent.trim().length < 5) {
        console.log('📚 Topic identification skipped: content too short');
        return null;
    }

    // Check cache first
    const cacheKey = `${grade}_${subject}_${blockContent.substring(0, 100)}`;
    const cached = identificationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < IDENTIFICATION_CACHE_TTL_MS) {
        console.log(`📚 Topic identification (cached): "${cached.topic}"`);
        return cached.topic;
    }

    try {
        // 1. Search curriculum documents first (highest priority)
        console.log(`📚 Searching curriculum for topic: grade=${grade}, subject=${subject}`);
        const curriculumResults = await searchKnowledge(blockContent, {
            grade,
            subject,
            volumeType: 'curriculum'
        }, 1);

        if (curriculumResults.length > 0 && curriculumResults[0].similarity > 0.4) {
            const topic = curriculumResults[0].chunk.chapter;
            console.log(`📚 Topic identified from curriculum: "${topic}" (similarity: ${(curriculumResults[0].similarity * 100).toFixed(1)}%)`);
            identificationCache.set(cacheKey, { topic, timestamp: Date.now() });
            return topic;
        }

        // 2. Fallback: search student book
        const studentResults = await searchKnowledge(blockContent, {
            grade,
            subject,
            volumeType: 'student'
        }, 1);

        if (studentResults.length > 0 && studentResults[0].similarity > 0.4) {
            const topic = studentResults[0].chunk.chapter;
            console.log(`📚 Topic identified from student book: "${topic}" (similarity: ${(studentResults[0].similarity * 100).toFixed(1)}%)`);
            identificationCache.set(cacheKey, { topic, timestamp: Date.now() });
            return topic;
        }

        // 3. No match found
        console.log(`📚 No curriculum topic found for content in grade ${grade}`);
        identificationCache.set(cacheKey, { topic: null, timestamp: Date.now() });
        return null;

    } catch (error) {
        console.warn('📚 Error identifying curriculum topic:', error);
        return null;
    }
}

/**
 * Gets all curriculum topics (unique chapter names) for a grade/subject.
 * Useful for displaying topic lists in dashboards.
 *
 * @param grade - Grade level (e.g., 'ב', 'ג')
 * @param subject - Subject area (e.g., 'math')
 * @returns Array of unique topic names
 */
export async function getCurriculumTopics(
    grade: string,
    subject: string = 'math'
): Promise<string[]> {
    const cacheKey = `${grade}_${subject}`;

    // Check cache
    const cached = topicsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.topics;
    }

    try {
        // Query curriculum documents
        const curriculumQuery = query(
            collection(db, 'math_knowledge'),
            where('grade', '==', grade),
            where('volumeType', '==', 'curriculum')
        );

        const snapshot = await getDocs(curriculumQuery);
        const chapters = new Set<string>();

        snapshot.forEach(doc => {
            const chapter = doc.data().chapter;
            if (chapter && chapter.trim()) {
                chapters.add(chapter.trim());
            }
        });

        // If no curriculum found, try student book chapters
        if (chapters.size === 0) {
            const studentQuery = query(
                collection(db, 'math_knowledge'),
                where('grade', '==', grade),
                where('volumeType', '==', 'student')
            );

            const studentSnapshot = await getDocs(studentQuery);
            studentSnapshot.forEach(doc => {
                const chapter = doc.data().chapter;
                if (chapter && chapter.trim()) {
                    chapters.add(chapter.trim());
                }
            });
        }

        const topics = Array.from(chapters).sort();

        // Cache results
        topicsCache.set(cacheKey, { topics, timestamp: Date.now() });

        console.log(`📚 Found ${topics.length} curriculum topics for grade ${grade}`);
        return topics;

    } catch (error) {
        console.warn('📚 Error getting curriculum topics:', error);
        return [];
    }
}

/**
 * Checks if curriculum content exists for a grade/subject combination.
 *
 * @param grade - Grade level (e.g., 'ב', 'ג')
 * @param subject - Subject area (e.g., 'math')
 * @returns True if curriculum data exists
 */
export async function hasCurriculumData(
    grade: string,
    subject: string = 'math'
): Promise<boolean> {
    try {
        const topics = await getCurriculumTopics(grade, subject);
        return topics.length > 0;
    } catch {
        return false;
    }
}

/**
 * Gets the topic ID for a block, with full fallback chain.
 * This is the main function to use when tracking student proficiency.
 *
 * Priority:
 * 1. curriculumTopicId in metadata → use it
 * 2. Identify from content via KB search → use chapter name
 * 3. bloomLevel in metadata → use 'bloom_{level}'
 * 4. Fallback → 'general'
 *
 * @param block - The activity block
 * @param grade - Grade level
 * @param subject - Subject area
 * @returns Topic ID string
 */
export async function getTopicIdForBlock(
    block: { content: any; metadata?: { curriculumTopicId?: string; bloomLevel?: string } },
    grade?: string,
    subject?: string
): Promise<string> {
    // 1. Check if block already has curriculumTopicId
    if (block.metadata?.curriculumTopicId) {
        return block.metadata.curriculumTopicId;
    }

    // 2. Try to identify topic from content (for legacy blocks)
    if (grade) {
        const contentText = extractContentText(block.content);
        if (contentText) {
            const identified = await identifyCurriculumTopic(
                contentText,
                grade,
                subject || 'math'
            );
            if (identified) {
                return identified;
            }
        }
    }

    // 3. Fallback: use bloom level as pseudo-topic
    if (block.metadata?.bloomLevel) {
        return `bloom_${block.metadata.bloomLevel}`;
    }

    // 4. Final fallback
    return 'general';
}

/**
 * Extracts text content from various block content formats.
 */
function extractContentText(content: any): string {
    if (typeof content === 'string') {
        return content;
    }

    if (content?.question) {
        return content.question;
    }

    if (content?.instruction) {
        return content.instruction;
    }

    if (content?.text) {
        return content.text;
    }

    // For complex content, try to stringify relevant parts
    if (typeof content === 'object') {
        const parts: string[] = [];
        if (content.question) parts.push(content.question);
        if (content.instruction) parts.push(content.instruction);
        if (content.options && Array.isArray(content.options)) {
            parts.push(...content.options.map((o: any) => typeof o === 'string' ? o : o.text || ''));
        }
        return parts.join(' ').trim();
    }

    return '';
}

/**
 * Clears the topic caches. Useful for testing or when curriculum data is updated.
 */
export function clearTopicCaches(): void {
    topicsCache.clear();
    identificationCache.clear();
    console.log('📚 Topic caches cleared');
}

/**
 * Checks if a topic ID represents a curriculum topic (not bloom or general).
 */
export function isCurriculumTopic(topicId: string): boolean {
    return topicId !== 'general' && !topicId.startsWith('bloom_');
}

/**
 * Formats a topic ID for display.
 * Translates bloom_ prefixes to Hebrew.
 */
export function formatTopicForDisplay(topicId: string): string {
    if (topicId === 'general') {
        return 'כללי';
    }

    if (topicId.startsWith('bloom_')) {
        const bloomLevel = topicId.replace('bloom_', '');
        const bloomTranslations: Record<string, string> = {
            'knowledge': 'ידע',
            'comprehension': 'הבנה',
            'application': 'יישום',
            'analysis': 'ניתוח',
            'synthesis': 'יצירה',
            'evaluation': 'הערכה'
        };
        return bloomTranslations[bloomLevel] || bloomLevel;
    }

    // Curriculum topic - return as-is
    return topicId;
}
