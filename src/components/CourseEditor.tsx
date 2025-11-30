import React, { useState, useEffect } from 'react';
import { useCourseStore } from '../context/CourseContext';
import UnitEditor from './UnitEditor';
import IngestionWizard from './IngestionWizard';
import type { LearningUnit, Module } from '../courseTypes';
import { v4 as uuidv4 } from 'uuid';

const CourseEditor: React.FC = () => {
    const { course, updateLearningUnit, setCourse } = useCourseStore();
    const [editingUnit, setEditingUnit] = useState<LearningUnit | null>(null);
    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

    // מנגנון פשוט: מוודא שיש IDs לכולם פעם אחת בטעינה (בשביל ה-Key של ריאקט)
    useEffect(() => {
        if (!course?.syllabus) return;

        let hasChanges = false;
        const newSyllabus = JSON.parse(JSON.stringify(course.syllabus));

        newSyllabus.forEach((mod: Module) => {
            if (!mod.id) { mod.id = uuidv4(); hasChanges = true; }
            if (!mod.learningUnits) { mod.learningUnits = []; hasChanges = true; }

            mod.learningUnits.forEach((unit: LearningUnit) => {
                if (!unit.id) { unit.id = uuidv4(); hasChanges = true; }
            });
        });

        if (hasChanges) {
            setCourse({ ...course, syllabus: newSyllabus });
        }
    }, [course]);

    if (!course) return <div className="p-10 text-center">טוען...</div>;

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

    const handleShare = () => {
        const shareUrl = `${window.location.origin}/?studentCourseId=${course.id}`;
        navigator.clipboard.writeText(shareUrl).then(() => alert(`הקישור הועתק:\n${shareUrl}`));
    };

    const toggleMode = () => {
        const newMode = course.mode === 'exam' ? 'learning' : 'exam';
        setCourse({ ...course, mode: newMode });
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

    // פונקציות עריכה פשוטות (ללא ספריות)
    const addModuleAtIndex = (index: number) => {
        const newModule: Module = {
            id: uuidv4(),
            title: "פרק חדש",
            learningUnits: [{ id: uuidv4(), title: "יחידה ראשונה", type: "acquisition", baseContent: "...", activityBlocks: [] }]
        };
        const newSyllabus = [...course.syllabus];
        newSyllabus.splice(index, 0, newModule);
        setCourse({ ...course, syllabus: newSyllabus });
    };

    const addUnitAtIndex = (moduleIndex: number, unitIndex: number) => {
        const newUnit: LearningUnit = { id: uuidv4(), title: "יחידה חדשה", type: "acquisition", baseContent: "", activityBlocks: [] };
        const newSyllabus = JSON.parse(JSON.stringify(course.syllabus));
        if (!newSyllabus[moduleIndex].learningUnits) newSyllabus[moduleIndex].learningUnits = [];
        newSyllabus[moduleIndex].learningUnits.splice(unitIndex, 0, newUnit);
        setCourse({ ...course, syllabus: newSyllabus });
    };

    const deleteModule = (moduleId: string) => {
        if (confirm("למחוק את הפרק?")) {
            const newSyllabus = course.syllabus.filter(m => m.id !== moduleId);
            setCourse({ ...course, syllabus: newSyllabus });
        }
    };

    const updateModuleTitle = (moduleId: string, newTitle: string) => {
        const newSyllabus = course.syllabus.map(m => m.id === moduleId ? { ...m, title: newTitle } : m);
        setCourse({ ...course, syllabus: newSyllabus });
    };

    // הזזה פשוטה עם מערכים (בלי גרירה)
    const moveUnit = (modIdx: number, unitIdx: number, direction: 'left' | 'right') => {
        const newSyllabus = JSON.parse(JSON.stringify(course.syllabus));
        const units = newSyllabus[modIdx].learningUnits;

        if (direction === 'left' && unitIdx > 0) {
            [units[unitIdx], units[unitIdx - 1]] = [units[unitIdx - 1], units[unitIdx]];
        } else if (direction === 'right' && unitIdx < units.length - 1) {
            [units[unitIdx], units[unitIdx + 1]] = [units[unitIdx + 1], units[unitIdx]];
        }
        setCourse({ ...course, syllabus: newSyllabus });
    };

    const InsertModuleButton = ({ index }: { index: number }) => (
        <div className="relative py-6 group flex justify-center items-center">
            <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <button onClick={() => addModuleAtIndex(index)} className="relative z-10 bg-white text-indigo-600 border border-indigo-200 rounded-full px-6 py-1.5 text-sm font-bold shadow-sm opacity-50 hover:opacity-100 transition-all hover:bg-indigo-600 hover:text-white transform hover:scale-110 flex items-center gap-2"><span>+</span> הוסף פרק כאן</button>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto pb-20">
            {editingUnit ? (
                <UnitEditor unit={editingUnit} gradeLevel={course.targetAudience} onSave={handleSaveUnit} onCancel={() => setEditingUnit(null)} />
            ) : (
                <div className="space-y-2 animate-fade-in">

                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mb-8">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-3xl font-extrabold text-gray-900 leading-tight">{course.title}</h2>
                                <div className="flex gap-2 mt-2 text-sm text-gray-500"><span className="bg-gray-100 px-3 py-1 rounded-full">🎯 {course.targetAudience || 'כללי'}</span><span className="bg-gray-100 px-3 py-1 rounded-full">📚 {course.syllabus.length} פרקים</span></div>
                            </div>
                            <div className="flex flex-col gap-2 align-end"><button onClick={handleShare} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-green-700 text-sm flex items-center justify-center gap-2"><span>🔗</span> שתף לתלמיד</button></div>
                        </div>
                        <div className="border-t pt-4 mt-2 flex justify-between items-center">
                            <span className="text-gray-600 font-bold text-sm">מצב נוכחי:</span>
                            <button onClick={toggleMode} className={`px-6 py-2 rounded-full border font-bold transition-all flex items-center gap-2 shadow-sm ${course.mode === 'exam' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}>{course.mode === 'exam' ? '🛑 מצב מבחן' : '✅ מצב למידה'}</button>
                        </div>
                    </div>

                    <InsertModuleButton index={0} />

                    {course.syllabus.map((mod, mIdx) => (
                        <React.Fragment key={mod.id || mIdx}>
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative group/module">

                                <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                                    <div className="flex items-center gap-2 flex-1"><span className="text-indigo-500 opacity-50 font-bold">#{mIdx + 1}</span><input type="text" value={mod.title} onChange={(e) => updateModuleTitle(mod.id, e.target.value)} className="text-lg font-bold text-gray-800 bg-transparent border-b border-transparent focus:border-indigo-300 outline-none flex-1 hover:border-gray-300 transition-colors" /></div>
                                    <button onClick={() => deleteModule(mod.id)} className="text-gray-300 hover:text-red-500 p-2 rounded transition-colors opacity-0 group-hover/module:opacity-100">🗑️</button>
                                </div>

                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {(mod.learningUnits || []).map((unit, uIdx) => (
                                            <div key={unit.id || uIdx} className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-indigo-300 transition-all duration-200 flex flex-col h-full">
                                                <div className="mb-3 flex justify-between items-start">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${unit.type === 'acquisition' ? 'bg-blue-100 text-blue-700' : unit.type === 'practice' ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'}`}>{unit.type === 'acquisition' ? '📖 הקניה' : unit.type === 'practice' ? '✍️ תרגול' : '🧠 מבחן'}</span>

                                                    {/* כפתורי הזזה פשוטים (במקום גרירה) */}
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); moveUnit(mIdx, uIdx, 'left'); }} disabled={uIdx === 0} className="text-gray-400 hover:text-indigo-600 disabled:opacity-30 px-1 font-bold text-lg">‹</button>
                                                        <button onClick={(e) => { e.stopPropagation(); moveUnit(mIdx, uIdx, 'right'); }} disabled={uIdx === (mod.learningUnits.length - 1)} className="text-gray-400 hover:text-indigo-600 disabled:opacity-30 px-1 font-bold text-lg">›</button>
                                                    </div>
                                                </div>
                                                <h4 className="font-bold text-gray-900 mb-2 leading-tight">{unit.title}</h4>
                                                <p className="text-xs text-gray-500 line-clamp-3 mb-4 flex-1">{unit.baseContent}</p>
                                                <button onClick={() => handleEditUnit(unit, mod.id)} className="w-full py-2 rounded-lg bg-gray-50 text-indigo-600 text-sm font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors mt-auto relative z-10">ערוך יחידה ✏️</button>
                                            </div>
                                        ))}
                                        <button onClick={() => addUnitAtIndex(mIdx, (mod.learningUnits || []).length)} className="border-2 border-dashed border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center text-gray-400 hover:text-indigo-500 hover:border-indigo-300 transition-all cursor-pointer h-full min-h-[180px]"><span className="text-4xl mb-2">+</span><span className="text-sm font-bold">הוסף יחידה</span></button>
                                    </div>
                                </div>
                            </div>
                            <InsertModuleButton index={mIdx + 1} />
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CourseEditor;