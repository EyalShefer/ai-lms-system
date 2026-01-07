/**
 * QA Dashboard - Admin Page for QA Reports
 * דף ניהול בדיקות איכות
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  runComprehensiveQA,
  getRecentQAReports,
  runContentQualityAgent,
  runStudentSimulationAgent,
  runAIGenerationAgent
} from '../services/qa';
import type { QAReport, TestResult, TestSuite, QAAgentResult } from '../types/qa.types';

// ===== INLINE ICONS (to avoid size prop issues) =====

const IconRefresh = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

const IconCheck = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const IconX = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const IconWarning = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const IconLoader = ({ className = "w-5 h-5" }) => (
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

// ===== HELPER COMPONENTS =====

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case 'passed': return 'bg-green-500 text-white';
      case 'failed': return 'bg-red-500 text-white';
      case 'warning': return 'bg-yellow-500 text-white';
      case 'running': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'passed': return <IconCheck className="w-3 h-3" />;
      case 'failed': return <IconX className="w-3 h-3" />;
      case 'warning': return <IconWarning className="w-3 h-3" />;
      case 'running': return <IconLoader className="w-3 h-3" />;
      default: return null;
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'passed': return 'עבר';
      case 'failed': return 'נכשל';
      case 'warning': return 'אזהרה';
      case 'running': return 'רץ...';
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

const TestSuiteCard: React.FC<{ suite: TestSuite; defaultExpanded?: boolean }> = ({ suite, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

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
        <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
          {suite.tests.map(test => (
            <TestResultItem key={test.id} test={test} />
          ))}
        </div>
      )}
    </div>
  );
};

const TestResultItem: React.FC<{ test: TestResult }> = ({ test }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={test.status} />
            <span className="font-medium text-sm">{test.nameHe}</span>
          </div>
          <div className="text-xs text-slate-400">{test.messageHe}</div>
          {test.duration > 0 && (
            <div className="text-xs text-slate-500 mt-1">⏱️ {test.duration}ms</div>
          )}
        </div>
      </div>

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
    aiGeneration: false
  });

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

    try {
      const { report } = await runComprehensiveQA({
        includeContentQuality: selectedAgents.contentQuality,
        includeStudentSimulation: selectedAgents.studentSimulation,
        includeAIGeneration: selectedAgents.aiGeneration,
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

  const handleRunSingleAgent = async (agentType: 'content' | 'simulation' | 'ai') => {
    setIsRunning(true);
    setRunProgress(`מריץ סוכן...`);

    try {
      let result: QAAgentResult;

      switch (agentType) {
        case 'content':
          result = await runContentQualityAgent(10);
          break;
        case 'simulation':
          result = await runStudentSimulationAgent(5);
          break;
        case 'ai':
          result = await runAIGenerationAgent(['multiple-choice', 'open-question']);
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
          nameHe: agentType === 'content' ? 'איכות תוכן' : agentType === 'simulation' ? 'סימולציית תלמיד' : 'יצירת AI',
          category: agentType === 'content' ? 'content-quality' : agentType === 'simulation' ? 'student-simulation' : 'ai-generation',
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

        <button
          onClick={handleRunQA}
          disabled={isRunning}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition ${
            isRunning
              ? 'bg-purple-600/50 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700'
          }`}
        >
          {isRunning ? <IconLoader /> : <IconRefresh />}
          {isRunning ? 'רץ...' : 'הרץ בדיקות מלאות'}
        </button>
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
        </div>
      </div>

      {/* Progress */}
      {runProgress && (
        <div className="bg-blue-900/50 border border-blue-700 rounded-xl p-4 mb-6 flex items-center gap-3">
          <IconLoader />
          <span>{runProgress}</span>
        </div>
      )}

      {/* Current Report */}
      {currentReport && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <StatCard value={currentReport.summary.totalTests} label="סה״כ בדיקות" />
            <StatCard value={currentReport.summary.passed} label="עברו" color="#10b981" />
            <StatCard value={currentReport.summary.failed} label="נכשלו" color="#ef4444" />
            <StatCard value={currentReport.summary.warnings} label="אזהרות" color="#f59e0b" />
            <StatCard
              value={`${currentReport.summary.passRate}%`}
              label="אחוז הצלחה"
              color={currentReport.summary.passRate >= 80 ? '#10b981' : currentReport.summary.passRate >= 50 ? '#f59e0b' : '#ef4444'}
            />
            <StatCard value={`${Math.round(currentReport.summary.duration / 1000)}s`} label="זמן ריצה" />
          </div>

          {/* Overall Status */}
          <div className={`rounded-xl p-4 mb-6 flex items-center gap-3 text-lg font-semibold ${
            currentReport.summary.overallStatus === 'passed'
              ? 'bg-green-900/50 border border-green-700'
              : currentReport.summary.overallStatus === 'failed'
              ? 'bg-red-900/50 border border-red-700'
              : 'bg-yellow-900/50 border border-yellow-700'
          }`}>
            {currentReport.summary.overallStatus === 'passed' ? '✅' : currentReport.summary.overallStatus === 'failed' ? '❌' : '⚠️'}
            <span>
              {currentReport.summary.overallStatus === 'passed'
                ? 'כל הבדיקות עברו בהצלחה!'
                : currentReport.summary.overallStatus === 'failed'
                ? 'נמצאו בעיות קריטיות'
                : 'נמצאו אזהרות'}
            </span>
          </div>

          {/* Critical Issues */}
          {currentReport.summary.criticalIssues.length > 0 && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6">
              <h3 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
                ⚠️ בעיות קריטיות ({currentReport.summary.criticalIssues.length})
              </h3>
              <div className="space-y-2">
                {currentReport.summary.criticalIssues.map(issue => (
                  <TestResultItem key={issue.id} test={issue} />
                ))}
              </div>
            </div>
          )}

          {/* Test Suites */}
          <h2 className="text-xl font-semibold mb-4">תוצאות לפי קטגוריה</h2>
          {currentReport.suites.map(suite => (
            <TestSuiteCard key={suite.id} suite={suite} defaultExpanded={suite.status === 'failed'} />
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
          <p className="text-slate-400">לחץ על "הרץ בדיקות מלאות" כדי להתחיל</p>
        </div>
      )}
    </div>
  );
};

export default QADashboard;
