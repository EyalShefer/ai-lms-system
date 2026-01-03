import React from 'react';
import { useCourseStore } from '../context/CourseContext';
import { IconSparkles } from '../icons';

export const GamificationHUD: React.FC = () => {
    const { gamificationProfile } = useCourseStore();

    if (!gamificationProfile) return null;

    const { level, xp, currentStreak, gems } = gamificationProfile;

    // Calculate progress to next level
    // Formula from service: Level = floor(sqrt(XP / 100)) + 1
    // Inverse: XP = (Level - 1)^2 * 100
    const currentLevelBaseXp = Math.pow(level - 1, 2) * 100;
    const nextLevelBaseXp = Math.pow(level, 2) * 100;
    const xpNeededForLevel = nextLevelBaseXp - currentLevelBaseXp;
    const xpProgressInLevel = xp - currentLevelBaseXp;
    const progressPercent = Math.min(100, Math.max(0, (xpProgressInLevel / xpNeededForLevel) * 100));

    return (
        <div className="fixed top-4 left-4 z-50 flex flex-col gap-3 animate-slide-in-left pointer-events-none select-none">
            {/* Main HUD Container */}
            <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-indigo-50 flex items-center gap-4 hover:scale-105 transition-transform duration-300 pointer-events-auto">

                {/* Level Badge */}
                <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg transform rotate-3 border-2 border-white">
                        {level}
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white shadow-sm">
                        LVL
                    </div>
                </div>

                {/* XP Progress */}
                <div className="flex flex-col gap-1 min-w-[100px]">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                        <span>XP</span>
                        <span>{Math.floor(progressPercent)}%</span>
                    </div>
                    <div className="w-28 h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                        <div
                            className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                </div>

                {/* Streak Counter (Only if > 0) */}
                {currentStreak > 0 && (
                    <div className="flex flex-col items-center justify-center border-r border-gray-100 pr-4 mr-1">
                        <div className="text-xl animate-bounce-slow">🔥</div>
                        <div className="text-xs font-black text-orange-500">{currentStreak} ימים</div>
                    </div>
                )}

                {/* Gems Counter */}
                {gems > 0 && (
                    <div className="flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                        <IconSparkles className="w-3 h-3 text-indigo-400" />
                        <span className="text-xs font-bold text-indigo-700">{gems}</span>
                    </div>
                )}

            </div>
        </div>
    );
};
