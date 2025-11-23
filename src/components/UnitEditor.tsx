import React, { useState, useEffect } from 'react';
import type { LearningUnit } from '../types';

interface UnitEditorProps {
    unit: LearningUnit;
    onSave: (updatedUnit: LearningUnit) => void;
    onCancel: () => void;
}

const UnitEditor: React.FC<UnitEditorProps> = ({ unit, onSave, onCancel }) => {
    const [editedUnit, setEditedUnit] = useState<LearningUnit>(unit);

    useEffect(() => {
        setEditedUnit(unit);
    }, [unit]);

    return (
        <div className="bg-white border-2 border-blue-500 rounded-lg p-4 my-2 shadow-lg animate-fade-in">
            <h3 className="font-bold text-blue-700 mb-2">עריכת יחידה: {unit.title}</h3>

            <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">כותרת</label>
                <input
                    type="text"
                    value={editedUnit.title}
                    onChange={(e) => setEditedUnit({ ...editedUnit, title: e.target.value })}
                    className="w-full p-2 border rounded focus:outline-none focus:border-blue-500"
                />
            </div>

            <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">תוכן (Base Content)</label>
                <textarea
                    rows={4}
                    value={editedUnit.baseContent}
                    onChange={(e) => setEditedUnit({ ...editedUnit, baseContent: e.target.value })}
                    className="w-full p-2 border rounded focus:outline-none focus:border-blue-500"
                />
            </div>

            <div className="flex justify-end gap-2">
                <button
                    onClick={onCancel}
                    className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                    ביטול
                </button>
                <button
                    onClick={() => onSave(editedUnit)}
                    className="px-3 py-1 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
                >
                    שמור
                </button>
            </div>
        </div>
    );
};

export default UnitEditor;
