import React from 'react';
import type { StudentAssignment, AssignmentType } from '../hooks/useMyAssignments';
import { IconSparkles } from '../icons'; // Assuming we have some icons, borrowing Sparkles


// Icon placeholders (can be replaced with real icons from lucide-react or similar if available)
const IconBook = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>;
const IconTarget = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>; // For Booster
const IconTrophy = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10" /><path d="M17 4v8a5 5 0 0 1-10 0V4" /><path d="M5 9v2a6 6 0 0 0 3 5" /><path d="M19 9v2a6 6 0 0 1-3 5" /></svg>; // For Quest
const IconCheck = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
const IconClock = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;

interface AssignmentCardProps {
    assignment: StudentAssignment;
    onClick: (assignment: StudentAssignment) => void;
}

const AssignmentCard: React.FC<AssignmentCardProps> = ({ assignment, onClick }) => {
    const { title, groupType, status, progress, dueDate, subject } = assignment;

    // Gamified Labels & Styles Logic
    const getBadge = (type?: AssignmentType) => {
        switch (type) {
            case 'remediation':
                return {
                    label: 'Booster ⚡',
                    className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                    icon: <IconTarget />
                };
            case 'challenge':
                return {
                    label: 'Bonus Quest 🏆',
                    className: 'bg-purple-100 text-purple-700 border-purple-200',
                    icon: <IconTrophy />
                };
            default:
                // 'standard' or undefined
                return {
                    label: 'Mission',
                    className: 'bg-indigo-50 text-indigo-600 border-indigo-100',
                    icon: <IconBook />
                };
        }
    };

    const badgeInfo = getBadge(groupType);

    // Status Visuals
    const isDone = status === 'completed';
    const isInProgress = status === 'in_progress';
    const isNew = status === 'new';

    return (
        <div
            onClick={() => onClick(assignment)}
            className={`
        group relative flex flex-col justify-between
        bg-white rounded-2xl p-5 
        border-2 transition-all duration-300 cursor-pointer
        ${isDone ? 'border-gray-100 bg-gray-50 opacity-80' : 'border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-300 hover:-translate-y-1'}
        min-w-[280px] max-w-[320px] h-[200px] flex-shrink-0
      `}
        >
            {/* Top Section: Badge & Icon */}
            <div className="flex justify-between items-start mb-3">
                <div className={`
          px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border flex items-center gap-1.5
          ${badgeInfo.className}
        `}>
                    {badgeInfo.label}
                </div>

                {/* Subject Icon Placeholder */}
                <div className="text-gray-400 group-hover:text-indigo-500 transition-colors">
                    {badgeInfo.icon}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-grow">
                <h3 className={`font-bold text-lg mb-1 line-clamp-2 ${isDone ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                    {title}
                </h3>
                <p className="text-sm text-gray-500">{subject || 'נושא כללי'}</p>
            </div>

            {/* Footer: Progress & Date */}
            <div className="mt-4">
                {isDone ? (
                    <div className="flex items-center text-green-600 font-bold text-sm bg-green-50 px-3 py-2 rounded-xl w-fit">
                        <IconCheck /> <span className="mr-2">הושלם!</span>
                    </div>
                ) : (
                    <div className="space-y-2">

                        {/* Due Date Indicator */}
                        {dueDate && (
                            <div className="flex items-center text-xs text-gray-400">
                                <IconClock /> <span className="mr-1">לסיום עד {new Date(dueDate).toLocaleDateString('he-IL')}</span>
                            </div>
                        )}

                        {/* Progress Bar (if started) */}
                        {isInProgress && progress !== undefined && (
                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                <div
                                    className="bg-indigo-500 h-2.5 rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        )}

                        {/* New Indicator */}
                        {isNew && (
                            <div className="text-xs font-bold text-indigo-500 animate-pulse">
                                ✨ משימה חדשה מחכה לך
                            </div>
                        )}

                    </div>
                )}
            </div>

            {/* Decoration: Glow effect on hover */}
            <div className="absolute inset-0 rounded-2xl ring-4 ring-indigo-500/0 group-hover:ring-indigo-500/10 transition-all pointer-events-none"></div>
        </div>
    );
};

export default AssignmentCard;
