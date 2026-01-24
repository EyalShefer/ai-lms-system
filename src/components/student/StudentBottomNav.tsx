/**
 * StudentBottomNav - Duolingo-style bottom navigation for students
 * Fixed at bottom, works in both dashboard and course views
 */

import React from 'react';
import {
  IconBook2,
  IconChartBar,
  IconDiamond,
  IconUser,
  IconHome,
  IconArrowRight
} from '@tabler/icons-react';
import { useStudentContext } from '../../context/StudentContext';
import type { StudentTab } from '../../context/StudentContext';

interface StudentBottomNavProps {
  /** Variant for different contexts */
  variant?: 'dashboard' | 'in-course';
  /** Badge count for new tasks */
  newTasksCount?: number;
}

interface NavItem {
  id: StudentTab;
  label: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  gradient: string;
}

const navItems: NavItem[] = [
  {
    id: 'tasks',
    label: 'משימות',
    icon: <IconBook2 className="w-6 h-6" />,
    activeIcon: <IconBook2 className="w-6 h-6" strokeWidth={2.5} />,
    gradient: 'from-violet-500 to-purple-500'
  },
  {
    id: 'progress',
    label: 'התקדמות',
    icon: <IconChartBar className="w-6 h-6" />,
    activeIcon: <IconChartBar className="w-6 h-6" strokeWidth={2.5} />,
    gradient: 'from-cyan-500 to-blue-500'
  },
  {
    id: 'shop',
    label: 'חנות',
    icon: <IconDiamond className="w-6 h-6" />,
    activeIcon: <IconDiamond className="w-6 h-6" strokeWidth={2.5} />,
    gradient: 'from-amber-500 to-orange-500'
  },
  {
    id: 'profile',
    label: 'פרופיל',
    icon: <IconUser className="w-6 h-6" />,
    activeIcon: <IconUser className="w-6 h-6" strokeWidth={2.5} />,
    gradient: 'from-emerald-500 to-green-500'
  }
];

export default function StudentBottomNav({
  variant = 'dashboard',
  newTasksCount = 0
}: StudentBottomNavProps) {
  const {
    activeTab,
    setActiveTab,
    currentView,
    goToDashboard,
    gamificationProfile
  } = useStudentContext();

  const gems = gamificationProfile?.gems || 0;

  const handleTabClick = (tabId: StudentTab) => {
    // If in course view and clicking a tab, go to dashboard first
    if (currentView === 'course') {
      goToDashboard();
    }
    setActiveTab(tabId);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200/60 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
      dir="rtl"
      role="navigation"
      aria-label="ניווט תחתון"
    >
      {/* Safe area padding for iOS */}
      <div className="pb-safe">
        <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
          {/* Back to Dashboard button (only in course view) */}
          {variant === 'in-course' && (
            <button
              onClick={goToDashboard}
              className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 min-w-[64px] group"
              aria-label="חזרה לדשבורד"
            >
              <div className="relative p-2 rounded-xl bg-slate-100 group-hover:bg-violet-100 transition-colors">
                <IconArrowRight className="w-5 h-5 text-slate-500 group-hover:text-violet-600" />
              </div>
              <span className="text-[10px] font-bold text-slate-500 group-hover:text-violet-600">
                דשבורד
              </span>
            </button>
          )}

          {navItems.map((item) => {
            const isActive = activeTab === item.id && currentView === 'dashboard';
            const showBadge = item.id === 'tasks' && newTasksCount > 0;
            const showGems = item.id === 'shop' && gems > 0;

            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`
                  relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 min-w-[64px]
                  ${isActive
                    ? 'scale-105'
                    : 'hover:bg-slate-50 active:scale-95'
                  }
                `}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Icon container with gradient background when active */}
                <div
                  className={`
                    relative p-2 rounded-xl transition-all duration-300
                    ${isActive
                      ? `bg-gradient-to-br ${item.gradient} shadow-lg`
                      : 'bg-slate-100'
                    }
                  `}
                >
                  {/* Icon */}
                  <span
                    className={`
                      transition-colors duration-200
                      ${isActive ? 'text-white' : 'text-slate-500'}
                    `}
                  >
                    {isActive ? item.activeIcon : item.icon}
                  </span>

                  {/* Badge for new tasks */}
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-black rounded-full shadow-lg shadow-rose-500/30 animate-pulse">
                      {newTasksCount > 9 ? '9+' : newTasksCount}
                    </span>
                  )}

                  {/* Gems indicator */}
                  {showGems && !isActive && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-[18px] px-1 flex items-center justify-center bg-gradient-to-r from-amber-400 to-orange-400 text-white text-[9px] font-black rounded-full shadow-lg">
                      {gems > 999 ? '999+' : gems}
                    </span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={`
                    text-[10px] font-bold transition-colors duration-200
                    ${isActive
                      ? `bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`
                      : 'text-slate-500'
                    }
                  `}
                >
                  {item.label}
                </span>

                {/* Active indicator dot */}
                {isActive && (
                  <span
                    className={`absolute -bottom-1 w-1 h-1 rounded-full bg-gradient-to-r ${item.gradient}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
