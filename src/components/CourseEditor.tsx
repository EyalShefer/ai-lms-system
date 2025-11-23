import React, { useState } from 'react';
import { useCourseStore } from '../context/CourseContext';
import UnitEditor from './UnitEditor';
import IngestionWizard from './IngestionWizard'; // <--- הנה ההזמנה של הקוסם
import type { LearningUnit } from '../types';

const CourseEditor: React.FC = () => {
    const { course, updateCourseTitle, updateLearningUnit } = useCourseStore();
    const [editingUnitId, setEditingUnitId] = useState<string | null>(null);

    const handleSaveUnit = (moduleId: string, updatedUnit: LearningUnit) => {
        updateLearningUnit(moduleId, updatedUnit);
        setEditingUnitId(null);
    };

    return (
        <div className="max-w-4xl mx-auto p-6">

            {/* --- כאן אנחנו מציגים את הקוסם על המסך --- */}
            <IngestionWizard />
            {/* ----------------------------------------- */}

            <div className="bg-white shadow-md rounded-lg p-6 mb-6 border-r-4 border-blue-500">
                <h2 className="text-xl font-bold text-gray-800 mb-4">הגדרות קורס</h2>
                <input
                    type="text"
                    value={course.title}
                    onChange={(e) => updateCourseTitle(e.target.value)}
                    className="w-full text-lg font-bold p-2 border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 outline-none transition-colors"
                />
                <p className="text-gray-500 mt-2">קהל יעד: {course.targetAudience}</p>
            </div>

            <div className="space-y-6">
                {course.syllabus.map((module) => (
                    <div key={module.id} className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-100 p-3 border-b border-gray-200">
                            <h3 className="font-bold text-gray-700">{module.title}</h3>
                        </div>

                        <div className="p-4 space-y-3">
                            {module.learningUnits.map((unit) => (
                                <div key={unit.id}>
                                    {editingUnitId === unit.id ? (
                                        <UnitEditor
                                            unit={unit}
                                            onSave={(updated) => handleSaveUnit(module.id, updated)}
                                            onCancel={() => setEditingUnitId(null)}
                                        />
                                    ) : (
                                        <div
                                            onClick={() => setEditingUnitId(unit.id)}
                                            className="group flex items-center bg-white p-3 rounded shadow-sm cursor-pointer hover:shadow-md hover:border-blue-300 border border-transparent transition-all"
                                        >
                                            <div className={`w-2 h-10 rounded ml-3 ${unit.type === 'acquisition' ? 'bg-green-400' :
                                                    unit.type === 'practice' ? 'bg-yellow-400' : 'bg-red-400'
                                                }`}></div>

                                            <div className="flex-1">
                                                <h4 className="font-medium text-gray-800 group-hover:text-blue-600">{unit.title}</h4>
                                                <p className="text-xs text-gray-500 truncate">{unit.baseContent}</p>
                                            </div>

                                            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                לחץ לעריכה ✎
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CourseEditor;