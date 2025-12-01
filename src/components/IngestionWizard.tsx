import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    IconUpload, IconBrain, IconArrowBack, IconSparkles,
    IconCheck, IconX, IconWand, IconBook, IconStudent, IconChart
} from '../icons';

interface IngestionWizardProps {
    onComplete: (data: any) => void;
    onCancel: () => void;
}

// --- רשימות בחירה (משרד החינוך) ---
const GRADES = [
    "גן חובה", "כיתה א'", "כיתה ב'", "כיתה ג'", "כיתה ד'", "כיתה ה'", "כיתה ו'",
    "כיתה ז'", "כיתה ח'", "כיתה ט'", "כיתה י'", "כיתה יא'", "כיתה יב'"
];

const SUBJECTS = [
    "חינוך לשוני (עברית)", "מתמטיקה", "אנגלית", "מדע וטכנולוגיה",
    "היסטוריה", "אזרחות", "תנ\"ך", "ספרות", "גיאוגרפיה",
    "תרבות ישראל", "של\"ח", "חינוך גופני", "אמנות", "אחר"
];

const IngestionWizard: React.FC<IngestionWizardProps> = ({ onComplete, onCancel }) => {
    const [step, setStep] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);

    // Step 1 Data
    const [mode, setMode] = useState<'upload' | 'topic' | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [topic, setTopic] = useState('');

    // Step 2 Data (Settings)
    const [grade, setGrade] = useState('כיתה ז\'');
    const [subject, setSubject] = useState('היסטוריה');
    const [modulesCount, setModulesCount] = useState(3);

    // Taxonomy Equalizer State (Total 100%)
    const [taxonomy, setTaxonomy] = useState({
        knowledge: 30,   // ידע והבנה
        application: 50, // יישום וניתוח
        evaluation: 20   // הערכה ויצירה
    });

    // --- לוגיקת האקולייזר החכמה ---
    const handleTaxonomyChange = (changedKey: keyof typeof taxonomy, newValue: number) => {
        const oldValue = taxonomy[changedKey];
        const diff = newValue - oldValue; // כמה שינינו
        const remainingSpace = 100 - newValue; // כמה נשאר לאחרים

        // מוצאים את המפתחות האחרים
        const otherKeys = Object.keys(taxonomy).filter(k => k !== changedKey) as (keyof typeof taxonomy)[];
        const keyA = otherKeys[0];
        const keyB = otherKeys[1];

        // חישוב הסכום הנוכחי של האחרים כדי לדעת את היחס ביניהם
        const currentOthersTotal = taxonomy[keyA] + taxonomy[keyB];

        let newA, newB;

        if (currentOthersTotal === 0) {
            // אם האחרים היו 0, נחלק את היתרה שווה בשווה
            newA = remainingSpace / 2;
            newB = remainingSpace / 2;
        } else {
            // אחרת, נשמור על היחס ביניהם ונכווץ/נרחיב אותם
            const ratio = taxonomy[keyA] / currentOthersTotal;
            newA = Math.round(remainingSpace * ratio);
            newB = remainingSpace - newA; // משלימים ל-100 בדיוק כדי למנוע עיגול שגוי
        }

        setTaxonomy({
            ...taxonomy,
            [changedKey]: newValue,
            [keyA]: newA,
            [keyB]: newB
        });
    };

    // דרופזון
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
        maxFiles: 1,
        onDrop: (acceptedFiles) => setFile(acceptedFiles[0])
    });

    const handleNext = async () => {
        if (step === 1 && mode) {
            setStep(2);
        } else if (step === 2) {
            setIsProcessing(true);
            setTimeout(() => {
                // שליחת כל הנתונים, כולל ההגדרות החדשות
                onComplete({
                    mode, file, topic,
                    settings: { grade, subject, modulesCount, taxonomy }
                });
            }, 1500);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white/90 glass w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-white/50 flex flex-col max-h-[90vh] relative">

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-10 -translate-y-10">
                        <IconWand className="w-64 h-64" />
                    </div>

                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-black mb-2 flex items-center gap-3 !text-white">
                                <IconSparkles className="w-8 h-8 text-yellow-300" />
                                סטודיו ליצירת תוכן
                            </h2>
                            <p className="text-lg opacity-90 !text-blue-100">בוא נהפוך את החומרים שלך לשיעור אינטראקטיבי</p>
                        </div>
                        <button
                            onClick={onCancel}
                            className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors backdrop-blur-md text-white cursor-pointer z-50 hover:rotate-90 duration-300"
                        >
                            <IconX className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex items-center gap-4 mt-8 relative z-10">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${step >= 1 ? 'bg-white text-blue-600' : 'bg-blue-800/50 text-blue-200'}`}>
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">1</span>
                            בחירת מקור
                        </div>
                        <div className="w-10 h-0.5 bg-blue-400/50"></div>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${step >= 2 ? 'bg-white text-blue-600' : 'bg-blue-800/50 text-blue-200'}`}>
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">2</span>
                            אפיון והגדרות
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-8 flex-1 overflow-y-auto bg-gradient-to-b from-white to-blue-50/30 custom-scrollbar">

                    {/* --- STEP 1: Source Selection --- */}
                    {step === 1 && (
                        <div className="space-y-8 animate-slide-up">
                            <h3 className="text-xl font-bold text-gray-700 text-center">איך נתחיל היום?</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <button
                                    onClick={() => setMode('topic')}
                                    className={`group relative p-8 rounded-3xl border-2 transition-all duration-300 text-right h-64 flex flex-col justify-between overflow-hidden ${mode === 'topic' ? 'border-blue-500 bg-blue-50/50 shadow-lg ring-4 ring-blue-100' : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'}`}
                                >
                                    <div className="bg-yellow-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <IconBrain className="w-8 h-8 text-yellow-600" />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-gray-800 mb-2">יצירה מנושא חופשי</h4>
                                        <p className="text-sm text-gray-500 leading-relaxed">תן ל-AI להציע סילבוס ותוכן על בסיס נושא שתבחר.</p>
                                    </div>
                                    {mode === 'topic' && <div className="absolute top-4 left-4 bg-blue-500 text-white p-1 rounded-full"><IconCheck className="w-4 h-4" /></div>}
                                </button>

                                <button
                                    onClick={() => setMode('upload')}
                                    className={`group relative p-8 rounded-3xl border-2 transition-all duration-300 text-right h-64 flex flex-col justify-between overflow-hidden ${mode === 'upload' ? 'border-blue-500 bg-blue-50/50 shadow-lg ring-4 ring-blue-100' : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'}`}
                                >
                                    <div className="bg-purple-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <IconUpload className="w-8 h-8 text-purple-600" />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-gray-800 mb-2">העלאת קובץ לימוד</h4>
                                        <p className="text-sm text-gray-500 leading-relaxed">המערכת תנתח קובץ PDF או Word ותיצור ממנו קורס.</p>
                                    </div>
                                    {mode === 'upload' && <div className="absolute top-4 left-4 bg-blue-500 text-white p-1 rounded-full"><IconCheck className="w-4 h-4" /></div>}
                                </button>
                            </div>

                            {/* Inputs for Step 1 */}
                            {mode === 'topic' && (
                                <div className="animate-fade-in mt-4">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">נושא השיעור:</label>
                                    <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl focus:border-blue-500 outline-none" placeholder="למשל: המהפכה הצרפתית..." autoFocus />
                                </div>
                            )}
                            {mode === 'upload' && (
                                <div {...getRootProps()} className={`border-3 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}>
                                    <input {...getInputProps()} />
                                    {file ? <div className="text-blue-600 font-bold flex items-center justify-center gap-2"><IconCheck /> {file.name}</div> : <div className="text-gray-500">גרור קובץ לכאן</div>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- STEP 2: Settings & Equalizer --- */}
                    {step === 2 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-slide-up h-full">

                            {/* צד ימין: הגדרות טקסונומיה (אקולייזר) */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <IconBrain className="w-6 h-6 text-pink-500" />
                                    <h3 className="text-xl font-bold text-gray-800">רמות חשיבה (טקסונומיה)</h3>
                                </div>
                                <p className="text-sm text-gray-500 mb-6">קבע את תמהיל השאלות והתוכן לפי רמת קושי. הסכום תמיד 100%.</p>

                                {/* Slider 1: Knowledge */}
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <div className="flex justify-between mb-2">
                                        <label className="font-bold text-green-600">ידע והבנה (קל)</label>
                                        <span className="font-mono font-bold">{taxonomy.knowledge}%</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="100"
                                        value={taxonomy.knowledge}
                                        onChange={(e) => handleTaxonomyChange('knowledge', parseInt(e.target.value))}
                                        className="w-full accent-green-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>

                                {/* Slider 2: Application */}
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <div className="flex justify-between mb-2">
                                        <label className="font-bold text-blue-600">יישום וניתוח (בינוני)</label>
                                        <span className="font-mono font-bold">{taxonomy.application}%</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="100"
                                        value={taxonomy.application}
                                        onChange={(e) => handleTaxonomyChange('application', parseInt(e.target.value))}
                                        className="w-full accent-blue-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>

                                {/* Slider 3: Evaluation */}
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <div className="flex justify-between mb-2">
                                        <label className="font-bold text-orange-600">הערכה ויצירה (קשה)</label>
                                        <span className="font-mono font-bold">{taxonomy.evaluation}%</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="100"
                                        value={taxonomy.evaluation}
                                        onChange={(e) => handleTaxonomyChange('evaluation', parseInt(e.target.value))}
                                        className="w-full accent-orange-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* צד שמאל: הגדרות כלליות */}
                            <div className="space-y-6 bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                        <IconBook className="w-4 h-4" /> תחום דעת
                                    </label>
                                    <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl focus:border-blue-500 outline-none bg-white">
                                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                        <IconStudent className="w-4 h-4" /> קהל יעד
                                    </label>
                                    <select value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl focus:border-blue-500 outline-none bg-white">
                                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>

                                <div className="pt-4 border-t border-blue-200/50">
                                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                        <IconChart className="w-4 h-4" /> מבנה המערך
                                    </label>
                                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200">
                                        <span className="text-sm text-gray-600">מספר פרקים (Modules):</span>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => setModulesCount(Math.max(1, modulesCount - 1))} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-gray-600">-</button>
                                            <span className="font-mono font-bold w-4 text-center">{modulesCount}</span>
                                            <button onClick={() => setModulesCount(Math.min(10, modulesCount + 1))} className="w-8 h-8 rounded-full bg-indigo-100 hover:bg-indigo-200 font-bold text-indigo-600">+</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50/80 flex justify-between shrink-0">
                    {step === 2 && (
                        <button onClick={() => setStep(1)} className="text-gray-500 hover:text-blue-600 font-bold px-4 flex items-center gap-2">
                            <IconArrowBack className="w-4 h-4" /> חזרה
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        disabled={(!mode) || (step === 1 && mode === 'topic' && !topic) || (step === 1 && mode === 'upload' && !file) || isProcessing}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-10 py-3 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 ml-auto"
                    >
                        {isProcessing ? (
                            <>
                                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                                <span>מייצר שיעור...</span>
                            </>
                        ) : (
                            <>
                                {step === 1 ? 'המשך להגדרות מתקדמות' : 'צור מערך עכשיו!'}
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