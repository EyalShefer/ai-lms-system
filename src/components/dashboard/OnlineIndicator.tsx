/**
 * Online Indicator Component
 * נקודה ירוקה פועמת לסימון תלמידים מחוברים בזמן אמת
 */

import React from 'react';
import type { PresenceData } from '../../services/presenceService';

interface OnlineIndicatorProps {
    isOnline: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    lastSeen?: number;
    className?: string;
}

// Size configurations
const SIZE_CONFIG = {
    xs: { dot: 'w-2 h-2', label: 'text-[10px]' },
    sm: { dot: 'w-2.5 h-2.5', label: 'text-xs' },
    md: { dot: 'w-3 h-3', label: 'text-sm' },
    lg: { dot: 'w-4 h-4', label: 'text-base' }
};

/**
 * פורמט זמן יחסי
 */
const formatLastSeen = (timestamp: number): string => {
    if (!timestamp) return '';

    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'עכשיו';
    if (diff < 3600000) return `לפני ${Math.floor(diff / 60000)} דקות`;
    if (diff < 86400000) return `לפני ${Math.floor(diff / 3600000)} שעות`;
    return `לפני ${Math.floor(diff / 86400000)} ימים`;
};

export const OnlineIndicator: React.FC<OnlineIndicatorProps> = ({
    isOnline,
    size = 'sm',
    showLabel = false,
    lastSeen,
    className = ''
}) => {
    const config = SIZE_CONFIG[size];

    return (
        <span className={`inline-flex items-center gap-1.5 ${className}`}>
            {/* Dot */}
            <span className="relative">
                <span
                    className={`
                        block rounded-full transition-colors
                        ${config.dot}
                        ${isOnline ? 'bg-green-500' : 'bg-slate-300'}
                    `}
                />
                {/* Pulse animation for online */}
                {isOnline && (
                    <span
                        className={`
                            absolute inset-0 rounded-full bg-green-400
                            animate-ping opacity-75
                            ${config.dot}
                        `}
                    />
                )}
            </span>

            {/* Label */}
            {showLabel && (
                <span className={`${config.label} ${isOnline ? 'text-green-600' : 'text-slate-400'}`}>
                    {isOnline ? 'מחובר/ת' : lastSeen ? formatLastSeen(lastSeen) : 'לא מחובר/ת'}
                </span>
            )}
        </span>
    );
};

// Presence-based indicator
interface PresenceIndicatorProps {
    presence: PresenceData | null;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    showActivity?: boolean;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
    presence,
    size = 'sm',
    showActivity = false
}) => {
    const isOnline = presence?.online || false;

    return (
        <span className="inline-flex items-center gap-2">
            <OnlineIndicator
                isOnline={isOnline}
                size={size}
                showLabel
                lastSeen={presence?.lastSeen}
            />

            {/* Activity indicator */}
            {showActivity && isOnline && presence?.currentActivity && (
                <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {presence.currentActivity}
                </span>
            )}
        </span>
    );
};

// Online count badge
interface OnlineCountBadgeProps {
    onlineCount: number;
    totalCount: number;
    size?: 'sm' | 'md' | 'lg';
}

export const OnlineCountBadge: React.FC<OnlineCountBadgeProps> = ({
    onlineCount,
    totalCount,
    size = 'md'
}) => {
    const percentage = totalCount > 0 ? Math.round((onlineCount / totalCount) * 100) : 0;

    const sizeClasses = {
        sm: 'text-xs px-2 py-1',
        md: 'text-sm px-3 py-1.5',
        lg: 'text-base px-4 py-2'
    };

    return (
        <span className={`
            inline-flex items-center gap-2 rounded-full font-bold
            ${sizeClasses[size]}
            ${onlineCount > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}
        `}>
            <OnlineIndicator isOnline={onlineCount > 0} size="sm" />
            <span>{onlineCount}/{totalCount}</span>
            <span className="text-slate-400 font-normal">({percentage}%)</span>
        </span>
    );
};

// Student list item with online indicator
interface OnlineStudentItemProps {
    name: string;
    avatar?: string;
    isOnline: boolean;
    lastSeen?: number;
    currentActivity?: string;
    onClick?: () => void;
}

export const OnlineStudentItem: React.FC<OnlineStudentItemProps> = ({
    name,
    avatar,
    isOnline,
    lastSeen,
    currentActivity,
    onClick
}) => {
    return (
        <div
            onClick={onClick}
            className={`
                flex items-center gap-3 p-3 rounded-xl transition-all
                ${onClick ? 'cursor-pointer hover:bg-slate-50' : ''}
                ${isOnline ? 'bg-green-50/50' : ''}
            `}
        >
            {/* Avatar with indicator */}
            <div className="relative">
                {avatar ? (
                    <img
                        src={avatar}
                        alt={name}
                        className="w-10 h-10 rounded-full object-cover"
                    />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                        {name.charAt(0)}
                    </div>
                )}
                {/* Online dot */}
                <span className="absolute -bottom-0.5 -right-0.5">
                    <OnlineIndicator isOnline={isOnline} size="sm" />
                </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 truncate">{name}</div>
                <div className="text-xs text-slate-500">
                    {isOnline ? (
                        currentActivity ? (
                            <span className="text-green-600">{currentActivity}</span>
                        ) : (
                            <span className="text-green-600">מחובר/ת עכשיו</span>
                        )
                    ) : lastSeen ? (
                        formatLastSeen(lastSeen)
                    ) : (
                        'לא מחובר/ת'
                    )}
                </div>
            </div>
        </div>
    );
};

// Hook for using presence in table
export const useOnlineStatus = (isOnline: boolean, lastSeen?: number) => {
    return {
        indicator: <OnlineIndicator isOnline={isOnline} size="xs" />,
        status: isOnline ? 'online' : 'offline',
        lastSeenText: lastSeen ? formatLastSeen(lastSeen) : null
    };
};

export default OnlineIndicator;
