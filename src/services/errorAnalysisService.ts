/**
 * Error Analysis Service
 *
 * Analyzes student errors to identify patterns and misconceptions.
 * Helps categorize mistakes for targeted intervention.
 *
 * Key Features:
 * - Pattern detection in mathematical answers
 * - Error classification (calculation, conceptual, careless)
 * - Automatic tag generation for error fingerprinting
 *
 * Created: 2026-01-23
 */

// ========================================
// ERROR TAG DEFINITIONS
// ========================================

/**
 * Common error types in mathematics
 */
export type ErrorTag =
    // Calculation errors
    | 'calculation_error'
    | 'arithmetic_error'
    | 'sign_error'
    | 'decimal_placement'
    | 'rounding_error'

    // Fraction errors
    | 'fraction_simplification'
    | 'fraction_comparison'
    | 'common_denominator'
    | 'improper_fraction'

    // Algebraic errors
    | 'variable_substitution'
    | 'equation_solving'
    | 'distributive_property'
    | 'combining_like_terms'

    // Geometric errors
    | 'formula_confusion'
    | 'unit_confusion'
    | 'angle_measurement'
    | 'perimeter_vs_area'

    // Conceptual errors
    | 'conceptual_misunderstanding'
    | 'order_of_operations'
    | 'negative_numbers'

    // Process errors
    | 'incomplete_solution'
    | 'skipped_steps'
    | 'wrong_method'
    | 'careless_error';

// ========================================
// ANALYSIS FUNCTIONS
// ========================================

/**
 * Analyzes a numeric answer to detect common error patterns
 *
 * @param correctAnswer - The correct numeric answer
 * @param studentAnswer - The student's answer
 * @returns Array of detected error tags
 */
export const analyzeNumericError = (
    correctAnswer: number,
    studentAnswer: number
): ErrorTag[] => {
    const tags: ErrorTag[] = [];

    // Sign error detection
    if (correctAnswer === -studentAnswer) {
        tags.push('sign_error');
        return tags; // Sign error is usually the primary issue
    }

    // Decimal placement error (off by factor of 10)
    if (Math.abs(correctAnswer * 10 - studentAnswer) < 0.01 ||
        Math.abs(correctAnswer / 10 - studentAnswer) < 0.01) {
        tags.push('decimal_placement');
        return tags;
    }

    // Rounding error (close but not exact)
    const percentageError = Math.abs((correctAnswer - studentAnswer) / correctAnswer);
    if (percentageError < 0.05) {
        tags.push('rounding_error');
        return tags;
    }

    // Small arithmetic error (within 1-5 units)
    const difference = Math.abs(correctAnswer - studentAnswer);
    if (difference > 0 && difference <= 5) {
        tags.push('arithmetic_error');
        return tags;
    }

    // General calculation error
    tags.push('calculation_error');
    return tags;
};

/**
 * Analyzes a fraction answer to detect common mistakes
 *
 * @param correctNumerator - Correct numerator
 * @param correctDenominator - Correct denominator
 * @param studentNumerator - Student's numerator
 * @param studentDenominator - Student's denominator
 * @returns Array of detected error tags
 */
export const analyzeFractionError = (
    correctNumerator: number,
    correctDenominator: number,
    studentNumerator: number,
    studentDenominator: number
): ErrorTag[] => {
    const tags: ErrorTag[] = [];

    // Check if values are equivalent fractions but not simplified
    const correctValue = correctNumerator / correctDenominator;
    const studentValue = studentNumerator / studentDenominator;

    if (Math.abs(correctValue - studentValue) < 0.001) {
        tags.push('fraction_simplification');
        return tags;
    }

    // Check if denominators are swapped (confusion)
    if (correctNumerator === studentDenominator && correctDenominator === studentNumerator) {
        tags.push('fraction_comparison');
        return tags;
    }

    // Check if student didn't find common denominator
    if (studentDenominator !== correctDenominator &&
        (correctDenominator % studentDenominator === 0 ||
         studentDenominator % correctDenominator === 0)) {
        tags.push('common_denominator');
        return tags;
    }

    // General fraction error
    tags.push('fraction_comparison');
    return tags;
};

/**
 * Analyzes a multiple-choice selection to understand the mistake
 *
 * @param correctAnswer - The correct choice (e.g., "A")
 * @param studentAnswer - The student's choice
 * @param questionType - Type of question (helps contextualize)
 * @returns Array of detected error tags
 */
export const analyzeMultipleChoiceError = (
    correctAnswer: string,
    studentAnswer: string,
    questionType?: string
): ErrorTag[] => {
    const tags: ErrorTag[] = [];

    // For now, we can't deeply analyze MC without knowing the options
    // But we can provide contextual tags

    if (questionType?.includes('fraction')) {
        tags.push('fraction_comparison');
    } else if (questionType?.includes('geometry')) {
        tags.push('formula_confusion');
    } else if (questionType?.includes('algebra')) {
        tags.push('equation_solving');
    } else {
        tags.push('conceptual_misunderstanding');
    }

    return tags;
};

/**
 * Analyzes open-ended text answer (basic pattern matching)
 *
 * @param correctAnswer - Expected answer (string or number)
 * @param studentAnswer - Student's text answer
 * @returns Array of detected error tags
 */
export const analyzeTextError = (
    correctAnswer: string,
    studentAnswer: string
): ErrorTag[] => {
    const tags: ErrorTag[] = [];

    // Check if answer is empty or too short
    if (!studentAnswer || studentAnswer.trim().length < 2) {
        tags.push('incomplete_solution');
        return tags;
    }

    // Check if numeric answers are embedded
    const correctNum = parseFloat(correctAnswer);
    const studentNum = parseFloat(studentAnswer);

    if (!isNaN(correctNum) && !isNaN(studentNum)) {
        // Delegate to numeric analysis
        return analyzeNumericError(correctNum, studentNum);
    }

    // Check for sign-related words
    if ((correctAnswer.includes('-') || correctAnswer.includes('negative')) &&
        !(studentAnswer.includes('-') || studentAnswer.includes('negative'))) {
        tags.push('sign_error');
        return tags;
    }

    // Default to conceptual misunderstanding
    tags.push('conceptual_misunderstanding');
    return tags;
};

// ========================================
// HIGH-LEVEL ANALYSIS
// ========================================

/**
 * Main error analysis function - automatically detects error type
 *
 * @param questionType - Type of question (multiple-choice, numeric, fraction, etc.)
 * @param correctAnswer - The correct answer (can be number, string, object)
 * @param studentAnswer - The student's answer
 * @param metadata - Additional context about the question
 * @returns Array of error tags
 */
export const analyzeError = (
    questionType: string,
    correctAnswer: any,
    studentAnswer: any,
    metadata?: {
        topic?: string;
        difficulty?: string;
        attemptCount?: number;
    }
): ErrorTag[] => {
    try {
        // Multiple choice
        if (questionType === 'multiple-choice') {
            return analyzeMultipleChoiceError(
                String(correctAnswer),
                String(studentAnswer),
                metadata?.topic
            );
        }

        // Numeric answers
        if (typeof correctAnswer === 'number' && typeof studentAnswer === 'number') {
            return analyzeNumericError(correctAnswer, studentAnswer);
        }

        // Fraction answers (object with numerator/denominator)
        if (typeof correctAnswer === 'object' && correctAnswer.numerator !== undefined) {
            return analyzeFractionError(
                correctAnswer.numerator,
                correctAnswer.denominator,
                studentAnswer.numerator || 0,
                studentAnswer.denominator || 1
            );
        }

        // Text answers
        if (typeof correctAnswer === 'string' && typeof studentAnswer === 'string') {
            return analyzeTextError(correctAnswer, studentAnswer);
        }

        // Fallback: careless error if multiple attempts
        if (metadata?.attemptCount && metadata.attemptCount > 2) {
            return ['careless_error'];
        }

        // Default: general conceptual error
        return ['conceptual_misunderstanding'];

    } catch (error) {
        console.error('Error analyzing mistake:', error);
        return ['calculation_error']; // Safe fallback
    }
};

/**
 * Batch analyze multiple errors to find common patterns
 *
 * @param errors - Array of error analyses
 * @returns Most common error tags
 */
export const findCommonPatterns = (errors: ErrorTag[][]): {
    mostCommon: ErrorTag[];
    frequency: Record<string, number>;
} => {
    const frequency: Record<string, number> = {};

    // Count occurrences
    errors.forEach(errorTags => {
        errorTags.forEach(tag => {
            frequency[tag] = (frequency[tag] || 0) + 1;
        });
    });

    // Sort by frequency
    const sorted = Object.entries(frequency)
        .sort(([, a], [, b]) => b - a)
        .map(([tag]) => tag as ErrorTag);

    return {
        mostCommon: sorted.slice(0, 3), // Top 3 patterns
        frequency
    };
};

/**
 * Get human-readable explanation for an error tag
 *
 * @param tag - The error tag
 * @returns Hebrew explanation
 */
export const getErrorExplanation = (tag: ErrorTag): string => {
    const explanations: Record<ErrorTag, string> = {
        // Calculation
        calculation_error: 'שגיאת חישוב כללית',
        arithmetic_error: 'טעות בחישוב אריתמטי',
        sign_error: 'טעות בסימן (חיובי/שלילי)',
        decimal_placement: 'טעות במיקום הנקודה העשרונית',
        rounding_error: 'טעות בעיגול',

        // Fractions
        fraction_simplification: 'לא צמצם שבר עד הסוף',
        fraction_comparison: 'טעות בהשוואת שברים',
        common_denominator: 'לא מצא מכנה משותף',
        improper_fraction: 'טעות בשבר לא צמוד',

        // Algebra
        variable_substitution: 'טעות בהצבת משתנים',
        equation_solving: 'טעות בפתרון משוואה',
        distributive_property: 'טעות בתכונת הפילוג',
        combining_like_terms: 'טעות באיסוף איברים דומים',

        // Geometry
        formula_confusion: 'בלבול בין נוסחאות',
        unit_confusion: 'בלבול ביחידות מידה',
        angle_measurement: 'טעות במדידת זוויות',
        perimeter_vs_area: 'בלבול בין היקף לשטח',

        // Conceptual
        conceptual_misunderstanding: 'אי הבנה רעיונית',
        order_of_operations: 'טעות בסדר פעולות חשבון',
        negative_numbers: 'קושי במספרים שליליים',

        // Process
        incomplete_solution: 'פתרון לא שלם',
        skipped_steps: 'דילג על שלבים',
        wrong_method: 'השתמש בשיטה שגויה',
        careless_error: 'טעות ברשלנות'
    };

    return explanations[tag] || 'שגיאה לא מזוהה';
};

// ========================================
// INTEGRATION HELPERS
// ========================================

/**
 * Convert error tags to a user-friendly message
 *
 * @param tags - Array of error tags
 * @returns Hebrew message for student
 */
export const getStudentFeedback = (tags: ErrorTag[]): string => {
    if (tags.length === 0) {
        return 'שים לב לפרטים הקטנים';
    }

    const primaryTag = tags[0];
    const explanation = getErrorExplanation(primaryTag);

    const suggestions: Record<string, string> = {
        sign_error: 'כדאי לשים לב לסימנים (+ או -) בכל שלב',
        calculation_error: 'נסה לבדוק את החישוב שוב בעזרת משוואה',
        fraction_simplification: 'זכור לצמצם שברים עד הסוף',
        conceptual_misunderstanding: 'כדאי לחזור על הרעיון הבסיסי',
        careless_error: 'קח עוד רגע לבדוק את התשובה'
    };

    const suggestion = suggestions[primaryTag] || 'נסה לחשוב על הבעיה מזווית אחרת';

    return `${explanation}. ${suggestion}`;
};

/**
 * Example usage in SessionInteraction:
 *
 * ```typescript
 * import { analyzeError } from './errorAnalysisService';
 *
 * // When student answers incorrectly:
 * const errorTags = analyzeError(
 *     'numeric',
 *     42,
 *     -42,
 *     { topic: 'algebra', attemptCount: 1 }
 * );
 *
 * const interaction: SessionInteraction = {
 *     questionId: 'q1',
 *     type: 'numeric',
 *     isCorrect: false,
 *     attemptCount: 1,
 *     timeSpentSec: 45,
 *     hintsUsed: 0,
 *     timestamp: Date.now(),
 *     errorTags: errorTags, // ['sign_error']
 *     wrongAnswer: -42
 * };
 * ```
 */
