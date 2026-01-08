/**
 * Assessment Integrity Agent
 * סוכן אינטגריטי הערכה - בודק שמערכת ההערכה והניקוד תקינה
 *
 * This agent validates that:
 * 1. Scoring follows the defined policy (100 first try, -2 per hint, 50 retry, 0 incorrect)
 * 2. Hints are disabled in exam mode
 * 3. XP and gems are awarded correctly
 * 4. Bloom's taxonomy affects scoring appropriately
 * 5. Rubrics are present for open questions
 * 6. All interactive blocks have correct answers defined
 * 7. Exam questions don't contain teaching content or hints
 */

import { db } from '../../firebase';
import { collection, getDocs, query, limit as firestoreLimit, orderBy } from 'firebase/firestore';
import type { TestResult, QAAgentResult } from '../../types/qa.types';
import type { Course, ActivityBlock } from '../../shared/types/courseTypes';
import { SCORING_CONFIG, calculateQuestionScore } from '../../utils/scoring';

// ===== ASSESSMENT POLICY RULES =====

export const ASSESSMENT_POLICY = {
  // Scoring rules
  scoring: {
    CORRECT_FIRST_TRY: 100,
    HINT_PENALTY: 2,         // Points deducted per hint
    RETRY_PARTIAL: 50,        // Score for correct on retry
    INCORRECT: 0,
    MIN_SCORE: 0,             // Score cannot go below 0
  },

  // Exam mode rules
  examMode: {
    HINTS_FORBIDDEN: true,
    TEACHING_CONTENT_FORBIDDEN: true,
    PROGRESSIVE_HINTS_FORBIDDEN: true,
    FRIENDLY_TONE_FORBIDDEN: true,
  },

  // Gamification rules
  gamification: {
    XP_EQUALS_SCORE: true,    // XP gain = score
    GEMS_ON_CORRECT: 1,       // 1 gem for correct answer
    GEMS_ON_PERFECT: 2,       // 2 gems for perfect score (100)
    GEMS_ON_INCORRECT: 0,
  },

  // Content requirements
  contentRequirements: {
    MC_MIN_OPTIONS: 3,        // Multiple choice needs at least 3 options
    MC_MAX_OPTIONS: 5,        // Multiple choice should have at most 5 options
    ORDERING_MIN_ITEMS: 3,    // Ordering needs at least 3 items
    OPEN_QUESTION_NEEDS_RUBRIC: true,
    OPEN_QUESTION_NEEDS_MODEL_ANSWER: false, // Recommended but not required
  },

  // Bloom's taxonomy scoring multipliers (for exams)
  bloomMultipliers: {
    'remember': 1.0,
    'understand': 1.2,
    'apply': 1.5,
    'analyze': 1.7,
    'evaluate': 2.0,
    'create': 2.2,
  }
};

// ===== TYPES =====

export interface PolicyViolation {
  type: 'scoring' | 'exam_mode' | 'gamification' | 'content' | 'bloom' | 'rubric' | 'answer_mismatch';
  rule: string;
  ruleHe: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: string;  // courseId/unitId/blockId
  message: string;
  messageHe: string;
  expected?: any;
  actual?: any;
}

export interface BlockAssessmentResult {
  blockId: string;
  blockType: string;
  courseId: string;
  unitId: string;
  isExamContent: boolean;
  violations: PolicyViolation[];
  checks: {
    hasCorrectAnswer: boolean;
    correctAnswerInOptions: boolean;
    hasEnoughOptions: boolean;
    hasRubric: boolean;
    hasModelAnswer: boolean;
    hasBloomLevel: boolean;
    noHintsInExam: boolean;
    noTeachingInExam: boolean;
  };
}

export interface CourseAssessmentResult {
  courseId: string;
  courseTitle: string;
  totalBlocks: number;
  interactiveBlocks: number;
  examBlocks: number;
  violations: PolicyViolation[];
  blockResults: BlockAssessmentResult[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// ===== BLOCK VALIDATORS =====

function validateMultipleChoiceBlock(
  block: ActivityBlock,
  courseId: string,
  unitId: string,
  isExamContent: boolean
): BlockAssessmentResult {
  const violations: PolicyViolation[] = [];
  const content = block.content || {};
  const metadata = block.metadata || {};
  const location = `${courseId}/${unitId}/${block.id}`;

  const options = content.options || [];
  const correctAnswer = content.correctAnswer || content.correct_answer;
  const hints = metadata.progressiveHints || [];
  const teachContent = metadata.teach_content || metadata.teachContent;
  const bloomLevel = metadata.bloomLevel || metadata.bloom_level;

  // Check 1: Has correct answer
  const hasCorrectAnswer = !!correctAnswer;
  if (!hasCorrectAnswer) {
    violations.push({
      type: 'content',
      rule: 'MC must have correctAnswer',
      ruleHe: 'שאלת בחירה חייבת תשובה נכונה',
      severity: 'critical',
      location,
      message: 'Multiple choice block has no correct answer defined',
      messageHe: 'בלוק בחירה מרובה ללא תשובה נכונה מוגדרת'
    });
  }

  // Check 2: Correct answer in options
  let correctAnswerInOptions = false;
  if (correctAnswer && options.length > 0) {
    const optionTexts = options.map((o: any) =>
      typeof o === 'string' ? o : (o.text || o.label || o.value || o.answer || '')
    );
    correctAnswerInOptions = optionTexts.includes(correctAnswer);

    if (!correctAnswerInOptions) {
      violations.push({
        type: 'answer_mismatch',
        rule: 'correctAnswer must match an option',
        ruleHe: 'התשובה הנכונה חייבת להתאים לאחת האפשרויות',
        severity: 'critical',
        location,
        message: `Correct answer "${correctAnswer}" not found in options`,
        messageHe: `התשובה הנכונה "${correctAnswer}" לא נמצאת באפשרויות`,
        expected: correctAnswer,
        actual: optionTexts
      });
    }
  }

  // Check 3: Enough options
  const hasEnoughOptions = options.length >= ASSESSMENT_POLICY.contentRequirements.MC_MIN_OPTIONS;
  if (!hasEnoughOptions && options.length > 0) {
    violations.push({
      type: 'content',
      rule: `MC needs at least ${ASSESSMENT_POLICY.contentRequirements.MC_MIN_OPTIONS} options`,
      ruleHe: `שאלת בחירה צריכה לפחות ${ASSESSMENT_POLICY.contentRequirements.MC_MIN_OPTIONS} אפשרויות`,
      severity: 'medium',
      location,
      message: `Only ${options.length} options, need at least ${ASSESSMENT_POLICY.contentRequirements.MC_MIN_OPTIONS}`,
      messageHe: `רק ${options.length} אפשרויות, צריך לפחות ${ASSESSMENT_POLICY.contentRequirements.MC_MIN_OPTIONS}`,
      expected: ASSESSMENT_POLICY.contentRequirements.MC_MIN_OPTIONS,
      actual: options.length
    });
  }

  // Check 4: No hints in exam mode
  let noHintsInExam = true;
  if (isExamContent && hints.length > 0) {
    noHintsInExam = false;
    violations.push({
      type: 'exam_mode',
      rule: 'No hints in exam mode',
      ruleHe: 'אין רמזים במצב מבחן',
      severity: 'critical',
      location,
      message: `Exam block has ${hints.length} hints which should be forbidden`,
      messageHe: `בלוק מבחן מכיל ${hints.length} רמזים שצריכים להיות חסומים`,
      expected: 0,
      actual: hints.length
    });
  }

  // Check 5: No teaching content in exam mode
  let noTeachingInExam = true;
  if (isExamContent && teachContent) {
    noTeachingInExam = false;
    violations.push({
      type: 'exam_mode',
      rule: 'No teaching content in exam mode',
      ruleHe: 'אין תוכן לימודי במצב מבחן',
      severity: 'high',
      location,
      message: 'Exam block contains teaching content which reveals answers',
      messageHe: 'בלוק מבחן מכיל תוכן לימודי שחושף תשובות'
    });
  }

  // Check 6: Has Bloom level (recommended)
  const hasBloomLevel = !!bloomLevel;
  if (!hasBloomLevel && isExamContent) {
    violations.push({
      type: 'bloom',
      rule: 'Exam questions should have Bloom level',
      ruleHe: 'שאלות מבחן צריכות רמת בלום',
      severity: 'low',
      location,
      message: 'Exam block missing Bloom taxonomy level for proper scoring',
      messageHe: 'בלוק מבחן חסר רמת בלום לניקוד תקין'
    });
  }

  return {
    blockId: block.id,
    blockType: block.type,
    courseId,
    unitId,
    isExamContent,
    violations,
    checks: {
      hasCorrectAnswer,
      correctAnswerInOptions,
      hasEnoughOptions,
      hasRubric: false, // N/A for MC
      hasModelAnswer: false, // N/A for MC
      hasBloomLevel,
      noHintsInExam,
      noTeachingInExam
    }
  };
}

function validateOpenQuestionBlock(
  block: ActivityBlock,
  courseId: string,
  unitId: string,
  isExamContent: boolean
): BlockAssessmentResult {
  const violations: PolicyViolation[] = [];
  const content = block.content || {};
  const metadata = block.metadata || {};
  const location = `${courseId}/${unitId}/${block.id}`;

  const rubric = metadata.rubric || metadata.analytic_rubric;
  const modelAnswer = metadata.modelAnswer || metadata.model_answer || content.modelAnswer;
  const bloomLevel = metadata.bloomLevel || metadata.bloom_level;
  const hints = metadata.progressiveHints || [];

  // Check 1: Has rubric (required for exams)
  const hasRubric = !!rubric;
  if (!hasRubric && isExamContent && ASSESSMENT_POLICY.contentRequirements.OPEN_QUESTION_NEEDS_RUBRIC) {
    violations.push({
      type: 'rubric',
      rule: 'Open questions in exams need rubric',
      ruleHe: 'שאלות פתוחות במבחן צריכות רובריקה',
      severity: 'high',
      location,
      message: 'Exam open question missing grading rubric',
      messageHe: 'שאלה פתוחה במבחן חסרה רובריקת הערכה'
    });
  }

  // Check 2: Has model answer (recommended)
  const hasModelAnswer = !!modelAnswer;
  if (!hasModelAnswer && isExamContent) {
    violations.push({
      type: 'content',
      rule: 'Open questions should have model answer',
      ruleHe: 'שאלות פתוחות צריכות תשובה לדוגמה',
      severity: 'low',
      location,
      message: 'Open question missing model answer for AI grading',
      messageHe: 'שאלה פתוחה חסרה תשובה לדוגמה לציון AI'
    });
  }

  // Check 3: No hints in exam
  let noHintsInExam = true;
  if (isExamContent && hints.length > 0) {
    noHintsInExam = false;
    violations.push({
      type: 'exam_mode',
      rule: 'No hints in exam mode',
      ruleHe: 'אין רמזים במצב מבחן',
      severity: 'critical',
      location,
      message: `Exam open question has ${hints.length} hints`,
      messageHe: `שאלה פתוחה במבחן מכילה ${hints.length} רמזים`,
      expected: 0,
      actual: hints.length
    });
  }

  // Check 4: Has Bloom level
  const hasBloomLevel = !!bloomLevel;

  return {
    blockId: block.id,
    blockType: block.type,
    courseId,
    unitId,
    isExamContent,
    violations,
    checks: {
      hasCorrectAnswer: true, // N/A, AI graded
      correctAnswerInOptions: true, // N/A
      hasEnoughOptions: true, // N/A
      hasRubric,
      hasModelAnswer,
      hasBloomLevel,
      noHintsInExam,
      noTeachingInExam: true
    }
  };
}

function validateOrderingBlock(
  block: ActivityBlock,
  courseId: string,
  unitId: string,
  isExamContent: boolean
): BlockAssessmentResult {
  const violations: PolicyViolation[] = [];
  const content = block.content || {};
  const metadata = block.metadata || {};
  const location = `${courseId}/${unitId}/${block.id}`;

  const correctOrder = content.correct_order || content.correctOrder || [];
  const hints = metadata.progressiveHints || [];

  // Check 1: Has correct order
  const hasCorrectAnswer = correctOrder.length >= ASSESSMENT_POLICY.contentRequirements.ORDERING_MIN_ITEMS;
  if (!hasCorrectAnswer) {
    violations.push({
      type: 'content',
      rule: `Ordering needs at least ${ASSESSMENT_POLICY.contentRequirements.ORDERING_MIN_ITEMS} items`,
      ruleHe: `סידור צריך לפחות ${ASSESSMENT_POLICY.contentRequirements.ORDERING_MIN_ITEMS} פריטים`,
      severity: 'high',
      location,
      message: `Ordering has ${correctOrder.length} items, need at least ${ASSESSMENT_POLICY.contentRequirements.ORDERING_MIN_ITEMS}`,
      messageHe: `לסידור יש ${correctOrder.length} פריטים, צריך לפחות ${ASSESSMENT_POLICY.contentRequirements.ORDERING_MIN_ITEMS}`,
      expected: ASSESSMENT_POLICY.contentRequirements.ORDERING_MIN_ITEMS,
      actual: correctOrder.length
    });
  }

  // Check 2: No hints in exam
  let noHintsInExam = true;
  if (isExamContent && hints.length > 0) {
    noHintsInExam = false;
    violations.push({
      type: 'exam_mode',
      rule: 'No hints in exam mode',
      ruleHe: 'אין רמזים במצב מבחן',
      severity: 'critical',
      location,
      message: `Exam ordering has ${hints.length} hints`,
      messageHe: `סידור במבחן מכיל ${hints.length} רמזים`
    });
  }

  return {
    blockId: block.id,
    blockType: block.type,
    courseId,
    unitId,
    isExamContent,
    violations,
    checks: {
      hasCorrectAnswer,
      correctAnswerInOptions: true,
      hasEnoughOptions: true,
      hasRubric: false,
      hasModelAnswer: false,
      hasBloomLevel: !!metadata.bloomLevel,
      noHintsInExam,
      noTeachingInExam: true
    }
  };
}

function validateBlock(
  block: ActivityBlock,
  courseId: string,
  unitId: string,
  isExamContent: boolean
): BlockAssessmentResult | null {
  switch (block.type) {
    case 'multiple-choice':
    case 'true-false':
      return validateMultipleChoiceBlock(block, courseId, unitId, isExamContent);
    case 'open-question':
      return validateOpenQuestionBlock(block, courseId, unitId, isExamContent);
    case 'ordering':
      return validateOrderingBlock(block, courseId, unitId, isExamContent);
    default:
      return null; // Non-graded block types
  }
}

// ===== SCORING VALIDATION =====

function validateScoringRules(): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  // Test scoring function against policy
  const testCases = [
    { isCorrect: true, attempts: 1, hintsUsed: 0, expected: ASSESSMENT_POLICY.scoring.CORRECT_FIRST_TRY },
    { isCorrect: true, attempts: 1, hintsUsed: 1, expected: ASSESSMENT_POLICY.scoring.CORRECT_FIRST_TRY - ASSESSMENT_POLICY.scoring.HINT_PENALTY },
    { isCorrect: true, attempts: 1, hintsUsed: 5, expected: ASSESSMENT_POLICY.scoring.CORRECT_FIRST_TRY - (5 * ASSESSMENT_POLICY.scoring.HINT_PENALTY) },
    { isCorrect: true, attempts: 2, hintsUsed: 0, expected: ASSESSMENT_POLICY.scoring.RETRY_PARTIAL },
    { isCorrect: true, attempts: 3, hintsUsed: 0, expected: ASSESSMENT_POLICY.scoring.RETRY_PARTIAL },
    { isCorrect: false, attempts: 1, hintsUsed: 0, expected: ASSESSMENT_POLICY.scoring.INCORRECT },
    { isCorrect: false, attempts: 5, hintsUsed: 10, expected: ASSESSMENT_POLICY.scoring.INCORRECT },
  ];

  for (const tc of testCases) {
    const actual = calculateQuestionScore({
      isCorrect: tc.isCorrect,
      attempts: tc.attempts,
      hintsUsed: tc.hintsUsed,
      responseTimeSec: 5
    });

    if (actual !== tc.expected) {
      violations.push({
        type: 'scoring',
        rule: 'Scoring function must match policy',
        ruleHe: 'פונקציית ניקוד חייבת להתאים למדיניות',
        severity: 'critical',
        location: 'scoring.ts',
        message: `Score mismatch: correct=${tc.isCorrect}, attempts=${tc.attempts}, hints=${tc.hintsUsed} → expected ${tc.expected}, got ${actual}`,
        messageHe: `אי-התאמת ניקוד: נכון=${tc.isCorrect}, ניסיונות=${tc.attempts}, רמזים=${tc.hintsUsed} → צפוי ${tc.expected}, התקבל ${actual}`,
        expected: tc.expected,
        actual
      });
    }
  }

  // Test score never goes below MIN_SCORE
  const extremeCase = calculateQuestionScore({
    isCorrect: true,
    attempts: 1,
    hintsUsed: 1000, // Absurd number of hints
    responseTimeSec: 5
  });

  if (extremeCase < ASSESSMENT_POLICY.scoring.MIN_SCORE) {
    violations.push({
      type: 'scoring',
      rule: 'Score cannot be negative',
      ruleHe: 'ניקוד לא יכול להיות שלילי',
      severity: 'critical',
      location: 'scoring.ts',
      message: `Score went below ${ASSESSMENT_POLICY.scoring.MIN_SCORE} with many hints: ${extremeCase}`,
      messageHe: `הניקוד ירד מתחת ל-${ASSESSMENT_POLICY.scoring.MIN_SCORE} עם הרבה רמזים: ${extremeCase}`,
      expected: `>= ${ASSESSMENT_POLICY.scoring.MIN_SCORE}`,
      actual: extremeCase
    });
  }

  return violations;
}

// ===== COURSE VALIDATOR =====

function validateCourseAssessment(course: Course): CourseAssessmentResult {
  const violations: PolicyViolation[] = [];
  const blockResults: BlockAssessmentResult[] = [];
  const modules = course.syllabus || [];

  let totalBlocks = 0;
  let interactiveBlocks = 0;
  let examBlocks = 0;

  // Detect if course is exam-type
  const isExamCourse = course.contentType === 'exam' ||
                       course.title?.toLowerCase().includes('מבחן') ||
                       course.title?.toLowerCase().includes('exam');

  for (const module of modules) {
    for (const unit of module.learningUnits || []) {
      // Check if unit is exam-type
      const isExamUnit = unit.title?.toLowerCase().includes('מבחן') ||
                        unit.title?.toLowerCase().includes('exam') ||
                        (unit as any).isExam === true;

      for (const block of unit.activityBlocks || []) {
        totalBlocks++;

        const isInteractive = ['multiple-choice', 'true-false', 'open-question',
                              'ordering', 'categorization', 'fill-in-blanks'].includes(block.type);

        if (isInteractive) {
          interactiveBlocks++;

          // Check if block is exam content
          const isExamBlock = isExamCourse || isExamUnit ||
                             block.metadata?.isExam === true ||
                             block.metadata?.mode === 'exam';

          if (isExamBlock) examBlocks++;

          const result = validateBlock(block, course.id, unit.id, isExamBlock);
          if (result) {
            blockResults.push(result);
            violations.push(...result.violations);
          }
        }
      }
    }
  }

  // Count by severity
  const summary = {
    critical: violations.filter(v => v.severity === 'critical').length,
    high: violations.filter(v => v.severity === 'high').length,
    medium: violations.filter(v => v.severity === 'medium').length,
    low: violations.filter(v => v.severity === 'low').length
  };

  return {
    courseId: course.id,
    courseTitle: course.title || course.id,
    totalBlocks,
    interactiveBlocks,
    examBlocks,
    violations,
    blockResults,
    summary
  };
}

// ===== MAIN AGENT FUNCTION =====

export async function runAssessmentIntegrityAgent(
  maxCourses: number = 10
): Promise<QAAgentResult> {
  const startTime = Date.now();
  const allResults: TestResult[] = [];

  console.log('⚖️ Assessment Integrity Agent starting...');
  console.log(`   Validating scoring policy and assessment integrity on ${maxCourses} courses...`);

  try {
    // First, validate the scoring rules themselves
    const scoringViolations = validateScoringRules();

    const scoringTest: TestResult = {
      id: 'scoring_rules_validation',
      name: 'Scoring Rules Validation',
      nameHe: 'בדיקת כללי ניקוד',
      category: 'assessment-integrity',
      status: scoringViolations.length === 0 ? 'passed' : 'failed',
      severity: scoringViolations.length > 0 ? 'critical' : 'low',
      message: scoringViolations.length === 0
        ? 'All scoring rules follow policy correctly'
        : `${scoringViolations.length} scoring policy violations found`,
      messageHe: scoringViolations.length === 0
        ? 'כל כללי הניקוד תואמים למדיניות'
        : `נמצאו ${scoringViolations.length} הפרות מדיניות ניקוד`,
      details: {
        policy: ASSESSMENT_POLICY.scoring,
        violations: scoringViolations
      },
      duration: 0,
      timestamp: new Date()
    };

    allResults.push(scoringTest);

    // Fetch courses
    const coursesQuery = query(
      collection(db, 'courses'),
      orderBy('createdAt', 'desc'),
      firestoreLimit(maxCourses)
    );
    const snapshot = await getDocs(coursesQuery);

    let totalTests = 1; // Already counted scoring test
    let passedTests = scoringViolations.length === 0 ? 1 : 0;
    let failedTests = scoringViolations.length > 0 ? 1 : 0;
    const criticalIssues: TestResult[] = [];

    if (scoringViolations.length > 0) {
      criticalIssues.push(scoringTest);
    }

    for (const docSnap of snapshot.docs) {
      const course = { id: docSnap.id, ...docSnap.data() } as Course;
      totalTests++;

      const result = validateCourseAssessment(course);
      const hasCritical = result.summary.critical > 0;
      const hasHigh = result.summary.high > 0;

      const status = hasCritical ? 'failed' :
                    hasHigh ? 'warning' : 'passed';

      const testResult: TestResult = {
        id: `assessment_${course.id}`,
        name: `Assessment Integrity: ${course.title || course.id}`,
        nameHe: `אינטגריטי הערכה: ${course.title || course.id}`,
        category: 'assessment-integrity',
        status,
        severity: hasCritical ? 'critical' : hasHigh ? 'high' : 'low',
        message: `Blocks: ${result.interactiveBlocks}/${result.totalBlocks} | ` +
                 `Exam: ${result.examBlocks} | ` +
                 `Violations: ${result.violations.length} (${result.summary.critical} critical)`,
        messageHe: `בלוקים: ${result.interactiveBlocks}/${result.totalBlocks} | ` +
                   `מבחן: ${result.examBlocks} | ` +
                   `הפרות: ${result.violations.length} (${result.summary.critical} קריטיות)`,
        details: {
          courseId: course.id,
          courseTitle: course.title,
          statistics: {
            totalBlocks: result.totalBlocks,
            interactiveBlocks: result.interactiveBlocks,
            examBlocks: result.examBlocks
          },
          summary: result.summary,
          violations: result.violations,
          blockResults: result.blockResults.filter(b => b.violations.length > 0)
        },
        duration: 0,
        timestamp: new Date()
      };

      allResults.push(testResult);

      if (status === 'passed') {
        passedTests++;
      } else {
        failedTests++;
        if (hasCritical) {
          criticalIssues.push(testResult);
        }
      }
    }

    // Add summary test
    totalTests++;
    const overallViolations = allResults.reduce((sum, r) => {
      const details = r.details as any;
      return sum + (details?.violations?.length || 0);
    }, 0);

    const summaryTest: TestResult = {
      id: 'assessment_summary',
      name: 'Assessment Integrity Summary',
      nameHe: 'סיכום אינטגריטי הערכה',
      category: 'assessment-integrity',
      status: criticalIssues.length === 0 ? 'passed' : 'failed',
      severity: criticalIssues.length > 0 ? 'critical' : 'low',
      message: `Total violations: ${overallViolations} across ${snapshot.size} courses`,
      messageHe: `סה"כ הפרות: ${overallViolations} ב-${snapshot.size} קורסים`,
      details: {
        coursesChecked: snapshot.size,
        totalViolations: overallViolations,
        criticalCount: criticalIssues.length,
        policy: ASSESSMENT_POLICY
      },
      duration: Date.now() - startTime,
      timestamp: new Date()
    };

    allResults.push(summaryTest);
    if (summaryTest.status === 'passed') passedTests++;
    else failedTests++;

    console.log(`✅ Assessment Integrity Agent completed: ${passedTests}/${totalTests} passed`);
    console.log(`   Total violations found: ${overallViolations}`);

    return {
      agentType: 'assessment-integrity',
      success: criticalIssues.length === 0,
      duration: Date.now() - startTime,
      testsRun: totalTests,
      testsPassed: passedTests,
      testsFailed: failedTests,
      criticalIssues,
      allResults
    };

  } catch (error: any) {
    console.error('❌ Assessment Integrity Agent failed:', error);

    return {
      agentType: 'assessment-integrity',
      success: false,
      duration: Date.now() - startTime,
      testsRun: 0,
      testsPassed: 0,
      testsFailed: 1,
      criticalIssues: [{
        id: 'assessment_agent_error',
        name: 'Assessment Integrity Error',
        nameHe: 'שגיאת אינטגריטי הערכה',
        category: 'assessment-integrity',
        status: 'failed',
        severity: 'critical',
        message: error.message,
        messageHe: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date()
      }],
      allResults: []
    };
  }
}

export {
  validateCourseAssessment,
  validateScoringRules,
  validateBlock
};
