import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
    IconBook, IconList, IconSparkles, IconUpload,
    IconChart, IconRobot, IconBack, IconSearch, // שיניתי כאן ל-IconBack
    IconCheck, IconLayer, IconStudent, IconWand, IconConstruction
} from '../icons';

const HomePage = ({ onCreateNew, onNavigateToDashboard }: { onCreateNew: (mode: string) => void, onNavigateToDashboard: () => void }) => {
    const { currentUser } = useAuth();
    const firstName = currentUser?.email?.split('@')[0] || "מורה";

    // פונקציית עזר ללחיצה עם לוג
    const handleCardClick = (actionName: string, callback: () => void) => {
        console.log(`🚀 Clicked card: ${actionName}`);
        callback();
    };

    const getTimeBasedGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return "בוקר טוב";
        if (hour >= 12 && hour < 18) return "צהריים טובים";
        if (hour >= 18 && hour < 22) return "ערב טוב";
        return "לילה טוב";
    };

    return (
        <div className="max-w-7xl mx-auto p-6 font-sans pb-24">

            {/* --- Hero Section & Logo --- */}
            <div className="text-center mb-12 relative z-0 pointer-events-none">

                {/* אנימציית רקע */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                <div className="absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-wizdi-cyan rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

                <div className="flex justify-center mb-6 relative z-10">
                    <img
                        src="/WizdiLogo.png"
                        alt="Wizdi Studio"
                        className="h-40 w-auto object-contain drop-shadow-sm animate-float"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                </div>

                <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-2 relative z-10">
                    {getTimeBasedGreeting()}, {firstName}! ☀️
                </h1>
                <p className="text-slate-500 text-lg relative z-10">
                    הסטודיו שלך ליצירה, למידה והערכה חכמה.
                </p>
            </div>

            {/* --- The Bento Grid (הכרטיסיות) --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-[minmax(180px,auto)] mb-16 relative z-50">

                {/* 1. מחולל פעילויות (ענק - כחול גרדיאנט) */}
                <div
                    onClick={() => handleCardClick("Learning Generator", () => onCreateNew('learning'))}
                    className="col-span-1 md:col-span-2 row-span-2 bg-gradient-to-br from-wizdi-royal to-indigo-900 rounded-3xl p-8 text-white shadow-xl shadow-blue-200 cursor-pointer hover:scale-[1.02] transition-transform duration-300 relative overflow-hidden group border-b-8 border-indigo-900 active:border-b-0 active:translate-y-2"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none"></div>

                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div>
                            <div className="flex items-start justify-between">
                                <div className="bg-white/20 w-fit p-3 rounded-2xl mb-4 backdrop-blur-sm">
                                    <IconSparkles className="w-8 h-8 text-wizdi-lime" />
                                </div>
                                <span className="bg-white/20 text-xs px-2 py-1 rounded-lg border border-white/30 backdrop-blur-md">מומלץ להתחלה</span>
                            </div>

                            <h2 className="text-3xl font-black mb-3 leading-tight">
                                יצירת פעילות <br /> חדשה <span className="animate-wiggle inline-block">🪄</span>
                            </h2>

                            <p className="text-blue-100 text-md opacity-90 leading-relaxed font-medium">
                                הגדירו נושא או העלו טקסטים, קבצים וסרטונים. המערכת תבנה עבורכם יחידת לימוד הכוללת סוכן הוראה אישי, תוכן עשיר ותרגול פעיל.
                            </p>
                        </div>

                        <div className="mt-6 flex items-center gap-2 font-bold text-white/90 group-hover:translate-x-[-5px] transition-transform">
                            התחילו ליצור עכשיו <IconBack className="w-5 h-5 rotate-180" /> {/* שימוש ב-IconBack */}
                        </div>
                    </div>
                </div>

                {/* 2. יצירת מבחן (ענק - תכלת בהיר) */}
                <div
                    onClick={() => handleCardClick("Exam Creator", () => onCreateNew('exam'))}
                    className="col-span-1 md:col-span-2 bg-blue-50 rounded-3xl p-8 text-wizdi-royal shadow-xl cursor-pointer hover:scale-[1.02] transition-transform duration-300 group relative overflow-hidden border-2 border-wizdi-royal/10"
                >
                    <div className="absolute top-0 left-0 w-2 h-full bg-wizdi-royal"></div>
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="bg-wizdi-cyan w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                                    <IconList className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black leading-tight text-wizdi-royal">יצירת מבחן <br /> והערכה אוטומטית</h3>
                                </div>
                            </div>
                            <p className="text-wizdi-royal text-md opacity-90 leading-relaxed font-medium pl-2">
                                הפכו חומרי לימוד למבחני ידע, שאלונים ומטלות סיכום. המערכת תבדוק עבורכם את התשובות, תעניק ציונים ותציג תמונת מצב כיתתית בזמן אמת.
                            </p>
                        </div>

                        <div className="mt-6 flex items-center gap-2 font-bold text-wizdi-royal group-hover:translate-x-[-5px] transition-transform">
                            ליצירת מבחן <IconBack className="w-5 h-5 rotate-180" /> {/* שימוש ב-IconBack */}
                        </div>
                    </div>
                </div>

                {/* 4. Dashboard Link (כהה) - עכשיו תופס 2 עמודות */}
                <div
                    onClick={() => handleCardClick("Dashboard", onNavigateToDashboard)}
                    className="col-span-1 md:col-span-2 bg-wizdi-royal rounded-3xl p-6 text-white shadow-lg cursor-pointer hover:shadow-2xl transition-all group relative overflow-hidden active:scale-95 duration-200"
                >
                    <div className="absolute left-0 bottom-0 w-20 h-20 bg-wizdi-cyan rounded-tr-full opacity-30 pointer-events-none"></div>
                    <div className="relative z-10 pointer-events-none">
                        <div className="flex items-center gap-2 mb-3 text-blue-200 text-2xl font-bold uppercase">
                            <IconChart className="w-8 h-8" /> ניהול
                        </div>
                        <h3 className="text-3xl font-bold mb-2 leading-tight">לוח הפעילויות <br /> והמבחנים</h3>
                        <p className="text-blue-100 text-lg mb-4 opacity-90 font-medium">
                            צפייה בנתוני התלמידים, דוחות מפורטים, ציונים ומעקב אחר התקדמות בזמן אמת.
                        </p>
                        <div className="flex items-center gap-2 text-sm font-bold group-hover:translate-x-[-5px] transition-transform text-white">
                            כניסה ללוח <IconBack className="w-4 h-4 rotate-180" /> {/* שימוש ב-IconBack */}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Infographic Section --- */}
            <div className="mb-16 relative z-10">
                <div className="text-center mb-10">
                    <h2 className="text-2xl font-bold text-slate-800">איך הקסם עובד?</h2>
                    <p className="text-slate-500">מתהליך פשוט לחוויית למידה מלאה</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
                    {/* קו מחבר */}
                    <div className="hidden md:block absolute top-8 left-0 w-full h-0.5 bg-slate-100 z-0"></div>

                    {/* Step 1 */}
                    <div className="flex flex-col items-center text-center relative z-10 group">
                        <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative group-hover:scale-110 transition-transform shadow-sm border border-blue-200">
                            <IconSparkles className="w-8 h-8 text-wizdi-cyan" />
                            <span className="absolute -top-2 -right-2 bg-wizdi-cyan text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white">1</span>
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">המורים יוצרים</h3>
                        <p className="text-xs text-slate-500 px-4">מגדירים נושא, מעלים קובץ או בוחרים תבנית.</p>
                    </div>

                    {/* Step 2 */}
                    <div className="flex flex-col items-center text-center relative z-10 group">
                        <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative group-hover:scale-110 transition-transform shadow-sm border border-blue-200">
                            <IconConstruction className="w-8 h-8 text-wizdi-royal" />
                            <span className="absolute -top-2 -right-2 bg-wizdi-royal text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white">2</span>
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">המערכת בונה</h3>
                        <p className="text-xs text-slate-500 px-4">ה-AI יוצר סוכן, שאלות ותוכן עשיר.</p>
                    </div>

                    {/* Step 3 */}
                    <div className="flex flex-col items-center text-center relative z-10 group">
                        <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative group-hover:scale-110 transition-transform shadow-sm border border-blue-200">
                            <IconStudent className="w-8 h-8 text-wizdi-cyan" />
                            <span className="absolute -top-2 -right-2 bg-wizdi-cyan text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white">3</span>
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">התלמידים חווים</h3>
                        <p className="text-xs text-slate-500 px-4">למידה מותאמת אישית.</p>
                    </div>

                    {/* Step 4 */}
                    <div className="flex flex-col items-center text-center relative z-10 group">
                        <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative group-hover:scale-110 transition-transform shadow-sm border border-blue-200">
                            <IconChart className="w-8 h-8 text-wizdi-royal" />
                            <span className="absolute -top-2 -right-2 bg-wizdi-royal text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white">4</span>
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">תובנות למורים</h3>
                        <p className="text-xs text-slate-500 px-4">קבלת דוחות, ציונים וניתוח נתונים.</p>
                    </div>
                </div>
            </div>

            {/* Footer / Stats */}
            {/* Footer / Stats removed as per user request */}

            <style>{`
                .animate-fade-in { animation: fadeIn 0.8s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
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

export default HomePage;