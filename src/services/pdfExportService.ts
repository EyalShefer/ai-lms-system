import jsPDF from 'jspdf';
import type { TeacherLessonPlan } from '../shared/types/gemini.types';

/**
 * Exports a Teacher Lesson Plan to a formatted PDF document
 *
 * Features:
 * - Professional Hebrew formatting (RTL support)
 * - Section headings with icons
 * - Bullet points and structured content
 * - Page breaks for readability
 * - Ready-to-print format
 *
 * @param lessonPlan - The lesson plan to export
 * @returns PDF blob for download
 */
export const exportLessonPlanToPDF = (lessonPlan: TeacherLessonPlan): Blob => {
  // Create PDF with A4 size
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Load Hebrew font (using built-in unicode support)
  // Note: For better Hebrew support, consider adding a custom Hebrew font

  let yPos = 20; // Current vertical position
  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  // Helper function to add text with auto-wrapping
  const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');

    // Split text to fit within content width
    const lines = doc.splitTextToSize(text, contentWidth);

    // Check if we need a new page
    if (yPos + (lines.length * (fontSize / 3)) > pageHeight - margin) {
      doc.addPage();
      yPos = 20;
    }

    doc.text(lines, margin, yPos, { align: 'right', lang: 'he' });
    yPos += lines.length * (fontSize / 3) + 3;
  };

  // Helper function to add a section heading
  const addHeading = (title: string, emoji: string = '') => {
    yPos += 5;
    doc.setFillColor(43, 89, 195); // wizdi-royal
    doc.rect(margin, yPos - 5, contentWidth, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`${emoji} ${title}`, pageWidth - margin, yPos, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    yPos += 10;
  };

  // Helper function to add bullet points
  const addBulletList = (items: string[]) => {
    items.forEach(item => {
      addText(`• ${item}`, 11);
    });
  };

  // ===== TITLE PAGE =====
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(lessonPlan.lesson_metadata.title, pageWidth / 2, 40, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(`קהל יעד: ${lessonPlan.lesson_metadata.target_audience}`, pageWidth / 2, 55, { align: 'center' });
  doc.text(`משך: ${lessonPlan.lesson_metadata.duration}`, pageWidth / 2, 65, { align: 'center' });

  if (lessonPlan.lesson_metadata.subject) {
    doc.text(`מקצוע: ${lessonPlan.lesson_metadata.subject}`, pageWidth / 2, 75, { align: 'center' });
  }

  yPos = 90;

  // Learning Objectives
  if (lessonPlan.lesson_metadata.learning_objectives && lessonPlan.lesson_metadata.learning_objectives.length > 0) {
    addHeading('מטרות למידה', '🎯');
    addBulletList(lessonPlan.lesson_metadata.learning_objectives);
  }

  // ===== HOOK =====
  addHeading('פתיחה (Hook)', '🎣');
  addText(lessonPlan.hook.script_for_teacher);

  if (lessonPlan.hook.media_asset) {
    doc.setFont('helvetica', 'italic');
    addText(`[מדיה: ${lessonPlan.hook.media_asset.type}]`, 10);
    doc.setFont('helvetica', 'normal');
  }

  if (lessonPlan.hook.classroom_management_tip) {
    doc.setTextColor(217, 119, 6); // amber
    addText(`💡 טיפ לניהול כיתה: ${lessonPlan.hook.classroom_management_tip}`, 10);
    doc.setTextColor(0, 0, 0);
  }

  // ===== DIRECT INSTRUCTION =====
  addHeading('הוראה ישירה (Direct Instruction)', '📖');

  lessonPlan.direct_instruction.slides.forEach((slide, index) => {
    yPos += 3;
    doc.setFont('helvetica', 'bold');
    addText(`שקף ${index + 1}: ${slide.slide_title}`, 14);

    if (slide.timing_estimate) {
      doc.setTextColor(99, 102, 241); // indigo
      addText(`⏱️ זמן משוער: ${slide.timing_estimate}`, 10);
      doc.setTextColor(0, 0, 0);
    }

    doc.setFont('helvetica', 'bold');
    addText('על הלוח:', 11);
    doc.setFont('helvetica', 'normal');
    addBulletList(slide.bullet_points_for_board);

    doc.setFont('helvetica', 'bold');
    addText('סקריפט למורה:', 11);
    doc.setFont('helvetica', 'normal');
    addText(slide.script_to_say);

    if (slide.differentiation_note) {
      doc.setTextColor(147, 51, 234); // purple
      addText(`💡 דיפרנציאציה: ${slide.differentiation_note}`, 10);
      doc.setTextColor(0, 0, 0);
    }

    if (slide.media_asset) {
      doc.setFont('helvetica', 'italic');
      addText(`[מדיה: ${slide.media_asset.type}]`, 10);
      doc.setFont('helvetica', 'normal');
    }
  });

  // ===== GUIDED PRACTICE =====
  addHeading('תרגול מודרך - הנחיה בכיתה (Guided Practice)', '🧑‍🏫');
  addText(lessonPlan.guided_practice.teacher_facilitation_script);

  if (lessonPlan.guided_practice.suggested_activities && lessonPlan.guided_practice.suggested_activities.length > 0) {
    doc.setFont('helvetica', 'bold');
    addText('פעילויות מוצעות עם הנחיות פדגוגיות:', 11);
    doc.setFont('helvetica', 'normal');

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

    lessonPlan.guided_practice.suggested_activities.forEach(activity => {
      const activityName = activityNames[activity.activity_type] || activity.activity_type;
      addText(`• ${activityName}: ${activity.description}`);
      if (activity.facilitation_tip) {
        doc.setTextColor(100, 100, 100);
        addText(`  💡 ${activity.facilitation_tip}`, 9);
        doc.setTextColor(0, 0, 0);
      }
    });
  }

  if (lessonPlan.guided_practice.differentiation_strategies) {
    doc.setFont('helvetica', 'bold');
    addText('דיפרנציאציה:', 11);
    doc.setFont('helvetica', 'normal');
    addText(`👥 תלמידים מתקשים: ${lessonPlan.guided_practice.differentiation_strategies.for_struggling_students}`);
    addText(`🚀 תלמידים מתקדמים: ${lessonPlan.guided_practice.differentiation_strategies.for_advanced_students}`);
  }

  if (lessonPlan.guided_practice.assessment_tips && lessonPlan.guided_practice.assessment_tips.length > 0) {
    doc.setFont('helvetica', 'bold');
    addText('על מה לשים לב:', 11);
    doc.setFont('helvetica', 'normal');
    addBulletList(lessonPlan.guided_practice.assessment_tips);
  }

  // ===== INDEPENDENT PRACTICE =====
  addHeading('תרגול עצמאי - פעילויות דיגיטליות (Independent Practice)', '💻');
  addText(lessonPlan.independent_practice?.introduction_text || 'פעילויות אינטראקטיביות לתרגול עצמאי');

  if (lessonPlan.independent_practice?.estimated_duration) {
    doc.setFont('helvetica', 'italic');
    addText(`⏱️ משך משוער: ${lessonPlan.independent_practice.estimated_duration}`, 10);
    doc.setFont('helvetica', 'normal');
  }

  if (lessonPlan.independent_practice?.interactive_blocks && lessonPlan.independent_practice.interactive_blocks.length > 0) {
    doc.setFont('helvetica', 'bold');
    addText(`🎮 ${lessonPlan.independent_practice.interactive_blocks.length} פעילויות אינטראקטיביות מוכנות`, 11);
    doc.setFont('helvetica', 'normal');
    addText('(ניתנות לשיתוף עם תלמידים דרך המערכת)', 9);
  }

  // ===== DISCUSSION =====
  addHeading('דיון (Discussion)', '💬');

  if (lessonPlan.discussion.questions && lessonPlan.discussion.questions.length > 0) {
    doc.setFont('helvetica', 'bold');
    addText('שאלות לדיון:', 11);
    doc.setFont('helvetica', 'normal');
    addBulletList(lessonPlan.discussion.questions);
  }

  if (lessonPlan.discussion.facilitation_tips && lessonPlan.discussion.facilitation_tips.length > 0) {
    doc.setTextColor(59, 130, 246); // blue
    doc.setFont('helvetica', 'bold');
    addText('טיפים להנחיית דיון:', 11);
    doc.setFont('helvetica', 'normal');
    addBulletList(lessonPlan.discussion.facilitation_tips);
    doc.setTextColor(0, 0, 0);
  }

  // ===== SUMMARY =====
  addHeading('סיכום (Summary)', '✨');

  doc.setFont('helvetica', 'bold');
  addText('משפט המסכם:', 11);
  doc.setFont('helvetica', 'normal');
  doc.setFillColor(239, 246, 255); // light blue background
  doc.rect(margin, yPos - 3, contentWidth, 15, 'F');
  addText(lessonPlan.summary.takeaway_sentence, 13);

  if (lessonPlan.summary.homework_suggestion) {
    yPos += 5;
    doc.setTextColor(147, 51, 234); // purple
    doc.setFont('helvetica', 'bold');
    addText('הצעה לשיעורי בית:', 11);
    doc.setFont('helvetica', 'normal');
    addText(lessonPlan.summary.homework_suggestion);
    doc.setTextColor(0, 0, 0);
  }

  // ===== FOOTER =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `עמוד ${i} מתוך ${pageCount} | נוצר ע"י wizdi`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Return as blob
  return doc.output('blob');
};

/**
 * Downloads the lesson plan as a PDF file
 *
 * @param lessonPlan - The lesson plan to export
 * @param filename - Optional custom filename (defaults to lesson title)
 */
export const downloadLessonPlanPDF = (lessonPlan: TeacherLessonPlan, filename?: string) => {
  const blob = exportLessonPlanToPDF(lessonPlan);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${lessonPlan.lesson_metadata.title}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
