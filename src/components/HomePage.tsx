import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
    IconBook, IconList, IconSparkles, IconUpload,
    IconChart, IconRobot, IconArrowBack, IconSearch, IconStar,
    IconCheck, IconLayer, IconStudent, IconWand, IconConstruction
} from '../icons';

interface HomePageProps {
    onCreateNew: (mode: 'learning' | 'exam') => void;
    onNavigateToDashboard: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onCreateNew, onNavigateToDashboard }) => {
    const { currentUser } = useAuth();
    const firstName = currentUser?.email?.split('@')[0] || "מורה";

    // פונקציית עזר ללחיצה עם לוג
    const handleCardClick = (actionName: string, callback: () => void) => {
        console.log(`🚀 Clicked card: ${actionName}`);
        callback();
    };

    return (
        <div className="max-w-7xl mx-auto p-6 font-sans pb-24">

            {/* --- Hero Section & Logo --- */}
            <div className="text-center mb-12 relative z-0 pointer-events-none">

                {/* אנימציית רקע */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#B8D6F6] rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                <div className="absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#24A8D9] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

                <div className="flex justify-center mb-6 relative z-10">
                    <img
                        src="/WizdiLogo.png"
                        alt="Wizdi Studio"
                        className="h-40 w-auto object-contain drop-shadow-sm"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                </div>

                <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-2 relative z-10">
                    בוקר טוב, {firstName}! ☀️
                </h1>
                <p className="text-slate-500 text-lg relative z-10">
                    הסטודיו שלך ליצירה, למידה והערכה חכמה.
                </p>
            </div>

            {/* --- The Bento Grid (הכרטיסיות) --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-[minmax(180px,auto)] mb-16 relative z-50">

                {/* 1. מחולל שיעורים (ענק - כחול גרדיאנט) */}
                <div
                    onClick={() => handleCardClick("Learning Generator", () => onCreateNew('learning'))}
                    className="col-span-1 md:col-span-2 row-span-2 bg-gradient-to-br from-[#24A8D9] to-[#0A4D7F] rounded-3xl p-8 text-white shadow-xl shadow-blue-200 cursor-pointer hover:scale-[1.01] transition-transform duration-300 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none"></div>

                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div>
                            <div className="flex items-start justify-between">
                                <div className="bg-white/20 w-fit p-3 rounded-2xl mb-4 backdrop-blur-sm">
                                    <IconSparkles className="w-8 h-8 text-white" />
                                </div>
                                <span className="bg-white/20 text-xs px-2 py-1 rounded-lg border border-white/30 backdrop-blur-md">מומלץ להתחלה</span>
                            </div>

                            <h2 className="text-3xl font-black mb-3 leading-tight">
                                יצירת שיעור <br /> אינטראקטיבי 🪄
                            </h2>

                            <p className="text-blue-100 text-md opacity-90 leading-relaxed font-medium">
                                הגדירו נושא, והמערכת תבנה עבורכם באופן אוטומטי יחידת לימוד אינטראקטיבית הכוללת סוכן הוראה אישי לכל תלמיד, תוכן עשיר כולל תמונות וסרטונים ותרגול פעיל ואדפטיבי.
                            </p>
                        </div>
                        <div className="mt-6 flex items-center gap-2 font-bold text-white/90 group-hover:translate-x-[-5px] transition-transform">
                            התחל ליצור עכשיו <IconArrowBack className="w-5 h-5 rotate-180" />
                        </div>
                    </div>
                </div>

                {/* 2. יצירת מבחן (ענק - תכלת בהיר) */}
                <div
                    onClick={() => handleCardClick("Exam Creator", () => onCreateNew('exam'))}
                    className="col-span-1 md:col-span-2 bg-[#B8D6F6] rounded-3xl p-8 text-[#0A4D7F] shadow-xl cursor-pointer hover:scale-[1.01] transition-transform duration-300 group relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-2 h-full bg-[#0A4D7F]"></div>
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="bg-[#24A8D9] w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                                    <IconList className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black leading-tight">יצירת מבחן <br /> והערכה אוטומטית</h3>
                                </div>
                            </div>
                            <p className="text-[#0A4D7F] text-md opacity-90 leading-relaxed font-medium pl-2">
                                הפכו חומרי לימוד למבחני ידע, שאלונים ומטלות סיכום. המערכת תבדוק עבורכם את התשובות, תעניק ציונים ותציג תמונת מצב כיתתית בזמן אמת.
                            </p>
                        </div>
                        <div className="mt-6 flex items-center gap-2 font-bold text-[#0A4D7F] group-hover:translate-x-[-5px] transition-transform">
                            ליצירת מבחן <IconArrowBack className="w-5 h-5 rotate-180" />
                        </div>
                    </div>
                </div>

                {/* 3. File Import */}
                <div
                    onClick={() => handleCardClick("File Import", () => onCreateNew('learning'))}
                    className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#24A8D9] cursor-pointer transition-all duration-300 hover:-translate-y-1 group"
                >
                    <div className="bg-[#B8D6F6] w-12 h-12 rounded-xl flex items-center justify-center text-[#0A4D7F] mb-4 group-hover:scale-110 transition-transform pointer-events-none">
                        <IconUpload className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-[#24A8D9] transition-colors pointer-events-none">
                        המרת קובץ לשיעור
                    </h3>
                    <p className="text-slate-500 text-xs leading-relaxed pointer-events-none font-medium">
                        העלו דפי עבודה, סיכומים או מסמכים (PDF/Word) והפכו אותם לפעילות אינטראקטיבית.
                    </p>
                </div>

                {/* 4. Dashboard Link (כהה) */}
                <div
                    onClick={() => handleCardClick("Dashboard", onNavigateToDashboard)}
                    className="bg-[#0A4D7F] rounded-3xl p-6 text-white shadow-lg cursor-pointer hover:shadow-2xl transition-all group relative overflow-hidden"
                >
                    <div className="absolute left-0 bottom-0 w-20 h-20 bg-[#24A8D9] rounded-tr-full opacity-30 pointer-events-none"></div>
                    <div className="relative z-10 pointer-events-none">
                        <div className="flex items-center gap-2 mb-3 text-[#B8D6F6] text-xs font-bold uppercase">
                            <IconChart className="w-4 h-4" /> ניהול
                        </div>
                        <h3 className="text-xl font-bold mb-1">הכיתות שלי</h3>
                        <p className="text-[#B8D6F6] text-xs mb-4">דוחות, ציונים ומעקב</p>
                        <div className="flex items-center gap-2 text-sm font-bold group-hover:translate-x-[-5px] transition-transform text-white">
                            לדשבורד <IconArrowBack className="w-4 h-4 rotate-180" />
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
                        <div className="bg-[#F0F7FF] w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative group-hover:scale-110 transition-transform shadow-sm border border-[#B8D6F6]">
                            <IconSparkles className="w-8 h-8 text-[#24A8D9]" />
                            <span className="absolute -top-2 -right-2 bg-[#24A8D9] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white">1</span>
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">המורה יוצר</h3>
                        <p className="text-xs text-slate-500 px-4">מגדירים נושא, מעלים קובץ או בוחרים תבנית.</p>
                    </div>

                    {/* Step 2 */}
                    <div className="flex flex-col items-center text-center relative z-10 group">
                        <div className="bg-[#F0F7FF] w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative group-hover:scale-110 transition-transform shadow-sm border border-[#B8D6F6]">
                            <IconConstruction className="w-8 h-8 text-[#0A4D7F]" />
                            <span className="absolute -top-2 -right-2 bg-[#0A4D7F] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white">2</span>
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">המערכת בונה</h3>
                        <p className="text-xs text-slate-500 px-4">ה-AI יוצר סוכן, שאלות ותוכן עשיר.</p>
                    </div>

                    {/* Step 3 */}
                    <div className="flex flex-col items-center text-center relative z-10 group">
                        <div className="bg-[#F0F7FF] w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative group-hover:scale-110 transition-transform shadow-sm border border-[#B8D6F6]">
                            <IconStudent className="w-8 h-8 text-[#24A8D9]" />
                            <span className="absolute -top-2 -right-2 bg-[#24A8D9] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white">3</span>
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">התלמיד חווה</h3>
                        <p className="text-xs text-slate-500 px-4">למידה אינטראקטיבית המותאמת אישית.</p>
                    </div>

                    {/* Step 4 */}
                    <div className="flex flex-col items-center text-center relative z-10 group">
                        <div className="bg-[#F0F7FF] w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative group-hover:scale-110 transition-transform shadow-sm border border-[#B8D6F6]">
                            <IconChart className="w-8 h-8 text-[#0A4D7F]" />
                            <span className="absolute -top-2 -right-2 bg-[#0A4D7F] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white">4</span>
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">תובנות למורה</h3>
                        <p className="text-xs text-slate-500 px-4">קבלת דוחות, ציונים וניתוח נתונים.</p>
                    </div>
                </div>
            </div>

            {/* Footer / Stats */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-wrap justify-around items-center gap-6 relative z-10">
                <div className="text-center">
                    <div className="text-3xl font-black text-[#0A4D7F]">3</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">שיעורים השבוע</div>
                </div>
                <div className="w-px h-10 bg-slate-100 hidden md:block"></div>
                <div className="text-center">
                    <div className="text-3xl font-black text-[#24A8D9]">24</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">תלמידים פעילים</div>
                </div>
                <div className="w-px h-10 bg-slate-100 hidden md:block"></div>
                <div className="text-center">
                    <div className="text-3xl font-black text-[#0A4D7F]">4.8</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">דירוג ממוצע</div>
                </div>
                <div className="w-px h-10 bg-slate-100 hidden md:block"></div>
                <div className="flex items-center gap-3 bg-[#B8D6F6] px-4 py-2 rounded-xl text-[#0A4D7F] font-bold text-sm cursor-pointer hover:bg-[#24A8D9] hover:text-white transition-colors">
                    <IconStar className="w-4 h-4" />
                    שדרג לפרו
                </div>
            </div>

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