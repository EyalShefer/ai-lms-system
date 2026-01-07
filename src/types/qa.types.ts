/**
 * QA Testing System Types
 * מערכת בדיקות איכות אוטומטית
 */

// ===== BASE TEST TYPES =====

export type TestStatus = 'passed' | 'failed' | 'warning' | 'skipped' | 'running';
export type TestCategory = 'sanity' | 'data-integrity' | 'performance' | 'security' | 'content-quality' | 'student-simulation' | 'ai-generation';
export type TestSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface TestResult {
  id: string;
  name: string;
  nameHe: string;
  category: TestCategory;
  status: TestStatus;
  severity: TestSeverity;
  message: string;
  messageHe: string;
  details?: Record<string, unknown>;
  duration: number; // ms
  timestamp: Date;
}

export interface TestSuite {
  id: string;
  name: string;
  nameHe: string;
  category: TestCategory;
  tests: TestResult[];
  passedCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
  duration: number;
  status: TestStatus;
}

export interface QAReport {
  id: string;
  createdAt: Date;
  completedAt: Date;
  triggeredBy: 'manual' | 'scheduled' | 'ci';
  triggeredByUserId?: string;
  environment: 'development' | 'staging' | 'production';
  suites: TestSuite[];
  summary: QAReportSummary;
  metadata: {
    appVersion?: string;
    nodeVersion?: string;
    browserInfo?: string;
  };
}

export interface QAReportSummary {
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  passRate: number; // 0-100
  overallStatus: TestStatus;
  criticalIssues: TestResult[];
  duration: number;
}

// ===== CONTENT QUALITY AGENT =====

export interface ContentIssue {
  type: 'missing' | 'invalid' | 'incomplete' | 'quality' | 'accessibility';
  field: string;
  message: string;
  messageHe: string;
  severity: TestSeverity;
  autoFixable: boolean;
  suggestedFix?: string;
}

export interface ContentQualityCheck {
  courseId: string;
  unitId: string;
  blockId?: string;
  checkType:
    | 'lesson_structure'
    | 'content_completeness'
    | 'block_validity'
    | 'pedagogical_flow'
    | 'language_quality'
    | 'media_availability'
    | 'instructions_clarity';
  passed: boolean;
  score: number;
  issues: ContentIssue[];
  suggestions: string[];
}

export interface LessonPlanValidation {
  lessonPlanId: string;
  courseId: string;
  hasHook: boolean;
  hasDirectInstruction: boolean;
  hasGuidedPractice: boolean;
  hasIndependentPractice: boolean;
  hasDiscussion: boolean;
  hasSummary: boolean;
  slideCount: number;
  mediaAssetCount: number;
  mediaAssetsGenerated: number;
  mediaAssetsFailed: number;
  scriptWordCount: number;
  estimatedDuration: number;
  bloomLevelsUsed: string[];
  overallScore: number;
  issues: ContentIssue[];
}

// ===== STUDENT SIMULATION AGENT =====

export interface SimulatedStudentProfile {
  type: 'beginner' | 'average' | 'advanced' | 'struggling' | 'random';
  correctAnswerRate: number;
  useHints: boolean;
  readContent: boolean;
  interactionSpeed: 'slow' | 'normal' | 'fast';
}

export interface BlockStuckInfo {
  blockId: string;
  blockType: string;
  reason: 'no_correct_option' | 'missing_content' | 'ui_blocked' | 'infinite_loop' | 'error_thrown';
  errorMessage?: string;
}

export interface NavigationIssue {
  fromUnit: string;
  toUnit: string;
  issue: 'link_broken' | 'back_not_working' | 'progress_not_saved' | 'wrong_redirect';
  details: string;
}

export interface ContentError {
  blockId: string;
  blockType: string;
  errorType: 'render_failed' | 'missing_data' | 'invalid_state' | 'crash';
  errorMessage: string;
  stackTrace?: string;
}

export interface UXProblem {
  location: string;
  problemType: 'confusing_ui' | 'slow_response' | 'accessibility' | 'mobile_broken';
  description: string;
  severity: TestSeverity;
}

export interface StudentSimulationRun {
  id: string;
  courseId: string;
  simulationType: 'full_course' | 'single_unit' | 'specific_blocks';
  studentProfile: SimulatedStudentProfile;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed' | 'stuck';
  unitsAttempted: number;
  unitsCompleted: number;
  blocksAttempted: number;
  blocksCompleted: number;
  blocksStuck: BlockStuckInfo[];
  navigationIssues: NavigationIssue[];
  contentErrors: ContentError[];
  uxProblems: UXProblem[];
  averageTimePerBlock: number;
  errorRate: number;
  completionRate: number;
}

// ===== AI GENERATION AGENT =====

export interface AIGenerationIssue {
  type:
    | 'invalid_json'
    | 'schema_mismatch'
    | 'empty_field'
    | 'content_too_short'
    | 'content_too_long'
    | 'wrong_language'
    | 'inappropriate_content'
    | 'timeout'
    | 'rate_limited';
  field?: string;
  expected?: string;
  actual?: string;
  message: string;
}

export interface AIGenerationTest {
  id: string;
  testType:
    | 'lesson_plan_generation'
    | 'activity_generation'
    | 'quiz_generation'
    | 'podcast_generation'
    | 'image_generation'
    | 'mindmap_generation';
  inputParams: Record<string, unknown>;
  expectedOutputSchema?: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  duration: number;
  tokenCount?: number;
  retryCount: number;
  outputValid: boolean;
  schemaMatch: boolean;
  contentQualityScore: number;
  issues: AIGenerationIssue[];
  generatedContent?: unknown;
}

// ===== CONFIGURATIONS =====

export interface QATestConfig {
  sanity: {
    checkFirebaseConnection: boolean;
    checkAuthService: boolean;
    checkStorageAccess: boolean;
    checkCriticalPages: boolean;
  };
  dataIntegrity: {
    checkOrphanedCourses: boolean;
    checkEmptyUnits: boolean;
    checkBrokenReferences: boolean;
    maxCoursesToCheck: number;
  };
  performance: {
    maxQueryTimeMs: number;
    maxPageLoadTimeMs: number;
  };
  contentQuality: {
    checkLessonStructure: boolean;
    checkBlockValidity: boolean;
    minBlocksPerUnit: number;
    maxBlocksPerUnit: number;
  };
  studentSimulation: {
    enabled: boolean;
    coursesToTest: 'all' | 'recent' | 'random' | string[];
    maxCoursesPerRun: number;
    studentProfiles: SimulatedStudentProfile[];
    timeout: number;
  };
  aiGeneration: {
    enabled: boolean;
    testLessonPlanGeneration: boolean;
    testActivityGeneration: boolean;
    testQuizGeneration: boolean;
    maxRetries: number;
    timeout: number;
  };
}

export const DEFAULT_STUDENT_PROFILES: SimulatedStudentProfile[] = [
  { type: 'beginner', correctAnswerRate: 0.3, useHints: true, readContent: true, interactionSpeed: 'slow' },
  { type: 'average', correctAnswerRate: 0.7, useHints: false, readContent: true, interactionSpeed: 'normal' },
  { type: 'advanced', correctAnswerRate: 0.95, useHints: false, readContent: false, interactionSpeed: 'fast' },
  { type: 'struggling', correctAnswerRate: 0.2, useHints: true, readContent: true, interactionSpeed: 'slow' },
];

export const DEFAULT_QA_CONFIG: QATestConfig = {
  sanity: {
    checkFirebaseConnection: true,
    checkAuthService: true,
    checkStorageAccess: true,
    checkCriticalPages: true,
  },
  dataIntegrity: {
    checkOrphanedCourses: true,
    checkEmptyUnits: true,
    checkBrokenReferences: true,
    maxCoursesToCheck: 100,
  },
  performance: {
    maxQueryTimeMs: 3000,
    maxPageLoadTimeMs: 5000,
  },
  contentQuality: {
    checkLessonStructure: true,
    checkBlockValidity: true,
    minBlocksPerUnit: 3,
    maxBlocksPerUnit: 20,
  },
  studentSimulation: {
    enabled: true,
    coursesToTest: 'recent',
    maxCoursesPerRun: 5,
    studentProfiles: DEFAULT_STUDENT_PROFILES,
    timeout: 60000,
  },
  aiGeneration: {
    enabled: true,
    testLessonPlanGeneration: true,
    testActivityGeneration: true,
    testQuizGeneration: true,
    maxRetries: 2,
    timeout: 30000,
  },
};

// ===== AGENT RESPONSE =====

export interface QAAgentResult {
  agentType: 'content-quality' | 'student-simulation' | 'ai-generation';
  success: boolean;
  duration: number;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  criticalIssues: TestResult[];
  allResults: TestResult[];
}
