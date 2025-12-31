import React, { useState, useEffect } from 'react';
import { getCourseAnalytics, type StudentAnalytics } from '../../services/analyticsService';
import { IconAlertTriangle, IconCheck, IconX, IconActivity } from '@tabler/icons-react';
import { IconChevronLeft, IconBrain } from '../../icons'; // Reusing existing

// --- Sub-Components ---

// ... imports

const JourneyTrace = ({ student }: { student: StudentAnalytics }) => {
    return (
        <div className="bg-slate-50 rounded-3xl p-6 shadow-inner border border-slate-200 w-full overflow-hidden" dir="rtl">
            <h3 className="text-slate-800 font-bold text-xl mb-6 flex items-center gap-2">
                <IconActivity className="text-blue-600" />
                מסלול למידה: {student.name}
            </h3>

            {/* Scroll Container with LTR direction for time progression (Past -> Future) */}
            <div className="overflow-x-auto pb-4" dir="ltr">
                <div className="flex items-center gap-0 w-max px-4 min-w-full">
                    {student.journey.map((node, idx) => {
                        const isRemediation = node.type === 'remediation';

                        return (
                            <div key={idx} className="flex items-center">
                                {/* Node */}
                                <div className={`relative flex flex-col items-center group`}>
                                    {/* Pulse for remediation */}
                                    {isRemediation && <div className="absolute inset-0 bg-yellow-400 blur-md opacity-50 animate-pulse rounded-full" />}

                                    <div className={`w-12 h-12 rounded-full border-4 z-10 flex items-center justify-center shadow-lg relative
                                        ${node.status === 'success' ? 'bg-lime-400 border-lime-600' :
                                            node.status === 'failure' ? 'bg-red-500 border-red-700' :
                                                node.type === 'remediation' ? 'bg-yellow-300 border-yellow-500' : 'bg-slate-200 border-slate-300'}
                                        transition-transform hover:scale-125 cursor-pointer
                                        shrink-0
                                    `}>
                                        {isRemediation ? '🛠️' : node.status === 'success' ? <IconCheck size={20} className="text-slate-900" stroke={3} /> : <IconX size={20} className="text-white" stroke={3} />}
                                    </div>

                                    {/* Node Label */}
                                    <div className="absolute top-full mt-3 text-center w-32 -left-10 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 block bg-white/95 px-2 py-1 rounded-lg shadow-xl border border-slate-100">
                                            {node.type}
                                        </span>
                                        {node.connection === 'branched' && (
                                            <span className="text-[10px] text-yellow-600 font-bold bg-yellow-50 px-2 rounded-full mt-1 inline-block">לולאת חיזוק</span>
                                        )}
                                    </div>
                                </div>

                                {/* Connector Line */}
                                {idx < student.journey.length - 1 && (
                                    <div className={`h-1.5 w-16 mx-1 rounded-full shrink-0
                                        ${node.connection === 'branched' ? 'bg-yellow-200 border-t-2 border-dashed border-yellow-500/50 h-0 w-12 mx-2' : 'bg-slate-200'}
                                    `} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export const AdaptiveDashboard = () => {
    const [students, setStudents] = useState<StudentAnalytics[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    useEffect(() => {
        getCourseAnalytics('c1').then(setStudents);
    }, []);

    const selectedStudent = students.find(s => s.id === selectedStudentId) || students[0];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans overflow-x-hidden" dir="rtl">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8 border-b border-slate-200 pb-6 flex flex-col md:flex-row items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-2 flex items-center gap-3">
                        <IconBrain className="w-10 h-10 text-indigo-600" />
                        לוח בקרה אדפטיבי
                    </h1>
                    <p className="text-slate-500 text-lg">
                        מבט על כיתתי בזמן אמת: ביצועים, מסלולי למידה וזיהוי פערים
                    </p>
                </div>

                {/* KPI Cards */}
                <div className="flex gap-4">
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
                        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                            <IconAlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-3xl font-black text-slate-800">{students.filter(s => s.riskLevel === 'high').length}</div>
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">תלמידים בסיכון</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-8 items-start">

                {/* Left: The Heatmap (Matrix) - In RTL this is on the Right physically */}
                <div className="w-full xl:w-5/12 bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm overflow-hidden">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <span className="w-1.5 h-8 bg-indigo-600 rounded-full" />
                        מפת שליטה כיתתית
                    </h2>

                    <div className="space-y-4 overflow-x-auto pb-2">
                        {/* Header Row */}
                        <div className="flex items-center gap-4 pl-14 pb-2 border-b border-slate-100 text-xs text-slate-400 font-bold uppercase tracking-widest text-center min-w-[300px]">
                            {Object.keys(students[0]?.mastery || {}).map(topic => (
                                <div key={topic} className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap px-1" title={topic}>
                                    {topic}
                                </div>
                            ))}
                        </div>

                        {/* Rows */}
                        {students.map(s => (
                            <div
                                key={s.id}
                                onClick={() => setSelectedStudentId(s.id)}
                                className={`flex items-center gap-4 p-3 rounded-2xl transition-all cursor-pointer border-2 min-w-[300px]
                                    ${selectedStudentId === s.id ? 'bg-indigo-50 border-indigo-500 shadow-md transform scale-[1.02]' : 'border-transparent hover:bg-slate-50'}
                                `}
                            >
                                {/* Avatar */}
                                <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden shrink-0 border-2 border-white shadow-sm">
                                    <img src={s.avatar} alt={s.name} className="w-full h-full object-cover" />
                                </div>

                                {/* Name + Risk */}
                                <div className="w-24 shrink-0">
                                    <div className="font-bold text-slate-800 text-sm truncate">{s.name}</div>
                                    <div className={`text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold uppercase mt-1
                                        ${s.riskLevel === 'high' ? 'bg-red-50 text-red-600' :
                                            s.riskLevel === 'medium' ? 'bg-orange-50 text-orange-600' : 'bg-lime-50 text-lime-700'}
                                    `}>
                                        {s.riskLevel === 'high' ? 'סיכון' : s.riskLevel === 'medium' ? 'בינוני' : 'מצוין'}
                                    </div>
                                </div>

                                {/* Mastery Cells */}
                                <div className="flex-1 flex justify-between gap-2">
                                    {Object.entries(s.mastery).map(([topic, score]) => (
                                        <div key={topic} className="flex-1 flex justify-center">
                                            <div className={`h-3 w-full rounded-full bg-slate-100 overflow-hidden relative group shadow-inner border border-slate-200`}>
                                                <div
                                                    className={`absolute inset-0 rounded-full ${score > 0.8 ? 'bg-emerald-400' : score > 0.5 ? 'bg-amber-400' : 'bg-red-400'}`}
                                                    style={{ width: `${score * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <IconChevronLeft className="text-slate-300 w-5 h-5 shrink-0" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Detail View (Journey) - In RTL this is on the Left physically */}
                {/* Fixed width problem: min-w-0 prevents flex item from overflowing parent */}
                <div className="w-full xl:w-7/12 flex flex-col gap-6 min-w-0">
                    {selectedStudent && (
                        <div className="animate-in slide-in-from-right-8 fade-in duration-500">
                            <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-xl relative overflow-hidden">
                                {/* Decor */}
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                                <div className="flex flex-col md:flex-row items-start justify-between mb-8 gap-6">
                                    <div className="flex items-center gap-6">
                                        <img src={selectedStudent.avatar} className="w-20 h-20 md:w-24 md:h-24 rounded-3xl border-4 border-white shadow-lg" />
                                        <div>
                                            <h2 className="text-2xl md:text-3xl font-black text-slate-800">{selectedStudent.name}</h2>
                                            <div className="text-slate-500 flex flex-wrap items-center gap-3 mt-2 font-medium text-sm md:text-base">
                                                <span>פעילות אחרונה: {new Date(selectedStudent.lastActive).toLocaleTimeString()}</span>
                                                <span className="text-slate-300 hidden md:inline">|</span>
                                                <span className="text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded-lg">ID: {selectedStudent.id}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mini Stats */}
                                    <div className="text-left bg-slate-50 p-4 rounded-2xl border border-slate-100 w-full md:w-auto">
                                        <div className="text-3xl md:text-4xl font-black font-mono text-indigo-600">
                                            {Math.round(Object.values(selectedStudent.mastery).reduce((a, b) => a + b, 0) / 4 * 100)}%
                                        </div>
                                        <div className="text-slate-400 uppercase font-bold text-xs tracking-wider">שליטה ממוצעת</div>
                                    </div>
                                </div>

                                {/* The Traces */}
                                <JourneyTrace student={selectedStudent} />

                                <div className="mt-8 bg-blue-50 border border-blue-100 p-6 rounded-2xl text-blue-900 flex gap-4">
                                    <div className="bg-white p-3 rounded-full h-fit text-blue-500 shadow-sm shrink-0"><IconBrain className="w-6 h-6" /></div>
                                    <div>
                                        <strong className="block text-lg font-bold mb-1 text-blue-800">תובנות המערכת (AI)</strong>
                                        <p className="leading-relaxed opacity-90 text-sm md:text-base">
                                            {selectedStudent.riskLevel === 'high'
                                                ? "התלמיד מגלה קושי במשימות 'הסקת מסקנות'. לולאת חיזוק הופעלה פעמיים. מומלץ: תרגול ממוקד באיתור פרטים בטקסט."
                                                : "התלמיד מתקדם בצורה אופטימלית. ביצע בהצלחה יחידות אתגר בנושא 'אוצר מילים והקשר'."
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
