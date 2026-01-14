/**
 * Lesson Activity Service
 *
 * Handles extraction of interactive activities from lesson plans
 * and creates separate activity courses that students can complete.
 */

import { collection, doc, addDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import type { ActivityBlock, Course, LearningUnit } from '../shared/types/courseTypes';

// Progress callback type for UI feedback
export type ProgressCallback = (step: string, progress: number) => void;

// ============ TYPES ============

export type BlockCategory = 'teacher_only' | 'presentation' | 'student_activity';

export interface ExtractedActivity {
    id: string;
    title: string;
    blocks: ActivityBlock[];
    sourceBlockIds: string[];
    parentLessonId: string;
    parentLessonTitle: string;
}

export interface ActivityCourseLink {
    activityCourseId: string;
    parentLessonId: string;
    parentLessonTitle: string;
    extractedBlockIds: string[];
    createdAt: any;
    shareUrl: string;
}

// ============ BLOCK CATEGORIZATION ============

/**
 * Interactive block types that students can interact with and submit answers
 */
const INTERACTIVE_BLOCK_TYPES = [
    'multiple-choice',
    'open-question',
    'fill_in_blanks',
    'ordering',
    'categorization',
    'memory_game',
    'true_false_speed',
    'drag_and_drop',
    'hotspot',
    'matching',
    'audio-response',
    'interactive-chat'
];

/**
 * Presentation block types - content shown to students but no interaction
 */
const PRESENTATION_BLOCK_TYPES = [
    'text',
    'video',
    'image',
    'pdf',
    'infographic',
    'mindmap',
    'podcast'
];

/**
 * Determines the category of a block based on its type and content
 */
export const categorizeBlock = (block: ActivityBlock): BlockCategory => {
    // Check if block has teacher-only content
    const content = block.content;
    if (typeof content === 'object' && content !== null) {
        // If it has teach_content but no student-facing content, it's teacher-only
        if ('teach_content' in content && content.teach_content && !content.text) {
            return 'teacher_only';
        }
    }

    // Check block type
    if (INTERACTIVE_BLOCK_TYPES.includes(block.type)) {
        return 'student_activity';
    }

    if (PRESENTATION_BLOCK_TYPES.includes(block.type)) {
        return 'presentation';
    }

    // Default to presentation for unknown types
    return 'presentation';
};

/**
 * Checks if a block is sendable to students (interactive + has content)
 */
export const isBlockSendable = (block: ActivityBlock): boolean => {
    const category = categorizeBlock(block);
    if (category !== 'student_activity') return false;

    // Verify the block has actual content
    const content = block.content;
    if (!content) return false;

    if (typeof content === 'object') {
        // Check for question content
        if ('question' in content && content.question) return true;
        if ('instruction' in content && content.instruction) return true;
        if ('items' in content && Array.isArray(content.items) && content.items.length > 0) return true;
    }

    return typeof content === 'string' && content.length > 0;
};

/**
 * Gets all sendable blocks from a learning unit
 */
export const getSendableBlocks = (unit: LearningUnit): ActivityBlock[] => {
    return (unit.activityBlocks || []).filter(isBlockSendable);
};

/**
 * Gets block type display name in Hebrew
 */
export const getBlockTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
        'multiple-choice': 'שאלה אמריקאית',
        'open-question': 'שאלה פתוחה',
        'fill_in_blanks': 'השלמת משפטים',
        'ordering': 'סידור רצף',
        'categorization': 'מיון לקטגוריות',
        'memory_game': 'משחק זיכרון',
        'true_false_speed': 'נכון/לא נכון',
        'drag_and_drop': 'גרור ושחרר',
        'hotspot': 'נקודות חמות',
        'matching': 'התאמה',
        'audio-response': 'תשובה קולית',
        'interactive-chat': 'צ\'אט אינטראקטיבי',
        'text': 'טקסט',
        'video': 'וידאו',
        'image': 'תמונה',
        'pdf': 'מסמך PDF',
        'infographic': 'אינפוגרפיקה',
        'mindmap': 'מפת חשיבה',
        'podcast': 'פודקאסט'
    };
    return labels[type] || type;
};

// ============ ACTIVITY EXTRACTION ============

/**
 * Extracts selected blocks from a lesson plan and creates a new activity course
 *
 * Performance optimizations:
 * - Parallel database operations (addDoc + getDoc run concurrently)
 * - UUID-based IDs for better performance
 * - Optional progress callback for UI feedback
 */
export const extractActivityFromLesson = async (
    parentCourse: Course,
    parentUnit: LearningUnit,
    selectedBlockIds: string[],
    activityTitle?: string,
    onProgress?: ProgressCallback
): Promise<{ activityCourseId: string; shareUrl: string }> => {
    onProgress?.('מאתר בלוקים נבחרים...', 10);

    // Get the selected blocks
    const selectedBlocks = (parentUnit.activityBlocks || [])
        .filter(b => selectedBlockIds.includes(b.id));

    if (selectedBlocks.length === 0) {
        throw new Error('לא נבחרו בלוקים לשליחה');
    }

    onProgress?.('בונה פעילות...', 20);

    // Create the activity course with UUID-based IDs
    const moduleId = uuidv4();
    const unitId = uuidv4();

    const activityCourse: Partial<Course> = {
        teacherId: parentCourse.teacherId,
        title: activityTitle || `פעילות: ${parentUnit.title}`,
        targetAudience: parentCourse.targetAudience,
        gradeLevel: parentCourse.gradeLevel,
        subject: parentCourse.subject,
        mode: 'learning', // Activity mode
        syllabus: [{
            id: moduleId,
            title: parentUnit.title,
            learningUnits: [{
                id: unitId,
                title: parentUnit.title,
                goals: parentUnit.goals,
                type: 'practice',
                baseContent: '',
                activityBlocks: selectedBlocks.map(b => ({
                    ...b,
                    id: `${b.id}-${uuidv4().slice(0, 8)}` // UUID-based unique IDs
                }))
            }]
        }],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    // Add metadata to link back to parent
    (activityCourse as any).productType = 'activity';
    (activityCourse as any).parentLesson = {
        courseId: parentCourse.id,
        unitId: parentUnit.id,
        title: parentCourse.title,
        extractedBlockIds: selectedBlockIds,
        extractedAt: new Date().toISOString()
    };

    onProgress?.('שומר למסד נתונים...', 40);

    // PERFORMANCE: Run addDoc and getDoc in PARALLEL
    const parentCourseRef = doc(db, 'courses', parentCourse.id);
    const [docRef, parentDoc] = await Promise.all([
        addDoc(collection(db, 'courses'), activityCourse),
        getDoc(parentCourseRef)
    ]);

    const activityCourseId = docRef.id;

    onProgress?.('מעדכן קישורים...', 70);

    // Update parent with new activity reference
    if (parentDoc.exists()) {
        const existingExtracted = parentDoc.data().extractedActivities || [];
        await updateDoc(parentCourseRef, {
            extractedActivities: [...existingExtracted, {
                activityCourseId,
                blockIds: selectedBlockIds,
                title: activityCourse.title,
                createdAt: new Date().toISOString()
            }],
            updatedAt: serverTimestamp()
        });
    }

    onProgress?.('מייצר קישור שיתוף...', 90);

    // Generate share URL
    const shareUrl = `${window.location.origin}/?studentCourseId=${activityCourseId}`;

    onProgress?.('הושלם!', 100);

    return { activityCourseId, shareUrl };
};

/**
 * Extracts all interactive blocks from a lesson plan as a single activity
 */
export const extractAllActivities = async (
    parentCourse: Course,
    parentUnit: LearningUnit,
    activityTitle?: string,
    onProgress?: ProgressCallback
): Promise<{ activityCourseId: string; shareUrl: string }> => {
    const sendableBlocks = getSendableBlocks(parentUnit);
    const blockIds = sendableBlocks.map(b => b.id);

    return extractActivityFromLesson(
        parentCourse,
        parentUnit,
        blockIds,
        activityTitle || `כל הפעילויות: ${parentUnit.title}`,
        onProgress
    );
};

/**
 * Gets context text for a block (preceding text block content)
 */
export const getBlockContext = (
    blocks: ActivityBlock[],
    blockIndex: number
): string | null => {
    // Look backwards for the nearest text block
    for (let i = blockIndex - 1; i >= 0; i--) {
        const block = blocks[i];
        if (block.type === 'text') {
            const content = block.content;
            if (typeof content === 'string') return content;
            if (typeof content === 'object' && content !== null) {
                return (content as any).text || (content as any).teach_content || null;
            }
        }
    }
    return null;
};

/**
 * Groups blocks by their section (based on text block titles)
 */
export const groupBlocksBySections = (
    blocks: ActivityBlock[]
): { sectionTitle: string; blocks: ActivityBlock[] }[] => {
    const sections: { sectionTitle: string; blocks: ActivityBlock[] }[] = [];
    let currentSection: { sectionTitle: string; blocks: ActivityBlock[] } = {
        sectionTitle: 'כללי',
        blocks: []
    };

    blocks.forEach(block => {
        if (block.type === 'text') {
            const content = block.content;
            let title: string | null = null;

            // Extract title from text content
            if (typeof content === 'string') {
                const h3Match = content.match(/<h3[^>]*>(.*?)<\/h3>/i);
                if (h3Match) title = h3Match[1].replace(/<[^>]+>/g, '').trim();

                if (!title) {
                    const mdMatch = content.match(/^#+\s*(.+)/m);
                    if (mdMatch) title = mdMatch[1].trim();
                }
            }

            if (title) {
                // Save current section if it has blocks
                if (currentSection.blocks.length > 0) {
                    sections.push(currentSection);
                }
                // Start new section
                currentSection = { sectionTitle: title, blocks: [] };
            }
        }

        // Add interactive blocks to current section
        if (isBlockSendable(block)) {
            currentSection.blocks.push(block);
        }
    });

    // Add final section
    if (currentSection.blocks.length > 0) {
        sections.push(currentSection);
    }

    return sections;
};

// ============ STATISTICS ============

/**
 * Gets submission statistics for an extracted activity
 */
export const getActivityStats = async (activityCourseId: string): Promise<{
    totalSubmissions: number;
    avgScore: number;
    completionRate: number;
}> => {
    // This would query the submissions collection
    // For now, return placeholder
    return {
        totalSubmissions: 0,
        avgScore: 0,
        completionRate: 0
    };
};
