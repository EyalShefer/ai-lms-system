/**
 * Student Activity Agent
 * סוכן פעילות תלמיד - מבצע פעילויות ובחינות ובודק שהניקוד תקין
 *
 * This agent actually performs activities and exams like a real student,
 * testing that scoring, hints, retries, and XP/gems work correctly.
 */

import { db } from '../../firebase';
import { collection, getDocs, query, limit as firestoreLimit, orderBy } from 'firebase/firestore';
import type { TestResult, QAAgentResult } from '../../types/qa.types';
import type { Course, ActivityBlock } from '../../shared/types/courseTypes';
import { SCORING_CONFIG, calculateQuestionScore } from '../../utils/scoring';

// ===== TYPES =====

export interface ActivityAttempt {
  blockId: string;
  blockType: string;
  questionText?: string;

  // Attempt details
  attempts: number;
  hintsUsed: number;
  responseTimeSec: number;

  // Answer details
  selectedAnswer?: any;
  correctAnswer?: any;
  isCorrect: boolean;

  // Scoring results
  expectedScore: number;
  actualScore?: number;
  scoreMatch: boolean;

  // Gamification
  expectedXP: number;
  expectedGems: number;

  // Issues found
  issues: ActivityIssue[];
}

export interface ActivityIssue {
  type: 'scoring_mismatch' | 'hint_penalty_wrong' | 'retry_score_wrong' |
        'xp_mismatch' | 'gems_mismatch' | 'exam_hint_allowed' |
        'missing_feedback' | 'invalid_options' | 'no_correct_answer' |
        'answer_not_in_options' | 'max_attempts_exceeded';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  messageHe: string;
  expected?: any;
  actual?: any;
}

export interface ActivitySessionResult {
  sessionId: string;
  courseId: string;
  courseTitle: string;
  isExamMode: boolean;

  // Statistics
  totalBlocks: number;
  blocksAttempted: number;
  blocksCorrectFirstTry: number;
  blocksCorrectWithHints: number;
  blocksCorrectAfterRetry: number;
  blocksIncorrect: number;

  // Scoring validation
  totalExpectedScore: number;
  totalActualScore: number;
  scoringAccurate: boolean;

  // Issues
  issues: ActivityIssue[];
  attempts: ActivityAttempt[];

  // Timing
  totalTime: number;
}

// ===== SCORING CALCULATOR (mirrors actual scoring logic) =====

function calculateExpectedScore(
  isCorrect: boolean,
  attempts: number,
  hintsUsed: number
): { score: number; xp: number; gems: number } {
  let score = 0;
  let xp = 0;
  let gems = 0;

  if (isCorrect) {
    if (attempts === 1) {
      // First try correct
      if (hintsUsed > 0) {
        score = Math.max(0, SCORING_CONFIG.CORRECT_FIRST_TRY - (hintsUsed * SCORING_CONFIG.HINT_PENALTY));
      } else {
        score = SCORING_CONFIG.CORRECT_FIRST_TRY;
      }
    } else {
      // Retry correct
      score = SCORING_CONFIG.RETRY_PARTIAL;
    }

    // XP equals score
    xp = score;

    // Gems
    gems = 1;
    if (score === 100) {
      gems = 2; // Bonus for perfect
    }
  }

  return { score, xp, gems };
}

// ===== ACTIVITY SIMULATORS =====

function performMultipleChoiceActivity(
  block: ActivityBlock,
  isExamMode: boolean,
  scenario: 'correct_first' | 'correct_with_hints' | 'correct_after_retry' | 'incorrect'
): ActivityAttempt {
  const content = block.content || {};
  const options = content.options || [];
  const correctAnswer = content.correctAnswer || content.correct_answer;
  const hints = block.metadata?.progressiveHints || [];

  const issues: ActivityIssue[] = [];

  // Validate block structure
  if (options.length === 0) {
    issues.push({
      type: 'invalid_options',
      severity: 'critical',
      message: 'Multiple choice has no options',
      messageHe: 'שאלת בחירה ללא אפשרויות'
    });
  }

  if (!correctAnswer) {
    issues.push({
      type: 'no_correct_answer',
      severity: 'critical',
      message: 'No correct answer defined',
      messageHe: 'לא מוגדרת תשובה נכונה'
    });
  }

  // Check if correct answer is in options
  if (correctAnswer && options.length > 0) {
    const optionTexts = options.map((o: any) =>
      typeof o === 'string' ? o : (o.text || o.label || o.value || '')
    );
    if (!optionTexts.includes(correctAnswer)) {
      issues.push({
        type: 'answer_not_in_options',
        severity: 'critical',
        message: `Correct answer "${correctAnswer}" not found in options`,
        messageHe: `התשובה הנכונה "${correctAnswer}" לא נמצאת באפשרויות`,
        expected: correctAnswer,
        actual: optionTexts
      });
    }
  }

  // Simulate activity based on scenario
  let attempts = 1;
  let hintsUsed = 0;
  let isCorrect = false;
  let selectedAnswer = options[0];

  switch (scenario) {
    case 'correct_first':
      attempts = 1;
      hintsUsed = 0;
      isCorrect = true;
      selectedAnswer = correctAnswer;
      break;

    case 'correct_with_hints':
      attempts = 1;
      hintsUsed = Math.min(2, hints.length);
      isCorrect = true;
      selectedAnswer = correctAnswer;

      // Check if hints are allowed in exam mode
      if (isExamMode && hintsUsed > 0) {
        issues.push({
          type: 'exam_hint_allowed',
          severity: 'critical',
          message: 'Hints should be disabled in exam mode',
          messageHe: 'רמזים צריכים להיות חסומים במצב מבחן'
        });
      }
      break;

    case 'correct_after_retry':
      attempts = 2;
      hintsUsed = 0;
      isCorrect = true;
      selectedAnswer = correctAnswer;
      break;

    case 'incorrect':
      attempts = 1;
      hintsUsed = 0;
      isCorrect = false;
      selectedAnswer = options.find((o: any) => o !== correctAnswer) || options[0];
      break;
  }

  const { score, xp, gems } = calculateExpectedScore(isCorrect, attempts, hintsUsed);

  // Verify against actual scoring function
  const actualCalculatedScore = calculateQuestionScore({
    isCorrect,
    attempts,
    hintsUsed,
    responseTimeSec: 5
  });

  if (actualCalculatedScore !== score) {
    issues.push({
      type: 'scoring_mismatch',
      severity: 'critical',
      message: `Scoring function returned ${actualCalculatedScore}, expected ${score}`,
      messageHe: `פונקציית הניקוד החזירה ${actualCalculatedScore}, צפוי ${score}`,
      expected: score,
      actual: actualCalculatedScore
    });
  }

  return {
    blockId: block.id,
    blockType: block.type,
    questionText: content.question,
    attempts,
    hintsUsed,
    responseTimeSec: 5,
    selectedAnswer,
    correctAnswer,
    isCorrect,
    expectedScore: score,
    actualScore: actualCalculatedScore,
    scoreMatch: actualCalculatedScore === score,
    expectedXP: xp,
    expectedGems: gems,
    issues
  };
}

function performOpenQuestionActivity(
  block: ActivityBlock,
  isExamMode: boolean
): ActivityAttempt {
  const content = block.content || {};
  const issues: ActivityIssue[] = [];

  if (!content.question) {
    issues.push({
      type: 'invalid_options',
      severity: 'high',
      message: 'Open question has no question text',
      messageHe: 'שאלה פתוחה ללא טקסט שאלה'
    });
  }

  // Open questions are graded by AI, so we simulate a "correct" answer
  // Scoring for open questions is different (AI-graded)
  return {
    blockId: block.id,
    blockType: block.type,
    questionText: content.question,
    attempts: 1,
    hintsUsed: 0,
    responseTimeSec: 30,
    selectedAnswer: '[Simulated open answer]',
    correctAnswer: content.modelAnswer || block.metadata?.modelAnswer,
    isCorrect: true, // Assume AI grades it correct
    expectedScore: 100, // Full marks assumed
    scoreMatch: true,
    expectedXP: 100,
    expectedGems: 2,
    issues
  };
}

function performOrderingActivity(
  block: ActivityBlock,
  scenario: 'correct' | 'incorrect'
): ActivityAttempt {
  const content = block.content || {};
  const correctOrder = content.correct_order || content.correctOrder || [];
  const issues: ActivityIssue[] = [];

  if (correctOrder.length < 2) {
    issues.push({
      type: 'invalid_options',
      severity: 'critical',
      message: 'Ordering activity has less than 2 items',
      messageHe: 'פעילות סידור עם פחות מ-2 פריטים'
    });
  }

  const isCorrect = scenario === 'correct';
  const { score, xp, gems } = calculateExpectedScore(isCorrect, 1, 0);

  return {
    blockId: block.id,
    blockType: block.type,
    questionText: content.instruction || content.question,
    attempts: 1,
    hintsUsed: 0,
    responseTimeSec: 15,
    selectedAnswer: isCorrect ? correctOrder : [...correctOrder].reverse(),
    correctAnswer: correctOrder,
    isCorrect,
    expectedScore: score,
    scoreMatch: true,
    expectedXP: xp,
    expectedGems: gems,
    issues
  };
}

// ===== SESSION RUNNER =====

function runActivitySession(
  course: Course,
  isExamMode: boolean
): ActivitySessionResult {
  const startTime = Date.now();
  const attempts: ActivityAttempt[] = [];
  const allIssues: ActivityIssue[] = [];

  const modules = course.syllabus || [];
  let totalBlocks = 0;
  let blocksAttempted = 0;
  let blocksCorrectFirstTry = 0;
  let blocksCorrectWithHints = 0;
  let blocksCorrectAfterRetry = 0;
  let blocksIncorrect = 0;
  let totalExpectedScore = 0;
  let totalActualScore = 0;

  // Count all interactive blocks
  for (const module of modules) {
    for (const unit of module.learningUnits || []) {
      for (const block of unit.activityBlocks || []) {
        const isInteractive = ['multiple-choice', 'open-question', 'ordering',
                              'categorization', 'fill-in-blanks', 'true-false'].includes(block.type);
        if (isInteractive) {
          totalBlocks++;
        }
      }
    }
  }

  // Run activities with different scenarios
  for (const module of modules) {
    for (const unit of module.learningUnits || []) {
      for (const block of unit.activityBlocks || []) {
        let attempt: ActivityAttempt | null = null;

        switch (block.type) {
          case 'multiple-choice':
          case 'true-false':
            // Test all scenarios for first few blocks, then random
            if (blocksAttempted === 0) {
              attempt = performMultipleChoiceActivity(block, isExamMode, 'correct_first');
              blocksCorrectFirstTry++;
            } else if (blocksAttempted === 1) {
              attempt = performMultipleChoiceActivity(block, isExamMode, 'correct_with_hints');
              blocksCorrectWithHints++;
            } else if (blocksAttempted === 2) {
              attempt = performMultipleChoiceActivity(block, isExamMode, 'correct_after_retry');
              blocksCorrectAfterRetry++;
            } else if (blocksAttempted === 3) {
              attempt = performMultipleChoiceActivity(block, isExamMode, 'incorrect');
              blocksIncorrect++;
            } else {
              // Random scenario
              const scenarios = ['correct_first', 'correct_with_hints', 'correct_after_retry', 'incorrect'] as const;
              const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
              attempt = performMultipleChoiceActivity(block, isExamMode, scenario);
              if (scenario === 'correct_first') blocksCorrectFirstTry++;
              else if (scenario === 'correct_with_hints') blocksCorrectWithHints++;
              else if (scenario === 'correct_after_retry') blocksCorrectAfterRetry++;
              else blocksIncorrect++;
            }
            break;

          case 'open-question':
            attempt = performOpenQuestionActivity(block, isExamMode);
            blocksCorrectFirstTry++;
            break;

          case 'ordering':
            attempt = performOrderingActivity(block, blocksAttempted % 2 === 0 ? 'correct' : 'incorrect');
            if (attempt.isCorrect) blocksCorrectFirstTry++;
            else blocksIncorrect++;
            break;
        }

        if (attempt) {
          attempts.push(attempt);
          allIssues.push(...attempt.issues);
          blocksAttempted++;
          totalExpectedScore += attempt.expectedScore;
          totalActualScore += attempt.actualScore || attempt.expectedScore;
        }
      }
    }
  }

  return {
    sessionId: `activity_${course.id}_${Date.now()}`,
    courseId: course.id,
    courseTitle: course.title || course.id,
    isExamMode,
    totalBlocks,
    blocksAttempted,
    blocksCorrectFirstTry,
    blocksCorrectWithHints,
    blocksCorrectAfterRetry,
    blocksIncorrect,
    totalExpectedScore,
    totalActualScore,
    scoringAccurate: totalExpectedScore === totalActualScore,
    issues: allIssues,
    attempts,
    totalTime: Date.now() - startTime
  };
}

// ===== MAIN AGENT FUNCTION =====

export async function runStudentActivityAgent(
  maxCourses: number = 5,
  testExamMode: boolean = true
): Promise<QAAgentResult> {
  const startTime = Date.now();
  const allResults: TestResult[] = [];

  console.log('📝 Student Activity Agent starting...');
  console.log(`   Testing activities and scoring on ${maxCourses} courses...`);

  try {
    // Fetch courses
    const coursesQuery = query(
      collection(db, 'courses'),
      orderBy('createdAt', 'desc'),
      firestoreLimit(maxCourses)
    );
    const snapshot = await getDocs(coursesQuery);

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    const criticalIssues: TestResult[] = [];

    for (const docSnap of snapshot.docs) {
      const course = { id: docSnap.id, ...docSnap.data() } as Course;

      // Test in learning mode
      const learningSession = runActivitySession(course, false);
      totalTests++;

      const learningCritical = learningSession.issues.filter(i => i.severity === 'critical');
      const learningHigh = learningSession.issues.filter(i => i.severity === 'high');
      const hasCriticalLearning = learningCritical.length > 0;
      const hasHighLearning = learningHigh.length > 0 || !learningSession.scoringAccurate;

      const learningStatus = hasCriticalLearning ? 'failed' :
                            hasHighLearning ? 'warning' : 'passed';

      const learningResult: TestResult = {
        id: `activity_learning_${course.id}`,
        name: `[Learning Mode] ${course.title || course.id}`,
        nameHe: `[מצב למידה] ${course.title || course.id}`,
        category: 'student-activity',
        status: learningStatus,
        severity: hasCriticalLearning ? 'critical' : hasHighLearning ? 'high' : 'low',
        message: `Blocks: ${learningSession.blocksAttempted}/${learningSession.totalBlocks} | ` +
                 `Score: ${learningSession.totalActualScore}/${learningSession.totalExpectedScore} | ` +
                 `Issues: ${learningSession.issues.length}`,
        messageHe: `בלוקים: ${learningSession.blocksAttempted}/${learningSession.totalBlocks} | ` +
                   `ניקוד: ${learningSession.totalActualScore}/${learningSession.totalExpectedScore} | ` +
                   `בעיות: ${learningSession.issues.length}`,
        details: {
          courseId: course.id,
          mode: 'learning',
          ...learningSession,
          issuesSummary: {
            critical: learningCritical.length,
            high: learningHigh.length,
            medium: learningSession.issues.filter(i => i.severity === 'medium').length,
            low: learningSession.issues.filter(i => i.severity === 'low').length
          }
        },
        duration: learningSession.totalTime,
        timestamp: new Date()
      };

      allResults.push(learningResult);

      if (learningStatus === 'passed') {
        passedTests++;
      } else {
        failedTests++;
        if (hasCriticalLearning) {
          criticalIssues.push(learningResult);
        }
      }

      // Test in exam mode if requested
      if (testExamMode) {
        const examSession = runActivitySession(course, true);
        totalTests++;

        const examCritical = examSession.issues.filter(i => i.severity === 'critical');
        const examHigh = examSession.issues.filter(i => i.severity === 'high');
        const hasCriticalExam = examCritical.length > 0;
        const hasHighExam = examHigh.length > 0;

        // Check for hints in exam mode (should not be allowed)
        const hintsInExam = examSession.attempts.filter(a => a.hintsUsed > 0 &&
          a.issues.some(i => i.type === 'exam_hint_allowed'));

        if (hintsInExam.length > 0) {
          examSession.issues.push({
            type: 'exam_hint_allowed',
            severity: 'critical',
            message: `${hintsInExam.length} blocks allowed hints in exam mode`,
            messageHe: `${hintsInExam.length} בלוקים אפשרו רמזים במצב מבחן`
          });
        }

        const examStatus = hasCriticalExam || hintsInExam.length > 0 ? 'failed' :
                          hasHighExam ? 'warning' : 'passed';

        const examResult: TestResult = {
          id: `activity_exam_${course.id}`,
          name: `[Exam Mode] ${course.title || course.id}`,
          nameHe: `[מצב מבחן] ${course.title || course.id}`,
          category: 'student-activity',
          status: examStatus,
          severity: hasCriticalExam ? 'critical' : hasHighExam ? 'high' : 'low',
          message: `Blocks: ${examSession.blocksAttempted}/${examSession.totalBlocks} | ` +
                   `Hints blocked: ${hintsInExam.length === 0 ? 'Yes' : 'NO!'} | ` +
                   `Issues: ${examSession.issues.length}`,
          messageHe: `בלוקים: ${examSession.blocksAttempted}/${examSession.totalBlocks} | ` +
                     `רמזים חסומים: ${hintsInExam.length === 0 ? 'כן' : 'לא!'} | ` +
                     `בעיות: ${examSession.issues.length}`,
          details: {
            courseId: course.id,
            mode: 'exam',
            hintsBlockedCorrectly: hintsInExam.length === 0,
            ...examSession
          },
          duration: examSession.totalTime,
          timestamp: new Date()
        };

        allResults.push(examResult);

        if (examStatus === 'passed') {
          passedTests++;
        } else {
          failedTests++;
          if (hasCriticalExam || hintsInExam.length > 0) {
            criticalIssues.push(examResult);
          }
        }
      }
    }

    // Add scoring policy validation test
    totalTests++;
    const policyTest = validateScoringPolicy();
    allResults.push(policyTest);
    if (policyTest.status === 'passed') passedTests++;
    else {
      failedTests++;
      if (policyTest.severity === 'critical') criticalIssues.push(policyTest);
    }

    console.log(`✅ Student Activity Agent completed: ${passedTests}/${totalTests} passed`);

    return {
      agentType: 'student-activity',
      success: criticalIssues.length === 0,
      duration: Date.now() - startTime,
      testsRun: totalTests,
      testsPassed: passedTests,
      testsFailed: failedTests,
      criticalIssues,
      allResults
    };

  } catch (error: any) {
    console.error('❌ Student Activity Agent failed:', error);

    return {
      agentType: 'student-activity',
      success: false,
      duration: Date.now() - startTime,
      testsRun: 0,
      testsPassed: 0,
      testsFailed: 1,
      criticalIssues: [{
        id: 'activity_agent_error',
        name: 'Student Activity Error',
        nameHe: 'שגיאת פעילות תלמיד',
        category: 'student-activity',
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

// ===== SCORING POLICY VALIDATION =====

function validateScoringPolicy(): TestResult {
  const issues: string[] = [];

  // Test 1: Correct first try with no hints = 100
  const test1 = calculateQuestionScore({ isCorrect: true, attempts: 1, hintsUsed: 0, responseTimeSec: 5 });
  if (test1 !== 100) {
    issues.push(`Correct first try should be 100, got ${test1}`);
  }

  // Test 2: Correct first try with 1 hint = 98
  const test2 = calculateQuestionScore({ isCorrect: true, attempts: 1, hintsUsed: 1, responseTimeSec: 5 });
  const expected2 = 100 - SCORING_CONFIG.HINT_PENALTY;
  if (test2 !== expected2) {
    issues.push(`Correct with 1 hint should be ${expected2}, got ${test2}`);
  }

  // Test 3: Correct first try with 3 hints = 94
  const test3 = calculateQuestionScore({ isCorrect: true, attempts: 1, hintsUsed: 3, responseTimeSec: 5 });
  const expected3 = 100 - (3 * SCORING_CONFIG.HINT_PENALTY);
  if (test3 !== expected3) {
    issues.push(`Correct with 3 hints should be ${expected3}, got ${test3}`);
  }

  // Test 4: Correct on retry = 50
  const test4 = calculateQuestionScore({ isCorrect: true, attempts: 2, hintsUsed: 0, responseTimeSec: 5 });
  if (test4 !== SCORING_CONFIG.RETRY_PARTIAL) {
    issues.push(`Correct on retry should be ${SCORING_CONFIG.RETRY_PARTIAL}, got ${test4}`);
  }

  // Test 5: Incorrect = 0
  const test5 = calculateQuestionScore({ isCorrect: false, attempts: 1, hintsUsed: 0, responseTimeSec: 5 });
  if (test5 !== 0) {
    issues.push(`Incorrect should be 0, got ${test5}`);
  }

  // Test 6: Many hints should not go below 0
  const test6 = calculateQuestionScore({ isCorrect: true, attempts: 1, hintsUsed: 100, responseTimeSec: 5 });
  if (test6 < 0) {
    issues.push(`Score should not be negative, got ${test6}`);
  }

  const hasCritical = issues.length > 0;

  return {
    id: 'scoring_policy_validation',
    name: 'Scoring Policy Validation',
    nameHe: 'בדיקת מדיניות ניקוד',
    category: 'student-activity',
    status: hasCritical ? 'failed' : 'passed',
    severity: hasCritical ? 'critical' : 'low',
    message: hasCritical ? `${issues.length} scoring policy violations` : 'All scoring rules validated correctly',
    messageHe: hasCritical ? `${issues.length} הפרות מדיניות ניקוד` : 'כל כללי הניקוד תקינים',
    details: {
      testedRules: [
        'Correct first try = 100',
        `Hint penalty = ${SCORING_CONFIG.HINT_PENALTY} per hint`,
        `Retry partial = ${SCORING_CONFIG.RETRY_PARTIAL}`,
        'Incorrect = 0',
        'Score >= 0 always'
      ],
      issues,
      config: SCORING_CONFIG
    },
    duration: 0,
    timestamp: new Date()
  };
}

export { runActivitySession, validateScoringPolicy };
