/**
 * HomePageRedesignMobile.tsx
 *
 * Mobile-optimized teacher dashboard with:
 * - Simplified layout for small screens
 * - Large touch targets (56px+ for primary actions)
 * - Stacked cards instead of grid
 * - Quick action buttons always visible
 * - Bottom navigation instead of floating button
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    IconSparkles,
    IconChart,
    IconList
} from '../../icons';
import {
    IconVideo,
    IconFileText,
    IconPencil,
    IconFlask,
    IconChevronLeft,
    IconMicrophone,
    IconMoodSmile,
    IconClipboardCheck,
    IconLayoutList,
    IconBulb,
    IconPlus,
    IconBook,
    IconHome
} from '@tabler/icons-react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

interface RecentActivity {
    id: string;
    title: string;
    type: 'test' | 'activity' | 'lesson';
    mode?: string;
    createdAt: any;
    submissionCount?: number;
}

interface HomePageRedesignMobileProps {
    onCreateNew: (mode: string, product?: 'lesson' | 'podcast' | 'exam' | 'activity') => void;
    onNavigateToDashboard: () => void;
    onEditCourse?: (courseId: string) => void;
    onNavigateToPrompts?: () => void;
    onNavigateToQA?: () => void;
    onNavigateToKnowledgeBase?: () => void;
}

const HomePageRedesignMobile = ({
    onCreateNew,
    onNavigateToDashboard,
    onEditCourse,
    onNavigateToPrompts,
    onNavigateToQA,
    onNavigateToKnowledgeBase
}: HomePageRedesignMobileProps) => {
    const { currentUser } = useAuth();
    const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [showCreateMenu, setShowCreateMenu] = useState(false);

    const firstName = currentUser?.email?.split('@')[0] || "מורה";

    // Fetch recent activities
    useEffect(() => {
        const fetchRecentActivities = async () => {
            if (!currentUser) {
                setLoadingActivities(false);
                return;
            }

            try {
                let coursesSnapshot;

                try {
                    // Try with orderBy first (requires composite index)
                    const coursesQuery = query(
                        collection(db, "courses"),
                        where("teacherId", "==", currentUser.uid),
                        orderBy("createdAt", "desc"),
                        limit(10)
                    );
                    coursesSnapshot = await getDocs(coursesQuery);
                } catch (indexError: any) {
                    // Fallback: fetch without orderBy and sort client-side
                    console.warn("📝 Missing Firestore index, using client-side sort:", indexError?.message);
                    const fallbackQuery = query(
                        collection(db, "courses"),
                        where("teacherId", "==", currentUser.uid)
                    );
                    coursesSnapshot = await getDocs(fallbackQuery);
                }

                const activities: RecentActivity[] = [];
                const courseIds: string[] = [];

                coursesSnapshot.forEach(doc => {
                    const data = doc.data();
                    courseIds.push(doc.id);

                    let type: 'test' | 'activity' | 'lesson' = 'activity';
                    if (data.mode === 'exam') type = 'test';
                    else if (data.mode === 'lesson') type = 'lesson';

                    activities.push({
                        id: doc.id,
                        title: data.title || "ללא שם",
                        type,
                        mode: data.mode,
                        createdAt: data.createdAt,
                        submissionCount: 0
                    });
                });

                // Sort by createdAt descending (client-side, works for both paths)
                activities.sort((a, b) => {
                    const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
                    const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
                    return bTime - aTime;
                });

                // Fetch submission counts for recent courses
                const recentCourseIds = activities.slice(0, 5).map(a => a.id);
                if (recentCourseIds.length > 0) {
                    const submissionsQuery = query(
                        collection(db, "submissions"),
                        where("teacherId", "==", currentUser.uid),
                        where("courseId", "in", recentCourseIds)
                    );
                    const submissionsSnapshot = await getDocs(submissionsQuery);

                    const submissionCounts: Record<string, number> = {};
                    submissionsSnapshot.forEach(doc => {
                        const courseId = doc.data().courseId;
                        submissionCounts[courseId] = (submissionCounts[courseId] || 0) + 1;
                    });

                    activities.forEach(activity => {
                        activity.submissionCount = submissionCounts[activity.id] || 0;
                    });
                }

                setRecentActivities(activities.slice(0, 4));
            } catch (error) {
                console.error("Error fetching activities:", error);
            } finally {
                setLoadingActivities(false);
            }
        };

        fetchRecentActivities();
    }, [currentUser]);

    const getTimeBasedGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return "בוקר טוב";
        if (hour >= 12 && hour < 18) return "צהריים טובים";
        if (hour >= 18 && hour < 22) return "ערב טוב";
        return "לילה טוב";
    };

    const getActivityIcon = (type: string) => {
        if (type === 'test') return <IconList className="w-5 h-5 text-wizdi-cyan" />;
        if (type === 'lesson') return <IconVideo className="w-5 h-5 text-wizdi-action" />;
        return <IconSparkles className="w-5 h-5 text-wizdi-royal" />;
    };

    const getActivityTypeLabel = (type: string) => {
        if (type === 'test') return 'מבחן';
        if (type === 'lesson') return 'שיעור';
        return 'פעילות';
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24" dir="rtl">
            {/* Header */}
            <header className="bg-gradient-to-bl from-wizdi-royal via-violet-600 to-wizdi-cyan dark:from-slate-800 dark:via-slate-800 dark:to-slate-800 text-white px-4 py-6 safe-area-inset-top">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm text-white/70 mb-1">{getTimeBasedGreeting()}, {firstName}</p>
                        <h1 className="text-2xl font-black">סטודיו יצירה חכם</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <IconSparkles className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="flex gap-3">
                    <div className="flex-1 bg-white/10 rounded-xl p-3 text-center">
                        <p className="text-2xl font-black">{recentActivities.length}</p>
                        <p className="text-xs text-white/70">פעילויות</p>
                    </div>
                    <div className="flex-1 bg-white/10 rounded-xl p-3 text-center">
                        <p className="text-2xl font-black">
                            {recentActivities.reduce((acc, a) => acc + (a.submissionCount || 0), 0)}
                        </p>
                        <p className="text-xs text-white/70">הגשות</p>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="px-4 py-6 space-y-6">
                {/* Quick Create Buttons */}
                <section aria-label="יצירה מהירה">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-3">יצירה מהירה</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => onCreateNew('learning', 'lesson')}
                            className="flex flex-col items-center gap-2 p-4 min-h-[100px] bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-wizdi-royal active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-royal"
                            aria-label="מערך שיעור"
                        >
                            <div className="w-12 h-12 bg-wizdi-royal/10 dark:bg-wizdi-royal/20 rounded-xl flex items-center justify-center">
                                <IconLayoutList className="w-6 h-6 text-wizdi-royal" />
                            </div>
                            <span className="font-bold text-slate-800 dark:text-white text-sm">מערך שיעור</span>
                        </button>

                        <button
                            onClick={() => onCreateNew('learning', 'exam')}
                            className="flex flex-col items-center gap-2 p-4 min-h-[100px] bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-wizdi-cyan active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan"
                            aria-label="מבחן / בוחן"
                        >
                            <div className="w-12 h-12 bg-wizdi-cyan/10 dark:bg-wizdi-cyan/20 rounded-xl flex items-center justify-center">
                                <IconClipboardCheck className="w-6 h-6 text-wizdi-cyan" />
                            </div>
                            <span className="font-bold text-slate-800 dark:text-white text-sm">מבחן / בוחן</span>
                        </button>

                        <button
                            onClick={() => onCreateNew('learning', 'activity')}
                            className="flex flex-col items-center gap-2 p-4 min-h-[100px] bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-wizdi-action active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-action"
                            aria-label="פעילות לתלמיד"
                        >
                            <div className="w-12 h-12 bg-wizdi-action/10 dark:bg-wizdi-action/20 rounded-xl flex items-center justify-center">
                                <IconMoodSmile className="w-6 h-6 text-wizdi-action" />
                            </div>
                            <span className="font-bold text-slate-800 dark:text-white text-sm">פעילות</span>
                        </button>

                        <button
                            onClick={() => onCreateNew('learning', 'podcast')}
                            className="flex flex-col items-center gap-2 p-4 min-h-[100px] bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-wizdi-gold active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-gold"
                            aria-label="פודקאסט AI"
                        >
                            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                                <IconMicrophone className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                            </div>
                            <span className="font-bold text-slate-800 dark:text-white text-sm">פודקאסט AI</span>
                        </button>
                    </div>
                </section>

                {/* Recent Activities */}
                <section aria-label="פעילויות אחרונות">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">פעילויות אחרונות</h2>
                        <button
                            onClick={onNavigateToDashboard}
                            className="text-wizdi-royal dark:text-wizdi-cyan text-sm font-medium min-h-[44px] px-3"
                        >
                            הכל ←
                        </button>
                    </div>

                    <div className="space-y-2">
                        {loadingActivities ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-8 h-8 border-2 border-wizdi-royal border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
                            </div>
                        ) : recentActivities.length === 0 ? (
                            <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-2xl">
                                <IconSparkles className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                                <p className="text-slate-500 dark:text-slate-400">אין פעילויות עדיין</p>
                                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">צרו את הפעילות הראשונה שלכם!</p>
                            </div>
                        ) : (
                            recentActivities.map(activity => (
                                <button
                                    key={activity.id}
                                    onClick={() => onEditCourse?.(activity.id)}
                                    className="flex items-center gap-3 w-full p-4 min-h-[64px] bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] transition-all text-right"
                                    aria-label={`${getActivityTypeLabel(activity.type)}: ${activity.title}`}
                                >
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                        activity.type === 'test' ? 'bg-wizdi-cyan/10 dark:bg-wizdi-cyan/20' :
                                        activity.type === 'lesson' ? 'bg-wizdi-action/10 dark:bg-wizdi-action/20' :
                                        'bg-wizdi-royal/10 dark:bg-wizdi-royal/20'
                                    }`}>
                                        {getActivityIcon(activity.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-800 dark:text-white truncate">{activity.title}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {getActivityTypeLabel(activity.type)}
                                            {activity.submissionCount && activity.submissionCount > 0 && (
                                                <span className="mr-2 text-amber-600 dark:text-amber-400">
                                                    • {activity.submissionCount} הגשות
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <IconChevronLeft className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                                </button>
                            ))
                        )}
                    </div>
                </section>

                {/* Quick Links */}
                <section aria-label="קישורים מהירים">
                    <div className="grid grid-cols-2 gap-3">
                        {/* Dashboard */}
                        <button
                            onClick={onNavigateToDashboard}
                            className="flex items-center gap-3 p-4 min-h-[64px] bg-slate-800 dark:bg-slate-700 rounded-xl text-white active:scale-95 transition-all"
                            aria-label="לוח בקרה"
                        >
                            <IconChart className="w-6 h-6" />
                            <span className="font-bold">לוח בקרה</span>
                        </button>

                        {/* Prompts Library */}
                        {onNavigateToPrompts && (
                            <button
                                onClick={onNavigateToPrompts}
                                className="flex items-center gap-3 p-4 min-h-[64px] bg-violet-600 rounded-xl text-white active:scale-95 transition-all"
                                aria-label="מאגר פרומפטים"
                            >
                                <IconBulb className="w-6 h-6" />
                                <span className="font-bold">פרומפטים</span>
                            </button>
                        )}
                    </div>
                </section>

                {/* Source Input Options */}
                <section aria-label="מקורות תוכן">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-3">יצירה מ...</h2>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                        <button
                            onClick={() => onCreateNew('learning')}
                            className="flex items-center gap-2 px-4 py-3 min-h-[48px] bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 whitespace-nowrap active:scale-95 transition-all"
                        >
                            <IconVideo className="w-5 h-5 text-wizdi-cyan" />
                            <span className="font-medium text-slate-700 dark:text-slate-200">סרטון</span>
                        </button>
                        <button
                            onClick={() => onCreateNew('learning')}
                            className="flex items-center gap-2 px-4 py-3 min-h-[48px] bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 whitespace-nowrap active:scale-95 transition-all"
                        >
                            <IconFileText className="w-5 h-5 text-wizdi-royal" />
                            <span className="font-medium text-slate-700 dark:text-slate-200">קובץ</span>
                        </button>
                        <button
                            onClick={() => onCreateNew('learning')}
                            className="flex items-center gap-2 px-4 py-3 min-h-[48px] bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 whitespace-nowrap active:scale-95 transition-all"
                        >
                            <IconPencil className="w-5 h-5 text-wizdi-action" />
                            <span className="font-medium text-slate-700 dark:text-slate-200">טקסט</span>
                        </button>
                        <button
                            onClick={() => onCreateNew('learning')}
                            className="flex items-center gap-2 px-4 py-3 min-h-[48px] bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 whitespace-nowrap active:scale-95 transition-all"
                        >
                            <IconFlask className="w-5 h-5 text-amber-500" />
                            <span className="font-medium text-slate-700 dark:text-slate-200">נושא</span>
                        </button>
                        <button
                            onClick={() => onCreateNew('learning')}
                            className="flex items-center gap-2 px-4 py-3 min-h-[48px] bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 whitespace-nowrap active:scale-95 transition-all"
                        >
                            <IconBook className="w-5 h-5 text-emerald-500" />
                            <span className="font-medium text-slate-700 dark:text-slate-200">מספר לימוד</span>
                        </button>
                    </div>
                </section>

                {/* Admin Links (if available) */}
                {(onNavigateToQA || onNavigateToKnowledgeBase) && (
                    <section aria-label="ניהול מערכת" className="pt-4 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex gap-3">
                            {onNavigateToQA && (
                                <button
                                    onClick={onNavigateToQA}
                                    className="flex-1 text-center py-3 text-sm text-slate-500 dark:text-slate-400 hover:text-wizdi-royal"
                                >
                                    QA Admin
                                </button>
                            )}
                            {onNavigateToKnowledgeBase && (
                                <button
                                    onClick={onNavigateToKnowledgeBase}
                                    className="flex-1 text-center py-3 text-sm text-slate-500 dark:text-slate-400 hover:text-wizdi-royal"
                                >
                                    בסיס ידע
                                </button>
                            )}
                        </div>
                    </section>
                )}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-2 safe-area-inset-bottom">
                <div className="flex items-center justify-around">
                    <button
                        onClick={onNavigateToDashboard}
                        className="flex flex-col items-center gap-1 min-w-[64px] min-h-[56px] py-2 text-slate-500 dark:text-slate-400"
                        aria-label="דשבורד"
                    >
                        <IconChart className="w-6 h-6" />
                        <span className="text-xs">דשבורד</span>
                    </button>

                    {/* Main Create Button */}
                    <button
                        onClick={() => onCreateNew('learning')}
                        className="flex items-center justify-center w-14 h-14 -mt-6 bg-wizdi-action hover:bg-wizdi-action-hover rounded-full shadow-lg text-white active:scale-95 transition-all"
                        aria-label="יצירה חדשה"
                    >
                        <IconPlus className="w-7 h-7" />
                    </button>

                    <button
                        className="flex flex-col items-center gap-1 min-w-[64px] min-h-[56px] py-2 text-wizdi-royal dark:text-wizdi-cyan"
                        aria-label="בית"
                        aria-current="page"
                    >
                        <IconHome className="w-6 h-6" />
                        <span className="text-xs font-bold">בית</span>
                    </button>
                </div>
            </nav>
        </div>
    );
};

export default HomePageRedesignMobile;
