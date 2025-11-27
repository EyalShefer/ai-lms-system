import React, { useState } from 'react';
import { useCourseStore } from '../context/CourseContext';
import UnitEditor from './UnitEditor';
import IngestionWizard from './IngestionWizard';
import type { LearningUnit, Module } from '../courseTypes';

const CourseEditor: React.FC = () => {
    const { course, updateLearningUnit } = useCourseStore();
    const [editingUnit, setEditingUnit] = useState<LearningUnit | null>(null);
    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

    // הגנה
    if (!course) return <div className="p-10 text-center">טוען...</div>;

    // אם הקורס ריק - מציגים את הקוסם
    if (!course.syllabus || course.syllabus.length === 0) {
        return (
            <div className="max-w-4xl mx-auto mt-10">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-2xl text-center mb-8 border border-indigo-100 shadow-sm">
                    <h1 className="text-3xl font-bold text-indigo-900 mb-2">ברוכים הבאים לקורס החדש! 🎉</h1>
                    <p className="text-indigo-700">הקורס <strong>"{course.title}"</strong> כרגע ריק.<br />בוא נתחיל ביצירת סילבוס ותוכן בעזרת ה-AI.</p>
                </div>
                <IngestionWizard />
            </div>
        );
    }

    // פונקציית שיתוף הקישור
    const handleShare = () => {
        // בונים את הקישור: הכתובת הנוכחית + ה-ID של הקורס
        const shareUrl = `${window.location.origin}/?studentCourseId=${course.id}`;

        navigator.clipboard.writeText(shareUrl).then(() => {
            alert(`הקישור הועתק בהצלחה!\n\n${shareUrl}\n\nשלח אותו לתלמידים.`);
        });
    };

    const handleEditUnit = (unit: LearningUnit, moduleId: string) => {
        setEditingUnit(unit);
        setActiveModuleId(moduleId);
    };

    const handleSaveUnit = (updatedUnit: LearningUnit) => {
        if (activeModuleId) {
            updateLearningUnit(activeModuleId, updatedUnit);
            setEditingUnit(null);
            setActiveModuleId(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto pb-20">
            {editingUnit ? (
                <UnitEditor unit={editingUnit} onSave={handleSaveUnit} onCancel={() => setEditingUnit(null)} />
            ) : (
                <div className="space-y-8 animate-fade-in">

                    {/* כותרת וכפתורי פעולה */}
                    <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm flex justify-between items-center">
                        <div>
                            <h2 className="text-3xl font-extrabold text-gray-900">{course.title}</h2>
                            <div className="flex gap-3 mt-2 text-sm text-gray-500">
                                <span className="bg-gray-100 px-3 py-1 rounded-full">🎯 {course.targetAudience || 'קהל כללי'}</span>
                                <span className="bg-gray-100 px-3 py-1 rounded-full">📚 {course.syllabus.length} פרקים</span>
                            </div>
                        </div>
                        <button
                            onClick={handleShare}
                            className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold shadow hover:bg-green-700 flex items-center gap-2 transition-all transform hover:-translate-y-1"
                        >
                            <span>🔗</span> שתף קישור עם תלמידים
                        </button>
                    </div>

                    {/* רשימת המודולים */}
                    {course.syllabus.map((mod: Module, mIdx: number) => (
                        <div key={mod.id || mIdx} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-800"><span className="text-indigo-500 opacity-50 ml-2">#{mIdx + 1}</span>{mod.title}</h3>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {mod.learningUnits?.map((unit) => (
                                    <div key={unit.id} className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-indigo-300 transition-all duration-200 flex flex-col h-full">
                                        <div className="mb-3">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${unit.type === 'acquisition' ? 'bg-blue-100 text-blue-700' : unit.type === 'practice' ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'}`}>
                                                {unit.type === 'acquisition' ? '📖 הקניה' : unit.type === 'practice' ? '✍️ תרגול' : '🧠 מבחן'}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-gray-900 mb-2 leading-tight">{unit.title}</h4>
                                        <p className="text-xs text-gray-500 line-clamp-3 mb-4 flex-1">{unit.baseContent}</p>
                                        <button onClick={() => handleEditUnit(unit, mod.id)} className="w-full py-2 rounded-lg bg-gray-50 text-indigo-600 text-sm font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors mt-auto">ערוך יחידה ✏️</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CourseEditor;