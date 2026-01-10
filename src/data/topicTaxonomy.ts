/**
 * Topic Taxonomy - Hierarchical structure of learning topics
 *
 * This enables:
 * 1. Multi-topic Proficiency Vector tracking
 * 2. Prerequisite detection for adaptive sequencing
 * 3. Parent-child mastery propagation
 *
 * Each topic can have:
 * - children: sub-topics that comprise it
 * - prerequisites: topics that must be mastered first
 * - gradeRange: appropriate grade levels
 */

export interface TopicNode {
    id: string;
    name: string;           // Hebrew display name
    nameEn?: string;        // English name (optional)
    children?: string[];    // Child topic IDs
    prerequisites?: string[]; // Required prior topics
    gradeRange?: {
        min: number;        // 1-12
        max: number;
    };
    bloomLevels?: string[]; // Typical Bloom levels for this topic
    estimatedHours?: number; // Typical learning time
}

export interface TopicTaxonomy {
    [topicId: string]: TopicNode;
}

// ==========================================
// MATHEMATICS TAXONOMY (Grades 1-6)
// ==========================================

export const MATH_TOPICS: TopicTaxonomy = {
    // --- ROOT: NUMBERS ---
    'numbers': {
        id: 'numbers',
        name: 'מספרים',
        nameEn: 'Numbers',
        children: ['counting', 'place_value', 'number_line', 'comparing_numbers'],
        gradeRange: { min: 1, max: 6 }
    },

    // Numbers - Children
    'counting': {
        id: 'counting',
        name: 'ספירה',
        nameEn: 'Counting',
        children: ['counting_1_10', 'counting_1_100', 'skip_counting'],
        gradeRange: { min: 1, max: 2 }
    },
    'counting_1_10': {
        id: 'counting_1_10',
        name: 'ספירה 1-10',
        nameEn: 'Counting 1-10',
        gradeRange: { min: 1, max: 1 },
        bloomLevels: ['Remember']
    },
    'counting_1_100': {
        id: 'counting_1_100',
        name: 'ספירה 1-100',
        nameEn: 'Counting 1-100',
        prerequisites: ['counting_1_10'],
        gradeRange: { min: 1, max: 2 },
        bloomLevels: ['Remember', 'Understand']
    },
    'skip_counting': {
        id: 'skip_counting',
        name: 'ספירה בדילוגים',
        nameEn: 'Skip Counting',
        prerequisites: ['counting_1_100'],
        gradeRange: { min: 1, max: 2 },
        bloomLevels: ['Understand', 'Apply']
    },

    'place_value': {
        id: 'place_value',
        name: 'ערך מקום',
        nameEn: 'Place Value',
        children: ['ones_tens', 'hundreds', 'thousands'],
        prerequisites: ['counting_1_100'],
        gradeRange: { min: 1, max: 4 }
    },
    'ones_tens': {
        id: 'ones_tens',
        name: 'אחדות ועשרות',
        nameEn: 'Ones and Tens',
        prerequisites: ['counting_1_100'],
        gradeRange: { min: 1, max: 2 }
    },
    'hundreds': {
        id: 'hundreds',
        name: 'מאות',
        nameEn: 'Hundreds',
        prerequisites: ['ones_tens'],
        gradeRange: { min: 2, max: 3 }
    },
    'thousands': {
        id: 'thousands',
        name: 'אלפים',
        nameEn: 'Thousands',
        prerequisites: ['hundreds'],
        gradeRange: { min: 3, max: 4 }
    },

    'number_line': {
        id: 'number_line',
        name: 'ישר המספרים',
        nameEn: 'Number Line',
        prerequisites: ['counting_1_100'],
        gradeRange: { min: 1, max: 4 },
        bloomLevels: ['Understand', 'Apply']
    },

    'comparing_numbers': {
        id: 'comparing_numbers',
        name: 'השוואת מספרים',
        nameEn: 'Comparing Numbers',
        prerequisites: ['place_value'],
        gradeRange: { min: 1, max: 3 },
        bloomLevels: ['Understand', 'Apply']
    },

    // --- ROOT: ARITHMETIC ---
    'arithmetic': {
        id: 'arithmetic',
        name: 'פעולות חשבון',
        nameEn: 'Arithmetic',
        children: ['addition', 'subtraction', 'multiplication', 'division'],
        prerequisites: ['numbers'],
        gradeRange: { min: 1, max: 6 }
    },

    // Arithmetic - Children
    'addition': {
        id: 'addition',
        name: 'חיבור',
        nameEn: 'Addition',
        children: ['addition_basic', 'addition_with_carry', 'addition_multi_digit'],
        prerequisites: ['counting'],
        gradeRange: { min: 1, max: 4 }
    },
    'addition_basic': {
        id: 'addition_basic',
        name: 'חיבור בסיסי',
        nameEn: 'Basic Addition',
        prerequisites: ['counting_1_10'],
        gradeRange: { min: 1, max: 1 },
        bloomLevels: ['Remember', 'Understand']
    },
    'addition_with_carry': {
        id: 'addition_with_carry',
        name: 'חיבור עם נשיאה',
        nameEn: 'Addition with Carrying',
        prerequisites: ['addition_basic', 'place_value'],
        gradeRange: { min: 2, max: 3 },
        bloomLevels: ['Apply']
    },
    'addition_multi_digit': {
        id: 'addition_multi_digit',
        name: 'חיבור מספרים רב-ספרתיים',
        nameEn: 'Multi-digit Addition',
        prerequisites: ['addition_with_carry', 'hundreds'],
        gradeRange: { min: 3, max: 4 },
        bloomLevels: ['Apply', 'Analyze']
    },

    'subtraction': {
        id: 'subtraction',
        name: 'חיסור',
        nameEn: 'Subtraction',
        children: ['subtraction_basic', 'subtraction_with_borrow', 'subtraction_multi_digit'],
        prerequisites: ['addition'],
        gradeRange: { min: 1, max: 4 }
    },
    'subtraction_basic': {
        id: 'subtraction_basic',
        name: 'חיסור בסיסי',
        nameEn: 'Basic Subtraction',
        prerequisites: ['addition_basic'],
        gradeRange: { min: 1, max: 2 },
        bloomLevels: ['Remember', 'Understand']
    },
    'subtraction_with_borrow': {
        id: 'subtraction_with_borrow',
        name: 'חיסור עם פריטה',
        nameEn: 'Subtraction with Borrowing',
        prerequisites: ['subtraction_basic', 'place_value'],
        gradeRange: { min: 2, max: 3 },
        bloomLevels: ['Apply']
    },
    'subtraction_multi_digit': {
        id: 'subtraction_multi_digit',
        name: 'חיסור מספרים רב-ספרתיים',
        nameEn: 'Multi-digit Subtraction',
        prerequisites: ['subtraction_with_borrow'],
        gradeRange: { min: 3, max: 4 },
        bloomLevels: ['Apply', 'Analyze']
    },

    'multiplication': {
        id: 'multiplication',
        name: 'כפל',
        nameEn: 'Multiplication',
        children: ['multiplication_concept', 'times_tables', 'multiplication_multi_digit'],
        prerequisites: ['addition'],
        gradeRange: { min: 2, max: 5 }
    },
    'multiplication_concept': {
        id: 'multiplication_concept',
        name: 'מושג הכפל',
        nameEn: 'Multiplication Concept',
        prerequisites: ['skip_counting', 'addition_basic'],
        gradeRange: { min: 2, max: 2 },
        bloomLevels: ['Understand']
    },
    'times_tables': {
        id: 'times_tables',
        name: 'לוח הכפל',
        nameEn: 'Times Tables',
        prerequisites: ['multiplication_concept'],
        gradeRange: { min: 2, max: 4 },
        bloomLevels: ['Remember'],
        estimatedHours: 20
    },
    'multiplication_multi_digit': {
        id: 'multiplication_multi_digit',
        name: 'כפל מספרים רב-ספרתיים',
        nameEn: 'Multi-digit Multiplication',
        prerequisites: ['times_tables', 'place_value'],
        gradeRange: { min: 4, max: 5 },
        bloomLevels: ['Apply', 'Analyze']
    },

    'division': {
        id: 'division',
        name: 'חילוק',
        nameEn: 'Division',
        children: ['division_concept', 'division_basic', 'division_with_remainder', 'long_division'],
        prerequisites: ['multiplication'],
        gradeRange: { min: 2, max: 6 }
    },
    'division_concept': {
        id: 'division_concept',
        name: 'מושג החילוק',
        nameEn: 'Division Concept',
        prerequisites: ['multiplication_concept'],
        gradeRange: { min: 2, max: 3 },
        bloomLevels: ['Understand']
    },
    'division_basic': {
        id: 'division_basic',
        name: 'חילוק בסיסי',
        nameEn: 'Basic Division',
        prerequisites: ['division_concept', 'times_tables'],
        gradeRange: { min: 3, max: 4 },
        bloomLevels: ['Apply']
    },
    'division_with_remainder': {
        id: 'division_with_remainder',
        name: 'חילוק עם שארית',
        nameEn: 'Division with Remainder',
        prerequisites: ['division_basic'],
        gradeRange: { min: 3, max: 4 },
        bloomLevels: ['Apply', 'Analyze']
    },
    'long_division': {
        id: 'long_division',
        name: 'חילוק ארוך',
        nameEn: 'Long Division',
        prerequisites: ['division_with_remainder', 'multiplication_multi_digit'],
        gradeRange: { min: 4, max: 6 },
        bloomLevels: ['Apply', 'Analyze']
    },

    // --- ROOT: FRACTIONS ---
    'fractions': {
        id: 'fractions',
        name: 'שברים',
        nameEn: 'Fractions',
        children: ['fraction_basics', 'equivalent_fractions', 'fraction_operations', 'mixed_numbers'],
        prerequisites: ['division'],
        gradeRange: { min: 3, max: 6 }
    },
    'fraction_basics': {
        id: 'fraction_basics',
        name: 'יסודות השברים',
        nameEn: 'Fraction Basics',
        prerequisites: ['division_concept'],
        gradeRange: { min: 3, max: 4 },
        bloomLevels: ['Remember', 'Understand']
    },
    'equivalent_fractions': {
        id: 'equivalent_fractions',
        name: 'שברים שקולים',
        nameEn: 'Equivalent Fractions',
        prerequisites: ['fraction_basics', 'multiplication'],
        gradeRange: { min: 4, max: 5 },
        bloomLevels: ['Understand', 'Apply']
    },
    'fraction_operations': {
        id: 'fraction_operations',
        name: 'פעולות בשברים',
        nameEn: 'Fraction Operations',
        children: ['fraction_addition', 'fraction_subtraction', 'fraction_multiplication', 'fraction_division'],
        prerequisites: ['equivalent_fractions'],
        gradeRange: { min: 4, max: 6 }
    },
    'fraction_addition': {
        id: 'fraction_addition',
        name: 'חיבור שברים',
        nameEn: 'Adding Fractions',
        prerequisites: ['equivalent_fractions'],
        gradeRange: { min: 4, max: 5 },
        bloomLevels: ['Apply']
    },
    'fraction_subtraction': {
        id: 'fraction_subtraction',
        name: 'חיסור שברים',
        nameEn: 'Subtracting Fractions',
        prerequisites: ['fraction_addition'],
        gradeRange: { min: 4, max: 5 },
        bloomLevels: ['Apply']
    },
    'fraction_multiplication': {
        id: 'fraction_multiplication',
        name: 'כפל שברים',
        nameEn: 'Multiplying Fractions',
        prerequisites: ['fraction_basics', 'multiplication'],
        gradeRange: { min: 5, max: 6 },
        bloomLevels: ['Apply', 'Analyze']
    },
    'fraction_division': {
        id: 'fraction_division',
        name: 'חילוק שברים',
        nameEn: 'Dividing Fractions',
        prerequisites: ['fraction_multiplication'],
        gradeRange: { min: 5, max: 6 },
        bloomLevels: ['Apply', 'Analyze']
    },
    'mixed_numbers': {
        id: 'mixed_numbers',
        name: 'מספרים מעורבים',
        nameEn: 'Mixed Numbers',
        prerequisites: ['fraction_basics'],
        gradeRange: { min: 4, max: 6 },
        bloomLevels: ['Understand', 'Apply']
    },

    // --- ROOT: DECIMALS ---
    'decimals': {
        id: 'decimals',
        name: 'מספרים עשרוניים',
        nameEn: 'Decimals',
        children: ['decimal_concept', 'decimal_operations', 'decimal_fraction_conversion'],
        prerequisites: ['fractions', 'place_value'],
        gradeRange: { min: 4, max: 6 }
    },
    'decimal_concept': {
        id: 'decimal_concept',
        name: 'מושג המספר העשרוני',
        nameEn: 'Decimal Concept',
        prerequisites: ['fraction_basics', 'place_value'],
        gradeRange: { min: 4, max: 5 },
        bloomLevels: ['Understand']
    },
    'decimal_operations': {
        id: 'decimal_operations',
        name: 'פעולות במספרים עשרוניים',
        nameEn: 'Decimal Operations',
        prerequisites: ['decimal_concept'],
        gradeRange: { min: 5, max: 6 },
        bloomLevels: ['Apply']
    },
    'decimal_fraction_conversion': {
        id: 'decimal_fraction_conversion',
        name: 'המרה בין שברים לעשרוניים',
        nameEn: 'Decimal-Fraction Conversion',
        prerequisites: ['decimal_concept', 'equivalent_fractions'],
        gradeRange: { min: 5, max: 6 },
        bloomLevels: ['Apply', 'Analyze']
    },

    // --- ROOT: GEOMETRY ---
    'geometry': {
        id: 'geometry',
        name: 'גיאומטריה',
        nameEn: 'Geometry',
        children: ['shapes_2d', 'shapes_3d', 'measurement', 'area_perimeter'],
        gradeRange: { min: 1, max: 6 }
    },
    'shapes_2d': {
        id: 'shapes_2d',
        name: 'צורות דו-ממדיות',
        nameEn: '2D Shapes',
        children: ['basic_shapes', 'triangles', 'quadrilaterals'],
        gradeRange: { min: 1, max: 4 }
    },
    'basic_shapes': {
        id: 'basic_shapes',
        name: 'צורות בסיסיות',
        nameEn: 'Basic Shapes',
        gradeRange: { min: 1, max: 2 },
        bloomLevels: ['Remember', 'Understand']
    },
    'triangles': {
        id: 'triangles',
        name: 'משולשים',
        nameEn: 'Triangles',
        prerequisites: ['basic_shapes'],
        gradeRange: { min: 3, max: 5 },
        bloomLevels: ['Understand', 'Apply']
    },
    'quadrilaterals': {
        id: 'quadrilaterals',
        name: 'מרובעים',
        nameEn: 'Quadrilaterals',
        prerequisites: ['basic_shapes'],
        gradeRange: { min: 3, max: 5 },
        bloomLevels: ['Understand', 'Apply']
    },
    'shapes_3d': {
        id: 'shapes_3d',
        name: 'צורות תלת-ממדיות',
        nameEn: '3D Shapes',
        prerequisites: ['shapes_2d'],
        gradeRange: { min: 2, max: 5 },
        bloomLevels: ['Understand', 'Apply']
    },
    'measurement': {
        id: 'measurement',
        name: 'מדידה',
        nameEn: 'Measurement',
        children: ['length', 'weight', 'time', 'money'],
        gradeRange: { min: 1, max: 4 }
    },
    'length': {
        id: 'length',
        name: 'אורך',
        nameEn: 'Length',
        gradeRange: { min: 1, max: 3 }
    },
    'weight': {
        id: 'weight',
        name: 'משקל',
        nameEn: 'Weight',
        gradeRange: { min: 2, max: 4 }
    },
    'time': {
        id: 'time',
        name: 'זמן',
        nameEn: 'Time',
        gradeRange: { min: 1, max: 3 }
    },
    'money': {
        id: 'money',
        name: 'כסף',
        nameEn: 'Money',
        prerequisites: ['addition', 'subtraction'],
        gradeRange: { min: 1, max: 3 }
    },
    'area_perimeter': {
        id: 'area_perimeter',
        name: 'שטח והיקף',
        nameEn: 'Area and Perimeter',
        prerequisites: ['multiplication', 'shapes_2d'],
        gradeRange: { min: 3, max: 6 },
        bloomLevels: ['Apply', 'Analyze']
    },

    // --- ROOT: WORD PROBLEMS ---
    'word_problems': {
        id: 'word_problems',
        name: 'בעיות מילוליות',
        nameEn: 'Word Problems',
        prerequisites: ['arithmetic'],
        gradeRange: { min: 1, max: 6 },
        bloomLevels: ['Apply', 'Analyze', 'Evaluate']
    }
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Get all prerequisites for a topic (recursively)
 */
export const getAllPrerequisites = (topicId: string, taxonomy: TopicTaxonomy = MATH_TOPICS): string[] => {
    const topic = taxonomy[topicId];
    if (!topic || !topic.prerequisites) return [];

    const prereqs = new Set<string>();
    const stack = [...topic.prerequisites];

    while (stack.length > 0) {
        const current = stack.pop()!;
        if (!prereqs.has(current)) {
            prereqs.add(current);
            const currentTopic = taxonomy[current];
            if (currentTopic?.prerequisites) {
                stack.push(...currentTopic.prerequisites);
            }
        }
    }

    return Array.from(prereqs);
};

/**
 * Get parent topic(s) that contain this topic as a child
 */
export const getParentTopics = (topicId: string, taxonomy: TopicTaxonomy = MATH_TOPICS): string[] => {
    const parents: string[] = [];

    for (const [id, topic] of Object.entries(taxonomy)) {
        if (topic.children?.includes(topicId)) {
            parents.push(id);
        }
    }

    return parents;
};

/**
 * Get all child topics (recursively)
 */
export const getAllChildren = (topicId: string, taxonomy: TopicTaxonomy = MATH_TOPICS): string[] => {
    const topic = taxonomy[topicId];
    if (!topic || !topic.children) return [];

    const children = new Set<string>();
    const stack = [...topic.children];

    while (stack.length > 0) {
        const current = stack.pop()!;
        if (!children.has(current)) {
            children.add(current);
            const currentTopic = taxonomy[current];
            if (currentTopic?.children) {
                stack.push(...currentTopic.children);
            }
        }
    }

    return Array.from(children);
};

/**
 * Check if student can learn a topic based on prerequisites mastery
 */
export const canLearnTopic = (
    topicId: string,
    masteryVector: Record<string, number>,
    threshold: number = 0.7,
    taxonomy: TopicTaxonomy = MATH_TOPICS
): boolean => {
    const prereqs = getAllPrerequisites(topicId, taxonomy);

    for (const prereq of prereqs) {
        const mastery = masteryVector[prereq] ?? 0;
        if (mastery < threshold) {
            return false;
        }
    }

    return true;
};

/**
 * Get recommended next topics based on current mastery
 */
export const getRecommendedTopics = (
    masteryVector: Record<string, number>,
    grade: number,
    maxRecommendations: number = 3,
    taxonomy: TopicTaxonomy = MATH_TOPICS
): string[] => {
    const recommendations: { id: string; priority: number }[] = [];

    for (const [topicId, topic] of Object.entries(taxonomy)) {
        // Check grade range
        if (topic.gradeRange) {
            if (grade < topic.gradeRange.min || grade > topic.gradeRange.max) {
                continue;
            }
        }

        const currentMastery = masteryVector[topicId] ?? 0;

        // Skip if already mastered
        if (currentMastery >= 0.9) continue;

        // Check if prerequisites are met
        if (canLearnTopic(topicId, masteryVector, 0.6, taxonomy)) {
            // Priority: lower mastery + closer to grade level = higher priority
            const gradeMatch = topic.gradeRange
                ? 1 - Math.abs(grade - (topic.gradeRange.min + topic.gradeRange.max) / 2) / 6
                : 0.5;
            const priority = (1 - currentMastery) * 0.6 + gradeMatch * 0.4;

            recommendations.push({ id: topicId, priority });
        }
    }

    // Sort by priority (highest first) and return top N
    return recommendations
        .sort((a, b) => b.priority - a.priority)
        .slice(0, maxRecommendations)
        .map(r => r.id);
};

/**
 * Calculate aggregate mastery for a parent topic based on children
 */
export const calculateParentMastery = (
    parentTopicId: string,
    masteryVector: Record<string, number>,
    taxonomy: TopicTaxonomy = MATH_TOPICS
): number => {
    const children = getAllChildren(parentTopicId, taxonomy);

    if (children.length === 0) {
        return masteryVector[parentTopicId] ?? 0;
    }

    let totalMastery = 0;
    let count = 0;

    for (const childId of children) {
        const mastery = masteryVector[childId];
        if (mastery !== undefined) {
            totalMastery += mastery;
            count++;
        }
    }

    return count > 0 ? totalMastery / count : 0;
};
