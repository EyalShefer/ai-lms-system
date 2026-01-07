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
  QATestConfig
} from '../../types/qa.types';

export { DEFAULT_QA_CONFIG, DEFAULT_STUDENT_PROFILES } from '../../types/qa.types';

// ===== COMBINED RUNNER =====

import { runFullQAReport, saveQAReport } from './qaTestingService';
import { runContentQualityAgent } from './contentQualityAgent';
import { runStudentSimulationAgent } from './studentSimulationAgent';
import { runAIGenerationAgent } from './aiGenerationAgent';
import type { QAReport, QAAgentResult, TestSuite, TestResult } from '../../types/qa.types';

export interface FullQARunOptions {
  includeContentQuality?: boolean;
  includeStudentSimulation?: boolean;
  includeAIGeneration?: boolean;
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
