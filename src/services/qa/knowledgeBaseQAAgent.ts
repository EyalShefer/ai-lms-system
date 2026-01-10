/**
 * Knowledge Base Integration QA Agent
 * סוכן בדיקות לאינטגרציית בסיס הידע
 *
 * בודק:
 * 1. שליפה מבסיס הידע עובדת
 * 2. חילוץ אלמנטים פדגוגיים (תרגילים, טעויות, שפה)
 * 3. יישום ההקשר ביצירת תוכן AI
 * 4. התאמת השפה והסגנון לספר הלימוד
 */

import type {
  TestResult,
  QAAgentResult,
} from '../../types/qa.types';

import {
  searchKnowledge,
  getMathPedagogicalContext,
  formatPedagogicalContextForPrompt,
} from '../knowledgeBaseService';

import { generateSingleMultipleChoiceQuestion, generateStepContent } from '../../gemini';
import type { SkeletonStep } from '../../types/learning.types';

// ===== TEST CONFIGURATION =====

// Dynamic test topics - will be populated based on actual KB content
const DEFAULT_TEST_TOPICS = [
  // Generic topics that should match most math content
  { topic: 'מספרים', grade: 'א', description: 'Numbers for grade 1' },
  { topic: 'מספרים', grade: 'ב', description: 'Numbers for grade 2' },
  { topic: 'תרגילים', grade: 'א', description: 'Exercises for grade 1' },
  { topic: 'תרגילים', grade: 'ב', description: 'Exercises for grade 2' },
  { topic: 'חיבור וחיסור', grade: 'א', description: 'Addition and subtraction grade 1' },
  { topic: 'חיבור וחיסור', grade: 'ב', description: 'Addition and subtraction grade 2' },
];

// Expected patterns that should be extracted from textbooks
const EXPECTED_EXTRACTION_PATTERNS = {
  questionPhrasing: [
    /כמה/,
    /מה/,
    /חשב/,
    /פתור/,
    /השלם/,
    /מצא/,
  ],
  studentAddressing: [
    /נחשב/,
    /בוא/,
    /נמצא/,
    /שים לב/,
    /זכור/,
  ],
  explanationPatterns: [
    /כלומר/,
    /זאת אומרת/,
    /משמעות/,
  ]
};

// ===== HELPER FUNCTIONS =====

function createTestResult(
  id: string,
  name: string,
  nameHe: string,
  status: 'passed' | 'failed' | 'warning',
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
  message: string,
  messageHe: string,
  duration: number,
  details?: Record<string, unknown>
): TestResult {
  return {
    id,
    name,
    nameHe,
    category: 'knowledge-base',
    status,
    severity,
    message,
    messageHe,
    details,
    duration,
    timestamp: new Date()
  };
}

// ===== TEST 1: KB SEARCH CONNECTIVITY =====

async function testKBSearchConnectivity(topic: string, grade: string): Promise<{
  success: boolean;
  resultsCount: number;
  avgSimilarity: number;
  duration: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const results = await searchKnowledge(topic, { grade }, 5);
    const duration = Date.now() - startTime;

    const avgSimilarity = results.length > 0
      ? results.reduce((sum, r) => sum + r.similarity, 0) / results.length
      : 0;

    return {
      success: results.length > 0,
      resultsCount: results.length,
      avgSimilarity: Math.round(avgSimilarity * 100),
      duration
    };
  } catch (error: any) {
    return {
      success: false,
      resultsCount: 0,
      avgSimilarity: 0,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

// ===== TEST 2: PEDAGOGICAL CONTEXT EXTRACTION =====

interface ExtractionResult {
  success: boolean;
  extractedCounts: {
    exercises: number;
    commonMistakes: number;
    progressionLevels: number;
    mathLanguage: number;
    examples: number;
    questionPhrasing: number;
    studentAddressing: number;
    explanationPatterns: number;
  };
  hasRawContext: boolean;
  rawContextLength: number;
  duration: number;
  sampleExtractions: {
    exercises: string[];
    questionPhrasing: string[];
    studentAddressing: string[];
  };
  error?: string;
}

async function testPedagogicalContextExtraction(topic: string, grade: string): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    const context = await getMathPedagogicalContext(topic, grade);
    const duration = Date.now() - startTime;

    const extractedCounts = {
      exercises: context.exercises.length,
      commonMistakes: context.commonMistakes.length,
      progressionLevels: context.progressionLevels.length,
      mathLanguage: context.mathLanguage.length,
      examples: context.examples.length,
      questionPhrasing: context.questionPhrasing.length,
      studentAddressing: context.studentAddressing.length,
      explanationPatterns: context.explanationPatterns.length
    };

    const totalExtracted = Object.values(extractedCounts).reduce((a, b) => a + b, 0);

    return {
      success: totalExtracted > 0,
      extractedCounts,
      hasRawContext: context.rawContext.length > 0,
      rawContextLength: context.rawContext.length,
      duration,
      sampleExtractions: {
        exercises: context.exercises.slice(0, 2),
        questionPhrasing: context.questionPhrasing.slice(0, 2),
        studentAddressing: context.studentAddressing.slice(0, 2)
      }
    };
  } catch (error: any) {
    return {
      success: false,
      extractedCounts: {
        exercises: 0,
        commonMistakes: 0,
        progressionLevels: 0,
        mathLanguage: 0,
        examples: 0,
        questionPhrasing: 0,
        studentAddressing: 0,
        explanationPatterns: 0
      },
      hasRawContext: false,
      rawContextLength: 0,
      duration: Date.now() - startTime,
      sampleExtractions: { exercises: [], questionPhrasing: [], studentAddressing: [] },
      error: error.message
    };
  }
}

// ===== TEST 3: PROMPT FORMATTING =====

interface PromptFormattingResult {
  success: boolean;
  promptLength: number;
  hasSections: {
    studentAddressing: boolean;
    questionPhrasing: boolean;
    explanationPatterns: boolean;
    exercises: boolean;
    commonMistakes: boolean;
    criticalInstructions: boolean;
  };
  duration: number;
  formattedPromptPreview: string;
}

async function testPromptFormatting(topic: string, grade: string): Promise<PromptFormattingResult> {
  const startTime = Date.now();

  try {
    const context = await getMathPedagogicalContext(topic, grade);
    const formattedPrompt = formatPedagogicalContextForPrompt(context);
    const duration = Date.now() - startTime;

    const hasSections = {
      studentAddressing: formattedPrompt.includes('סגנון הפנייה לתלמיד'),
      questionPhrasing: formattedPrompt.includes('ניסוח שאלות'),
      explanationPatterns: formattedPrompt.includes('תבניות להסבר'),
      exercises: formattedPrompt.includes('דוגמאות לתרגילים'),
      commonMistakes: formattedPrompt.includes('טעויות נפוצות'),
      criticalInstructions: formattedPrompt.includes('הוראות קריטיות')
    };

    const sectionsPresent = Object.values(hasSections).filter(Boolean).length;

    return {
      success: formattedPrompt.length > 100 && sectionsPresent >= 3,
      promptLength: formattedPrompt.length,
      hasSections,
      duration,
      formattedPromptPreview: formattedPrompt.substring(0, 500) + '...'
    };
  } catch (error: any) {
    return {
      success: false,
      promptLength: 0,
      hasSections: {
        studentAddressing: false,
        questionPhrasing: false,
        explanationPatterns: false,
        exercises: false,
        commonMistakes: false,
        criticalInstructions: false
      },
      duration: Date.now() - startTime,
      formattedPromptPreview: ''
    };
  }
}

// ===== TEST 4: CONTENT GENERATION WITH KB CONTEXT =====

interface ContentGenerationWithKBResult {
  success: boolean;
  hasKBContext: boolean;
  generationDuration: number;
  generatedContent: any;
  languageAnalysis: {
    usesHebrewTextbookStyle: boolean;
    hasAppropriateAddressing: boolean;
    matchesGradeLevel: boolean;
    issues: string[];
  };
  error?: string;
}

async function testContentGenerationWithKB(
  topic: string,
  grade: string,
  timeout: number = 60000
): Promise<ContentGenerationWithKBResult> {
  const startTime = Date.now();

  try {
    // First get KB context
    const context = await getMathPedagogicalContext(topic, grade);
    const hasKBContext = context.rawContext.length > 0;

    // Generate content (the generateStepContent function should use KB internally)
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );

    const gradeLevel = `כיתה ${grade}`;
    const result = await Promise.race([
      generateSingleMultipleChoiceQuestion(topic, gradeLevel, null, undefined),
      timeoutPromise
    ]);

    const duration = Date.now() - startTime;

    // Analyze generated content for KB influence
    const generatedText = JSON.stringify(result || {});
    const languageAnalysis = analyzeGeneratedContentLanguage(generatedText, context, grade);

    return {
      success: result !== null && languageAnalysis.issues.length < 3,
      hasKBContext,
      generationDuration: duration,
      generatedContent: result,
      languageAnalysis
    };
  } catch (error: any) {
    return {
      success: false,
      hasKBContext: false,
      generationDuration: Date.now() - startTime,
      generatedContent: null,
      languageAnalysis: {
        usesHebrewTextbookStyle: false,
        hasAppropriateAddressing: false,
        matchesGradeLevel: false,
        issues: [error.message]
      },
      error: error.message
    };
  }
}

function analyzeGeneratedContentLanguage(
  generatedText: string,
  kbContext: Awaited<ReturnType<typeof getMathPedagogicalContext>>,
  grade: string
): {
  usesHebrewTextbookStyle: boolean;
  hasAppropriateAddressing: boolean;
  matchesGradeLevel: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check if content is in Hebrew
  const hasHebrew = /[\u0590-\u05FF]/.test(generatedText);
  if (!hasHebrew) {
    issues.push('Content not in Hebrew');
  }

  // Check for textbook-style addressing patterns
  const addressingPatterns = ['נחשב', 'בואו', 'נמצא', 'שים לב', 'זכור', 'נסתכל'];
  const hasAddressing = addressingPatterns.some(p => generatedText.includes(p));
  if (!hasAddressing && kbContext.studentAddressing.length > 0) {
    issues.push('Missing textbook-style student addressing');
  }

  // Check for appropriate grade level (simple heuristic)
  const complexTerms = ['אינטגרל', 'דיפרנציאל', 'לוגריתם', 'טריגונומטריה'];
  const hasComplexTerms = complexTerms.some(t => generatedText.includes(t));
  const isLowGrade = ['א', 'ב', 'ג'].includes(grade);

  if (isLowGrade && hasComplexTerms) {
    issues.push('Content too complex for grade level');
  }

  // Check if using KB patterns
  const usesKBPatterns = kbContext.questionPhrasing.some(p =>
    generatedText.toLowerCase().includes(p.toLowerCase().substring(0, 10))
  );

  return {
    usesHebrewTextbookStyle: hasHebrew,
    hasAppropriateAddressing: hasAddressing,
    matchesGradeLevel: !(isLowGrade && hasComplexTerms),
    issues
  };
}

// ===== TEST 5: ACTUAL OUTPUT QUALITY CHECK =====

interface OutputQualityResult {
  success: boolean;
  generatedContent: any;
  qualityChecks: {
    hasTextbookStyleAddressing: boolean;
    hasContextualQuestion: boolean;
    hasHebrewContent: boolean;
    hasAppropriateComplexity: boolean;
    usesKBPatterns: boolean;
  };
  matchedPatterns: string[];
  issues: string[];
  duration: number;
  error?: string;
}

/**
 * Test actual activity output quality
 * This tests the REAL output that students will see
 */
async function testActualOutputQuality(
  topic: string,
  grade: string,
  timeout: number = 90000
): Promise<OutputQualityResult> {
  const startTime = Date.now();
  const issues: string[] = [];
  const matchedPatterns: string[] = [];

  try {
    // 1. Get KB context first for comparison
    const kbContext = await getMathPedagogicalContext(topic, grade);

    // 2. Create a step to generate
    const testStep: SkeletonStep = {
      step_number: 1,
      title: topic,
      bloom_level: 'Understand',
      suggested_interaction_type: 'Multiple Choice',
      narrative_focus: topic,
      forbidden_topics: [],
      key_learning_points: [topic]
    };

    // 3. Generate actual step content
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );

    const gradeLevel = `כיתה ${grade}`;
    const result = await Promise.race([
      generateStepContent(topic, testStep, gradeLevel, undefined, undefined, 'learning', 'math'),
      timeoutPromise
    ]);

    const duration = Date.now() - startTime;

    if (!result) {
      return {
        success: false,
        generatedContent: null,
        qualityChecks: {
          hasTextbookStyleAddressing: false,
          hasContextualQuestion: false,
          hasHebrewContent: false,
          hasAppropriateComplexity: false,
          usesKBPatterns: false
        },
        matchedPatterns: [],
        issues: ['Generation returned null'],
        duration,
        error: 'Generation failed'
      };
    }

    // 4. Analyze output quality
    const contentText = JSON.stringify(result);
    const teachContent = result.teach_content || '';
    const questionData = result.data || {};
    const questionText = questionData.question || '';

    // Check 1: Textbook-style addressing ("נחשב", "בואו נראה", etc.)
    const textbookPatterns = [
      'נחשב', 'נחשוב', 'בואו נ', 'נמצא', 'נסתכל',
      'שים לב', 'זכור', 'האם זכור', 'כמו שלמדנו'
    ];
    const hasTextbookStyleAddressing = textbookPatterns.some(p =>
      contentText.includes(p)
    );

    if (hasTextbookStyleAddressing) {
      const found = textbookPatterns.filter(p => contentText.includes(p));
      matchedPatterns.push(...found.map(p => `פנייה: "${p}"`));
    } else {
      issues.push('חסר סגנון פנייה לספר לימוד (נחשב, בואו נראה, וכו\')');
    }

    // Check 2: Contextual question (story-based, not just "compute X+Y")
    const contextualIndicators = [
      /\bל?\w+\s+(קנה|אסף|יש|קיבל|נתן|הלך|בא|שם|לקח)/,
      /כמה\s+\w+\s+(יש|נשאר|קיבל|יהיו)/,
      /סיפור|דוגמה|בעיה/
    ];
    const hasContextualQuestion = contextualIndicators.some(p =>
      p.test(questionText) || p.test(teachContent)
    );

    if (hasContextualQuestion) {
      matchedPatterns.push('שאלה הקשרית עם סיפור');
    } else {
      // Check if it's just a bare computation
      const bareComputation = /^[חשב|מצא|פתור]\s*:?\s*\d+\s*[+\-×÷]\s*\d+/;
      if (bareComputation.test(questionText)) {
        issues.push('שאלה גנרית ללא הקשר יומיומי');
      }
    }

    // Check 3: Hebrew content
    const hebrewCount = (contentText.match(/[\u0590-\u05FF]/g) || []).length;
    const hasHebrewContent = hebrewCount > 50;

    if (!hasHebrewContent) {
      issues.push('תוכן לא בעברית או מעט מאוד עברית');
    }

    // Check 4: Appropriate complexity for grade
    const complexTerms = ['אינטגרל', 'נגזרת', 'לוגריתם', 'חזקה', 'שורש', 'משוואה'];
    const simpleGrades = ['א', 'ב'];
    const hasComplexTerms = complexTerms.some(t => contentText.includes(t));
    const hasAppropriateComplexity = !(simpleGrades.includes(grade) && hasComplexTerms);

    if (!hasAppropriateComplexity) {
      issues.push('רמת קושי לא מתאימה לכיתה');
    }

    // Check 5: Uses KB patterns from actual textbook
    let usesKBPatterns = false;
    if (kbContext.studentAddressing.length > 0 || kbContext.questionPhrasing.length > 0) {
      // Check if output uses similar patterns to KB
      const allKBPatterns = [
        ...kbContext.studentAddressing,
        ...kbContext.questionPhrasing.slice(0, 3)
      ];

      for (const kbPattern of allKBPatterns) {
        // Extract key words from pattern (first 2-3 words)
        const keyWords = kbPattern.split(/\s+/).slice(0, 3).join(' ');
        if (keyWords.length > 5 && contentText.includes(keyWords.substring(0, 10))) {
          usesKBPatterns = true;
          matchedPatterns.push(`דפוס KB: "${keyWords.substring(0, 20)}..."`);
          break;
        }
      }
    }

    if (!usesKBPatterns && kbContext.studentAddressing.length > 0) {
      issues.push('לא משתמש בדפוסים מספר הלימוד');
    }

    const qualityChecks = {
      hasTextbookStyleAddressing,
      hasContextualQuestion,
      hasHebrewContent,
      hasAppropriateComplexity,
      usesKBPatterns
    };

    const passedChecks = Object.values(qualityChecks).filter(Boolean).length;
    const success = passedChecks >= 4 && issues.length <= 1;

    return {
      success,
      generatedContent: {
        teach_content_preview: teachContent.substring(0, 200),
        question_preview: questionText.substring(0, 200),
        interaction_type: result.selected_interaction
      },
      qualityChecks,
      matchedPatterns,
      issues,
      duration
    };

  } catch (error: any) {
    return {
      success: false,
      generatedContent: null,
      qualityChecks: {
        hasTextbookStyleAddressing: false,
        hasContextualQuestion: false,
        hasHebrewContent: false,
        hasAppropriateComplexity: false,
        usesKBPatterns: false
      },
      matchedPatterns: [],
      issues: [error.message],
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

// ===== TEST 6: KB COVERAGE CHECK =====

interface KBCoverageResult {
  totalBooks: number;
  booksWithContent: string[];
  gradesWithContent: string[];
  coveragePercentage: number;
  missingGrades: string[];
  sampleContent: { grade: string; chapter: string; contentPreview: string }[];
}

async function testKBCoverage(): Promise<KBCoverageResult> {
  const allGrades = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
  const gradesWithContent: string[] = [];
  const booksWithContent: string[] = [];
  const sampleContent: { grade: string; chapter: string; contentPreview: string }[] = [];

  // Use very broad search terms to find any content
  const broadSearchTerms = ['מספרים', 'תרגיל', 'חשבון', 'פרק'];

  for (const grade of allGrades) {
    // Try multiple search terms to find content
    for (const searchTerm of broadSearchTerms) {
      try {
        const results = await searchKnowledge(searchTerm, { grade }, 3);
        if (results.length > 0) {
          if (!gradesWithContent.includes(grade)) {
            gradesWithContent.push(grade);
          }

          for (const result of results) {
            const bookId = `${grade}-${result.chunk.volume}-${result.chunk.volumeType}`;
            if (!booksWithContent.includes(bookId)) {
              booksWithContent.push(bookId);

              // Collect sample content for diagnostics
              sampleContent.push({
                grade,
                chapter: result.chunk.chapter || 'לא ידוע',
                contentPreview: result.chunk.content.substring(0, 150) + '...'
              });
            }
          }

          break; // Found content for this grade, move to next
        }
      } catch {
        // Search failed, continue with next term
      }
    }
  }

  const missingGrades = allGrades.filter(g => !gradesWithContent.includes(g));

  return {
    totalBooks: booksWithContent.length,
    booksWithContent,
    gradesWithContent,
    coveragePercentage: Math.round((gradesWithContent.length / allGrades.length) * 100),
    missingGrades,
    sampleContent: sampleContent.slice(0, 5) // Limit to 5 samples
  };
}

// ===== MAIN AGENT RUNNER =====

export async function runKnowledgeBaseQAAgent(
  maxTopics: number = 3
): Promise<QAAgentResult> {
  console.log('🔍 Starting Knowledge Base QA Agent...');

  const startTime = Date.now();
  const allResults: TestResult[] = [];
  let testsPassed = 0;
  let testsFailed = 0;
  const criticalIssues: TestResult[] = [];

  // First, get KB coverage to determine which grades have content
  console.log('📊 Testing KB coverage...');
  const coverageResult = await testKBCoverage();

  // Build dynamic test topics based on actual KB content
  const topicsToTest: { topic: string; grade: string; description: string }[] = [];

  if (coverageResult.gradesWithContent.length > 0) {
    // Create test topics only for grades that have content
    for (const grade of coverageResult.gradesWithContent) {
      topicsToTest.push({ topic: 'מספרים', grade, description: `Numbers for grade ${grade}` });
      topicsToTest.push({ topic: 'תרגילים', grade, description: `Exercises for grade ${grade}` });
    }
  } else {
    // Fallback to default topics if no content detected
    topicsToTest.push(...DEFAULT_TEST_TOPICS);
  }

  // Limit to maxTopics
  const limitedTopicsToTest = topicsToTest.slice(0, maxTopics);

  // Test 1: KB Coverage Check (already done above)

  const coverageTest = createTestResult(
    'kb_coverage',
    'Knowledge Base Coverage',
    'כיסוי בסיס הידע',
    coverageResult.coveragePercentage >= 50 ? 'passed' :
      coverageResult.coveragePercentage > 0 ? 'warning' : 'failed',
    coverageResult.coveragePercentage === 0 ? 'critical' : 'medium',
    `Coverage: ${coverageResult.coveragePercentage}% | Books: ${coverageResult.totalBooks} | Grades: ${coverageResult.gradesWithContent.join(', ') || 'None'}`,
    `כיסוי: ${coverageResult.coveragePercentage}% | ספרים: ${coverageResult.totalBooks} | כיתות: ${coverageResult.gradesWithContent.join(', ') || 'אין'}`,
    Date.now() - startTime,
    {
      coverage: coverageResult,
      missingGrades: coverageResult.missingGrades,
      sampleContent: coverageResult.sampleContent,
      topicsToTest: limitedTopicsToTest.map(t => `${t.topic} (כיתה ${t.grade})`)
    }
  );

  allResults.push(coverageTest);
  if (coverageTest.status === 'passed') testsPassed++;
  else {
    testsFailed++;
    if (coverageResult.coveragePercentage === 0) criticalIssues.push(coverageTest);
  }

  // If no content in KB, skip detailed tests
  if (coverageResult.coveragePercentage === 0) {
    console.log('⚠️ KB is empty, skipping detailed tests');

    allResults.push(createTestResult(
      'kb_empty_warning',
      'KB Empty - Tests Skipped',
      'בסיס ידע ריק - בדיקות דולגו',
      'warning',
      'high',
      'Knowledge base has no content. Upload textbooks to enable testing.',
      'בסיס הידע ריק. העלה ספרי לימוד כדי לאפשר בדיקות.',
      0,
      {}
    ));

    return {
      agentType: 'knowledge-base',
      success: false,
      duration: Date.now() - startTime,
      testsRun: allResults.length,
      testsPassed,
      testsFailed,
      criticalIssues,
      allResults
    };
  }

  // Test topics that have content
  for (const { topic, grade, description } of limitedTopicsToTest) {
    console.log(`\n📚 Testing topic: ${topic} (${grade})`);

    // Test 2: Search Connectivity
    const searchResult = await testKBSearchConnectivity(topic, grade);
    const searchTest = createTestResult(
      `kb_search_${topic}_${grade}`,
      `KB Search: ${topic}`,
      `חיפוש KB: ${topic}`,
      searchResult.success ? 'passed' : 'failed',
      searchResult.success ? 'low' : 'high',
      `Results: ${searchResult.resultsCount} | Similarity: ${searchResult.avgSimilarity}% | Duration: ${searchResult.duration}ms`,
      `תוצאות: ${searchResult.resultsCount} | דמיון: ${searchResult.avgSimilarity}% | משך: ${searchResult.duration}ms`,
      searchResult.duration,
      { searchResult }
    );

    allResults.push(searchTest);
    if (searchTest.status === 'passed') testsPassed++;
    else testsFailed++;

    // Test 3: Pedagogical Context Extraction
    const extractionResult = await testPedagogicalContextExtraction(topic, grade);

    const totalExtracted = Object.values(extractionResult.extractedCounts).reduce((a, b) => a + b, 0);
    const extractionTest = createTestResult(
      `kb_extraction_${topic}_${grade}`,
      `Pedagogical Extraction: ${topic}`,
      `חילוץ פדגוגי: ${topic}`,
      extractionResult.success ? 'passed' : totalExtracted > 0 ? 'warning' : 'failed',
      extractionResult.success ? 'low' : 'medium',
      `Extracted: ${totalExtracted} elements | Exercises: ${extractionResult.extractedCounts.exercises} | Questions: ${extractionResult.extractedCounts.questionPhrasing} | Addressing: ${extractionResult.extractedCounts.studentAddressing}`,
      `חולצו: ${totalExtracted} אלמנטים | תרגילים: ${extractionResult.extractedCounts.exercises} | שאלות: ${extractionResult.extractedCounts.questionPhrasing} | פנייה: ${extractionResult.extractedCounts.studentAddressing}`,
      extractionResult.duration,
      {
        extractedCounts: extractionResult.extractedCounts,
        samples: extractionResult.sampleExtractions,
        rawContextLength: extractionResult.rawContextLength
      }
    );

    allResults.push(extractionTest);
    if (extractionTest.status === 'passed') testsPassed++;
    else testsFailed++;

    // Test 4: Prompt Formatting
    const formattingResult = await testPromptFormatting(topic, grade);

    const sectionsCount = Object.values(formattingResult.hasSections).filter(Boolean).length;
    const formattingTest = createTestResult(
      `kb_formatting_${topic}_${grade}`,
      `Prompt Formatting: ${topic}`,
      `עיצוב פרומפט: ${topic}`,
      formattingResult.success ? 'passed' : sectionsCount >= 2 ? 'warning' : 'failed',
      formattingResult.success ? 'low' : 'medium',
      `Sections: ${sectionsCount}/6 | Length: ${formattingResult.promptLength} chars`,
      `סעיפים: ${sectionsCount}/6 | אורך: ${formattingResult.promptLength} תווים`,
      formattingResult.duration,
      {
        hasSections: formattingResult.hasSections,
        promptPreview: formattingResult.formattedPromptPreview.substring(0, 200)
      }
    );

    allResults.push(formattingTest);
    if (formattingTest.status === 'passed') testsPassed++;
    else testsFailed++;

    // Test 5: Content Generation with KB (only for first topic to save time)
    const isFirstTopic = limitedTopicsToTest.findIndex(t => t.topic === topic && t.grade === grade) === 0;
    if (isFirstTopic) {
      console.log('🤖 Testing content generation with KB context...');

      const generationResult = await testContentGenerationWithKB(topic, grade);

      const generationTest = createTestResult(
        `kb_generation_${topic}_${grade}`,
        `AI Generation with KB: ${topic}`,
        `יצירת AI עם KB: ${topic}`,
        generationResult.success ? 'passed' :
          generationResult.languageAnalysis.issues.length < 2 ? 'warning' : 'failed',
        generationResult.success ? 'low' : 'high',
        `KB Context: ${generationResult.hasKBContext ? 'Yes' : 'No'} | Hebrew Style: ${generationResult.languageAnalysis.usesHebrewTextbookStyle ? 'Yes' : 'No'} | Issues: ${generationResult.languageAnalysis.issues.length}`,
        `הקשר KB: ${generationResult.hasKBContext ? 'כן' : 'לא'} | סגנון עברי: ${generationResult.languageAnalysis.usesHebrewTextbookStyle ? 'כן' : 'לא'} | בעיות: ${generationResult.languageAnalysis.issues.length}`,
        generationResult.generationDuration,
        {
          hasKBContext: generationResult.hasKBContext,
          languageAnalysis: generationResult.languageAnalysis,
          generatedContentPreview: JSON.stringify(generationResult.generatedContent).substring(0, 300)
        }
      );

      allResults.push(generationTest);
      if (generationTest.status === 'passed') testsPassed++;
      else {
        testsFailed++;
        if (!generationResult.success) criticalIssues.push(generationTest);
      }

      // Test 6: ACTUAL OUTPUT QUALITY - Tests the real student-facing content
      console.log('📝 Testing ACTUAL output quality (student-facing content)...');

      const outputQualityResult = await testActualOutputQuality(topic, grade);

      const passedQualityChecks = Object.values(outputQualityResult.qualityChecks).filter(Boolean).length;
      const qualityTest = createTestResult(
        `kb_output_quality_${topic}_${grade}`,
        `Output Quality Check: ${topic}`,
        `בדיקת איכות פלט: ${topic}`,
        outputQualityResult.success ? 'passed' :
          passedQualityChecks >= 3 ? 'warning' : 'failed',
        outputQualityResult.success ? 'low' : 'critical',
        `Quality: ${passedQualityChecks}/5 checks | Textbook Style: ${outputQualityResult.qualityChecks.hasTextbookStyleAddressing ? 'Yes' : 'No'} | Issues: ${outputQualityResult.issues.length}`,
        `איכות: ${passedQualityChecks}/5 בדיקות | סגנון ספר: ${outputQualityResult.qualityChecks.hasTextbookStyleAddressing ? 'כן' : 'לא'} | בעיות: ${outputQualityResult.issues.length}`,
        outputQualityResult.duration,
        {
          qualityChecks: outputQualityResult.qualityChecks,
          matchedPatterns: outputQualityResult.matchedPatterns,
          issues: outputQualityResult.issues,
          generatedContent: outputQualityResult.generatedContent
        }
      );

      allResults.push(qualityTest);
      if (qualityTest.status === 'passed') testsPassed++;
      else {
        testsFailed++;
        if (!outputQualityResult.success) criticalIssues.push(qualityTest);
      }
    }

    // Small delay between topics
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Summary
  const totalDuration = Date.now() - startTime;
  const passRate = Math.round((testsPassed / allResults.length) * 100);

  console.log(`\n✅ Knowledge Base QA completed:`);
  console.log(`   Passed: ${testsPassed}/${allResults.length} (${passRate}%)`);
  console.log(`   Duration: ${totalDuration}ms`);

  allResults.push(createTestResult(
    'kb_summary',
    'Knowledge Base Integration Summary',
    'סיכום אינטגרציית בסיס הידע',
    passRate >= 80 ? 'passed' : passRate >= 50 ? 'warning' : 'failed',
    'info',
    `Pass Rate: ${passRate}% | Tests: ${allResults.length} | Coverage: ${coverageResult.coveragePercentage}%`,
    `אחוז הצלחה: ${passRate}% | בדיקות: ${allResults.length} | כיסוי: ${coverageResult.coveragePercentage}%`,
    totalDuration,
    {
      passRate,
      coverage: coverageResult.coveragePercentage,
      testedTopics: limitedTopicsToTest.map(t => `${t.topic} (כיתה ${t.grade})`)
    }
  ));

  return {
    agentType: 'knowledge-base',
    success: testsFailed === 0,
    duration: totalDuration,
    testsRun: allResults.length,
    testsPassed,
    testsFailed,
    criticalIssues,
    allResults
  };
}

export {
  testKBSearchConnectivity,
  testPedagogicalContextExtraction,
  testPromptFormatting,
  testContentGenerationWithKB,
  testKBCoverage,
  testActualOutputQuality
};
