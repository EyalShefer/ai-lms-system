import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    IconSparkles,
    IconChart,
    IconList
} from '../icons';
import { IconUpload, IconShare, IconVideo, IconFileText, IconPencil, IconFlask, IconChevronLeft, IconMicrophone, IconMoodSmile, IconClipboardCheck, IconLayoutList, IconBulb } from '@tabler/icons-react';
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

const HomePageRedesign = ({ onCreateNew, onNavigateToDashboard, onEditCourse, onNavigateToPrompts, onNavigateToQA, onNavigateToKnowledgeBase }: { onCreateNew: (mode: string, product?: 'lesson' | 'podcast' | 'exam' | 'game') => void, onNavigateToDashboard: () => void, onEditCourse?: (courseId: string) => void, onNavigateToPrompts?: () => void, onNavigateToQA?: () => void, onNavigateToKnowledgeBase?: () => void }) => {
    const { currentUser } = useAuth();
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
                // Fetch recent courses
                const coursesQuery = query(
                    collection(db, "courses"),
                    where("teacherId", "==", currentUser.uid),
                    orderBy("createdAt", "desc"),
                    limit(5)
                );
                const coursesSnapshot = await getDocs(coursesQuery);

                const activities: RecentActivity[] = [];
                const courseIds: string[] = [];

                coursesSnapshot.forEach(doc => {
                    const data = doc.data();
                    courseIds.push(doc.id);

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

                // Fetch submission counts for each course
                if (courseIds.length > 0) {
                    const submissionsQuery = query(
                        collection(db, "submissions"),
                        where("teacherId", "==", currentUser.uid),
                        where("courseId", "in", courseIds)
                    );
                    const submissionsSnapshot = await getDocs(submissionsQuery);

                    const submissionCounts: Record<string, number> = {};
                    submissionsSnapshot.forEach(doc => {
                        const courseId = doc.data().courseId;
                        submissionCounts[courseId] = (submissionCounts[courseId] || 0) + 1;
                    });

                    // Update activities with submission counts
                    activities.forEach(activity => {
                        activity.submissionCount = submissionCounts[activity.id] || 0;
                    });
                }

                setRecentActivities(activities.slice(0, 3));
            } catch (error: any) {
                console.error("❌ Error fetching recent activities:", error);
                console.error("Error code:", error?.code);
                console.error("Error message:", error?.message);
                // If it's a missing index error, the message will contain a link to create the index
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
                        <div className="inline-flex items-center gap-2 bg-wizdi-action-light text-wizdi-royal dark:text-wizdi-action px-4 py-2 rounded-full text-sm font-medium mb-4">
                            <span className="w-2 h-2 bg-wizdi-action rounded-full animate-pulse motion-reduce:animate-none" aria-hidden="true"></span>
                            סטודיו יצירה חכם
                        </div>
                        <h1 id="hero-title" className="text-4xl lg:text-5xl font-black text-slate-800 dark:text-white mb-4 leading-tight">
                            {getTimeBasedGreeting()}, {firstName}!
                        </h1>
                        <p className="text-lg text-slate-500 dark:text-slate-300 mb-8 max-w-md mx-auto lg:mx-0">
                            צרו תכנים לימודיים מדהימים בעזרת AI - שיעורים, מבחנים ופעילויות אינטראקטיביות
                        </p>

                        {/* Primary CTA - 44px min touch target */}
                        <button
                            onClick={() => handleCardClick("Main CTA", () => onCreateNew('learning'))}
                            className="btn-lip-action text-lg px-8 py-4 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2"
                            aria-label="התחילו ליצור תוכן לימודי חדש"
                        >
                            <span className="flex items-center gap-2">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                                התחילו ליצור עכשיו
                            </span>
                        </button>
                    </div>

                    {/* Illustration */}
                    <div className="flex-1 max-w-md hidden lg:block" aria-hidden="true">
                        <div className="relative">
                            <div className="absolute -top-4 -right-4 w-20 h-20 bg-wizdi-royal/20 rounded-2xl rotate-12 animate-float motion-reduce:animate-none"></div>
                            <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-wizdi-royal/15 rounded-full animate-float animation-delay-2000 motion-reduce:animate-none"></div>

                            <div className="card-glass rounded-3xl p-8 shadow-xl relative z-10 dark:bg-slate-800/80">
                                <div className="flex items-center justify-center">
                                    {/* Modular blocks grid with AI sparkle */}
                                    <div className="relative w-36 h-36">
                                        {/* Grid of modular blocks */}
                                        <div className="grid grid-cols-3 grid-rows-3 gap-1.5 w-full h-full">
                                            {/* Row 1 */}
                                            <div className="bg-wizdi-royal/20 rounded-lg"></div>
                                            <div className="bg-wizdi-royal/40 rounded-lg"></div>
                                            <div className="bg-wizdi-royal/15 rounded-lg"></div>
                                            {/* Row 2 */}
                                            <div className="bg-wizdi-royal/30 rounded-lg"></div>
                                            <div className="bg-gradient-to-br from-wizdi-royal to-blue-700 rounded-xl shadow-lg flex items-center justify-center">
                                                <IconSparkles className="w-6 h-6 text-white" />
                                            </div>
                                            <div className="bg-wizdi-royal/35 rounded-lg"></div>
                                            {/* Row 3 */}
                                            <div className="bg-wizdi-royal/10 rounded-lg"></div>
                                            <div className="bg-wizdi-royal/25 rounded-lg"></div>
                                            <div className="bg-wizdi-royal/45 rounded-lg"></div>
                                        </div>
                                        {/* Floating sparkle accent */}
                                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-wizdi-gold rounded-full flex items-center justify-center shadow-md">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L9.19 8.63L2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-center text-slate-500 dark:text-slate-400 mt-6 text-sm">יצירת תוכן לימודי בלחיצה אחת</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Quick Actions Pills */}
            <section className="mb-12" aria-label="יצירה מהירה">
                <div className="flex flex-wrap gap-3 justify-center lg:justify-start" role="group" aria-label="אפשרויות יצירה מהירה">
                    <button
                        onClick={() => handleCardClick("Video", () => onCreateNew('learning'))}
                        className="flex items-center gap-2 px-6 py-3.5 min-h-[44px] rounded-full font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-wizdi-cyan hover:bg-wizdi-cloud dark:hover:bg-slate-700 transition-all text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2"
                        aria-label="יצירה מסרטון"
                    >
                        <IconVideo className="w-5 h-5 text-wizdi-cyan" aria-hidden="true" />
                        מסרטון
                    </button>
                    <button
                        onClick={() => handleCardClick("File", () => onCreateNew('learning'))}
                        className="flex items-center gap-2 px-6 py-3.5 min-h-[44px] rounded-full font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-wizdi-royal hover:bg-wizdi-cloud dark:hover:bg-slate-700 transition-all text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-royal focus-visible:ring-offset-2"
                        aria-label="יצירה מקובץ"
                    >
                        <IconFileText className="w-5 h-5 text-wizdi-royal" aria-hidden="true" />
                        מקובץ
                    </button>
                    <button
                        onClick={() => handleCardClick("Text", () => onCreateNew('learning'))}
                        className="flex items-center gap-2 px-6 py-3.5 min-h-[44px] rounded-full font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-wizdi-action hover:bg-wizdi-cloud dark:hover:bg-slate-700 transition-all text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-action focus-visible:ring-offset-2"
                        aria-label="יצירה מטקסט"
                    >
                        <IconPencil className="w-5 h-5 text-wizdi-action" aria-hidden="true" />
                        מטקסט
                    </button>
                    <button
                        onClick={() => handleCardClick("Topic", () => onCreateNew('learning'))}
                        className="flex items-center gap-2 px-6 py-3.5 min-h-[44px] rounded-full font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-wizdi-gold hover:bg-wizdi-cloud dark:hover:bg-slate-700 transition-all text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-gold focus-visible:ring-offset-2"
                        aria-label="יצירה מנושא"
                    >
                        <IconFlask className="w-5 h-5 text-amber-500" aria-hidden="true" />
                        מנושא
                    </button>
                </div>
            </section>

            {/* Main Section - Studio + Prompts */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8" aria-label="כלי יצירה">

                {/* Card 1: Create Learning Content - With 4 Sub-buttons */}
                <div className="lg:col-span-2">
                    <div className="card-glass rounded-3xl p-8 h-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800/80">
                        <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 bg-gradient-to-br from-wizdi-royal to-wizdi-cyan rounded-2xl flex items-center justify-center shadow-lg" aria-hidden="true">
                                        <IconSparkles className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-800 dark:text-white">יצירת תוכן לימודי</h2>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">בחרו את סוג התוכן שתרצו ליצור</p>
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
                                    onClick={() => handleCardClick("Activity", () => onCreateNew('learning', 'game'))}
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
                </div>

                {/* Prompts Library Card - Priority #2 */}
                <div className="lg:col-span-1">
                    <button
                        onClick={() => handleCardClick("Prompts Library", () => onNavigateToPrompts?.())}
                        className="group cursor-pointer h-full w-full text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 rounded-3xl"
                        aria-label="כניסה למאגר פרומפטים AI"
                    >
                        <div className="card-glass rounded-3xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col border border-slate-200 dark:border-slate-700 motion-reduce:hover:transform-none">
                            <div className="flex flex-col h-full">
                                <div className="w-12 h-12 min-w-[44px] min-h-[44px] bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg motion-reduce:group-hover:transform-none" aria-hidden="true">
                                    <IconBulb className="w-6 h-6 text-white" />
                                </div>

                                <h2 className="text-xl font-black mb-2 text-slate-800 dark:text-white">
                                    מאגר פרומפטים AI
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 flex-grow">
                                    פרומפטים מוכנים לכל צורך הוראתי - בדיקת עבודות, יצירת תוכן, משוב לתלמידים ועוד
                                </p>

                                <div className="flex items-center gap-2 font-bold text-violet-600 dark:text-violet-400 text-sm group-hover:translate-x-[-4px] transition-transform motion-reduce:group-hover:transform-none" aria-hidden="true">
                                    כניסה למאגר
                                    <IconChevronLeft className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </button>
                </div>

            </section>

            {/* Secondary Section - Recent Activities + Dashboard */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8" aria-label="פעילויות ולוח בקרה">
                {/* Recent Activity */}
                <div className="card-glass rounded-2xl p-5 dark:bg-slate-800/80">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 min-w-[40px] min-h-[40px] bg-wizdi-gold/20 dark:bg-wizdi-gold/30 rounded-xl flex items-center justify-center" aria-hidden="true">
                                <svg className="w-5 h-5 text-wizdi-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
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
                                <div className="animate-spin w-6 h-6 border-2 border-wizdi-royal border-t-transparent rounded-full motion-reduce:animate-none"></div>
                                <span className="sr-only">טוען פעילויות...</span>
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
                            <div className="w-12 h-12 min-w-[44px] min-h-[44px] bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg motion-reduce:group-hover:transform-none" aria-hidden="true">
                                <IconChart className="w-6 h-6 text-white" />
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

            {/* How It Works */}
            <section className="mb-12" aria-labelledby="how-it-works-title">
                <div className="text-center mb-8">
                    <h2 id="how-it-works-title" className="text-2xl font-bold text-slate-800 dark:text-white mb-2">איך זה עובד?</h2>
                    <p className="text-slate-500 dark:text-slate-400">ארבעה שלבים פשוטים ליצירת תוכן מדהים</p>
                </div>

                <ol className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-label="שלבי תהליך היצירה">
                    <li className="text-center p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 dark:border-slate-700">
                        <div className="w-14 h-14 bg-wizdi-royal/10 dark:bg-wizdi-royal/20 rounded-2xl flex items-center justify-center mx-auto mb-4 relative" aria-hidden="true">
                            <IconUpload className="w-7 h-7 text-wizdi-royal" />
                            <span className="absolute -top-2 -left-2 w-6 h-6 bg-wizdi-royal text-white rounded-full text-xs font-bold flex items-center justify-center shadow">1</span>
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white mb-1">העלאה</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">בחרו קובץ, סרטון או נושא</p>
                    </li>

                    <li className="text-center p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 dark:border-slate-700">
                        <div className="w-14 h-14 bg-wizdi-royal/10 dark:bg-wizdi-royal/20 rounded-2xl flex items-center justify-center mx-auto mb-4 relative" aria-hidden="true">
                            <IconSparkles className="w-7 h-7 text-wizdi-royal" />
                            <span className="absolute -top-2 -left-2 w-6 h-6 bg-wizdi-royal text-white rounded-full text-xs font-bold flex items-center justify-center shadow">2</span>
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white mb-1">יצירה</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">ה-AI בונה את התוכן</p>
                    </li>

                    <li className="text-center p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 dark:border-slate-700">
                        <div className="w-14 h-14 bg-wizdi-royal/10 dark:bg-wizdi-royal/20 rounded-2xl flex items-center justify-center mx-auto mb-4 relative" aria-hidden="true">
                            <IconShare className="w-7 h-7 text-wizdi-royal" />
                            <span className="absolute -top-2 -left-2 w-6 h-6 bg-wizdi-royal text-white rounded-full text-xs font-bold flex items-center justify-center shadow">3</span>
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white mb-1">שיתוף</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">שלחו לתלמידים</p>
                    </li>

                    <li className="text-center p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 dark:border-slate-700">
                        <div className="w-14 h-14 bg-wizdi-royal/10 dark:bg-wizdi-royal/20 rounded-2xl flex items-center justify-center mx-auto mb-4 relative" aria-hidden="true">
                            <IconChart className="w-7 h-7 text-wizdi-royal" />
                            <span className="absolute -top-2 -left-2 w-6 h-6 bg-wizdi-royal text-white rounded-full text-xs font-bold flex items-center justify-center shadow">4</span>
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white mb-1">מעקב</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">קבלו דוחות ותובנות</p>
                    </li>
                </ol>
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
