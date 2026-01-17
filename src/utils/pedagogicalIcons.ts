import {
    IconTarget,
    IconBook,
    IconVideo,
    IconJoystick,
    IconCheck,
    IconHeadphones,
    IconSparkles,
    IconText,
    IconImage,
    IconList,
    IconChat
} from '../icons';

/**
 * Pedagogical Icon Mapping
 * Creates consistency between Teacher Cockpit and Student View
 */

export type PedagogicalPhase = 'goals' | 'opening' | 'instruction' | 'practice' | 'summary';

export const PEDAGOGICAL_PHASES = {
    goals: {
        id: 'goals',
        label: 'יעדים',
        icon: IconTarget,
        color: 'blue',
        description: 'הצגת יעדי הלמידה'
    },
    opening: {
        id: 'opening',
        label: 'פתיחה',
        icon: IconBook,
        color: 'purple',
        description: 'Hook - פתיחה מעוררת עניין'
    },
    instruction: {
        id: 'instruction',
        label: 'הוראה',
        icon: IconVideo,
        color: 'green',
        description: 'הוראה ישירה והסבר'
    },
    practice: {
        id: 'practice',
        label: 'תרגול',
        icon: IconJoystick,
        color: 'orange',
        description: 'תרגול מודרך ועצמאי'
    },
    summary: {
        id: 'summary',
        label: 'סיכום',
        icon: IconCheck,
        color: 'teal',
        description: 'סיכום והערכה'
    }
} as const;

/**
 * Get icon for a specific block type
 * Maps block types to pedagogical phases
 */
export function getIconForBlockType(blockType: string): typeof IconBook {
    // Text content
    if (blockType === 'text') return IconText;

    // Image content
    if (blockType === 'image') return IconImage;

    // Video content → Instruction
    if (blockType === 'video') return PEDAGOGICAL_PHASES.instruction.icon;

    // Audio/Podcast → Headphones
    if (blockType === 'podcast' || blockType === 'audio-response') return IconHeadphones;

    // Multiple choice questions → List
    if (blockType === 'multiple-choice') return IconList;

    // Open questions → Chat
    if (blockType === 'open-question' || blockType === 'interactive-chat') return IconChat;

    // Interactive games → Practice (Joystick)
    if ([
        'memory_game', 'ordering', 'categorization', 'fill_in_blanks', 'true_false_speed',
        // 8 New Question Types
        'matching', 'highlight', 'sentence_builder', 'image_labeling',
        'table_completion', 'text_selection', 'rating_scale', 'matrix'
    ].includes(blockType)) {
        return PEDAGOGICAL_PHASES.practice.icon;
    }

    // Special content
    if (blockType === 'gem-link') return IconSparkles;

    // Default: Opening/Reading
    return PEDAGOGICAL_PHASES.opening.icon;
}

/**
 * Get pedagogical phase for a block based on its position and type
 */
export function getPedagogicalPhase(
    blockIndex: number,
    totalBlocks: number,
    blockType: string
): PedagogicalPhase {
    // First block → Goals or Opening
    if (blockIndex === 0) {
        return blockType.includes('goal') || blockType.includes('objective') ? 'goals' : 'opening';
    }

    // Last block → Summary
    if (blockIndex === totalBlocks - 1) {
        return 'summary';
    }

    // Questions/Assessments → Practice or Summary
    if (['multiple-choice', 'true_false_speed', 'open-question', 'rating_scale', 'matrix'].includes(blockType)) {
        return blockIndex > totalBlocks * 0.7 ? 'summary' : 'practice';
    }

    // Interactive games → Practice
    if ([
        'memory_game', 'ordering', 'categorization', 'fill_in_blanks',
        // 8 New Question Types
        'matching', 'highlight', 'sentence_builder', 'image_labeling',
        'table_completion', 'text_selection'
    ].includes(blockType)) {
        return 'practice';
    }

    // Video → Instruction
    if (blockType === 'video') {
        return 'instruction';
    }

    // Default → Instruction (middle blocks)
    return 'instruction';
}

/**
 * Get color class for a phase
 */
export function getPhaseColorClass(phase: PedagogicalPhase): string {
    const colors = {
        goals: 'text-blue-500',
        opening: 'text-purple-500',
        instruction: 'text-green-500',
        practice: 'text-orange-500',
        summary: 'text-teal-500'
    };
    return colors[phase];
}

/**
 * Get background color class for a phase
 */
export function getPhaseBgColorClass(phase: PedagogicalPhase): string {
    const colors = {
        goals: 'bg-blue-50 border-blue-200',
        opening: 'bg-purple-50 border-purple-200',
        instruction: 'bg-green-50 border-green-200',
        practice: 'bg-orange-50 border-orange-200',
        summary: 'bg-teal-50 border-teal-200'
    };
    return colors[phase];
}
