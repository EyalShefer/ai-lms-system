import html2pdf from 'html2pdf.js';
import type { TeacherLessonPlan } from '../shared/types/gemini.types';

/**
 * Exports a Teacher Lesson Plan to a formatted PDF document
 *
 * Features:
 * - Full Hebrew/RTL support
 * - Professional formatting with sections
 * - Emoji icons and color-coded sections
 * - Page breaks for readability
 *
 * @param lessonPlan - The lesson plan to export
 * @returns Promise<Blob> - PDF blob for download
 */
export const exportLessonPlanToPDF = async (lessonPlan: TeacherLessonPlan): Promise<Blob> => {
  const html = generateLessonPlanHTML(lessonPlan);

  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  const options = {
    margin: 10,
    filename: `${lessonPlan.lesson_metadata.title}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true
    },
    jsPDF: {
      unit: 'mm' as const,
      format: 'a4' as const,
      orientation: 'portrait' as const
    }
  };

  try {
    const blob = await html2pdf().set(options).from(container).outputPdf('blob');
    return blob;
  } finally {
    document.body.removeChild(container);
  }
};

/**
 * Generates the HTML content for the lesson plan
 */
const generateLessonPlanHTML = (lessonPlan: TeacherLessonPlan): string => {
  const activityNames: { [key: string]: string } = {
    'multiple-choice': 'שאלות רב-בררה',
    'memory_game': 'משחק זיכרון',
    'fill_in_blanks': 'השלמת משפטים',
    'ordering': 'סידור רצף',
    'categorization': 'מיון לקטגוריות',
    'drag_and_drop': 'גרור ושחרר',
    'hotspot': 'נקודות חמות',
    'open-question': 'שאלה פתוחה'
  };

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; text-align: right; padding: 20px; max-width: 800px; margin: 0 auto; color: #333;">
      <!-- Title Page -->
      <div style="text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 3px solid #2B59C3;">
        <h1 style="font-size: 28px; color: #2B59C3; margin-bottom: 20px;">${escapeHtml(lessonPlan.lesson_metadata.title)}</h1>
        <p style="font-size: 16px; color: #666; margin: 8px 0;">קהל יעד: ${escapeHtml(lessonPlan.lesson_metadata.target_audience)}</p>
        <p style="font-size: 16px; color: #666; margin: 8px 0;">משך: ${escapeHtml(lessonPlan.lesson_metadata.duration)}</p>
        ${lessonPlan.lesson_metadata.subject ? `<p style="font-size: 16px; color: #666; margin: 8px 0;">מקצוע: ${escapeHtml(lessonPlan.lesson_metadata.subject)}</p>` : ''}
      </div>

      <!-- Learning Objectives -->
      ${lessonPlan.lesson_metadata.learning_objectives && lessonPlan.lesson_metadata.learning_objectives.length > 0 ? `
        <div style="margin-bottom: 25px;">
          <div style="background: #2B59C3; color: white; padding: 10px 15px; border-radius: 5px; margin-bottom: 15px;">
            <h2 style="margin: 0; font-size: 18px;">🎯 מטרות למידה</h2>
          </div>
          <ul style="margin: 0; padding-right: 25px;">
            ${lessonPlan.lesson_metadata.learning_objectives.map(obj => `<li style="margin: 8px 0;">${escapeHtml(obj)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <!-- Hook -->
      <div style="margin-bottom: 25px;">
        <div style="background: #2B59C3; color: white; padding: 10px 15px; border-radius: 5px; margin-bottom: 15px;">
          <h2 style="margin: 0; font-size: 18px;">🎣 פתיחה (Hook)</h2>
        </div>
        <p style="line-height: 1.8;">${escapeHtml(lessonPlan.hook.script_for_teacher)}</p>
        ${lessonPlan.hook.media_asset ? `<p style="color: #666; font-style: italic;">[מדיה: ${escapeHtml(lessonPlan.hook.media_asset.type)}]</p>` : ''}
        ${lessonPlan.hook.classroom_management_tip ? `
          <div style="background: #FEF3C7; padding: 10px 15px; border-radius: 5px; border-right: 4px solid #D97706; margin-top: 10px;">
            <p style="margin: 0; color: #92400E;">💡 טיפ לניהול כיתה: ${escapeHtml(lessonPlan.hook.classroom_management_tip)}</p>
          </div>
        ` : ''}
      </div>

      <!-- Direct Instruction -->
      <div style="margin-bottom: 25px; page-break-before: always;">
        <div style="background: #2B59C3; color: white; padding: 10px 15px; border-radius: 5px; margin-bottom: 15px;">
          <h2 style="margin: 0; font-size: 18px;">📖 הוראה ישירה (Direct Instruction)</h2>
        </div>
        ${lessonPlan.direct_instruction.slides.map((slide, index) => `
          <div style="margin-bottom: 20px; padding: 15px; background: #F9FAFB; border-radius: 8px; border: 1px solid #E5E7EB;">
            <h3 style="color: #2B59C3; margin-top: 0; font-size: 16px;">שקף ${index + 1}: ${escapeHtml(slide.slide_title)}</h3>
            ${slide.timing_estimate ? `<p style="color: #6366F1; font-size: 14px;">⏱️ זמן משוער: ${escapeHtml(slide.timing_estimate)}</p>` : ''}

            <p style="font-weight: bold; margin-bottom: 5px;">על הלוח:</p>
            <ul style="margin: 0 0 15px 0; padding-right: 25px;">
              ${slide.bullet_points_for_board.map(point => `<li style="margin: 5px 0;">${escapeHtml(point)}</li>`).join('')}
            </ul>

            <p style="font-weight: bold; margin-bottom: 5px;">סקריפט למורה:</p>
            <p style="line-height: 1.8; background: white; padding: 10px; border-radius: 5px;">${escapeHtml(slide.script_to_say)}</p>

            ${slide.differentiation_note ? `
              <div style="background: #F3E8FF; padding: 8px 12px; border-radius: 5px; margin-top: 10px;">
                <p style="margin: 0; color: #7C3AED; font-size: 14px;">💡 דיפרנציאציה: ${escapeHtml(slide.differentiation_note)}</p>
              </div>
            ` : ''}

            ${slide.media_asset ? `<p style="color: #666; font-style: italic; margin-top: 10px;">[מדיה: ${escapeHtml(slide.media_asset.type)}]</p>` : ''}
          </div>
        `).join('')}
      </div>

      <!-- Guided Practice -->
      <div style="margin-bottom: 25px; page-break-before: always;">
        <div style="background: #2B59C3; color: white; padding: 10px 15px; border-radius: 5px; margin-bottom: 15px;">
          <h2 style="margin: 0; font-size: 18px;">🧑‍🏫 תרגול מודרך (Guided Practice)</h2>
        </div>
        <p style="line-height: 1.8;">${escapeHtml(lessonPlan.guided_practice.teacher_facilitation_script)}</p>

        ${lessonPlan.guided_practice.suggested_activities && lessonPlan.guided_practice.suggested_activities.length > 0 ? `
          <div style="margin-top: 15px;">
            <p style="font-weight: bold;">פעילויות מוצעות:</p>
            ${lessonPlan.guided_practice.suggested_activities.map(activity => `
              <div style="background: #F0FDF4; padding: 10px 15px; border-radius: 5px; margin: 8px 0; border-right: 4px solid #22C55E;">
                <p style="margin: 0; font-weight: bold;">${escapeHtml(activityNames[activity.activity_type] || activity.activity_type)}</p>
                <p style="margin: 5px 0 0 0;">${escapeHtml(activity.description)}</p>
                ${activity.facilitation_tip ? `<p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">💡 ${escapeHtml(activity.facilitation_tip)}</p>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${lessonPlan.guided_practice.differentiation_strategies ? `
          <div style="margin-top: 15px; background: #F3E8FF; padding: 15px; border-radius: 8px;">
            <p style="font-weight: bold; margin-top: 0;">דיפרנציאציה:</p>
            <p style="margin: 8px 0;">👥 תלמידים מתקשים: ${escapeHtml(lessonPlan.guided_practice.differentiation_strategies.for_struggling_students)}</p>
            <p style="margin: 8px 0;">🚀 תלמידים מתקדמים: ${escapeHtml(lessonPlan.guided_practice.differentiation_strategies.for_advanced_students)}</p>
          </div>
        ` : ''}

        ${lessonPlan.guided_practice.assessment_tips && lessonPlan.guided_practice.assessment_tips.length > 0 ? `
          <div style="margin-top: 15px;">
            <p style="font-weight: bold;">על מה לשים לב:</p>
            <ul style="margin: 0; padding-right: 25px;">
              ${lessonPlan.guided_practice.assessment_tips.map(tip => `<li style="margin: 5px 0;">${escapeHtml(tip)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>

      <!-- Independent Practice -->
      <div style="margin-bottom: 25px;">
        <div style="background: #2B59C3; color: white; padding: 10px 15px; border-radius: 5px; margin-bottom: 15px;">
          <h2 style="margin: 0; font-size: 18px;">💻 תרגול עצמאי (Independent Practice)</h2>
        </div>
        <p style="line-height: 1.8;">${escapeHtml(lessonPlan.independent_practice?.introduction_text || 'פעילויות אינטראקטיביות לתרגול עצמאי')}</p>
        ${lessonPlan.independent_practice?.estimated_duration ? `<p style="color: #6366F1; font-style: italic;">⏱️ משך משוער: ${escapeHtml(lessonPlan.independent_practice.estimated_duration)}</p>` : ''}
        ${lessonPlan.independent_practice?.interactive_blocks && lessonPlan.independent_practice.interactive_blocks.length > 0 ? `
          <div style="background: #EFF6FF; padding: 12px 15px; border-radius: 5px; margin-top: 10px;">
            <p style="margin: 0; font-weight: bold;">🎮 ${lessonPlan.independent_practice.interactive_blocks.length} פעילויות אינטראקטיביות מוכנות</p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">(ניתנות לשיתוף עם תלמידים דרך המערכת)</p>
          </div>
        ` : ''}
      </div>

      <!-- Discussion -->
      <div style="margin-bottom: 25px;">
        <div style="background: #2B59C3; color: white; padding: 10px 15px; border-radius: 5px; margin-bottom: 15px;">
          <h2 style="margin: 0; font-size: 18px;">💬 דיון (Discussion)</h2>
        </div>
        ${lessonPlan.discussion.questions && lessonPlan.discussion.questions.length > 0 ? `
          <p style="font-weight: bold;">שאלות לדיון:</p>
          <ul style="margin: 0 0 15px 0; padding-right: 25px;">
            ${lessonPlan.discussion.questions.map(q => `<li style="margin: 8px 0;">${escapeHtml(q)}</li>`).join('')}
          </ul>
        ` : ''}
        ${lessonPlan.discussion.facilitation_tips && lessonPlan.discussion.facilitation_tips.length > 0 ? `
          <div style="background: #DBEAFE; padding: 12px 15px; border-radius: 5px;">
            <p style="font-weight: bold; color: #1D4ED8; margin-top: 0;">טיפים להנחיית דיון:</p>
            <ul style="margin: 0; padding-right: 25px;">
              ${lessonPlan.discussion.facilitation_tips.map(tip => `<li style="margin: 5px 0; color: #1E40AF;">${escapeHtml(tip)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>

      <!-- Summary -->
      <div style="margin-bottom: 25px;">
        <div style="background: #2B59C3; color: white; padding: 10px 15px; border-radius: 5px; margin-bottom: 15px;">
          <h2 style="margin: 0; font-size: 18px;">✨ סיכום (Summary)</h2>
        </div>
        <div style="background: linear-gradient(135deg, #EFF6FF, #DBEAFE); padding: 20px; border-radius: 8px; text-align: center;">
          <p style="font-size: 18px; font-weight: bold; color: #1D4ED8; margin: 0;">${escapeHtml(lessonPlan.summary.takeaway_sentence)}</p>
        </div>
        ${lessonPlan.summary.homework_suggestion ? `
          <div style="background: #F3E8FF; padding: 12px 15px; border-radius: 5px; margin-top: 15px; border-right: 4px solid #9333EA;">
            <p style="font-weight: bold; color: #7C3AED; margin: 0 0 5px 0;">הצעה לשיעורי בית:</p>
            <p style="margin: 0;">${escapeHtml(lessonPlan.summary.homework_suggestion)}</p>
          </div>
        ` : ''}
      </div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #9CA3AF; font-size: 12px;">
        <p>נוצר ע"י wizdi</p>
      </div>
    </div>
  `;
};

/**
 * Escapes HTML special characters to prevent XSS
 */
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Downloads the lesson plan as a PDF file
 *
 * @param lessonPlan - The lesson plan to export
 * @param filename - Optional custom filename (defaults to lesson title)
 */
export const downloadLessonPlanPDF = async (lessonPlan: TeacherLessonPlan, filename?: string) => {
  const blob = await exportLessonPlanToPDF(lessonPlan);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${lessonPlan.lesson_metadata.title}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
