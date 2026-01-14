import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AIStarsSpinner } from './ui/Loading/AIStarsSpinner';
import {
    IconSparkles,
    IconChart,
    IconList,
    IconMagicWand
} from '../icons';
import { IconUpload, IconShare, IconVideo, IconFileText, IconPencil, IconFlask, IconChevronLeft, IconMicrophone, IconMoodSmile, IconClipboardCheck, IconLayoutList, IconBulb, IconRobot, IconMath, IconLanguage, IconBook, IconWriting, IconMessage, IconSchool, IconDeviceGamepad2, IconHistory } from '@tabler/icons-react';
import AIBlogWidget from './AIBlogWidget';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface RecentActivity {
    id: string;
    title: string;
    type: 'test' | 'activity' | 'lesson';
    mode?: string;
    createdAt: any;
    submissionCount?: number;
}

const HomePageRedesign = ({ onCreateNew, onNavigateToDashboard, onEditCourse, onNavigateToPrompts, onNavigateToQA, onNavigateToKnowledgeBase, onNavigateToAgents, onNavigateToUsage, onNavigateToSpeedAnalytics }: { onCreateNew: (mode: string, product?: 'lesson' | 'podcast' | 'exam' | 'activity') => void, onNavigateToDashboard: () => void, onEditCourse?: (courseId: string) => void, onNavigateToPrompts?: () => void, onNavigateToQA?: () => void, onNavigateToKnowledgeBase?: () => void, onNavigateToAgents?: () => void, onNavigateToUsage?: () => void, onNavigateToSpeedAnalytics?: () => void }) => {
    const { currentUser, isAdmin } = useAuth();
    const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(true);
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
                    console.warn("📝 Missing Firestore index, using client-side sort. Create index for better performance:", indexError?.message);
                    const fallbackQuery = query(
                        collection(db, "courses"),
                        where("teacherId", "==", currentUser.uid)
                    );
                    coursesSnapshot = await getDocs(fallbackQuery);
                }

                const activities: RecentActivity[] = [];
                const courseIds: string[] = [];

                console.log("📊 Courses found:", coursesSnapshot.size, "for user:", currentUser.uid);
                coursesSnapshot.forEach(doc => {
                    const data = doc.data();
                    courseIds.push(doc.id);
                    console.log("📝 Course:", doc.id, "Title:", data.title, "createdAt:", data.createdAt);

                    // Determine type based on mode or syllabus
                    let type: 'test' | 'activity' | 'lesson' = 'activity';
                    if (data.mode === 'exam') type = 'test';
                    else if (data.mode === 'lesson') type = 'lesson';
                    else if (data.syllabus && data.syllabus.some((s: any) => s.questions?.length > 0)) type = 'test';

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
                // Filter out activities with invalid timestamps first, then sort
                const validActivities = activities.filter(a => {
                    const hasValidTimestamp = a.createdAt?.seconds || a.createdAt?.toMillis;
                    return hasValidTimestamp;
                });

                validActivities.sort((a, b) => {
                    const aTime = a.createdAt?.toMillis?.() || (a.createdAt?.seconds * 1000) || 0;
                    const bTime = b.createdAt?.toMillis?.() || (b.createdAt?.seconds * 1000) || 0;
                    return bTime - aTime;
                });

                console.log("📊 Valid activities after sort:", validActivities.slice(0, 3).map(a => a.title));

                // Fetch submission counts for recent courses
                const recentCourseIds = validActivities.slice(0, 5).map(a => a.id);
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

                    // Update activities with submission counts
                    validActivities.forEach(activity => {
                        activity.submissionCount = submissionCounts[activity.id] || 0;
                    });
                }

                setRecentActivities(validActivities.slice(0, 3));
            } catch (error: any) {
                console.error("❌ Error fetching recent activities:", error);
                console.error("Error code:", error?.code);
                console.error("Error message:", error?.message);
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

    const handleCardClick = (actionName: string, callback: () => void) => {
        console.log(`🚀 Clicked card: ${actionName}`);
        callback();
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-8 font-sans">
            {/* Hero Section */}
            <section className="relative mb-12" aria-labelledby="hero-title">
                {/* Background Blobs - reduced motion support */}
                <div className="absolute -top-20 -right-20 w-72 h-72 bg-wizdi-cyan/20 rounded-full blur-3xl animate-blob pointer-events-none motion-reduce:animate-none"></div>
                <div className="absolute -bottom-10 -left-20 w-64 h-64 bg-wizdi-action/20 rounded-full blur-3xl animate-blob animation-delay-2000 pointer-events-none motion-reduce:animate-none"></div>

                <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
                    {/* Text Content */}
                    <div className="flex-1 text-center lg:text-right animate-slideUp motion-reduce:animate-none">
                        <p className="text-base text-slate-500 dark:text-slate-400 mb-3">
                            {getTimeBasedGreeting()}, {firstName}
                        </p>
                        <h1 id="hero-title" className="text-4xl lg:text-6xl font-black bg-gradient-to-l from-wizdi-royal via-violet-600 to-wizdi-cyan bg-clip-text text-transparent mb-4 leading-tight">
                            <IconMagicWand className="w-8 h-8 lg:w-12 lg:h-12 text-wizdi-royal inline-block align-middle ml-2" />
                            סטודיו יצירה חכם
                        </h1>
                        <p className="text-xl lg:text-2xl text-slate-600 dark:text-slate-300 font-medium max-w-lg mx-auto lg:mx-0">
                            צרו תכנים לימודיים מדהימים בעזרת AI - שיעורים, מבחנים ופעילויות אינטראקטיביות
                        </p>
                    </div>

                    {/* Illustration */}
                    <div className="flex-1 max-w-2xl hidden lg:block" aria-hidden="true">
                        <div className="relative">
                            {/* Magic Sparkle Stars */}
                            <svg className="absolute -top-2 -right-6 w-6 h-6 text-wizdi-cyan animate-pulse motion-reduce:animate-none" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"/>
                            </svg>
                            <svg className="absolute top-1/4 -right-8 w-4 h-4 text-wizdi-lime animate-pulse animation-delay-2000 motion-reduce:animate-none" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"/>
                            </svg>
                            <svg className="absolute -bottom-2 -left-4 w-5 h-5 text-wizdi-action animate-pulse animation-delay-4000 motion-reduce:animate-none" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"/>
                            </svg>
                            <svg className="absolute top-1/2 -left-8 w-3 h-3 text-wizdi-royal animate-pulse motion-reduce:animate-none" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"/>
                            </svg>
                            <svg className="absolute bottom-1/4 -right-4 w-4 h-4 text-amber-400 animate-pulse animation-delay-2000 motion-reduce:animate-none" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"/>
                            </svg>

                            <img
                                src="/images/hero-illustration.png"
                                alt="AI Education Illustration"
                                className="relative z-10 w-full max-w-2xl h-auto object-contain drop-shadow-xl"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Quick Actions Pills - Decorative only */}
            <section className="mb-12" aria-label="סוגי תוכן זמינים">
                <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                    <div className="flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-base">
                        <IconVideo className="w-5 h-5 text-wizdi-cyan" aria-hidden="true" />
                        מסרטון
                    </div>
                    <div className="flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-base">
                        <IconFileText className="w-5 h-5 text-wizdi-royal" aria-hidden="true" />
                        מקובץ
                    </div>
                    <div className="flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-base">
                        <IconPencil className="w-5 h-5 text-wizdi-action" aria-hidden="true" />
                        מטקסט
                    </div>
                    <div className="flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-base">
                        <IconFlask className="w-5 h-5 text-amber-500" aria-hidden="true" />
                        מנושא
                    </div>
                    <div className="flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-base">
                        <IconBook className="w-5 h-5 text-emerald-500" aria-hidden="true" />
                        מספר לימוד
                    </div>
                </div>
            </section>

            {/* Main Section - Content Creation Studio */}
            <section className="mb-8" aria-label="סטודיו יצירת תוכן">
                    <div className="card-glass rounded-3xl p-8 border border-slate-200/80 dark:border-slate-700 dark:bg-slate-800/80 bg-gradient-to-br from-white to-slate-50/30">
                        <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 bg-gradient-to-br from-wizdi-royal to-wizdi-cyan rounded-2xl flex items-center justify-center shadow-lg" aria-hidden="true">
                                        <IconSparkles className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-wizdi-royal dark:text-wizdi-cyan">יצירת תוכן לימודי</h2>
                                        <p className="text-slate-600 dark:text-slate-300 text-base font-medium">בחרו את סוג התוכן שתרצו ליצור</p>
                                    </div>
                                </div>
                                <span className="bg-wizdi-action-light text-wizdi-action-dark text-xs px-3 py-1.5 rounded-full font-bold">פופולרי</span>
                            </div>

                            {/* 4 Sub-buttons Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4" role="group" aria-label="סוגי תוכן ליצירה">
                                {/* מערך שיעור */}
                                <button
                                    onClick={() => handleCardClick("Lesson Plan", () => onCreateNew('learning', 'lesson'))}
                                    className="sub-btn group/btn bg-white dark:bg-slate-700 hover:bg-wizdi-cloud dark:hover:bg-slate-600 border-2 border-slate-100 dark:border-slate-600 hover:border-wizdi-royal rounded-2xl p-4 text-right transition-all duration-300 hover:-translate-y-1 hover:shadow-lg min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-royal focus-visible:ring-offset-2 motion-reduce:hover:transform-none"
                                    aria-label="יצירת מערך שיעור - בניית יחידת לימוד שלמה"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="icon-container w-12 h-12 bg-wizdi-royal/10 dark:bg-wizdi-royal/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover/btn:bg-wizdi-royal transition-colors" aria-hidden="true">
                                            <IconLayoutList className="w-6 h-6 text-wizdi-royal group-hover/btn:text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 dark:text-white mb-1">מערך שיעור</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">בניית יחידת לימוד שלמה הכוללת פתיחה, הקניה, תרגול וסיכום</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-wizdi-royal text-sm font-medium mt-3 group-hover/btn:translate-x-[-4px] transition-transform motion-reduce:group-hover/btn:transform-none" aria-hidden="true">
                                        התחל
                                        <IconChevronLeft className="w-4 h-4" />
                                    </div>
                                </button>

                                {/* פודקאסט AI */}
                                <button
                                    onClick={() => handleCardClick("Podcast", () => onCreateNew('learning', 'podcast'))}
                                    className="sub-btn group/btn bg-white dark:bg-slate-700 hover:bg-wizdi-cloud dark:hover:bg-slate-600 border-2 border-slate-100 dark:border-slate-600 hover:border-wizdi-royal rounded-2xl p-4 text-right transition-all duration-300 hover:-translate-y-1 hover:shadow-lg min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-royal focus-visible:ring-offset-2 motion-reduce:hover:transform-none"
                                    aria-label="יצירת פודקאסט AI - פרק אודיו מבוסס על התוכן"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="icon-container w-12 h-12 bg-wizdi-royal/10 dark:bg-wizdi-royal/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover/btn:bg-wizdi-royal transition-colors" aria-hidden="true">
                                            <IconMicrophone className="w-6 h-6 text-wizdi-royal group-hover/btn:text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 dark:text-white mb-1">פודקאסט AI</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">יצירת פרק אודיו המבוסס על התוכן, להאזנה ולמידה</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-wizdi-royal text-sm font-medium mt-3 group-hover/btn:translate-x-[-4px] transition-transform motion-reduce:group-hover/btn:transform-none" aria-hidden="true">
                                        התחל
                                        <IconChevronLeft className="w-4 h-4" />
                                    </div>
                                </button>

                                {/* פעילות לתלמיד */}
                                <button
                                    onClick={() => handleCardClick("Activity", () => onCreateNew('learning', 'activity'))}
                                    className="sub-btn group/btn bg-white dark:bg-slate-700 hover:bg-wizdi-cloud dark:hover:bg-slate-600 border-2 border-slate-100 dark:border-slate-600 hover:border-wizdi-royal rounded-2xl p-4 text-right transition-all duration-300 hover:-translate-y-1 hover:shadow-lg min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-royal focus-visible:ring-offset-2 motion-reduce:hover:transform-none"
                                    aria-label="יצירת פעילות לתלמיד - פעילות אינטראקטיבית"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="icon-container w-12 h-12 bg-wizdi-royal/10 dark:bg-wizdi-royal/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover/btn:bg-wizdi-royal transition-colors" aria-hidden="true">
                                            <IconMoodSmile className="w-6 h-6 text-wizdi-royal group-hover/btn:text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 dark:text-white mb-1">פעילות לתלמיד</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">פעילות אינטראקטיבית לתרגול וחזרה בצורה חווייתית</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-wizdi-royal text-sm font-medium mt-3 group-hover/btn:translate-x-[-4px] transition-transform motion-reduce:group-hover/btn:transform-none" aria-hidden="true">
                                        התחל
                                        <IconChevronLeft className="w-4 h-4" />
                                    </div>
                                </button>

                                {/* מבחן / בוחן */}
                                <button
                                    onClick={() => handleCardClick("Exam", () => onCreateNew('learning', 'exam'))}
                                    className="sub-btn group/btn bg-white dark:bg-slate-700 hover:bg-wizdi-cloud dark:hover:bg-slate-600 border-2 border-slate-100 dark:border-slate-600 hover:border-wizdi-royal rounded-2xl p-4 text-right transition-all duration-300 hover:-translate-y-1 hover:shadow-lg min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-royal focus-visible:ring-offset-2 motion-reduce:hover:transform-none"
                                    aria-label="יצירת מבחן או בוחן - שאלון הערכה עם ציונים"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="icon-container w-12 h-12 bg-wizdi-royal/10 dark:bg-wizdi-royal/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover/btn:bg-wizdi-royal transition-colors" aria-hidden="true">
                                            <IconClipboardCheck className="w-6 h-6 text-wizdi-royal group-hover/btn:text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 dark:text-white mb-1">מבחן / בוחן</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">שאלון הערכה מסכם לבדיקת ידע, עם ציונים ומשוב</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-wizdi-royal text-sm font-medium mt-3 group-hover/btn:translate-x-[-4px] transition-transform motion-reduce:group-hover/btn:transform-none" aria-hidden="true">
                                        התחל
                                        <IconChevronLeft className="w-4 h-4" />
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
            </section>

            {/* How It Works - Compact */}
            <section className="mb-8" aria-labelledby="how-it-works-title">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-6">
                        <h2 id="how-it-works-title" className="text-xl font-bold text-slate-800 dark:text-white mb-1">איך זה עובד?</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">ארבעה שלבים פשוטים ליצירת תוכן מדהים</p>
                    </div>

                    <ol className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="שלבי תהליך היצירה">
                        <li className="text-center p-4 bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-800 dark:to-slate-700/50 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 dark:border-slate-700">
                            <div className="w-12 h-12 bg-wizdi-royal/8 dark:bg-wizdi-royal/15 rounded-xl flex items-center justify-center mx-auto mb-3 relative" aria-hidden="true">
                                <IconUpload className="w-6 h-6 text-wizdi-royal" />
                                <span className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-wizdi-royal text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow">1</span>
                            </div>
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-0.5">העלאה</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">בחרו קובץ, סרטון או נושא</p>
                        </li>

                        <li className="text-center p-4 bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-800 dark:to-slate-700/50 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 dark:border-slate-700">
                            <div className="w-12 h-12 bg-wizdi-royal/8 dark:bg-wizdi-royal/15 rounded-xl flex items-center justify-center mx-auto mb-3 relative" aria-hidden="true">
                                <IconSparkles className="w-6 h-6 text-wizdi-royal" />
                                <span className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-wizdi-royal text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow">2</span>
                            </div>
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-0.5">יצירה</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">ה-AI בונה את התוכן</p>
                        </li>

                        <li className="text-center p-4 bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-800 dark:to-slate-700/50 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 dark:border-slate-700">
                            <div className="w-12 h-12 bg-wizdi-royal/8 dark:bg-wizdi-royal/15 rounded-xl flex items-center justify-center mx-auto mb-3 relative" aria-hidden="true">
                                <IconShare className="w-6 h-6 text-wizdi-royal" />
                                <span className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-wizdi-royal text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow">3</span>
                            </div>
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-0.5">שיתוף</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">שלחו לתלמידים</p>
                        </li>

                        <li className="text-center p-4 bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-800 dark:to-slate-700/50 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 dark:border-slate-700">
                            <div className="w-12 h-12 bg-wizdi-royal/8 dark:bg-wizdi-royal/15 rounded-xl flex items-center justify-center mx-auto mb-3 relative" aria-hidden="true">
                                <IconChart className="w-6 h-6 text-wizdi-royal" />
                                <span className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-wizdi-royal text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow">4</span>
                            </div>
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-0.5">מעקב</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">קבלו דוחות ותובנות</p>
                        </li>
                    </ol>
                </div>
            </section>

            {/* Teaching Agents & Prompts - Equal Priority Grid */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" aria-label="כלי הוראה מוכנים">
                {/* Teaching Agents Card - Disabled, Coming Soon */}
                <div
                    className="group w-full text-right rounded-3xl opacity-60 cursor-not-allowed"
                    aria-label="מאגר סוכני הוראה - בקרוב"
                >
                    <div className="card-glass rounded-3xl p-6 border border-slate-200 dark:border-slate-700 h-full relative overflow-hidden">
                        <div className="flex flex-col h-full">
                            {/* Header */}
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-14 h-14 min-w-[56px] min-h-[56px] bg-gradient-to-br from-slate-400 to-slate-500 rounded-2xl flex items-center justify-center shadow-lg" aria-hidden="true">
                                    <IconRobot className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-full">
                                            בקרוב
                                        </span>
                                    </div>
                                    <h2 className="text-xl font-black text-slate-500 dark:text-slate-400">
                                        מאגר סוכני הוראה
                                    </h2>
                                    <p className="text-slate-400 dark:text-slate-500 text-base">עוזרי AI לתלמידים</p>
                                </div>
                            </div>

                            {/* Description */}
                            <p className="text-slate-400 dark:text-slate-500 text-sm mb-4">
                                עוזרי AI מותאמים לנושאים ספציפיים. התלמידים מתרגלים, הסוכן עוזר צעד אחר צעד.
                            </p>

                            {/* Preview Agents */}
                            <div className="flex-grow">
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 rounded-xl">
                                        <div className="w-6 h-6 bg-slate-200 dark:bg-slate-600 rounded-lg flex items-center justify-center" aria-hidden="true">
                                            <IconMath className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-400 dark:text-slate-500">עוזר שברים</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 rounded-xl">
                                        <div className="w-6 h-6 bg-slate-200 dark:bg-slate-600 rounded-lg flex items-center justify-center" aria-hidden="true">
                                            <IconLanguage className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-400 dark:text-slate-500">English Buddy</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 rounded-xl">
                                        <div className="w-6 h-6 bg-slate-200 dark:bg-slate-600 rounded-lg flex items-center justify-center" aria-hidden="true">
                                            <IconMath className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-400 dark:text-slate-500">מורה לאלגברה</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 rounded-xl">
                                        <div className="w-6 h-6 bg-slate-200 dark:bg-slate-600 rounded-lg flex items-center justify-center" aria-hidden="true">
                                            <IconBook className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-400 dark:text-slate-500">חברותא לתנ"ך</span>
                                    </div>
                                </div>
                            </div>

                            {/* CTA - Disabled */}
                            <div className="flex items-center gap-2 font-bold text-slate-400 dark:text-slate-500 text-sm">
                                בקרוב...
                            </div>
                        </div>
                    </div>
                </div>

                {/* Prompts Library Card */}
                <button
                    onClick={() => handleCardClick("Prompts Library", () => onNavigateToPrompts?.())}
                    className="group cursor-pointer w-full text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 rounded-3xl"
                    aria-label="כניסה למאגר פרומפטים AI"
                >
                    <div className="card-glass rounded-3xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-200/80 dark:border-slate-700 motion-reduce:hover:transform-none h-full bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-700/30">
                        <div className="flex flex-col h-full">
                            {/* Header */}
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-14 h-14 min-w-[56px] min-h-[56px] bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg motion-reduce:group-hover:transform-none" aria-hidden="true">
                                    <IconBulb className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-xl font-black text-violet-600 dark:text-violet-400">
                                        מאגר פרומפטים
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-base">מגוון פרומפטים מוכנים לצורכי ההוראה</p>
                                </div>
                            </div>

                            {/* Preview Categories */}
                            <div className="flex-grow">
                                <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">לדוגמה:</p>
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl">
                                        <div className="w-6 h-6 bg-wizdi-royal/20 rounded-lg flex items-center justify-center" aria-hidden="true">
                                            <IconSchool className="w-4 h-4 text-wizdi-royal" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">ניהול כיתה</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl">
                                        <div className="w-6 h-6 bg-pink-500/20 rounded-lg flex items-center justify-center" aria-hidden="true">
                                            <IconMessage className="w-4 h-4 text-pink-500" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">היבטים רגשיים</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl">
                                        <div className="w-6 h-6 bg-wizdi-cyan/20 rounded-lg flex items-center justify-center" aria-hidden="true">
                                            <IconClipboardCheck className="w-4 h-4 text-wizdi-cyan" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">הערכת לומדים</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl">
                                        <div className="w-6 h-6 bg-wizdi-lime/30 rounded-lg flex items-center justify-center" aria-hidden="true">
                                            <IconDeviceGamepad2 className="w-4 h-4 text-wizdi-lime" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">משחקים</span>
                                    </div>
                                </div>
                            </div>

                            {/* CTA */}
                            <div className="flex items-center gap-2 font-bold text-violet-600 dark:text-violet-400 text-sm group-hover:translate-x-[-4px] transition-transform motion-reduce:group-hover:transform-none">
                                כניסה למאגר
                                <IconChevronLeft className="w-4 h-4" />
                            </div>
                        </div>
                    </div>
                </button>
            </section>

            {/* Secondary Section - Recent Activities + Dashboard */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8" aria-label="פעילויות ולוח בקרה">
                {/* Recent Activity */}
                <div className="card-glass rounded-2xl p-5 dark:bg-slate-800/80 bg-gradient-to-br from-white to-slate-50/50 border border-slate-200/80 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-14 h-14 min-w-[56px] min-h-[56px] bg-gradient-to-br from-wizdi-royal to-wizdi-cyan rounded-2xl flex items-center justify-center shadow-lg" aria-hidden="true">
                                <IconHistory className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="font-bold text-slate-800 dark:text-white">פעילויות אחרונות</h3>
                        </div>
                        <button
                            onClick={onNavigateToDashboard}
                            className="text-wizdi-royal dark:text-wizdi-cyan text-xs font-medium hover:underline min-h-[44px] px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-royal rounded"
                            aria-label="צפייה בכל הפעילויות"
                        >
                            הכל
                        </button>
                    </div>

                    <div className="space-y-2" role="list" aria-label="רשימת פעילויות אחרונות">
                        {loadingActivities ? (
                            <div className="flex items-center justify-center py-4" role="status" aria-label="טוען פעילויות">
                                <AIStarsSpinner size="md" color="primary" label="טוען פעילויות..." />
                            </div>
                        ) : recentActivities.length === 0 ? (
                            <div className="text-center py-4 text-slate-400 dark:text-slate-500">
                                <IconSparkles className="w-8 h-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
                                <p className="text-sm">אין פעילויות עדיין</p>
                            </div>
                        ) : (
                            recentActivities.slice(0, 3).map((activity) => {
                                const getActivityIcon = () => {
                                    if (activity.type === 'test') return <IconList className="w-4 h-4 text-wizdi-cyan" />;
                                    if (activity.type === 'lesson') return <IconVideo className="w-4 h-4 text-wizdi-action" />;
                                    return <IconSparkles className="w-4 h-4 text-wizdi-royal" />;
                                };

                                const getActivityBgColor = () => {
                                    if (activity.type === 'test') return 'bg-wizdi-cyan/10 dark:bg-wizdi-cyan/20';
                                    if (activity.type === 'lesson') return 'bg-wizdi-action-light dark:bg-wizdi-action/20';
                                    return 'bg-wizdi-royal/10 dark:bg-wizdi-royal/20';
                                };

                                const getActivityTypeLabel = () => {
                                    if (activity.type === 'test') return 'מבחן';
                                    if (activity.type === 'lesson') return 'שיעור';
                                    return 'פעילות';
                                };

                                return (
                                    <button
                                        key={activity.id}
                                        onClick={() => onEditCourse?.(activity.id)}
                                        className="flex items-center gap-3 p-2 min-h-[44px] w-full bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer group text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-royal focus-visible:ring-offset-2"
                                        role="listitem"
                                        aria-label={`${getActivityTypeLabel()}: ${activity.title}${activity.submissionCount && activity.submissionCount > 0 ? `, ${activity.submissionCount} הגשות` : ''}`}
                                    >
                                        <div className={`w-8 h-8 ${getActivityBgColor()} rounded-lg flex items-center justify-center flex-shrink-0`} aria-hidden="true">
                                            {getActivityIcon()}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{activity.title}</p>
                                        </div>
                                        {activity.submissionCount && activity.submissionCount > 0 && (
                                            <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-medium" aria-hidden="true">
                                                {activity.submissionCount}
                                            </span>
                                        )}
                                        <IconChevronLeft className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-wizdi-royal dark:group-hover:text-wizdi-cyan transition-colors" aria-hidden="true" />
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Dashboard */}
                <button
                    onClick={() => handleCardClick("Dashboard", onNavigateToDashboard)}
                    className="group cursor-pointer text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 rounded-2xl"
                    aria-label="כניסה ללוח בקרה"
                >
                    <div className="card-glass rounded-2xl p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden h-full border border-slate-200 dark:border-slate-700 motion-reduce:hover:transform-none">
                        {/* Chart decoration */}
                        <div className="absolute bottom-0 left-0 right-0 h-12 opacity-30" aria-hidden="true">
                            <svg viewBox="0 0 200 50" preserveAspectRatio="none" className="w-full h-full">
                                <defs>
                                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" style={{ stopColor: '#2B59C3', stopOpacity: 1 }} />
                                        <stop offset="100%" style={{ stopColor: '#2B59C3', stopOpacity: 0 }} />
                                    </linearGradient>
                                </defs>
                                <path d="M0,50 L20,35 L40,42 L60,28 L80,38 L100,22 L120,30 L140,18 L160,25 L180,12 L200,20 L200,50 Z" fill="url(#chartGradient)"/>
                            </svg>
                        </div>

                        <div className="relative z-10 flex items-center gap-4">
                            <div className="w-14 h-14 min-w-[56px] min-h-[56px] bg-gradient-to-br from-slate-600 to-slate-800 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg motion-reduce:group-hover:transform-none" aria-hidden="true">
                                <IconChart className="w-7 h-7 text-white" />
                            </div>
                            <div className="flex-grow">
                                <h2 className="text-lg font-black text-slate-800 dark:text-white">לוח בקרה</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">צפייה בנתונים ומעקב התקדמות</p>
                            </div>
                            <div className="flex items-center gap-2 font-bold text-slate-600 dark:text-slate-400 text-sm group-hover:translate-x-[-8px] transition-transform motion-reduce:group-hover:transform-none" aria-hidden="true">
                                כניסה
                                <IconChevronLeft className="w-4 h-4" />
                            </div>
                        </div>
                    </div>
                </button>
            </section>

            {/* AI Blog - Compact News Section */}
            <section className="mb-8">
                <AIBlogWidget compact={true} showFeatured={true} maxItems={1} />
            </section>


            {/* Floating Button for Mobile */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:hidden z-fixed" aria-label="יצירה מהירה">
                <button
                    onClick={() => onCreateNew('learning')}
                    className="btn-lip-action px-8 py-4 min-h-[44px] shadow-xl flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wizdi-action"
                    aria-label="יצירת תוכן לימודי חדש"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    יצירה חדשה
                </button>
            </div>

            {/* Admin Buttons */}
            <nav className="text-center py-4 flex justify-center gap-4" aria-label="ניהול מערכת">
                {onNavigateToQA && (
                    <button
                        onClick={() => onNavigateToQA()}
                        className="text-slate-400 dark:text-slate-500 text-xs hover:text-wizdi-royal dark:hover:text-wizdi-cyan transition-colors px-3 py-2 min-h-[44px] rounded hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-royal"
                        aria-label="כניסה לממשק QA Admin"
                    >
                        QA Admin
                    </button>
                )}
                {onNavigateToKnowledgeBase && (
                    <button
                        onClick={() => onNavigateToKnowledgeBase()}
                        className="text-slate-400 dark:text-slate-500 text-xs hover:text-wizdi-royal dark:hover:text-wizdi-cyan transition-colors px-3 py-2 min-h-[44px] rounded hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-royal"
                        aria-label="כניסה לניהול בסיס ידע"
                    >
                        בסיס ידע
                    </button>
                )}
                {onNavigateToUsage && (
                    <button
                        onClick={() => onNavigateToUsage()}
                        className="text-slate-400 dark:text-slate-500 text-xs hover:text-wizdi-royal dark:hover:text-wizdi-cyan transition-colors px-3 py-2 min-h-[44px] rounded hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-royal"
                        aria-label="דשבורד שימוש"
                    >
                        שימוש AI
                    </button>
                )}
                {onNavigateToSpeedAnalytics && (
                    <button
                        onClick={() => onNavigateToSpeedAnalytics()}
                        className="text-slate-400 dark:text-slate-500 text-xs hover:text-wizdi-royal dark:hover:text-wizdi-cyan transition-colors px-3 py-2 min-h-[44px] rounded hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-royal"
                        aria-label="מהירות יצירה"
                    >
                        מהירות יצירה
                    </button>
                )}
            </nav>

            <style>{`
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                .animate-blob { animation: blob 7s infinite; }
                .animation-delay-2000 { animation-delay: 2s; }

                /* Respect reduced motion preference */
                @media (prefers-reduced-motion: reduce) {
                    .animate-blob,
                    .animate-float,
                    .animate-pulse {
                        animation: none;
                    }
                }

                /* Gradient border for main card - now with violet */
                .gradient-border {
                    position: relative;
                }
                .gradient-border::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: inherit;
                    padding: 3px;
                    background: linear-gradient(135deg, #00C2FF, #8B5CF6, #FFD500);
                    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    -webkit-mask-composite: xor;
                    mask-composite: exclude;
                    pointer-events: none;
                }

            `}</style>
        </div>
    );
};

export default HomePageRedesign;
