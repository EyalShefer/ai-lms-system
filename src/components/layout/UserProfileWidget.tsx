/**
 * User Profile Widget
 * וידג'ט פרופיל משתמש עם dropdown
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    IconUser,
    IconSettings,
    IconLogout,
    IconChevronDown,
    IconBell,
    IconMoon,
    IconSun,
    IconHelp,
    IconMail
} from '@tabler/icons-react';

interface UserProfileWidgetProps {
    user: {
        name: string;
        email: string;
        avatar?: string;
        role?: string;
    };
    onSettings?: () => void;
    onLogout?: () => void;
    onHelp?: () => void;
    alertCount?: number;
    theme?: 'light' | 'dark';
    onToggleTheme?: () => void;
    className?: string;
}

export const UserProfileWidget: React.FC<UserProfileWidgetProps> = ({
    user,
    onSettings,
    onLogout,
    onHelp,
    alertCount = 0,
    theme = 'light',
    onToggleTheme,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-3 p-2 rounded-xl transition-colors
                    ${isOpen ? 'bg-slate-100' : 'hover:bg-slate-50'}
                `}
            >
                {/* Avatar */}
                {user.avatar ? (
                    <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-9 h-9 rounded-full object-cover"
                    />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                        {user.name.charAt(0)}
                    </div>
                )}

                {/* Name */}
                <div className="text-right hidden sm:block">
                    <div className="font-bold text-slate-700 text-sm">{user.name}</div>
                    <div className="text-xs text-slate-500">{user.role || 'מורה'}</div>
                </div>

                <IconChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />

                {/* Alert badge */}
                {alertCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                        {alertCount > 9 ? '9+' : alertCount}
                    </span>
                )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* User Info Header */}
                    <div className="p-4 bg-slate-50 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            {user.avatar ? (
                                <img
                                    src={user.avatar}
                                    alt={user.name}
                                    className="w-12 h-12 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
                                    {user.name.charAt(0)}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-800 truncate">{user.name}</div>
                                <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                                    <IconMail className="w-3 h-3" />
                                    {user.email}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="p-2">
                        {/* Theme Toggle */}
                        {onToggleTheme && (
                            <button
                                onClick={() => {
                                    onToggleTheme();
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                {theme === 'light' ? (
                                    <IconMoon className="w-5 h-5" />
                                ) : (
                                    <IconSun className="w-5 h-5" />
                                )}
                                <span className="font-medium">
                                    {theme === 'light' ? 'מצב כהה' : 'מצב בהיר'}
                                </span>
                            </button>
                        )}

                        {/* Alerts */}
                        {alertCount > 0 && (
                            <button className="w-full flex items-center justify-between p-3 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors">
                                <div className="flex items-center gap-3">
                                    <IconBell className="w-5 h-5" />
                                    <span className="font-medium">התראות</span>
                                </div>
                                <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-bold">
                                    {alertCount}
                                </span>
                            </button>
                        )}

                        {/* Settings */}
                        {onSettings && (
                            <button
                                onClick={() => {
                                    onSettings();
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                <IconSettings className="w-5 h-5" />
                                <span className="font-medium">הגדרות</span>
                            </button>
                        )}

                        {/* Help */}
                        {onHelp && (
                            <button
                                onClick={() => {
                                    onHelp();
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                <IconHelp className="w-5 h-5" />
                                <span className="font-medium">עזרה ותמיכה</span>
                            </button>
                        )}
                    </div>

                    {/* Logout */}
                    {onLogout && (
                        <div className="p-2 border-t border-slate-100">
                            <button
                                onClick={() => {
                                    onLogout();
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <IconLogout className="w-5 h-5" />
                                <span className="font-medium">התנתק</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Compact version for tight spaces
interface UserAvatarProps {
    user: {
        name: string;
        avatar?: string;
    };
    size?: 'sm' | 'md' | 'lg';
    showOnlineStatus?: boolean;
    isOnline?: boolean;
    onClick?: () => void;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
    user,
    size = 'md',
    showOnlineStatus = false,
    isOnline = false,
    onClick
}) => {
    const sizeClasses = {
        sm: 'w-8 h-8 text-sm',
        md: 'w-10 h-10 text-base',
        lg: 'w-12 h-12 text-lg'
    };

    const statusSize = {
        sm: 'w-2 h-2',
        md: 'w-2.5 h-2.5',
        lg: 'w-3 h-3'
    };

    return (
        <button
            onClick={onClick}
            className={`
                relative rounded-full overflow-hidden
                ${sizeClasses[size]}
                ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
            `}
        >
            {user.avatar ? (
                <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                    {user.name.charAt(0)}
                </div>
            )}

            {showOnlineStatus && (
                <span className={`
                    absolute bottom-0 right-0 rounded-full border-2 border-white
                    ${statusSize[size]}
                    ${isOnline ? 'bg-green-500' : 'bg-slate-300'}
                `} />
            )}
        </button>
    );
};

// Header bar with user profile
interface HeaderWithProfileProps {
    user: {
        name: string;
        email: string;
        avatar?: string;
        role?: string;
    };
    title?: string;
    onSettings?: () => void;
    onLogout?: () => void;
    alertCount?: number;
    children?: React.ReactNode;
}

export const HeaderWithProfile: React.FC<HeaderWithProfileProps> = ({
    user,
    title,
    onSettings,
    onLogout,
    alertCount = 0,
    children
}) => {
    return (
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
            {/* Left side - Title */}
            <div className="flex items-center gap-4">
                {title && (
                    <h1 className="text-xl font-bold text-slate-800">{title}</h1>
                )}
                {children}
            </div>

            {/* Right side - Profile */}
            <UserProfileWidget
                user={user}
                onSettings={onSettings}
                onLogout={onLogout}
                alertCount={alertCount}
            />
        </header>
    );
};

export default UserProfileWidget;
