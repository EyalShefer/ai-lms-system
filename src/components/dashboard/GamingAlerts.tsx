/**
 * Gaming Alerts Component
 * הצגת התראות על דפוסי "גיימינג" חשודים
 */

import React, { useState } from 'react';
import {
    analyzeSubmissionForGaming,
    GAMING_LABELS_HE,
    GAMING_DESCRIPTIONS_HE,
    type GamingAlert,
    type GamingAnalysis,
    type GamingType
} from '../../services/gamingDetectionService';
import type { StudentTaskSubmission } from '../../shared/types/courseTypes';
import {
    IconAlertTriangle,
    IconX,
    IconChevronDown,
    IconChevronUp,
    IconEye,
    IconPlayerSkipForward,
    IconClick,
    IconCopy,
    IconSwitchHorizontal
} from '@tabler/icons-react';

// Icons for each gaming type
const GAMING_ICONS: Record<GamingType, React.ReactNode> = {
    quick_skip: <IconPlayerSkipForward className="w-full h-full" />,
    random_click: <IconClick className="w-full h-full" />,
    pattern_response: <IconSwitchHorizontal className="w-full h-full" />,
    copy_paste: <IconCopy className="w-full h-full" />,
    tab_switching: <IconSwitchHorizontal className="w-full h-full" />
};

// Severity colors
const SEVERITY_COLORS = {
    low: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },
    medium: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-500' },
    high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-500' }
};

// Single Alert Card
interface GamingAlertCardProps {
    alert: GamingAlert;
    onDismiss?: () => void;
}

export const GamingAlertCard: React.FC<GamingAlertCardProps> = ({ alert, onDismiss }) => {
    const [expanded, setExpanded] = useState(false);
    const colors = SEVERITY_COLORS[alert.severity];

    return (
        <div className={`${colors.bg} ${colors.border} border rounded-xl p-4 transition-all`}>
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg} ${colors.icon}`}>
                        {GAMING_ICONS[alert.type]}
                    </span>
                    <div>
                        <div className={`font-bold ${colors.text}`}>
                            {GAMING_LABELS_HE[alert.type]}
                        </div>
                        <div className="text-xs text-slate-500">
                            רמת ביטחון: {Math.round(alert.confidence * 100)}%
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
                        {alert.severity === 'high' ? 'גבוה' : alert.severity === 'medium' ? 'בינוני' : 'נמוך'}
                    </span>

                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="p-1 hover:bg-white rounded-lg transition-colors"
                        >
                            <IconX className="w-4 h-4 text-slate-400" />
                        </button>
                    )}
                </div>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-600 mt-2">
                {GAMING_DESCRIPTIONS_HE[alert.type]}
            </p>

            {/* Evidence Toggle */}
            {alert.evidence.length > 0 && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mt-3 transition-colors"
                >
                    {expanded ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
                    {expanded ? 'הסתר פרטים' : 'הצג פרטים'}
                </button>
            )}

            {/* Evidence List */}
            {expanded && alert.evidence.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-slate-600 bg-white rounded-lg p-3">
                    {alert.evidence.map((e, i) => (
                        <li key={i} className="flex items-start gap-2">
                            <span className="text-slate-400">•</span>
                            {e}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

// Gaming Summary Panel
interface GamingSummaryProps {
    analysis: GamingAnalysis;
    studentName: string;
    onViewDetails?: () => void;
}

export const GamingSummary: React.FC<GamingSummaryProps> = ({
    analysis,
    studentName,
    onViewDetails
}) => {
    if (!analysis.hasGaming) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div className="text-green-600 font-bold">✓ לא זוהו דפוסים חשודים</div>
                <p className="text-xs text-green-500 mt-1">
                    ההגשה של {studentName} נראית לגיטימית
                </p>
            </div>
        );
    }

    const riskColors = {
        none: 'bg-green-50 border-green-200 text-green-700',
        low: 'bg-amber-50 border-amber-200 text-amber-700',
        medium: 'bg-orange-50 border-orange-200 text-orange-700',
        high: 'bg-red-50 border-red-200 text-red-700'
    };

    return (
        <div className={`${riskColors[analysis.overallRisk]} border rounded-xl p-4`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <IconAlertTriangle className="w-5 h-5" />
                    <span className="font-bold">
                        זוהו {analysis.alerts.length} דפוסים חשודים
                    </span>
                </div>

                {onViewDetails && (
                    <button
                        onClick={onViewDetails}
                        className="flex items-center gap-1 text-xs hover:underline"
                    >
                        <IconEye className="w-4 h-4" />
                        פרטים
                    </button>
                )}
            </div>

            {/* Alert Types */}
            <div className="flex flex-wrap gap-2">
                {analysis.alerts.map((alert, i) => (
                    <span
                        key={i}
                        className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-lg text-xs border"
                    >
                        <span className="w-4 h-4">{GAMING_ICONS[alert.type]}</span>
                        {GAMING_LABELS_HE[alert.type]}
                    </span>
                ))}
            </div>

            {/* Summary */}
            <p className="text-xs mt-3 opacity-80">{analysis.summary}</p>
        </div>
    );
};

// Full Gaming Analysis Panel
interface GamingAnalysisPanelProps {
    submission: StudentTaskSubmission;
    studentName: string;
    onClose?: () => void;
}

export const GamingAnalysisPanel: React.FC<GamingAnalysisPanelProps> = ({
    submission,
    studentName,
    onClose
}) => {
    const analysis = analyzeSubmissionForGaming(submission);

    return (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-slate-50 to-white flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <IconAlertTriangle className="w-5 h-5 text-amber-500" />
                        ניתוח Gaming - {studentName}
                    </h3>
                    <p className="text-sm text-slate-500">
                        זיהוי דפוסים חשודים בהגשה
                    </p>
                </div>

                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <IconX className="w-5 h-5 text-slate-400" />
                    </button>
                )}
            </div>

            {/* Overall Risk */}
            <div className="p-5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">רמת סיכון כוללת:</span>
                    <span className={`
                        px-4 py-1.5 rounded-full font-bold text-sm
                        ${analysis.overallRisk === 'high' ? 'bg-red-100 text-red-700' :
                            analysis.overallRisk === 'medium' ? 'bg-orange-100 text-orange-700' :
                                analysis.overallRisk === 'low' ? 'bg-amber-100 text-amber-700' :
                                    'bg-green-100 text-green-700'}
                    `}>
                        {analysis.overallRisk === 'high' ? 'גבוה' :
                            analysis.overallRisk === 'medium' ? 'בינוני' :
                                analysis.overallRisk === 'low' ? 'נמוך' : 'תקין'}
                    </span>
                </div>
            </div>

            {/* Alerts */}
            <div className="p-5">
                {analysis.hasGaming ? (
                    <div className="space-y-3">
                        {analysis.alerts.map((alert, i) => (
                            <GamingAlertCard key={i} alert={alert} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">✓</span>
                        </div>
                        <h4 className="font-bold text-green-700 text-lg">הגשה תקינה</h4>
                        <p className="text-sm text-slate-500 mt-1">
                            לא זוהו דפוסים חשודים בהגשה זו
                        </p>
                    </div>
                )}
            </div>

            {/* Recommendations */}
            {analysis.hasGaming && (
                <div className="p-5 bg-slate-50 border-t border-slate-100">
                    <h4 className="font-bold text-slate-700 mb-3">המלצות</h4>
                    <ul className="space-y-2 text-sm text-slate-600">
                        {analysis.overallRisk === 'high' && (
                            <li className="flex items-start gap-2">
                                <span className="text-red-500">•</span>
                                מומלץ לזמן את התלמיד לשיחה אישית
                            </li>
                        )}
                        {analysis.alerts.some(a => a.type === 'quick_skip') && (
                            <li className="flex items-start gap-2">
                                <span className="text-amber-500">•</span>
                                יש לבדוק האם התלמיד מבין את החומר
                            </li>
                        )}
                        {analysis.alerts.some(a => a.type === 'tab_switching') && (
                            <li className="flex items-start gap-2">
                                <span className="text-orange-500">•</span>
                                שקול לנהל מבחן מפוקח בעתיד
                            </li>
                        )}
                        <li className="flex items-start gap-2">
                            <span className="text-slate-400">•</span>
                            צפה בתמליל המלא של ההגשה לפני הסקת מסקנות
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default GamingAlertCard;
