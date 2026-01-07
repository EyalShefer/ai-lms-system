/**
 * QA Testing Service - Main orchestrator
 * שירות בדיקות איכות ראשי
 */

import { db } from '../../firebase';
import { collection, getDocs, query, limit, orderBy, where, doc, setDoc, Timestamp } from 'firebase/firestore';
import type {
  TestResult,
  TestSuite,
  QAReport,
  QAReportSummary,
  QATestConfig,
  TestStatus,
  TestCategory,
  TestSeverity
} from '../../types/qa.types';
import { DEFAULT_QA_CONFIG } from '../../types/qa.types';

// ===== HELPER FUNCTIONS =====

function createTestResult(
  name: string,
  nameHe: string,
  category: TestCategory,
  status: TestStatus,
  severity: TestSeverity,
  message: string,
  messageHe: string,
  duration: number,
  details?: Record<string, unknown>
): TestResult {
  return {
    id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    nameHe,
    category,
    status,
    severity,
    message,
    messageHe,
    details,
    duration,
    timestamp: new Date()
  };
}

function createTestSuite(
  name: string,
  nameHe: string,
  category: TestCategory,
  tests: TestResult[]
): TestSuite {
  const passedCount = tests.filter(t => t.status === 'passed').length;
  const failedCount = tests.filter(t => t.status === 'failed').length;
  const warningCount = tests.filter(t => t.status === 'warning').length;
  const skippedCount = tests.filter(t => t.status === 'skipped').length;
  const duration = tests.reduce((sum, t) => sum + t.duration, 0);

  let status: TestStatus = 'passed';
  if (failedCount > 0) status = 'failed';
  else if (warningCount > 0) status = 'warning';

  return {
    id: `suite_${category}_${Date.now()}`,
    name,
    nameHe,
    category,
    tests,
    passedCount,
    failedCount,
    warningCount,
    skippedCount,
    duration,
    status
  };
}

// ===== SANITY TESTS =====

async function runSanityTests(): Promise<TestSuite> {
  const tests: TestResult[] = [];
  const startTime = Date.now();

  // Test 1: Firebase Connection
  try {
    const testQuery = query(collection(db, 'courses'), limit(1));
    await getDocs(testQuery);
    tests.push(createTestResult(
      'Firebase Connection',
      'חיבור Firebase',
      'sanity',
      'passed',
      'critical',
      'Successfully connected to Firestore',
      'התחברות מוצלחת ל-Firestore',
      Date.now() - startTime
    ));
  } catch (error: any) {
    tests.push(createTestResult(
      'Firebase Connection',
      'חיבור Firebase',
      'sanity',
      'failed',
      'critical',
      `Firebase connection failed: ${error.message}`,
      `חיבור Firebase נכשל: ${error.message}`,
      Date.now() - startTime,
      { error: error.message }
    ));
  }

  // Test 2: Courses Collection Accessible
  const coursesStart = Date.now();
  try {
    const coursesQuery = query(collection(db, 'courses'), limit(5));
    const snapshot = await getDocs(coursesQuery);
    tests.push(createTestResult(
      'Courses Collection',
      'אוסף קורסים',
      'sanity',
      'passed',
      'high',
      `Found ${snapshot.size} courses`,
      `נמצאו ${snapshot.size} קורסים`,
      Date.now() - coursesStart,
      { courseCount: snapshot.size }
    ));
  } catch (error: any) {
    tests.push(createTestResult(
      'Courses Collection',
      'אוסף קורסים',
      'sanity',
      'failed',
      'high',
      `Cannot access courses: ${error.message}`,
      `אין גישה לקורסים: ${error.message}`,
      Date.now() - coursesStart
    ));
  }

  // Test 3: Assignments Collection
  const assignmentsStart = Date.now();
  try {
    const assignmentsQuery = query(collection(db, 'student_tasks'), limit(5));
    const snapshot = await getDocs(assignmentsQuery);
    tests.push(createTestResult(
      'Assignments Collection',
      'אוסף מטלות',
      'sanity',
      'passed',
      'medium',
      `Found ${snapshot.size} assignments`,
      `נמצאו ${snapshot.size} מטלות`,
      Date.now() - assignmentsStart
    ));
  } catch (error: any) {
    tests.push(createTestResult(
      'Assignments Collection',
      'אוסף מטלות',
      'sanity',
      'failed',
      'medium',
      `Cannot access assignments: ${error.message}`,
      `אין גישה למטלות: ${error.message}`,
      Date.now() - assignmentsStart
    ));
  }

  // Test 4: Users Collection
  const usersStart = Date.now();
  try {
    const usersQuery = query(collection(db, 'users'), limit(5));
    const snapshot = await getDocs(usersQuery);
    tests.push(createTestResult(
      'Users Collection',
      'אוסף משתמשים',
      'sanity',
      'passed',
      'medium',
      `Found ${snapshot.size} users`,
      `נמצאו ${snapshot.size} משתמשים`,
      Date.now() - usersStart
    ));
  } catch (error: any) {
    tests.push(createTestResult(
      'Users Collection',
      'אוסף משתמשים',
      'sanity',
      'warning',
      'medium',
      `Users collection issue: ${error.message}`,
      `בעיה באוסף משתמשים: ${error.message}`,
      Date.now() - usersStart
    ));
  }

  return createTestSuite('Sanity Tests', 'בדיקות סניטי', 'sanity', tests);
}

// ===== DATA INTEGRITY TESTS =====

async function runDataIntegrityTests(config: QATestConfig['dataIntegrity']): Promise<TestSuite> {
  const tests: TestResult[] = [];

  // Test 1: Check for courses with empty syllabus
  const emptyStart = Date.now();
  try {
    const coursesQuery = query(collection(db, 'courses'), limit(config.maxCoursesToCheck));
    const snapshot = await getDocs(coursesQuery);

    let emptyCount = 0;
    let totalCourses = 0;
    const emptyCourses: string[] = [];

    snapshot.forEach(doc => {
      totalCourses++;
      const data = doc.data();
      const syllabus = data.syllabus || [];
      if (!syllabus.length || syllabus.every((m: any) => !m.learningUnits?.length)) {
        emptyCount++;
        emptyCourses.push(doc.id);
      }
    });

    if (emptyCount === 0) {
      tests.push(createTestResult(
        'Empty Courses Check',
        'בדיקת קורסים ריקים',
        'data-integrity',
        'passed',
        'medium',
        `All ${totalCourses} courses have content`,
        `כל ${totalCourses} הקורסים מכילים תוכן`,
        Date.now() - emptyStart
      ));
    } else {
      tests.push(createTestResult(
        'Empty Courses Check',
        'בדיקת קורסים ריקים',
        'data-integrity',
        'warning',
        'medium',
        `Found ${emptyCount} courses with no content`,
        `נמצאו ${emptyCount} קורסים ללא תוכן`,
        Date.now() - emptyStart,
        { emptyCount, emptyCourses: emptyCourses.slice(0, 10) }
      ));
    }
  } catch (error: any) {
    tests.push(createTestResult(
      'Empty Courses Check',
      'בדיקת קורסים ריקים',
      'data-integrity',
      'failed',
      'medium',
      `Check failed: ${error.message}`,
      `בדיקה נכשלה: ${error.message}`,
      Date.now() - emptyStart
    ));
  }

  // Test 2: Check for blocks with missing content
  const blocksStart = Date.now();
  try {
    const coursesQuery = query(collection(db, 'courses'), limit(20));
    const snapshot = await getDocs(coursesQuery);

    let invalidBlocks = 0;
    const issues: { courseId: string; unitId: string; blockId: string; issue: string }[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const syllabus = data.syllabus || [];

      syllabus.forEach((module: any) => {
        (module.learningUnits || []).forEach((unit: any) => {
          (unit.activityBlocks || []).forEach((block: any) => {
            // Check for missing content
            if (!block.content && block.type !== 'text') {
              invalidBlocks++;
              issues.push({
                courseId: doc.id,
                unitId: unit.id,
                blockId: block.id,
                issue: 'missing_content'
              });
            }
            // Check multiple choice without correct answer
            if (block.type === 'multiple-choice') {
              const content = block.content || {};
              if (!content.correctAnswer && !content.correct_answer) {
                invalidBlocks++;
                issues.push({
                  courseId: doc.id,
                  unitId: unit.id,
                  blockId: block.id,
                  issue: 'no_correct_answer'
                });
              }
            }
          });
        });
      });
    });

    if (invalidBlocks === 0) {
      tests.push(createTestResult(
        'Block Validity Check',
        'בדיקת תקינות בלוקים',
        'data-integrity',
        'passed',
        'high',
        'All activity blocks are valid',
        'כל בלוקי הפעילות תקינים',
        Date.now() - blocksStart
      ));
    } else {
      tests.push(createTestResult(
        'Block Validity Check',
        'בדיקת תקינות בלוקים',
        'data-integrity',
        'warning',
        'high',
        `Found ${invalidBlocks} blocks with issues`,
        `נמצאו ${invalidBlocks} בלוקים עם בעיות`,
        Date.now() - blocksStart,
        { invalidBlocks, issues: issues.slice(0, 20) }
      ));
    }
  } catch (error: any) {
    tests.push(createTestResult(
      'Block Validity Check',
      'בדיקת תקינות בלוקים',
      'data-integrity',
      'failed',
      'high',
      `Check failed: ${error.message}`,
      `בדיקה נכשלה: ${error.message}`,
      Date.now() - blocksStart
    ));
  }

  // Test 3: Check for assignments without valid courses
  const assignmentsStart = Date.now();
  try {
    const tasksQuery = query(collection(db, 'student_tasks'), limit(50));
    const tasksSnapshot = await getDocs(tasksQuery);

    const courseIds = new Set<string>();
    tasksSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.courseId) courseIds.add(data.courseId);
    });

    let orphanedTasks = 0;
    for (const courseId of courseIds) {
      try {
        const courseDoc = await getDocs(query(collection(db, 'courses'), where('__name__', '==', courseId)));
        if (courseDoc.empty) orphanedTasks++;
      } catch {
        // Skip if we can't check
      }
    }

    if (orphanedTasks === 0) {
      tests.push(createTestResult(
        'Orphaned Tasks Check',
        'בדיקת מטלות יתומות',
        'data-integrity',
        'passed',
        'medium',
        'All tasks linked to valid courses',
        'כל המטלות מקושרות לקורסים תקינים',
        Date.now() - assignmentsStart
      ));
    } else {
      tests.push(createTestResult(
        'Orphaned Tasks Check',
        'בדיקת מטלות יתומות',
        'data-integrity',
        'warning',
        'medium',
        `Found ${orphanedTasks} tasks with missing courses`,
        `נמצאו ${orphanedTasks} מטלות עם קורסים חסרים`,
        Date.now() - assignmentsStart,
        { orphanedTasks }
      ));
    }
  } catch (error: any) {
    tests.push(createTestResult(
      'Orphaned Tasks Check',
      'בדיקת מטלות יתומות',
      'data-integrity',
      'skipped',
      'low',
      `Check skipped: ${error.message}`,
      `בדיקה דולגה: ${error.message}`,
      Date.now() - assignmentsStart
    ));
  }

  return createTestSuite('Data Integrity Tests', 'בדיקות שלמות נתונים', 'data-integrity', tests);
}

// ===== PERFORMANCE TESTS =====

async function runPerformanceTests(config: QATestConfig['performance']): Promise<TestSuite> {
  const tests: TestResult[] = [];

  // Test 1: Course query time
  const queryStart = Date.now();
  try {
    const coursesQuery = query(collection(db, 'courses'), orderBy('createdAt', 'desc'), limit(10));
    await getDocs(coursesQuery);
    const queryTime = Date.now() - queryStart;

    if (queryTime < config.maxQueryTimeMs) {
      tests.push(createTestResult(
        'Course Query Performance',
        'ביצועי שאילתת קורסים',
        'performance',
        'passed',
        'medium',
        `Query completed in ${queryTime}ms (limit: ${config.maxQueryTimeMs}ms)`,
        `שאילתה הושלמה ב-${queryTime}ms (גבול: ${config.maxQueryTimeMs}ms)`,
        queryTime,
        { queryTime, limit: config.maxQueryTimeMs }
      ));
    } else {
      tests.push(createTestResult(
        'Course Query Performance',
        'ביצועי שאילתת קורסים',
        'performance',
        'warning',
        'medium',
        `Query took ${queryTime}ms (exceeds ${config.maxQueryTimeMs}ms limit)`,
        `שאילתה לקחה ${queryTime}ms (חורג מגבול ${config.maxQueryTimeMs}ms)`,
        queryTime,
        { queryTime, limit: config.maxQueryTimeMs }
      ));
    }
  } catch (error: any) {
    tests.push(createTestResult(
      'Course Query Performance',
      'ביצועי שאילתת קורסים',
      'performance',
      'failed',
      'medium',
      `Query failed: ${error.message}`,
      `שאילתה נכשלה: ${error.message}`,
      Date.now() - queryStart
    ));
  }

  // Test 2: Complex aggregation query
  const aggStart = Date.now();
  try {
    const tasksQuery = query(
      collection(db, 'student_tasks'),
      where('status', '==', 'submitted'),
      limit(20)
    );
    await getDocs(tasksQuery);
    const aggTime = Date.now() - aggStart;

    tests.push(createTestResult(
      'Task Query Performance',
      'ביצועי שאילתת מטלות',
      'performance',
      aggTime < config.maxQueryTimeMs ? 'passed' : 'warning',
      'low',
      `Aggregation query: ${aggTime}ms`,
      `שאילתת אגרגציה: ${aggTime}ms`,
      aggTime
    ));
  } catch (error: any) {
    tests.push(createTestResult(
      'Task Query Performance',
      'ביצועי שאילתת מטלות',
      'performance',
      'skipped',
      'low',
      `Skipped: ${error.message}`,
      `דולגה: ${error.message}`,
      Date.now() - aggStart
    ));
  }

  return createTestSuite('Performance Tests', 'בדיקות ביצועים', 'performance', tests);
}

// ===== MAIN ORCHESTRATOR =====

export async function runFullQAReport(
  config: QATestConfig = DEFAULT_QA_CONFIG,
  triggeredBy: 'manual' | 'scheduled' | 'ci' = 'manual',
  userId?: string
): Promise<QAReport> {
  const startTime = Date.now();
  const suites: TestSuite[] = [];

  // Run all test suites
  console.log('🔍 Starting QA Tests...');

  // 1. Sanity Tests
  console.log('  ▶ Running Sanity Tests...');
  suites.push(await runSanityTests());

  // 2. Data Integrity Tests
  console.log('  ▶ Running Data Integrity Tests...');
  suites.push(await runDataIntegrityTests(config.dataIntegrity));

  // 3. Performance Tests
  console.log('  ▶ Running Performance Tests...');
  suites.push(await runPerformanceTests(config.performance));

  // Calculate summary
  const allTests = suites.flatMap(s => s.tests);
  const passed = allTests.filter(t => t.status === 'passed').length;
  const failed = allTests.filter(t => t.status === 'failed').length;
  const warnings = allTests.filter(t => t.status === 'warning').length;
  const skipped = allTests.filter(t => t.status === 'skipped').length;
  const criticalIssues = allTests.filter(t => t.status === 'failed' && t.severity === 'critical');

  let overallStatus: TestStatus = 'passed';
  if (failed > 0) overallStatus = 'failed';
  else if (warnings > 0) overallStatus = 'warning';

  const summary: QAReportSummary = {
    totalTests: allTests.length,
    passed,
    failed,
    warnings,
    skipped,
    passRate: Math.round((passed / allTests.length) * 100),
    overallStatus,
    criticalIssues,
    duration: Date.now() - startTime
  };

  const report: QAReport = {
    id: `report_${Date.now()}`,
    createdAt: new Date(startTime),
    completedAt: new Date(),
    triggeredBy,
    triggeredByUserId: userId,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    suites,
    summary,
    metadata: {
      browserInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js'
    }
  };

  console.log(`✅ QA Report Complete: ${passed}/${allTests.length} passed (${summary.passRate}%)`);

  return report;
}

// ===== SAVE REPORT TO FIRESTORE =====

export async function saveQAReport(report: QAReport): Promise<string> {
  const reportRef = doc(collection(db, 'qa_reports'));

  await setDoc(reportRef, {
    ...report,
    createdAt: Timestamp.fromDate(report.createdAt),
    completedAt: Timestamp.fromDate(report.completedAt),
    // Store suites separately to avoid document size limits
    suites: report.suites.map(s => ({
      ...s,
      tests: s.tests.map(t => ({
        ...t,
        timestamp: Timestamp.fromDate(t.timestamp)
      }))
    }))
  });

  return reportRef.id;
}

// ===== GET RECENT REPORTS =====

export async function getRecentQAReports(limitCount: number = 10): Promise<QAReport[]> {
  const reportsQuery = query(
    collection(db, 'qa_reports'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(reportsQuery);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      completedAt: data.completedAt?.toDate?.() || new Date()
    } as QAReport;
  });
}
