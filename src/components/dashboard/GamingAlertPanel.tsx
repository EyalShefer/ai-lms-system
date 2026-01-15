/**
 * Gaming Alert Panel Component
 * תצוגת התראות Gaming - זיהוי דפוסים חשודים בהגשות תלמידים
 */

import React, { useState } from 'react';
import {
    analyzeSubmissionForGaming,
    type GamingAnalysis,
    type GamingAlert,
    GAMING_LABELS_HE,
    GAMING_DESCRIPTIONS_HE
} from '../../services/gamingDetectionService';
import type { StudentTaskSubmission } from '../../shared/types/courseTypes';
import {
    IconAlertTriangle,
    IconChevronDown,
    IconChevronUp,
    IconBolt,
    IconClick,
    IconCopy,
    IconExternalLink,
    IconEye,
    IconX
} from '@tabler/icons-react';

interface GamingAlertPanelProps {
    analysis: GamingAnalysis;
    studentName: string;
    onDismiss?: () => void;
    onViewDetails?: () => void;
    compact?: boolean;
}

// Icon mapping for gaming types
const GAMING_ICONS: Record<string, React.ReactNode> = {
    quick_skip: <IconBolt className="w-4 h-4" />,
    random_click: <IconClick className="w-4 h-4" />,
    pattern_response: <IconCopy className="w-4 h-4" />,
    copy_paste: <IconCopy className="w-4 h-4" />,
    tab_switching: <IconExternalLink className="w-4 h-4" />
};

// Risk level colors
const RISK_COLORS = {
    none: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
    low: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    medium: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
};

export const GamingAlertPanel: React.FC<GamingAlertPanelProps> = ({
    analysis,
    studentName,
    onDismiss,
    onViewDetails,
    compact = false
}) => {
    const [isExpanded, setIsExpanded] = useState(!compact);

    if (!analysis.hasGaming) {
        return null;
    }

    const colors = RISK_COLORS[analysis.overallRisk];

    return (
        <div className={`${colors.bg} rounded-2xl border ${colors.border} overflow-hidden`}>
            {/* Header */}
            <div
                className={`p-4 flex items-center justify-between cursor-pointer ${compact ? 'hover:bg-white/50' : ''}`}
                onClick={() => compact && setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${colors.bg} ${colors.text}`}>
                        <IconAlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <div className={`font-bold ${colors.text} flex items-center gap-2`}>
                            התראת Gaming - {studentName}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} border ${colors.border}`}>
                                סיכון {analysis.overallRisk === 'high' ? 'גבוה' : analysis.overallRisk === 'medium' ? 'בינוני' : 'נמוך'}
                            </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">{analysis.summary}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {onViewDetails && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
                            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                            title="צפה בפרטים"
                        >
                            <IconEye className="w-4 h-4 text-slate-500" />
                        </button>
                    )}
                    {onDismiss && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                            title="התעלם"
                        >
                            <IconX className="w-4 h-4 text-slate-500" />
                        </button>
                    )}
                    {compact && (
                        isExpanded
                            ? <IconChevronUp className="w-4 h-4 text-slate-400" />
                            : <IconChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                    {/* Alert Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {analysis.alerts.map((alert, idx) => (
                            <div
                                key={idx}
                                className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`p-1.5 rounded-lg ${
                                        alert.severity === 'high' ? 'bg-red-100 text-red-600' :
                                        alert.severity === 'medium' ? 'bg-orange-100 text-orange-600' :
                                        'bg-amber-100 text-amber-600'
                                    }`}>
                                        {GAMING_ICONS[alert.type]}
                                    </span>
                                    <div>
                                        <div className="font-bold text-sm text-slate-700">
                                            {GAMING_LABELS_HE[alert.type]}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            ביטחון: {Math.round(alert.confidence * 100)}%
                                        </div>
                                    </div>
                                </div>

                                <p className="text-xs text-slate-500 mb-2">
                                    {GAMING_DESCRIPTIONS_HE[alert.type]}
                                </p>

                                {/* Evidence */}
                                <div className="space-y-1">
                                    {alert.evidence.map((ev, evIdx) => (
                                        <div key={evIdx} className="text-xs bg-slate-50 px-2 py-1 rounded text-slate-600">
                                            • {ev}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Recommendation */}
                    <div className="bg-white/80 rounded-xl p-3 border border-slate-200">
                        <div className="text-xs font-bold text-slate-700 mb-1">💡 המלצה:</div>
                        <p className="text-sm text-slate-600">
                            {analysis.overallRisk === 'high'
                                ? 'מומלץ לשוחח עם התלמיד ולוודא שהוא מבין את החומר. ייתכן שהתלמיד מרגיש לחץ או קושי.'
                                : analysis.overallRisk === 'medium'
                                ? 'כדאי לעקוב אחרי הביצועים בהגשות הבאות ולוודא שהתלמיד מתמודד עם החומר.'
                                : 'עקוב אחרי הדפוס ובדוק אם הוא חוזר בהגשות נוספות.'
                            }
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

// Compact badge for student list
interface GamingAlertBadgeProps {
    analysis: GamingAnalysis | null;
    size?: 'sm' | 'md';
}

export const GamingAlertBadge: React.FC<GamingAlertBadgeProps> = ({
    analysis,
    size = 'sm'
}) => {
    if (!analysis?.hasGaming) return null;

    const colors = RISK_COLORS[analysis.overallRisk];
    const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';

    return (
        <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
            <IconAlertTriangle className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
            {analysis.alerts.length}
        </span>
    );
};

// Helper hook to analyze submission
export const useGamingAnalysis = (submission?: StudentTaskSubmission): GamingAnalysis | null => {
    if (!submission) return null;
    return analyzeSubmissionForGaming(submission);
};

export default GamingAlertPanel;
