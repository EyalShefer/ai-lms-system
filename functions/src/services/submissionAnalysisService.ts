/**
 * Submission Analysis Service
 * Uses Gemini 2.5 Pro to analyze student submissions and generate pedagogical insights
 */

import * as logger from 'firebase-functions/logger';
import { generateJSON, ChatMessage } from './geminiService';

export interface SubmissionData {
    studentId: string;
    studentName: string;
    status: 'new' | 'in_progress' | 'submitted' | 'graded' | 'late';
    progress: number;
    score?: number;
    maxScore?: number;
    percentage?: number;
    telemetry?: {
        stepResults?: Record<string, 'success' | 'failure' | 'viewed'>;
        hintsUsed?: Record<string, number>;
        totalBlocks?: number;
        completedBlocks?: number;
        successBlocks?: number;
        failureBlocks?: number;
        timeSpentSeconds?: number;
    };
    answers?: Record<string, any>;
}

export interface TaskData {
    id: string;
    title: string;
    courseTitle: string;
    maxPoints: number;
}

export interface AnalysisResult {
    stats: {
        totalAssigned: number;
        submitted: number;
        submissionRate: number;
        averageScore: number;
        scoreRange: { min: number; max: number };
    };
    aiInsights: {
        difficultQuestions: Array<{
            questionNumber: number;
            topic: string;
            errorRate: number;
        }>;
        recommendations: string[];
        studentsNeedingAttention: Array<{
            name: string;
            issue: string;
        }>;
    };
}

/**
 * Calculate basic statistics from submissions
 */
function calculateStats(submissions: SubmissionData[], totalAssigned: number): AnalysisResult['stats'] {
    const submittedSubmissions = submissions.filter(s =>
        s.status === 'submitted' || s.status === 'graded' || s.status === 'late'
    );

    const scores = submittedSubmissions
        .map(s => s.percentage ?? 0)
        .filter(s => s > 0);

    const averageScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

    const submissionRate = totalAssigned > 0
        ? Math.round((submittedSubmissions.length / totalAssigned) * 100)
        : 0;

    return {
        totalAssigned,
        submitted: submittedSubmissions.length,
        submissionRate,
        averageScore,
        scoreRange: { min: minScore, max: maxScore }
    };
}

/**
 * Find students who need attention based on their performance
 */
function findStudentsNeedingAttention(submissions: SubmissionData[]): Array<{ name: string; issue: string }> {
    const needingAttention: Array<{ name: string; issue: string }> = [];

    for (const submission of submissions) {
        // Student didn't complete
        if (submission.status === 'in_progress' && submission.progress < 50) {
            needingAttention.push({
                name: submission.studentName,
                issue: `לא סיים, התקדמות ${submission.progress}%`
            });
            continue;
        }

        // Low score
        if (submission.percentage && submission.percentage < 50) {
            needingAttention.push({
                name: submission.studentName,
                issue: `ציון נמוך: ${submission.percentage}%`
            });
            continue;
        }

        // High hint usage
        const totalHints = submission.telemetry?.hintsUsed
            ? Object.values(submission.telemetry.hintsUsed).reduce((a, b) => a + b, 0)
            : 0;
        if (totalHints > 5) {
            needingAttention.push({
                name: submission.studentName,
                issue: `שימוש גבוה ברמזים (${totalHints} רמזים)`
            });
        }
    }

    return needingAttention.slice(0, 5); // Limit to top 5
}

/**
 * Find difficult questions based on telemetry
 */
function findDifficultQuestions(submissions: SubmissionData[]): Array<{ questionNumber: number; topic: string; errorRate: number }> {
    const questionStats: Record<string, { total: number; failures: number }> = {};

    for (const submission of submissions) {
        if (!submission.telemetry?.stepResults) continue;

        for (const [stepId, result] of Object.entries(submission.telemetry.stepResults)) {
            if (!questionStats[stepId]) {
                questionStats[stepId] = { total: 0, failures: 0 };
            }
            questionStats[stepId].total++;
            if (result === 'failure') {
                questionStats[stepId].failures++;
            }
        }
    }

    const difficultQuestions = Object.entries(questionStats)
        .map(([stepId, stats]) => ({
            questionNumber: parseInt(stepId.replace(/\D/g, '')) || 1,
            topic: 'שאלה',
            errorRate: Math.round((stats.failures / stats.total) * 100)
        }))
        .filter(q => q.errorRate > 30)
        .sort((a, b) => b.errorRate - a.errorRate)
        .slice(0, 3);

    return difficultQuestions;
}

/**
 * Generate AI-powered pedagogical insights using Gemini 2.5 Pro
 */
async function generateAIInsights(
    task: TaskData,
    stats: AnalysisResult['stats'],
    difficultQuestions: Array<{ questionNumber: number; topic: string; errorRate: number }>,
    studentsNeedingAttention: Array<{ name: string; issue: string }>
): Promise<string[]> {
    const prompt = `אתה יועץ פדגוגי מומחה. נתח את נתוני ההגשות הבאים וספק 2-3 המלצות קצרות וממוקדות למורה.

משימה: ${task.title}
קורס: ${task.courseTitle}

סטטיסטיקות:
- הגישו: ${stats.submitted}/${stats.totalAssigned} (${stats.submissionRate}%)
- ציון ממוצע: ${stats.averageScore}%
- טווח ציונים: ${stats.scoreRange.min}-${stats.scoreRange.max}

שאלות קשות:
${difficultQuestions.length > 0
        ? difficultQuestions.map(q => `- שאלה ${q.questionNumber}: ${q.errorRate}% טעו`).join('\n')
        : '- לא זוהו שאלות קשות במיוחד'}

תלמידים שצריכים תשומת לב:
${studentsNeedingAttention.length > 0
        ? studentsNeedingAttention.map(s => `- ${s.name}: ${s.issue}`).join('\n')
        : '- אין תלמידים שצריכים תשומת לב מיוחדת'}

החזר JSON בלבד:
{
  "recommendations": ["המלצה 1", "המלצה 2", "המלצה 3"]
}

ההמלצות צריכות להיות:
- קצרות (משפט אחד כל אחת)
- מעשיות ויישומיות
- ממוקדות בשיפור הלמידה
- בעברית`;

    try {
        const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
        const result = await generateJSON<{ recommendations: string[] }>(messages, {
            temperature: 0.5,
            maxTokens: 500
        });
        return result.recommendations || [];
    } catch (error) {
        logger.error('AI analysis failed:', error);
        return ['בדקו את השאלות הקשות והתייחסו אליהן בשיעור הבא'];
    }
}

/**
 * Main analysis function
 * Analyzes submissions and generates insights with Gemini 2.5 Pro
 */
export async function analyzeSubmissions(
    task: TaskData,
    submissions: SubmissionData[],
    totalAssigned: number
): Promise<AnalysisResult> {
    logger.info(`📊 Analyzing ${submissions.length} submissions for task: ${task.title}`);

    // Calculate basic stats
    const stats = calculateStats(submissions, totalAssigned);

    // Find difficult questions
    const difficultQuestions = findDifficultQuestions(submissions);

    // Find students needing attention
    const studentsNeedingAttention = findStudentsNeedingAttention(submissions);

    // Generate AI recommendations using Gemini 2.5 Pro
    const recommendations = await generateAIInsights(
        task,
        stats,
        difficultQuestions,
        studentsNeedingAttention
    );

    logger.info(`✅ Analysis complete for task: ${task.title}`, {
        submissionRate: stats.submissionRate,
        averageScore: stats.averageScore,
        difficultQuestions: difficultQuestions.length,
        studentsNeedingAttention: studentsNeedingAttention.length
    });

    return {
        stats,
        aiInsights: {
            difficultQuestions,
            recommendations,
            studentsNeedingAttention
        }
    };
}
