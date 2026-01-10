/**
 * QA Dashboard - Admin Page for QA Reports with Auto-Fix
 * דף ניהול בדיקות איכות עם תיקון אוטומטי
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  runComprehensiveQA,
  getRecentQAReports,
  runContentQualityAgent,
  runStudentSimulationAgent,
  runAIGenerationAgent,
  runE2EGenerationAgent,
  runStudentActivityAgent,
  runAssessmentIntegrityAgent,
  runKnowledgeBaseQAAgent,
  generateFixSuggestions,
  executeFix,
  executeFixBatch,
  enhanceTestResultsWithFixes
} from '../services/qa';
import type {
  QAReport,
  TestResult,
  TestSuite,
  QAAgentResult,
  FixSuggestion,
  FixResult,
  TestResultWithFix
} from '../types/qa.types';

// ===== INLINE ICONS =====

const IconRefresh = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

const IconCheck = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const IconX = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const IconWarning = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const IconLoader = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
  </svg>
);

const IconChevronDown = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const IconChevronUp = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="18 15 12 9 6 15"></polyline>
  </svg>
);

const IconBack = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>
);

const IconWrench = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
  </svg>
);

const IconZap = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

const IconCopy = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

// ===== HELPER COMPONENTS =====

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case 'passed': return 'bg-green-500 text-white';
      case 'failed': return 'bg-red-500 text-white';
      case 'warning': return 'bg-yellow-500 text-white';
      case 'running': return 'bg-blue-500 text-white';
      case 'fixed': return 'bg-purple-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'passed': return <IconCheck className="w-3 h-3" />;
      case 'failed': return <IconX className="w-3 h-3" />;
      case 'warning': return <IconWarning className="w-3 h-3" />;
      case 'running': return <IconLoader className="w-3 h-3" />;
      case 'fixed': return <IconWrench className="w-3 h-3" />;
      default: return null;
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'passed': return 'עבר';
      case 'failed': return 'נכשל';
      case 'warning': return 'אזהרה';
      case 'running': return 'רץ...';
      case 'fixed': return 'תוקן';
      default: return status;
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStyle()}`}>
      {getIcon()}
      {getLabel()}
    </span>
  );
};

const StatCard: React.FC<{ value: number | string; label: string; color?: string }> = ({ value, label, color }) => (
  <div className="bg-slate-800 rounded-xl p-4 text-center border border-slate-700">
    <div className="text-3xl font-bold" style={{ color: color || 'white' }}>{value}</div>
    <div className="text-sm text-slate-400 mt-1">{label}</div>
  </div>
);

// ===== FIX SUGGESTION COMPONENT =====

interface FixSuggestionItemProps {
  suggestion: FixSuggestion;
  onFix: (suggestion: FixSuggestion) => Promise<void>;
  isFixing: boolean;
  fixResult?: FixResult;
}

const FixSuggestionItem: React.FC<FixSuggestionItemProps> = ({
  suggestion,
  onFix,
  isFixing,
  fixResult
}) => {
  const getRiskColor = () => {
    switch (suggestion.riskLevel) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-red-400';
    }
  };

  const getRiskLabel = () => {
    switch (suggestion.riskLevel) {
      case 'low': return 'סיכון נמוך';
      case 'medium': return 'סיכון בינוני';
      case 'high': return 'סיכון גבוה';
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-3 border border-slate-600 mt-2">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm">
            <IconWrench className="w-4 h-4 text-purple-400" />
            <span className="text-slate-200">{suggestion.descriptionHe}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            <span className={getRiskColor()}>{getRiskLabel()}</span>
            <span>~{suggestion.estimatedDuration} שניות</span>
            {suggestion.requiresAI && <span className="text-purple-400">דורש AI</span>}
          </div>
        </div>

        {fixResult ? (
          <div className="flex items-center gap-2">
            {fixResult.status === 'success' ? (
              <span className="text-green-400 text-xs flex items-center gap-1">
                <IconCheck className="w-4 h-4" /> תוקן
              </span>
            ) : fixResult.status === 'failed' ? (
              <span className="text-red-400 text-xs flex items-center gap-1">
                <IconX className="w-4 h-4" /> נכשל
              </span>
            ) : (
              <span className="text-yellow-400 text-xs">{fixResult.status}</span>
            )}
          </div>
        ) : suggestion.autoFixable ? (
          <button
            onClick={() => onFix(suggestion)}
            disabled={isFixing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              isFixing
                ? 'bg-purple-600/50 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isFixing ? (
              <>
                <IconLoader className="w-3 h-3" />
                מתקן...
              </>
            ) : (
              <>
                <IconZap className="w-3 h-3" />
                תקן
              </>
            )}
          </button>
        ) : (
          <span className="text-xs text-slate-500">דורש בדיקה ידנית</span>
        )}
      </div>
    </div>
  );
};

// ===== TEST RESULT WITH FIX =====

interface TestResultItemProps {
  test: TestResult;
  onFixTest?: (test: TestResult, suggestion: FixSuggestion) => Promise<void>;
  fixingTestId?: string;
  fixResults?: Map<string, FixResult>;
}

const TestResultItem: React.FC<TestResultItemProps> = ({
  test,
  onFixTest,
  fixingTestId,
  fixResults
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showFixes, setShowFixes] = useState(false);

  // Generate fix suggestions for failed tests
  const fixSuggestions = (test.status === 'failed' || test.status === 'warning')
    ? generateFixSuggestions(test)
    : [];

  const hasAutoFix = fixSuggestions.some(s => s.autoFixable);
  const isFixing = fixingTestId === test.id;

  return (
    <div className={`bg-slate-900 rounded-lg p-3 border ${
      fixResults?.has(test.id) && fixResults.get(test.id)?.status === 'success'
        ? 'border-green-600'
        : 'border-slate-700'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={
              fixResults?.has(test.id) && fixResults.get(test.id)?.status === 'success'
                ? 'fixed'
                : test.status
            } />
            <span className="font-medium text-sm">{test.nameHe}</span>
          </div>
          <div className="text-xs text-slate-400">{test.messageHe}</div>
          {test.duration > 0 && (
            <div className="text-xs text-slate-500 mt-1">⏱️ {test.duration}ms</div>
          )}
        </div>

        {/* Fix button for failed tests */}
        {hasAutoFix && onFixTest && !fixResults?.has(test.id) && (
          <button
            onClick={() => setShowFixes(!showFixes)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 transition"
          >
            <IconWrench className="w-3 h-3" />
            {fixSuggestions.length} תיקונים
          </button>
        )}
      </div>

      {/* Fix Suggestions */}
      {showFixes && fixSuggestions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <div className="text-xs text-slate-400 mb-2">הצעות תיקון:</div>
          {fixSuggestions.map(suggestion => (
            <FixSuggestionItem
              key={suggestion.id}
              suggestion={suggestion}
              onFix={async (s) => onFixTest && await onFixTest(test, s)}
              isFixing={isFixing}
              fixResult={fixResults?.get(suggestion.id)}
            />
          ))}
        </div>
      )}

      {/* Details */}
      {test.details && (
        <>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-purple-400 text-xs mt-2 hover:underline"
          >
            {showDetails ? 'הסתר פרטים' : 'הצג פרטים'}
          </button>
          {showDetails && (
            <pre className="mt-2 p-2 bg-slate-950 rounded text-xs overflow-auto max-h-40 text-slate-300">
              {JSON.stringify(test.details, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
};

// ===== TEST SUITE WITH FIX ALL =====

interface TestSuiteCardProps {
  suite: TestSuite;
  defaultExpanded?: boolean;
  onFixTest?: (test: TestResult, suggestion: FixSuggestion) => Promise<void>;
  onFixAll?: (suite: TestSuite) => Promise<void>;
  fixingTestId?: string;
  fixResults?: Map<string, FixResult>;
  isFixingAll?: boolean;
}

const TestSuiteCard: React.FC<TestSuiteCardProps> = ({
  suite,
  defaultExpanded = false,
  onFixTest,
  onFixAll,
  fixingTestId,
  fixResults,
  isFixingAll
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Count fixable issues
  const fixableCount = suite.tests.filter(t =>
    (t.status === 'failed' || t.status === 'warning') &&
    generateFixSuggestions(t).some(s => s.autoFixable)
  ).length;

  return (
    <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700">
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">📊</span>
          <span className="font-semibold">{suite.nameHe}</span>
          <StatusBadge status={suite.status} />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-green-400">✓ {suite.passedCount}</span>
          <span className="text-red-400">✗ {suite.failedCount}</span>
          <span className="text-yellow-400">⚠ {suite.warningCount}</span>
          {expanded ? <IconChevronUp /> : <IconChevronDown />}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          {/* Fix All Button */}
          {fixableCount > 0 && onFixAll && (
            <div className="mb-4 flex justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFixAll(suite);
                }}
                disabled={isFixingAll}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  isFixingAll
                    ? 'bg-purple-600/50 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {isFixingAll ? (
                  <>
                    <IconLoader className="w-4 h-4" />
                    מתקן הכל...
                  </>
                ) : (
                  <>
                    <IconZap className="w-4 h-4" />
                    תקן הכל ({fixableCount})
                  </>
                )}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {suite.tests.map(test => (
              <TestResultItem
                key={test.id}
                test={test}
                onFixTest={onFixTest}
                fixingTestId={fixingTestId}
                fixResults={fixResults}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ===== MAIN COMPONENT =====

interface QADashboardProps {
  onBack?: () => void;
}

const QADashboard: React.FC<QADashboardProps> = ({ onBack }) => {
  const { currentUser } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [currentReport, setCurrentReport] = useState<QAReport | null>(null);
  const [recentReports, setRecentReports] = useState<QAReport[]>([]);
  const [runProgress, setRunProgress] = useState<string>('');
  const [selectedAgents, setSelectedAgents] = useState({
    contentQuality: true,
    studentSimulation: true,
    aiGeneration: false,
    e2eGeneration: false,
    studentActivity: false,
    assessmentIntegrity: false,
    knowledgeBase: false
  });

  // Fix state
  const [fixingTestId, setFixingTestId] = useState<string | undefined>();
  const [isFixingAll, setIsFixingAll] = useState(false);
  const [fixResults, setFixResults] = useState<Map<string, FixResult>>(new Map());
  const [fixProgress, setFixProgress] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    loadRecentReports();
  }, []);

  const loadRecentReports = async () => {
    try {
      const reports = await getRecentQAReports(5);
      setRecentReports(reports);
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

  const handleRunQA = async () => {
    setIsRunning(true);
    setRunProgress('מתחיל בדיקות...');
    setFixResults(new Map()); // Clear previous fix results

    try {
      const { report } = await runComprehensiveQA({
        includeContentQuality: selectedAgents.contentQuality,
        includeStudentSimulation: selectedAgents.studentSimulation,
        includeAIGeneration: selectedAgents.aiGeneration,
        includeE2EGeneration: selectedAgents.e2eGeneration,
        includeStudentActivity: selectedAgents.studentActivity,
        includeAssessmentIntegrity: selectedAgents.assessmentIntegrity,
        includeKnowledgeBase: selectedAgents.knowledgeBase,
        maxCourses: 10,
        saveReport: true,
        userId: currentUser?.uid
      });

      setCurrentReport(report);
      await loadRecentReports();
      setRunProgress('');
    } catch (error: any) {
      console.error('QA run failed:', error);
      setRunProgress(`שגיאה: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunSingleAgent = async (agentType: 'content' | 'simulation' | 'ai' | 'e2e' | 'activity' | 'integrity' | 'knowledge-base') => {
    setIsRunning(true);
    setRunProgress(`מריץ סוכן...`);
    setFixResults(new Map());

    try {
      let result: QAAgentResult;
      let agentNameHe: string;
      let categoryName: string;

      switch (agentType) {
        case 'content':
          result = await runContentQualityAgent(10);
          agentNameHe = 'איכות תוכן';
          categoryName = 'content-quality';
          break;
        case 'simulation':
          result = await runStudentSimulationAgent(5);
          agentNameHe = 'סימולציית תלמיד';
          categoryName = 'student-simulation';
          break;
        case 'ai':
          result = await runAIGenerationAgent(['multiple-choice', 'open-question']);
          agentNameHe = 'יצירת AI';
          categoryName = 'ai-generation';
          break;
        case 'e2e':
          result = await runE2EGenerationAgent();
          agentNameHe = 'יצירת תוכן מקצה לקצה';
          categoryName = 'e2e-generation';
          break;
        case 'activity':
          result = await runStudentActivityAgent(5, true);
          agentNameHe = 'פעילות תלמיד';
          categoryName = 'student-activity';
          break;
        case 'integrity':
          result = await runAssessmentIntegrityAgent(10);
          agentNameHe = 'אינטגריטי הערכה';
          categoryName = 'assessment-integrity';
          break;
        case 'knowledge-base':
          result = await runKnowledgeBaseQAAgent(3);
          agentNameHe = 'אינטגרציית בסיס ידע';
          categoryName = 'knowledge-base';
          break;
      }

      const miniReport: QAReport = {
        id: `single_${Date.now()}`,
        createdAt: new Date(),
        completedAt: new Date(),
        triggeredBy: 'manual',
        triggeredByUserId: currentUser?.uid,
        environment: 'development',
        suites: [{
          id: `suite_${agentType}`,
          name: agentType,
          nameHe: agentNameHe,
          category: categoryName,
          tests: result.allResults,
          passedCount: result.testsPassed,
          failedCount: result.testsFailed,
          warningCount: result.allResults.filter(t => t.status === 'warning').length,
          skippedCount: 0,
          duration: result.duration,
          status: result.success ? 'passed' : 'failed'
        }],
        summary: {
          totalTests: result.testsRun,
          passed: result.testsPassed,
          failed: result.testsFailed,
          warnings: result.allResults.filter(t => t.status === 'warning').length,
          skipped: 0,
          passRate: result.testsRun > 0 ? Math.round((result.testsPassed / result.testsRun) * 100) : 0,
          overallStatus: result.success ? 'passed' : 'failed',
          criticalIssues: result.criticalIssues,
          duration: result.duration
        },
        metadata: {}
      };

      setCurrentReport(miniReport);
      setRunProgress('');
    } catch (error: any) {
      console.error('Agent run failed:', error);
      setRunProgress(`שגיאה: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Handle single fix
  const handleFixTest = async (test: TestResult, suggestion: FixSuggestion) => {
    setFixingTestId(test.id);
    setFixProgress(`מתקן: ${suggestion.descriptionHe}`);

    try {
      const result = await executeFix(suggestion, currentUser?.uid);
      setFixResults(prev => new Map(prev).set(test.id, result));

      if (result.status === 'success') {
        setFixProgress(`✅ תוקן בהצלחה!`);
      } else {
        setFixProgress(`❌ תיקון נכשל: ${result.errorMessage}`);
      }
    } catch (error: any) {
      setFixProgress(`❌ שגיאה: ${error.message}`);
    } finally {
      setFixingTestId(undefined);
      setTimeout(() => setFixProgress(''), 3000);
    }
  };

  // Handle fix all in suite
  const handleFixAll = async (suite: TestSuite) => {
    setIsFixingAll(true);

    // Collect all fixable suggestions
    const allSuggestions: { test: TestResult; suggestion: FixSuggestion }[] = [];

    for (const test of suite.tests) {
      if (test.status === 'failed' || test.status === 'warning') {
        const suggestions = generateFixSuggestions(test);
        const autoFixable = suggestions.filter(s => s.autoFixable);
        if (autoFixable.length > 0) {
          allSuggestions.push({ test, suggestion: autoFixable[0] });
        }
      }
    }

    setFixProgress(`מתקן ${allSuggestions.length} בעיות...`);

    let completed = 0;
    for (const { test, suggestion } of allSuggestions) {
      try {
        const result = await executeFix(suggestion, currentUser?.uid);
        setFixResults(prev => new Map(prev).set(test.id, result));
        completed++;
        setFixProgress(`מתקן ${completed}/${allSuggestions.length}...`);
      } catch (error) {
        console.error('Fix failed:', error);
      }
    }

    setFixProgress(`✅ הושלם! ${completed}/${allSuggestions.length} תוקנו`);
    setIsFixingAll(false);
    setTimeout(() => setFixProgress(''), 5000);
  };

  // Count total fixable issues
  const totalFixable = currentReport?.suites.reduce((sum, suite) => {
    return sum + suite.tests.filter(t =>
      (t.status === 'failed' || t.status === 'warning') &&
      generateFixSuggestions(t).some(s => s.autoFixable)
    ).length;
  }, 0) || 0;

  // Generate full report for copying
  const generateFullReport = (): string => {
    if (!currentReport) return '';

    const lines: string[] = [];

    lines.push('# 📊 דוח QA מלא');
    lines.push(`תאריך: ${new Date(currentReport.createdAt).toLocaleString('he-IL')}`);
    lines.push(`סביבה: ${currentReport.environment}`);
    lines.push('');

    lines.push('## 📈 סיכום');
    lines.push(`- סה"כ בדיקות: ${currentReport.summary.totalTests}`);
    lines.push(`- עברו: ${currentReport.summary.passed} (${currentReport.summary.passRate}%)`);
    lines.push(`- נכשלו: ${currentReport.summary.failed}`);
    lines.push(`- אזהרות: ${currentReport.summary.warnings}`);
    lines.push(`- זמן ריצה: ${Math.round(currentReport.summary.duration / 1000)} שניות`);
    lines.push('');

    // Critical Issues
    if (currentReport.summary.criticalIssues.length > 0) {
      lines.push('## 🔴 בעיות קריטיות');
      currentReport.summary.criticalIssues.forEach(issue => {
        lines.push(`### ❌ ${issue.nameHe}`);
        lines.push(`- הודעה: ${issue.messageHe}`);
        if (issue.details) {
          lines.push('- פרטים:');
          lines.push('```json');
          lines.push(JSON.stringify(issue.details, null, 2));
          lines.push('```');
        }
        lines.push('');
      });
    }

    // All Suites
    lines.push('## 📋 תוצאות מפורטות לפי קטגוריה');
    lines.push('');

    currentReport.suites.forEach(suite => {
      const statusIcon = suite.status === 'passed' ? '✅' : suite.status === 'failed' ? '❌' : '⚠️';
      lines.push(`### ${statusIcon} ${suite.nameHe}`);
      lines.push(`- עברו: ${suite.passedCount} | נכשלו: ${suite.failedCount} | אזהרות: ${suite.warningCount}`);
      lines.push('');

      suite.tests.forEach(test => {
        const testIcon = test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⚠️';
        lines.push(`#### ${testIcon} ${test.nameHe}`);
        lines.push(`- סטטוס: ${test.status}`);
        lines.push(`- הודעה: ${test.messageHe}`);
        if (test.duration > 0) {
          lines.push(`- זמן: ${test.duration}ms`);
        }

        if (test.details) {
          lines.push('- **פרטים מלאים:**');
          lines.push('```json');
          lines.push(JSON.stringify(test.details, null, 2));
          lines.push('```');
        }

        // Add fix suggestions for failed tests
        if (test.status === 'failed' || test.status === 'warning') {
          const suggestions = generateFixSuggestions(test);
          if (suggestions.length > 0) {
            lines.push('- **הצעות תיקון:**');
            suggestions.forEach(s => {
              lines.push(`  - ${s.descriptionHe} (${s.autoFixable ? 'אוטומטי' : 'ידני'})`);
            });
          }
        }

        lines.push('');
      });
    });

    // Add raw JSON at the end
    lines.push('---');
    lines.push('## 📄 JSON מלא (לניתוח טכני)');
    lines.push('```json');
    lines.push(JSON.stringify(currentReport, null, 2));
    lines.push('```');

    return lines.join('\n');
  };

  const handleCopyReport = async () => {
    const fullReport = generateFullReport();
    try {
      await navigator.clipboard.writeText(fullReport);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback: create a textarea and copy
      const textarea = document.createElement('textarea');
      textarea.value = fullReport;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 transition"
            >
              <IconBack />
              חזרה
            </button>
          )}
          <h1 className="text-2xl font-bold flex items-center gap-3">
            🧠 מערכת בדיקות איכות
            <span className="text-xs bg-purple-600 px-2 py-1 rounded-full">Admin</span>
          </h1>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCopyReport}
            disabled={!currentReport}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition ${
              copySuccess
                ? 'bg-green-600 text-white'
                : !currentReport
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'
            }`}
            title={!currentReport ? 'הרץ בדיקות כדי ליצור דוח' : 'העתק דוח מלא ללוח'}
          >
            {copySuccess ? (
              <>
                <IconCheck className="w-4 h-4" />
                הועתק!
              </>
            ) : (
              <>
                <IconCopy className="w-4 h-4" />
                העתק דוח מלא
              </>
            )}
          </button>
          <button
            onClick={handleRunQA}
            disabled={isRunning || isFixingAll}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition ${
              isRunning || isFixingAll
                ? 'bg-purple-600/50 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isRunning ? <IconLoader /> : <IconRefresh />}
            {isRunning ? 'רץ...' : 'הרץ בדיקות'}
          </button>
        </div>
      </div>

      {/* Agent Selection */}
      <div className="bg-slate-800 rounded-xl p-4 mb-6 border border-slate-700">
        <h3 className="font-semibold mb-3">בחר סוכנים להרצה:</h3>
        <div className="flex flex-wrap gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedAgents.contentQuality}
              onChange={e => setSelectedAgents(prev => ({ ...prev, contentQuality: e.target.checked }))}
              className="w-4 h-4"
            />
            📝 בדיקת איכות תוכן
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedAgents.studentSimulation}
              onChange={e => setSelectedAgents(prev => ({ ...prev, studentSimulation: e.target.checked }))}
              className="w-4 h-4"
            />
            🎓 סימולציית תלמיד
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedAgents.aiGeneration}
              onChange={e => setSelectedAgents(prev => ({ ...prev, aiGeneration: e.target.checked }))}
              className="w-4 h-4"
            />
            ✨ בדיקת יצירת AI (עלות API)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedAgents.e2eGeneration}
              onChange={e => setSelectedAgents(prev => ({ ...prev, e2eGeneration: e.target.checked }))}
              className="w-4 h-4"
            />
            🏭 יצירת תוכן מקצה לקצה (עלות API)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedAgents.studentActivity}
              onChange={e => setSelectedAgents(prev => ({ ...prev, studentActivity: e.target.checked }))}
              className="w-4 h-4"
            />
            📝 פעילות תלמיד (ניקוד)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedAgents.assessmentIntegrity}
              onChange={e => setSelectedAgents(prev => ({ ...prev, assessmentIntegrity: e.target.checked }))}
              className="w-4 h-4"
            />
            ⚖️ אינטגריטי הערכה
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedAgents.knowledgeBase}
              onChange={e => setSelectedAgents(prev => ({ ...prev, knowledgeBase: e.target.checked }))}
              className="w-4 h-4"
            />
            📚 אינטגרציית בסיס ידע
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-slate-400 text-sm">הרצה מהירה:</span>
          <button
            onClick={() => handleRunSingleAgent('content')}
            disabled={isRunning}
            className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 transition disabled:opacity-50"
          >
            📝 איכות תוכן
          </button>
          <button
            onClick={() => handleRunSingleAgent('simulation')}
            disabled={isRunning}
            className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 transition disabled:opacity-50"
          >
            🎓 סימולציה
          </button>
          <button
            onClick={() => handleRunSingleAgent('ai')}
            disabled={isRunning}
            className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 transition disabled:opacity-50"
          >
            ✨ יצירת AI
          </button>
          <button
            onClick={() => handleRunSingleAgent('e2e')}
            disabled={isRunning}
            className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 transition disabled:opacity-50"
          >
            🏭 E2E יצירת תוכן
          </button>
          <button
            onClick={() => handleRunSingleAgent('activity')}
            disabled={isRunning}
            className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 transition disabled:opacity-50"
          >
            📝 פעילות תלמיד
          </button>
          <button
            onClick={() => handleRunSingleAgent('integrity')}
            disabled={isRunning}
            className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 transition disabled:opacity-50"
          >
            ⚖️ אינטגריטי
          </button>
          <button
            onClick={() => handleRunSingleAgent('knowledge-base')}
            disabled={isRunning}
            className="px-3 py-1 text-xs rounded bg-purple-700 hover:bg-purple-600 transition disabled:opacity-50"
          >
            📚 בסיס ידע
          </button>
        </div>
      </div>

      {/* Progress */}
      {(runProgress || fixProgress) && (
        <div className={`rounded-xl p-4 mb-6 flex items-center gap-3 ${
          fixProgress.includes('✅') ? 'bg-green-900/50 border border-green-700' :
          fixProgress.includes('❌') ? 'bg-red-900/50 border border-red-700' :
          'bg-blue-900/50 border border-blue-700'
        }`}>
          {!fixProgress.includes('✅') && !fixProgress.includes('❌') && <IconLoader />}
          <span>{fixProgress || runProgress}</span>
        </div>
      )}

      {/* Current Report */}
      {currentReport && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
            <StatCard value={currentReport.summary.totalTests} label="סה״כ בדיקות" />
            <StatCard value={currentReport.summary.passed} label="עברו" color="#10b981" />
            <StatCard value={currentReport.summary.failed} label="נכשלו" color="#ef4444" />
            <StatCard value={currentReport.summary.warnings} label="אזהרות" color="#f59e0b" />
            <StatCard value={totalFixable} label="ניתן לתיקון" color="#a855f7" />
            <StatCard
              value={`${currentReport.summary.passRate}%`}
              label="אחוז הצלחה"
              color={currentReport.summary.passRate >= 80 ? '#10b981' : currentReport.summary.passRate >= 50 ? '#f59e0b' : '#ef4444'}
            />
            <StatCard value={`${Math.round(currentReport.summary.duration / 1000)}s`} label="זמן ריצה" />
          </div>

          {/* Overall Status with Fix All */}
          <div className={`rounded-xl p-4 mb-6 flex items-center justify-between ${
            currentReport.summary.overallStatus === 'passed'
              ? 'bg-green-900/50 border border-green-700'
              : currentReport.summary.overallStatus === 'failed'
              ? 'bg-red-900/50 border border-red-700'
              : 'bg-yellow-900/50 border border-yellow-700'
          }`}>
            <div className="flex items-center gap-3 text-lg font-semibold">
              {currentReport.summary.overallStatus === 'passed' ? '✅' : currentReport.summary.overallStatus === 'failed' ? '❌' : '⚠️'}
              <span>
                {currentReport.summary.overallStatus === 'passed'
                  ? 'כל הבדיקות עברו בהצלחה!'
                  : currentReport.summary.overallStatus === 'failed'
                  ? 'נמצאו בעיות קריטיות'
                  : 'נמצאו אזהרות'}
              </span>
            </div>

            {totalFixable > 0 && (
              <button
                onClick={() => {
                  // Fix all issues across all suites
                  currentReport.suites.forEach(suite => handleFixAll(suite));
                }}
                disabled={isFixingAll}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition ${
                  isFixingAll
                    ? 'bg-purple-600/50 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {isFixingAll ? (
                  <>
                    <IconLoader />
                    מתקן...
                  </>
                ) : (
                  <>
                    <IconZap />
                    תקן הכל ({totalFixable})
                  </>
                )}
              </button>
            )}
          </div>

          {/* Critical Issues */}
          {currentReport.summary.criticalIssues.length > 0 && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6">
              <h3 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
                ⚠️ בעיות קריטיות ({currentReport.summary.criticalIssues.length})
              </h3>
              <div className="space-y-2">
                {currentReport.summary.criticalIssues.map(issue => (
                  <TestResultItem
                    key={issue.id}
                    test={issue}
                    onFixTest={handleFixTest}
                    fixingTestId={fixingTestId}
                    fixResults={fixResults}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Test Suites */}
          <h2 className="text-xl font-semibold mb-4">תוצאות לפי קטגוריה</h2>
          {currentReport.suites.map(suite => (
            <TestSuiteCard
              key={suite.id}
              suite={suite}
              defaultExpanded={suite.status === 'failed'}
              onFixTest={handleFixTest}
              onFixAll={handleFixAll}
              fixingTestId={fixingTestId}
              fixResults={fixResults}
              isFixingAll={isFixingAll}
            />
          ))}
        </>
      )}

      {/* Recent Reports */}
      {recentReports.length > 0 && !currentReport && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="font-semibold mb-4">דוחות אחרונים</h3>
          <div className="space-y-2">
            {recentReports.map(report => (
              <div
                key={report.id}
                onClick={() => setCurrentReport(report)}
                className="flex justify-between items-center p-3 bg-slate-900 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800 transition"
              >
                <div>
                  <div className="font-medium">{new Date(report.createdAt).toLocaleString('he-IL')}</div>
                  <div className="text-sm text-slate-400">
                    {report.summary.totalTests} בדיקות | {report.summary.passRate}% הצלחה
                  </div>
                </div>
                <StatusBadge status={report.summary.overallStatus} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!currentReport && recentReports.length === 0 && !isRunning && (
        <div className="bg-slate-800 rounded-xl p-12 text-center border border-slate-700">
          <div className="text-5xl mb-4 opacity-50">🧠</div>
          <h3 className="text-lg font-semibold mb-2">אין דוחות בדיקות</h3>
          <p className="text-slate-400">לחץ על "הרץ בדיקות" כדי להתחיל</p>
        </div>
      )}
    </div>
  );
};

export default QADashboard;
