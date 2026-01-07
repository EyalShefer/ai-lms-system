/**
 * AI Generation Agent
 * סוכן בודק יצירת תוכן AI - בודק מהירות ואיכות היצירה
 */

import { db } from '../../firebase';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import type {
  TestResult,
  QAAgentResult,
  AIGenerationTest,
  AIGenerationIssue
} from '../../types/qa.types';

// Import generation functions
import {
  generateSingleMultipleChoiceQuestion,
  generateSingleOpenQuestion,
  generateCategorizationQuestion,
  generateOrderingQuestion,
  generateMemoryGame,
  generateFillInBlanksQuestion
} from '../../gemini';

// ===== TEST PARAMETERS =====

const TEST_TOPICS = [
  { topic: 'מלחמת העולם השנייה', gradeLevel: 'ט', subject: 'היסטוריה' },
  { topic: 'פוטוסינתזה', gradeLevel: 'ז', subject: 'מדעים' },
  { topic: 'משוואות ריבועיות', gradeLevel: 'י', subject: 'מתמטיקה' },
];

const SAMPLE_SOURCE_TEXT = `
פוטוסינתזה היא תהליך ביוכימי שבו צמחים, אצות וחיידקים מסוימים הופכים אור שמש לאנרגיה כימית.
התהליך מתרחש בכלורופלסטים של התא הצמחי, שם קיים הפיגמנט הירוק כלורופיל.
במהלך הפוטוסינתזה, הצמח קולט פחמן דו-חמצני מהאוויר ומים מהאדמה, ובעזרת אנרגיית אור
מייצר גלוקוז וחמצן. הגלוקוז משמש לבניית רקמות הצמח ולייצור אנרגיה, ואילו החמצן משתחרר לאטמוספירה.
`;

// ===== VALIDATION HELPERS =====

function validateMultipleChoiceOutput(output: any): { valid: boolean; issues: AIGenerationIssue[] } {
  const issues: AIGenerationIssue[] = [];

  if (!output) {
    issues.push({ type: 'invalid_json', message: 'No output returned' });
    return { valid: false, issues };
  }

  // Check for question
  if (!output.question && !output.content?.question) {
    issues.push({ type: 'empty_field', field: 'question', message: 'Missing question text' });
  }

  // Check for options
  const options = output.options || output.content?.options || [];
  if (options.length < 2) {
    issues.push({ type: 'schema_mismatch', field: 'options', expected: '2-4 options', actual: `${options.length} options`, message: 'Not enough options' });
  }

  // Check for correct answer
  const correctAnswer = output.correctAnswer || output.correct_answer || output.content?.correctAnswer;
  if (!correctAnswer) {
    issues.push({ type: 'empty_field', field: 'correctAnswer', message: 'Missing correct answer' });
  }

  // Check language (Hebrew expected)
  const questionText = output.question || output.content?.question || '';
  const hasHebrew = /[\u0590-\u05FF]/.test(questionText);
  if (questionText && !hasHebrew) {
    issues.push({ type: 'wrong_language', expected: 'Hebrew', actual: 'Non-Hebrew', message: 'Question not in Hebrew' });
  }

  return { valid: issues.length === 0, issues };
}

function validateOpenQuestionOutput(output: any): { valid: boolean; issues: AIGenerationIssue[] } {
  const issues: AIGenerationIssue[] = [];

  if (!output) {
    issues.push({ type: 'invalid_json', message: 'No output returned' });
    return { valid: false, issues };
  }

  const question = output.question || output.content?.question || '';
  if (!question || question.length < 10) {
    issues.push({ type: 'content_too_short', field: 'question', message: 'Question too short or missing' });
  }

  // Check for Hebrew
  const hasHebrew = /[\u0590-\u05FF]/.test(question);
  if (question && !hasHebrew) {
    issues.push({ type: 'wrong_language', expected: 'Hebrew', message: 'Question not in Hebrew' });
  }

  return { valid: issues.length === 0, issues };
}

function validateCategorizationOutput(output: any): { valid: boolean; issues: AIGenerationIssue[] } {
  const issues: AIGenerationIssue[] = [];

  if (!output) {
    issues.push({ type: 'invalid_json', message: 'No output returned' });
    return { valid: false, issues };
  }

  const content = output.content || output;
  const categories = content.categories || [];
  const items = content.items || [];

  if (categories.length < 2) {
    issues.push({ type: 'schema_mismatch', field: 'categories', expected: '2+ categories', actual: `${categories.length}`, message: 'Not enough categories' });
  }

  if (items.length < categories.length) {
    issues.push({ type: 'schema_mismatch', field: 'items', message: 'Fewer items than categories' });
  }

  // Check all items have category assignment
  const invalidItems = items.filter((item: any) => !item.category || !categories.includes(item.category));
  if (invalidItems.length > 0) {
    issues.push({ type: 'schema_mismatch', field: 'items', message: `${invalidItems.length} items with invalid category assignment` });
  }

  return { valid: issues.length === 0, issues };
}

function validateOrderingOutput(output: any): { valid: boolean; issues: AIGenerationIssue[] } {
  const issues: AIGenerationIssue[] = [];

  if (!output) {
    issues.push({ type: 'invalid_json', message: 'No output returned' });
    return { valid: false, issues };
  }

  const content = output.content || output;
  const correctOrder = content.correct_order || content.correctOrder || [];

  if (correctOrder.length < 3) {
    issues.push({ type: 'schema_mismatch', field: 'correct_order', expected: '3+ items', actual: `${correctOrder.length}`, message: 'Not enough items to order' });
  }

  if (!content.instruction) {
    issues.push({ type: 'empty_field', field: 'instruction', message: 'Missing instruction' });
  }

  return { valid: issues.length === 0, issues };
}

function validateMemoryGameOutput(output: any): { valid: boolean; issues: AIGenerationIssue[] } {
  const issues: AIGenerationIssue[] = [];

  if (!output) {
    issues.push({ type: 'invalid_json', message: 'No output returned' });
    return { valid: false, issues };
  }

  const content = output.content || output;
  const pairs = content.pairs || content.cards || [];

  if (pairs.length < 4) {
    issues.push({ type: 'schema_mismatch', field: 'pairs', expected: '4+ pairs', actual: `${pairs.length}`, message: 'Not enough pairs for memory game' });
  }

  // Check pairs have left/right or card_a/card_b
  const invalidPairs = pairs.filter((pair: any) =>
    !(pair.left && pair.right) && !(pair.card_a && pair.card_b) && !(pair.term && pair.definition)
  );
  if (invalidPairs.length > 0) {
    issues.push({ type: 'schema_mismatch', field: 'pairs', message: `${invalidPairs.length} pairs with invalid structure` });
  }

  return { valid: issues.length === 0, issues };
}

// ===== INDIVIDUAL TEST RUNNERS =====

async function testMultipleChoiceGeneration(
  topic: string,
  gradeLevel: string,
  sourceText?: string,
  timeout: number = 30000
): Promise<AIGenerationTest> {
  const startTime = Date.now();
  const testId = `mc_${Date.now()}`;

  try {
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );

    const result = await Promise.race([
      generateSingleMultipleChoiceQuestion(topic, gradeLevel, sourceText),
      timeoutPromise
    ]);

    const duration = Date.now() - startTime;
    const validation = validateMultipleChoiceOutput(result);

    return {
      id: testId,
      testType: 'activity_generation',
      inputParams: { topic, gradeLevel, type: 'multiple-choice' },
      startedAt: new Date(startTime),
      completedAt: new Date(),
      status: 'completed',
      duration,
      retryCount: 0,
      outputValid: validation.valid,
      schemaMatch: validation.valid,
      contentQualityScore: validation.valid ? 100 : Math.max(0, 100 - (validation.issues.length * 25)),
      issues: validation.issues,
      generatedContent: result
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const isTimeout = error.message === 'Timeout';

    return {
      id: testId,
      testType: 'activity_generation',
      inputParams: { topic, gradeLevel, type: 'multiple-choice' },
      startedAt: new Date(startTime),
      completedAt: new Date(),
      status: isTimeout ? 'timeout' : 'failed',
      duration,
      retryCount: 0,
      outputValid: false,
      schemaMatch: false,
      contentQualityScore: 0,
      issues: [{ type: isTimeout ? 'timeout' : 'invalid_json', message: error.message }]
    };
  }
}

async function testOpenQuestionGeneration(
  topic: string,
  gradeLevel: string,
  sourceText?: string,
  timeout: number = 30000
): Promise<AIGenerationTest> {
  const startTime = Date.now();
  const testId = `oq_${Date.now()}`;

  try {
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );

    const result = await Promise.race([
      generateSingleOpenQuestion(topic, gradeLevel, sourceText),
      timeoutPromise
    ]);

    const duration = Date.now() - startTime;
    const validation = validateOpenQuestionOutput(result);

    return {
      id: testId,
      testType: 'activity_generation',
      inputParams: { topic, gradeLevel, type: 'open-question' },
      startedAt: new Date(startTime),
      completedAt: new Date(),
      status: 'completed',
      duration,
      retryCount: 0,
      outputValid: validation.valid,
      schemaMatch: validation.valid,
      contentQualityScore: validation.valid ? 100 : Math.max(0, 100 - (validation.issues.length * 25)),
      issues: validation.issues,
      generatedContent: result
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const isTimeout = error.message === 'Timeout';

    return {
      id: testId,
      testType: 'activity_generation',
      inputParams: { topic, gradeLevel, type: 'open-question' },
      startedAt: new Date(startTime),
      completedAt: new Date(),
      status: isTimeout ? 'timeout' : 'failed',
      duration,
      retryCount: 0,
      outputValid: false,
      schemaMatch: false,
      contentQualityScore: 0,
      issues: [{ type: isTimeout ? 'timeout' : 'invalid_json', message: error.message }]
    };
  }
}

async function testCategorizationGeneration(
  topic: string,
  gradeLevel: string,
  sourceText?: string,
  timeout: number = 30000
): Promise<AIGenerationTest> {
  const startTime = Date.now();
  const testId = `cat_${Date.now()}`;

  try {
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );

    const result = await Promise.race([
      generateCategorizationQuestion(topic, gradeLevel, sourceText),
      timeoutPromise
    ]);

    const duration = Date.now() - startTime;
    const validation = validateCategorizationOutput(result);

    return {
      id: testId,
      testType: 'activity_generation',
      inputParams: { topic, gradeLevel, type: 'categorization' },
      startedAt: new Date(startTime),
      completedAt: new Date(),
      status: 'completed',
      duration,
      retryCount: 0,
      outputValid: validation.valid,
      schemaMatch: validation.valid,
      contentQualityScore: validation.valid ? 100 : Math.max(0, 100 - (validation.issues.length * 25)),
      issues: validation.issues,
      generatedContent: result
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    return {
      id: testId,
      testType: 'activity_generation',
      inputParams: { topic, gradeLevel, type: 'categorization' },
      startedAt: new Date(startTime),
      completedAt: new Date(),
      status: error.message === 'Timeout' ? 'timeout' : 'failed',
      duration,
      retryCount: 0,
      outputValid: false,
      schemaMatch: false,
      contentQualityScore: 0,
      issues: [{ type: error.message === 'Timeout' ? 'timeout' : 'invalid_json', message: error.message }]
    };
  }
}

async function testOrderingGeneration(
  topic: string,
  gradeLevel: string,
  sourceText?: string,
  timeout: number = 30000
): Promise<AIGenerationTest> {
  const startTime = Date.now();
  const testId = `ord_${Date.now()}`;

  try {
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );

    const result = await Promise.race([
      generateOrderingQuestion(topic, gradeLevel, sourceText),
      timeoutPromise
    ]);

    const duration = Date.now() - startTime;
    const validation = validateOrderingOutput(result);

    return {
      id: testId,
      testType: 'activity_generation',
      inputParams: { topic, gradeLevel, type: 'ordering' },
      startedAt: new Date(startTime),
      completedAt: new Date(),
      status: 'completed',
      duration,
      retryCount: 0,
      outputValid: validation.valid,
      schemaMatch: validation.valid,
      contentQualityScore: validation.valid ? 100 : Math.max(0, 100 - (validation.issues.length * 25)),
      issues: validation.issues,
      generatedContent: result
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    return {
      id: testId,
      testType: 'activity_generation',
      inputParams: { topic, gradeLevel, type: 'ordering' },
      startedAt: new Date(startTime),
      completedAt: new Date(),
      status: error.message === 'Timeout' ? 'timeout' : 'failed',
      duration,
      retryCount: 0,
      outputValid: false,
      schemaMatch: false,
      contentQualityScore: 0,
      issues: [{ type: error.message === 'Timeout' ? 'timeout' : 'invalid_json', message: error.message }]
    };
  }
}

async function testMemoryGameGeneration(
  topic: string,
  gradeLevel: string,
  sourceText?: string,
  timeout: number = 30000
): Promise<AIGenerationTest> {
  const startTime = Date.now();
  const testId = `mem_${Date.now()}`;

  try {
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );

    const result = await Promise.race([
      generateMemoryGame(topic, gradeLevel, sourceText),
      timeoutPromise
    ]);

    const duration = Date.now() - startTime;
    const validation = validateMemoryGameOutput(result);

    return {
      id: testId,
      testType: 'activity_generation',
      inputParams: { topic, gradeLevel, type: 'memory_game' },
      startedAt: new Date(startTime),
      completedAt: new Date(),
      status: 'completed',
      duration,
      retryCount: 0,
      outputValid: validation.valid,
      schemaMatch: validation.valid,
      contentQualityScore: validation.valid ? 100 : Math.max(0, 100 - (validation.issues.length * 25)),
      issues: validation.issues,
      generatedContent: result
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    return {
      id: testId,
      testType: 'activity_generation',
      inputParams: { topic, gradeLevel, type: 'memory_game' },
      startedAt: new Date(startTime),
      completedAt: new Date(),
      status: error.message === 'Timeout' ? 'timeout' : 'failed',
      duration,
      retryCount: 0,
      outputValid: false,
      schemaMatch: false,
      contentQualityScore: 0,
      issues: [{ type: error.message === 'Timeout' ? 'timeout' : 'invalid_json', message: error.message }]
    };
  }
}

// ===== MAIN AGENT FUNCTION =====

export async function runAIGenerationAgent(
  testTypes: ('multiple-choice' | 'open-question' | 'categorization' | 'ordering' | 'memory_game')[] = ['multiple-choice', 'open-question'],
  timeout: number = 30000
): Promise<QAAgentResult> {
  const startTime = Date.now();
  const allResults: TestResult[] = [];
  const allGenerationTests: AIGenerationTest[] = [];

  console.log('🤖 AI Generation Agent starting...');
  console.log(`   Testing types: ${testTypes.join(', ')}`);

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const criticalIssues: TestResult[] = [];

  // Run tests for each topic
  for (const testTopic of TEST_TOPICS) {
    const { topic, gradeLevel } = testTopic;

    for (const testType of testTypes) {
      totalTests++;
      let generationTest: AIGenerationTest;

      switch (testType) {
        case 'multiple-choice':
          generationTest = await testMultipleChoiceGeneration(topic, gradeLevel, SAMPLE_SOURCE_TEXT, timeout);
          break;
        case 'open-question':
          generationTest = await testOpenQuestionGeneration(topic, gradeLevel, SAMPLE_SOURCE_TEXT, timeout);
          break;
        case 'categorization':
          generationTest = await testCategorizationGeneration(topic, gradeLevel, SAMPLE_SOURCE_TEXT, timeout);
          break;
        case 'ordering':
          generationTest = await testOrderingGeneration(topic, gradeLevel, SAMPLE_SOURCE_TEXT, timeout);
          break;
        case 'memory_game':
          generationTest = await testMemoryGameGeneration(topic, gradeLevel, SAMPLE_SOURCE_TEXT, timeout);
          break;
        default:
          continue;
      }

      allGenerationTests.push(generationTest);

      const isPassed = generationTest.status === 'completed' && generationTest.outputValid;
      const status = isPassed ? 'passed' :
                     generationTest.status === 'timeout' ? 'warning' : 'failed';

      const testResult: TestResult = {
        id: generationTest.id,
        name: `[${testType}] ${topic}`,
        nameHe: `[${testType}] ${topic}`,
        category: 'ai-generation',
        status,
        severity: generationTest.status === 'failed' ? 'high' :
                  generationTest.status === 'timeout' ? 'medium' : 'low',
        message: `Duration: ${generationTest.duration}ms | Quality: ${generationTest.contentQualityScore}% | Issues: ${generationTest.issues.length}`,
        messageHe: `משך: ${generationTest.duration}ms | איכות: ${generationTest.contentQualityScore}% | בעיות: ${generationTest.issues.length}`,
        details: {
          testType,
          topic,
          gradeLevel,
          duration: generationTest.duration,
          qualityScore: generationTest.contentQualityScore,
          outputValid: generationTest.outputValid,
          issues: generationTest.issues,
          generatedContentPreview: generationTest.generatedContent ?
            JSON.stringify(generationTest.generatedContent).substring(0, 200) + '...' : null
        },
        duration: generationTest.duration,
        timestamp: new Date()
      };

      allResults.push(testResult);

      if (isPassed) {
        passedTests++;
      } else {
        failedTests++;
        if (generationTest.status === 'failed') {
          criticalIssues.push(testResult);
        }
      }

      // Small delay between API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Calculate performance metrics
  const avgDuration = allGenerationTests.length > 0 ?
    Math.round(allGenerationTests.reduce((sum, t) => sum + t.duration, 0) / allGenerationTests.length) : 0;
  const avgQuality = allGenerationTests.length > 0 ?
    Math.round(allGenerationTests.reduce((sum, t) => sum + t.contentQualityScore, 0) / allGenerationTests.length) : 0;

  console.log(`✅ AI Generation Agent completed:`);
  console.log(`   Passed: ${passedTests}/${totalTests}`);
  console.log(`   Avg Duration: ${avgDuration}ms`);
  console.log(`   Avg Quality: ${avgQuality}%`);

  // Add summary test result
  allResults.push({
    id: 'ai_gen_summary',
    name: 'AI Generation Summary',
    nameHe: 'סיכום יצירת AI',
    category: 'ai-generation',
    status: failedTests === 0 ? 'passed' : failedTests > totalTests / 2 ? 'failed' : 'warning',
    severity: 'info',
    message: `Avg Duration: ${avgDuration}ms | Avg Quality: ${avgQuality}% | Pass Rate: ${Math.round((passedTests / totalTests) * 100)}%`,
    messageHe: `משך ממוצע: ${avgDuration}ms | איכות ממוצעת: ${avgQuality}% | אחוז הצלחה: ${Math.round((passedTests / totalTests) * 100)}%`,
    details: {
      avgDuration,
      avgQuality,
      passRate: Math.round((passedTests / totalTests) * 100),
      testsPerType: testTypes.map(type => ({
        type,
        count: allGenerationTests.filter(t => t.inputParams.type === type).length
      }))
    },
    duration: Date.now() - startTime,
    timestamp: new Date()
  });

  return {
    agentType: 'ai-generation',
    success: failedTests === 0,
    duration: Date.now() - startTime,
    testsRun: totalTests,
    testsPassed: passedTests,
    testsFailed: failedTests,
    criticalIssues,
    allResults
  };
}

export {
  testMultipleChoiceGeneration,
  testOpenQuestionGeneration,
  testCategorizationGeneration,
  testOrderingGeneration,
  testMemoryGameGeneration,
  validateMultipleChoiceOutput,
  validateOpenQuestionOutput
};
