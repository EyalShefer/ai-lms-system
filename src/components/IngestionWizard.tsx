import React, { useState, useRef } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { generateCourseWithGemini } from '../gemini';
import { extractTextFromPDF } from '../pdfService';

const IngestionWizard: React.FC = () => {
    // הוספנו את setFullBookContent
    const { setCourse, setFullBookContent } = useCourseStore();

    const [topic, setTopic] = useState('');
    const [gradeLevel, setGradeLevel] = useState('כיתה ז׳ (חטיבת ביניים)');
    const [subject, setSubject] = useState('היסטוריה');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [status, setStatus] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setSelectedFile(file);
            setTopic(file.name);
        }
    };

    const handleGenerate = async () => {
        if (!topic && !selectedFile) return;

        setIsGenerating(true);
        setStatus('מתחיל בתהליך...');

        try {
            let sourceText = "";

            if (selectedFile && selectedFile.type === 'application/pdf') {
                setStatus(`קורא את הספר: ${selectedFile.name}...`);
                sourceText = await extractTextFromPDF(selectedFile);

                // 🎯 כאן אנחנו שומרים את הטקסט לשימוש הצ'אט העתידי!
                setFullBookContent(sourceText);
            }

            setStatus('ה-AI מנתח פדגוגית ובונה קורס...');
            const newCourse = await generateCourseWithGemini(topic, gradeLevel, subject, sourceText);

            setCourse(newCourse);
            alert("הקורס נוצר בהצלחה! 📚");

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

    // ... (שאר ה-HTML נשאר זהה לחלוטין - אין צורך לשנות את ה-return)
    // רק תוודא שהעתקת את החלק הלוגי למעלה
    return (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-6 mb-8 shadow-sm">
            {/* העתק כאן את אותו HTML מהקובץ הקודם שלך, הוא לא השתנה */}
            {/* אם אתה רוצה את הקובץ המלא כדי לא להסתבך - תגיד לי */}
            <div className="flex items-start gap-4">
                <div className="bg-indigo-600 text-white p-3 rounded-lg text-2xl shadow-md">🎓</div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-indigo-900 mb-1">מחולל קורסים פדגוגי</h3>
                    <p className="text-sm text-indigo-600 mb-4 opacity-80">בחר שכבת גיל ותחום דעת, העלה חומר לימוד, והמערכת תבנה מערך שיעור מותאם.</p>

                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="p-2 rounded border border-indigo-200 bg-white text-gray-700 flex-1 outline-none">
                                <optgroup label="הומניסטיקה וחברה"><option value="היסטוריה">היסטוריה</option><option value="אזרחות">אזרחות</option><option value="ספרות">ספרות</option><option value="תנ״ך">תנ״ך</option></optgroup>
                                <optgroup label="מדעים"><option value="מדעים">מדעים</option><option value="ביולוגיה">ביולוגיה</option><option value="פיזיקה">פיזיקה</option></optgroup>
                                <option value="כללי">כללי</option>
                            </select>
                            <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="p-2 rounded border border-indigo-200 bg-white text-gray-700 flex-1 outline-none">
                                <option value="כיתה ז׳ (חטיבת ביניים)">כיתה ז׳</option>
                                <option value="כיתה ט׳ (חטיבת ביניים)">כיתה ט׳</option>
                                <option value="כיתה י״א (תיכון)">כיתה י״א</option>
                            </select>
                        </div>
                        <div className="flex gap-2 items-center bg-white p-1 rounded-lg border border-indigo-200 shadow-sm">
                            <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">📎</button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" className="hidden" />
                            <input type="text" placeholder={selectedFile ? `נבחר: ${selectedFile.name}` : "הקלד נושא..."} value={topic} onChange={(e) => setTopic(e.target.value)} disabled={isGenerating} className="flex-1 p-2 outline-none text-gray-700" />
                            <button onClick={handleGenerate} disabled={(!topic && !selectedFile) || isGenerating} className="px-6 py-2 rounded-md font-bold text-white bg-indigo-600 hover:bg-indigo-700">{isGenerating ? status : 'צור קורס ✨'}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IngestionWizard;