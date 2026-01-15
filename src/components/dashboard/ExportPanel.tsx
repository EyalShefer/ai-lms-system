/**
 * Export Panel Component
 * ייצוא נתוני תלמידים לאקסל ו-CSV
 */

import React, { useState } from 'react';
import {
    IconDownload,
    IconFileSpreadsheet,
    IconFileText,
    IconCheck,
    IconX,
    IconChevronDown,
    IconChevronUp
} from '@tabler/icons-react';
import type { StudentAnalytics } from '../../services/analyticsService';
import {
    exportStudentsToExcel,
    exportStudentsToCSV,
    exportBloomReport,
    exportForMashov
} from '../../services/exportService';

interface ExportPanelProps {
    students: StudentAnalytics[];
    courseTitle: string;
    className?: string;
}

type ExportFormat = 'excel' | 'csv' | 'bloom' | 'mashov';

interface ExportOption {
    id: ExportFormat;
    label: string;
    description: string;
    icon: React.ReactNode;
    action: (students: StudentAnalytics[], filename: string) => void;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
    students,
    courseTitle,
    className = ''
}) => {
    const [isExporting, setIsExporting] = useState(false);
    const [exportedFormat, setExportedFormat] = useState<ExportFormat | null>(null);
    const [expanded, setExpanded] = useState(false);

    const sanitizedTitle = courseTitle.replace(/[^א-תa-zA-Z0-9\s]/g, '').trim();
    const dateStr = new Date().toLocaleDateString('he-IL').replace(/\//g, '-');

    const exportOptions: ExportOption[] = [
        {
            id: 'excel',
            label: 'Excel מלא',
            description: 'כל הנתונים כולל Bloom ומוטיבציה',
            icon: <IconFileSpreadsheet className="w-5 h-5" />,
            action: (s, f) => exportStudentsToExcel(s, `${f}.xlsx`)
        },
        {
            id: 'csv',
            label: 'CSV פשוט',
            description: 'נתונים בסיסיים - תואם לכל תוכנה',
            icon: <IconFileText className="w-5 h-5" />,
            action: (s, f) => exportStudentsToCSV(s, `${f}.csv`)
        },
        {
            id: 'bloom',
            label: 'דוח Bloom',
            description: 'ניתוח מפורט לפי רמות בלום',
            icon: <IconFileSpreadsheet className="w-5 h-5" />,
            action: (s, f) => exportBloomReport(s, `${f}_bloom.xlsx`)
        },
        {
            id: 'mashov',
            label: 'תואם מש"וב',
            description: 'פורמט מוכן להעלאה למש"וב',
            icon: <IconFileSpreadsheet className="w-5 h-5" />,
            action: (s, f) => exportForMashov(s, `${f}_mashov.xlsx`)
        }
    ];

    const handleExport = async (option: ExportOption) => {
        setIsExporting(true);
        setExportedFormat(null);

        try {
            const filename = `${sanitizedTitle}_${dateStr}`;
            option.action(students, filename);
            setExportedFormat(option.id);

            // Clear success message after 3 seconds
            setTimeout(() => setExportedFormat(null), 3000);
        } catch (err) {
            console.error('Export failed:', err);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className={`bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden ${className}`}>
            {/* Header */}
            <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <IconDownload className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">ייצוא נתונים</h3>
                        <p className="text-xs text-slate-500">
                            {students.length} תלמידים | {courseTitle}
                        </p>
                    </div>
                </div>

                <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    {expanded ? (
                        <IconChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                        <IconChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                </button>
            </div>

            {/* Export Options */}
            {expanded && (
                <div className="p-4 pt-0 grid grid-cols-2 gap-3">
                    {exportOptions.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => handleExport(option)}
                            disabled={isExporting}
                            className={`
                                relative p-4 rounded-xl border-2 text-right transition-all
                                ${exportedFormat === option.id
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'
                                }
                                ${isExporting ? 'opacity-50 cursor-wait' : ''}
                            `}
                        >
                            {/* Success indicator */}
                            {exportedFormat === option.id && (
                                <div className="absolute top-2 left-2">
                                    <IconCheck className="w-5 h-5 text-green-500" />
                                </div>
                            )}

                            <div className="flex items-start gap-3">
                                <span className="text-emerald-600">
                                    {option.icon}
                                </span>
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">
                                        {option.label}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                        {option.description}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// Compact export button for toolbar
interface ExportButtonProps {
    students: StudentAnalytics[];
    courseTitle: string;
    format?: 'excel' | 'csv';
}

export const ExportButton: React.FC<ExportButtonProps> = ({
    students,
    courseTitle,
    format = 'excel'
}) => {
    const [isExporting, setIsExporting] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);

        try {
            const sanitizedTitle = courseTitle.replace(/[^א-תa-zA-Z0-9\s]/g, '').trim();
            const dateStr = new Date().toLocaleDateString('he-IL').replace(/\//g, '-');
            const filename = `${sanitizedTitle}_${dateStr}`;

            if (format === 'excel') {
                exportStudentsToExcel(students, `${filename}.xlsx`);
            } else {
                exportStudentsToCSV(students, `${filename}.csv`);
            }

            setSuccess(true);
            setTimeout(() => setSuccess(false), 2000);
        } catch (err) {
            console.error('Export failed:', err);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <button
            onClick={handleExport}
            disabled={isExporting}
            className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all
                ${success
                    ? 'bg-green-500 text-white'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                }
                ${isExporting ? 'opacity-50 cursor-wait' : ''}
            `}
        >
            {success ? (
                <>
                    <IconCheck className="w-4 h-4" />
                    הורד!
                </>
            ) : (
                <>
                    <IconDownload className="w-4 h-4" />
                    {isExporting ? 'מייצא...' : `ייצוא ${format === 'excel' ? 'Excel' : 'CSV'}`}
                </>
            )}
        </button>
    );
};

// Dropdown export menu
interface ExportDropdownProps {
    students: StudentAnalytics[];
    courseTitle: string;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
    students,
    courseTitle
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [lastExport, setLastExport] = useState<string | null>(null);

    const sanitizedTitle = courseTitle.replace(/[^א-תa-zA-Z0-9\s]/g, '').trim();
    const dateStr = new Date().toLocaleDateString('he-IL').replace(/\//g, '-');
    const filename = `${sanitizedTitle}_${dateStr}`;

    const options = [
        { id: 'excel', label: 'Excel מלא', fn: () => exportStudentsToExcel(students, `${filename}.xlsx`) },
        { id: 'csv', label: 'CSV', fn: () => exportStudentsToCSV(students, `${filename}.csv`) },
        { id: 'bloom', label: 'דוח Bloom', fn: () => exportBloomReport(students, `${filename}_bloom.xlsx`) },
        { id: 'mashov', label: 'תואם מש"וב', fn: () => exportForMashov(students, `${filename}_mashov.xlsx`) }
    ];

    const handleExport = (option: typeof options[0]) => {
        option.fn();
        setLastExport(option.id);
        setTimeout(() => setLastExport(null), 2000);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-200 transition-colors"
            >
                <IconDownload className="w-4 h-4" />
                ייצוא
                <IconChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute top-full left-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-20 min-w-[180px] overflow-hidden">
                        {options.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => handleExport(option)}
                                className={`
                                    w-full px-4 py-3 text-right text-sm hover:bg-slate-50 transition-colors
                                    flex items-center justify-between
                                    ${lastExport === option.id ? 'bg-green-50' : ''}
                                `}
                            >
                                <span className="font-medium text-slate-700">{option.label}</span>
                                {lastExport === option.id && (
                                    <IconCheck className="w-4 h-4 text-green-500" />
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ExportPanel;
