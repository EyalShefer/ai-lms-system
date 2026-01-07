import { useAuth } from '../context/AuthContext';
import {
    IconSparkles,
    IconChart,
    IconBack,
    IconList
} from '../icons';
import { IconUpload, IconShare, IconBell, IconVideo, IconFileText, IconPencil, IconFlask } from '@tabler/icons-react';

const HomePageRedesign = ({ onCreateNew, onNavigateToDashboard }: { onCreateNew: (mode: string) => void, onNavigateToDashboard: () => void }) => {
    const { currentUser } = useAuth();
    const firstName = currentUser?.email?.split('@')[0] || "מורה";

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
            <section className="relative mb-12">
                {/* Background Blobs */}
                <div className="absolute -top-20 -right-20 w-72 h-72 bg-wizdi-cyan/20 rounded-full blur-3xl animate-blob pointer-events-none"></div>
                <div className="absolute -bottom-10 -left-20 w-64 h-64 bg-wizdi-lime/20 rounded-full blur-3xl animate-blob animation-delay-2000 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
                    {/* Text Content */}
                    <div className="flex-1 text-center lg:text-right animate-slideUp">
                        <div className="inline-flex items-center gap-2 bg-wizdi-lime/20 text-wizdi-royal px-4 py-2 rounded-full text-sm font-medium mb-4">
                            <span className="w-2 h-2 bg-wizdi-lime rounded-full animate-pulse"></span>
                            סטודיו יצירה חכם
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black text-slate-800 mb-4 leading-tight">
                            {getTimeBasedGreeting()}, {firstName}! <span className="inline-block animate-float">☀️</span>
                        </h1>
                        <p className="text-lg text-slate-500 mb-8 max-w-md mx-auto lg:mx-0">
                            צרו תכנים לימודיים מדהימים בעזרת AI - שיעורים, מבחנים ופעילויות אינטראקטיביות
                        </p>

                        {/* Primary CTA */}
                        <button
                            onClick={() => handleCardClick("Main CTA", () => onCreateNew('learning'))}
                            className="btn-lip-action text-lg px-8 py-4"
                        >
                            <span className="flex items-center gap-2">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                                התחילו ליצור עכשיו
                            </span>
                        </button>
                    </div>

                    {/* Illustration */}
                    <div className="flex-1 max-w-md hidden lg:block">
                        <div className="relative">
                            <div className="absolute -top-4 -right-4 w-20 h-20 bg-wizdi-lime/30 rounded-2xl rotate-12 animate-float"></div>
                            <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-wizdi-cyan/30 rounded-full animate-float animation-delay-2000"></div>

                            <div className="card-glass rounded-3xl p-8 shadow-xl relative z-10">
                                <div className="flex items-center justify-center">
                                    <div className="relative">
                                        <div className="w-32 h-32 bg-gradient-to-br from-wizdi-royal to-wizdi-cyan rounded-3xl flex items-center justify-center shadow-lg">
                                            <IconSparkles className="w-16 h-16 text-white" />
                                        </div>
                                        <div className="absolute -top-3 -left-3 w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                                            <IconVideo className="w-6 h-6 text-wizdi-cyan" />
                                        </div>
                                        <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                                            <IconList className="w-6 h-6 text-wizdi-lime" />
                                        </div>
                                        <div className="absolute top-1/2 -right-6 transform -translate-y-1/2 w-10 h-10 bg-wizdi-gold rounded-xl shadow-lg flex items-center justify-center">
                                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-center text-slate-500 mt-6 text-sm">יצירת תוכן לימודי בלחיצה אחת</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Quick Actions Pills */}
            <section className="mb-12">
                <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                    <button
                        onClick={() => handleCardClick("Video", () => onCreateNew('learning'))}
                        className="flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-slate-700 bg-white border-2 border-slate-100 hover:border-wizdi-cyan hover:bg-wizdi-cloud transition-all text-base"
                    >
                        <IconVideo className="w-5 h-5 text-wizdi-cyan" />
                        מסרטון
                    </button>
                    <button
                        onClick={() => handleCardClick("File", () => onCreateNew('learning'))}
                        className="flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-slate-700 bg-white border-2 border-slate-100 hover:border-wizdi-royal hover:bg-wizdi-cloud transition-all text-base"
                    >
                        <IconFileText className="w-5 h-5 text-wizdi-royal" />
                        מקובץ
                    </button>
                    <button
                        onClick={() => handleCardClick("Text", () => onCreateNew('learning'))}
                        className="flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-slate-700 bg-white border-2 border-slate-100 hover:border-wizdi-lime hover:bg-wizdi-cloud transition-all text-base"
                    >
                        <IconPencil className="w-5 h-5 text-lime-600" />
                        מטקסט
                    </button>
                    <button
                        onClick={() => handleCardClick("Topic", () => onCreateNew('learning'))}
                        className="flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-slate-700 bg-white border-2 border-slate-100 hover:border-wizdi-gold hover:bg-wizdi-cloud transition-all text-base"
                    >
                        <IconFlask className="w-5 h-5 text-amber-500" />
                        מנושא
                    </button>
                </div>
            </section>

            {/* Main Action Cards */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">

                {/* Card 1: Create Learning Content */}
                <div
                    onClick={() => handleCardClick("Learning Generator", () => onCreateNew('learning'))}
                    className="lg:col-span-2 group cursor-pointer"
                >
                    <div className="card-glass rounded-3xl p-8 h-full hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-3 border-transparent hover:border-wizdi-cyan/30">
                        <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-16 h-16 bg-gradient-to-br from-wizdi-royal to-wizdi-cyan rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                    <IconSparkles className="w-8 h-8 text-white" />
                                </div>
                                <span className="bg-wizdi-lime/20 text-lime-700 text-xs px-3 py-1.5 rounded-full font-bold">פופולרי</span>
                            </div>

                            <h2 className="text-2xl lg:text-3xl font-black text-slate-800 mb-3">
                                יצירת תוכן לימודי
                            </h2>
                            <p className="text-slate-500 mb-6 flex-grow">
                                צרו שיעורים אינטראקטיביים, פודקאסטים AI, ופעילויות תרגול מכל מקור - סרטון, קובץ, טקסט או נושא
                            </p>

                            <div className="flex flex-wrap gap-2 mb-6">
                                <span className="bg-slate-100 text-slate-600 text-xs px-3 py-1.5 rounded-full">שיעור</span>
                                <span className="bg-slate-100 text-slate-600 text-xs px-3 py-1.5 rounded-full">פודקאסט</span>
                                <span className="bg-slate-100 text-slate-600 text-xs px-3 py-1.5 rounded-full">פעילות</span>
                                <span className="bg-slate-100 text-slate-600 text-xs px-3 py-1.5 rounded-full">אינפוגרפיקה</span>
                            </div>

                            <div className="flex items-center gap-2 text-wizdi-royal font-bold group-hover:translate-x-[-8px] transition-transform">
                                התחילו ליצור
                                <IconBack className="w-5 h-5 rotate-180" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card 2: Create Exam */}
                <div
                    onClick={() => handleCardClick("Exam Creator", () => onCreateNew('exam'))}
                    className="group cursor-pointer"
                >
                    <div className="bg-gradient-to-br from-wizdi-royal to-indigo-800 rounded-3xl p-8 h-full text-white hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                        <div className="absolute bottom-0 right-0 w-24 h-24 bg-wizdi-cyan/20 rounded-full translate-x-1/2 translate-y-1/2"></div>

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <IconList className="w-7 h-7 text-white" />
                            </div>

                            <h2 className="text-2xl font-black mb-3">
                                יצירת מבחן
                            </h2>
                            <p className="text-blue-100 mb-6 flex-grow">
                                בניית שאלונים עם בדיקה אוטומטית וניתוח ציונים מפורט
                            </p>

                            <div className="flex items-center gap-2 font-bold group-hover:translate-x-[-8px] transition-transform">
                                צרו מבחן
                                <IconBack className="w-5 h-5 rotate-180" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card 3: Dashboard */}
                <div
                    onClick={() => handleCardClick("Dashboard", onNavigateToDashboard)}
                    className="group cursor-pointer"
                >
                    <div className="bg-slate-800 rounded-3xl p-8 h-full text-white hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
                        {/* Chart decoration */}
                        <div className="absolute bottom-0 left-0 right-0 h-20 opacity-20">
                            <svg viewBox="0 0 200 50" preserveAspectRatio="none" className="w-full h-full">
                                <defs>
                                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" style={{ stopColor: '#8CE81C', stopOpacity: 1 }} />
                                        <stop offset="100%" style={{ stopColor: '#8CE81C', stopOpacity: 0 }} />
                                    </linearGradient>
                                </defs>
                                <path d="M0,50 L20,35 L40,42 L60,28 L80,38 L100,22 L120,30 L140,18 L160,25 L180,12 L200,20 L200,50 Z" fill="url(#chartGradient)"/>
                            </svg>
                        </div>

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="w-14 h-14 bg-wizdi-lime rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <IconChart className="w-7 h-7 text-slate-800" />
                            </div>

                            <h2 className="text-2xl font-black mb-3">
                                לוח בקרה
                            </h2>
                            <p className="text-slate-300 mb-6 flex-grow">
                                צפייה בנתונים, מעקב התקדמות וניהול ציונים
                            </p>

                            <div className="flex items-center gap-2 font-bold text-wizdi-lime group-hover:translate-x-[-8px] transition-transform">
                                כניסה ללוח
                                <IconBack className="w-5 h-5 rotate-180" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card 4: Recent Activity */}
                <div className="lg:col-span-2">
                    <div className="card-glass rounded-3xl p-8 h-full">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-wizdi-gold/20 rounded-2xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-wizdi-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">פעילות אחרונה</h3>
                                    <p className="text-sm text-slate-500">הפעולות האחרונות שלך</p>
                                </div>
                            </div>
                            <button
                                onClick={onNavigateToDashboard}
                                className="text-wizdi-royal text-sm font-medium hover:underline"
                            >
                                צפה בהכל
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                                <div className="w-10 h-10 bg-wizdi-royal/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <IconSparkles className="w-5 h-5 text-wizdi-royal" />
                                </div>
                                <div className="flex-grow min-w-0">
                                    <p className="font-medium text-slate-700 truncate">שיעור: מבוא לביולוגיה</p>
                                    <p className="text-xs text-slate-400">לפני 2 שעות</p>
                                </div>
                                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium flex-shrink-0">פורסם</span>
                            </div>

                            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                                <div className="w-10 h-10 bg-wizdi-cyan/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <IconList className="w-5 h-5 text-wizdi-cyan" />
                                </div>
                                <div className="flex-grow min-w-0">
                                    <p className="font-medium text-slate-700 truncate">מבחן: פרק 3 - תאים</p>
                                    <p className="text-xs text-slate-400">אתמול</p>
                                </div>
                                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-medium flex-shrink-0">23 הגשות</span>
                            </div>

                            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                                <div className="w-10 h-10 bg-wizdi-lime/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <IconVideo className="w-5 h-5 text-lime-600" />
                                </div>
                                <div className="flex-grow min-w-0">
                                    <p className="font-medium text-slate-700 truncate">פודקאסט AI: היסטוריה מודרנית</p>
                                    <p className="text-xs text-slate-400">לפני 3 ימים</p>
                                </div>
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium flex-shrink-0">טיוטה</span>
                            </div>
                        </div>
                    </div>
                </div>

            </section>

            {/* How It Works */}
            <section className="mb-12">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">איך זה עובד?</h2>
                    <p className="text-slate-500">ארבעה שלבים פשוטים ליצירת תוכן מדהים</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-6 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 bg-wizdi-cyan/10 rounded-2xl flex items-center justify-center mx-auto mb-4 relative">
                            <IconUpload className="w-7 h-7 text-wizdi-cyan" />
                            <span className="absolute -top-2 -left-2 w-6 h-6 bg-wizdi-cyan text-white rounded-full text-xs font-bold flex items-center justify-center shadow">1</span>
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">העלאה</h3>
                        <p className="text-xs text-slate-500">בחרו קובץ, סרטון או נושא</p>
                    </div>

                    <div className="text-center p-6 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 bg-wizdi-royal/10 rounded-2xl flex items-center justify-center mx-auto mb-4 relative">
                            <IconSparkles className="w-7 h-7 text-wizdi-royal" />
                            <span className="absolute -top-2 -left-2 w-6 h-6 bg-wizdi-royal text-white rounded-full text-xs font-bold flex items-center justify-center shadow">2</span>
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">יצירה</h3>
                        <p className="text-xs text-slate-500">ה-AI בונה את התוכן</p>
                    </div>

                    <div className="text-center p-6 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 bg-wizdi-lime/20 rounded-2xl flex items-center justify-center mx-auto mb-4 relative">
                            <IconShare className="w-7 h-7 text-lime-600" />
                            <span className="absolute -top-2 -left-2 w-6 h-6 bg-lime-500 text-white rounded-full text-xs font-bold flex items-center justify-center shadow">3</span>
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">שיתוף</h3>
                        <p className="text-xs text-slate-500">שלחו לתלמידים</p>
                    </div>

                    <div className="text-center p-6 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 bg-wizdi-gold/20 rounded-2xl flex items-center justify-center mx-auto mb-4 relative">
                            <IconChart className="w-7 h-7 text-amber-500" />
                            <span className="absolute -top-2 -left-2 w-6 h-6 bg-amber-500 text-white rounded-full text-xs font-bold flex items-center justify-center shadow">4</span>
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">מעקב</h3>
                        <p className="text-xs text-slate-500">קבלו דוחות ותובנות</p>
                    </div>
                </div>
            </section>

            {/* Floating Button for Mobile */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:hidden z-50">
                <button
                    onClick={() => onCreateNew('learning')}
                    className="btn-lip-action px-8 py-4 shadow-xl flex items-center gap-2"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    יצירה חדשה
                </button>
            </div>

            <style>{`
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                .animate-blob { animation: blob 7s infinite; }
                .animation-delay-2000 { animation-delay: 2s; }
            `}</style>
        </div>
    );
};

export default HomePageRedesign;
