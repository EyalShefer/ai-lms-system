
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import {
    IconList, IconSparkles,
    IconChart, IconBack,
    IconStudent, IconConstruction
} from '../icons';

const HomePage = ({ onCreateNew, onNavigateToDashboard }: { onCreateNew: (mode: string) => void, onNavigateToDashboard: () => void }) => {
    const { currentUser } = useAuth();
    const firstName = currentUser?.email?.split('@')[0] || "מורה";
    const [activeStep, setActiveStep] = useState<number>(0);

    useEffect(() => {
        const hasSeenAnimation = localStorage.getItem('wizdi_how_it_works_seen');

        if (!hasSeenAnimation) {
            const timeouts: NodeJS.Timeout[] = [];
            timeouts.push(setTimeout(() => setActiveStep(1), 1000));
            timeouts.push(setTimeout(() => setActiveStep(2), 2000));
            timeouts.push(setTimeout(() => setActiveStep(3), 3000));
            timeouts.push(setTimeout(() => setActiveStep(4), 4000));
            timeouts.push(setTimeout(() => {
                setActiveStep(0);
                localStorage.setItem('wizdi_how_it_works_seen', 'true');
            }, 5000));

            return () => timeouts.forEach(clearTimeout);
        }
    }, []);

    const handleCardClick = (actionName: string, callback: () => void) => {
        console.log(`Clicked card: ${actionName}`);
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
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">

            {/* Main Container */}
            <div className="max-w-6xl mx-auto px-6 py-16">

                {/* Hero Section */}
                <div className="text-center mb-20">
                    <div className="flex justify-center mb-8">
                        <img
                            src="/WizdiLogo.png"
                            alt="Wizdi Studio"
                            className="h-20 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    </div>

                    <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight">
                        {getTimeBasedGreeting()}, {firstName}
                    </h1>
                    <p className="text-xl text-gray-400 font-light max-w-xl mx-auto">
                        הסטודיו שלך ליצירה, למידה והערכה חכמה
                    </p>
                </div>

                {/* Cards Grid - Eedi Style */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-24">

                    {/* Card 1: Create Content - Primary */}
                    <div
                        onClick={() => handleCardClick("Learning Generator", () => onCreateNew('learning'))}
                        className="group relative bg-[#111] border border-gray-800 rounded-2xl p-8 cursor-pointer hover:border-gray-700 hover:bg-[#151515] transition-all duration-300"
                    >
                        <div className="absolute top-6 left-6">
                            <span className="text-[10px] font-semibold tracking-widest text-blue-400 uppercase">מומלץ</span>
                        </div>

                        <div className="mb-6">
                            <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6">
                                <IconSparkles className="w-7 h-7 text-blue-400" />
                            </div>

                            <h2 className="text-2xl font-semibold text-white mb-3">
                                יצירת תוכן חדש
                            </h2>

                            <p className="text-gray-400 leading-relaxed">
                                התחילו בבחירת נושא, קובץ או סרטון. המערכת תייצר שיעור אינטראקטיבי, פודקאסט AI, או תרגול משחקי.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 text-blue-400 text-sm font-medium group-hover:gap-3 transition-all">
                            <span>התחילו עכשיו</span>
                            <IconBack className="w-4 h-4 rotate-180" />
                        </div>
                    </div>

                    {/* Card 2: Create Exam */}
                    <div
                        onClick={() => handleCardClick("Exam Creator", () => onCreateNew('exam'))}
                        className="group relative bg-[#111] border border-gray-800 rounded-2xl p-8 cursor-pointer hover:border-gray-700 hover:bg-[#151515] transition-all duration-300"
                    >
                        <div className="mb-6">
                            <div className="w-14 h-14 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6">
                                <IconList className="w-7 h-7 text-emerald-400" />
                            </div>

                            <h2 className="text-2xl font-semibold text-white mb-3">
                                יצירת מבחן
                            </h2>

                            <p className="text-gray-400 leading-relaxed">
                                הזינו חומר לימוד והמערכת תבנה שאלון הערכה מלא, תבדוק תשובות, ותנהל ציונים אוטומטית.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium group-hover:gap-3 transition-all">
                            <span>ליצירת מבחן</span>
                            <IconBack className="w-4 h-4 rotate-180" />
                        </div>
                    </div>

                    {/* Card 3: Dashboard - Full Width */}
                    <div
                        onClick={() => handleCardClick("Dashboard", onNavigateToDashboard)}
                        className="group md:col-span-2 bg-[#111] border border-gray-800 rounded-2xl p-8 cursor-pointer hover:border-gray-700 hover:bg-[#151515] transition-all duration-300"
                    >
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                            <div className="flex items-start gap-5">
                                <div className="w-14 h-14 bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <IconChart className="w-7 h-7 text-purple-400" />
                                </div>

                                <div>
                                    <h2 className="text-2xl font-semibold text-white mb-2">
                                        לוח הפעילויות והמבחנים
                                    </h2>

                                    <p className="text-gray-400 leading-relaxed max-w-xl">
                                        צפייה בנתוני התלמידים, דוחות מפורטים, ציונים ומעקב אחר התקדמות בזמן אמת.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-purple-400 text-sm font-medium group-hover:gap-3 transition-all whitespace-nowrap">
                                <span>כניסה ללוח</span>
                                <IconBack className="w-4 h-4 rotate-180" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* How It Works - Minimal Style */}
                <div className="mb-16">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl font-semibold text-white mb-2">איך זה עובד?</h2>
                        <p className="text-gray-500">מתהליך פשוט לחוויית למידה מלאה</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {[
                            { icon: IconSparkles, title: "המורים יוצרים", desc: "נושא, קובץ או תבנית", step: 1 },
                            { icon: IconConstruction, title: "המערכת בונה", desc: "AI יוצר שאלות ותוכן", step: 2 },
                            { icon: IconStudent, title: "התלמידים חווים", desc: "למידה מותאמת אישית", step: 3 },
                            { icon: IconChart, title: "תובנות למורים", desc: "דוחות וניתוח נתונים", step: 4 },
                        ].map((item, idx) => (
                            <div key={idx} className="text-center group">
                                <div className={`relative mx-auto mb-4 w-16 h-16 rounded-full bg-[#151515] border border-gray-800 flex items-center justify-center transition-all duration-500 ${activeStep === item.step ? 'border-blue-500 bg-blue-500/10 scale-110' : 'group-hover:border-gray-700'}`}>
                                    <item.icon className={`w-7 h-7 transition-colors ${activeStep === item.step ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-400'}`} />
                                    <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${activeStep === item.step ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-500'}`}>
                                        {item.step}
                                    </span>
                                </div>
                                <h3 className="font-medium text-white mb-1 text-sm">{item.title}</h3>
                                <p className="text-xs text-gray-500">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default HomePage;
