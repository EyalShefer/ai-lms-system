import React, { useState, useRef } from 'react';
import { useCourseStore } from '../context/CourseContext';
// הוספתי 'type' כדי להבטיח ייבוא נכון של אינטרפייס
import { generateCourseWithGemini, type GenerationConfig } from '../gemini';
import { extractTextFromPDF } from '../pdfService';
import { SUBJECT_OPTIONS, GRADE_OPTIONS } from '../courseConstants';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

type WizardStep = 'source' | 'blueprint' | 'generating';

const IngestionWizard: React.FC = () => {
    const { setCourse, setFullBookContent, setPdfSource } = useCourseStore();

    const [step, setStep] = useState<WizardStep>('source');

    const [topic, setTopic] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [inputType, setInputType] = useState<'topic' | 'upload'>('topic');

    const [gradeLevel, setGradeLevel] = useState('כיתה ט׳ (חטיבת ביניים)');
    const [subject, setSubject] = useState('היסטוריה');
    const [courseMode, setCourseMode] = useState<'learning' | 'exam'>('learning');

    // הגדרות מתקדמות
    const [modulesCount, setModulesCount] = useState(3);
    const [unitsPerModule, setUnitsPerModule] = useState(3);

    // רמות בלום
    const [bloomKnowledge, setBloomKnowledge] = useState(30);
    const [bloomApplication, setBloomApplication] = useState(50);
    const [bloomReasoning, setBloomReasoning] = useState(20);

    const [sampleQuestion, setSampleQuestion] = useState('');

    const [status, setStatus] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setSelectedFile(file);
            setTopic(file.name.replace('.pdf', ''));
            setInputType('upload');
        }
    };

    const handleGenerate = async () => {
        setStep('generating');
        setStatus('מכין את מרחב העבודה...');

        try {
            let sourceText = "";

            if (inputType === 'upload' && selectedFile) {
                setStatus(`קורא ומנתח את הקובץ: ${selectedFile.name}...`);
                sourceText = await extractTextFromPDF(selectedFile);
                setFullBookContent(sourceText);

                setStatus('מעלה קובץ מקור לענן המאובטח...');
                const storageRef = ref(storage, `course_pdfs/${Date.now()}_${selectedFile.name}`);
                await uploadBytes(storageRef, selectedFile);
                const url = await getDownloadURL(storageRef);
                setPdfSource(url);
            }

            setStatus('בונה את סילבוס הקורס בהתאם להגדרות הפדגוגיות...');

            const config: GenerationConfig = {
                modulesCount,
                unitsPerModule,
                questionDistribution: {
                    knowledge: bloomKnowledge,
                    application: bloomApplication,
                    reasoning: bloomReasoning
                },
                includeSampleQuestion: sampleQuestion,
                totalScore: 100
            };

            const newCourse = await generateCourseWithGemini(topic, gradeLevel, subject, sourceText, config);
            newCourse.mode = courseMode;

            setCourse(newCourse);
            setStatus('הושלם! מעביר לעורך...');

        } catch (error) {
            console.error(error);
            alert("הייתה בעיה ביצירת הקורס. נסה שוב.");
            setStep('source');
        }
    };

    if (step === 'generating') {
        return (
            <div className="flex flex-col items-center justify-center h-96 animate-fade-in text-center">
                <div className="w-20 h-20 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                <h3 className="text-2xl font-bold text-indigo-900 mb-2">{status}</h3>
                <p className="text-gray-500">ה-AI עובד על יצירת תוכן איכותי עבורך...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden font-sans">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-8 text-white flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold mb-2">סטודיו ליצירת קורסים 🎓</h2>
                    <p className="opacity-80">בנה מערך שיעור או מבחן מותאם אישית תוך שניות.</p>
                </div>
                <div className="flex gap-2 text-sm font-bold bg-white/20 p-1 rounded-lg">
                    <div className={`px-4 py-1 rounded-md transition-all ${step === 'source' ? 'bg-white text-indigo-700 shadow' : 'opacity-50'}`}>1. מקור</div>
                    <div className={`px-4 py-1 rounded-md transition-all ${step === 'blueprint' ? 'bg-white text-indigo-700 shadow' : 'opacity-50'}`}>2. אפיון</div>
                </div>
            </div>

            {step === 'source' && (
                <div className="p-10 animate-slide-up">
                    <h3 className="text-xl font-bold text-gray-800 mb-6">איך נתחיל היום?</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div
                            onClick={() => { setInputType('upload'); fileInputRef.current?.click(); }}
                            className={`cursor-pointer border-2 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all hover:shadow-lg ${inputType === 'upload' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
                        >
                            <div className="text-5xl bg-white p-4 rounded-full shadow-sm">📄</div>
                            <div className="text-center">
                                <div className="font-bold text-lg text-gray-800">העלאת קובץ לימוד</div>
                                <div className="text-sm text-gray-500 mt-1">PDF, סיכומים, ספרים דיגיטליים</div>
                            </div>
                            {selectedFile && <div className="text-indigo-600 font-bold bg-white px-3 py-1 rounded-full text-xs shadow-sm mt-2">נבחר: {selectedFile.name}</div>}
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" className="hidden" />
                        </div>

                        <div
                            onClick={() => setInputType('topic')}
                            className={`cursor-pointer border-2 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all hover:shadow-lg ${inputType === 'topic' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
                        >
                            <div className="text-5xl bg-white p-4 rounded-full shadow-sm">💡</div>
                            <div className="text-center">
                                <div className="font-bold text-lg text-gray-800">יצירה מנושא חופשי</div>
                                <div className="text-sm text-gray-500 mt-1">תן ל-AI להציע סילבוס מאפס</div>
                            </div>
                            {inputType === 'topic' && (
                                <input
                                    type="text"
                                    placeholder="על מה נלמד היום?"
                                    className="mt-2 w-full p-2 border-b-2 border-purple-300 bg-transparent text-center focus:outline-none font-bold text-gray-700"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    autoFocus
                                />
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={() => setStep('blueprint')}
                            disabled={!topic && !selectedFile}
                            className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-transform hover:-translate-y-1"
                        >
                            המשך להגדרות מתקדמות ➔
                        </button>
                    </div>
                </div>
            )}

            {step === 'blueprint' && (
                <div className="p-10 animate-slide-left">
                    <div className="flex gap-8">
                        <div className="w-1/3 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-500 mb-2">מצב קורס</label>
                                <div className="flex p-1 bg-gray-100 rounded-xl">
                                    <button onClick={() => setCourseMode('learning')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${courseMode === 'learning' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>למידה ✅</button>
                                    <button onClick={() => setCourseMode('exam')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${courseMode === 'exam' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>מבחן 🛑</button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-500 mb-2">תחום דעת</label>
                                <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-500 outline-none">
                                    {SUBJECT_OPTIONS.map((g, i) => <optgroup key={i} label={g.label}>{g.options.map(o => <option key={o} value={o}>{o}</option>)}</optgroup>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-500 mb-2">קהל יעד</label>
                                <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:border-indigo-500 outline-none">
                                    {GRADE_OPTIONS.map((g, i) => <optgroup key={i} label={g.label}>{g.options.map(o => <option key={o} value={o}>{o}</option>)}</optgroup>)}
                                </select>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <h4 className="text-blue-800 font-bold mb-2 text-sm">מבנה הקורס</h4>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-gray-600">מספר פרקים (Modules):</span>
                                    <input type="number" min="1" max="10" value={modulesCount} onChange={(e) => setModulesCount(Number(e.target.value))} className="w-16 p-1 text-center border rounded bg-white" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">יחידות בכל פרק:</span>
                                    <input type="number" min="1" max="10" value={unitsPerModule} onChange={(e) => setUnitsPerModule(Number(e.target.value))} className="w-16 p-1 text-center border rounded bg-white" />
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 space-y-8 pl-8 border-r border-gray-100">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <span>🧠</span> רמות חשיבה (הטקסונומיה של בלום)
                                </h3>
                                <p className="text-sm text-gray-400 mb-4">קבע את תמהיל השאלות בקורס לפי רמת קושי.</p>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-bold text-green-700">ידע והבנה (קל)</span>
                                            <span>{bloomKnowledge}%</span>
                                        </div>
                                        <input type="range" className="w-full h-2 bg-green-100 rounded-lg appearance-none cursor-pointer accent-green-600" min="0" max="100" value={bloomKnowledge} onChange={(e) => setBloomKnowledge(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-bold text-blue-700">יישום וניתוח (בינוני)</span>
                                            <span>{bloomApplication}%</span>
                                        </div>
                                        <input type="range" className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600" min="0" max="100" value={bloomApplication} onChange={(e) => setBloomApplication(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-bold text-purple-700">הערכה ויצירה (קשה)</span>
                                            <span>{bloomReasoning}%</span>
                                        </div>
                                        <input type="range" className="w-full h-2 bg-purple-100 rounded-lg appearance-none cursor-pointer accent-purple-600" min="0" max="100" value={bloomReasoning} onChange={(e) => setBloomReasoning(Number(e.target.value))} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                                    <span>✍️</span> התאמת סגנון (אופציונלי)
                                </h3>
                                <textarea
                                    className="w-full p-4 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-indigo-300 outline-none text-sm resize-none"
                                    rows={3}
                                    placeholder="הדבק כאן שאלה לדוגמה, כדי שה-AI יבין את סגנון הניסוח הרצוי שלך..."
                                    value={sampleQuestion}
                                    onChange={(e) => setSampleQuestion(e.target.value)}
                                />
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                                <button onClick={() => setStep('source')} className="text-gray-500 hover:text-gray-800 font-bold">חזרה</button>
                                <button
                                    onClick={handleGenerate}
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-10 py-3 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1"
                                >
                                    צור קורס עכשיו ✨
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IngestionWizard;