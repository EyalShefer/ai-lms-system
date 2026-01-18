import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Group types for adaptive content delivery:
 * - הבנה (Understanding) - for struggling students
 * - יישום (Application) - for standard students
 * - העמקה (Deepening) - for advanced students
 */
export type GroupType = 'הבנה' | 'יישום' | 'העמקה';

interface AIConfig {
    bloom_level: string;
    system_instruction: string;
    preferred_modules: string[];
    difficulty: string;
    tone: string;
    focus?: string;
    format?: string;
    extra?: string;
}

/**
 * Generates the specific AI configuration based on the group type.
 * Acts as a "Prompt Modifier" logic layer.
 */
export const generateGroupConfig = (topic: string, groupType: GroupType): AIConfig => {
    switch (groupType) {
        case 'הבנה': // Understanding - for struggling students
            return {
                difficulty: "Easy",
                bloom_level: "Remember/Understand",
                system_instruction: `Topic: ${topic}. Break down complex terms. Use simple language. Provide immediate positive feedback.`,
                tone: "Encouraging",
                preferred_modules: ["memory_game", "sorting", "simple_quiz"],
                focus: "Core Concepts & Visuals"
            };
        case 'העמקה': // Deepening - for advanced students
            return {
                difficulty: "Hard",
                bloom_level: "Analyze/Evaluate",
                system_instruction: `Topic: ${topic}. Ask open-ended questions that require synthesis. Reduce hints.`,
                tone: "Intellectual",
                preferred_modules: ["open_question", "logic_ordering", "case_study"],
                format: "Escape Room / Riddle",
                extra: "Critical Thinking Questions"
            };
        case 'יישום': // Application - standard level
        default:
            return {
                difficulty: "Medium",
                bloom_level: "Apply/Analyze",
                system_instruction: `Topic: ${topic}. Standard Curriculum. Balanced approach.`,
                tone: "Balanced",
                preferred_modules: ["multiple_choice", "matching", "short_answer"]
            };
    }
};

/**
 * Pushes a new job to the Firestore Queue for the AI Worker to pick up.
 */
export const assignLessonToGroup = async (
    teacherId: string,
    classId: string,
    topic: string,
    groupType: GroupType,
    studentIds: string[]
) => {
    if (!topic || studentIds.length === 0) {
        throw new Error("Missing topic or students.");
    }

    const config = generateGroupConfig(topic, groupType);

    try {
        const docRef = await addDoc(collection(db, 'lesson_generation_queue'), {
            status: 'pending',
            createdAt: serverTimestamp(),
            teacherId,
            classId,
            topic,
            groupType,
            config, // The "Prompt Engineering" payload
            studentIds, // The auto-assignment target
            priority: groupType === 'הבנה' ? 'high' : 'normal' // Prioritize help for strugglers
        });

        console.log(`Job enqueued: ${docRef.id} for ${groupType} group.`);
        return docRef.id;
    } catch (error) {
        console.error("Error queueing lesson generation:", error);
        throw error;
    }
};
