import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    IconBrain, IconArrowBack, IconSparkles,
    IconCheck, IconX, IconBook, IconStudent, IconChart, IconWand, IconCloudUpload
} from '../icons';

// --- רשימות מיושרות עם הדשבורד ---
const GRADES = [
    "כיתה א׳", "כיתה ב׳", "כיתה ג׳", "כיתה ד׳", "כיתה ה׳", "כיתה ו׳",
    "כיתה ז׳", "כיתה ח׳", "כיתה ט׳",
    "כיתה י׳", "כיתה י״א", "כיתה י״ב",
    "מכינה", "סטודנטים", "הכשרה מקצועית"
];

const SUBJECTS = [
    "חינוך לשוני (עברית)", "מתמטיקה", "אנגלית", "מדע וטכנולוגיה",
    "היסטוריה", "אזרחות", "תנ״ך", "ספרות", "גיאוגרפיה",
    "פיזיקה", "כימיה", "ביולוגיה", "מדעי המחשב", "הנדסת תוכנה", "רובוטיקה",
    "חינוך גופני", "חינוך פיננסי", "אמנות", "תקשורת", "פסיכולוגיה", "סוציולוגיה", "אחר"
];

interface IngestionWizardProps {
    onComplete: (data: any) => void;
    onCancel: () => void;
    initialTopic?: string;
    initialMode?: 'learning' | 'exam';
    title?: string;
    cancelLabel?: string;
    cancelIcon?: React.ReactNode;
}

const IngestionWizard: React.FC<IngestionWizardProps> = ({
    onComplete,
    onCancel,
    initialTopic,
    initialMode = 'learning',
    cancelLabel = "חזרה",
    cancelIcon = <IconArrowBack className="w-4 h-4 rotate-180" /> // חץ ימינה (חזרה)
}) => {
    // אתחול המצבים
    const [step, setStep] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [mode, setMode] = useState<'upload' | 'topic' | 'text' | null>(null); // 'upload' | 'topic' | 'text'
    const [topic, setTopic] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [pastedText, setPastedText] = useState('');

    // נתוני שלב 2
    const [customTitle, setCustomTitle] = useState('');

    // ברירת מחדל תואמת לרשימה
    const [grade, setGrade] = useState(GRADES[6]); // כיתה ז' כברירת מחדל
    const [subject, setSubject] = useState('חינוך לשוני (עברית)');
    const [activityLength, setActivityLength] = useState<'short' | 'medium' | 'long'>('medium');
    const [taxonomy, setTaxonomy] = useState<{ knowledge: number; application: number; evaluation: number }>({ knowledge: 30, application: 50, evaluation: 20 });
    const [includeBot, setIncludeBot] = useState(false);
    const [botPersona, setBotPersona] = useState('socratic'); // Default Persona
    const [courseMode, setCourseMode] = useState(initialMode);
    const [showSourceToStudent, setShowSourceToStudent] = useState(true);

    useEffect(() => {
        if (initialTopic && initialTopic !== "טוען..." && initialTopic.trim() !== "") {
            setTopic(initialTopic);
            setCustomTitle(initialTopic);
            setMode('topic');
            setStep(2);
        }
    }, [initialTopic]);

    // עדכון ה-Mode כשהוא משתנה מבחוץ
    useEffect(() => {
        setCourseMode(initialMode);
    }, [initialMode]);

    const handleTaxonomyChange = (changedKey: keyof typeof taxonomy, newValue: number) => {
        const remainingSpace = 100 - newValue;
        // Cast keys to correct type
        const otherKeys = Object.keys(taxonomy).filter(k => k !== changedKey) as (keyof typeof taxonomy)[];
        const keyA = otherKeys[0];
        const keyB = otherKeys[1];
        const currentOthersTotal = taxonomy[keyA] + taxonomy[keyB];
        let newA, newB;
        if (currentOthersTotal === 0) { newA = remainingSpace / 2; newB = remainingSpace / 2; }
        else { const ratio = taxonomy[keyA] / currentOthersTotal; newA = Math.round(remainingSpace * ratio); newB = remainingSpace - newA; }
        setTaxonomy({ ...taxonomy, [changedKey]: newValue, [keyA]: newA, [keyB]: newB });
    };


    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
        maxFiles: 1,
        noClick: true,
        onDrop: (acceptedFiles) => { setFile(acceptedFiles[0]); setMode('upload'); }
    });

    // בדיקת תקינות למעבר שלבים
    const canProceedToSettings = mode && ((mode === 'topic' && topic) || (mode === 'upload' && file) || (mode === 'text' && pastedText));

    const handleStepClick = (targetStep: number) => {
        // מותר תמיד לחזור לשלב 1
        if (targetStep === 1) {
            setStep(1);
        }
        // מותר להתקדם לשלב 2 רק אם יש נתונים
        else if (targetStep === 2 && canProceedToSettings) {
            if (step === 1) updateTitleFromInput();
            setStep(2);
        }
    };

    const updateTitleFromInput = () => {
        let suggestedTitle = customTitle;
        if (!suggestedTitle) {
            if (mode === 'upload' && file) {
                suggestedTitle = file.name.replace(/\.[^/.]+$/, "");
            } else if (mode === 'topic' && topic) {
                suggestedTitle = topic;
            } else if (mode === 'text' && pastedText) {
                suggestedTitle = topic || "פעילות טקסט חופשי"; // Use topic if provided, else default
            }
        }
        setCustomTitle(suggestedTitle);
    };

    const handleNext = async () => {
        if (step === 1 && mode) {
            updateTitleFromInput();
            setStep(2);
        }
        else if (step === 2) {
            setIsProcessing(true);

            // הכנת הנתונים לשליחה
            const finalData = {
                mode,
                file,
                pastedText,
                title: customTitle || topic || "פעילות חדשה",
                originalTopic: topic,
                topic: customTitle || topic || "פעילות חדשה", // Kept for backward compatibility if needed, but we should use title/originalTopic
                settings: {
                    subject: subject || "כללי",
                    activityLength,
                    taxonomy,
                    includeBot,
                    botPersona: includeBot ? botPersona : null,
                    courseMode,
                    showSourceToStudent
                }
            }
            if (onComplete) {
                await onComplete(finalData);
            }
        }
    };

    const handleBack = () => {
        if (step === 2) {
            setStep(1);
        } else {
            onCancel();
        }
    };

    // שינוי טקסטים: "שיעור" -> "פעילות"
    const dynamicTitle = courseMode === 'exam' ? 'יצירת מבחן חדש' : 'יצירת פעילות חדשה';
    const dynamicSubtitle = mode === 'topic' && topic
        ? `יצירת ${courseMode === 'exam' ? 'מבחן' : 'פעילות'} בנושא: ${topic}`
        : mode === 'text'
            ? `יצירת ${courseMode === 'exam' ? 'מבחן' : 'פעילות'} מטקסט חופשי`
            : `בוא נהפוך את החומרים שלך ל${courseMode === 'exam' ? 'מבחן' : 'פעילות'}`;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-16 animate-fade-in overflow-y-auto">
            <div className={`bg-white/90 glass w-full ${courseMode === 'exam' ? 'max-w-6xl' : (step === 1 ? 'max-w-4xl' : 'max-w-2xl')} rounded-3xl shadow-2xl overflow-hidden border border-white/50 flex flex-col max-h-[85vh] relative mb-10 transition-all duration-500 ease-in-out`}>

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-10 -translate-y-10">
                        <IconWand className="w-64 h-64" />
                    </div>
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-black mb-2 flex items-center gap-3 !text-white">
                                <IconSparkles className="w-8 h-8 text-yellow-300" />
                                {dynamicTitle}
                            </h2>
                            <p className="text-lg opacity-90 !text-blue-100">
                                {dynamicSubtitle}
                            </p>
                        </div>
                        <button onClick={onCancel} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors backdrop-blur-md text-white cursor-pointer z-50 hover:rotate-90 duration-300">
                            <IconX className="w-6 h-6" />
                        </button>
                    </div>

                    {!initialTopic && (
                        <div className="flex items-center justify-center gap-2 mt-8 relative z-10 w-full">
                            {/* כפתור שלב 1 - תמיד לחיץ */}
                            <button
                                onClick={() => handleStepClick(1)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer ${step >= 1 ? 'bg-white text-blue-600 shadow-sm' : 'bg-blue-800/30 text-blue-200 border border-blue-400/30'}`}
                            >
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? 'bg-blue-100 text-blue-600' : 'bg-blue-800/50 text-white'}`}>1</span>
                                בחירת מקור
                            </button>

                            <div className={`w-8 h-0.5 transition-colors ${step >= 2 ? 'bg-white' : 'bg-blue-400/30'}`}></div>

                            {/* כפתור שלב 2 - לחיץ רק אם אפשר להתקדם */}
                            <button
                                onClick={() => handleStepClick(2)}
                                disabled={!canProceedToSettings}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${canProceedToSettings ? 'cursor-pointer hover:bg-white/10' : 'cursor-not-allowed opacity-50'} ${step >= 2 ? 'bg-white text-blue-600 shadow-sm' : 'bg-blue-800/30 text-blue-200 border border-blue-400/30'}`}
                            >
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-blue-100 text-blue-600' : 'bg-blue-800/50 text-white'}`}>2</span>
                                אפיון והגדרות
                            </button>

                            <div className="w-8 h-0.5 bg-blue-400/30"></div>

                            {/* שלב 3 - לא לחיץ כרגע (תוצאה) */}
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-blue-800/30 text-blue-200 border border-blue-400/30 opacity-70 cursor-default">
                                <span className="w-6 h-6 rounded-full bg-blue-800/50 text-white flex items-center justify-center text-xs">3</span>
                                עריכה וסיום
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-8 flex-1 overflow-y-auto bg-gradient-to-b from-white to-blue-50/30 custom-scrollbar">
                    {step === 1 && (
                        <div className="space-y-8 animate-slide-up">
                            <h3 className="text-xl font-bold text-gray-700 text-center">איך נתחיל היום?</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-64">
                                <button onClick={() => setMode('topic')} className={`group relative p-8 rounded-3xl border-2 transition-all duration-300 text-right flex flex-col justify-between overflow-hidden h-64 ${mode === 'topic' ? 'border-pink-500 bg-pink-50/50 shadow-lg ring-4 ring-pink-100' : 'border-gray-200 bg-white hover:border-pink-300 hover:shadow-md'}`}>
                                    <div className="bg-pink-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><IconBrain className="w-8 h-8 text-pink-600" /></div>
                                    <div><h4 className="text-xl font-bold text-gray-800 mb-2">הקלידו נושא</h4><p className="text-sm text-gray-500 leading-relaxed">הגדירו נושא וה-AI ייצור עבורכם {courseMode === 'exam' ? 'מבחן' : 'פעילות'} עשירה על בסיס הידע הרחב שלו.</p></div>
                                    {mode === 'topic' && <div className="absolute top-4 left-4 bg-blue-500 text-white p-1 rounded-full"><IconCheck className="w-4 h-4" /></div>}
                                </button>

                                <div
                                    {...getRootProps()}
                                    onClick={() => {
                                        setMode('upload');
                                        open();
                                    }}
                                    className={`group relative p-8 rounded-3xl border-2 border-dashed transition-all duration-300 text-right flex flex-col justify-between overflow-hidden h-64 cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-100' : mode === 'upload' ? 'border-blue-500 bg-blue-50/50 shadow-lg ring-4 ring-blue-100' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'}`}
                                >
                                    <input {...getInputProps()} />
                                    {file ? (<div className="flex flex-col items-center justify-center h-full text-center animate-fade-in"><div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-sm"><IconCheck className="w-10 h-10 text-green-600" /></div><h4 className="text-xl font-bold text-gray-800">{file.name}</h4><p className="text-sm text-gray-500 mt-2">הקובץ מוכן. <br /><span className="font-bold text-blue-600">שימו לב: הפעילות תתבסס רק על המידע שבקובץ.</span></p><span className="text-xs text-blue-600 underline mt-2">לחצו להחלפה</span></div>) : (<><div className="bg-indigo-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><IconCloudUpload className="w-8 h-8 text-indigo-600" /></div><div><h4 className="text-xl font-bold text-gray-800 mb-2">העלו קובץ</h4><p className="text-sm text-gray-500 leading-relaxed">העלו קובץ PDF/Word. <span className="font-bold text-indigo-600 block mt-1">ה-AI ייצור {courseMode === 'exam' ? 'מבחן' : 'פעילות'} בהסתמך אך ורק על תוכן הקובץ.</span></p></div>{mode === 'upload' && !file && <div className="absolute top-4 left-4 bg-gray-200 text-gray-500 p-1 rounded-full"><IconCloudUpload className="w-4 h-4" /></div>}</>)}
                                </div>
                                <button onClick={() => setMode('text')} className={`group relative p-8 rounded-3xl border-2 transition-all duration-300 text-right flex flex-col justify-between overflow-hidden h-64 ${mode === 'text' ? 'border-blue-500 bg-blue-50/50 shadow-lg ring-4 ring-blue-100' : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'}`}>
                                    <div className="bg-green-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><IconBook className="w-8 h-8 text-green-600" /></div>
                                    <div><h4 className="text-xl font-bold text-gray-800 mb-2">הדביקו טקסט</h4><p className="text-sm text-gray-500 leading-relaxed">הדביקו מאמר או סיכום. <span className="font-bold text-green-600 block mt-1">הפעילות תיווצר אך ורק על בסיס הטקסט שתדביקו.</span></p></div>
                                    {mode === 'text' && <div className="absolute top-4 left-4 bg-blue-500 text-white p-1 rounded-full"><IconCheck className="w-4 h-4" /></div>}
                                </button>
                            </div>
                            {mode === 'topic' && (
                                <div className="animate-fade-in mt-6">
                                    <label className="block text-lg font-bold text-gray-700 mb-2">כתבו כאן את נושא {courseMode === 'exam' ? 'המבחן' : 'הפעילות'}:</label>
                                    <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm" placeholder="למשל: המהפכה הצרפתית, יסודות הפיזיקה..." autoFocus />
                                </div>
                            )}
                            {mode === 'text' && (
                                <div className="animate-fade-in mt-6">
                                    <label className="block text-lg font-bold text-gray-700 mb-2">נושא הטקסט (מומלץ):</label>
                                    <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full p-4 mb-4 text-lg border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm" placeholder="למשל: תקציר הספר, מאמר דעה..." />

                                    <label className="block text-lg font-bold text-gray-700 mb-2">הדביקו כאן את הטקסט:</label>
                                    <textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)} className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm min-h-[150px]" placeholder="הדביקו תוכן כאן..." autoFocus />
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className={`grid grid-cols-1 ${courseMode === 'exam' ? 'md:grid-cols-2' : ''} gap-10 animate-slide-up h-full pb-20`}>
                            {/* עמודה ימנית - הגדרות טכניות */}
                            <div className="space-y-6 bg-blue-50/50 p-6 rounded-3xl border border-blue-100 order-2 md:order-1">
                                {/* שדה שם הפעילות החדשה */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                        <IconSparkles className="w-4 h-4 text-blue-600" />
                                        שם הפעילות
                                    </label>
                                    <input
                                        type="text"
                                        value={customTitle}
                                        onChange={(e) => setCustomTitle(e.target.value)}
                                        className="w-full p-3 border border-gray-300 rounded-xl focus:border-blue-500 outline-none bg-white font-bold text-gray-800"
                                        placeholder="למשל: מבוא לפוטוסינתזה"
                                    />
                                </div>

                                <div><label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><IconBook className="w-4 h-4" /> תחום דעת</label><select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl focus:border-blue-500 outline-none bg-white cursor-pointer">{SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><IconStudent className="w-4 h-4" /> קהל יעד</label><select value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl focus:border-blue-500 outline-none bg-white cursor-pointer">{GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select></div>

                                <div className="pt-4 border-t border-blue-200/50">
                                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><IconChart className="w-4 h-4" /> אורך הפעילות</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'short', label: 'קצרה', desc: '3 שלבי לימוד' },
                                            { id: 'medium', label: 'בינונית', desc: '5 שלבי לימוד (מומלץ)' },
                                            { id: 'long', label: 'ארוכה', desc: '7 שלבי לימוד' }
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setActivityLength(opt.id as any)}
                                                className={`p-2 rounded-xl text-center transition-all ${activityLength === opt.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}
                                            >
                                                <div className="font-bold text-sm">{opt.label}</div>
                                                <div className={`text-xs ${activityLength === opt.id ? 'text-blue-100' : 'text-gray-400'}`}>{opt.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>


                                {/* Source Text Visibility Toggle (Only for File Upload mode) */}
                                {mode === 'upload' && (
                                    <div className="pt-4 border-t border-blue-200/50">
                                        <label className="flex items-center justify-between cursor-pointer group mb-1 p-3 bg-white/50 rounded-xl border border-blue-100 hover:border-blue-300 transition-colors">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800 text-sm">הצג מקור לתלמיד</span>
                                                <span className="text-xs text-gray-500">האם לאפשר לתלמיד לצפות בקובץ/טקסט המקור?</span>
                                            </div>

                                            <div className="relative">
                                                <input type="checkbox" checked={showSourceToStudent} onChange={(e) => setShowSourceToStudent(e.target.checked)} className="hidden" />
                                                <div className={`w-12 h-7 rounded-full transition-all duration-300 ease-in-out ${showSourceToStudent ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                                                <div className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${showSourceToStudent ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                            </div>
                                        </label>
                                    </div>
                                )}

                                {/* Bot Configuration */}
                                <div className="pt-4 border-t border-blue-200/50">
                                    <label className="flex items-center justify-between cursor-pointer group mb-4 p-3 bg-white/50 rounded-xl border border-blue-100 hover:border-blue-300 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 text-sm">המורה הוירטואלי</span>
                                            <span className="text-xs text-gray-500">הוסף צ'אט בוט לעזרה בתחילת הפעילות</span>
                                        </div>

                                        <div className="relative">
                                            <input type="checkbox" checked={includeBot} onChange={(e) => setIncludeBot(e.target.checked)} className="hidden" />
                                            <div className={`w-12 h-7 rounded-full transition-all duration-300 ease-in-out ${includeBot ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                                            <div className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${includeBot ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                        </div>
                                    </label>

                                    {includeBot && (
                                        <div className="grid grid-cols-2 gap-2 pl-9 animate-fade-in">
                                            {[
                                                { id: 'socratic', label: 'סוקרטי', desc: 'שואל ומכוון', icon: '🧠' },
                                                { id: 'teacher', label: 'מורה מלווה', desc: 'מסביר ותומך', icon: '👨‍🏫' },
                                                { id: 'concise', label: 'תמציתי', desc: 'קצר ולעניין', icon: '⚡' },
                                                { id: 'coach', label: 'מאמן', desc: 'מאתגר ודורש', icon: '🏆' },
                                            ].map((p) => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => setBotPersona(p.id)}
                                                    className={`p-2 rounded-xl text-right transition-all border ${botPersona === p.id ? 'bg-blue-50 border-blue-400 shadow-sm ring-1 ring-blue-200' : 'bg-white border-gray-200 hover:border-blue-300'}`}
                                                >
                                                    <div className="font-bold text-xs text-gray-800 flex items-center gap-1">
                                                        <span>{p.icon}</span> {p.label}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 mr-5">{p.desc}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* עמודה שמאלית - טקסונומיה (רק במצב מבחן) */}
                            {courseMode === 'exam' && (
                                <div className="space-y-4 order-1 md:order-2">
                                    <div className="flex items-center gap-2 mb-1"><IconBrain className="w-6 h-6 text-pink-500" /><h3 className="text-xl font-bold text-gray-800">רמות חשיבה</h3></div>
                                    <p className="text-sm text-gray-500 mb-4">קבעו את תמהיל השאלות והתוכן.</p>
                                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:border-green-200 transition-colors">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="font-bold text-green-600 text-base">ידע והבנה</label>
                                            <span className="font-mono font-bold text-sm bg-green-50 text-green-700 px-2 py-0.5 rounded-md">{taxonomy.knowledge}%</span>
                                        </div>
                                        <input type="range" min="0" max="100" value={taxonomy.knowledge} onChange={(e) => handleTaxonomyChange('knowledge', parseInt(e.target.value))} className="w-full accent-green-500 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" />
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:border-blue-200 transition-colors">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="font-bold text-blue-600 text-base">יישום וניתוח</label>
                                            <span className="font-mono font-bold text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">{taxonomy.application}%</span>
                                        </div>
                                        <input type="range" min="0" max="100" value={taxonomy.application} onChange={(e) => handleTaxonomyChange('application', parseInt(e.target.value))} className="w-full accent-blue-500 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" />
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:border-indigo-200 transition-colors">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="font-bold text-indigo-600 text-base">הערכה ויצירה</label>
                                            <span className="font-mono font-bold text-sm bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">{taxonomy.evaluation}%</span>
                                        </div>
                                        <input type="range" min="0" max="100" value={taxonomy.evaluation} onChange={(e) => handleTaxonomyChange('evaluation', parseInt(e.target.value))} className="w-full accent-indigo-500 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50/80 flex justify-between shrink-0 items-center">
                    {step > 1 ? (
                        <button onClick={handleBack} className="text-gray-500 hover:text-blue-600 font-bold px-4 flex items-center gap-2 transition-colors">
                            {cancelIcon} {initialTopic ? cancelLabel : 'חזרה'}
                        </button>
                    ) : <div></div>}

                    <button
                        onClick={handleNext}
                        disabled={(!mode) || (step === 1 && mode === 'topic' && !topic) || (step === 1 && mode === 'upload' && !file) || (step === 1 && mode === 'text' && !pastedText) || isProcessing}
                        className={`
                            bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
                            text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl
                            transition-all transform hover:-translate-y-1
                            disabled:opacity-50 disabled:cursor-not-allowed
                            flex items-center justify-center gap-3 whitespace-nowrap
                            ml-auto
                        `}
                    >
                        {isProcessing ? (
                            <>
                                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                                <span>{step === 1 ? 'מעבד...' : (courseMode === 'exam' ? 'מייצר מבחן...' : 'מייצר פעילות...')}</span>
                            </>
                        ) : (
                            <>
                                {step === 1 ? 'המשיכו להגדרות מתקדמות' : (courseMode === 'exam' ? 'צרו מבחן עכשיו!' : 'צרו פעילות עכשיו!')}
                                <IconArrowBack className="w-5 h-5 shrink-0" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div >
    );
};

export default IngestionWizard;