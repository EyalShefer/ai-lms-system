import React, { useState, useEffect } from 'react';
import { useCourseStore } from '../context/CourseContext';
import UnitEditor from './UnitEditor';
import IngestionWizard from './IngestionWizard';
import type { LearningUnit, Module } from '../courseTypes';
import { v4 as uuidv4 } from 'uuid';

const CourseEditor: React.FC = () => {
    const { course, setCourse, updateCourseTitle } = useCourseStore();
    const [editingUnit, setEditingUnit] = useState<LearningUnit | null>(null);
    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

    // Data Sanitizer - רץ פעם אחת כדי להבטיח תקינות מבנה (IDs חסרים וכו')
    useEffect(() => {
        if (!course?.syllabus) return;
        const newSyllabus = JSON.parse(JSON.stringify(course.syllabus));
        let changed = false;

        newSyllabus.forEach((mod: Module) => {
            if (!mod.id) { mod.id = uuidv4(); changed = true; }
            if (!mod.learningUnits) { mod.learningUnits = []; changed = true; }
            mod.learningUnits.forEach((unit: LearningUnit) => {
                if (!unit.id) { unit.id = uuidv4(); changed = true; }
                // וידוא שקיים מערך activityBlocks
                if (!unit.activityBlocks) { unit.activityBlocks = []; changed = true; }
            });
        });

        if (changed) {
            console.log("Sanitizer fixed course structure");
            setCourse({ ...course, syllabus: newSyllabus });
        }
    }, [course]);

    // --- Handlers ---

    const handleAddModule = () => {
        const newModule: Module = {
            id: uuidv4(),
            title: "פרק חדש",
            learningUnits: []
        };
        const newSyllabus = [...(course.syllabus || []), newModule];
        setCourse({ ...course, syllabus: newSyllabus });
    };

    const handleDeleteModule = (moduleId: string) => {
        if (confirm("למחוק את הפרק וכל התוכן שבו?")) {
            const newSyllabus = course.syllabus.filter(m => m.id !== moduleId);
            setCourse({ ...course, syllabus: newSyllabus });
        }
    };

    const handleMoveModule = (index: number, direction: 'up' | 'down') => {
        const newSyllabus = [...course.syllabus];
        if (direction === 'up' && index > 0) {
            [newSyllabus[index], newSyllabus[index - 1]] = [newSyllabus[index - 1], newSyllabus[index]];
        } else if (direction === 'down' && index < newSyllabus.length - 1) {
            [newSyllabus[index], newSyllabus[index + 1]] = [newSyllabus[index + 1], newSyllabus[index]];
        }
        setCourse({ ...course, syllabus: newSyllabus });
    };

    const handleAddUnit = (moduleId: string) => {
        const newUnit: LearningUnit = {
            id: uuidv4(),
            title: "יחידה חדשה",
            type: 'acquisition',
            baseContent: "",
            activityBlocks: []
        };

        const newSyllabus = course.syllabus.map(mod => {
            if (mod.id === moduleId) {
                return { ...mod, learningUnits: [...mod.learningUnits, newUnit] };
            }
            return mod;
        });
        setCourse({ ...course, syllabus: newSyllabus });
        setEditingUnit(newUnit); // מעבר ישיר לעריכה
        setActiveModuleId(moduleId);
    };

    const handleDeleteUnit = (moduleId: string, unitId: string) => {
        if (confirm("למחוק את היחידה?")) {
            const newSyllabus = course.syllabus.map(mod => {
                if (mod.id === moduleId) {
                    return { ...mod, learningUnits: mod.learningUnits.filter(u => u.id !== unitId) };
                }
                return mod;
            });
            setCourse({ ...course, syllabus: newSyllabus });
        }
    };

    const handleMoveUnit = (moduleId: string, unitIndex: number, direction: 'up' | 'down') => {
        const newSyllabus = [...course.syllabus];
        const modIndex = newSyllabus.findIndex(m => m.id === moduleId);
        if (modIndex === -1) return;

        const units = [...newSyllabus[modIndex].learningUnits];
        if (direction === 'up' && unitIndex > 0) {
            [units[unitIndex], units[unitIndex - 1]] = [units[unitIndex - 1], units[unitIndex]];
        } else if (direction === 'down' && unitIndex < units.length - 1) {
            [units[unitIndex], units[unitIndex + 1]] = [units[unitIndex + 1], units[unitIndex]];
        }

        newSyllabus[modIndex].learningUnits = units;
        setCourse({ ...course, syllabus: newSyllabus });
    };

    const saveUnitChanges = (updatedUnit: LearningUnit) => {
        if (!activeModuleId) return;

        const newSyllabus = course.syllabus.map(mod => {
            if (mod.id === activeModuleId) {
                return {
                    ...mod,
                    learningUnits: mod.learningUnits.map(u => u.id === updatedUnit.id ? updatedUnit : u)
                };
            }
            return mod;
        });

        setCourse({ ...course, syllabus: newSyllabus });
        setEditingUnit(null); // סגירת העורך
        setActiveModuleId(null);
    };

    // --- Render ---

    if (!course) return <div className="p-10 text-center">טוען נתונים...</div>;

    // אם אין תוכן (סילבוס ריק) - מציגים את הוויזארד
    if (!course.syllabus || course.syllabus.length === 0) {
        return <IngestionWizard />;
    }

    // אם עורכים יחידה כרגע - מציגים את עורך היחידות
    if (editingUnit) {
        return (
            <UnitEditor
                unit={editingUnit}
                gradeLevel={course.targetAudience}
                onSave={saveUnitChanges}
                onCancel={() => setEditingUnit(null)}
            />
        );
    }

    // מסך ראשי - עריכת מבנה הקורס (סילבוס)
    return (
        <div className="max-w-4xl mx-auto p-6 font-sans">
            <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">שם המערך</label>
                <input
                    type="text"
                    value={course.title}
                    onChange={(e) => updateCourseTitle(e.target.value)}
                    className="text-3xl font-bold text-gray-800 w-full outline-none border-b-2 border-transparent focus:border-indigo-500 transition-colors bg-transparent"
                />
                <div className="mt-2 flex gap-4 text-sm text-gray-500">
                    <span>קהל יעד: <b>{course.targetAudience}</b></span>
                    <span>•</span>
                    <span>מצב: <b>{course.mode === 'exam' ? 'מבחן' : 'למידה'}</b></span>
                </div>
            </div>

            <div className="space-y-6">
                {course.syllabus.map((mod, mIdx) => (
                    <div key={mod.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all hover:shadow-md">
                        {/* כותרת הפרק */}
                        <div className="bg-gray-50 p-4 flex justify-between items-center border-b border-gray-100">
                            <div className="flex items-center gap-3 flex-1">
                                <div className="flex flex-col gap-1">
                                    <button onClick={() => handleMoveModule(mIdx, 'up')} disabled={mIdx === 0} className="text-gray-400 hover:text-indigo-600 disabled:opacity-20 text-xs">▲</button>
                                    <button onClick={() => handleMoveModule(mIdx, 'down')} disabled={mIdx === course.syllabus.length - 1} className="text-gray-400 hover:text-indigo-600 disabled:opacity-20 text-xs">▼</button>
                                </div>
                                <input
                                    type="text"
                                    value={mod.title}
                                    onChange={(e) => {
                                        const newSyllabus = [...course.syllabus];
                                        newSyllabus[mIdx].title = e.target.value;
                                        setCourse({ ...course, syllabus: newSyllabus });
                                    }}
                                    className="font-bold text-lg bg-transparent outline-none text-gray-800 w-full"
                                />
                            </div>
                            <button onClick={() => handleDeleteModule(mod.id)} className="text-gray-400 hover:text-red-500 p-2">🗑️</button>
                        </div>

                        {/* רשימת היחידות */}
                        <div className="p-2 space-y-2">
                            {mod.learningUnits.map((unit, uIdx) => (
                                <div key={unit.id} className="flex items-center justify-between p-3 bg-white hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 group transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleMoveUnit(mod.id, uIdx, 'up')} disabled={uIdx === 0} className="text-gray-400 hover:text-indigo-600 text-[10px]">▲</button>
                                            <button onClick={() => handleMoveUnit(mod.id, uIdx, 'down')} disabled={uIdx === mod.learningUnits.length - 1} className="text-gray-400 hover:text-indigo-600 text-[10px]">▼</button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${unit.type === 'acquisition' ? 'bg-blue-400' : unit.type === 'practice' ? 'bg-yellow-400' : 'bg-red-400'}`}></span>
                                            <span className="text-sm font-medium text-gray-700">{unit.title}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setEditingUnit(unit); setActiveModuleId(mod.id); }}
                                            className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-md font-bold hover:bg-indigo-100 transition-colors"
                                        >
                                            ערוך תוכן ✏️
                                        </button>
                                        <button onClick={() => handleDeleteUnit(mod.id, unit.id)} className="text-gray-300 hover:text-red-500 px-2 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={() => handleAddUnit(mod.id)}
                                className="w-full py-2 text-xs font-bold text-gray-400 hover:text-indigo-600 hover:bg-gray-50 rounded-lg border-2 border-dashed border-gray-100 hover:border-indigo-100 transition-all flex items-center justify-center gap-1"
                            >
                                <span>+</span> הוסף יחידת לימוד
                            </button>
                        </div>
                    </div>
                ))}

                <button
                    onClick={handleAddModule}
                    className="w-full py-4 bg-gray-800 text-white rounded-xl font-bold shadow-lg hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
                >
                    <span>+</span> הוסף פרק חדש
                </button>
            </div>
        </div>
    );
};

export default CourseEditor;