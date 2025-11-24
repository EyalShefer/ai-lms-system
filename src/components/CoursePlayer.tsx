import React, { useState } from 'react';
import { useCourseStore } from '../context/CourseContext';

const CoursePlayer: React.FC = () => {
    const { course } = useCourseStore();

    const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
    const [currentUnitIndex, setCurrentUnitIndex] = useState(0);

    // ניהול תשובות התלמיד (זמני לזיכרון הדפדפן)
    const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
    const [feedback, setFeedback] = useState<Record<string, string>>({});

    // בדיקות בטיחות למקרה שהקורס ריק
    if (!course || !course.syllabus || course.syllabus.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500">
                <div className="text-4xl mb-4">📭</div>
                <p>הקורס ריק עדיין.</p>
                <p className="text-sm">עבור למצב "עורך" וצור תוכן חדש.</p>
            </div>
        );
    }

    const currentModule = course.syllabus[currentModuleIndex];
    const currentUnit = currentModule?.learningUnits[currentUnitIndex];

    // הגנה נוספת למקרה שיש מודול אבל אין בו יחידות
    if (!currentUnit) {
        return <div className="p-10 text-center">יחידה לא נמצאה. נסה לבחור יחידה אחרת מהתפריט.</div>;
    }

    // חילוץ מזהה יוטיוב (אותה לוגיקה מהעורך)
    const getYoutubeId = (url: string) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    // בדיקת תשובה אמריקאית
    const checkAnswer = (blockId: string, selectedOption: string, correctAnswer: string) => {
        setStudentAnswers({ ...studentAnswers, [blockId]: selectedOption });
        if (selectedOption === correctAnswer) {
            setFeedback({ ...feedback, [blockId]: 'correct' });
        } else {
            setFeedback({ ...feedback, [blockId]: 'incorrect' });
        }
    };

    return (
        <div className="flex h-[85vh] bg-gray-100 overflow-hidden rounded-2xl shadow-2xl border border-gray-200">

            {/* --- תפריט צד ימין --- */}
            <aside className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-lg z-10 overflow-hidden">
                <div className="p-6 bg-indigo-700 text-white shrink-0">
                    <h2 className="text-lg font-bold leading-tight">{course.title}</h2>
                    <p className="text-indigo-200 text-xs mt-1">תוכן העניינים</p>
                </div>

                <div className="overflow-y-auto flex-1 py-2">
                    {course.syllabus.map((mod, mIdx) => (
                        <div key={mod.id} className="mb-2">
                            <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">
                                {mod.title}
                            </div>
                            {mod.learningUnits.map((unit, uIdx) => {
                                const isActive = mIdx === currentModuleIndex && uIdx === currentUnitIndex;
                                return (
                                    <div
                                        key={unit.id}
                                        onClick={() => {
                                            setCurrentModuleIndex(mIdx);
                                            setCurrentUnitIndex(uIdx);
                                        }}
                                        className={`px-4 py-3 cursor-pointer flex items-center gap-3 transition-all border-b border-gray-50 ${isActive
                                                ? 'bg-indigo-50 text-indigo-700 border-r-4 border-indigo-600 font-medium'
                                                : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        <span className="text-base">
                                            {unit.type === 'acquisition' && '📖'}
                                            {unit.type === 'practice' && '✍️'}
                                            {unit.type === 'test' && '🧠'}
                                        </span>
                                        <span className="text-sm leading-snug truncate">{unit.title}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </aside>

            {/* --- אזור התוכן המרכזי (Scrollable) --- */}
            <main className="flex-1 bg-gray-50 overflow-y-auto p-6 md:p-10 scroll-smooth">
                <div className="max-w-3xl mx-auto bg-white min-h-full shadow-sm border border-gray-200 rounded-xl p-8 md:p-12">

                    {/* כותרת היחידה */}
                    <header className="mb-8 border-b pb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${currentUnit.type === 'acquisition' ? 'bg-blue-100 text-blue-700' :
                                    currentUnit.type === 'practice' ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'
                                }`}>
                                {currentUnit.type === 'acquisition' ? 'למידה' : currentUnit.type === 'practice' ? 'תרגול' : 'מבחן'}
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                            {currentUnit.title}
                        </h1>
                    </header>

                    {/* טקסט ראשי */}
                    {currentUnit.baseContent && (
                        <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed mb-10 whitespace-pre-line">
                            {currentUnit.baseContent}
                        </div>
                    )}

                    {/* --- רכיבי התוכן (הלגו) --- */}
                    <div className="space-y-8">
                        {currentUnit.activityBlocks?.map((block) => (
                            <div key={block.id} className="animate-fade-in">

                                {/* 📝 טקסט נוסף */}
                                {block.type === 'text' && (
                                    <div className="prose max-w-none text-gray-700 bg-gray-50 p-4 rounded-lg border-r-4 border-gray-300 whitespace-pre-line">
                                        {block.content}
                                    </div>
                                )}

                                {/* 🖼️ תמונה */}
                                {block.type === 'image' && block.content && (
                                    <figure className="my-4">
                                        <img
                                            src={block.content}
                                            alt="Visual Aid"
                                            className="w-full rounded-lg shadow-md max-h-96 object-cover"
                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                        />
                                    </figure>
                                )}

                                {/* ▶️ וידאו */}
                                {block.type === 'video' && getYoutubeId(block.content) && (
                                    <div className="aspect-video w-full rounded-xl overflow-hidden shadow-lg my-6">
                                        <iframe
                                            width="100%" height="100%"
                                            src={`https://www.youtube.com/embed/${getYoutubeId(block.content)}`}
                                            title="YouTube video player"
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        ></iframe>
                                    </div>
                                )}

                                {/* 💎 Gem Link */}
                                {block.type === 'gem-link' && (
                                    <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-6 rounded-xl text-white shadow-lg transform hover:scale-[1.01] transition-transform">
                                        <div className="flex items-center gap-4">
                                            <div className="text-4xl">💎</div>
                                            <div>
                                                <h3 className="font-bold text-xl mb-1">{block.content.title || 'משימת AI'}</h3>
                                                <p className="text-purple-100 text-sm mb-4">{block.content.instructions}</p>
                                                <a
                                                    href={block.content.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-block bg-white text-purple-700 px-6 py-2 rounded-full font-bold text-sm hover:bg-purple-50 transition-colors"
                                                >
                                                    התחל שיחה בחלון חדש ↗
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ❓ שאלה אמריקאית (אינטראקטיבית) */}
                                {block.type === 'multiple-choice' && (
                                    <div className="bg-white p-6 rounded-xl border-2 border-indigo-50 shadow-sm">
                                        <h4 className="font-bold text-lg text-gray-800 mb-4 flex gap-2">
                                            <span className="text-indigo-600">?</span> {block.content.question}
                                        </h4>
                                        <div className="space-y-2">
                                            {block.content.options?.map((opt: string, i: number) => {
                                                const isSelected = studentAnswers[block.id] === opt;
                                                const isCorrect = block.content.correctAnswer === opt;
                                                const showFeedback = !!feedback[block.id];

                                                let btnClass = "w-full text-right p-3 rounded-lg border transition-all ";

                                                if (showFeedback) {
                                                    if (isCorrect) btnClass += "bg-green-100 border-green-300 text-green-800";
                                                    else if (isSelected) btnClass += "bg-red-100 border-red-300 text-red-800";
                                                    else btnClass += "bg-gray-50 border-gray-200 opacity-50";
                                                } else {
                                                    btnClass += isSelected
                                                        ? "bg-indigo-100 border-indigo-300 text-indigo-900 font-bold"
                                                        : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300";
                                                }

                                                return (
                                                    <button
                                                        key={i}
                                                        onClick={() => checkAnswer(block.id, opt, block.content.correctAnswer)}
                                                        disabled={showFeedback}
                                                        className={btnClass}
                                                    >
                                                        {opt}
                                                        {showFeedback && isCorrect && " ✅"}
                                                        {showFeedback && isSelected && !isCorrect && " ❌"}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {feedback[block.id] === 'correct' && (
                                            <div className="mt-3 text-green-600 text-sm font-bold animate-bounce">כל הכבוד! תשובה נכונה. 🎉</div>
                                        )}
                                        {feedback[block.id] === 'incorrect' && (
                                            <div className="mt-3 text-red-500 text-sm">לא נורא, נסה שוב בפעם הבאה.</div>
                                        )}
                                    </div>
                                )}

                                {/* ✍️ שאלה פתוחה */}
                                {block.type === 'open-question' && (
                                    <div className="bg-orange-50 p-6 rounded-xl border border-orange-100">
                                        <h4 className="font-bold text-lg text-gray-800 mb-3">✍️ שאלה למחשבה</h4>
                                        <p className="text-gray-700 mb-4 font-medium">{block.content.question}</p>
                                        <textarea
                                            className="w-full p-4 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-300 outline-none bg-white h-32 resize-none"
                                            placeholder="כתוב את תשובתך כאן..."
                                        />
                                        <div className="mt-2 text-right">
                                            <button className="bg-orange-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-600 transition-colors">
                                                שלח לבדיקה (בקרוב)
                                            </button>
                                        </div>
                                    </div>
                                )}

                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CoursePlayer;