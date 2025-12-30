import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    IconBrain, IconArrowBack, IconSparkles,
    IconCheck, IconX, IconBook, IconStudent, IconChart, IconWand, IconCloudUpload, IconVideo
} from '../icons';
import { MultimodalService } from '../services/multimodalService';
import { runPedagogicalTests } from '../utils/testPedagogicalValidation';

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
    const [mode, setMode] = useState<'upload' | 'topic' | 'text' | 'multimodal' | null>(null); // 'upload' | 'topic' | 'text' | 'multimodal'
    const [topic, setTopic] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [pastedText, setPastedText] = useState('');
    // const [youtubeUrl, setYoutubeUrl] = useState(''); // Removed unused
    const [subMode, setSubMode] = useState<'youtube' | 'audio' | null>(null);

    // נתוני שלב 2
    const [customTitle, setCustomTitle] = useState('');

    // ברירת מחדל תואמת לרשימה
    const [grade, setGrade] = useState(GRADES[6]); // כיתה ז' כברירת מחדל
    const [subject, setSubject] = useState('חינוך לשוני (עברית)');
    const [activityLength, setActivityLength] = useState<'short' | 'medium' | 'long'>('medium');
    const [taxonomy, setTaxonomy] = useState<{ knowledge: number; application: number; evaluation: number }>({ knowledge: 30, application: 50, evaluation: 20 });
    const [includeBot] = useState(false); // Fix: defaulted to false, setter removed
    const [botPersona] = useState('socratic'); // Default Persona, setter removed
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
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'text/plain': ['.txt'],
            'audio/mpeg': ['.mp3', '.mpga'],
            'audio/wav': ['.wav'],
            'audio/m4a': ['.m4a']
        },
        maxFiles: 1,
        maxSize: 10485760, // 10MB Limit
        noClick: true,
        onDropRejected: (rejectedFiles) => {
            const error = rejectedFiles[0]?.errors[0];
            if (error?.code === 'file-too-large') {
                alert("הקובץ גדול מדי. הגודל המקסימלי הוא 10MB.");
            } else {
                alert("שגיאה בהעלאת הקובץ. אנא נסה שוב.");
            }
        },
        onDrop: async (acceptedFiles) => {
            const f = acceptedFiles[0];
            if (!f) return;

            if (f.type.startsWith('audio/')) {
                // Audio Handling
                setMode('multimodal');
                setSubMode('audio');
                setIsProcessing(true);
                const text = await MultimodalService.transcribeAudio(f);
                if (text) {
                    setPastedText(text);
                    setTopic(f.name.replace(/\.[^/.]+$/, "")); // Auto topic from filename
                } else {
                    alert("תמלול הקובץ נכשל. נסה שנית.");
                }
                setIsProcessing(false);
            } else {
                // Std File Handling
                setFile(f);
                setMode('upload');
            }
        }
    });

    // בדיקת תקינות למעבר שלבים
    const canProceedToSettings = mode && (
        (mode === 'topic' && topic) ||
        (mode === 'upload' && file) ||
        (mode === 'text' && pastedText) ||
        (mode === 'multimodal' && pastedText) // For audio/video, we need the transcript
    );

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
                    grade: grade, // Fix: Explicitly include grade
                    targetAudience: grade, // Fix: Also map to targetAudience for compatibility
                    activityLength,
                    taxonomy,
                    includeBot,
                    botPersona: includeBot ? botPersona : null,
                    courseMode,
                    showSourceToStudent
                },
                targetAudience: grade // Fix: Top-level backup
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
            : mode === 'multimodal'
                ? `יצירת ${courseMode === 'exam' ? 'מבחן' : 'פעילות'} מ${subMode === 'youtube' ? 'סרטון' : 'הקלטה'}`
                : `בוא נהפוך את החומרים שלך ל${courseMode === 'exam' ? 'מבחן' : 'פעילות'}`;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-16 animate-fade-in overflow-y-auto bg-slate-900/40 backdrop-blur-sm">
            {/* DEBUG TEST BUTTON - Preserved from local work */}
            <button
                onClick={runPedagogicalTests}
                className="fixed top-24 left-4 z-[200] bg-red-600 text-white text-xs px-2 py-1 rounded shadow-lg opacity-50 hover:opacity-100 transition-opacity"
            >
                🧪 Run Validation Tests
            </button>

            <div className={`bg-white w-full ${courseMode === 'exam' ? 'max-w-6xl' : (step === 1 ? 'max-w-4xl' : 'max-w-2xl')} rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh] relative mb-10 transition-all duration-500 ease-in-out`}>

                {/* Header */}
                <div className="bg-wizdi-royal p-8 text-white relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-10 -translate-y-10 animate-pulse">
                        <IconWand className="w-64 h-64" />
                    </div>
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-black mb-2 flex items-center gap-3 !text-white">
                                <IconSparkles className="w-8 h-8 text-wizdi-lime animate-wiggle" />
                                {dynamicTitle}
                            </h2>
                            <p className="text-lg opacity-90 !text-blue-100 font-medium">
                                {dynamicSubtitle}
                            </p>
                        </div>
                        <button onClick={onCancel} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors backdrop-blur-md text-white cursor-pointer z-50 hover:rotate-90 duration-300 shadow-glass">
                            <IconX className="w-6 h-6" />
                        </button>
                    </div>

                    {!initialTopic && (
                        <div className="flex items-center justify-center gap-4 mt-8 relative z-10 w-full">
                            {/* כפתור שלב 1 - תמיד לחיץ */}
                            <button
                                onClick={() => handleStepClick(1)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-full text-base font-black transition-all cursor-pointer ${step >= 1 ? 'bg-white text-wizdi-royal shadow-lg transform -translate-y-1' : 'bg-blue-900/40 text-blue-200 border-2 border-blue-400/30'}`}
                            >
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step >= 1 ? 'bg-blue-100 text-wizdi-royal' : 'bg-blue-800/50 text-white'}`}>1</span>
                                בחירת מקור
                            </button>

                            <div className={`w-12 h-1 rounded-full transition-colors ${step >= 2 ? 'bg-white' : 'bg-blue-400/30'}`}></div>

                            {/* כפתור שלב 2 - לחיץ רק אם אפשר להתקדם */}
                            <button
                                onClick={() => handleStepClick(2)}
                                disabled={!canProceedToSettings}
                                className={`flex items-center gap-2 px-6 py-3 rounded-full text-base font-black transition-all ${canProceedToSettings ? 'cursor-pointer hover:bg-white/10' : 'cursor-not-allowed opacity-50'} ${step >= 2 ? 'bg-white text-wizdi-royal shadow-lg transform -translate-y-1' : 'bg-blue-900/40 text-blue-200 border-2 border-blue-400/30'}`}
                            >
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step >= 2 ? 'bg-blue-100 text-wizdi-royal' : 'bg-blue-800/50 text-white'}`}>2</span>
                                אפיון והגדרות
                            </button>

                            <div className="w-12 h-1 rounded-full bg-blue-400/30"></div>

                            {/* שלב 3 - לא לחיץ כרגע (תוצאה) */}
                            <div className="flex items-center gap-2 px-6 py-3 rounded-full text-base font-black bg-blue-900/40 text-blue-200 border-2 border-blue-400/30 opacity-70 cursor-default">
                                <span className="w-8 h-8 rounded-full bg-blue-800/50 text-white flex items-center justify-center text-sm">3</span>
                                עריכה וסיום
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-8 flex-1 overflow-y-auto bg-slate-50 custom-scrollbar">
                    {step === 1 && (
                        <div className="space-y-8 animate-slide-up">
                            <h3 className="text-xl font-bold text-slate-800 text-center">איך נתחיל היום?</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-64">
                                <button onClick={() => setMode('topic')} className={`group relative p-8 rounded-3xl border-2 transition-all duration-300 text-right flex flex-col justify-between overflow-hidden h-64 ${mode === 'topic' ? 'border-pink-500 bg-pink-50 shadow-md ring-2 ring-pink-200' : 'border-slate-200 bg-white hover:border-pink-400 hover:shadow-lg'}`}>
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
                                    className={`group relative p-8 rounded-3xl border-2 border-dashed transition-all duration-300 text-right flex flex-col justify-between overflow-hidden h-64 cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-100' : mode === 'upload' ? 'border-blue-600 bg-blue-50 shadow-md ring-2 ring-blue-200' : 'border-slate-300 bg-white hover:border-blue-500 hover:bg-slate-50'}`}
                                >
                                    <input {...getInputProps()} />
                                    {file ? (<div className="flex flex-col items-center justify-center h-full text-center animate-fade-in"><div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-sm"><IconCheck className="w-10 h-10 text-green-600" /></div><h4 className="text-xl font-bold text-gray-800">{file.name}</h4><p className="text-sm text-gray-500 mt-2">הקובץ מוכן. <br /><span className="font-bold text-blue-600">שימו לב: הפעילות תתבסס רק על המידע שבקובץ.</span></p><span className="text-xs text-blue-600 underline mt-2">לחצו להחלפה</span></div>) : (<><div className="bg-indigo-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><IconCloudUpload className="w-8 h-8 text-indigo-600" /></div><div><h4 className="text-xl font-bold text-gray-800 mb-2">העלו קובץ</h4><p className="text-sm text-gray-500 leading-relaxed">העלו קובץ PDF/Word. <span className="font-bold text-indigo-600 block mt-1">ה-AI ייצור {courseMode === 'exam' ? 'מבחן' : 'פעילות'} בהסתמך אך ורק על תוכן הקובץ.</span></p></div>{mode === 'upload' && !file && <div className="absolute top-4 left-4 bg-gray-200 text-gray-500 p-1 rounded-full"><IconCloudUpload className="w-4 h-4" /></div>}</>)}
                                </div>
                                <button onClick={() => setMode('text')} className={`group relative p-8 rounded-3xl border-2 transition-all duration-300 text-right flex flex-col justify-between overflow-hidden h-64 ${mode === 'text' ? 'border-indigo-600 bg-indigo-50 shadow-md ring-2 ring-indigo-200' : 'border-slate-200 bg-white hover:border-indigo-400 hover:shadow-lg'}`}>
                                    <div className="bg-green-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><IconBook className="w-8 h-8 text-green-600" /></div>
                                    <div><h4 className="text-xl font-bold text-gray-800 mb-2">הדביקו טקסט</h4><p className="text-sm text-gray-500 leading-relaxed">הדביקו מאמר או סיכום. <span className="font-bold text-green-600 block mt-1">הפעילות תיווצר אך ורק על בסיס הטקסט שתדביקו.</span></p></div>
                                    {mode === 'text' && <div className="absolute top-4 left-4 bg-blue-500 text-white p-1 rounded-full"><IconCheck className="w-4 h-4" /></div>}
                                    {mode === 'text' && <div className="absolute top-4 left-4 bg-blue-500 text-white p-1 rounded-full"><IconCheck className="w-4 h-4" /></div>}
                                </button>

                                {/* Multimodal Option (Video/Audio) */}
                                <button onClick={() => setMode('multimodal')} className={`group relative p-8 rounded-3xl border-2 transition-all duration-300 text-right flex flex-col justify-between overflow-hidden h-64 ${mode === 'multimodal' ? 'border-red-500 bg-red-50 shadow-md ring-2 ring-red-200' : 'border-slate-200 bg-white hover:border-red-400 hover:shadow-lg'}`}>
                                    <div className="bg-red-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><IconVideo className="w-8 h-8 text-red-600" /></div>
                                    <div><h4 className="text-xl font-bold text-gray-800 mb-2">וידאו / אודיו</h4><p className="text-sm text-gray-500 leading-relaxed">YouTube או הקלטה. <span className="font-bold text-red-600 block mt-1">ה-AI ינתח את הסרטון ויפיק {courseMode === 'exam' ? 'מבחן' : 'שיעור'}.</span></p></div>
                                    {mode === 'multimodal' && <div className="absolute top-4 left-4 bg-blue-500 text-white p-1 rounded-full"><IconCheck className="w-4 h-4" /></div>}
                                </button>
                            </div>

                            {/* YouTube URL Input Area */}
                            {mode === 'multimodal' && (
                                <div className="animate-fade-in mt-6 space-y-4">
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setSubMode('youtube')}
                                            className={`flex-1 p-4 rounded-xl border-2 transition-all font-bold ${subMode === 'youtube' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:border-red-200'}`}
                                        >
                                            YouTube Link
                                        </button>
                                        <div className="flex-1 p-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 flex items-center justify-center cursor-not-allowed opacity-50">
                                            קובץ אודיו (בקרוב)
                                        </div>
                                    </div>

                                    {subMode === 'youtube' && (
                                        <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm animate-slide-up">
                                            <label className="block text-lg font-bold text-gray-700 mb-2">הדביקו קישור ליוטיוב:</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 p-4 text-lg border border-gray-300 rounded-xl focus:border-red-500 focus:ring-4 focus:ring-red-100 outline-none transition-all dir-ltr"
                                                    placeholder="https://www.youtube.com/watch?v=..."
                                                    onPaste={async (e) => {
                                                        const url = e.clipboardData.getData('text');
                                                        if (MultimodalService.validateYouTubeUrl(url)) {
                                                            setIsProcessing(true);
                                                            const text = await MultimodalService.processYoutubeUrl(url);
                                                            if (text) {
                                                                setPastedText(text);
                                                                // Try to set title/topic from what we have (or leave blank for user)
                                                                if (!topic) setTopic("סרטון יוטיוב");
                                                            }
                                                            setIsProcessing(false);
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={async () => {
                                                        const input = document.querySelector('input[placeholder*="youtube"]') as HTMLInputElement;
                                                        if (input && input.value) {
                                                            setIsProcessing(true);
                                                            const text = await MultimodalService.processYoutubeUrl(input.value);
                                                            if (text) {
                                                                setPastedText(text);
                                                                if (!topic) setTopic("סרטון יוטיוב");
                                                            }
                                                            setIsProcessing(false);
                                                        }
                                                    }}
                                                    disabled={isProcessing}
                                                    className="bg-red-600 text-white px-6 rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                                                >
                                                    {isProcessing ? 'מושך...' : 'תמלל'}
                                                </button>
                                            </div>
                                            {pastedText && (
                                                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm flex items-center gap-2">
                                                    <IconCheck className="w-4 h-4" />
                                                    התמלול התקבל בהצלחה! ({pastedText.length} תווים)
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

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
                            <div className="space-y-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm order-2 md:order-1">
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
                                            { id: 'short', label: 'קצרה', desc: '3 שאלות' },
                                            { id: 'medium', label: 'בינונית', desc: '5 שאלות (מומלץ)' },
                                            { id: 'long', label: 'ארוכה', desc: '7 שאלות' }
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
                            btn-lip-action
                            px-12 py-4 text-xl
                            disabled:opacity-50 disabled:cursor-not-allowed
                            flex items-center justify-center gap-3 whitespace-nowrap
                            ml-auto
                            shadow-glow
                        `}
                    >
                        {isProcessing ? (
                            <>
                                <div className="animate-spin w-6 h-6 border-4 border-emerald-900 border-t-transparent rounded-full"></div>
                                <span>{step === 1 ? 'מעבד...' : (courseMode === 'exam' ? 'מייצר מבחן...' : 'מייצר פעילות...')}</span>
                            </>
                        ) : (
                            <>
                                {step === 1 ? 'המשיכו להגדרות מתקדמות' : (courseMode === 'exam' ? 'צרו מבחן עכשיו!' : 'צרו פעילות עכשיו!')}
                                <IconArrowBack className="w-6 h-6 shrink-0" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IngestionWizard;