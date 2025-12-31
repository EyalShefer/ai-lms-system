import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMyAssignments, type StudentAssignment } from '../hooks/useMyAssignments';
import {
    IconFlame,
    IconDiamond,
    IconTrophy,
    IconLock,
    IconCheck,
    IconStar,
    IconPlayerPlayFilled,
    IconShoppingBag,
    IconShieldLock
} from '@tabler/icons-react';

// --- MOCK GAMIFICATION ENGINE (SIMULATION) ---
const useGamification = () => {
    // Simulated State
    return {
        xp: 1450,
        level: 12,
        streak: {
            current: 14,
            isFrozen: false,
            freezesAvailable: 2,
            // Last 7 days: T, T, F, T, T, T, T
            history: [true, true, false, true, true, true, true]
        },
        currency: {
            gems: 450
        },
        league: {
            name: 'Ruby League', // Bronze, Silver, Gold, Ruby, Diamond
            rank: 4,
            isPromotionZone: true,
            totalParticipants: 30
        },
        dailyGoal: {
            targetXp: 50,
            currentXp: 35
        }
    };
};

interface StudentHomeProps {
    onSelectAssignment: (assignmentId: string) => void;
}

const StudentHome: React.FC<StudentHomeProps> = ({ onSelectAssignment }) => {
    const { currentUser } = useAuth();
    const { assignments, loading, error } = useMyAssignments(currentUser?.uid);
    const gameStats = useGamification();

    // State for the Detail Modal
    const [selectedMission, setSelectedMission] = useState<any | null>(null);

    // --- LOGIC: CREATE THE SAGA PATH ---
    // Merge all assignments into a linear "Saga"
    let allAssignments = [
        ...assignments.completed.map(a => ({ ...a, status: 'completed' })),
        ...assignments.inProgress.map(a => ({ ...a, status: 'active' })),
        ...assignments.new.map(a => ({ ...a, status: 'new' }))
    ];

    // --- MOCK DATA INJECTION FOR DEMO/TEACHERS ---
    // If the user has no assignments (empty state), show a rich "Demo Saga" 
    // so the teacher can verify the UI/UX graphics.
    if (allAssignments.length === 0) {
        allAssignments = [
            { id: 'm1', title: 'יסודות האלגברה', topic: 'מתמטיקה', status: 'completed', score: 95, date: '12/10/2023' } as any,
            { id: 'm2', title: 'אוצר מילים: פירות', topic: 'אנגלית', status: 'completed', score: 100, date: '14/10/2023' } as any,
            { id: 'm3', title: 'המהפכה הצרפתית', topic: 'היסטוריה', status: 'active', date: 'היום' } as any, // Curren Active
            { id: 'm4', title: 'פיזיקה ניוטונית', topic: 'פיזיקה', status: 'new', date: 'מחר' } as any,
            { id: 'm5', title: 'גיאומטריה במרחב', topic: 'מתמטיקה', status: 'new', date: 'מחרתיים' } as any,
        ];
    }

    // Identify the "Current" active mission
    const activeMission = allAssignments.find(a => a.status === 'active' || a.status === 'new') || allAssignments[allAssignments.length - 1];

    const handleNodeClick = (mission: any) => {
        setSelectedMission(mission);
    };

    const handleLaunch = () => {
        if (selectedMission) {
            onSelectAssignment(selectedMission.id);
            setSelectedMission(null);
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center text-indigo-400 font-bold animate-pulse">טוען את העולם שלך...</div>;

    return (
        <div className="min-h-screen bg-[#FDFDFD] pb-32 font-sans text-slate-900 overflow-x-hidden pt-20" dir="rtl">

            {/* --- TOP BAR (GAMIFICATION HUD) --- */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-b-2 border-slate-100 flex items-center justify-center px-4 z-40">
                <div className="max-w-2xl w-full flex items-center justify-between gap-2 md:gap-8">

                    {/* LEAGUE WIDGET */}
                    <div className="flex items-center gap-2 hover:bg-slate-50 p-1.5 rounded-xl cursor-pointer transition-colors group">
                        <IconTrophy className="text-amber-500 fill-amber-500 w-6 h-6 md:w-7 md:h-7 drop-shadow-sm group-hover:scale-110 transition-transform" />
                        <div className="hidden md:block">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">ליגה</div>
                            <div className="text-sm font-black text-amber-600">{gameStats.league.name}</div>
                        </div>
                    </div>

                    {/* STREAK WIDGET */}
                    <div className="flex items-center gap-2 hover:bg-slate-50 p-1.5 rounded-xl cursor-pointer transition-colors group">
                        <div className="relative">
                            <IconFlame className="text-orange-500 fill-orange-500 w-6 h-6 md:w-7 md:h-7 animate-pulse group-hover:scale-110 transition-transform" />
                            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-[2px] border border-orange-100">
                                <div className="text-[9px] font-black bg-orange-100 text-orange-600 px-1 rounded-full">{gameStats.streak.current}</div>
                            </div>
                        </div>
                        <div className="hidden md:block">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">רצף ימים</div>
                            <div className="text-sm font-black text-orange-600">{gameStats.streak.current} ימים</div>
                        </div>
                    </div>

                    {/* GEMS WIDGET */}
                    <div className="flex items-center gap-2 hover:bg-slate-50 p-1.5 rounded-xl cursor-pointer transition-colors group">
                        <IconDiamond className="text-blue-500 fill-blue-500 w-6 h-6 md:w-7 md:h-7 group-hover:rotate-12 transition-transform" />
                        <div className="hidden md:block">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">יהלומים</div>
                            <div className="text-sm font-black text-blue-600">{gameStats.currency.gems}</div>
                        </div>
                    </div>

                </div>
            </header>

            <div className="max-w-2xl mx-auto px-4 mt-6">

                {/* --- GREETING HEADER --- */}
                <div className="text-center mb-8 animate-in slide-in-from-top-5 duration-700">
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight drop-shadow-sm">
                        הלוח של {currentUser?.displayName?.split(' ')[0] || 'אלוף'} 🚀
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">מוכן לכבוש עוד יעד היום?</p>
                </div>

                {/* --- 1. THE DAILY PLEDGE (AGENCY) --- */}
                <div className="mb-8 flex items-center justify-between bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-sm hover:border-indigo-100 transition-colors">
                    <div className="flex flex-col">
                        <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider mb-1">המטרה היומית</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-slate-800">{gameStats.dailyGoal.currentXp} / {gameStats.dailyGoal.targetXp} כוכבים</span>
                            {gameStats.dailyGoal.currentXp >= gameStats.dailyGoal.targetXp && <IconCheck className="text-lime-500 w-5 h-5" />}
                        </div>
                        <div className="w-32 h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full transition-all duration-1000" style={{ width: `${(gameStats.dailyGoal.currentXp / gameStats.dailyGoal.targetXp) * 100}%` }}></div>
                        </div>
                    </div>
                    <button className="text-indigo-600 font-bold text-sm bg-indigo-50 px-4 py-2 rounded-xl border-2 border-transparent hover:border-indigo-200 transition-all">
                        ערוך יעד
                    </button>
                </div>

                {/* --- 2. ACTIVE MISSION (HERO CARD) --- */}
                {activeMission && (
                    <div className="relative group cursor-pointer" onClick={() => handleNodeClick(activeMission)}>
                        {/* Glow Effect */}
                        <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-10 group-hover:opacity-20 transition-opacity rounded-3xl"></div>

                        <div className="relative bg-white border-b-4 border-r-2 border-l-2 border-t-2 border-indigo-100 border-b-indigo-200 p-6 rounded-[2rem] flex items-center justify-between hover:-translate-y-1 hover:border-b-[6px] hover:border-indigo-300 transition-all duration-200 active:translate-y-0 active:border-b-2">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-wider mb-3">
                                    <IconStar size={14} className="fill-indigo-600" />
                                    הבא בתור
                                </div>
                                <h2 className="text-2xl font-black text-slate-800 mb-2 leading-tight">
                                    {activeMission.title || "משימה חדשה"}
                                </h2>
                                <p className="text-slate-500 text-sm font-medium line-clamp-1">
                                    {activeMission.topic || "נושא כללי"} • 5 דקות
                                </p>
                            </div>

                            <div className="h-16 w-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                                <IconPlayerPlayFilled size={32} />
                            </div>
                        </div>
                    </div>
                )}


                {/* --- 3. THE SAGA PATH (MAP) --- */}
                <div className="mt-12 relative flex flex-col items-center gap-6 py-10">

                    {/* Render the Path */}
                    {allAssignments.map((node, index) => {
                        // Zig-Zag logic using sine wave math for left/right positioning
                        const offset = Math.sin(index) * 60; // -60 to +60 px
                        const isCompleted = node.status === 'completed';
                        const isActive = node.status === 'active' || node.status === 'new';
                        const isLocked = false; // We don't really have locked yet

                        // Path connectors (SVG lines could go here, but simple Divs work for mock)

                        return (
                            <div
                                key={node.id}
                                className="relative z-10"
                                style={{ transform: `translateX(${offset}px)` }}
                            >
                                {/* Connector Line (Behind) */}
                                {index < allAssignments.length - 1 && (
                                    <div className="absolute top-10 left-1/2 w-1.5 h-16 bg-slate-200 -z-10 origin-top"
                                        style={{
                                            transform: `rotate(${(Math.sin(index + 1) * 60 - offset) * -0.5}deg) scaleY(1.2)`
                                        }}
                                    />
                                )}

                                {/* The Button Node */}
                                <div
                                    onClick={() => handleNodeClick(node)}
                                    className={`
                                        w-20 h-20 rounded-full flex flex-col items-center justify-center relative cursor-pointer
                                        transition-all duration-300
                                        ${isCompleted
                                            ? 'bg-amber-400 border-b-4 border-amber-600 shadow-xl hover:scale-110'
                                            : isActive
                                                ? 'bg-indigo-500 border-b-4 border-indigo-700 shadow-xl shadow-indigo-200 animate-[bounce_2s_infinite] hover:animate-none hover:scale-110'
                                                : 'bg-slate-200 border-b-4 border-slate-300 hover:scale-110'
                                        }
                                        active:border-b-0 active:translate-y-1
                                    `}
                                >
                                    {/* Score / Stars Floating Above */}
                                    {isCompleted && (
                                        <div className="absolute -top-8 flex gap-0.5">
                                            <IconStar className="w-4 h-4 text-amber-400 fill-amber-400" />
                                            <IconStar className="w-5 h-5 text-amber-400 fill-amber-400 -mt-1" />
                                            <IconStar className="w-4 h-4 text-amber-400 fill-amber-400" />
                                        </div>
                                    )}

                                    {/* Icon Inside */}
                                    {isCompleted ? (
                                        <IconCheck className="text-amber-800 w-8 h-8" stroke={4} />
                                    ) : (
                                        <IconPlayerPlayFilled className="text-white w-8 h-8" />
                                    )}

                                </div>

                                {/* Label To The Side (Floating) */}
                                <div className={`absolute top-1/2 -translate-y-1/2 w-max
                                    ${offset >= 0 ? 'right-full mr-4' : 'left-full ml-4'}
                                `}>
                                    <span className="text-sm font-bold text-slate-500 bg-white/60 px-2 py-1 rounded-lg backdrop-blur-sm whitespace-nowrap">
                                        {node.topic || "שיעור"}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    {/* Future Locked Node (Mock) */}
                    <div className="relative z-10 grayscale opacity-50" style={{ transform: `translateX(${Math.sin(allAssignments.length) * 60}px)` }}>
                        <div className="w-20 h-20 rounded-full bg-slate-200 border-b-4 border-slate-300 flex items-center justify-center">
                            <IconLock className="text-slate-400 w-8 h-8" />
                        </div>
                    </div>


                    {/* The Character (Stylized visual) */}
                    <div className="fixed bottom-6 left-6 z-50">
                        <div className="bg-white border-2 border-slate-100 rounded-2xl p-3 shadow-xl flex items-center gap-3 animate-slide-in hover:scale-105 transition-transform cursor-pointer">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-2xl">🧞‍♂️</div>
                            <div className="text-xs font-bold text-slate-600">
                                <div className="text-indigo-600 uppercase text-[10px]">Wizdi Tip</div>
                                אל תשבור את הרצף!
                            </div>
                        </div>
                    </div>

                </div>

            </div>

            {/* --- MISSION DETAIL MODAL --- */}
            {selectedMission && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-none">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto transition-opacity" onClick={() => setSelectedMission(null)} />

                    {/* Card */}
                    <div className="bg-white w-full sm:w-[400px] sm:rounded-3xl rounded-t-3xl p-6 relative z-10 pointer-events-auto animate-in slide-in-from-bottom-10 shadow-2xl">

                        {/* Header Color Strip */}
                        <div className={`absolute top-0 left-0 right-0 h-24 rounded-t-3xl ${selectedMission.status === 'completed' ? 'bg-amber-400' : 'bg-indigo-500'}`} />

                        <div className="relative flex flex-col items-center -mt-12 mb-4">
                            <div className={`w-24 h-24 rounded-full border-4 border-white shadow-lg flex items-center justify-center mb-3
                                ${selectedMission.status === 'completed' ? 'bg-amber-400 text-amber-900' : 'bg-indigo-500 text-white'}
                             `}>
                                {selectedMission.status === 'completed' ? <IconTrophy size={40} /> : <IconPlayerPlayFilled size={40} />}
                            </div>

                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{selectedMission.topic || "נושא כללי"}</div>
                            <h3 className="text-2xl font-black text-slate-800 text-center leading-tight mb-2">{selectedMission.title}</h3>

                            {/* Stats Row */}
                            <div className="flex items-center gap-4 text-sm font-medium text-slate-500 bg-slate-50 px-4 py-2 rounded-xl">
                                {selectedMission.date && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-slate-400">תאריך:</span>
                                        <span className="text-slate-800">{selectedMission.date}</span>
                                    </div>
                                )}
                                {selectedMission.score !== undefined && (
                                    <>
                                        <div className="w-px h-4 bg-slate-300" />
                                        <div className="flex items-center gap-1">
                                            <span className="text-slate-400">ציון:</span>
                                            <span className="text-emerald-600 font-bold">{selectedMission.score}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-6">
                            <button
                                onClick={() => setSelectedMission(null)}
                                className="w-full py-3.5 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                סגור
                            </button>
                            <button
                                onClick={handleLaunch}
                                className={`w-full py-3.5 rounded-2xl font-bold text-white shadow-lg shadow-indigo-200 transition-transform active:scale-95
                                    ${selectedMission.status === 'completed' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}
                                `}
                            >
                                {selectedMission.status === 'completed' ? 'חזור על השיעור' : 'התחל משימה'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- BOTTOM FLOATING BAR (Shop Teaser) --- */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 pb-6 flex justify-around text-slate-400 md:hidden z-50">
                <button className="flex flex-col items-center gap-1 text-indigo-600">
                    <IconPlayerPlayFilled className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase">למידה</span>
                </button>
                <button className="flex flex-col items-center gap-1 hover:text-indigo-500">
                    <IconShoppingBag className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase">חנות</span>
                </button>
                <button className="flex flex-col items-center gap-1 hover:text-indigo-500">
                    <IconShieldLock className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase">פרופיל</span>
                </button>
            </div>

        </div>
    );
};

export default StudentHome;
