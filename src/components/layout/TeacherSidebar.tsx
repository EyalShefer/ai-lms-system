/**
 * Teacher Sidebar Navigation
 * ניווט צדדי לדשבורד מורים
 */

import React, { useState } from 'react';
import {
    IconHome,
    IconBook,
    IconUsers,
    IconChartBar,
    IconSettings,
    IconBell,
    IconLogout,
    IconChevronRight,
    IconChevronLeft,
    IconSparkles,
    IconKey,
    IconFolder,
    IconPlus,
    IconMenu2
} from '@tabler/icons-react';

export type SidebarPage =
    | 'dashboard'
    | 'activities'
    | 'classes'
    | 'reports'
    | 'alerts'
    | 'settings';

interface MenuItem {
    id: SidebarPage;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    subItems?: {
        id: string;
        label: string;
    }[];
}

interface TeacherSidebarProps {
    activePage: SidebarPage;
    onNavigate: (page: SidebarPage) => void;
    user?: {
        name: string;
        email: string;
        avatar?: string;
    };
    alertCount?: number;
    onLogout?: () => void;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    className?: string;
}

const MENU_ITEMS: MenuItem[] = [
    {
        id: 'dashboard',
        label: 'ראשי',
        icon: <IconHome className="w-5 h-5" />
    },
    {
        id: 'activities',
        label: 'הפעילויות שלי',
        icon: <IconBook className="w-5 h-5" />,
        subItems: [
            { id: 'all', label: 'כל הפעילויות' },
            { id: 'create', label: 'צור פעילות חדשה' },
            { id: 'drafts', label: 'טיוטות' }
        ]
    },
    {
        id: 'classes',
        label: 'ניהול כיתות',
        icon: <IconUsers className="w-5 h-5" />,
        subItems: [
            { id: 'all', label: 'הכיתות שלי' },
            { id: 'codes', label: 'קודי גישה' },
            { id: 'students', label: 'רשימת תלמידים' }
        ]
    },
    {
        id: 'reports',
        label: 'דוחות והערכה',
        icon: <IconChartBar className="w-5 h-5" />,
        subItems: [
            { id: 'performance', label: 'ביצועי כיתה' },
            { id: 'bloom', label: 'ניתוח Bloom' },
            { id: 'export', label: 'ייצוא נתונים' }
        ]
    },
    {
        id: 'alerts',
        label: 'התראות',
        icon: <IconBell className="w-5 h-5" />
    },
    {
        id: 'settings',
        label: 'הגדרות',
        icon: <IconSettings className="w-5 h-5" />
    }
];

export const TeacherSidebar: React.FC<TeacherSidebarProps> = ({
    activePage,
    onNavigate,
    user,
    alertCount = 0,
    onLogout,
    collapsed = false,
    onToggleCollapse,
    className = ''
}) => {
    const [expandedItem, setExpandedItem] = useState<SidebarPage | null>(null);

    const handleItemClick = (item: MenuItem) => {
        if (item.subItems) {
            setExpandedItem(expandedItem === item.id ? null : item.id);
        } else {
            onNavigate(item.id);
        }
    };

    return (
        <aside
            className={`
                ${collapsed ? 'w-20' : 'w-64'}
                h-screen bg-slate-900 text-white
                flex flex-col transition-all duration-300
                ${className}
            `}
        >
            {/* Logo/Brand */}
            <div className="p-4 border-b border-slate-700/50">
                <div className="flex items-center justify-between">
                    {!collapsed && (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                                <IconSparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="font-black text-lg">Wizdi-AI</h1>
                                <p className="text-xs text-slate-400">לוח בקרה למורים</p>
                            </div>
                        </div>
                    )}
                    {collapsed && (
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto">
                            <IconSparkles className="w-5 h-5" />
                        </div>
                    )}
                    {onToggleCollapse && !collapsed && (
                        <button
                            onClick={onToggleCollapse}
                            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                        >
                            <IconChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Collapsed toggle */}
            {collapsed && onToggleCollapse && (
                <button
                    onClick={onToggleCollapse}
                    className="p-4 border-b border-slate-700/50 hover:bg-slate-800 transition-colors"
                >
                    <IconChevronLeft className="w-5 h-5 mx-auto" />
                </button>
            )}

            {/* Quick Create Button */}
            {!collapsed && (
                <div className="p-4">
                    <button className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold transition-colors">
                        <IconPlus className="w-4 h-4" />
                        צור פעילות חדשה
                    </button>
                </div>
            )}
            {collapsed && (
                <div className="p-2">
                    <button className="w-full p-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center justify-center">
                        <IconPlus className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-2">
                <ul className="space-y-1">
                    {MENU_ITEMS.map((item) => {
                        const isActive = activePage === item.id;
                        const isExpanded = expandedItem === item.id;
                        const badge = item.id === 'alerts' ? alertCount : item.badge;

                        return (
                            <li key={item.id}>
                                <button
                                    onClick={() => handleItemClick(item)}
                                    className={`
                                        w-full flex items-center gap-3 p-3 rounded-xl transition-all
                                        ${isActive
                                            ? 'bg-indigo-600 text-white'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }
                                        ${collapsed ? 'justify-center' : ''}
                                    `}
                                    title={collapsed ? item.label : undefined}
                                >
                                    <span className="relative">
                                        {item.icon}
                                        {badge && badge > 0 && collapsed && (
                                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">
                                                {badge > 9 ? '9+' : badge}
                                            </span>
                                        )}
                                    </span>

                                    {!collapsed && (
                                        <>
                                            <span className="flex-1 text-right font-medium">
                                                {item.label}
                                            </span>
                                            {badge && badge > 0 && (
                                                <span className="px-2 py-0.5 bg-red-500 rounded-full text-xs">
                                                    {badge}
                                                </span>
                                            )}
                                            {item.subItems && (
                                                <IconChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                            )}
                                        </>
                                    )}
                                </button>

                                {/* Sub items */}
                                {!collapsed && item.subItems && isExpanded && (
                                    <ul className="mt-1 mr-4 space-y-1">
                                        {item.subItems.map((subItem) => (
                                            <li key={subItem.id}>
                                                <button
                                                    onClick={() => onNavigate(item.id)}
                                                    className="w-full text-right p-2 pr-6 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                                >
                                                    {subItem.label}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* User Profile */}
            {user && (
                <div className="p-4 border-t border-slate-700/50">
                    <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
                        {/* Avatar */}
                        {user.avatar ? (
                            <img
                                src={user.avatar}
                                alt={user.name}
                                className="w-10 h-10 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg font-bold">
                                {user.name.charAt(0)}
                            </div>
                        )}

                        {!collapsed && (
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm truncate">{user.name}</div>
                                <div className="text-xs text-slate-400 truncate">{user.email}</div>
                            </div>
                        )}

                        {!collapsed && onLogout && (
                            <button
                                onClick={onLogout}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                title="התנתק"
                            >
                                <IconLogout className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {collapsed && onLogout && (
                        <button
                            onClick={onLogout}
                            className="w-full p-2 mt-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center"
                            title="התנתק"
                        >
                            <IconLogout className="w-5 h-5" />
                        </button>
                    )}
                </div>
            )}
        </aside>
    );
};

// Mobile sidebar toggle button
interface MobileSidebarToggleProps {
    onClick: () => void;
    alertCount?: number;
}

export const MobileSidebarToggle: React.FC<MobileSidebarToggleProps> = ({
    onClick,
    alertCount = 0
}) => {
    return (
        <button
            onClick={onClick}
            className="fixed top-4 right-4 z-50 p-3 bg-slate-900 text-white rounded-xl shadow-lg md:hidden"
        >
            <IconMenu2 className="w-6 h-6" />
            {alertCount > 0 && (
                <span className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
                    {alertCount > 9 ? '9+' : alertCount}
                </span>
            )}
        </button>
    );
};

// Mobile sidebar overlay
interface MobileSidebarOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export const MobileSidebarOverlay: React.FC<MobileSidebarOverlayProps> = ({
    isOpen,
    onClose,
    children
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-40 md:hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            {/* Sidebar */}
            <div className="absolute right-0 top-0 h-full w-64 animate-in slide-in-from-right duration-300">
                {children}
            </div>
        </div>
    );
};

export default TeacherSidebar;
