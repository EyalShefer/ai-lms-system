import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    IconSparkles,
    IconChart
} from '../icons';
import { IconChevronLeft, IconMoodSmile, IconClipboardCheck, IconLayoutList, IconBulb, IconRobot, IconSchool, IconX, IconArrowsMaximize, IconMicrophone, IconLogout, IconBolt } from '@tabler/icons-react';
import AIBlogWidget from './AIBlogWidget';
import SmartCreationChat from './SmartCreationChat';
import SmartCreationChatV2 from './SmartCreationChatV2';
import AdminPromptSeeder from './AdminPromptSeeder';
import { MicroActivityModal } from './microActivity';

// Feature flag for V2 chat (Super Agent with dynamic capabilities)
const USE_SUPER_AGENT_V2 = import.meta.env.VITE_USE_SUPER_AGENT_V2 === 'true';

// Chat context type for passing conversation data to wizard
interface ChatContextType {
    topic?: string;
    grade?: string;
    subject?: string;
    productType?: 'lesson' | 'podcast' | 'exam' | 'activity' | 'micro';
    activityLength?: 'short' | 'medium' | 'long';
    profile?: 'balanced' | 'educational' | 'game' | 'custom';
    difficultyLevel?: string;
    conversationSummary?: string;
}

const HomePageRedesign = ({ onCreateNew, onCreateWithWizardData, onNavigateToDashboard, onNavigateToPrompts, onNavigateToQA, onNavigateToKnowledgeBase, onNavigateToAgents, onNavigateToUsage, onNavigateToSpeedAnalytics, onNavigateToAgentDashboard, onNavigateToBagrut, onLogout }: { onCreateNew: (mode: string, product?: 'lesson' | 'podcast' | 'exam' | 'activity', chatContext?: ChatContextType) => void, onCreateWithWizardData?: (wizardData: any) => void, onNavigateToDashboard: () => void, onNavigateToPrompts?: () => void, onNavigateToQA?: () => void, onNavigateToKnowledgeBase?: () => void, onNavigateToAgents?: () => void, onNavigateToUsage?: () => void, onNavigateToSpeedAnalytics?: () => void, onNavigateToAgentDashboard?: () => void, onNavigateToBagrut?: () => void, onLogout?: () => void }) => {
    const { isAdmin } = useAuth();
    const [isChatExpanded, setIsChatExpanded] = useState(false);
    const [isMicroActivityOpen, setIsMicroActivityOpen] = useState(false);

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

            {/* === AURORA HERO SECTION === */}
            <div className="relative mb-6 rounded-3xl overflow-hidden">
                {/* Aurora Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-cyan-400/15 to-amber-300/20 dark:from-violet-600/30 dark:via-cyan-500/20 dark:to-amber-400/25 animate-aurora"></div>

                {/* Decorative Blobs */}
                <div className="absolute top-0 left-1/4 w-64 h-64 bg-gradient-to-br from-violet-400/30 to-purple-500/20 rounded-full blur-3xl animate-blob"></div>
                <div className="absolute top-4 right-1/4 w-48 h-48 bg-gradient-to-br from-cyan-400/30 to-blue-500/20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-8 left-1/3 w-56 h-56 bg-gradient-to-br from-amber-300/25 to-orange-400/15 rounded-full blur-3xl animate-blob animation-delay-4000"></div>

                {/* Floating Educational Icons */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                    <div className="absolute top-6 left-[10%] text-violet-400/40 dark:text-violet-300/30 animate-float">
                        <IconBulb className="w-8 h-8" />
                    </div>
                    <div className="absolute top-8 right-[15%] text-cyan-400/40 dark:text-cyan-300/30 animate-float animation-delay-1000">
                        <IconSchool className="w-7 h-7" />
                    </div>
                    <div className="absolute bottom-6 left-[20%] text-amber-400/40 dark:text-amber-300/30 animate-float animation-delay-3000">
                        <IconSparkles className="w-6 h-6" />
                    </div>
                    <div className="absolute bottom-8 right-[25%] text-emerald-400/40 dark:text-emerald-300/30 animate-float animation-delay-2000">
                        <IconChart className="w-7 h-7" />
                    </div>
                </div>

                {/* Logout Button - Top Left Corner */}
                {onLogout && (
                    <button
                        onClick={onLogout}
                        className="absolute top-4 left-4 z-20 bg-white/80 hover:bg-rose-50 text-rose-500 hover:text-rose-600 p-2.5 rounded-xl transition-all shadow-sm hover:shadow-md border border-rose-200/60 hover:border-rose-300 backdrop-blur-sm"
                        title="התנתק"
                    >
                        <IconLogout className="w-5 h-5" />
                    </button>
                )}

                {/* Hero Content with Logo */}
                <div className="relative z-10 py-8 px-6 text-center flex flex-col items-center">
                    {/* Logo */}
                    <img
                        src="/WizdiLogo.png"
                        alt="Wizdi AI"
                        className="h-20 w-auto object-contain mb-3"
                        loading="lazy"
                        decoding="async"
                    />
                    <h1 className="text-3xl font-bold tracking-tight">
                        <span className="text-cyan-500 dark:text-cyan-400">Wizdi</span>
                        <span className="text-slate-700 dark:text-white/90 ml-2">AI Studio</span>
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 text-sm mt-2 max-w-md mx-auto">
                        הכלי החכם ליצירת חומרי לימוד מותאמים אישית
                    </p>
                </div>
            </div>

            {/* BENTO GRID LAYOUT */}
            <div className="bento-grid relative z-10">

                {/* === BLOCK 1: AI CHAT - Smart Creation (Full Width, Hero) === */}
                <section className="col-span-12 bento-card bento-featured ai-glow min-h-[420px]" aria-label="יצירת תוכן חכמה">
                    <div className="ai-particles" aria-hidden="true">
                        <div className="ai-particle"></div>
                        <div className="ai-particle"></div>
                        <div className="ai-particle"></div>
                    </div>

                    <div className="relative z-10 h-full flex flex-col">
                        {/* Expand button */}
                        <div className="flex justify-start mb-2">
                            <button
                                onClick={() => setIsChatExpanded(true)}
                                className="p-2 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-all"
                                title="הרחב צ'אט"
                            >
                                <IconArrowsMaximize className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Smart Creation Chat - takes the lead */}
                        <div className="flex-1 min-h-[320px]">
                            {USE_SUPER_AGENT_V2 ? (
                                <SmartCreationChatV2
                                    onCreateContent={(wizardData) => {
                                        setIsChatExpanded(false);
                                        if (onCreateWithWizardData) {
                                            onCreateWithWizardData(wizardData);
                                        }
                                    }}
                                    onOpenWizard={(mode, product, chatContext) => {
                                        setIsChatExpanded(false);
                                        onCreateNew(mode, product as 'lesson' | 'podcast' | 'exam' | 'activity' | 'micro', chatContext);
                                    }}
                                />
                            ) : (
                                <SmartCreationChat
                                    onCreateContent={(wizardData) => {
                                        setIsChatExpanded(false);
                                        if (onCreateWithWizardData) {
                                            onCreateWithWizardData(wizardData);
                                        } else {
                                            // Extract chat context to pass to wizard
                                            const chatContext: ChatContextType = {
                                                topic: wizardData.originalTopic || wizardData.title,
                                                grade: wizardData.settings?.grade,
                                                subject: wizardData.settings?.subject,
                                                productType: wizardData.settings?.productType,
                                                activityLength: wizardData.settings?.activityLength,
                                                profile: wizardData.settings?.questionPreferences?.profile,
                                                conversationSummary: wizardData.conversationSummary
                                            };
                                            onCreateNew('learning', wizardData.settings?.productType || 'activity', chatContext);
                                        }
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </section>

                {/* === QUICK ACTIONS (Compact, Below Chat) === */}
                <section className="col-span-12 bento-card py-4" aria-label="יצירה מהירה">
                    <div className="mb-3">
                        <h2 className="font-bold text-slate-800 dark:text-white">יצירה מהירה</h2>
                        <p className="text-xs text-slate-400 dark:text-slate-500">תוכן אינטראקטיבי עשיר עם תמונות, אינפוגרפיקות, הנפשות, מגוון סוגי שאלות, משובים מיידים לתלמיד ודוחות למורה</p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-start">
                        {/* מערך שיעור */}
                        <button
                            onClick={() => handleCardClick("Lesson Plan", () => onCreateNew('learning', 'lesson'))}
                            className="group flex items-center justify-start gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-100 dark:border-violet-800/30 hover:border-violet-300 dark:hover:border-violet-500/50 transition-all hover:shadow-md min-w-[140px]"
                        >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                <IconLayoutList className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold text-slate-700 dark:text-white text-sm">מערך שיעור</span>
                        </button>

                        {/* פעילות */}
                        <button
                            onClick={() => handleCardClick("Activity", () => onCreateNew('learning', 'activity'))}
                            className="group flex items-center justify-start gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border border-cyan-100 dark:border-cyan-800/30 hover:border-cyan-300 dark:hover:border-cyan-500/50 transition-all hover:shadow-md min-w-[140px]"
                        >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                <IconMoodSmile className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold text-slate-700 dark:text-white text-sm">פעילות</span>
                        </button>

                        {/* מיקרו פעילות - Opens dedicated modal with type selection, preview & share */}
                        <button
                            onClick={() => handleCardClick("Micro Activity", () => setIsMicroActivityOpen(true))}
                            className="group flex items-center justify-start gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-100 dark:border-emerald-800/30 hover:border-emerald-300 dark:hover:border-emerald-500/50 transition-all hover:shadow-md min-w-[140px]"
                        >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                <IconBolt className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold text-slate-700 dark:text-white text-sm">מיקרו פעילות</span>
                        </button>

                        {/* מבחן */}
                        <button
                            onClick={() => handleCardClick("Exam", () => onCreateNew('learning', 'exam'))}
                            className="group flex items-center justify-start gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-100 dark:border-amber-800/30 hover:border-amber-300 dark:hover:border-amber-500/50 transition-all hover:shadow-md min-w-[140px]"
                        >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                                <IconClipboardCheck className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold text-slate-700 dark:text-white text-sm">מבחן</span>
                        </button>

                        {/* פודקאסט - Coming Soon */}
                        <div className="flex items-center justify-start gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-rose-50/60 to-pink-50/60 dark:from-rose-900/10 dark:to-pink-900/10 border border-rose-200/50 dark:border-rose-800/20 cursor-not-allowed min-w-[140px]">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-400/70 to-pink-500/70 flex items-center justify-center shadow-sm">
                                <IconMicrophone className="w-4 h-4 text-white/80" />
                            </div>
                            <span className="font-semibold text-slate-500 dark:text-slate-400 text-sm">פודקאסט</span>
                            <span className="text-[10px] text-rose-400/70">(בקרוב)</span>
                        </div>

                        {/* סוכן AI - Coming Soon */}
                        <div className="flex items-center justify-start gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-violet-50/60 to-purple-50/60 dark:from-violet-900/10 dark:to-purple-900/10 border border-violet-200/50 dark:border-violet-800/20 cursor-not-allowed min-w-[140px]">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400/70 to-purple-500/70 flex items-center justify-center shadow-sm">
                                <IconRobot className="w-4 h-4 text-white/80" />
                            </div>
                            <span className="font-semibold text-slate-500 dark:text-slate-400 text-sm">סוכן AI</span>
                            <span className="text-[10px] text-violet-400/70">(בקרוב)</span>
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
                            {USE_SUPER_AGENT_V2 ? (
                                <SmartCreationChatV2
                                    isExpanded={true}
                                    onCreateContent={(wizardData) => {
                                        setIsChatExpanded(false);
                                        if (onCreateWithWizardData) {
                                            onCreateWithWizardData(wizardData);
                                        }
                                    }}
                                    onOpenWizard={(mode, product, chatContext) => {
                                        setIsChatExpanded(false);
                                        onCreateNew(mode, product as 'lesson' | 'podcast' | 'exam' | 'activity' | 'micro', chatContext);
                                    }}
                                    onCancel={() => setIsChatExpanded(false)}
                                />
                            ) : (
                                <SmartCreationChat
                                    isExpanded={true}
                                    onCreateContent={(wizardData) => {
                                        setIsChatExpanded(false);
                                        if (onCreateWithWizardData) {
                                            onCreateWithWizardData(wizardData);
                                        } else {
                                            // Extract chat context to pass to wizard
                                            const chatContext: ChatContextType = {
                                                topic: wizardData.originalTopic || wizardData.title,
                                                grade: wizardData.settings?.grade,
                                                subject: wizardData.settings?.subject,
                                                productType: wizardData.settings?.productType,
                                                activityLength: wizardData.settings?.activityLength,
                                                profile: wizardData.settings?.questionPreferences?.profile,
                                                conversationSummary: wizardData.conversationSummary
                                            };
                                            onCreateNew('learning', wizardData.settings?.productType || 'activity', chatContext);
                                        }
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Micro Activity Modal */}
            <MicroActivityModal
                isOpen={isMicroActivityOpen}
                onClose={() => setIsMicroActivityOpen(false)}
                onActivityCreated={(courseData) => {
                    console.log('Micro activity created, opening editor:', courseData);
                    setIsMicroActivityOpen(false);
                    // Use onCreateWithWizardData to create course and open editor
                    if (onCreateWithWizardData) {
                        onCreateWithWizardData(courseData);
                    }
                }}
            />

{/* Styles moved to index.css */}
        </div>
    );
};

export default HomePageRedesign;
