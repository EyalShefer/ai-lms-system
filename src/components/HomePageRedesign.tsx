import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    IconSparkles,
    IconChart
} from '../icons';
import { IconChevronLeft, IconMoodSmile, IconClipboardCheck, IconLayoutList, IconBulb, IconRobot, IconSchool, IconX, IconArrowsMaximize } from '@tabler/icons-react';
import AIBlogWidget from './AIBlogWidget';
import SmartCreationChat from './SmartCreationChat';
import AdminPromptSeeder from './AdminPromptSeeder';

const HomePageRedesign = ({ onCreateNew, onCreateWithWizardData, onNavigateToDashboard, onNavigateToPrompts, onNavigateToQA, onNavigateToKnowledgeBase, onNavigateToAgents, onNavigateToUsage, onNavigateToSpeedAnalytics, onNavigateToAgentDashboard, onNavigateToBagrut }: { onCreateNew: (mode: string, product?: 'lesson' | 'podcast' | 'exam' | 'activity') => void, onCreateWithWizardData?: (wizardData: any) => void, onNavigateToDashboard: () => void, onNavigateToPrompts?: () => void, onNavigateToQA?: () => void, onNavigateToKnowledgeBase?: () => void, onNavigateToAgents?: () => void, onNavigateToUsage?: () => void, onNavigateToSpeedAnalytics?: () => void, onNavigateToAgentDashboard?: () => void, onNavigateToBagrut?: () => void }) => {
    const { currentUser, isAdmin } = useAuth();
    const [isChatExpanded, setIsChatExpanded] = useState(false);
    const firstName = currentUser?.email?.split('@')[0] || "מורה";

    // Close expanded chat on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isChatExpanded) {
                setIsChatExpanded(false);
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isChatExpanded]);

    const getTimeBasedGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return "בוקר טוב";
        if (hour >= 12 && hour < 18) return "צהריים טובים";
        if (hour >= 18 && hour < 22) return "ערב טוב";
        return "לילה טוב";
    };

    const handleCardClick = (actionName: string, callback: () => void) => {
        console.log(`🚀 Clicked card: ${actionName}`);
        callback();
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 font-sans">
            {/* AI Particles Background */}
            <div className="ai-particles fixed inset-0 pointer-events-none z-0" aria-hidden="true">
                <div className="ai-particle"></div>
                <div className="ai-particle"></div>
                <div className="ai-particle"></div>
                <div className="ai-particle"></div>
                <div className="ai-particle"></div>
            </div>

            {/* BENTO GRID LAYOUT */}
            <div className="bento-grid relative z-10">

                {/* === BLOCK 1: AI CHAT - Smart Creation === */}
                <section className="bento-lg bento-card bento-featured ai-glow" aria-label="יצירת תוכן חכמה">
                    <div className="ai-particles" aria-hidden="true">
                        <div className="ai-particle"></div>
                        <div className="ai-particle"></div>
                        <div className="ai-particle"></div>
                    </div>

                    <div className="relative z-10 h-full flex flex-col">
                        {/* Brand Header with Site Name */}
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h1 className="text-2xl font-black ai-gradient-text mb-0.5">Wizdi</h1>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    {getTimeBasedGreeting()}, <span className="font-semibold">{firstName}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="ai-pill text-xs">
                                    <IconSparkles className="w-3 h-3" />
                                    AI Studio
                                </span>
                                <button
                                    onClick={() => setIsChatExpanded(true)}
                                    className="p-2 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-all"
                                    title="הרחב צ'אט"
                                >
                                    <IconArrowsMaximize className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Smart Creation Chat - takes the lead */}
                        <div className="flex-1">
                            <SmartCreationChat
                                onCreateContent={(wizardData) => {
                                    setIsChatExpanded(false);
                                    if (onCreateWithWizardData) {
                                        onCreateWithWizardData(wizardData);
                                    } else {
                                        onCreateNew('learning', wizardData.settings?.productType || 'activity');
                                    }
                                }}
                            />
                        </div>
                    </div>
                </section>

                {/* === BLOCK 2: QUICK ACTIONS === */}
                <section className="bento-lg bento-card" aria-label="יצירה מהירה">
                    <div className="mb-4">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white">יצירה מהירה</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3 h-[calc(100%-3rem)]">
                        {/* מערך שיעור */}
                        <button
                            onClick={() => handleCardClick("Lesson Plan", () => onCreateNew('learning', 'lesson'))}
                            className="group flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-100 dark:border-violet-800/30 hover:border-violet-300 dark:hover:border-violet-500/50 transition-all hover:shadow-lg hover:-translate-y-1"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-violet-500/20">
                                <IconLayoutList className="w-7 h-7 text-white" />
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-slate-800 dark:text-white text-sm">מערך שיעור</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">יחידת לימוד שלמה</p>
                            </div>
                        </button>

                        {/* פעילות */}
                        <button
                            onClick={() => handleCardClick("Activity", () => onCreateNew('learning', 'activity'))}
                            className="group flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border border-cyan-100 dark:border-cyan-800/30 hover:border-cyan-300 dark:hover:border-cyan-500/50 transition-all hover:shadow-lg hover:-translate-y-1"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-cyan-500/20">
                                <IconMoodSmile className="w-7 h-7 text-white" />
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-slate-800 dark:text-white text-sm">פעילות</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">תרגול אינטראקטיבי</p>
                            </div>
                        </button>

                        {/* מבחן */}
                        <button
                            onClick={() => handleCardClick("Exam", () => onCreateNew('learning', 'exam'))}
                            className="group flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-100 dark:border-amber-800/30 hover:border-amber-300 dark:hover:border-amber-500/50 transition-all hover:shadow-lg hover:-translate-y-1"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-amber-500/20">
                                <IconClipboardCheck className="w-7 h-7 text-white" />
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-slate-800 dark:text-white text-sm">מבחן</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">הערכה וציונים</p>
                            </div>
                        </button>

                        {/* סוכן AI - Coming Soon */}
                        <div className="group flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/30 opacity-50 cursor-not-allowed">
                            <div className="w-14 h-14 rounded-2xl bg-slate-300 dark:bg-slate-700 flex items-center justify-center">
                                <IconRobot className="w-7 h-7 text-slate-400" />
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-slate-400 text-sm">סוכן AI</p>
                                <p className="text-[10px] text-slate-400">בקרוב...</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* === PROMPTS LIBRARY === */}
                <button
                    onClick={() => handleCardClick("Prompts Library", () => onNavigateToPrompts?.())}
                    className="bento-card ai-glow group cursor-pointer text-right col-span-6 max-lg:col-span-3 max-sm:col-span-1"
                    aria-label="מאגר פרומפטים"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <IconBulb className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white">פרומפטים</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">מוכנים לשימוש</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-1 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 text-[10px] rounded-full">ניהול כיתה</span>
                        <span className="px-2 py-1 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-[10px] rounded-full">הערכה</span>
                        <span className="px-2 py-1 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 text-[10px] rounded-full">משחקים</span>
                    </div>
                </button>

                {/* === DASHBOARD === */}
                <button
                    onClick={() => handleCardClick("Dashboard", onNavigateToDashboard)}
                    className="bento-card ai-glow group cursor-pointer text-right col-span-6 max-lg:col-span-3 max-sm:col-span-1"
                    aria-label="לוח בקרה"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <IconChart className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white">לוח בקרה</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">נתונים ומעקב</p>
                        </div>
                    </div>
                    {/* Mini Chart */}
                    <div className="h-8 flex items-end gap-1">
                        <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-t h-3"></div>
                        <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-t h-5"></div>
                        <div className="flex-1 bg-violet-400 rounded-t h-7"></div>
                        <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-t h-4"></div>
                        <div className="flex-1 bg-cyan-400 rounded-t h-8"></div>
                        <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-t h-6"></div>
                    </div>
                </button>

                {/* === BAGRUT PREPARATION === */}
                {onNavigateToBagrut && (
                    <button
                        onClick={onNavigateToBagrut}
                        className="bento-card ai-glow ai-pulse-glow group cursor-pointer text-right col-span-12 max-lg:col-span-6 max-sm:col-span-1"
                        aria-label="הכנה לבגרות"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-violet-500/20">
                                    <IconSchool className="w-7 h-7 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1">הכנה לבגרות</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">אזרחות • ספרות • תנ"ך • עברית • אנגלית • היסטוריה</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 group-hover:translate-x-[-8px] transition-transform">
                                <span className="text-sm font-bold hidden sm:block">התחל תרגול</span>
                                <IconChevronLeft className="w-5 h-5" />
                            </div>
                        </div>
                    </button>
                )}

                {/* === AI BLOG WIDGET === */}
                <section className="bento-card col-span-12 max-lg:col-span-6 max-sm:col-span-1" aria-label="חדשות AI">
                    <AIBlogWidget compact={true} showFeatured={true} maxItems={1} />
                </section>

            </div>

            {/* Admin Links - Minimal */}
            <nav className="relative z-10 text-center py-6 flex justify-center gap-3 flex-wrap" aria-label="ניהול">
                {onNavigateToQA && (
                    <button onClick={() => onNavigateToQA()} className="text-slate-400 text-xs hover:text-violet-600 transition-colors px-2 py-1">QA</button>
                )}
                {onNavigateToKnowledgeBase && (
                    <button onClick={() => onNavigateToKnowledgeBase()} className="text-slate-400 text-xs hover:text-violet-600 transition-colors px-2 py-1">בסיס ידע</button>
                )}
                {onNavigateToUsage && (
                    <button onClick={() => onNavigateToUsage()} className="text-slate-400 text-xs hover:text-violet-600 transition-colors px-2 py-1">שימוש AI</button>
                )}
                {onNavigateToSpeedAnalytics && (
                    <button onClick={() => onNavigateToSpeedAnalytics()} className="text-slate-400 text-xs hover:text-violet-600 transition-colors px-2 py-1">מהירות</button>
                )}
                {onNavigateToAgentDashboard && (
                    <button onClick={() => onNavigateToAgentDashboard()} className="text-slate-400 text-xs hover:text-violet-600 transition-colors px-2 py-1">סוכן AI</button>
                )}
                <AdminPromptSeeder isAdmin={isAdmin} />
            </nav>

            {/* Mobile FAB */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:hidden z-50">
                <button
                    onClick={() => onCreateNew('learning')}
                    className="ai-action-btn shadow-xl"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    יצירה חדשה
                </button>
            </div>

            {/* Full Screen Chat Overlay */}
            {isChatExpanded && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setIsChatExpanded(false)}
                    />

                    {/* Chat Modal */}
                    <div className="relative w-full max-w-4xl h-[90vh] mx-4 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-l from-violet-500/5 to-cyan-500/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-xl flex items-center justify-center">
                                    <IconSparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black ai-gradient-text">Wizdi AI Studio</h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">יצירת תוכן חכמה</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsChatExpanded(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                                title="סגור"
                            >
                                <IconX className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Chat Content - Full Height */}
                        <div className="h-[calc(90vh-80px)]">
                            <SmartCreationChat
                                isExpanded={true}
                                onCreateContent={(wizardData) => {
                                    setIsChatExpanded(false);
                                    if (onCreateWithWizardData) {
                                        onCreateWithWizardData(wizardData);
                                    } else {
                                        onCreateNew('learning', wizardData.settings?.productType || 'activity');
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

{/* Styles moved to index.css */}
        </div>
    );
};

export default HomePageRedesign;
