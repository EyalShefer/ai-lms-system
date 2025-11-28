import React, { useState, useRef } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { generateCourseWithGemini } from '../gemini';
import { extractTextFromPDF } from '../pdfService';
import type { Course } from '../courseTypes';

const IngestionWizard: React.FC = () => {
    const { setCourse, setFullBookContent, setPdfSource } = useCourseStore();

    const [topic, setTopic] = useState('');
    const [gradeLevel, setGradeLevel] = useState('כיתה ט׳ (חטיבת ביניים)');
    const [subject, setSubject] = useState('היסטוריה');

    // --- התוספת החדשה: בחירת מצב מראש ---
    const [courseMode, setCourseMode] = useState<'learning' | 'exam'>('learning');

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
                setFullBookContent(sourceText);

                const reader = new FileReader();
                reader.onload = (e) => {
                    if (e.target?.result) {
                        setPdfSource(e.target.result as string);
                    }
                };
                reader.readAsDataURL(selectedFile);
            }

            setStatus('ה-AI מנתח פדגוגית ובונה קורס...');

            // יצירת הקורס
            const newCourse = await generateCourseWithGemini(topic, gradeLevel, subject, sourceText);

            // --- הזרקת המצב שנבחר (למידה/מבחן) לתוך הקורס החדש ---
            newCourse.mode = courseMode;

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

    return (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-6 mb-8 shadow-sm">
            <div className="flex items-start gap-4">
                <div className="bg-indigo-600 text-white p-3 rounded-lg text-2xl shadow-md">
                    🎓
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-indigo-900 mb-1">
                        מחולל קורסים פדגוגי (מערכת החינוך)
                    </h3>
                    <p className="text-sm text-indigo-600 mb-4 opacity-80">
                        בחר שכבת גיל ותחום דעת, העלה חומר לימוד, והמערכת תבנה מערך שיעור מותאם.
                    </p>

                    <div className="flex flex-col gap-3">

                        {/* שורה ראשונה: בחירות כלליות */}
                        <div className="flex flex-wrap gap-2">

                            {/* בחירת סוג הפעילות (החדש!) */}
                            <select
                                value={courseMode}
                                onChange={(e) => setCourseMode(e.target.value as 'learning' | 'exam')}
                                className={`p-2 rounded border font-bold outline-none focus:ring-2 focus:ring-indigo-300 flex-1 ${courseMode === 'exam' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                                    }`}
                            >
                                <option value="learning">✅ מצב למידה (עם משוב)</option>
                                <option value="exam">🛑 מצב מבחן (ללא משוב)</option>
                            </select>

                            <select
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="p-2 rounded border border-indigo-200 bg-white text-gray-700 flex-1 outline-none focus:border-indigo-500"
                            >
                                <optgroup label="הומניסטיקה וחברה">
                                    <option value="היסטוריה">היסטוריה</option>
                                    <option value="אזרחות">אזרחות</option>
                                    <option value="גיאוגרפיה">גיאוגרפיה</option>
                                    <option value="ספרות">ספרות</option>
                                    <option value="תנ״ך">תנ״ך</option>
                                    <option value="תרבות ישראל">תרבות ישראל</option>
                                </optgroup>
                                <optgroup label="שפות">
                                    <option value="לשון עברית">לשון עברית</option>
                                    <option value="אנגלית (English)">אנגלית</option>
                                    <option value="ערבית">ערבית</option>
                                </optgroup>
                                <optgroup label="מדעים וטכנולוגיה">
                                    <option value="מתמטיקה">מתמטיקה</option>
                                    <option value="פיזיקה">פיזיקה</option>
                                    <option value="כימיה">כימיה</option>
                                    <option value="ביולוגיה">ביולוגיה</option>
                                    <option value="מדעים וטכנולוגיה (מו״ט)">מדעים וטכנולוגיה</option>
                                </optgroup>
                            </select>

                            <select
                                value={gradeLevel}
                                onChange={(e) => setGradeLevel(e.target.value)}
                                className="p-2 rounded border border-indigo-200 bg-white text-gray-700 flex-1 outline-none focus:border-indigo-500"
                            >
                                <optgroup label="חטיבת ביניים">
                                    <option value="כיתה ז׳ (חטיבת ביניים)">כיתה ז׳</option>
                                    <option value="כיתה ח׳ (חטיבת ביניים)">כיתה ח׳</option>
                                    <option value="כיתה ט׳ (חטיבת ביניים)">כיתה ט׳</option>
                                </optgroup>
                                <optgroup label="חטיבה עליונה">
                                    <option value="כיתה י׳ (תיכון)">כיתה י׳</option>
                                    <option value="כיתה י״א (תיכון)">כיתה י״א</option>
                                    <option value="כיתה י״ב (תיכון)">כיתה י״ב</option>
                                </optgroup>
                            </select>
                        </div>

                        {/* שורה שנייה: קובץ וכפתור יצירה */}
                        <div className="flex gap-2 items-center bg-white p-1 rounded-lg border border-indigo-200 shadow-sm">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-3 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                title="העלה קובץ PDF"
                            >
                                📎
                            </button>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".pdf"
                                className="hidden"
                            />

                            <input
                                type="text"
                                placeholder={selectedFile ? `נבחר: ${selectedFile.name}` : "הקלד נושא באופן חופשי..."}
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                disabled={isGenerating}
                                className="flex-1 p-2 outline-none text-gray-700"
                            />

                            <button
                                onClick={handleGenerate}
                                disabled={(!topic && !selectedFile) || isGenerating}
                                className={`px-6 py-2 rounded-md font-bold text-white transition-all ${isGenerating
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 shadow hover:shadow-lg'
                                    }`}
                            >
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