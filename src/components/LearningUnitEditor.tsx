import React, { useState, useEffect } from 'react';
import type { LearningUnit } from '../types';
import { useCourseStore } from '../context/CourseContext';

interface LearningUnitEditorProps {
    moduleId: string;
    unit: LearningUnit;
    onClose: () => void;
}

const LearningUnitEditor: React.FC<LearningUnitEditorProps> = ({ moduleId, unit, onClose }) => {
    const { updateLearningUnit } = useCourseStore();
    const [title, setTitle] = useState(unit.title);
    const [content, setContent] = useState(unit.baseContent);

    // Update local state when unit changes (e.g. if switching between units)
    useEffect(() => {
        setTitle(unit.title);
        setContent(unit.baseContent);
    }, [unit]);

    const handleSave = () => {
        updateLearningUnit(moduleId, unit.id, {
            title,
            baseContent: content
        });
        onClose(); // Optionally close or just show a success message
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200 mt-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">עריכת יחידת לימוד</h3>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700"
                >
                    ✕
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">כותרת היחידה</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">תוכן (Base Content)</label>
                    <textarea
                        rows={6}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                    >
                        ביטול
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm"
                    >
                        שמור שינויים
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LearningUnitEditor;
