import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
    IconBolt,
    IconPhoto,
    IconMicrophone,
    IconBroadcast,
    IconTrendingUp,
    IconAlertTriangle,
    IconClock,
    IconSparkles,
} from '@tabler/icons-react';

interface UsageBarProps {
    label: string;
    used: number;
    limit: number;
    percent: number;
    icon: React.ReactNode;
    formatValue?: (value: number) => string;
}

const UsageBar: React.FC<UsageBarProps> = ({
    label,
    used,
    limit,
    percent,
    icon,
    formatValue = (v) => v.toLocaleString(),
}) => {
    const isUnlimited = limit === Number.MAX_SAFE_INTEGER;
    const barColor = percent >= 95 ? 'bg-red-500' :
                     percent >= 80 ? 'bg-amber-500' :
                     'bg-blue-500';

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-700">
                    {icon}
                    <span>{label}</span>
                </div>
                <span className="text-slate-500">
                    {formatValue(used)} / {isUnlimited ? '∞' : formatValue(limit)}
                </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${isUnlimited ? 0 : Math.min(percent, 100)}%` }}
                />
            </div>
        </div>
    );
};

interface TeacherUsageWidgetProps {
    className?: string;
    compact?: boolean;
}

export const TeacherUsageWidget: React.FC<TeacherUsageWidgetProps> = ({
    className = '',
    compact = false,
}) => {
    const { usageStats, refreshUsageStats } = useAuth();

    if (!usageStats) {
        return (
            <div className={`bg-white rounded-xl p-4 ${className}`}>
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-2 bg-slate-200 rounded" />
                    <div className="h-2 bg-slate-200 rounded" />
                </div>
            </div>
        );
    }

    const { usage, tier, resetDate } = usageStats;
    const daysUntilReset = Math.ceil((new Date(resetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    // Check if any quota is at risk
    const isAtRisk = usage.textTokens.percent >= 80 ||
                     usage.images.percent >= 80 ||
                     usage.audio.percent >= 80;

    const tierNames: Record<string, string> = {
        free: 'חינמי',
        basic: 'בסיסי',
        pro: 'מקצועי',
        enterprise: 'ארגוני',
    };

    const tierColors: Record<string, string> = {
        free: 'bg-slate-100 text-slate-700',
        basic: 'bg-blue-100 text-blue-700',
        pro: 'bg-purple-100 text-purple-700',
        enterprise: 'bg-amber-100 text-amber-700',
    };

    if (compact) {
        // Compact version for header/sidebar
        return (
            <div className={`flex items-center gap-3 ${className}`} dir="rtl">
                <div className="flex items-center gap-2">
                    <IconBolt className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-slate-600">
                        {usage.textTokens.percent}%
                    </span>
                </div>
                {isAtRisk && (
                    <IconAlertTriangle className="w-4 h-4 text-amber-500" />
                )}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tierColors[tier]}`}>
                    {tierNames[tier]}
                </span>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`} dir="rtl">
            {/* Header */}
            <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <IconTrendingUp className="w-5 h-5 text-blue-500" />
                        <h3 className="font-semibold text-slate-800">שימוש חודשי</h3>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${tierColors[tier]}`}>
                        {tierNames[tier]}
                    </span>
                </div>
            </div>

            {/* Usage Bars */}
            <div className="p-4 space-y-4">
                <UsageBar
                    label="טוקנים"
                    used={usage.textTokens.used}
                    limit={usage.textTokens.limit}
                    percent={usage.textTokens.percent}
                    icon={<IconBolt className="w-4 h-4 text-blue-500" />}
                />

                <UsageBar
                    label="תמונות"
                    used={usage.images.used}
                    limit={usage.images.limit}
                    percent={usage.images.percent}
                    icon={<IconPhoto className="w-4 h-4 text-green-500" />}
                />

                <UsageBar
                    label="דקות אודיו"
                    used={usage.audio.used}
                    limit={usage.audio.limit}
                    percent={usage.audio.percent}
                    icon={<IconMicrophone className="w-4 h-4 text-purple-500" />}
                    formatValue={(v) => v.toFixed(1)}
                />

                <UsageBar
                    label="פודקאסטים"
                    used={usage.podcasts.used}
                    limit={usage.podcasts.limit}
                    percent={usage.podcasts.percent}
                    icon={<IconBroadcast className="w-4 h-4 text-amber-500" />}
                />
            </div>

            {/* Warning Banner */}
            {isAtRisk && (
                <div className="mx-4 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <IconAlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-amber-800">מתקרב למכסה</p>
                            <p className="text-xs text-amber-600">
                                השימוש שלך מתקרב למכסה החודשית. שקול לשדרג את התוכנית.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="px-4 py-3 bg-slate-50 rounded-b-xl border-t border-slate-100">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-slate-500">
                        <IconClock className="w-4 h-4" />
                        <span>איפוס בעוד {daysUntilReset} ימים</span>
                    </div>
                    {tier !== 'enterprise' && (
                        <button
                            onClick={() => {/* TODO: Navigate to pricing */}}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                        >
                            <IconSparkles className="w-4 h-4" />
                            שדרג
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeacherUsageWidget;
