import React, { useState, useRef } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { generateCourseWithGemini } from '../gemini';
import { extractTextFromPDF } from '../pdfService';
import { SUBJECT_OPTIONS, GRADE_OPTIONS } from '../courseConstants';
import type { Course } from '../courseTypes';
import { storage } from '../firebase'; // <--- ייבוא המחסן
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // פונקציות העלאה

const IngestionWizard: React.FC = () => {
    const { setCourse, setFullBookContent, setPdfSource } = useCourseStore();

    const [topic, setTopic] = useState('');
    const [gradeLevel, setGradeLevel] = useState('כיתה ט׳ (חטיבת ביניים)');
    const [subject, setSubject] = useState('היסטוריה');
    const [courseMode, setCourseMode] = useState<'learning' | 'exam'>('learning');

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [status, setStatus] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setSelectedFile(file);
            setTopic(file.name.replace('.pdf', ''));
        }
    };

    const handleGenerate = async () => {
        if (!topic && !selectedFile) return;

        setIsGenerating(true);
        setStatus('מתחיל בתהליך...');

        try {
            let sourceText = "";
            let pdfDownloadUrl = null;

            if (selectedFile && selectedFile.type === 'application/pdf') {
                // 1. חילוץ טקסט ל-AI (נשאר מקומי)
                setStatus(`קורא את הספר: ${selectedFile.name}...`);
                sourceText = await extractTextFromPDF(selectedFile);
                setFullBookContent(sourceText);

                // 2. העלאת הקובץ האמיתי ל-Firebase Storage ☁️
                setStatus('מעלה את קובץ המקור לענן...');
                const storageRef = ref(storage, `course_pdfs/${Date.now()}_${selectedFile.name}`);
                await uploadBytes(storageRef, selectedFile);
                pdfDownloadUrl = await getDownloadURL(storageRef);

                // עדכון ה-State עם הקישור לענן (במקום הקובץ הכבד)
                setPdfSource(pdfDownloadUrl);
            }

            setStatus('ה-AI מנתח פדגוגית ובונה קורס...');

            const newCourse = await generateCourseWithGemini(topic, gradeLevel, subject, sourceText);

            newCourse.mode = courseMode;

            // אנחנו שולחים את ה-URL לקונטקסט כדי שיישמר במסד הנתונים
            // (הפונקציה setPdfSource כבר טיפלה בזה למעלה, אבל ליתר ביטחון)
            setCourse(newCourse);

            alert("הקורס נוצר בהצלחה והקובץ נשמר בענן! 📚");

            setTopic('');
            setSelectedFile(null);
            setStatus('');
            if (fileInputRef.current) fileInputRef.current.value = '';

        } catch (error) {
            console.error(error);
            alert("תקלה ביצירה. וודא שהקובץ תקין.");
            setStatus('נכשל.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-6 mb-8 shadow-sm animate-fade-in">
            <div className="flex items-start gap-4">
                <div className="bg-indigo-600 text-white p-3 rounded-lg text-2xl shadow-md">🎓</div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-indigo-900 mb-1">מחולל קורסים פדגוגי</h3>
                    <p className="text-sm text-indigo-600 mb-4 opacity-80">בחר שכבת גיל ותחום דעת, העלה חומר לימוד, והמערכת תבנה מערך שיעור מותאם.</p>

                    <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <select value={courseMode} onChange={(e) => setCourseMode(e.target.value as 'learning' | 'exam')} className={`p-2 rounded border font-bold outline-none focus:ring-2 focus:ring-indigo-300 ${courseMode === 'exam' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                <option value="learning">✅ מצב למידה (משוב)</option>
                                <option value="exam">🛑 מצב מבחן (נסתר)</option>
                            </select>

                            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="p-2 rounded border border-indigo-200 bg-white text-gray-700 outline-none focus:border-indigo-500">
                                {SUBJECT_OPTIONS.map((group, idx) => (
                                    <optgroup key={idx} label={group.label}>{group.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</optgroup>
                                ))}
                            </select>

                            <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="p-2 rounded border border-indigo-200 bg-white text-gray-700 outline-none focus:border-indigo-500">
                                {GRADE_OPTIONS.map((group, idx) => (
                                    <optgroup key={idx} label={group.label}>{group.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</optgroup>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2 items-center bg-white p-1 rounded-lg border border-indigo-200 shadow-sm">
                            <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" title="העלה קובץ PDF">📎</button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" className="hidden" />
                            <input type="text" placeholder={selectedFile ? `נבחר: ${selectedFile.name}` : "הקלד נושא באופן חופשי..."} value={topic} onChange={(e) => setTopic(e.target.value)} disabled={isGenerating} className="flex-1 p-2 outline-none text-gray-700" />
                            <button onClick={handleGenerate} disabled={(!topic && !selectedFile) || isGenerating} className={`px-6 py-2 rounded-md font-bold text-white transition-all ${isGenerating ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow hover:shadow-lg'}`}>
                                {isGenerating ? status : 'צור קורס ✨'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IngestionWizard;