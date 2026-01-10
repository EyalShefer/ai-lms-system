import React from 'react';
import {
    IconSparkles,
    IconRocket,
    IconBrain,
    IconSchool,
    IconVideo,
    IconBook,
    IconShieldLock,
    IconCheck,
    IconPlayerPlay,
    IconHeadphones,
    IconTrophy,
    IconFlame,
    IconCoin,
    IconStar,
} from '../../icons';

interface LandingPageMobileProps {
    onLogin: () => void;
}

const LandingPageMobile: React.FC<LandingPageMobileProps> = ({ onLogin }) => {
    return (
        <div className="min-h-screen bg-gradient-to-b from-wizdi-cloud via-white to-blue-50 text-wizdi-royal font-sans" dir="rtl">
            {/* Mobile Navbar */}
            <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex justify-between items-center safe-area-inset-top">
                <div className="flex items-center gap-2">
                    <img src="/WizdiLogo.png" alt="Wizdi" className="h-8 w-auto" loading="eager" decoding="async" />
                    <span className="font-black text-lg text-wizdi-royal">Wizdi</span>
                </div>
                <button
                    onClick={onLogin}
                    className="btn-lip-action px-4 py-2 text-sm font-bold min-h-[44px]"
                >
                    התחברות
                </button>
            </nav>

            {/* Hero Section - Mobile Optimized */}
            <section className="px-4 pt-8 pb-12">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/80 border border-slate-200 rounded-full text-wizdi-royal font-bold text-xs mb-6 shadow-sm">
                    <IconSparkles className="w-3.5 h-3.5 text-wizdi-cyan" />
                    <span>AI למורים בעברית</span>
                </div>

                {/* Main Title */}
                <h1 className="text-3xl font-black leading-tight text-wizdi-royal mb-4">
                    הפוך את ההוראה{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-wizdi-cyan to-wizdi-royal">
                        לקלה יותר
                    </span>
                </h1>

                {/* Subtitle */}
                <p className="text-base text-slate-600 font-medium mb-6 leading-relaxed">
                    פלטפורמת למידה חכמה שמייצרת מערכי שיעור, מבחנים ותוכן דיפרנציאלי - הכל בעברית.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col gap-3 mb-8">
                    <button
                        onClick={onLogin}
                        className="btn-lip-action w-full py-4 text-base font-bold flex items-center justify-center gap-2 min-h-[56px]"
                    >
                        <IconRocket className="w-5 h-5" />
                        התחל עכשיו בחינם
                    </button>
                    <button className="btn-lip-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2 min-h-[56px]">
                        <IconPlayerPlay className="w-5 h-5 fill-white" />
                        איך זה עובד?
                    </button>
                </div>

                {/* Social Proof */}
                <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
                    <div className="flex -space-x-2 space-x-reverse">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="w-7 h-7 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700">
                                {String.fromCharCode(64 + i)}
                            </div>
                        ))}
                    </div>
                    <span className="text-xs">בשימוש ע״י מאות מורים</span>
                </div>
            </section>

            {/* Mockup Preview - Simplified for Mobile */}
            <section className="px-4 pb-12">
                <div className="relative">
                    {/* Background blur */}
                    <div className="absolute inset-0 bg-wizdi-cyan/10 rounded-3xl blur-2xl"></div>

                    {/* Teacher View Card */}
                    <div className="relative bg-white rounded-2xl shadow-lg border border-slate-100 p-4 mb-4">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 mx-auto">TEACHER STUDIO</span>
                        </div>

                        <div className="bg-wizdi-cloud/50 p-3 rounded-xl border border-blue-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-sm text-wizdi-royal">יצירת פעילות</span>
                                <IconSparkles className="w-4 h-4 text-wizdi-cyan" />
                            </div>
                            <div className="h-1.5 bg-white rounded-full overflow-hidden">
                                <div className="h-full bg-wizdi-royal w-2/3 rounded-full"></div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1.5">מייצר שאלות אוטומטית...</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Process Section - Vertical Steps for Mobile */}
            <section className="px-4 py-12 bg-white">
                <div className="text-center mb-8">
                    <div className="inline-block px-3 py-1 rounded-full bg-indigo-50 text-wizdi-royal font-bold text-xs mb-3">
                        תהליך העבודה
                    </div>
                    <h2 className="text-2xl font-black text-wizdi-royal">איך הקסם עובד?</h2>
                </div>

                <div className="space-y-6">
                    {[
                        { icon: IconVideo, title: "העלה תוכן", desc: "קישור ליוטיוב, PDF או טקסט", color: "text-wizdi-royal", bg: "bg-white" },
                        { icon: IconSchool, title: "בחר רמה", desc: "הגדר שכבת גיל וסוג פעילות", color: "text-wizdi-royal", bg: "bg-white" },
                        { icon: IconRocket, title: "קבל שיעור", desc: "שאלות, סיכומים ופעילות מוכנים", color: "text-white", bg: "bg-wizdi-royal" }
                    ].map((step, idx) => (
                        <div key={idx} className="flex items-start gap-4">
                            <div className={`w-14 h-14 ${step.bg} rounded-2xl flex items-center justify-center shadow-md border border-slate-100 relative shrink-0`}>
                                <step.icon className={`w-7 h-7 ${idx === 2 ? 'text-wizdi-lime' : step.color}`} />
                                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-wizdi-cyan text-white font-black text-xs flex items-center justify-center border-2 border-white">
                                    {idx + 1}
                                </div>
                            </div>
                            <div className="pt-1">
                                <h3 className="text-lg font-bold text-wizdi-royal mb-1">{step.title}</h3>
                                <p className="text-sm text-slate-500">{step.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features Grid - Mobile Optimized */}
            <section className="px-4 py-12 bg-slate-50">
                <div className="text-center mb-8">
                    <div className="inline-block px-3 py-1 rounded-full bg-white text-wizdi-royal font-bold text-xs mb-3 border border-slate-100">
                        יכולות מתקדמות
                    </div>
                    <h2 className="text-2xl font-black text-wizdi-royal">יותר מסתם מחולל</h2>
                </div>

                <div className="space-y-4">
                    {/* Differentiation */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="w-12 h-12 bg-wizdi-royal rounded-xl flex items-center justify-center text-white mb-4">
                            <IconBrain className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-wizdi-royal mb-2">דיפרנציאציה אמיתית</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            המערכת מייצרת גרסאות שונות: תמיכה, ליבה והעשרה.
                        </p>
                    </div>

                    {/* Exam Mode */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center text-white mb-4">
                            <IconShieldLock className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">מצב מבחן מאובטח</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            טיימר, חסימת יציאה ודיווח ציונים.
                        </p>
                    </div>

                    {/* Book Import */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-white mb-4">
                            <IconBook className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">ספרי לימוד דיגיטליים</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            העלה PDF והפוך פרקים לשיעורים.
                        </p>
                    </div>

                    {/* Native Hebrew - Highlighted */}
                    <div className="bg-wizdi-royal p-5 rounded-2xl shadow-lg text-white">
                        <div className="inline-block px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold mb-3">בלעדי</div>
                        <h3 className="text-lg font-bold mb-2">עברית שפת אם</h3>
                        <p className="text-sm text-blue-100 leading-relaxed">
                            לא מתרגמת אלא מבינה. הניואנסים והתרבות הישראלית מוטמעים בליבה.
                        </p>
                    </div>
                </div>
            </section>

            {/* Tools Showcase - Horizontal Scroll */}
            <section className="py-12 bg-white">
                <div className="px-4 mb-6">
                    <div className="inline-block px-3 py-1 rounded-full bg-slate-50 text-wizdi-royal font-bold text-xs mb-3 border border-slate-100">
                        הכל במקום אחד
                    </div>
                    <h2 className="text-2xl font-black text-wizdi-royal">ארגז הכלים שלך</h2>
                </div>

                <div className="overflow-x-auto pb-4 -mx-4 px-4">
                    <div className="flex gap-3 w-max">
                        {[
                            { name: "YouTube לשיעור", icon: IconVideo, color: "text-red-500", bg: "bg-red-50" },
                            { name: "טקסט לפודקאסט", icon: IconHeadphones, color: "text-purple-500", bg: "bg-purple-50" },
                            { name: "חדר בריחה", icon: IconShieldLock, color: "text-green-500", bg: "bg-green-50" },
                            { name: "משחק הזיכרון", icon: IconBrain, color: "text-pink-500", bg: "bg-pink-50" },
                        ].map((tool, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center gap-3 w-[120px] shrink-0">
                                <div className={`w-14 h-14 ${tool.bg} rounded-xl flex items-center justify-center`}>
                                    <tool.icon className={`w-7 h-7 ${tool.color}`} />
                                </div>
                                <span className="font-bold text-slate-700 text-xs leading-tight">{tool.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Gamification Preview - Mobile */}
            <section className="py-12 bg-[#0F172A] text-white">
                <div className="px-4">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-wizdi-lime/10 border border-wizdi-lime/20 rounded-full text-wizdi-lime font-bold text-xs mb-4">
                            <IconTrophy className="w-3.5 h-3.5" />
                            <span>חווית תלמיד</span>
                        </div>
                        <h2 className="text-2xl font-black leading-tight">
                            שיעורי בית כמו{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-wizdi-lime to-wizdi-cyan">
                                משחק
                            </span>
                        </h2>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="bg-slate-800/60 p-3 rounded-2xl text-center border border-slate-700/50">
                            <IconFlame className="w-6 h-6 text-orange-500 mx-auto mb-1" />
                            <div className="font-black text-lg">12</div>
                            <div className="text-[9px] text-slate-500 font-bold uppercase">ימים</div>
                        </div>
                        <div className="bg-slate-800/60 p-3 rounded-2xl text-center border border-slate-700/50">
                            <IconCoin className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                            <div className="font-black text-lg">450</div>
                            <div className="text-[9px] text-slate-500 font-bold uppercase">מטבעות</div>
                        </div>
                        <div className="bg-slate-800/60 p-3 rounded-2xl text-center border border-slate-700/50">
                            <IconStar className="w-6 h-6 text-wizdi-cyan mx-auto mb-1" />
                            <div className="font-black text-lg">Top 5</div>
                            <div className="text-[9px] text-slate-500 font-bold uppercase">דירוג</div>
                        </div>
                    </div>

                    {/* Feature Pills */}
                    <div className="flex flex-col gap-3">
                        <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                                <IconFlame className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-bold text-sm">Streaks</div>
                                <p className="text-slate-400 text-xs">מעודד התמדה יומיומית</p>
                            </div>
                        </div>
                        <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-400 shrink-0">
                                <IconCoin className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-bold text-sm">חנות פרסים</div>
                                <p className="text-slate-400 text-xs">תגמול על הצטיינות</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer CTA */}
            <section className="bg-wizdi-royal py-12 px-4 text-center text-white safe-area-inset-bottom">
                <h2 className="text-2xl font-black mb-6">מוכנים להתחיל?</h2>
                <button
                    onClick={onLogin}
                    className="btn-lip-action w-full py-4 text-lg font-bold min-h-[56px]"
                >
                    הצטרפו בחינם
                </button>
                <p className="mt-4 text-blue-200 text-sm">ללא התחייבות • ללא כרטיס אשראי</p>
            </section>
        </div>
    );
};

export default LandingPageMobile;
