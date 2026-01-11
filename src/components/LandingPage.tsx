import React, { useState } from 'react';
import {
    IconSparkles,
    IconRocket,
    IconBrain,
    IconSchool,
    IconVideo,
    IconBook,
    IconShieldLock,
    IconWand,
    IconCheck,
    IconPlayerPlay,
    IconHeadphones,
    IconList,
    IconChat,
    IconEdit,
    IconTrophy,
    IconFlame,
    IconCoin,
    IconShoppingCart,
    IconStar,
    IconEye
} from '../icons';

interface LandingPageProps {
    onLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
    // Interactive state for the student dashboard preview
    const [activeStudentTab, setActiveStudentTab] = useState<'profile' | 'missions'>('profile');

    return (
        <div className="min-h-screen bg-gradient-to-br from-wizdi-cloud via-white to-blue-50 text-wizdi-royal font-sans overflow-x-hidden" dir="rtl">
            {/* Navbar */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-white/40 px-6 py-4 flex justify-between items-center shadow-glass">
                <div className="flex items-center gap-2">
                    <img src="/WizdiLogo.png" alt="Wizdi" className="h-10 w-auto" loading="eager" decoding="async" />
                    <span className="font-black text-xl tracking-tight text-wizdi-royal">Wizdi</span>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={onLogin} className="text-wizdi-royal hover:text-wizdi-royal/80 font-bold transition-colors">כניסה למערכת</button>
                    <button onClick={onLogin} className="btn-lip-action px-6 py-2.5 text-wizdi-royal shadow-3d hover:shadow-lg transition-all transform hover:-translate-y-0.5">
                        התנסה בחינם
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-20 pb-48 px-6 overflow-hidden">
                <div className="container mx-auto grid lg:grid-cols-2 gap-16 items-center">

                    {/* Text Content (Right) */}
                    <div className="text-right space-y-8 z-20 relative">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 border border-white/50 rounded-full text-wizdi-royal font-bold text-sm animate-fade-in-up shadow-sm backdrop-blur-sm">
                            <IconSparkles className="w-4 h-4 text-wizdi-cyan" />
                            <span>הבינה המלאכותית הראשונה למורים בעברית</span>
                        </div>

                        <h1 className="text-5xl lg:text-7xl font-black leading-[1.1] tracking-tight text-wizdi-royal pb-2 drop-shadow-sm">
                            הפוך את ההוראה <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-wizdi-cyan to-wizdi-royal">לקלה ומהירה יותר</span>
                        </h1>

                        <p className="text-xl text-slate-600 font-medium max-w-xl leading-relaxed">
                            פלטפורמת למידה חכמה, המייצרת עבורך מערכי שיעור, מבחנים ותוכן דיפרנציאלי בשניות - הכל בעברית שפת אם.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-5 pt-4">
                            <button onClick={onLogin} className="btn-lip-action px-10 py-4 text-lg text-wizdi-royal flex items-center justify-center gap-2 shadow-xl shadow-lime-300/30">
                                <IconRocket className="w-6 h-6" />
                                התחל עכשיו בחינם
                            </button>
                            <button className="btn-lip-primary px-10 py-4 text-lg flex items-center justify-center gap-2 shadow-xl shadow-blue-900/10">
                                <IconPlayerPlay className="w-6 h-6 fill-white" />
                                איך זה עובד?
                            </button>
                        </div>

                        <div className="pt-8 flex items-center gap-4 text-sm text-slate-500 font-medium">
                            <div className="flex -space-x-2 space-x-reverse">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-xs font-bold text-indigo-700">
                                        {String.fromCharCode(64 + i)}
                                    </div>
                                ))}
                            </div>
                            <span>בשימוש ע״י מאות מורים בישראל</span>
                        </div>
                    </div>

                    {/* Visual Content (Left) - Dual Mockup System */}
                    <div className="relative z-10 lg:h-[700px] flex items-center justify-center perspective-1000">
                        {/* Abstract Background Blobs */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                        <div className="absolute -bottom-8 left-0 w-96 h-96 bg-wizdi-lime/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-wizdi-cyan/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

                        {/* 1. TEACHER VIEW (Desktop) - Back Layer */}
                        <div className="relative w-full max-w-lg bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 p-6 transform rotate-y-6 scale-90 translate-x-12 translate-y-[-20px] transition-transform hover:rotate-y-0 duration-700 z-10 card-glass">
                            {/* Fake Browser Header */}
                            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                </div>
                                <div className="mx-auto text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-md tracking-wide">TEACHER STUDIO</div>
                            </div>

                            {/* Generation UI */}
                            <div className="space-y-6">
                                <div className="bg-wizdi-cloud p-4 rounded-2xl border border-blue-100 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-blue-500/5 animate-pulse"></div>
                                    <div className="flex items-center justify-between mb-3 relative z-10">
                                        <span className="font-bold text-wizdi-royal">יצירת פעילות חדשה</span>
                                        <IconWand className="w-5 h-5 text-wizdi-cyan animate-spin-slow" />
                                    </div>
                                    <div className="h-2 bg-white rounded-full w-full overflow-hidden border border-blue-100">
                                        <div className="h-full bg-wizdi-royal w-2/3 rounded-full animate-progress"></div>
                                    </div>
                                    <div className="mt-2 text-xs text-wizdi-royal/80 font-bold">מנתח את הסרטון ומייצר שאלות...</div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 mb-2">
                                            <IconBrain className="w-[18px] h-[18px]" />
                                        </div>
                                        <div className="font-bold text-slate-800 text-sm">ניתוח פדגוגי</div>
                                        <div className="text-xs text-slate-400 mt-1">הושלם בהצלחה</div>
                                    </div>
                                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                                        <div className="w-8 h-8 bg-wizdi-lime/20 rounded-lg flex items-center justify-center text-wizdi-lime mb-2">
                                            <IconCheck className="w-[18px] h-[18px] text-green-700" />
                                        </div>
                                        <div className="font-bold text-slate-800 text-sm">התאמת רמות</div>
                                        <div className="text-xs text-slate-400 mt-1">דיפרנציאציה מוכנה</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. STUDENT VIEW (Mobile) - Front Layer */}
                        <div className="absolute bottom-[-40px] left-[-20px] w-[280px] bg-slate-900 rounded-[2.5rem] p-3 shadow-2xl border-[6px] border-slate-800 shadow-purple-500/20 transform -rotate-y-12 hover:rotate-y-0 transition-transform duration-500 z-20">
                            {/* Notch */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-20"></div>

                            {/* Screen Content */}
                            <div className="bg-white w-full h-full rounded-[2rem] overflow-hidden relative flex flex-col">
                                {/* HUD Mockup */}
                                <div className="pt-10 px-4 pb-2 flex justify-between items-center bg-wizdi-cloud border-b border-indigo-50">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-md">
                                            5
                                        </div>
                                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-wizdi-cyan w-3/4"></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="text-lg animate-bounce-slow">🔥</div>
                                        <span className="text-xs font-black text-orange-500">12</span>
                                    </div>
                                </div>

                                {/* Chat Interface */}
                                <div className="flex-1 p-3 space-y-3 bg-slate-50">
                                    <div className="flex gap-2">
                                        <div className="w-8 h-8 rounded-full bg-wizdi-royal flex items-center justify-center text-white text-xs shrink-0">AI</div>
                                        <div className="bg-white p-3 rounded-2xl rounded-tr-none shadow-sm text-xs text-slate-700 border border-slate-100">
                                            מעולה! הסברת נכון את ההבדל בין דמוקרטיה ישירה לעקיפה. ומה לגבי ישראל?
                                        </div>
                                    </div>

                                    {/* User Answer Mockup */}
                                    <div className="flex gap-2 flex-row-reverse">
                                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs shrink-0">אני</div>
                                        <div className="bg-purple-600 text-white p-3 rounded-2xl rounded-tl-none shadow-md text-xs">
                                            ישראל היא דמוקרטיה עקיפה, כי אנחנו בוחרים נציגים לכנסת.
                                        </div>
                                    </div>

                                    {/* Success Toast */}
                                    <div className="mt-4 mx-2 bg-green-100 border border-green-200 text-green-800 p-2 rounded-xl flex items-center gap-2 animate-pop">
                                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px]">✓</div>
                                        <div className="text-[10px] font-bold">תשובה נכונה! (+50 XP)</div>
                                    </div>
                                </div>

                                {/* Floating Button */}
                                <div className="absolute bottom-4 left-0 right-0 px-4">
                                    <div className="w-full h-12 bg-wizdi-lime rounded-full shadow-lg border-b-4 border-green-600 flex items-center justify-center font-bold text-green-900 text-sm">
                                        המשך לשאלה הבאה
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Process Section (DNA Style) */}
            <section className="py-24 bg-gradient-to-b from-white to-wizdi-cloud relative border-b border-indigo-50">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
                <div className="container mx-auto px-6 relative z-10">
                    <div className="text-center mb-16">
                        <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 text-wizdi-royal font-bold text-sm mb-4 border border-indigo-100">תהליך העבודה</div>
                        <h2 className="text-4xl font-black text-wizdi-royal mb-4">איך הקסם עובד?</h2>
                        <p className="text-xl text-slate-500">שלושה צעדים פשוטים מתוכן גולמי לשיעור מושלם</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12 relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="hidden md:block absolute top-[3.5rem] right-1/6 left-1/6 h-1 bg-gradient-to-l from-transparent via-slate-200 to-transparent -z-10 bg-[length:20px_100%]"></div>

                        {[
                            { icon: IconVideo, title: "1. העלה תוכן", desc: "הדבק קישור ליוטיוב, העלה קובץ PDF או טקסט חופשי", color: "text-wizdi-royal", bg: "bg-white", border: "border-indigo-100" },
                            { icon: IconSchool, title: "2. בחר רמה", desc: "הגדר את שכבת הגיל וסוג הפעילות (תרגול, מבחן או העשרה)", color: "text-wizdi-royal", bg: "bg-white", border: "border-indigo-100" },
                            { icon: IconRocket, title: "3. קבל שיעור", desc: "המערכת מייצרת אוטומטית שאלות, סיכומים ופעילות אינטראקטיבית", color: "text-wizdi-lime", bg: "bg-wizdi-royal text-white", border: "border-transparent" }
                        ].map((step, idx) => (
                            <div key={idx} className="relative flex flex-col items-center text-center group cursor-pointer">
                                <div className={`w-28 h-28 ${step.bg} rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-indigo-900/5 group-hover:scale-110 group-hover:shadow-indigo-900/10 transition-all duration-300 border ${step.border} z-10`}>
                                    <step.icon className={`w-12 h-12 ${idx === 2 ? 'text-wizdi-lime' : step.color}`} />
                                    {/* Number Badge */}
                                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-wizdi-cyan text-white font-black flex items-center justify-center border-4 border-white shadow-sm">
                                        {idx + 1}
                                    </div>
                                </div>
                                <h3 className="text-2xl font-black text-wizdi-royal mb-3">{step.title}</h3>
                                <p className="text-slate-500 text-lg leading-relaxed max-w-xs">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>



            {/* Bento Grid Features (Updated Style) */}
            <section className="py-24 px-6 bg-slate-50">
                <div className="container mx-auto max-w-6xl">
                    <div className="text-center mb-16">
                        <div className="inline-block px-4 py-1.5 rounded-full bg-white text-wizdi-royal font-bold text-sm mb-4 border border-indigo-100 shadow-sm">יכולות מתקדמות</div>
                        <h2 className="text-4xl font-black text-wizdi-royal mb-4">יותר מסתם מחולל שאלות</h2>
                        <p className="text-xl text-slate-500">הכלים המתקדמים שהופכים אותך למורה על</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-[auto_auto] gap-6">

                        {/* Large Card: Differentiation */}
                        <div className="md:col-span-2 bg-white p-8 rounded-[2.5rem] relative overflow-hidden group hover:shadow-2xl transition-all border border-slate-100 shadow-sm">
                            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-wizdi-cloud/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative z-10 max-w-md">
                                <div className="w-14 h-14 bg-wizdi-royal rounded-2xl flex items-center justify-center text-white mb-6 shadow-indigo-300/50 shadow-lg transform rotate-3 group-hover:rotate-6 transition-transform">
                                    <IconBrain className="w-8 h-8" />
                                </div>
                                <h3 className="text-3xl font-bold text-wizdi-royal mb-3">דיפרנציאציה אמיתית</h3>
                                <p className="text-slate-500 text-lg leading-relaxed mb-8">
                                    במקום להתאמץ להתאים את החומר לכל תלמיד, המערכת מייצרת אוטומטית גרסאות שונות של אותו השיעור: תמיכה למתקשים, ליבה לכולם, והעשרה למצטיינים.
                                </p>
                            </div>
                            {/* Abstract Visual - Stacking Cards */}
                            <div className="absolute top-1/4 -left-12 opacity-80 group-hover:opacity-100 group-hover:-translate-x-2 transition-all duration-500">
                                <div className="space-y-4">
                                    <div className="w-72 h-14 bg-white rounded-2xl shadow-md flex items-center px-4 gap-3 border border-slate-100 z-30 relative">
                                        <span className="w-3 h-3 rounded-full bg-green-400"></span>
                                        <div className="h-2 bg-slate-100 rounded-full w-24"></div>
                                        <span className="text-sm font-bold text-wizdi-royal mr-auto">תמיכה</span>
                                    </div>
                                    <div className="w-72 h-14 bg-slate-50 rounded-2xl shadow-sm flex items-center px-4 gap-3 translate-x-6 border border-slate-100 z-20 relative opacity-90">
                                        <span className="w-3 h-3 rounded-full bg-blue-400"></span>
                                        <div className="h-2 bg-slate-200 rounded-full w-24"></div>
                                        <span className="text-sm font-bold text-wizdi-royal mr-auto">ליבה</span>
                                    </div>
                                    <div className="w-72 h-14 bg-slate-100 rounded-2xl shadow-sm flex items-center px-4 gap-3 translate-x-12 border border-slate-100 z-10 relative opacity-80">
                                        <span className="w-3 h-3 rounded-full bg-purple-400"></span>
                                        <div className="h-2 bg-slate-200 rounded-full w-24"></div>
                                        <span className="text-sm font-bold text-wizdi-royal mr-auto">העשרה</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tall Card: Exam Mode */}
                        <div className="md:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                            <div className="absolute inset-0 bg-teal-50/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative z-10 h-full flex flex-col">
                                <div className="w-14 h-14 bg-teal-500 rounded-2xl flex items-center justify-center text-white mb-6 shadow-teal-200 shadow-lg transform -rotate-3 group-hover:scale-110 transition-transform">
                                    <IconShieldLock className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-3">מצב מבחן מאובטח</h3>
                                <p className="text-slate-500 mb-6 flex-1">
                                    הפוך כל פעילות למבחן עם טיימר, חסימת יציאה, ודיווח ציונים לכיתה.
                                </p>
                                <div className="mt-auto bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-teal-700">ציון ממוצע</span>
                                        <span className="text-lg font-black text-teal-600">88%</span>
                                    </div>
                                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-teal-500 w-[88%]"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Medium Card: Book Import */}
                        <div className="md:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                            <div className="absolute inset-0 bg-orange-50/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white mb-4 shadow-orange-200 shadow-md transform rotate-1 group-hover:rotate-0 transition-transform">
                                    <IconBook className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">ספרי לימוד דיגיטליים</h3>
                                <p className="text-slate-500 text-sm">
                                    העלה PDF שלם והפוך כל פרק לשיעור אינטראקטיבי.
                                </p>
                            </div>
                        </div>

                        {/* Medium Card: Native Hebrew */}
                        <div className="md:col-span-2 bg-wizdi-royal p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group hover:shadow-2xl transition-all flex flex-col md:flex-row items-center gap-8 text-white">
                            {/* Gloss Effect */}
                            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none"></div>

                            <div className="relative z-10 flex-1">
                                <div className="inline-block px-3 py-1 bg-white/20 rounded-lg text-xs font-bold mb-4 backdrop-blur-sm border border-white/20">בלעדי</div>
                                <h3 className="text-2xl font-bold mb-2">עברית שפת אם</h3>
                                <p className="text-blue-100">
                                    המערכת הראשונה שלא "מתרגמת" אלא "מבינה". הניואנסים, התרבות ומערכת החינוך הישראלית מוטמעים בליבה.
                                </p>
                            </div>
                            <div className="relative z-10 flex-1 bg-white text-slate-800 rounded-2xl p-6 w-full shadow-lg transform translate-y-4 group-hover:translate-y-2 transition-transform">
                                <div className="flex gap-2 mb-3">
                                    <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-500">דקדוק</span>
                                    <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-500">תחביר</span>
                                </div>
                                <div className="text-xl font-serif text-slate-800 leading-tight">"חנוך לנער על פי דרכו"</div>
                                <div className="text-xs text-slate-400 mt-2 text-left">- משלי כ"ב</div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* Deep DNA Power Grid (Upgraded Wizdi Style) */}
            <section className="py-24 bg-gradient-to-b from-white via-blue-50 to-white relative overflow-hidden">
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-wizdi-cyan/10 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-wizdi-lime/10 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000 pointer-events-none"></div>

                <div className="container mx-auto px-6 relative z-10">
                    <div className="text-center mb-20">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-100 rounded-full text-wizdi-royal font-bold text-sm mb-6 shadow-sm">
                            <IconBrain className="w-4 h-4 text-wizdi-cyan" />
                            <span>המנוע הפדגוגי</span>
                        </div>
                        <h2 className="text-4xl lg:text-5xl font-black text-wizdi-royal mb-6">לא רק "מחולל", אלא <span className="text-transparent bg-clip-text bg-gradient-to-r from-wizdi-cyan to-wizdi-royal">מערכת לומדת</span></h2>
                        <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                            מתחת למכסה המנוע מסתתרת הטכנולוגיה הפדגוגית המתקדמת בעולם. המערכת לא רק יוצרת תוכן, היא מבינה את התלמיד שלך.
                        </p>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-8 items-start">
                        {/* Feature 1: The Silent Observer (Glass Card) */}
                        <div className="card-glass p-8 relative group hover:-translate-y-2 transition-transform duration-300">
                            <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors"></div>
                            <div className="mb-8 relative">
                                <div className="relative bg-white/50 backdrop-blur-sm rounded-2xl p-4 shadow-inner border border-white">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-300">
                                            <IconEye className="w-6 h-6" />
                                        </div>
                                        <div className="space-y-2 flex-1">
                                            <div className="h-2 bg-indigo-50 rounded-full w-3/4"></div>
                                            <div className="h-2 bg-indigo-50 rounded-full w-1/2"></div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-blue-50/80 p-2 rounded-xl text-center border border-blue-100">
                                            <div className="text-xs text-blue-400 font-bold">זמן מיקוד</div>
                                            <div className="text-lg font-black text-blue-600">8m</div>
                                        </div>
                                        <div className="bg-purple-50/80 p-2 rounded-xl text-center border border-purple-100">
                                            <div className="text-xs text-purple-400 font-bold">תלות ברמזים</div>
                                            <div className="text-lg font-black text-purple-600">נמוכה</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-wizdi-royal mb-3">הצופה השקט</h3>
                            <p className="text-slate-600 text-lg leading-relaxed">
                                המערכת עוקבת אחר התקדמות התלמיד, מזהה נושאים שצריכים חיזוק, ומציגה למורה נתוני ביצועים ברורים.
                            </p>
                        </div>

                        {/* Feature 2: Real-Time BKT (Royal Card - The Core) */}
                        <div className="bg-wizdi-royal rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-900/20 scale-105 z-10 ring-4 ring-white/50">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-wizdi-cyan/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                            <div className="mb-8 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 relative">
                                <div className="absolute -top-3 -right-3">
                                    <span className="relative flex h-4 w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-wizdi-lime opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-wizdi-lime"></span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-8 h-8 rounded-full bg-red-500/80 flex items-center justify-center font-bold shadow-lg text-xs backdrop-blur-sm">✕</div>
                                    <div className="h-0.5 flex-1 bg-white/20 relative">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-wizdi-royal px-3 py-1 rounded-full text-xs border border-white/20 whitespace-nowrap shadow-xl">AI מזהה קושי</div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-wizdi-lime text-green-900 flex items-center justify-center font-bold shadow-lg text-xs">✓</div>
                                </div>
                                <div className="text-center text-blue-100 text-sm font-medium bg-blue-950/30 p-3 rounded-xl border border-white/10">
                                    "זיהיתי טעות חוזרת. הנה הסבר מותאם..."
                                </div>
                            </div>

                            <h3 className="text-2xl font-bold mb-3">תיקון בזמן אמת (BKT)</h3>
                            <p className="text-blue-100 text-lg leading-relaxed">
                                המערכת לא רק נותנת ציון, היא מלמדת. אלגוריתם בייסיאני מזהה פערי ידע ומזריק הסברים ותרגול נוסף *תוך כדי* השיעור.
                            </p>
                        </div>

                        {/* Feature 3: Actionable Insights (Glass Card) */}
                        <div className="card-glass p-8 relative group hover:-translate-y-2 transition-transform duration-300">
                            <div className="absolute -top-6 -left-6 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-colors"></div>
                            <div className="mb-8 relative flex justify-center">
                                <div className="relative w-full">
                                    <div className="bg-white/50 backdrop-blur-sm p-4 rounded-2xl shadow-inner border border-white flex flex-col items-center">
                                        <div className="w-full flex items-center gap-3 mb-3 border-b border-gray-100/50 pb-3">
                                            <div className="w-8 h-8 rounded-full bg-red-100/80 flex items-center justify-center text-red-500 font-bold text-xs">!</div>
                                            <div className="text-xs text-slate-600 font-bold flex-1 text-right">3 תלמידים מתקשים</div>
                                        </div>
                                        <div className="w-full flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-green-100/80 flex items-center justify-center text-green-600 font-bold text-xs">✓</div>
                                            <div className="text-xs text-slate-600 font-bold flex-1 text-right">85% שביעות רצון</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-wizdi-royal mb-3">תובנות לפעולה</h3>
                            <p className="text-slate-600 text-lg leading-relaxed">
                                הדשבורד לא רק מציג ציונים, אלא ממליץ לך מה לעשות מחר בבוקר: "חזור על נושא X", "אתגר את תלמיד Y", "שבץ מחדש את קבוצה Z".
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Tools Showcase Grid (Authentic Wizdi Glass Design) */}
            <section className="py-24 px-6 bg-gradient-to-b from-[#FDFCF8] via-white to-wizdi-cloud relative overflow-hidden">
                {/* Decorative Blobs */}
                <div className="absolute top-1/2 left-1/3 w-[500px] h-[500px] bg-wizdi-cyan/5 rounded-full filter blur-[100px] pointer-events-none"></div>
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-wizdi-lime/5 rounded-full filter blur-[80px] pointer-events-none"></div>

                <div className="container mx-auto relative z-10">
                    <div className="flex items-end justify-between mb-16">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-blue-100 rounded-full text-wizdi-royal font-bold text-xs mb-4 shadow-sm">
                                <IconWand className="w-3 h-3 text-wizdi-cyan" />
                                <span>הכל במקום אחד</span>
                            </div>
                            <h2 className="text-4xl font-black text-wizdi-royal mb-2">ארגז הכלים שלך</h2>
                            <p className="text-slate-500 text-lg">כל מה שמורה צריך - מתוכן ועד משחוק</p>
                        </div>
                        <button onClick={onLogin} className="hidden md:flex items-center gap-2 text-wizdi-royal font-bold hover:bg-white px-6 py-3 rounded-full transition-all border border-blue-100 hover:shadow-glass hover:scale-105 bg-white/50 backdrop-blur-sm">
                            <span>צפה בכל הכלים</span>
                            <IconPlayerPlay className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { name: "YouTube לשיעור", icon: IconVideo, color: "text-red-500", bg: "bg-red-50", border: "group-hover:border-red-200" },
                            { name: "טקסט לפודקאסט", icon: IconHeadphones, color: "text-purple-500", bg: "bg-purple-50", border: "group-hover:border-purple-200" },
                            { name: "מחולל מחוונים", icon: IconList, color: "text-blue-500", bg: "bg-blue-50", border: "group-hover:border-blue-200" },
                            { name: "חדר בריחה", icon: IconShieldLock, color: "text-green-500", bg: "bg-green-50", border: "group-hover:border-green-200" },
                            { name: "בוט דיבייט", icon: IconChat, color: "text-orange-500", bg: "bg-orange-50", border: "group-hover:border-orange-200" },
                            { name: "מערך למערך", icon: IconBook, color: "text-teal-500", bg: "bg-teal-50", border: "group-hover:border-teal-200" },
                            { name: "משחק הזיכרון", icon: IconBrain, color: "text-pink-500", bg: "bg-pink-50", border: "group-hover:border-pink-200" },
                            { name: "עורך PDF", icon: IconEdit, color: "text-indigo-500", bg: "bg-indigo-50", border: "group-hover:border-indigo-200" },
                        ].map((tool, idx) => (
                            <div key={idx} className={`card-glass p-8 rounded-[2rem] hover:-translate-y-2 transition-all duration-300 cursor-pointer flex flex-col items-center text-center gap-6 group relative overflow-hidden border border-white/60`}>
                                <div className={`absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                                <div className={`w-20 h-20 ${tool.bg} rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-sm ring-1 ring-black/5 relative z-10`}>
                                    <tool.icon className={`w-10 h-10 ${tool.color}`} />
                                </div>
                                <span className="font-bold text-slate-700 text-lg group-hover:text-wizdi-royal transition-colors relative z-10">{tool.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* NEW: Student Gamification Dashboard (The Playground) - Moved Here */}
            <section className="py-24 bg-[#0F172A] relative overflow-hidden text-white border-t border-slate-800">
                {/* Background Effects */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-wizdi-royal/30 rounded-full blur-[120px] mix-blend-screen"></div>
                    <div className="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen"></div>
                    {/* Stars/Dust */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse"></div>
                </div>

                <div className="container mx-auto px-6 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        {/* Text Content */}
                        <div className="text-right space-y-8 order-2 lg:order-1">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-wizdi-lime/10 border border-wizdi-lime/20 rounded-full text-wizdi-lime font-bold text-sm shadow-glow-lime">
                                <IconTrophy className="w-4 h-4" />
                                <span>חווית תלמיד פורצת דרך</span>
                            </div>
                            <h2 className="text-4xl lg:text-6xl font-black leading-tight">
                                כששיעורי בית מרגישים כמו <span className="text-transparent bg-clip-text bg-gradient-to-r from-wizdi-lime to-wizdi-cyan">משחק מחשב</span>
                            </h2>
                            <p className="text-xl text-slate-300 leading-relaxed max-w-lg">
                                התלמידים שלך לא רק "לומדים", הם צוברים XP, עולים רמות, שומרים על "רצף למידה" (Streak) ורוכשים פריטים בחנות הוירטואלית.
                            </p>

                            <div className="grid grid-cols-2 gap-6 pt-4">
                                <div className="bg-slate-800/40 backdrop-blur-md p-5 rounded-3xl border border-slate-700/50 hover:bg-slate-800/60 transition-colors group">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
                                            <IconFlame className="w-7 h-7" />
                                        </div>
                                        <div className="font-bold text-xl">Streaks</div>
                                    </div>
                                    <p className="text-slate-400 text-sm font-medium">מעודד התמדה יומיומית ומחויבות ללמידה</p>
                                </div>
                                <div className="bg-slate-800/40 backdrop-blur-md p-5 rounded-3xl border border-slate-700/50 hover:bg-slate-800/60 transition-colors group">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 flex items-center justify-center text-yellow-400 group-hover:scale-110 transition-transform">
                                            <IconCoin className="w-7 h-7" />
                                        </div>
                                        <div className="font-bold text-xl">חנות פרסים</div>
                                    </div>
                                    <p className="text-slate-400 text-sm font-medium">תגמול על הצטיינות, השקעה וביצוע משימות</p>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Visual (The Cockpit) */}
                        <div className="relative order-1 lg:order-2">
                            {/* Glow behind dashboard */}
                            <div className="absolute inset-0 bg-wizdi-royal/20 blur-3xl rounded-full"></div>

                            <div className="bg-slate-900/90 backdrop-blur-xl rounded-[3rem] p-3 border border-slate-700 shadow-2xl relative z-10 overflow-hidden transform hover:scale-[1.01] transition-transform duration-700 shadow-purple-900/40">
                                {/* Header Mockup */}
                                <div className="bg-slate-950 rounded-[2.5rem] p-8 text-white border border-slate-800 h-[600px] flex flex-col items-center relative overflow-hidden">

                                    {/* Background Grid */}
                                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

                                    {/* Avatar & Level */}
                                    <div className="relative z-10 text-center mb-10 mt-6 w-full">
                                        <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-wizdi-royal to-purple-600 p-1 mx-auto mb-5 shadow-lg shadow-purple-600/30 relative">
                                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Felix`} alt="Avatar" className="w-full h-full rounded-full bg-slate-900" loading="lazy" decoding="async" />
                                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-wizdi-lime text-slate-900 font-black px-4 py-1 rounded-full border-[3px] border-slate-900 text-sm shadow-lg whitespace-nowrap z-20">
                                                LVL 5
                                            </div>
                                        </div>
                                        <h3 className="text-3xl font-bold mb-1">דניאל כהן</h3>
                                        <div className="text-slate-400 font-medium">חוקר צעיר • 2,450 XP</div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-3 gap-4 w-full max-w-sm mb-10 relative z-10 px-4">
                                        <div className="bg-slate-800/80 p-4 rounded-3xl text-center border border-slate-700 hover:bg-slate-800 transition-colors">
                                            <IconFlame className="w-7 h-7 text-orange-500 mx-auto mb-2" />
                                            <div className="font-black text-xl mb-1">12</div>
                                            <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">ימים</div>
                                        </div>
                                        <div className="bg-slate-800/80 p-4 rounded-3xl text-center border border-slate-700 hover:bg-slate-800 transition-colors">
                                            <IconCoin className="w-7 h-7 text-yellow-400 mx-auto mb-2" />
                                            <div className="font-black text-xl mb-1">450</div>
                                            <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">מטבעות</div>
                                        </div>
                                        <div className="bg-slate-800/80 p-4 rounded-3xl text-center border border-slate-700 hover:bg-slate-800 transition-colors">
                                            <IconStar className="w-7 h-7 text-wizdi-cyan mx-auto mb-2" />
                                            <div className="font-black text-xl mb-1">Top 5</div>
                                            <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">דירוג</div>
                                        </div>
                                    </div>

                                    {/* Mission Control */}
                                    <div className="w-full bg-slate-800/50 rounded-t-[2.5rem] p-6 border-t border-r border-l border-slate-700 backdrop-blur-md flex-1 relative z-10 -mb-8">
                                        <div className="flex justify-between items-center mb-6">
                                            <span className="font-bold text-base text-slate-200">המשימות להיום</span>
                                            <div className="bg-slate-700/50 p-2 rounded-xl">
                                                <IconList className="w-4 h-4 text-slate-400" />
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-4 bg-slate-700/60 p-4 rounded-2xl border border-slate-600/50 hover:bg-slate-700 transition-colors cursor-pointer group">
                                                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400 group-hover:bg-green-500 group-hover:text-white transition-all">
                                                    <IconCheck className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-base font-bold text-slate-200">המהפכה הצרפתית</div>
                                                    <div className="text-xs text-slate-400 font-medium mt-0.5">הושלם • +100 XP</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 bg-wizdi-royal/20 p-4 rounded-2xl border border-wizdi-royal/40 cursor-pointer relative overflow-hidden group">
                                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-wizdi-royal"></div>
                                                <div className="w-12 h-12 rounded-xl bg-wizdi-royal flex items-center justify-center text-white animate-pulse shadow-lg shadow-blue-500/20">
                                                    <IconPlayerPlay className="w-6 h-6 fill-current" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-base font-bold text-white group-hover:text-blue-200 transition-colors">מבוא לדמוקרטיה</div>
                                                    <div className="text-xs text-blue-300 font-medium mt-0.5">בתהליך • נותרו 5 דק'</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Decorative Floating Elements */}
                            <div className="absolute top-20 -right-16 bg-white text-slate-900 px-5 py-3 rounded-2xl font-bold text-sm shadow-2xl rotate-12 animate-float z-20 flex items-center gap-3 border-4 border-slate-900/10">
                                <span className="text-2xl">🚀</span>
                                <div>
                                    <div className="leading-none">עליית רמה!</div>
                                    <div className="text-[10px] text-slate-500 font-medium">המשך כך</div>
                                </div>
                            </div>
                            <div className="absolute bottom-32 -left-12 bg-slate-950/90 backdrop-blur text-white px-5 py-3 rounded-2xl font-bold text-sm shadow-2xl -rotate-6 animate-float animation-delay-2000 z-20 flex items-center gap-3 border border-slate-700/50">
                                <div className="bg-yellow-400/20 p-1.5 rounded-lg">
                                    <IconCoin className="text-yellow-400 w-5 h-5" />
                                </div>
                                <div>
                                    <div className="leading-none text-yellow-100">+50 מטבעות</div>
                                    <div className="text-[10px] text-slate-500 font-medium">בונוס יומי</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer / CTA */}
            <section className="bg-wizdi-royal py-20 px-6 text-center text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="container mx-auto relative z-10">
                    <h2 className="text-4xl lg:text-5xl font-black mb-8">מוכנים להתחיל ללמד אחרת?</h2>
                    <button onClick={onLogin} className="btn-lip-action px-12 py-5 text-xl text-green-900 bg-[#A3E635] shadow-2xl hover:scale-105 transition-all">
                        הצטרפו למהפכה בחינם
                    </button>
                    <p className="mt-6 text-blue-200">ללא התחייבות • ללא כרטיס אשראי</p>
                </div>
            </section>

        </div>
    );
};

export default LandingPage;
