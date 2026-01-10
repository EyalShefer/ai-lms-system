/**
 * QA Testing System - Main Exports
 * מערכת בדיקות איכות - ייצוא ראשי
 */

// Main service
export { runFullQAReport, saveQAReport, getRecentQAReports } from './qaTestingService';

// Agents
export { runContentQualityAgent, validateCourse, validateUnit, validateBlock, validateLessonPlan } from './contentQualityAgent';
export { runStudentSimulationAgent, simulateCourse, simulateUnit } from './studentSimulationAgent';
export { runAIGenerationAgent, testMultipleChoiceGeneration, testOpenQuestionGeneration } from './aiGenerationAgent';
export { runE2EGenerationAgent } from './e2eGenerationAgent';

// New Assessment Agents
export { runStudentActivityAgent, runActivitySession, validateScoringPolicy } from './studentActivityAgent';
export { runAssessmentIntegrityAgent, validateCourseAssessment, validateScoringRules, ASSESSMENT_POLICY } from './assessmentIntegrityAgent';

// Knowledge Base Integration Agent
export {
  runKnowledgeBaseQAAgent,
  testKBSearchConnectivity,
  testPedagogicalContextExtraction,
  testPromptFormatting,
  testContentGenerationWithKB,
  testKBCoverage
} from './knowledgeBaseQAAgent';

// Auto-Fix Agent
export {
  generateFixSuggestions,
  executeFix,
  executeFixBatch,
  enhanceTestResultsWithFixes,
  revalidateAfterFix
} from './autoFixAgent';

// Types re-export
export type {
  TestResult,
  TestSuite,
  QAReport,
  QAReportSummary,
  QAAgentResult,
  TestStatus,
  TestCategory,
  TestSeverity,
  ContentQualityCheck,
  StudentSimulationRun,
  AIGenerationTest,
  QATestConfig,
  FixSuggestion,
  FixResult,
  FixBatch,
  FixType,
  TestResultWithFix
} from '../../types/qa.types';

export { DEFAULT_QA_CONFIG, DEFAULT_STUDENT_PROFILES } from '../../types/qa.types';

// ===== COMBINED RUNNER =====

import { runFullQAReport, saveQAReport } from './qaTestingService';
import { runContentQualityAgent } from './contentQualityAgent';
import { runStudentSimulationAgent } from './studentSimulationAgent';
import { runAIGenerationAgent } from './aiGenerationAgent';
import { runE2EGenerationAgent } from './e2eGenerationAgent';
import { runStudentActivityAgent } from './studentActivityAgent';
import { runAssessmentIntegrityAgent } from './assessmentIntegrityAgent';
import { runKnowledgeBaseQAAgent } from './knowledgeBaseQAAgent';
import type { QAReport, QAAgentResult, TestSuite, TestResult } from '../../types/qa.types';

export interface FullQARunOptions {
  includeContentQuality?: boolean;
  includeStudentSimulation?: boolean;
  includeAIGeneration?: boolean;
  includeE2EGeneration?: boolean;  // E2E content generation testing
  includeStudentActivity?: boolean;  // Student activity/exam testing with scoring
  includeAssessmentIntegrity?: boolean;  // Assessment policy validation
  includeKnowledgeBase?: boolean;  // Knowledge Base integration testing
  maxCourses?: number;
  saveReport?: boolean;
  userId?: string;
}

/**
 * Run comprehensive QA testing including all agents
 * הרצת בדיקות QA מקיפות כולל כל הסוכנים
 */
export async function runComprehensiveQA(options: FullQARunOptions = {}): Promise<{
  report: QAReport;
  agentResults: QAAgentResult[];
  reportId?: string;
}> {
  const {
    includeContentQuality = true,
    includeStudentSimulation = true,
    includeAIGeneration = false, // Disabled by default (API costs)
    includeE2EGeneration = false, // Disabled by default (API costs)
    includeStudentActivity = false, // Disabled by default
    includeAssessmentIntegrity = false, // Disabled by default
    includeKnowledgeBase = false, // Disabled by default
    maxCourses = 10,
    saveReport = true,
    userId
  } = options;

  console.log('🚀 Starting Comprehensive QA Run...');
  const startTime = Date.now();

  // Run base QA tests first
  const report = await runFullQAReport(undefined, 'manual', userId);
  const agentResults: QAAgentResult[] = [];

  // Run Content Quality Agent
  if (includeContentQuality) {
    console.log('\n📝 Running Content Quality Agent...');
    const contentResult = await runContentQualityAgent(maxCourses);
    agentResults.push(contentResult);

    // Add to report
    const contentSuite: TestSuite = {
      id: 'suite_content_quality',
      name: 'Content Quality Tests',
      nameHe: 'בדיקות איכות תוכן',
      category: 'content-quality',
      tests: contentResult.allResults,
      passedCount: contentResult.testsPassed,
      failedCount: contentResult.testsFailed,
      warningCount: contentResult.allResults.filter(t => t.status === 'warning').length,
      skippedCount: 0,
      duration: contentResult.duration,
      status: contentResult.success ? 'passed' : 'failed'
    };
    report.suites.push(contentSuite);
  }

  // Run Student Simulation Agent
  if (includeStudentSimulation) {
    console.log('\n🎓 Running Student Simulation Agent...');
    const simResult = await runStudentSimulationAgent(Math.min(maxCourses, 5));
    agentResults.push(simResult);

    const simSuite: TestSuite = {
      id: 'suite_student_simulation',
      name: 'Student Simulation Tests',
      nameHe: 'בדיקות סימולציית תלמיד',
      category: 'student-simulation',
      tests: simResult.allResults,
      passedCount: simResult.testsPassed,
      failedCount: simResult.testsFailed,
      warningCount: simResult.allResults.filter(t => t.status === 'warning').length,
      skippedCount: 0,
      duration: simResult.duration,
      status: simResult.success ? 'passed' : 'failed'
    };
    report.suites.push(simSuite);
  }

  // Run AI Generation Agent (optional, costs money)
  if (includeAIGeneration) {
    console.log('\n🤖 Running AI Generation Agent...');
    const aiResult = await runAIGenerationAgent(['multiple-choice', 'open-question']);
    agentResults.push(aiResult);

    const aiSuite: TestSuite = {
      id: 'suite_ai_generation',
      name: 'AI Generation Tests',
      nameHe: 'בדיקות יצירת AI',
      category: 'ai-generation',
      tests: aiResult.allResults,
      passedCount: aiResult.testsPassed,
      failedCount: aiResult.testsFailed,
      warningCount: aiResult.allResults.filter(t => t.status === 'warning').length,
      skippedCount: 0,
      duration: aiResult.duration,
      status: aiResult.success ? 'passed' : 'failed'
    };
    report.suites.push(aiSuite);
  }

  // Run E2E Generation Agent (optional, costs money - full content generation flows)
  if (includeE2EGeneration) {
    console.log('\n🏭 Running E2E Generation Agent...');
    const e2eResult = await runE2EGenerationAgent();
    agentResults.push(e2eResult);

    const e2eSuite: TestSuite = {
      id: 'suite_e2e_generation',
      name: 'E2E Content Generation Tests',
      nameHe: 'בדיקות יצירת תוכן מקצה לקצה',
      category: 'e2e-generation',
      tests: e2eResult.tests,
      passedCount: e2eResult.summary.passed,
      failedCount: e2eResult.summary.failed,
      warningCount: e2eResult.summary.warnings,
      skippedCount: 0,
      duration: e2eResult.summary.duration,
      status: e2eResult.status
    };
    report.suites.push(e2eSuite);
  }

  // Run Student Activity Agent (tests scoring with actual activity simulation)
  if (includeStudentActivity) {
    console.log('\n📝 Running Student Activity Agent...');
    const activityResult = await runStudentActivityAgent(Math.min(maxCourses, 5), true);
    agentResults.push(activityResult);

    const activitySuite: TestSuite = {
      id: 'suite_student_activity',
      name: 'Student Activity Tests',
      nameHe: 'בדיקות פעילות תלמיד',
      category: 'student-activity',
      tests: activityResult.allResults,
      passedCount: activityResult.testsPassed,
      failedCount: activityResult.testsFailed,
      warningCount: activityResult.allResults.filter(t => t.status === 'warning').length,
      skippedCount: 0,
      duration: activityResult.duration,
      status: activityResult.success ? 'passed' : 'failed'
    };
    report.suites.push(activitySuite);
  }

  // Run Assessment Integrity Agent (validates scoring policy compliance)
  if (includeAssessmentIntegrity) {
    console.log('\n⚖️ Running Assessment Integrity Agent...');
    const integrityResult = await runAssessmentIntegrityAgent(maxCourses);
    agentResults.push(integrityResult);

    const integritySuite: TestSuite = {
      id: 'suite_assessment_integrity',
      name: 'Assessment Integrity Tests',
      nameHe: 'בדיקות אינטגריטי הערכה',
      category: 'assessment-integrity',
      tests: integrityResult.allResults,
      passedCount: integrityResult.testsPassed,
      failedCount: integrityResult.testsFailed,
      warningCount: integrityResult.allResults.filter(t => t.status === 'warning').length,
      skippedCount: 0,
      duration: integrityResult.duration,
      status: integrityResult.success ? 'passed' : 'failed'
    };
    report.suites.push(integritySuite);
  }

  // Run Knowledge Base Integration Agent (tests KB extraction and usage)
  if (includeKnowledgeBase) {
    console.log('\n📚 Running Knowledge Base QA Agent...');
    const kbResult = await runKnowledgeBaseQAAgent(3); // Test 3 topics
    agentResults.push(kbResult);

    const kbSuite: TestSuite = {
      id: 'suite_knowledge_base',
      name: 'Knowledge Base Integration Tests',
      nameHe: 'בדיקות אינטגרציית בסיס ידע',
      category: 'knowledge-base',
      tests: kbResult.allResults,
      passedCount: kbResult.testsPassed,
      failedCount: kbResult.testsFailed,
      warningCount: kbResult.allResults.filter(t => t.status === 'warning').length,
      skippedCount: 0,
      duration: kbResult.duration,
      status: kbResult.success ? 'passed' : 'failed'
    };
    report.suites.push(kbSuite);
  }

  // Recalculate summary
  const allTests = report.suites.flatMap(s => s.tests);
  report.summary = {
    totalTests: allTests.length,
    passed: allTests.filter(t => t.status === 'passed').length,
    failed: allTests.filter(t => t.status === 'failed').length,
    warnings: allTests.filter(t => t.status === 'warning').length,
    skipped: allTests.filter(t => t.status === 'skipped').length,
    passRate: Math.round((allTests.filter(t => t.status === 'passed').length / allTests.length) * 100),
    overallStatus: allTests.some(t => t.status === 'failed' && t.severity === 'critical') ? 'failed' :
                   allTests.some(t => t.status === 'failed') ? 'warning' : 'passed',
    criticalIssues: allTests.filter(t => t.status === 'failed' && t.severity === 'critical'),
    duration: Date.now() - startTime
  };

  report.completedAt = new Date();

  // Save to Firestore
  let reportId: string | undefined;
  if (saveReport) {
    try {
      reportId = await saveQAReport(report);
      console.log(`\n💾 Report saved with ID: ${reportId}`);
    } catch (error) {
      console.error('Failed to save report:', error);
    }
  }

  console.log(`\n✅ Comprehensive QA Complete!`);
  console.log(`   Total Tests: ${report.summary.totalTests}`);
  console.log(`   Passed: ${report.summary.passed} (${report.summary.passRate}%)`);
  console.log(`   Failed: ${report.summary.failed}`);
  console.log(`   Warnings: ${report.summary.warnings}`);
  console.log(`   Duration: ${Math.round(report.summary.duration / 1000)}s`);

  return { report, agentResults, reportId };
}
