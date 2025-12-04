import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    IconUpload, IconBrain, IconArrowBack, IconSparkles,
    IconCheck, IconX, IconWand, IconBook, IconStudent, IconChart, IconList
} from '../icons';

interface IngestionWizardProps {
    onComplete: (data: any) => void;
    onCancel: () => void;
    initialTopic?: string;
    initialMode?: 'learning' | 'exam';
    title?: string;
    cancelLabel?: string;
    cancelIcon?: React.ReactNode;
}

const GRADES = ["גן חובה", "כיתה א'", "כיתה ב'", "כיתה ג'", "כיתה ד'", "כיתה ה'", "כיתה ו'", "כיתה ז'", "כיתה ח'", "כיתה ט'", "כיתה י'", "כיתה יא'", "כיתה יב'"];
const SUBJECTS = ["חינוך לשוני (עברית)", "מתמטיקה", "אנגלית", "מדע וטכנולוגיה", "היסטוריה", "אזרחות", "תנ\"ך", "ספרות", "גיאוגרפיה", "תרבות ישראל", "של\"ח", "חינוך גופני", "אמנות", "אחר"];

const IngestionWizard: React.FC<IngestionWizardProps> = ({
    onComplete,
    onCancel,
    initialTopic,
    initialMode = 'learning',
    title,
    cancelLabel = "חזרה",
    cancelIcon = <IconArrowBack className="w-4 h-4" />
}) => {
    // אתחול המצבים
    const [step, setStep] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [mode, setMode] = useState<'upload' | 'topic' | null>(null);
    const [topic, setTopic] = useState('');
    const [file, setFile] = useState<File | null>(null);

    // נתוני שלב 2
    const [customTitle, setCustomTitle] = useState('');
    const [grade, setGrade] = useState('כיתה ז\'');
    const [subject, setSubject] = useState('היסטוריה');
    const [modulesCount, setModulesCount] = useState(3);
    const [taxonomy, setTaxonomy] = useState({ knowledge: 30, application: 50, evaluation: 20 });
    const [courseMode, setCourseMode] = useState<'learning' | 'exam'>(initialMode);

    useEffect(() => {
        if (initialTopic && initialTopic !== "טוען..." && initialTopic.trim() !== "") {
            setTopic(initialTopic);
            setCustomTitle(initialTopic);
            setMode('topic');
            setStep(2);
        }
    }, [initialTopic]);

    const handleTaxonomyChange = (changedKey: keyof typeof taxonomy, newValue: number) => {
        const remainingSpace = 100 - newValue;
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

    const handleNext = async () => {
        if (step === 1 && mode) {
            let suggestedTitle = customTitle;
            if (!suggestedTitle) {
                if (mode === 'upload' && file) {
                    suggestedTitle = file.name.replace(/\.[^/.]+$/, "");
                } else if (mode === 'topic' && topic) {
                    suggestedTitle = topic;
                }
            }
            setCustomTitle(suggestedTitle);
            setStep(2);
        }
        else if (step === 2) {
            setIsProcessing(true);
            setTimeout(() => {
                onComplete({
                    mode,
                    file,
                    topic: customTitle || topic || "שיעור חדש",
                    settings: { grade, subject, modulesCount, taxonomy, courseMode }
                });
            }, 1500);
        }
    };

    const handleBack = () => {
        if (initialTopic) {
            onCancel();
        } else if (step === 2) {
            setStep(1);
        } else {
            onCancel();
        }
    };

    const dynamicTitle = courseMode === 'exam' ? 'יצירת מבחן חדש' : 'יצירת שיעור חדש';
    const dynamicSubtitle = mode === 'topic' && topic
        ? `יצירת ${courseMode === 'exam' ? 'מבחן' : 'שיעור'} בנושא: ${topic}`
        : `בוא נהפוך את החומרים שלך ל${courseMode === 'exam' ? 'מבחן' : 'שיעור'} אינטראקטיבי`;

    return (
        // השינוי כאן: החלפנו items-center ב-items-start והוספנו pt-16
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-16 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
            {/* השינוי כאן: הקטנו מעט את הגובה המקסימלי ל-85vh כדי שיתאים לריווח מלמעלה */}
            <div className="bg-white/90 glass w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-white/50 flex flex-col max-h-[85vh] relative mb-10">

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-10 -translate-y-10"><IconWand className="w-64 h-64" /></div>
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
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${step >= 1 ? 'bg-white text-blue-600 shadow-sm' : 'bg-blue-800/30 text-blue-200 border border-blue-400/30'}`}>
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? 'bg-blue-100 text-blue-600' : 'bg-blue-800/50 text-white'}`}>1</span>
                                בחירת מקור
                            </div>
                            <div className={`w-8 h-0.5 transition-colors ${step >= 2 ? 'bg-white' : 'bg-blue-400/30'}`}></div>
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${step >= 2 ? 'bg-white text-blue-600 shadow-sm' : 'bg-blue-800/30 text-blue-200 border border-blue-400/30'}`}>
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-blue-100 text-blue-600' : 'bg-blue-800/50 text-white'}`}>2</span>
                                אפיון והגדרות
                            </div>
                            <div className="w-8 h-0.5 bg-blue-400/30"></div>
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-blue-800/30 text-blue-200 border border-blue-400/30 opacity-70">
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-64">
                                <button onClick={() => setMode('topic')} className={`group relative p-8 rounded-3xl border-2 transition-all duration-300 text-right flex flex-col justify-between overflow-hidden h-64 ${mode === 'topic' ? 'border-blue-500 bg-blue-50/50 shadow-lg ring-4 ring-blue-100' : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'}`}>
                                    <div className="bg-yellow-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><IconBrain className="w-8 h-8 text-yellow-600" /></div>
                                    <div><h4 className="text-xl font-bold text-gray-800 mb-2">יצירה מנושא חופשי</h4><p className="text-sm text-gray-500 leading-relaxed">תן ל-AI להציע סילבוס ותוכן על בסיס נושא שתבחר.</p></div>
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
                                    {file ? (<div className="flex flex-col items-center justify-center h-full text-center animate-fade-in"><div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-sm"><IconCheck className="w-10 h-10 text-green-600" /></div><h4 className="text-xl font-bold text-gray-800">{file.name}</h4><p className="text-sm text-gray-500 mt-2">הקובץ מוכן לעיבוד</p><span className="text-xs text-blue-600 underline mt-2">לחץ להחלפה</span></div>) : (<><div className="bg-purple-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><IconUpload className="w-8 h-8 text-purple-600" /></div><div><h4 className="text-xl font-bold text-gray-800 mb-2">העלאת קובץ לימוד</h4><p className="text-sm text-gray-500 leading-relaxed">לחץ כאן או גרור קובץ PDF/Word כדי לנתח אותו.</p></div>{mode === 'upload' && !file && <div className="absolute top-4 left-4 bg-gray-200 text-gray-500 p-1 rounded-full"><IconUpload className="w-4 h-4" /></div>}</>)}
                                </div>
                            </div>
                            {mode === 'topic' && (
                                <div className="animate-fade-in mt-6">
                                    <label className="block text-lg font-bold text-gray-700 mb-2">באיזה נושא נעסוק היום?</label>
                                    <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm" placeholder="למשל: המהפכה הצרפתית, יסודות הפיזיקה..." autoFocus />
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-slide-up h-full">
                            {/* עמודה ימנית - הגדרות טכניות */}
                            <div className="space-y-6 bg-blue-50/50 p-6 rounded-3xl border border-blue-100 order-2 md:order-1">
                                {/* שדה שם השיעור החדש */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                        <IconSparkles className="w-4 h-4 text-blue-600" />
                                        שם השיעור / היחידה
                                    </label>
                                    <input
                                        type="text"
                                        value={customTitle}
                                        onChange={(e) => setCustomTitle(e.target.value)}
                                        className="w-full p-3 border border-gray-300 rounded-xl focus:border-blue-500 outline-none bg-white font-bold text-gray-800"
                                        placeholder="למשל: מבוא לפוטוסינתזה"
                                    />
                                </div>

                                <div><label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><IconBook className="w-4 h-4" /> תחום דעת</label><select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl focus:border-blue-500 outline-none bg-white">{SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><IconStudent className="w-4 h-4" /> קהל יעד</label><select value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl focus:border-blue-500 outline-none bg-white">{GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                                <div className="pt-4 border-t border-blue-200/50"><label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><IconChart className="w-4 h-4" /> מבנה המערך</label><div className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200"><span className="text-sm text-gray-600">מספר פרקים:</span><div className="flex items-center gap-3"><button onClick={() => setModulesCount(Math.max(1, modulesCount - 1))} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-gray-600">-</button><span className="font-mono font-bold w-4 text-center">{modulesCount}</span><button onClick={() => setModulesCount(Math.min(10, modulesCount + 1))} className="w-8 h-8 rounded-full bg-indigo-100 hover:bg-indigo-200 font-bold text-indigo-600">+</button></div></div></div>
                            </div>

                            {/* עמודה שמאלית - טקסונומיה */}
                            <div className="space-y-6 order-1 md:order-2">
                                <div className="flex items-center gap-2 mb-2"><IconBrain className="w-6 h-6 text-pink-500" /><h3 className="text-xl font-bold text-gray-800">רמות חשיבה (טקסונומיה)</h3></div>
                                <p className="text-sm text-gray-500 mb-6">קבע את תמהיל השאלות והתוכן.</p>
                                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm"><div className="flex justify-between mb-3"><label className="font-bold text-green-600 text-lg">ידע והבנה</label><span className="font-mono font-bold text-lg bg-green-50 px-2 rounded">{taxonomy.knowledge}%</span></div><input type="range" min="0" max="100" value={taxonomy.knowledge} onChange={(e) => handleTaxonomyChange('knowledge', parseInt(e.target.value))} className="w-full accent-green-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" /></div>
                                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm"><div className="flex justify-between mb-3"><label className="font-bold text-blue-600 text-lg">יישום וניתוח</label><span className="font-mono font-bold text-lg bg-blue-50 px-2 rounded">{taxonomy.application}%</span></div><input type="range" min="0" max="100" value={taxonomy.application} onChange={(e) => handleTaxonomyChange('application', parseInt(e.target.value))} className="w-full accent-blue-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" /></div>
                                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm"><div className="flex justify-between mb-3"><label className="font-bold text-orange-600 text-lg">הערכה ויצירה</label><span className="font-mono font-bold text-lg bg-orange-50 px-2 rounded">{taxonomy.evaluation}%</span></div><input type="range" min="0" max="100" value={taxonomy.evaluation} onChange={(e) => handleTaxonomyChange('evaluation', parseInt(e.target.value))} className="w-full accent-orange-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" /></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50/80 flex justify-between shrink-0 items-center">
                    <button onClick={handleBack} className="text-gray-500 hover:text-blue-600 font-bold px-4 flex items-center gap-2 transition-colors">
                        {cancelIcon} {initialTopic ? cancelLabel : (step === 2 ? 'חזרה' : 'ביטול')}
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={(!mode) || (step === 1 && mode === 'topic' && !topic) || (step === 1 && mode === 'upload' && !file) || isProcessing}
                        className={`bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-10 py-3 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed ${step === 1 ? 'w-full justify-center' : 'ml-auto'}`}
                    >
                        {isProcessing ? (
                            <>
                                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                                <span>{step === 1 ? 'מעבד...' : (courseMode === 'exam' ? 'מייצר מבחן...' : 'מייצר מערך שיעור...')}</span>
                            </>
                        ) : (
                            <>
                                {step === 1 ? 'המשך להגדרות מתקדמות' : (courseMode === 'exam' ? 'צור מבחן עכשיו!' : 'צור מערך שיעור עכשיו!')}
                                <IconSparkles className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IngestionWizard;