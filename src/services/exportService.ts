/**
 * Export Service
 * ייצוא נתונים לאקסל/CSV לשימוש במשוב ומערכות חיצוניות
 */

import * as XLSX from 'xlsx';
import type { StudentAnalytics } from './analyticsService';
import type { BloomLevel } from '../shared/types/courseTypes';

// Types
export interface ExportableStudent {
    name: string;
    email?: string;
    score: number;
    accuracy: number;
    riskLevel: string;
    totalQuestions: number;
    avgResponseTime: number;
    hintDependency: number;
    lastActive: string;
    bloomBreakdown?: Record<BloomLevel, number>;
    effortType?: string;
    gamingFlags?: string[];
}

export interface ExportOptions {
    includeBloom?: boolean;
    includeEffort?: boolean;
    includeGaming?: boolean;
    includeMastery?: boolean;
    format?: 'xlsx' | 'csv';
    filename?: string;
}

// Hebrew column names mapping
const COLUMN_NAMES_HE: Record<string, string> = {
    name: 'שם',
    email: 'אימייל',
    score: 'ציון',
    accuracy: 'דיוק (%)',
    riskLevel: 'רמת סיכון',
    totalQuestions: 'מספר שאלות',
    avgResponseTime: 'זמן תגובה ממוצע (שניות)',
    hintDependency: 'תלות ברמזים (%)',
    lastActive: 'פעילות אחרונה',
    effortType: 'סוג מאמץ',
    gamingFlags: 'התראות Gaming',
    // Bloom levels
    knowledge: 'בלום - ידע',
    comprehension: 'בלום - הבנה',
    application: 'בלום - יישום',
    analysis: 'בלום - ניתוח',
    synthesis: 'בלום - סינתזה',
    evaluation: 'בלום - הערכה'
};

// Risk level translations
const RISK_LEVEL_HE: Record<string, string> = {
    low: 'נמוך (מתקדם)',
    medium: 'בינוני (יישום)',
    high: 'גבוה (מתקשה)'
};

// Effort type translations
const EFFORT_TYPE_HE: Record<string, string> = {
    high_effort: 'מאמץ גבוה',
    quick_guess: 'ניחוש מהיר',
    normal: 'רגיל'
};

/**
 * המרת StudentAnalytics לפורמט ייצוא
 */
const transformStudentForExport = (
    student: StudentAnalytics,
    options: ExportOptions
): Record<string, any> => {
    const row: Record<string, any> = {
        [COLUMN_NAMES_HE.name]: student.name,
        [COLUMN_NAMES_HE.email]: student.email || '-',
        [COLUMN_NAMES_HE.score]: Math.round((student.performance?.accuracy || 0) * 100),
        [COLUMN_NAMES_HE.accuracy]: Math.round((student.performance?.accuracy || 0) * 100),
        [COLUMN_NAMES_HE.riskLevel]: RISK_LEVEL_HE[student.riskLevel] || student.riskLevel,
        [COLUMN_NAMES_HE.totalQuestions]: student.performance?.totalQuestions || 0,
        [COLUMN_NAMES_HE.avgResponseTime]: student.performance?.avgResponseTime || 0,
        [COLUMN_NAMES_HE.hintDependency]: Math.round((student.performance?.hintDependency || 0) * 100),
        [COLUMN_NAMES_HE.lastActive]: student.lastActive || '-'
    };

    // Add Bloom breakdown if requested
    if (options.includeBloom && (student as any).bloomBreakdown) {
        const bloom = (student as any).bloomBreakdown as Record<BloomLevel, number>;
        row[COLUMN_NAMES_HE.knowledge] = bloom.knowledge ? `${Math.round(bloom.knowledge * 100)}%` : '-';
        row[COLUMN_NAMES_HE.comprehension] = bloom.comprehension ? `${Math.round(bloom.comprehension * 100)}%` : '-';
        row[COLUMN_NAMES_HE.application] = bloom.application ? `${Math.round(bloom.application * 100)}%` : '-';
        row[COLUMN_NAMES_HE.analysis] = bloom.analysis ? `${Math.round(bloom.analysis * 100)}%` : '-';
        row[COLUMN_NAMES_HE.synthesis] = bloom.synthesis ? `${Math.round(bloom.synthesis * 100)}%` : '-';
        row[COLUMN_NAMES_HE.evaluation] = bloom.evaluation ? `${Math.round(bloom.evaluation * 100)}%` : '-';
    }

    // Add effort type if requested
    if (options.includeEffort && (student as any).effortType) {
        row[COLUMN_NAMES_HE.effortType] = EFFORT_TYPE_HE[(student as any).effortType] || (student as any).effortType;
    }

    // Add gaming flags if requested
    if (options.includeGaming && (student as any).gamingFlags?.length > 0) {
        row[COLUMN_NAMES_HE.gamingFlags] = (student as any).gamingFlags.join(', ');
    }

    return row;
};

/**
 * ייצוא תלמידים לאקסל
 */
export const exportStudentsToExcel = (
    students: StudentAnalytics[],
    courseTitle: string,
    options: ExportOptions = {}
): void => {
    const {
        includeBloom = true,
        includeEffort = true,
        includeGaming = true,
        filename = `דוח_${courseTitle}_${new Date().toLocaleDateString('he-IL')}.xlsx`
    } = options;

    // Transform students data
    const data = students.map(s => transformStudentForExport(s, {
        includeBloom,
        includeEffort,
        includeGaming
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(data);

    // Set RTL direction and column widths
    ws['!cols'] = [
        { wch: 20 }, // Name
        { wch: 25 }, // Email
        { wch: 8 },  // Score
        { wch: 10 }, // Accuracy
        { wch: 18 }, // Risk Level
        { wch: 12 }, // Total Questions
        { wch: 22 }, // Avg Response Time
        { wch: 18 }, // Hint Dependency
        { wch: 15 }, // Last Active
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'תלמידים');

    // Add summary sheet
    const summaryData = [
        { 'מדד': 'מספר תלמידים', 'ערך': students.length },
        { 'מדד': 'ממוצע ציונים', 'ערך': Math.round(students.reduce((sum, s) => sum + (s.performance?.accuracy || 0), 0) / students.length * 100) + '%' },
        { 'מדד': 'תלמידים בסיכון גבוה', 'ערך': students.filter(s => s.riskLevel === 'high').length },
        { 'מדד': 'תלמידים מתקדמים', 'ערך': students.filter(s => s.riskLevel === 'low').length },
        { 'מדד': 'תאריך הפקה', 'ערך': new Date().toLocaleString('he-IL') }
    ];

    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 25 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'סיכום');

    // Save file
    XLSX.writeFile(wb, filename);
};

/**
 * ייצוא לCSV
 */
export const exportStudentsToCSV = (
    students: StudentAnalytics[],
    courseTitle: string,
    options: ExportOptions = {}
): void => {
    const {
        includeBloom = false,
        includeEffort = true,
        filename = `דוח_${courseTitle}_${new Date().toLocaleDateString('he-IL')}.csv`
    } = options;

    const data = students.map(s => transformStudentForExport(s, {
        includeBloom,
        includeEffort
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);

    // Create and download file
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }); // BOM for Hebrew support
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * ייצוא דוח Bloom Taxonomy בלבד
 */
export const exportBloomReport = (
    students: StudentAnalytics[],
    bloomData: Record<string, Record<BloomLevel, number>>,
    courseTitle: string
): void => {
    const data = students.map(s => {
        const bloom = bloomData[s.id] || {};
        return {
            'שם': s.name,
            'ידע (Remember)': bloom.knowledge ? `${Math.round(bloom.knowledge * 100)}%` : '-',
            'הבנה (Understand)': bloom.comprehension ? `${Math.round(bloom.comprehension * 100)}%` : '-',
            'יישום (Apply)': bloom.application ? `${Math.round(bloom.application * 100)}%` : '-',
            'ניתוח (Analyze)': bloom.analysis ? `${Math.round(bloom.analysis * 100)}%` : '-',
            'הערכה (Evaluate)': bloom.evaluation ? `${Math.round(bloom.evaluation * 100)}%` : '-',
            'יצירה (Create)': bloom.synthesis ? `${Math.round(bloom.synthesis * 100)}%` : '-',
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = Array(7).fill({ wch: 18 });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bloom Taxonomy');

    XLSX.writeFile(wb, `דוח_בלום_${courseTitle}_${new Date().toLocaleDateString('he-IL')}.xlsx`);
};

/**
 * ייצוא דוח למשוב (פורמט מותאם)
 */
export const exportForMashov = (
    students: StudentAnalytics[],
    courseTitle: string
): void => {
    // Mashov-compatible format
    const data = students.map(s => ({
        'שם תלמיד': s.name,
        'ציון מספרי': Math.round((s.performance?.accuracy || 0) * 100),
        'הערת מורה': s.riskLevel === 'high'
            ? 'נדרש חיזוק נוסף'
            : s.riskLevel === 'low'
                ? 'הישגים מצוינים'
                : 'התקדמות תקינה',
        'מילולי': generateVerbalSummary(s)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 50 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'משוב');

    XLSX.writeFile(wb, `משוב_${courseTitle}_${new Date().toLocaleDateString('he-IL')}.xlsx`);
};

/**
 * יצירת סיכום מילולי לתלמיד
 */
const generateVerbalSummary = (student: StudentAnalytics): string => {
    const accuracy = Math.round((student.performance?.accuracy || 0) * 100);
    const hints = Math.round((student.performance?.hintDependency || 0) * 100);

    let summary = '';

    if (accuracy >= 80) {
        summary = `${student.name} הפגין/ה שליטה מצוינת בחומר הנלמד עם ציון ${accuracy}%.`;
    } else if (accuracy >= 60) {
        summary = `${student.name} הציג/ה התקדמות טובה עם ציון ${accuracy}%.`;
    } else {
        summary = `${student.name} זקוק/ה לחיזוק נוסף עם ציון ${accuracy}%.`;
    }

    if (hints > 50) {
        summary += ` נעשה שימוש ברמזים (${hints}%), מומלץ לתרגל באופן עצמאי.`;
    }

    return summary;
};

// Export service object
export const exportService = {
    exportStudentsToExcel,
    exportStudentsToCSV,
    exportBloomReport,
    exportForMashov
};

export default exportService;
