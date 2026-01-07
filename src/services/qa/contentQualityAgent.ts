/**
 * Content Quality Agent
 * סוכן בודק איכות תוכן - בודק מערכי שיעור ותוכן שנוצר
 */

import { db } from '../../firebase';
import { collection, getDocs, query, limit, orderBy, doc, getDoc } from 'firebase/firestore';
import type {
  TestResult,
  TestSuite,
  ContentQualityCheck,
  ContentIssue,
  LessonPlanValidation,
  QAAgentResult,
  TestSeverity
} from '../../types/qa.types';
import type { Course, LearningUnit, ActivityBlock, Module } from '../../shared/types/courseTypes';
import type { TeacherLessonPlan } from '../../shared/types/gemini.types';

// ===== BLOCK VALIDATORS =====

interface BlockValidationResult {
  valid: boolean;
  issues: ContentIssue[];
  score: number;
}

function validateMultipleChoiceBlock(block: ActivityBlock): BlockValidationResult {
  const issues: ContentIssue[] = [];
  const content = block.content || {};

  // Check for question
  if (!content.question) {
    issues.push({
      type: 'missing',
      field: 'question',
      message: 'Multiple choice block missing question',
      messageHe: 'בלוק בחירה מרובה חסר שאלה',
      severity: 'high',
      autoFixable: false
    });
  }

  // Check for options
  const options = content.options || [];
  if (options.length < 2) {
    issues.push({
      type: 'incomplete',
      field: 'options',
      message: `Only ${options.length} options (minimum 2 required)`,
      messageHe: `רק ${options.length} אפשרויות (מינימום 2 נדרשות)`,
      severity: 'high',
      autoFixable: false
    });
  }

  if (options.length > 6) {
    issues.push({
      type: 'quality',
      field: 'options',
      message: 'Too many options (max 6 recommended)',
      messageHe: 'יותר מדי אפשרויות (מקסימום 6 מומלץ)',
      severity: 'low',
      autoFixable: false
    });
  }

  // Check for correct answer
  if (!content.correctAnswer && !content.correct_answer) {
    issues.push({
      type: 'missing',
      field: 'correctAnswer',
      message: 'No correct answer specified',
      messageHe: 'לא צוינה תשובה נכונה',
      severity: 'critical',
      autoFixable: false
    });
  }

  // Verify correct answer is in options
  const correctAnswer = content.correctAnswer || content.correct_answer;
  if (correctAnswer && options.length > 0) {
    const optionTexts = options.map((o: any) => typeof o === 'string' ? o : o.text || o.label);
    if (!optionTexts.includes(correctAnswer)) {
      issues.push({
        type: 'invalid',
        field: 'correctAnswer',
        message: 'Correct answer not found in options',
        messageHe: 'התשובה הנכונה לא נמצאת באפשרויות',
        severity: 'critical',
        autoFixable: false
      });
    }
  }

  const score = Math.max(0, 100 - (issues.length * 20));
  return { valid: issues.length === 0, issues, score };
}

function validateOpenQuestionBlock(block: ActivityBlock): BlockValidationResult {
  const issues: ContentIssue[] = [];
  const content = block.content || {};

  if (!content.question) {
    issues.push({
      type: 'missing',
      field: 'question',
      message: 'Open question missing question text',
      messageHe: 'שאלה פתוחה חסרה טקסט שאלה',
      severity: 'high',
      autoFixable: false
    });
  }

  // Check for model answer (recommended)
  if (!block.metadata?.modelAnswer) {
    issues.push({
      type: 'quality',
      field: 'modelAnswer',
      message: 'No model answer provided (recommended for grading)',
      messageHe: 'לא סופקה תשובת מודל (מומלץ לצורכי ציון)',
      severity: 'low',
      autoFixable: false
    });
  }

  const score = Math.max(0, 100 - (issues.length * 15));
  return { valid: issues.filter(i => i.severity !== 'low').length === 0, issues, score };
}

function validateOrderingBlock(block: ActivityBlock): BlockValidationResult {
  const issues: ContentIssue[] = [];
  const content = block.content || {};

  if (!content.instruction) {
    issues.push({
      type: 'missing',
      field: 'instruction',
      message: 'Ordering block missing instruction',
      messageHe: 'בלוק סידור חסר הנחיה',
      severity: 'medium',
      autoFixable: false
    });
  }

  const correctOrder = content.correct_order || content.correctOrder || [];
  if (correctOrder.length < 2) {
    issues.push({
      type: 'incomplete',
      field: 'correct_order',
      message: `Only ${correctOrder.length} items to order (minimum 2)`,
      messageHe: `רק ${correctOrder.length} פריטים לסידור (מינימום 2)`,
      severity: 'high',
      autoFixable: false
    });
  }

  const score = Math.max(0, 100 - (issues.length * 20));
  return { valid: issues.length === 0, issues, score };
}

function validateCategorizationBlock(block: ActivityBlock): BlockValidationResult {
  const issues: ContentIssue[] = [];
  const content = block.content || {};

  const categories = content.categories || [];
  const items = content.items || [];

  if (categories.length < 2) {
    issues.push({
      type: 'incomplete',
      field: 'categories',
      message: `Only ${categories.length} categories (minimum 2)`,
      messageHe: `רק ${categories.length} קטגוריות (מינימום 2)`,
      severity: 'high',
      autoFixable: false
    });
  }

  if (items.length < categories.length) {
    issues.push({
      type: 'incomplete',
      field: 'items',
      message: 'Fewer items than categories',
      messageHe: 'פחות פריטים מקטגוריות',
      severity: 'medium',
      autoFixable: false
    });
  }

  // Check all items have valid category assignments
  items.forEach((item: any, index: number) => {
    if (item.category && !categories.includes(item.category)) {
      issues.push({
        type: 'invalid',
        field: `items[${index}].category`,
        message: `Item assigned to non-existent category: ${item.category}`,
        messageHe: `פריט מוקצה לקטגוריה שלא קיימת: ${item.category}`,
        severity: 'high',
        autoFixable: false
      });
    }
  });

  const score = Math.max(0, 100 - (issues.length * 15));
  return { valid: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0, issues, score };
}

function validateTextBlock(block: ActivityBlock): BlockValidationResult {
  const issues: ContentIssue[] = [];
  const content = block.content;

  if (!content || (typeof content === 'string' && content.trim().length === 0)) {
    issues.push({
      type: 'missing',
      field: 'content',
      message: 'Text block is empty',
      messageHe: 'בלוק טקסט ריק',
      severity: 'medium',
      autoFixable: false
    });
  }

  if (typeof content === 'string' && content.length < 20) {
    issues.push({
      type: 'quality',
      field: 'content',
      message: 'Text content is very short',
      messageHe: 'תוכן הטקסט קצר מאוד',
      severity: 'low',
      autoFixable: false
    });
  }

  const score = Math.max(0, 100 - (issues.length * 20));
  return { valid: issues.filter(i => i.severity !== 'low').length === 0, issues, score };
}

function validateMemoryGameBlock(block: ActivityBlock): BlockValidationResult {
  const issues: ContentIssue[] = [];
  const content = block.content || {};

  const pairs = content.pairs || content.cards || [];
  if (pairs.length < 3) {
    issues.push({
      type: 'incomplete',
      field: 'pairs',
      message: `Only ${pairs.length} pairs (minimum 3 recommended)`,
      messageHe: `רק ${pairs.length} זוגות (מינימום 3 מומלץ)`,
      severity: 'medium',
      autoFixable: false
    });
  }

  if (pairs.length > 12) {
    issues.push({
      type: 'quality',
      field: 'pairs',
      message: 'Too many pairs (max 12 recommended for playability)',
      messageHe: 'יותר מדי זוגות (מקסימום 12 מומלץ לשחיקות)',
      severity: 'low',
      autoFixable: false
    });
  }

  const score = Math.max(0, 100 - (issues.length * 15));
  return { valid: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0, issues, score };
}

function validateBlock(block: ActivityBlock): BlockValidationResult {
  switch (block.type) {
    case 'multiple-choice':
      return validateMultipleChoiceBlock(block);
    case 'open-question':
      return validateOpenQuestionBlock(block);
    case 'ordering':
      return validateOrderingBlock(block);
    case 'categorization':
      return validateCategorizationBlock(block);
    case 'text':
      return validateTextBlock(block);
    case 'memory_game':
      return validateMemoryGameBlock(block);
    case 'video':
    case 'image':
    case 'pdf':
      // Media blocks - check for URL/content
      if (!block.content) {
        return {
          valid: false,
          issues: [{
            type: 'missing',
            field: 'content',
            message: `${block.type} block missing content/URL`,
            messageHe: `בלוק ${block.type} חסר תוכן/קישור`,
            severity: 'high',
            autoFixable: false
          }],
          score: 0
        };
      }
      return { valid: true, issues: [], score: 100 };
    default:
      // Unknown or complex blocks - basic validation
      return { valid: true, issues: [], score: 80 };
  }
}

// ===== UNIT VALIDATION =====

interface UnitValidationResult {
  unitId: string;
  unitTitle: string;
  valid: boolean;
  blockCount: number;
  validBlocks: number;
  invalidBlocks: number;
  issues: ContentIssue[];
  score: number;
  blockScores: { blockId: string; type: string; score: number }[];
}

function validateUnit(unit: LearningUnit): UnitValidationResult {
  const issues: ContentIssue[] = [];
  const blockScores: { blockId: string; type: string; score: number }[] = [];

  const blocks = unit.activityBlocks || [];

  // Check minimum blocks
  if (blocks.length === 0) {
    issues.push({
      type: 'missing',
      field: 'activityBlocks',
      message: 'Unit has no activity blocks',
      messageHe: 'ליחידה אין בלוקי פעילות',
      severity: 'high',
      autoFixable: false
    });
  }

  // Validate each block
  let validBlocks = 0;
  let totalScore = 0;

  blocks.forEach(block => {
    const result = validateBlock(block);
    blockScores.push({ blockId: block.id, type: block.type, score: result.score });
    totalScore += result.score;

    if (result.valid) {
      validBlocks++;
    } else {
      issues.push(...result.issues);
    }
  });

  // Check for content diversity
  const blockTypes = new Set(blocks.map(b => b.type));
  if (blocks.length > 3 && blockTypes.size === 1) {
    issues.push({
      type: 'quality',
      field: 'diversity',
      message: 'Unit uses only one block type - consider adding variety',
      messageHe: 'היחידה משתמשת רק בסוג בלוק אחד - שקול להוסיף מגוון',
      severity: 'low',
      autoFixable: false
    });
  }

  // Check base content
  if (!unit.baseContent || unit.baseContent.trim().length < 50) {
    issues.push({
      type: 'incomplete',
      field: 'baseContent',
      message: 'Unit base content is missing or too short',
      messageHe: 'תוכן הבסיס של היחידה חסר או קצר מדי',
      severity: 'medium',
      autoFixable: false
    });
  }

  const avgScore = blocks.length > 0 ? Math.round(totalScore / blocks.length) : 0;

  return {
    unitId: unit.id,
    unitTitle: unit.title,
    valid: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0,
    blockCount: blocks.length,
    validBlocks,
    invalidBlocks: blocks.length - validBlocks,
    issues,
    score: avgScore,
    blockScores
  };
}

// ===== COURSE VALIDATION =====

interface CourseValidationResult {
  courseId: string;
  courseTitle: string;
  valid: boolean;
  moduleCount: number;
  unitCount: number;
  blockCount: number;
  issues: ContentIssue[];
  unitResults: UnitValidationResult[];
  overallScore: number;
}

function validateCourse(course: Course): CourseValidationResult {
  const issues: ContentIssue[] = [];
  const unitResults: UnitValidationResult[] = [];

  const modules = course.syllabus || [];
  let totalUnits = 0;
  let totalBlocks = 0;
  let totalScore = 0;
  let unitScoreCount = 0;

  // Check basic course info
  if (!course.title) {
    issues.push({
      type: 'missing',
      field: 'title',
      message: 'Course has no title',
      messageHe: 'לקורס אין כותרת',
      severity: 'high',
      autoFixable: false
    });
  }

  if (!course.targetAudience) {
    issues.push({
      type: 'missing',
      field: 'targetAudience',
      message: 'Course has no target audience defined',
      messageHe: 'לא הוגדר קהל יעד לקורס',
      severity: 'medium',
      autoFixable: false
    });
  }

  if (modules.length === 0) {
    issues.push({
      type: 'missing',
      field: 'syllabus',
      message: 'Course has no modules',
      messageHe: 'לקורס אין מודולים',
      severity: 'critical',
      autoFixable: false
    });
  }

  // Validate each module and unit
  modules.forEach(module => {
    const units = module.learningUnits || [];
    totalUnits += units.length;

    if (units.length === 0) {
      issues.push({
        type: 'incomplete',
        field: `module_${module.id}`,
        message: `Module "${module.title}" has no units`,
        messageHe: `למודול "${module.title}" אין יחידות`,
        severity: 'medium',
        autoFixable: false
      });
    }

    units.forEach(unit => {
      const unitResult = validateUnit(unit);
      unitResults.push(unitResult);
      totalBlocks += unitResult.blockCount;
      totalScore += unitResult.score;
      unitScoreCount++;

      if (!unitResult.valid) {
        issues.push(...unitResult.issues.filter(i => i.severity === 'critical' || i.severity === 'high'));
      }
    });
  });

  const overallScore = unitScoreCount > 0 ? Math.round(totalScore / unitScoreCount) : 0;

  return {
    courseId: course.id,
    courseTitle: course.title,
    valid: issues.filter(i => i.severity === 'critical').length === 0,
    moduleCount: modules.length,
    unitCount: totalUnits,
    blockCount: totalBlocks,
    issues,
    unitResults,
    overallScore
  };
}

// ===== LESSON PLAN VALIDATION =====

function validateLessonPlan(lessonPlan: TeacherLessonPlan, courseId: string): LessonPlanValidation {
  const issues: ContentIssue[] = [];

  const hasHook = !!lessonPlan.hook?.script_for_teacher;
  const hasDirectInstruction = !!lessonPlan.direct_instruction?.slides?.length;
  const hasGuidedPractice = !!lessonPlan.guided_practice?.teacher_facilitation_script;
  const hasIndependentPractice = !!lessonPlan.independent_practice?.interactive_blocks?.length;
  const hasDiscussion = !!lessonPlan.discussion?.questions?.length;
  const hasSummary = !!lessonPlan.summary?.takeaway_sentence;

  // Check required sections
  if (!hasHook) {
    issues.push({
      type: 'missing',
      field: 'hook',
      message: 'Lesson plan missing hook section',
      messageHe: 'מערך השיעור חסר פתיח',
      severity: 'medium',
      autoFixable: false
    });
  }

  if (!hasDirectInstruction) {
    issues.push({
      type: 'missing',
      field: 'direct_instruction',
      message: 'Lesson plan missing direct instruction',
      messageHe: 'מערך השיעור חסר הוראה ישירה',
      severity: 'high',
      autoFixable: false
    });
  }

  if (!hasSummary) {
    issues.push({
      type: 'missing',
      field: 'summary',
      message: 'Lesson plan missing summary',
      messageHe: 'מערך השיעור חסר סיכום',
      severity: 'medium',
      autoFixable: false
    });
  }

  // Count slides and media
  const slides = lessonPlan.direct_instruction?.slides || [];
  const slideCount = slides.length;

  let mediaAssetCount = 0;
  let mediaAssetsGenerated = 0;
  let mediaAssetsFailed = 0;

  // Count media in hook
  if (lessonPlan.hook?.media_asset) {
    mediaAssetCount++;
    if (lessonPlan.hook.media_asset.url) mediaAssetsGenerated++;
    if (lessonPlan.hook.media_asset.status === 'failed') mediaAssetsFailed++;
  }

  // Count media in slides
  slides.forEach(slide => {
    if (slide.media_asset) {
      mediaAssetCount++;
      if (slide.media_asset.url) mediaAssetsGenerated++;
      if (slide.media_asset.status === 'failed') mediaAssetsFailed++;
    }
  });

  // Calculate script word count
  let scriptWordCount = 0;
  if (lessonPlan.hook?.script_for_teacher) {
    scriptWordCount += lessonPlan.hook.script_for_teacher.split(/\s+/).length;
  }
  slides.forEach(slide => {
    if (slide.script_to_say) {
      scriptWordCount += slide.script_to_say.split(/\s+/).length;
    }
  });

  // Estimate duration (rough: 120 words per minute)
  const estimatedDuration = Math.ceil(scriptWordCount / 120);

  // Get bloom levels used
  const bloomLevelsUsed: string[] = [];
  // This would need actual block analysis

  // Calculate overall score
  let score = 100;
  if (!hasHook) score -= 10;
  if (!hasDirectInstruction) score -= 25;
  if (!hasGuidedPractice) score -= 15;
  if (!hasIndependentPractice) score -= 15;
  if (!hasDiscussion) score -= 10;
  if (!hasSummary) score -= 10;
  if (slideCount < 3) score -= 15;

  return {
    lessonPlanId: `lp_${courseId}_${Date.now()}`,
    courseId,
    hasHook,
    hasDirectInstruction,
    hasGuidedPractice,
    hasIndependentPractice,
    hasDiscussion,
    hasSummary,
    slideCount,
    mediaAssetCount,
    mediaAssetsGenerated,
    mediaAssetsFailed,
    scriptWordCount,
    estimatedDuration,
    bloomLevelsUsed,
    overallScore: Math.max(0, score),
    issues
  };
}

// ===== MAIN AGENT FUNCTION =====

export async function runContentQualityAgent(maxCourses: number = 10): Promise<QAAgentResult> {
  const startTime = Date.now();
  const allResults: TestResult[] = [];

  console.log('🔍 Content Quality Agent starting...');

  try {
    // Fetch recent courses
    const coursesQuery = query(
      collection(db, 'courses'),
      orderBy('createdAt', 'desc'),
      limit(maxCourses)
    );
    const snapshot = await getDocs(coursesQuery);

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    const criticalIssues: TestResult[] = [];

    for (const docSnap of snapshot.docs) {
      const course = { id: docSnap.id, ...docSnap.data() } as Course;
      const result = validateCourse(course);

      totalTests++;

      const testResult: TestResult = {
        id: `content_${course.id}`,
        name: `Course: ${course.title || course.id}`,
        nameHe: `קורס: ${course.title || course.id}`,
        category: 'content-quality',
        status: result.valid ? 'passed' : (result.issues.some(i => i.severity === 'critical') ? 'failed' : 'warning'),
        severity: result.issues.some(i => i.severity === 'critical') ? 'critical' :
                  result.issues.some(i => i.severity === 'high') ? 'high' : 'medium',
        message: `Score: ${result.overallScore}% | ${result.unitCount} units, ${result.blockCount} blocks | ${result.issues.length} issues`,
        messageHe: `ציון: ${result.overallScore}% | ${result.unitCount} יחידות, ${result.blockCount} בלוקים | ${result.issues.length} בעיות`,
        details: {
          courseId: course.id,
          score: result.overallScore,
          moduleCount: result.moduleCount,
          unitCount: result.unitCount,
          blockCount: result.blockCount,
          issues: result.issues,
          unitResults: result.unitResults.map(u => ({
            unitId: u.unitId,
            title: u.unitTitle,
            score: u.score,
            blockCount: u.blockCount,
            issueCount: u.issues.length
          }))
        },
        duration: 0,
        timestamp: new Date()
      };

      allResults.push(testResult);

      if (testResult.status === 'passed') {
        passedTests++;
      } else {
        failedTests++;
        if (testResult.severity === 'critical') {
          criticalIssues.push(testResult);
        }
      }
    }

    console.log(`✅ Content Quality Agent completed: ${passedTests}/${totalTests} courses passed`);

    return {
      agentType: 'content-quality',
      success: failedTests === 0,
      duration: Date.now() - startTime,
      testsRun: totalTests,
      testsPassed: passedTests,
      testsFailed: failedTests,
      criticalIssues,
      allResults
    };

  } catch (error: any) {
    console.error('❌ Content Quality Agent failed:', error);

    return {
      agentType: 'content-quality',
      success: false,
      duration: Date.now() - startTime,
      testsRun: 0,
      testsPassed: 0,
      testsFailed: 1,
      criticalIssues: [{
        id: 'agent_error',
        name: 'Content Quality Agent Error',
        nameHe: 'שגיאת סוכן איכות תוכן',
        category: 'content-quality',
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

export { validateCourse, validateUnit, validateBlock, validateLessonPlan };
