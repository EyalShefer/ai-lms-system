/**
 * Student Simulation Agent
 * סוכן מדמה תלמיד - עובר על הקורסים כתלמיד אמיתי ובודק תקינות
 */

import { db } from '../../firebase';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import type {
  TestResult,
  QAAgentResult,
  StudentSimulationRun,
  SimulatedStudentProfile,
  BlockStuckInfo,
  NavigationIssue,
  ContentError,
  UXProblem
} from '../../types/qa.types';
import { DEFAULT_STUDENT_PROFILES } from '../../types/qa.types';
import type { Course, LearningUnit, ActivityBlock, Module } from '../../shared/types/courseTypes';

// ===== SIMULATED STUDENT BEHAVIOR =====

interface StudentAction {
  type: 'view' | 'answer' | 'skip' | 'hint' | 'retry';
  blockId: string;
  answer?: any;
  correct?: boolean;
  timeSpent: number; // ms
}

interface BlockSimulationResult {
  blockId: string;
  blockType: string;
  completed: boolean;
  stuck: boolean;
  stuckReason?: BlockStuckInfo['reason'];
  error?: ContentError;
  actions: StudentAction[];
  timeSpent: number;
}

interface UnitSimulationResult {
  unitId: string;
  unitTitle: string;
  completed: boolean;
  blocksAttempted: number;
  blocksCompleted: number;
  blocksStuck: BlockStuckInfo[];
  contentErrors: ContentError[];
  totalTime: number;
  blockResults: BlockSimulationResult[];
}

// ===== BLOCK SIMULATORS =====

function simulateMultipleChoiceBlock(
  block: ActivityBlock,
  profile: SimulatedStudentProfile
): BlockSimulationResult {
  const startTime = Date.now();
  const actions: StudentAction[] = [];
  const content = block.content || {};

  // Check if block is valid
  const options = content.options || [];
  const correctAnswer = content.correctAnswer || content.correct_answer;

  if (options.length === 0) {
    return {
      blockId: block.id,
      blockType: block.type,
      completed: false,
      stuck: true,
      stuckReason: 'missing_content',
      error: {
        blockId: block.id,
        blockType: block.type,
        errorType: 'missing_data',
        errorMessage: 'No options available'
      },
      actions: [],
      timeSpent: Date.now() - startTime
    };
  }

  if (!correctAnswer) {
    return {
      blockId: block.id,
      blockType: block.type,
      completed: false,
      stuck: true,
      stuckReason: 'no_correct_option',
      error: {
        blockId: block.id,
        blockType: block.type,
        errorType: 'missing_data',
        errorMessage: 'No correct answer defined'
      },
      actions: [],
      timeSpent: Date.now() - startTime
    };
  }

  // Simulate reading time
  const readTime = profile.readContent ?
    (profile.interactionSpeed === 'slow' ? 5000 : profile.interactionSpeed === 'fast' ? 1000 : 2500) : 500;

  actions.push({
    type: 'view',
    blockId: block.id,
    timeSpent: readTime
  });

  // Decide if student answers correctly
  const answersCorrectly = Math.random() < profile.correctAnswerRate;

  // Use hint if struggling and hints available
  if (!answersCorrectly && profile.useHints && block.metadata?.progressiveHints?.length) {
    actions.push({
      type: 'hint',
      blockId: block.id,
      timeSpent: 1500
    });
  }

  // Submit answer
  const selectedAnswer = answersCorrectly ? correctAnswer : options[Math.floor(Math.random() * options.length)];
  const isCorrect = selectedAnswer === correctAnswer;

  actions.push({
    type: 'answer',
    blockId: block.id,
    answer: selectedAnswer,
    correct: isCorrect,
    timeSpent: profile.interactionSpeed === 'slow' ? 3000 : profile.interactionSpeed === 'fast' ? 800 : 1500
  });

  // Retry if wrong and profile is persistent
  if (!isCorrect && profile.type === 'struggling') {
    actions.push({
      type: 'retry',
      blockId: block.id,
      timeSpent: 1000
    });
    actions.push({
      type: 'answer',
      blockId: block.id,
      answer: correctAnswer,
      correct: true,
      timeSpent: 2000
    });
  }

  const totalTime = actions.reduce((sum, a) => sum + a.timeSpent, 0);

  return {
    blockId: block.id,
    blockType: block.type,
    completed: true,
    stuck: false,
    actions,
    timeSpent: totalTime
  };
}

function simulateOpenQuestionBlock(
  block: ActivityBlock,
  profile: SimulatedStudentProfile
): BlockSimulationResult {
  const startTime = Date.now();
  const actions: StudentAction[] = [];
  const content = block.content || {};

  if (!content.question) {
    return {
      blockId: block.id,
      blockType: block.type,
      completed: false,
      stuck: true,
      stuckReason: 'missing_content',
      error: {
        blockId: block.id,
        blockType: block.type,
        errorType: 'missing_data',
        errorMessage: 'No question text'
      },
      actions: [],
      timeSpent: Date.now() - startTime
    };
  }

  // Simulate reading
  const readTime = profile.readContent ? 3000 : 1000;
  actions.push({
    type: 'view',
    blockId: block.id,
    timeSpent: readTime
  });

  // Simulate typing answer (longer for open questions)
  const typingTime = profile.interactionSpeed === 'slow' ? 15000 :
                     profile.interactionSpeed === 'fast' ? 5000 : 8000;

  actions.push({
    type: 'answer',
    blockId: block.id,
    answer: '[Simulated open answer]',
    timeSpent: typingTime
  });

  const totalTime = actions.reduce((sum, a) => sum + a.timeSpent, 0);

  return {
    blockId: block.id,
    blockType: block.type,
    completed: true,
    stuck: false,
    actions,
    timeSpent: totalTime
  };
}

function simulateOrderingBlock(
  block: ActivityBlock,
  profile: SimulatedStudentProfile
): BlockSimulationResult {
  const startTime = Date.now();
  const actions: StudentAction[] = [];
  const content = block.content || {};

  const correctOrder = content.correct_order || content.correctOrder || [];

  if (correctOrder.length < 2) {
    return {
      blockId: block.id,
      blockType: block.type,
      completed: false,
      stuck: true,
      stuckReason: 'missing_content',
      error: {
        blockId: block.id,
        blockType: block.type,
        errorType: 'missing_data',
        errorMessage: 'Not enough items to order'
      },
      actions: [],
      timeSpent: Date.now() - startTime
    };
  }

  actions.push({
    type: 'view',
    blockId: block.id,
    timeSpent: profile.readContent ? 2000 : 500
  });

  // Simulate drag and drop actions
  const interactionTime = correctOrder.length * (profile.interactionSpeed === 'slow' ? 2000 : 1000);
  actions.push({
    type: 'answer',
    blockId: block.id,
    answer: correctOrder, // Simulated correct order
    correct: Math.random() < profile.correctAnswerRate,
    timeSpent: interactionTime
  });

  const totalTime = actions.reduce((sum, a) => sum + a.timeSpent, 0);

  return {
    blockId: block.id,
    blockType: block.type,
    completed: true,
    stuck: false,
    actions,
    timeSpent: totalTime
  };
}

function simulateCategorizationBlock(
  block: ActivityBlock,
  profile: SimulatedStudentProfile
): BlockSimulationResult {
  const startTime = Date.now();
  const actions: StudentAction[] = [];
  const content = block.content || {};

  const categories = content.categories || [];
  const items = content.items || [];

  if (categories.length < 2 || items.length === 0) {
    return {
      blockId: block.id,
      blockType: block.type,
      completed: false,
      stuck: true,
      stuckReason: 'missing_content',
      error: {
        blockId: block.id,
        blockType: block.type,
        errorType: 'missing_data',
        errorMessage: 'Missing categories or items'
      },
      actions: [],
      timeSpent: Date.now() - startTime
    };
  }

  actions.push({
    type: 'view',
    blockId: block.id,
    timeSpent: profile.readContent ? 3000 : 1000
  });

  const interactionTime = items.length * (profile.interactionSpeed === 'slow' ? 1500 : 800);
  actions.push({
    type: 'answer',
    blockId: block.id,
    correct: Math.random() < profile.correctAnswerRate,
    timeSpent: interactionTime
  });

  const totalTime = actions.reduce((sum, a) => sum + a.timeSpent, 0);

  return {
    blockId: block.id,
    blockType: block.type,
    completed: true,
    stuck: false,
    actions,
    timeSpent: totalTime
  };
}

function simulateMemoryGameBlock(
  block: ActivityBlock,
  profile: SimulatedStudentProfile
): BlockSimulationResult {
  const startTime = Date.now();
  const actions: StudentAction[] = [];
  const content = block.content || {};

  const pairs = content.pairs || content.cards || [];

  if (pairs.length < 2) {
    return {
      blockId: block.id,
      blockType: block.type,
      completed: false,
      stuck: true,
      stuckReason: 'missing_content',
      error: {
        blockId: block.id,
        blockType: block.type,
        errorType: 'missing_data',
        errorMessage: 'Not enough pairs for memory game'
      },
      actions: [],
      timeSpent: Date.now() - startTime
    };
  }

  actions.push({
    type: 'view',
    blockId: block.id,
    timeSpent: 1000
  });

  // Simulate playing memory game (time based on pairs and skill)
  const baseTime = pairs.length * 3000;
  const skillMultiplier = profile.type === 'advanced' ? 0.6 : profile.type === 'struggling' ? 1.5 : 1;
  const playTime = Math.round(baseTime * skillMultiplier);

  actions.push({
    type: 'answer',
    blockId: block.id,
    correct: true, // Memory games always complete eventually
    timeSpent: playTime
  });

  const totalTime = actions.reduce((sum, a) => sum + a.timeSpent, 0);

  return {
    blockId: block.id,
    blockType: block.type,
    completed: true,
    stuck: false,
    actions,
    timeSpent: totalTime
  };
}

function simulateMediaBlock(
  block: ActivityBlock,
  profile: SimulatedStudentProfile
): BlockSimulationResult {
  const startTime = Date.now();
  const actions: StudentAction[] = [];

  if (!block.content) {
    return {
      blockId: block.id,
      blockType: block.type,
      completed: false,
      stuck: true,
      stuckReason: 'missing_content',
      error: {
        blockId: block.id,
        blockType: block.type,
        errorType: 'missing_data',
        errorMessage: 'No media content/URL'
      },
      actions: [],
      timeSpent: Date.now() - startTime
    };
  }

  // Simulate viewing media
  const viewTime = block.type === 'video' ? 30000 :
                   block.type === 'text' ? 5000 :
                   block.type === 'image' ? 3000 : 10000;

  const adjustedTime = profile.readContent ? viewTime : Math.round(viewTime * 0.3);

  actions.push({
    type: 'view',
    blockId: block.id,
    timeSpent: adjustedTime
  });

  return {
    blockId: block.id,
    blockType: block.type,
    completed: true,
    stuck: false,
    actions,
    timeSpent: adjustedTime
  };
}

function simulateBlock(
  block: ActivityBlock,
  profile: SimulatedStudentProfile
): BlockSimulationResult {
  try {
    switch (block.type) {
      case 'multiple-choice':
        return simulateMultipleChoiceBlock(block, profile);
      case 'open-question':
        return simulateOpenQuestionBlock(block, profile);
      case 'ordering':
        return simulateOrderingBlock(block, profile);
      case 'categorization':
        return simulateCategorizationBlock(block, profile);
      case 'memory_game':
        return simulateMemoryGameBlock(block, profile);
      case 'text':
      case 'video':
      case 'image':
      case 'pdf':
        return simulateMediaBlock(block, profile);
      default:
        // Generic block handling
        return {
          blockId: block.id,
          blockType: block.type,
          completed: true,
          stuck: false,
          actions: [{ type: 'view', blockId: block.id, timeSpent: 2000 }],
          timeSpent: 2000
        };
    }
  } catch (error: any) {
    return {
      blockId: block.id,
      blockType: block.type,
      completed: false,
      stuck: true,
      stuckReason: 'error_thrown',
      error: {
        blockId: block.id,
        blockType: block.type,
        errorType: 'crash',
        errorMessage: error.message,
        stackTrace: error.stack
      },
      actions: [],
      timeSpent: 0
    };
  }
}

// ===== UNIT SIMULATOR =====

function simulateUnit(
  unit: LearningUnit,
  profile: SimulatedStudentProfile
): UnitSimulationResult {
  const blocks = unit.activityBlocks || [];
  const blockResults: BlockSimulationResult[] = [];
  const blocksStuck: BlockStuckInfo[] = [];
  const contentErrors: ContentError[] = [];

  let blocksCompleted = 0;
  let totalTime = 0;

  for (const block of blocks) {
    const result = simulateBlock(block, profile);
    blockResults.push(result);
    totalTime += result.timeSpent;

    if (result.completed) {
      blocksCompleted++;
    }

    if (result.stuck && result.stuckReason) {
      blocksStuck.push({
        blockId: block.id,
        blockType: block.type,
        reason: result.stuckReason,
        errorMessage: result.error?.errorMessage
      });
    }

    if (result.error) {
      contentErrors.push(result.error);
    }
  }

  return {
    unitId: unit.id,
    unitTitle: unit.title,
    completed: blocksCompleted === blocks.length && blocks.length > 0,
    blocksAttempted: blocks.length,
    blocksCompleted,
    blocksStuck,
    contentErrors,
    totalTime,
    blockResults
  };
}

// ===== COURSE SIMULATOR =====

function simulateCourse(
  course: Course,
  profile: SimulatedStudentProfile
): StudentSimulationRun {
  const startedAt = new Date();
  const modules = course.syllabus || [];

  let unitsAttempted = 0;
  let unitsCompleted = 0;
  let blocksAttempted = 0;
  let blocksCompleted = 0;
  const allBlocksStuck: BlockStuckInfo[] = [];
  const allContentErrors: ContentError[] = [];
  const allUxProblems: UXProblem[] = [];
  const navigationIssues: NavigationIssue[] = [];
  let totalTime = 0;

  // Check for empty course
  if (modules.length === 0) {
    allUxProblems.push({
      location: `course_${course.id}`,
      problemType: 'confusing_ui',
      description: 'Course has no modules to navigate',
      severity: 'high'
    });
  }

  for (const module of modules) {
    const units = module.learningUnits || [];

    if (units.length === 0) {
      allUxProblems.push({
        location: `module_${module.id}`,
        problemType: 'confusing_ui',
        description: `Module "${module.title}" has no units`,
        severity: 'medium'
      });
      continue;
    }

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      unitsAttempted++;

      const unitResult = simulateUnit(unit, profile);
      blocksAttempted += unitResult.blocksAttempted;
      blocksCompleted += unitResult.blocksCompleted;
      totalTime += unitResult.totalTime;

      if (unitResult.completed) {
        unitsCompleted++;
      }

      allBlocksStuck.push(...unitResult.blocksStuck);
      allContentErrors.push(...unitResult.contentErrors);

      // Check navigation to next unit
      if (i < units.length - 1 && unitResult.blocksStuck.length > 0) {
        // If stuck, check if can still navigate forward
        navigationIssues.push({
          fromUnit: unit.id,
          toUnit: units[i + 1].id,
          issue: 'progress_not_saved',
          details: 'Student got stuck but progress may not be saved correctly'
        });
      }
    }
  }

  const avgTimePerBlock = blocksAttempted > 0 ? Math.round(totalTime / blocksAttempted) : 0;
  const errorRate = blocksAttempted > 0 ? Math.round((allBlocksStuck.length / blocksAttempted) * 100) : 0;
  const completionRate = blocksAttempted > 0 ? Math.round((blocksCompleted / blocksAttempted) * 100) : 0;

  return {
    id: `sim_${course.id}_${Date.now()}`,
    courseId: course.id,
    simulationType: 'full_course',
    studentProfile: profile,
    startedAt,
    completedAt: new Date(),
    status: allBlocksStuck.length > 0 ? 'stuck' : 'completed',
    unitsAttempted,
    unitsCompleted,
    blocksAttempted,
    blocksCompleted,
    blocksStuck: allBlocksStuck,
    navigationIssues,
    contentErrors: allContentErrors,
    uxProblems: allUxProblems,
    averageTimePerBlock: avgTimePerBlock,
    errorRate,
    completionRate
  };
}

// ===== MAIN AGENT FUNCTION =====

export async function runStudentSimulationAgent(
  maxCourses: number = 5,
  profiles: SimulatedStudentProfile[] = [
    { type: 'average', correctAnswerRate: 0.7, useHints: false, readContent: true, interactionSpeed: 'normal' }
  ]
): Promise<QAAgentResult> {
  const startTime = Date.now();
  const allResults: TestResult[] = [];

  console.log('🎓 Student Simulation Agent starting...');
  console.log(`   Testing with ${profiles.length} student profile(s)...`);

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

      for (const profile of profiles) {
        totalTests++;
        const simulation = simulateCourse(course, profile);

        const hasCriticalIssues = simulation.contentErrors.length > 0 ||
                                   simulation.blocksStuck.some(b => b.reason === 'error_thrown');
        const hasIssues = simulation.blocksStuck.length > 0 || simulation.uxProblems.length > 0;

        const status = hasCriticalIssues ? 'failed' :
                       hasIssues ? 'warning' : 'passed';

        const testResult: TestResult = {
          id: `sim_${course.id}_${profile.type}`,
          name: `[${profile.type}] ${course.title || course.id}`,
          nameHe: `[${profile.type}] ${course.title || course.id}`,
          category: 'student-simulation',
          status,
          severity: hasCriticalIssues ? 'critical' : hasIssues ? 'medium' : 'low',
          message: `Completion: ${simulation.completionRate}% | Stuck: ${simulation.blocksStuck.length} | Errors: ${simulation.contentErrors.length}`,
          messageHe: `השלמה: ${simulation.completionRate}% | תקוע: ${simulation.blocksStuck.length} | שגיאות: ${simulation.contentErrors.length}`,
          details: {
            courseId: course.id,
            profile: profile.type,
            unitsAttempted: simulation.unitsAttempted,
            unitsCompleted: simulation.unitsCompleted,
            blocksAttempted: simulation.blocksAttempted,
            blocksCompleted: simulation.blocksCompleted,
            completionRate: simulation.completionRate,
            errorRate: simulation.errorRate,
            avgTimePerBlock: simulation.averageTimePerBlock,
            blocksStuck: simulation.blocksStuck,
            contentErrors: simulation.contentErrors,
            uxProblems: simulation.uxProblems,
            navigationIssues: simulation.navigationIssues
          },
          duration: simulation.completedAt ?
            simulation.completedAt.getTime() - simulation.startedAt.getTime() : 0,
          timestamp: new Date()
        };

        allResults.push(testResult);

        if (status === 'passed') {
          passedTests++;
        } else {
          failedTests++;
          if (hasCriticalIssues) {
            criticalIssues.push(testResult);
          }
        }
      }
    }

    console.log(`✅ Student Simulation completed: ${passedTests}/${totalTests} passed`);

    return {
      agentType: 'student-simulation',
      success: criticalIssues.length === 0,
      duration: Date.now() - startTime,
      testsRun: totalTests,
      testsPassed: passedTests,
      testsFailed: failedTests,
      criticalIssues,
      allResults
    };

  } catch (error: any) {
    console.error('❌ Student Simulation Agent failed:', error);

    return {
      agentType: 'student-simulation',
      success: false,
      duration: Date.now() - startTime,
      testsRun: 0,
      testsPassed: 0,
      testsFailed: 1,
      criticalIssues: [{
        id: 'sim_agent_error',
        name: 'Student Simulation Error',
        nameHe: 'שגיאת סימולציית תלמיד',
        category: 'student-simulation',
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

export { simulateCourse, simulateUnit, simulateBlock };
