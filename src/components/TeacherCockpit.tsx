import React, { useState } from 'react';
import {
    IconSparkles, IconBook, IconVideo, IconJoystick, IconTarget, IconPrinter, IconEdit, IconX, IconCheck
} from '../icons';
import type { LearningUnit, ActivityBlock } from '../shared/types/courseTypes';

interface TeacherCockpitProps {
    unit: LearningUnit;
    onExit: () => void;
    onEdit?: () => void;
}

const TeacherCockpit: React.FC<TeacherCockpitProps> = ({ unit, onExit, onEdit }) => {
    const [activeSection, setActiveSection] = useState<string>('all');

    const handleScrollTo = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            setActiveSection(id);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // Timeline Items
    const timelineItems = [
        { id: 'goals', label: 'יעדים', icon: IconTarget },
        { id: 'opening', label: 'פתיחה', icon: IconBook },
        { id: 'instruction', label: 'הוראה', icon: IconVideo },
        { id: 'practice', label: 'תרגול', icon: IconJoystick },
        { id: 'summary', label: 'סיכום', icon: IconCheck },
    ];

    const renderStaticBlock = (block: ActivityBlock) => {
        if (block.type === 'text') {
            return block.content.split('\n').map((line: string, i: number) => {
                if (line.startsWith('#')) return <h3 key={i} className="text-xl font-bold mt-4 mb-2">{line.replace(/#/g, '')}</h3>;
                return <p key={i} className="mb-2">{line}</p>;
            });
        }
        if (block.type === 'multiple-choice') {
            return (
                <div>
                    <h3 className="text-lg font-bold mb-4">{block.content.question}</h3>
                    <ul className="list-disc pr-5 space-y-2">
                        {block.content.options.map((opt: any, idx: number) => (
                            <li key={idx} className={opt === block.content.correctAnswer ? 'text-green-600 font-bold' : ''}>
                                {typeof opt === 'string' ? opt : opt.value}
                            </li>
                        ))}
                    </ul>
                </div>
            )
        }
        if (block.type === 'open-question') {
            return (
                <div>
                    <h3 className="text-lg font-bold mb-4">שאלה לדיון: {block.content.question}</h3>
                    <p className="text-sm bg-slate-50 p-4 rounded-lg italic border-r-2 border-slate-300">
                        {/* @ts-ignore */}
                        {(block.content as any).model_answer || (block.content as any).modelAnswer || "תשובה לדוגמה לא זמינה"}
                    </p>
                </div>
            )
        }

        // Handle other types
        return (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-2">{block.type.toUpperCase().replace('_', ' ')}</h3>
                {block.type === 'fill_in_blanks' && (
                    <p className="text-lg leading-relaxed dir-rtl text-slate-800">
                        {block.content.text.split(/(\[.*?\])/g).map((part: string, i: number) =>
                            part.startsWith('[')
                                ? <span key={i} className="inline-block border-b-2 border-slate-400 w-24 mx-1 text-center text-slate-400 font-mono text-sm">{part.replace(/[\[\]]/g, '')}</span>
                                : part
                        )}
                    </p>
                )}
                {block.type === 'ordering' && (
                    <div className="space-y-2">
                        {/* @ts-ignore */}
                        <p className="font-bold mb-2">{block.content.instruction || (block.content as any).question}</p>
                        <ol className="list-decimal list-inside space-y-1 text-slate-600">
                            {/* @ts-ignore */}
                            {(block.content.correct_order || (block.content as any).items || []).map((item: any, i: number) => <li key={i}>{typeof item === 'string' ? item : item.text || item}</li>)}
                        </ol>
                    </div>
                )}
                {block.type === 'categorization' && (
                    <div>
                        <p className="font-bold mb-2">{block.content.question}</p>
                        <p className="text-sm text-slate-500">פעילות מיון קטגוריות (אינטראקטיבית)</p>
                    </div>
                )}
                {!['fill_in_blanks', 'ordering', 'categorization'].includes(block.type) && (
                    <p className="text-slate-500 italic">[תוכן אינטראקטיבי: {block.type} - זמין בתצוגת תלמיד]</p>
                )}
            </div>
        );
    };

    const getTeacherTip = (block: ActivityBlock) => {
        if (block.type === 'multiple-choice') return "ודאו שכל התלמידים מבינים את ההבדל בין המסיחים. שאלו: 'למה לדעתכם תשובה ב' אינה נכונה?'";
        if (block.type === 'open-question') return "עודדו תשובות מגוונות. אין תשובה אחת נכונה. שימו לב לתלמידים השקטים.";
        if (block.type === 'categorization') return "חלקו את הכיתה לקבוצות קטנות. תנו להם 5 דקות לדיון לפני האיסוף במליאה.";
        return "שימו לב לקצב הלימוד. ודאו שכולם איתכם לפני המעבר לשלב הבא.";
    };

    return (
        <div className="fixed inset-0 bg-[#f0f4f8] flex font-sans text-slate-800 z-50" dir="rtl">
            {/* Right Sidebar (Timeline) */}
            <div className="w-20 md:w-32 bg-white border-l border-slate-200 flex flex-col items-center py-8 shadow-sm z-10 print:hidden relative">
                <div className="mb-8 p-3 bg-blue-50 rounded-2xl text-blue-600">
                    <IconBook className="w-8 h-8" />
                </div>

                <div className="flex-1 w-full space-y-4 px-2">
                    {timelineItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => handleScrollTo(item.id)}
                            className={`w-full flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${activeSection === item.id ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-400'}`}
                        >
                            <item.icon className="w-6 h-6" />
                            <span className="text-[10px] font-bold">{item.label}</span>
                        </button>
                    ))}

                    {/* Time Tracker Visualization (Mock) */}
                    <div className="hidden md:block absolute bottom-8 right-1/2 translate-x-1/2 w-1 h-32 bg-slate-100 rounded-full overflow-hidden">
                        <div className="w-full h-1/3 bg-green-400 absolute bottom-0"></div>
                    </div>
                </div>
            </div>

            {/* Main Content (Cockpit) */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">

                {/* Header */}
                <div className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm print:hidden">
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">מערך שיעור למורה</span>
                        <h1 className="text-2xl font-black text-slate-800">{unit.title}</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-bold transition shadow-sm">
                            <IconPrinter className="w-5 h-5" />
                            <span className="hidden md:inline">הדפס PDF</span>
                        </button>
                        {onEdit && (
                            <button onClick={onEdit} className="flex items-center gap-2 px-6 py-3 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-full font-bold transition shadow-sm">
                                <IconEdit className="w-5 h-5" />
                                <span className="hidden md:inline">ערוך מערך</span>
                            </button>
                        )}
                        <div className="h-8 w-px bg-slate-200 mx-2"></div>
                        <button onClick={onExit} className="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition" title="יציאה">
                            <IconX className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Script Scroll Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-12 print:p-0 bg-[#f0f4f8]">
                    <div className="max-w-4xl mx-auto space-y-8 print:max-w-none pb-32">

                        {/* Meta Header (Print Only) */}
                        <div className="hidden print:block mb-8 text-center border-b pb-4">
                            <h1 className="text-4xl font-black mb-2">{unit.title}</h1>
                            <p className="text-slate-500">נוצר על ידי Wizdi AI LMS</p>
                        </div>

                        {/* Goals Card (Static) */}
                        <div id="goals" className="bg-white p-8 rounded-3xl shadow-sm border-t-8 border-blue-500 print:shadow-none print:border scroll-mt-32">
                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <IconTarget className="text-blue-500 w-6 h-6" />
                                יעדי השיעור
                            </h2>
                            <ul className="space-y-2 text-slate-600 list-disc list-inside">
                                <li>התלמיד יבין את הנושא המרכזי ({unit.title}).</li>
                                <li>התלמיד יתרגל חשיבה ביקורתית באמצעות שאלות דיון.</li>
                                <li>התלמיד יפגין הבנה במושגי היסוד.</li>
                            </ul>
                        </div>

                        {/* Blocks Loop */}
                        <div id="instruction" className="space-y-8">
                            {unit.activityBlocks?.map((block: ActivityBlock, idx: number) => (
                                <div key={block.id} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 print:shadow-none print:break-inside-avoid relative overflow-hidden group hover:shadow-md transition-shadow">
                                    {/* Time Estimate Badge (Absolute) */}
                                    <div className="absolute top-6 left-6 bg-slate-100 text-slate-500 text-xs font-bold px-3 py-1 rounded-full print:hidden">
                                        ⏱️ 5 דק'
                                    </div>

                                    {/* Step Header */}
                                    <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-4">
                                        <span className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-8 h-8 flex items-center justify-center rounded-lg font-black shadow-blue-200 shadow-lg glow">
                                            {idx + 1}
                                        </span>
                                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{block.type.replace('-', ' ')}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="prose prose-lg max-w-none prose-headings:font-black prose-p:text-slate-600 prose-li:text-slate-600">
                                        {renderStaticBlock(block)}
                                    </div>

                                    {/* Teacher Tip */}
                                    <div className="mt-8 bg-amber-50 rounded-xl p-6 border border-amber-100 flex gap-4 print:border-amber-200">
                                        <div className="bg-white p-2 rounded-full shadow-sm text-amber-500 h-fit">
                                            <IconSparkles className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-amber-900 mb-1 text-sm uppercase tracking-wide">הנחיה למורה</h4>
                                            <p className="text-base text-amber-800/90 leading-relaxed font-medium">
                                                {getTeacherTip(block)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Summary Anchor */}
                        <div id="summary"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeacherCockpit;
