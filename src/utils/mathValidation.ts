/**
 * Math Answer Validation Utilities
 *
 * Validates student answers for math questions, supporting:
 * - Multiple equivalent formats (0.5 = 1/2 = ½)
 * - Tolerance for decimal answers
 * - Fraction normalization
 * - Hebrew and English number formats
 */

// Unicode fraction characters mapping
const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2',
  '⅓': '1/3',
  '⅔': '2/3',
  '¼': '1/4',
  '¾': '3/4',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

// Common math symbols that students might type
const SYMBOL_NORMALIZATIONS: Record<string, string> = {
  '×': '*',
  '÷': '/',
  '−': '-',  // Unicode minus
  '–': '-',  // En dash
  '—': '-',  // Em dash
  ',': '.',  // European decimal separator
  '״': '"',  // Hebrew gershayim
  '׳': "'",  // Hebrew geresh
};

export interface MathValidationOptions {
  tolerance?: number;           // For decimal answers (default: 0)
  allowFractions?: boolean;     // Accept fraction input (default: true)
  allowDecimals?: boolean;      // Accept decimal input (default: true)
  caseSensitive?: boolean;      // For text answers like units (default: false)
  normalizeSpaces?: boolean;    // Remove extra spaces (default: true)
  acceptEquivalent?: boolean;   // Accept 0.5 for 1/2 (default: true)
}

export interface ValidationResult {
  isCorrect: boolean;
  normalizedInput: string;
  normalizedExpected: string;
  feedback?: string;
  partialCredit?: number;  // 0-100 for partial answers
}

/**
 * Normalize a string for comparison
 */
function normalizeString(input: string, options: MathValidationOptions = {}): string {
  let normalized = input.trim();

  // Replace Unicode fractions with standard format
  for (const [unicode, standard] of Object.entries(UNICODE_FRACTIONS)) {
    normalized = normalized.replace(new RegExp(unicode, 'g'), standard);
  }

  // Replace math symbols
  for (const [symbol, standard] of Object.entries(SYMBOL_NORMALIZATIONS)) {
    normalized = normalized.replace(new RegExp(symbol, 'g'), standard);
  }

  // Normalize spaces
  if (options.normalizeSpaces !== false) {
    normalized = normalized.replace(/\s+/g, ' ').trim();
    // Remove spaces around operators
    normalized = normalized.replace(/\s*([+\-*/=])\s*/g, '$1');
  }

  // Case insensitive
  if (!options.caseSensitive) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}

/**
 * Convert a fraction string to decimal
 */
function fractionToDecimal(fraction: string): number | null {
  // Handle simple fractions like "3/4"
  const fractionMatch = fraction.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1], 10);
    const denominator = parseInt(fractionMatch[2], 10);
    if (denominator !== 0) {
      return numerator / denominator;
    }
  }

  // Handle mixed numbers like "1 1/2" or "1-1/2"
  const mixedMatch = fraction.match(/^(-?\d+)\s*[- ]\s*(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const numerator = parseInt(mixedMatch[2], 10);
    const denominator = parseInt(mixedMatch[3], 10);
    if (denominator !== 0) {
      const sign = whole < 0 ? -1 : 1;
      return whole + sign * (numerator / denominator);
    }
  }

  return null;
}

/**
 * Parse a number from various formats
 */
function parseNumber(input: string): number | null {
  const normalized = normalizeString(input);

  // Try direct number parsing
  const directNumber = parseFloat(normalized);
  if (!isNaN(directNumber)) {
    return directNumber;
  }

  // Try fraction parsing
  const fractionValue = fractionToDecimal(normalized);
  if (fractionValue !== null) {
    return fractionValue;
  }

  return null;
}

/**
 * Check if two numbers are equal within tolerance
 */
function numbersEqual(a: number, b: number, tolerance: number = 0): boolean {
  if (tolerance === 0) {
    return a === b;
  }
  return Math.abs(a - b) <= tolerance;
}

/**
 * Reduce a fraction to lowest terms
 */
function reduceFraction(numerator: number, denominator: number): [number, number] {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(Math.abs(numerator), Math.abs(denominator));
  return [numerator / divisor, denominator / divisor];
}

/**
 * Main validation function for math answers
 */
export function validateMathAnswer(
  studentAnswer: string,
  expectedAnswer: string,
  options: MathValidationOptions = {}
): ValidationResult {
  const opts: MathValidationOptions = {
    tolerance: 0,
    allowFractions: true,
    allowDecimals: true,
    caseSensitive: false,
    normalizeSpaces: true,
    acceptEquivalent: true,
    ...options
  };

  const normalizedInput = normalizeString(studentAnswer, opts);
  const normalizedExpected = normalizeString(expectedAnswer, opts);

  // Direct string match (fastest path)
  if (normalizedInput === normalizedExpected) {
    return {
      isCorrect: true,
      normalizedInput,
      normalizedExpected
    };
  }

  // Try numeric comparison
  const studentNum = parseNumber(studentAnswer);
  const expectedNum = parseNumber(expectedAnswer);

  if (studentNum !== null && expectedNum !== null) {
    if (opts.acceptEquivalent && numbersEqual(studentNum, expectedNum, opts.tolerance || 0)) {
      return {
        isCorrect: true,
        normalizedInput,
        normalizedExpected,
        feedback: studentNum === expectedNum ? undefined : 'תשובה שקולה מתקבלת'
      };
    }
  }

  // Not correct
  return {
    isCorrect: false,
    normalizedInput,
    normalizedExpected,
    feedback: generateFeedback(studentAnswer, expectedAnswer, studentNum, expectedNum)
  };
}

/**
 * Generate helpful feedback for incorrect answers
 */
function generateFeedback(
  studentAnswer: string,
  expectedAnswer: string,
  studentNum: number | null,
  expectedNum: number | null
): string {
  // Empty answer
  if (!studentAnswer.trim()) {
    return 'לא הוזנה תשובה';
  }

  // Could not parse student's answer as a number
  if (studentNum === null && expectedNum !== null) {
    return 'נסה להזין מספר';
  }

  // Close but not exact
  if (studentNum !== null && expectedNum !== null) {
    const diff = Math.abs(studentNum - expectedNum);
    const percentDiff = (diff / Math.abs(expectedNum)) * 100;

    if (percentDiff < 10) {
      return 'קרוב! בדוק את החישוב שוב';
    }

    // Check for common errors
    if (studentNum === -expectedNum) {
      return 'בדוק את הסימן (+ או -)';
    }

    // Off by factor of 10
    if (studentNum === expectedNum * 10 || studentNum === expectedNum / 10) {
      return 'בדוק את מיקום הנקודה העשרונית';
    }
  }

  return 'נסה שוב';
}

/**
 * Validate multiple answers (e.g., "2, 3" for quadratic equations)
 */
export function validateMultipleAnswers(
  studentAnswers: string,
  expectedAnswers: string[],
  options: MathValidationOptions = {}
): ValidationResult {
  // Split student answers by common delimiters
  const studentParts = studentAnswers
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (studentParts.length !== expectedAnswers.length) {
    return {
      isCorrect: false,
      normalizedInput: studentParts.join(', '),
      normalizedExpected: expectedAnswers.join(', '),
      feedback: `נדרשות ${expectedAnswers.length} תשובות`,
      partialCredit: 0
    };
  }

  // Check each answer (order doesn't matter)
  const matchedExpected = new Set<number>();
  let correctCount = 0;

  for (const studentPart of studentParts) {
    for (let i = 0; i < expectedAnswers.length; i++) {
      if (matchedExpected.has(i)) continue;

      const result = validateMathAnswer(studentPart, expectedAnswers[i], options);
      if (result.isCorrect) {
        matchedExpected.add(i);
        correctCount++;
        break;
      }
    }
  }

  const isCorrect = correctCount === expectedAnswers.length;
  const partialCredit = Math.round((correctCount / expectedAnswers.length) * 100);

  return {
    isCorrect,
    normalizedInput: studentParts.join(', '),
    normalizedExpected: expectedAnswers.join(', '),
    partialCredit: isCorrect ? 100 : partialCredit,
    feedback: isCorrect ? undefined : `${correctCount} מתוך ${expectedAnswers.length} תשובות נכונות`
  };
}

/**
 * Validate a fraction answer specifically
 */
export function validateFractionAnswer(
  studentAnswer: string,
  expectedNumerator: number,
  expectedDenominator: number,
  options: { requireReduced?: boolean } = {}
): ValidationResult {
  const normalized = normalizeString(studentAnswer);

  // Try to parse as fraction
  const fractionMatch = normalized.match(/^(-?\d+)\s*\/\s*(\d+)$/);

  if (!fractionMatch) {
    // Try decimal equivalent
    const decimal = parseNumber(studentAnswer);
    const expectedDecimal = expectedNumerator / expectedDenominator;

    if (decimal !== null && Math.abs(decimal - expectedDecimal) < 0.0001) {
      return {
        isCorrect: true,
        normalizedInput: normalized,
        normalizedExpected: `${expectedNumerator}/${expectedDenominator}`,
        feedback: 'תשובה עשרונית שקולה מתקבלת'
      };
    }

    return {
      isCorrect: false,
      normalizedInput: normalized,
      normalizedExpected: `${expectedNumerator}/${expectedDenominator}`,
      feedback: 'יש להזין שבר בפורמט מונה/מכנה'
    };
  }

  const studentNumerator = parseInt(fractionMatch[1], 10);
  const studentDenominator = parseInt(fractionMatch[2], 10);

  // Check equivalence
  const [reducedStudentNum, reducedStudentDen] = reduceFraction(studentNumerator, studentDenominator);
  const [reducedExpectedNum, reducedExpectedDen] = reduceFraction(expectedNumerator, expectedDenominator);

  const isEquivalent = reducedStudentNum === reducedExpectedNum &&
                       reducedStudentDen === reducedExpectedDen;

  if (!isEquivalent) {
    return {
      isCorrect: false,
      normalizedInput: `${studentNumerator}/${studentDenominator}`,
      normalizedExpected: `${expectedNumerator}/${expectedDenominator}`
    };
  }

  // Check if reduced (if required)
  if (options.requireReduced) {
    const isReduced = studentNumerator === reducedStudentNum &&
                      studentDenominator === reducedStudentDen;

    if (!isReduced) {
      return {
        isCorrect: false,
        normalizedInput: `${studentNumerator}/${studentDenominator}`,
        normalizedExpected: `${reducedExpectedNum}/${reducedExpectedDen}`,
        feedback: 'יש לצמצם את השבר',
        partialCredit: 80  // Give partial credit for correct but unreduced fraction
      };
    }
  }

  return {
    isCorrect: true,
    normalizedInput: `${studentNumerator}/${studentDenominator}`,
    normalizedExpected: `${expectedNumerator}/${expectedDenominator}`
  };
}

/**
 * Quick helper to check if an answer is numerically correct
 */
export function isNumericAnswerCorrect(
  studentAnswer: string,
  expectedAnswer: number,
  tolerance: number = 0
): boolean {
  const result = validateMathAnswer(
    studentAnswer,
    expectedAnswer.toString(),
    { tolerance }
  );
  return result.isCorrect;
}

/**
 * Grade-specific validation settings
 */
export const GRADE_VALIDATION_SETTINGS: Record<string, MathValidationOptions> = {
  'א': { tolerance: 0, allowFractions: false, allowDecimals: false },
  'ב': { tolerance: 0, allowFractions: false, allowDecimals: false },
  'ג': { tolerance: 0, allowFractions: true, allowDecimals: false },
  'ד': { tolerance: 0, allowFractions: true, allowDecimals: false },
  'ה': { tolerance: 0.01, allowFractions: true, allowDecimals: true },
  'ו': { tolerance: 0.01, allowFractions: true, allowDecimals: true },
  'ז': { tolerance: 0.001, allowFractions: true, allowDecimals: true },
  'ח': { tolerance: 0.001, allowFractions: true, allowDecimals: true },
  'ט': { tolerance: 0.001, allowFractions: true, allowDecimals: true },
};

/**
 * Get appropriate validation options for a grade level
 */
export function getValidationOptionsForGrade(grade: string): MathValidationOptions {
  return GRADE_VALIDATION_SETTINGS[grade] || GRADE_VALIDATION_SETTINGS['ו'];
}
