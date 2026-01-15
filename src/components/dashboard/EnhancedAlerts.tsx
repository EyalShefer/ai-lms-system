/**
 * Enhanced Alerts Component
 * ממשק משופר להתראות עם סינון ומיון
 */

import React, { useState, useMemo } from 'react';
import {
    IconBell,
    IconBellOff,
    IconFilter,
    IconSortDescending,
    IconCheck,
    IconX,
    IconAlertTriangle,
    IconInfoCircle,
    IconUrgent,
    IconEye,
    IconChevronDown,
    IconSearch
} from '@tabler/icons-react';

// Alert types and severity
export type AlertType =
    | 'distress'
    | 'inappropriate_language'
    | 'pii'
    | 'bullying'
    | 'gaming'
    | 'low_performance'
    | 'high_risk'
    | 'system';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Alert {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    studentId?: string;
    studentName?: string;
    courseId?: string;
    timestamp: number;
    isRead: boolean;
    isResolved: boolean;
    resolvedBy?: string;
    resolvedAt?: number;
    metadata?: Record<string, unknown>;
}

interface EnhancedAlertsProps {
    alerts: Alert[];
    onMarkRead?: (alertId: string) => void;
    onMarkResolved?: (alertId: string) => void;
    onViewDetails?: (alert: Alert) => void;
    onDismiss?: (alertId: string) => void;
    className?: string;
}

// Configuration for alert types
const ALERT_TYPE_CONFIG: Record<AlertType, {
    label: string;
    icon: React.ReactNode;
    color: string;
}> = {
    distress: {
        label: 'מצוקה',
        icon: <IconUrgent className="w-full h-full" />,
        color: '#ef4444'
    },
    inappropriate_language: {
        label: 'שפה לא הולמת',
        icon: <IconAlertTriangle className="w-full h-full" />,
        color: '#f97316'
    },
    pii: {
        label: 'מידע אישי',
        icon: <IconAlertTriangle className="w-full h-full" />,
        color: '#f59e0b'
    },
    bullying: {
        label: 'בריונות',
        icon: <IconUrgent className="w-full h-full" />,
        color: '#ef4444'
    },
    gaming: {
        label: 'גיימינג',
        icon: <IconAlertTriangle className="w-full h-full" />,
        color: '#f97316'
    },
    low_performance: {
        label: 'ביצועים נמוכים',
        icon: <IconInfoCircle className="w-full h-full" />,
        color: '#3b82f6'
    },
    high_risk: {
        label: 'סיכון גבוה',
        icon: <IconUrgent className="w-full h-full" />,
        color: '#ef4444'
    },
    system: {
        label: 'מערכת',
        icon: <IconInfoCircle className="w-full h-full" />,
        color: '#6b7280'
    }
};

const SEVERITY_CONFIG: Record<AlertSeverity, {
    label: string;
    bgColor: string;
    textColor: string;
    priority: number;
}> = {
    critical: { label: 'קריטי', bgColor: 'bg-red-100', textColor: 'text-red-700', priority: 4 },
    high: { label: 'גבוה', bgColor: 'bg-orange-100', textColor: 'text-orange-700', priority: 3 },
    medium: { label: 'בינוני', bgColor: 'bg-amber-100', textColor: 'text-amber-700', priority: 2 },
    low: { label: 'נמוך', bgColor: 'bg-slate-100', textColor: 'text-slate-600', priority: 1 }
};

export const EnhancedAlerts: React.FC<EnhancedAlertsProps> = ({
    alerts,
    onMarkRead,
    onMarkResolved,
    onViewDetails,
    onDismiss,
    className = ''
}) => {
    const [filterType, setFilterType] = useState<AlertType | 'all'>('all');
    const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | 'all'>('all');
    const [showResolved, setShowResolved] = useState(false);
    const [sortBy, setSortBy] = useState<'time' | 'severity'>('severity');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Filter and sort alerts
    const filteredAlerts = useMemo(() => {
        let result = [...alerts];

        // Filter by resolved status
        if (!showResolved) {
            result = result.filter(a => !a.isResolved);
        }

        // Filter by type
        if (filterType !== 'all') {
            result = result.filter(a => a.type === filterType);
        }

        // Filter by severity
        if (filterSeverity !== 'all') {
            result = result.filter(a => a.severity === filterSeverity);
        }

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(a =>
                a.title.toLowerCase().includes(query) ||
                a.message.toLowerCase().includes(query) ||
                a.studentName?.toLowerCase().includes(query)
            );
        }

        // Sort
        if (sortBy === 'severity') {
            result.sort((a, b) =>
                SEVERITY_CONFIG[b.severity].priority - SEVERITY_CONFIG[a.severity].priority ||
                b.timestamp - a.timestamp
            );
        } else {
            result.sort((a, b) => b.timestamp - a.timestamp);
        }

        return result;
    }, [alerts, filterType, filterSeverity, showResolved, sortBy, searchQuery]);

    const unreadCount = alerts.filter(a => !a.isRead && !a.isResolved).length;
    const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.isResolved).length;

    return (
        <div className={`bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden ${className}`}>
            {/* Header */}
            <div className="p-5 border-b border-slate-100">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`
                            w-10 h-10 rounded-xl flex items-center justify-center
                            ${criticalCount > 0 ? 'bg-red-100' : 'bg-amber-100'}
                        `}>
                            <IconBell className={`w-5 h-5 ${criticalCount > 0 ? 'text-red-600' : 'text-amber-600'}`} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">התראות</h3>
                            <p className="text-sm text-slate-500">
                                {unreadCount > 0 ? `${unreadCount} התראות חדשות` : 'אין התראות חדשות'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`
                            flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors
                            ${showFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
                        `}
                    >
                        <IconFilter className="w-4 h-4" />
                        סינון
                        <IconChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* Filters */}
                {showFilters && (
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                        {/* Search */}
                        <div className="relative">
                            <IconSearch className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="חפש התראה..."
                                className="w-full pr-10 pl-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                            />
                        </div>

                        <div className="flex flex-wrap gap-3">
                            {/* Type filter */}
                            <div>
                                <label className="text-xs font-medium text-slate-500 block mb-1">סוג</label>
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value as AlertType | 'all')}
                                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                                >
                                    <option value="all">הכל</option>
                                    {Object.entries(ALERT_TYPE_CONFIG).map(([key, config]) => (
                                        <option key={key} value={key}>{config.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Severity filter */}
                            <div>
                                <label className="text-xs font-medium text-slate-500 block mb-1">חומרה</label>
                                <select
                                    value={filterSeverity}
                                    onChange={(e) => setFilterSeverity(e.target.value as AlertSeverity | 'all')}
                                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                                >
                                    <option value="all">הכל</option>
                                    {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                                        <option key={key} value={key}>{config.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Sort */}
                            <div>
                                <label className="text-xs font-medium text-slate-500 block mb-1">מיון</label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as 'time' | 'severity')}
                                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                                >
                                    <option value="severity">לפי חומרה</option>
                                    <option value="time">לפי זמן</option>
                                </select>
                            </div>

                            {/* Show resolved */}
                            <div className="flex items-end">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showResolved}
                                        onChange={(e) => setShowResolved(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                                    />
                                    <span className="text-sm text-slate-600">הצג טופלו</span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Alerts List */}
            <div className="max-h-[500px] overflow-y-auto">
                {filteredAlerts.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <IconBellOff className="w-8 h-8 text-green-600" />
                        </div>
                        <h4 className="font-bold text-slate-700">אין התראות</h4>
                        <p className="text-sm text-slate-500 mt-1">
                            {filterType !== 'all' || filterSeverity !== 'all'
                                ? 'נסה לשנות את הסינון'
                                : 'הכל תקין!'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredAlerts.map((alert) => (
                            <AlertItem
                                key={alert.id}
                                alert={alert}
                                onMarkRead={onMarkRead}
                                onMarkResolved={onMarkResolved}
                                onViewDetails={onViewDetails}
                                onDismiss={onDismiss}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            {filteredAlerts.length > 0 && (
                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                    <span className="text-sm text-slate-500">
                        מציג {filteredAlerts.length} מתוך {alerts.length} התראות
                    </span>
                </div>
            )}
        </div>
    );
};

// Individual alert item
interface AlertItemProps {
    alert: Alert;
    onMarkRead?: (alertId: string) => void;
    onMarkResolved?: (alertId: string) => void;
    onViewDetails?: (alert: Alert) => void;
    onDismiss?: (alertId: string) => void;
}

const AlertItem: React.FC<AlertItemProps> = ({
    alert,
    onMarkRead,
    onMarkResolved,
    onViewDetails,
    onDismiss
}) => {
    const typeConfig = ALERT_TYPE_CONFIG[alert.type];
    const severityConfig = SEVERITY_CONFIG[alert.severity];

    const formatTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;

        if (diff < 60000) return 'עכשיו';
        if (diff < 3600000) return `לפני ${Math.floor(diff / 60000)} דקות`;
        if (diff < 86400000) return `לפני ${Math.floor(diff / 3600000)} שעות`;
        return new Date(timestamp).toLocaleDateString('he-IL');
    };

    return (
        <div
            className={`
                p-4 transition-colors hover:bg-slate-50
                ${!alert.isRead && !alert.isResolved ? 'bg-blue-50/50' : ''}
                ${alert.isResolved ? 'opacity-60' : ''}
            `}
        >
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: typeConfig.color + '20', color: typeConfig.color }}
                >
                    {typeConfig.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-800 text-sm truncate">
                            {alert.title}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${severityConfig.bgColor} ${severityConfig.textColor}`}>
                            {severityConfig.label}
                        </span>
                        {!alert.isRead && !alert.isResolved && (
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 mb-2">
                        {alert.message}
                    </p>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            {alert.studentName && (
                                <span>{alert.studentName}</span>
                            )}
                            <span>•</span>
                            <span>{formatTime(alert.timestamp)}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                            {onViewDetails && (
                                <button
                                    onClick={() => onViewDetails(alert)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="צפה בפרטים"
                                >
                                    <IconEye className="w-4 h-4" />
                                </button>
                            )}
                            {onMarkResolved && !alert.isResolved && (
                                <button
                                    onClick={() => onMarkResolved(alert.id)}
                                    className="p-1.5 text-green-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                    title="סמן כטופל"
                                >
                                    <IconCheck className="w-4 h-4" />
                                </button>
                            )}
                            {onDismiss && (
                                <button
                                    onClick={() => onDismiss(alert.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="מחק"
                                >
                                    <IconX className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Resolved info */}
                    {alert.isResolved && (
                        <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-400">
                            ✓ טופל ע״י {alert.resolvedBy} ב-{formatTime(alert.resolvedAt || 0)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Compact alert badge for header
interface AlertBadgeProps {
    count: number;
    criticalCount?: number;
    onClick?: () => void;
}

export const AlertBadge: React.FC<AlertBadgeProps> = ({
    count,
    criticalCount = 0,
    onClick
}) => {
    if (count === 0) return null;

    return (
        <button
            onClick={onClick}
            className={`
                relative p-2 rounded-xl transition-colors
                ${criticalCount > 0
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                }
            `}
        >
            <IconBell className="w-5 h-5" />
            <span className={`
                absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold
                flex items-center justify-center text-white
                ${criticalCount > 0 ? 'bg-red-500' : 'bg-amber-500'}
            `}>
                {count > 9 ? '9+' : count}
            </span>
        </button>
    );
};

export default EnhancedAlerts;
