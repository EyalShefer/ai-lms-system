/**
 * Email Service
 * Uses Firebase Email Extension (firestore-send-email) to send emails
 * Simply write to the 'mail' collection and the extension handles delivery
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

const db = getFirestore();
const MAIL_COLLECTION = 'mail';

export interface TaskReportData {
    taskTitle: string;
    courseTitle: string;
    dueDate: Date;
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
    viewSubmissionsUrl: string;
}

/**
 * Generates beautiful Hebrew HTML email template for task report
 */
function generateTaskReportHtml(data: TaskReportData): string {
    const { taskTitle, courseTitle, dueDate, stats, aiInsights, viewSubmissionsUrl } = data;

    const formattedDate = dueDate.toLocaleDateString('he-IL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const difficultQuestionsHtml = aiInsights.difficultQuestions.length > 0
        ? aiInsights.difficultQuestions.map(q =>
            `<li style="margin-bottom: 8px;">שאלה ${q.questionNumber} (${q.topic}) - ${q.errorRate}% טעו</li>`
        ).join('')
        : '<li>לא זוהו שאלות קשות במיוחד</li>';

    const recommendationsHtml = aiInsights.recommendations.length > 0
        ? aiInsights.recommendations.map(r =>
            `<li style="margin-bottom: 8px;">${r}</li>`
        ).join('')
        : '<li>אין המלצות מיוחדות</li>';

    const studentsAttentionHtml = aiInsights.studentsNeedingAttention.length > 0
        ? aiInsights.studentsNeedingAttention.map(s =>
            `<li style="margin-bottom: 8px;"><strong>${s.name}</strong> - ${s.issue}</li>`
        ).join('')
        : '<li>כל התלמידים ברמה תקינה</li>';

    return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📊 דוח הגשות</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 18px;">${taskTitle}</p>
            <p style="color: rgba(255,255,255,0.7); margin: 5px 0 0 0; font-size: 14px;">${courseTitle}</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px;">

            <!-- Date -->
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 25px; text-align: center;">
                מועד הגשה: ${formattedDate}
            </p>

            <!-- Quick Stats -->
            <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 15px 0;">סיכום מהיר</h2>
                <div style="display: flex; justify-content: space-around; text-align: center; flex-wrap: wrap;">
                    <div style="padding: 10px;">
                        <div style="font-size: 32px; font-weight: bold; color: #6366f1;">${stats.submitted}/${stats.totalAssigned}</div>
                        <div style="color: #6b7280; font-size: 14px;">הגישו (${stats.submissionRate}%)</div>
                    </div>
                    <div style="padding: 10px;">
                        <div style="font-size: 32px; font-weight: bold; color: #10b981;">${stats.averageScore}%</div>
                        <div style="color: #6b7280; font-size: 14px;">ציון ממוצע</div>
                    </div>
                    <div style="padding: 10px;">
                        <div style="font-size: 32px; font-weight: bold; color: #f59e0b;">${stats.scoreRange.min}-${stats.scoreRange.max}</div>
                        <div style="color: #6b7280; font-size: 14px;">טווח ציונים</div>
                    </div>
                </div>
            </div>

            <!-- AI Insights -->
            <div style="background-color: #faf5ff; border-radius: 12px; padding: 20px; margin-bottom: 25px; border-right: 4px solid #8b5cf6;">
                <h2 style="color: #6b21a8; font-size: 18px; margin: 0 0 15px 0;">🔍 תובנות AI</h2>

                <h3 style="color: #7c3aed; font-size: 16px; margin: 15px 0 10px 0;">שאלות קשות:</h3>
                <ul style="color: #4c1d95; margin: 0; padding-right: 20px;">
                    ${difficultQuestionsHtml}
                </ul>

                <h3 style="color: #7c3aed; font-size: 16px; margin: 20px 0 10px 0;">המלצות:</h3>
                <ul style="color: #4c1d95; margin: 0; padding-right: 20px;">
                    ${recommendationsHtml}
                </ul>
            </div>

            <!-- Students Needing Attention -->
            ${aiInsights.studentsNeedingAttention.length > 0 ? `
            <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px; margin-bottom: 25px; border-right: 4px solid #f59e0b;">
                <h2 style="color: #92400e; font-size: 18px; margin: 0 0 15px 0;">⚠️ דורשים תשומת לב</h2>
                <ul style="color: #78350f; margin: 0; padding-right: 20px;">
                    ${studentsAttentionHtml}
                </ul>
            </div>
            ` : ''}

            <!-- CTA Button -->
            <div style="text-align: center; margin-top: 30px;">
                <a href="${viewSubmissionsUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: bold; font-size: 16px;">
                    צפה בכל ההגשות
                </a>
            </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                דוח זה נוצר אוטומטית על ידי מערכת Wizdi
            </p>
        </div>
    </div>
</body>
</html>
`;
}

/**
 * Send task report email via Firebase Email Extension
 * Writes to 'mail' collection - the extension handles delivery
 */
export async function sendTaskReportEmail(
    teacherEmail: string,
    reportData: TaskReportData
): Promise<string> {
    try {
        const htmlContent = generateTaskReportHtml(reportData);

        const mailDoc = await db.collection(MAIL_COLLECTION).add({
            to: teacherEmail,
            message: {
                subject: `📊 דוח הגשות: ${reportData.taskTitle}`,
                html: htmlContent
            },
            createdAt: FieldValue.serverTimestamp()
        });

        logger.info(`📧 Email queued for ${teacherEmail}`, { docId: mailDoc.id, taskTitle: reportData.taskTitle });

        return mailDoc.id;
    } catch (error: any) {
        logger.error('Failed to queue email:', error);
        throw new Error(`Failed to send email: ${error.message}`);
    }
}
