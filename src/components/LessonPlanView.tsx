import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IconSparkles, IconTarget } from '../icons';

const IconDownload = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

interface LessonPlanViewProps {
    content: string;
    onCreateActivity: () => void;
    onCreateAssessment: () => void;
    title: string;
}

const LessonPlanView: React.FC<LessonPlanViewProps> = ({ content, onCreateActivity, onCreateAssessment, title }) => {
    // Split content by buttons
    // Regex matches "> [BUTTON:X]" allowing for flexibility
    const parts = content.split(/>\s*\[BUTTON:(CREATE_ACTIVITY|CREATE_ASSESSMENT)\]/g);

    return (
        <div className="max-w-5xl mx-auto p-12 bg-white shadow-2xl rounded-3xl my-12 min-h-screen text-right" dir="rtl">
            <div className="flex justify-between items-center mb-12 border-b border-slate-100 pb-8">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 mb-3 leading-tight">{title}</h1>
                    <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide">מערך שיעור</span>
                </div>
                <button onClick={() => window.print()} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-bold bg-slate-50 px-4 py-2 rounded-xl">
                    <IconDownload className="w-5 h-5" />
                    שמירה כ-PDF
                </button>
            </div>

            <div className="space-y-6">
                {parts.map((part, i) => {
                    if (part === 'CREATE_ACTIVITY') {
                        return (
                            <div key={i} className="my-12 p-8 bg-blue-50 rounded-3xl border border-blue-100 flex flex-col items-center text-center animate-fade-in relative overflow-hidden group">
                                <div className="absolute inset-0 bg-blue-100/50 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500"></div>
                                <h3 className="text-xl font-bold text-blue-900 mb-2 relative z-10">הגיע הזמן לתרגל!</h3>
                                <p className="text-blue-700/80 mb-6 max-w-md relative z-10">הפכו את הרעיון לפעילות אינטראקטיבית שתעורר את התלמידים.</p>
                                <button
                                    onClick={onCreateActivity}
                                    className="relative z-10 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center gap-3 font-bold text-lg"
                                >
                                    <IconSparkles className="w-6 h-6 animate-pulse" />
                                    <span>יצירת פעילות</span>
                                </button>
                            </div>
                        );
                    }
                    if (part === 'CREATE_ASSESSMENT') {
                        return (
                            <div key={i} className="my-12 p-8 bg-indigo-50 rounded-3xl border border-indigo-100 flex flex-col items-center text-center animate-fade-in relative overflow-hidden group">
                                <div className="absolute inset-0 bg-indigo-100/50 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-right duration-500"></div>
                                <h3 className="text-xl font-bold text-indigo-900 mb-2 relative z-10">סיכום והערכה</h3>
                                <p className="text-indigo-700/80 mb-6 max-w-md relative z-10">בדקו את ההבנה עם שאלון קצר וממוקד.</p>
                                <button
                                    onClick={onCreateAssessment}
                                    className="relative z-10 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center gap-3 font-bold text-lg"
                                >
                                    <IconTarget className="w-6 h-6" />
                                    <span>יצירת מבחן</span>
                                </button>
                            </div>
                        );
                    }

                    if (!part.trim()) return null;

                    return (
                        <div key={i} className="prose prose-lg max-w-none prose-headings:font-black prose-headings:text-gray-900 prose-p:text-gray-700 prose-ul:text-gray-700 prose-li:marker:text-blue-500">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LessonPlanView;
