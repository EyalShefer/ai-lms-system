import React, { useState } from 'react'; // הנה התיקון: הוספנו את useState כאן
import { useDropzone } from 'react-dropzone';
import {
    IconUpload, IconBrain, IconArrowBack, IconSparkles,
    IconCheck, IconX, IconWand
} from '../icons';

interface IngestionWizardProps {
    onComplete: (data: any) => void;
    onCancel: () => void;
}

const IngestionWizard: React.FC<IngestionWizardProps> = ({ onComplete, onCancel }) => {
    const [step, setStep] = useState(1);
    const [mode, setMode] = useState<'upload' | 'topic' | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [topic, setTopic] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // הגדרות דרופזון להעלאת קבצים
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
                onComplete({ mode, file, topic });
            }, 1500);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white/90 glass w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-white/50 flex flex-col max-h-[90vh] relative">

                {/* Header מודרני */}
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
                            title="סגור חלונית"
                        >
                            <IconX className="w-6 h-6" />
                        </button>
                    </div>

                    {/* סרגל התקדמות */}
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

                {/* תוכן האשף */}
                <div className="p-10 flex-1 overflow-y-auto bg-gradient-to-b from-white to-blue-50/30 custom-scrollbar">

                    {step === 1 && (
                        <div className="space-y-8 animate-slide-up">
                            <h3 className="text-xl font-bold text-gray-700 text-center">איך נתחיל היום?</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* כרטיס יצירה חופשית */}
                                <button
                                    onClick={() => setMode('topic')}
                                    className={`group relative p-8 rounded-3xl border-2 transition-all duration-300 text-right h-64 flex flex-col justify-between overflow-hidden
                                        ${mode === 'topic'
                                            ? 'border-blue-500 bg-blue-50/50 shadow-lg ring-4 ring-blue-100'
                                            : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'}`}
                                >
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-orange-400 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                                    <div className="bg-yellow-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <IconBrain className="w-8 h-8 text-yellow-600" />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-gray-800 mb-2">יצירה מנושא חופשי</h4>
                                        <p className="text-sm text-gray-500 leading-relaxed">תן ל-AI להציע סילבוס, ראשי פרקים ותוכן מלא על בסיס נושא שתבחר.</p>
                                    </div>
                                    {mode === 'topic' && <div className="absolute top-4 left-4 bg-blue-500 text-white p-1 rounded-full"><IconCheck className="w-4 h-4" /></div>}
                                </button>

                                {/* כרטיס העלאת קובץ */}
                                <button
                                    onClick={() => setMode('upload')}
                                    className={`group relative p-8 rounded-3xl border-2 transition-all duration-300 text-right h-64 flex flex-col justify-between overflow-hidden
                                        ${mode === 'upload'
                                            ? 'border-blue-500 bg-blue-50/50 shadow-lg ring-4 ring-blue-100'
                                            : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'}`}
                                >
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-purple-400 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                                    <div className="bg-purple-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <IconUpload className="w-8 h-8 text-purple-600" />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-gray-800 mb-2">העלאת קובץ לימוד</h4>
                                        <p className="text-sm text-gray-500 leading-relaxed">PDF, סיכומים, ספרים דיגיטליים. המערכת תנתח את הקובץ ותיצור ממנו קורס.</p>
                                    </div>
                                    {mode === 'upload' && <div className="absolute top-4 left-4 bg-blue-500 text-white p-1 rounded-full"><IconCheck className="w-4 h-4" /></div>}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="max-w-xl mx-auto space-y-6 animate-slide-up">
                            <button onClick={() => setStep(1)} className="text-gray-400 hover:text-blue-600 flex items-center gap-2 text-sm mb-4 transition-colors">
                                <IconArrowBack className="w-4 h-4" /> חזרה לבחירה
                            </button>

                            {mode === 'topic' ? (
                                <div>
                                    <label className="block text-lg font-bold text-gray-800 mb-3">באיזה נושא נעסוק היום?</label>
                                    <input
                                        type="text"
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm"
                                        placeholder="למשל: המהפכה הצרפתית, יסודות הפיזיקה..."
                                        autoFocus
                                    />
                                    <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                                        <IconSparkles className="w-4 h-4 text-yellow-500" />
                                        ה-AI יבנה עבורך את המבנה המלא של השיעור
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-lg font-bold text-gray-800 mb-3">העלה את קובץ המקור</label>
                                    <div
                                        {...getRootProps()}
                                        className={`border-3 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[200px]
                                            ${isDragActive ? 'border-blue-500 bg-blue-50 scale-105' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
                                    >
                                        <input {...getInputProps()} />
                                        {file ? (
                                            <div className="bg-blue-100 text-blue-800 px-6 py-3 rounded-xl font-bold flex items-center gap-3">
                                                <IconCheck className="w-5 h-5" />
                                                {file.name}
                                            </div>
                                        ) : (
                                            <>
                                                <div className="bg-gray-100 p-4 rounded-full mb-4">
                                                    <IconUpload className="w-8 h-8 text-gray-400" />
                                                </div>
                                                <p className="text-gray-600 font-medium text-lg">גרור לכאן קובץ או לחץ לבחירה</p>
                                                <p className="text-sm text-gray-400 mt-2">תומך ב-PDF, Word, TXT</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer עם כפתור פעולה */}
                <div className="p-6 border-t border-gray-100 bg-gray-50/80 flex justify-end shrink-0">
                    <button
                        onClick={handleNext}
                        disabled={(!mode) || (step === 2 && mode === 'topic' && !topic) || (step === 2 && mode === 'upload' && !file) || isProcessing}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-xl font-bold text-lg shadow-lg hover:shadow-blue-200/50 transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                    >
                        {isProcessing ? (
                            <>
                                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                                <span>מעבד נתונים...</span>
                            </>
                        ) : (
                            <>
                                {step === 1 ? 'המשך לשלב הבא' : 'צור את השיעור!'}
                                <IconArrowBack className="w-5 h-5 rotate-180" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IngestionWizard;