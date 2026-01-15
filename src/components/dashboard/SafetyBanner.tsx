/**
 * Safety Banner Component
 * באנר אדום full-width להתראות בטיחות חמורות
 */

import React, { useState } from 'react';
import {
    IconAlertTriangle,
    IconX,
    IconChevronDown,
    IconChevronUp,
    IconPhone,
    IconMail,
    IconEye,
    IconShieldExclamation
} from '@tabler/icons-react';

// Alert types
export type SafetyAlertType = 'distress' | 'inappropriate' | 'pii' | 'bullying' | 'self_harm';

export type SafetyAlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SafetyAlert {
    id: string;
    studentId: string;
    studentName: string;
    type: SafetyAlertType;
    severity: SafetyAlertSeverity;
    content: string;
    matchedPattern?: string;
    timestamp: number;
    isResolved?: boolean;
    resolvedBy?: string;
    resolvedAt?: number;
}

interface SafetyBannerProps {
    alerts: SafetyAlert[];
    onDismiss?: (alertId: string) => void;
    onViewDetails?: (alert: SafetyAlert) => void;
    onMarkResolved?: (alertId: string) => void;
}

// Type labels and colors
const TYPE_CONFIG: Record<SafetyAlertType, {
    label: string;
    icon: React.ReactNode;
    description: string;
}> = {
    distress: {
        label: 'מצוקה נפשית',
        icon: <IconShieldExclamation className="w-full h-full" />,
        description: 'זוהה תוכן המעיד על מצוקה או סכנה'
    },
    self_harm: {
        label: 'פגיעה עצמית',
        icon: <IconAlertTriangle className="w-full h-full" />,
        description: 'זוהה תוכן המעיד על כוונה לפגיעה עצמית'
    },
    inappropriate: {
        label: 'שפה לא הולמת',
        icon: <IconAlertTriangle className="w-full h-full" />,
        description: 'זוהו ביטויים לא הולמים'
    },
    bullying: {
        label: 'בריונות',
        icon: <IconAlertTriangle className="w-full h-full" />,
        description: 'זוהה תוכן שעשוי להצביע על בריונות'
    },
    pii: {
        label: 'מידע אישי',
        icon: <IconShieldExclamation className="w-full h-full" />,
        description: 'נמצא ניסיון לחשיפת מידע אישי רגיש'
    }
};

const SEVERITY_CONFIG: Record<SafetyAlertSeverity, {
    label: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
}> = {
    critical: {
        label: 'קריטי',
        bgColor: 'bg-red-600',
        borderColor: 'border-red-700',
        textColor: 'text-white'
    },
    high: {
        label: 'גבוה',
        bgColor: 'bg-red-500',
        borderColor: 'border-red-600',
        textColor: 'text-white'
    },
    medium: {
        label: 'בינוני',
        bgColor: 'bg-orange-500',
        borderColor: 'border-orange-600',
        textColor: 'text-white'
    },
    low: {
        label: 'נמוך',
        bgColor: 'bg-amber-500',
        borderColor: 'border-amber-600',
        textColor: 'text-white'
    }
};

export const SafetyBanner: React.FC<SafetyBannerProps> = ({
    alerts,
    onDismiss,
    onViewDetails,
    onMarkResolved
}) => {
    const [expanded, setExpanded] = useState(false);

    // Filter only unresolved, high severity alerts
    const criticalAlerts = alerts.filter(
        a => !a.isResolved && (a.severity === 'critical' || a.severity === 'high')
    );

    if (criticalAlerts.length === 0) {
        return null;
    }

    const primaryAlert = criticalAlerts[0];
    const config = SEVERITY_CONFIG[primaryAlert.severity];
    const typeConfig = TYPE_CONFIG[primaryAlert.type];

    return (
        <div className={`
            ${config.bgColor} ${config.borderColor} ${config.textColor}
            border-2 rounded-xl shadow-lg overflow-hidden
            animate-pulse-slow
        `}>
            {/* Main Banner */}
            <div className="p-4">
                <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        {typeConfig.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-lg">
                                התראת בטיחות {primaryAlert.severity === 'critical' ? 'חמורה' : ''}
                            </span>
                            <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">
                                {config.label}
                            </span>
                        </div>

                        <p className="text-white/90 text-sm">
                            זוהה תוכן מדאיג מ<strong>{primaryAlert.studentName}</strong>: {typeConfig.description}
                        </p>

                        {criticalAlerts.length > 1 && (
                            <p className="text-white/70 text-xs mt-1">
                                + {criticalAlerts.length - 1} התראות נוספות
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 flex items-center gap-2">
                        <button
                            onClick={() => onViewDetails?.(primaryAlert)}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                            title="צפה בפרטים"
                        >
                            <IconEye className="w-5 h-5" />
                        </button>

                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                        >
                            {expanded ? <IconChevronUp className="w-5 h-5" /> : <IconChevronDown className="w-5 h-5" />}
                        </button>

                        {onDismiss && (
                            <button
                                onClick={() => onDismiss(primaryAlert.id)}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                title="סגור"
                            >
                                <IconX className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="border-t border-white/20 bg-white/10 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {criticalAlerts.map(alert => (
                            <div
                                key={alert.id}
                                className="bg-white/10 rounded-xl p-4"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold">{alert.studentName}</span>
                                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                        {TYPE_CONFIG[alert.type].label}
                                    </span>
                                </div>

                                <p className="text-sm text-white/80 mb-3 line-clamp-2">
                                    {alert.content}
                                </p>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onViewDetails?.(alert)}
                                        className="flex-1 py-1.5 bg-white text-red-600 rounded-lg text-xs font-bold hover:bg-white/90 transition-colors"
                                    >
                                        צפה במלא
                                    </button>
                                    {onMarkResolved && (
                                        <button
                                            onClick={() => onMarkResolved(alert.id)}
                                            className="flex-1 py-1.5 bg-white/20 rounded-lg text-xs font-bold hover:bg-white/30 transition-colors"
                                        >
                                            סמן כטופל
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Emergency Contacts */}
                    <div className="mt-4 pt-4 border-t border-white/20">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">צריך עזרה?</span>
                            <div className="flex items-center gap-3">
                                <a
                                    href="tel:1201"
                                    className="flex items-center gap-1 px-3 py-1.5 bg-white text-red-600 rounded-lg text-xs font-bold hover:bg-white/90 transition-colors"
                                >
                                    <IconPhone className="w-4 h-4" />
                                    ער״ן - 1201
                                </a>
                                <a
                                    href="tel:*2727"
                                    className="flex items-center gap-1 px-3 py-1.5 bg-white text-red-600 rounded-lg text-xs font-bold hover:bg-white/90 transition-colors"
                                >
                                    <IconPhone className="w-4 h-4" />
                                    עמותת לב״ב
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Single alert card for list view
interface SafetyAlertCardProps {
    alert: SafetyAlert;
    onView?: () => void;
    onResolve?: () => void;
}

export const SafetyAlertCard: React.FC<SafetyAlertCardProps> = ({
    alert,
    onView,
    onResolve
}) => {
    const severity = SEVERITY_CONFIG[alert.severity];
    const type = TYPE_CONFIG[alert.type];

    return (
        <div className={`
            rounded-xl border-2 overflow-hidden
            ${alert.isResolved ? 'opacity-50' : ''}
            ${alert.severity === 'critical' ? 'border-red-300 bg-red-50' :
                alert.severity === 'high' ? 'border-orange-300 bg-orange-50' :
                    'border-amber-300 bg-amber-50'}
        `}>
            <div className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className={`
                            w-8 h-8 rounded-lg flex items-center justify-center
                            ${alert.severity === 'critical' ? 'bg-red-200 text-red-700' :
                                alert.severity === 'high' ? 'bg-orange-200 text-orange-700' :
                                    'bg-amber-200 text-amber-700'}
                        `}>
                            {type.icon}
                        </span>
                        <div>
                            <span className="font-bold text-slate-800">{alert.studentName}</span>
                            <span className="text-xs text-slate-500 block">
                                {new Date(alert.timestamp).toLocaleString('he-IL')}
                            </span>
                        </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${severity.bgColor} ${severity.textColor}`}>
                        {severity.label}
                    </span>
                </div>

                {/* Type badge */}
                <span className="inline-block px-2 py-0.5 bg-white rounded-full text-xs font-medium text-slate-600 mb-2">
                    {type.label}
                </span>

                {/* Content preview */}
                <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                    {alert.content}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {onView && (
                        <button
                            onClick={onView}
                            className="flex-1 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-900 transition-colors"
                        >
                            צפה בפרטים
                        </button>
                    )}
                    {onResolve && !alert.isResolved && (
                        <button
                            onClick={onResolve}
                            className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
                        >
                            סמן כטופל
                        </button>
                    )}
                </div>

                {/* Resolved indicator */}
                {alert.isResolved && (
                    <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
                        ✓ טופל ע״י {alert.resolvedBy} ב-{new Date(alert.resolvedAt || 0).toLocaleDateString('he-IL')}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SafetyBanner;
