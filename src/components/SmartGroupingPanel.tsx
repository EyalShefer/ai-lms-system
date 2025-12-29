import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { IconSparkles, IconBrain, IconX } from '../icons'; // Assuming these exist
import { assignLessonToGroup, type GroupType } from '../services/LessonDistributor';

interface SmartGroupingPanelProps {
    classId: string;
    teacherId: string;
    students: any[]; // Assuming student object has score/id/name etc.
    onAssignmentCreated?: () => void;
}

export const SmartGroupingPanel: React.FC<SmartGroupingPanelProps> = ({ classId, teacherId, students, onAssignmentCreated }) => {
    // 1. Logic to segment students (Simplified for UI demo, real logic might be more complex)
    const remediationGroup = students.filter(s => s.score < 60);
    const standardGroup = students.filter(s => s.score >= 60 && s.score < 90);
    const challengeGroup = students.filter(s => s.score >= 90);

    const groups: { type: GroupType; label: string; data: any[], color: string, description: string }[] = [
        { type: 'remediation', label: 'חיזוק (Remediation)', data: remediationGroup, color: "bg-red-50 border-red-200 text-red-700", description: "ציונים נמוכים, זקוקים לפירוק לגורמים ועידוד." },
        { type: 'standard', label: 'רגיל (Standard)', data: standardGroup, color: "bg-blue-50 border-blue-200 text-blue-700", description: "קצב רגיל, תוכנית לימודים סטנדרטית." },
        { type: 'challenge', label: 'אתגר (Challenge)', data: challengeGroup, color: "bg-purple-50 border-purple-200 text-purple-700", description: "מצטיינים, זקוקים לחשיבה ביקורתית ואתגר." }
    ];

    // Modal State
    const [activeGroup, setActiveGroup] = useState<GroupType | null>(null);
    const [topic, setTopic] = useState("");
    const [loading, setLoading] = useState(false);

    const handleAssignClick = (groupType: GroupType) => {
        setActiveGroup(groupType);
        setTopic(""); // Reset topic
    };

    const handleSubmit = async () => {
        if (!activeGroup || !topic) return;

        const targetStudents = groups.find(g => g.type === activeGroup)?.data.map(s => s.id) || [];
        if (targetStudents.length === 0) return alert("אין תלמידים בקבוצה זו.");

        setLoading(true);
        try {
            await assignLessonToGroup(teacherId, classId, topic, activeGroup, targetStudents);
            alert(`המשימה '${topic}' נשלחה ליצירה עבור קבוצת ${activeGroup}!`);
            if (onAssignmentCreated) onAssignmentCreated();
            setActiveGroup(null);
        } catch (error) {
            console.error(error);
            alert("שגיאה ביצירת המשימה.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                <IconBrain className="w-6 h-6 text-indigo-600" />
                חלוקה חכמה לקבוצות
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {groups.map((group) => (
                    <div key={group.type} className={`p-6 rounded-2xl border ${group.color} relative overflow-hidden transition-all hover:shadow-md`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <IconSparkles className="w-24 h-24" />
                        </div>

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <h4 className="text-lg font-black">{group.label}</h4>
                                <span className="bg-white/50 px-3 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-sm">
                                    {group.data.length} תלמידים
                                </span>
                            </div>

                            <p className="text-sm opacity-80 mb-6 font-medium leading-relaxed">
                                {group.description}
                            </p>

                            <button
                                onClick={() => handleAssignClick(group.type)}
                                disabled={group.data.length === 0}
                                className="w-full py-3 bg-white/80 hover:bg-white text-slate-800 font-bold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <IconSparkles className="w-4 h-4" />
                                צור פעילות לקבוצה
                            </button>
                        </div>

                        {/* Student Avatars Preview (Optional) */}
                        <div className="flex -space-x-2 space-x-reverse mt-4 relative z-10">
                            {group.data.slice(0, 5).map((s, i) => (
                                <div key={i} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs font-bold text-slate-500" title={s.name}>
                                    {s.name.charAt(0)}
                                </div>
                            ))}
                            {group.data.length > 5 && (
                                <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs font-bold text-slate-500">
                                    +{group.data.length - 5}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {activeGroup && createPortal(
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" dir="rtl">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-scale-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800">יצירת פעילות לקבוצה</h3>
                            <button onClick={() => setActiveGroup(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><IconX className="w-5 h-5 text-slate-500" /></button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-indigo-50 p-4 rounded-xl text-indigo-900 text-sm">
                                <span className="font-bold block mb-1">הקבוצה הנבחרת: {activeGroup === 'remediation' ? 'בסיס / חיזוק' : activeGroup === 'challenge' ? 'מצטיינים / אתגר' : 'רגילה'}</span>
                                המערכת תתאים אוטומטית את רמת הקושי, סגנון השאלות והמשוב עבור תלמידים אלו.
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">באיזה נושא נתמקד היום?</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="לדוגמה: המהפכה הצרפתית, שברים עשרוניים..."
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={loading || !topic}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex justify-center items-center gap-2 mt-4 disabled:opacity-50"
                            >
                                {loading ? <span className="animate-spin">⏳</span> : <IconSparkles className="w-5 h-5" />}
                                שגר ל-AI והקצה לתלמידים
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
