import React, { useState, useRef } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { generateCourseWithGemini } from '../gemini'; // <--- הייבוא החדש

const IngestionWizard: React.FC = () => {
    const { setCourse } = useCourseStore();
    const [topic, setTopic] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleGenerate = async () => {
        // אם אין נושא ואין קובץ - לא עושים כלום
        const effectiveTopic = topic || (fileInputRef.current?.files?.[0]?.name);
        if (!effectiveTopic) return;

        setIsGenerating(true);

        try {
            // קריאה ל-Gemini (זה לוקח כמה שניות)
            const newCourse = await generateCourseWithGemini(effectiveTopic);

            // עדכון המערכת בקורס החדש
            setCourse(newCourse);
            alert("הקורס נוצר בהצלחה! 🎓");

            // איפוס
            setTopic('');
            if (fileInputRef.current) fileInputRef.current.value = '';

        } catch (error) {
            alert("אופס! היתה בעיה ביצירת הקורס. נסה שוב.");
            console.error(error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-6 mb-8 shadow-sm">
            <div className="flex items-start gap-4">
                <div className="bg-indigo-600 text-white p-3 rounded-lg text-2xl shadow-md">
                    🧙‍♂️
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-indigo-900 mb-1">
                        מחולל הקורסים האוטומטי (מופעל ע"י Gemini)
                    </h3>
                    <p className="text-sm text-indigo-600 mb-4 opacity-80">
                        כתוב נושא, והבינה המלאכותית תבנה לך קורס שלם בעברית תוך שניות.
                    </p>

                    <div className="flex gap-2 items-center bg-white p-1 rounded-lg border border-indigo-200 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500">
                        <input
                            type="text"
                            placeholder="על מה תרצה ללמוד היום?"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            disabled={isGenerating}
                            className="flex-1 p-2 outline-none text-gray-700"
                        />

                        <button
                            onClick={handleGenerate}
                            disabled={!topic || isGenerating}
                            className={`px-6 py-2 rounded-md font-bold text-white transition-all mx-1 ${isGenerating
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 shadow hover:shadow-lg'
                                }`}
                        >
                            {isGenerating ? 'ה-AI כותב... 🧠' : 'צור קורס ✨'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IngestionWizard;