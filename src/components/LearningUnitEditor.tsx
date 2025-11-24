import React, { useState, useEffect } from 'react';
import type { LearningUnit, ActivityBlock, ActivityBlockType } from '../types';

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

    // הוספת בלוק חדש (ריק) לפי סוג
    const addBlock = (type: ActivityBlockType) => {
        const newBlock: ActivityBlock = {
            id: Date.now().toString(),
            type: type,
            content: type === 'multiple-choice'
                ? { question: '', options: ['', '', '', ''], correctAnswer: '' }
                : type === 'open-question'
                    ? { question: '' }
                    : '', // טקסט/לינק ריק כברירת מחדל
            metadata: {}
        };

        setEditedUnit({
            ...editedUnit,
            activityBlocks: [...(editedUnit.activityBlocks || []), newBlock]
        });
    };

    // מחיקת בלוק
    const deleteBlock = (blockId: string) => {
        const newBlocks = editedUnit.activityBlocks.filter(b => b.id !== blockId);
        setEditedUnit({ ...editedUnit, activityBlocks: newBlocks });
    };

    // עדכון תוכן בלוק
    const updateBlock = (blockId: string, newContent: any) => {
        const newBlocks = editedUnit.activityBlocks.map(block =>
            block.id === blockId ? { ...block, content: newContent } : block
        );
        setEditedUnit({ ...editedUnit, activityBlocks: newBlocks });
    };

    return (
        <div className="bg-white border-2 border-blue-500 rounded-lg p-6 my-4 shadow-xl animate-fade-in">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="font-bold text-2xl text-blue-900">
                    🛠️ עורך יחידת לימוד
                </h3>
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">
                    {editedUnit.type === 'acquisition' ? 'הקניה' : editedUnit.type === 'practice' ? 'תרגול' : 'מבחן'}
                </div>
            </div>

            {/* 1. עריכת כותרת ותוכן ראשי */}
            <div className="mb-8 space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">כותרת השיעור</label>
                    <input
                        type="text"
                        value={editedUnit.title}
                        onChange={(e) => setEditedUnit({ ...editedUnit, title: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">טקסט פתיחה / הסבר ראשי</label>
                    <textarea
                        rows={4}
                        value={editedUnit.baseContent}
                        onChange={(e) => setEditedUnit({ ...editedUnit, baseContent: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* 2. אזור הבלוקים הדינמיים */}
            <div className="space-y-6">
                <h4 className="font-bold text-gray-800 border-b pb-2">🧩 רכיבי השיעור (בנייה מודולרית)</h4>

                {editedUnit.activityBlocks?.map((block, index) => (
                    <div key={block.id} className="relative bg-white p-5 rounded-lg border border-gray-300 shadow-sm group hover:border-blue-400 transition-all">

                        {/* כפתור מחיקה (מופיע רק במעבר עכבר) */}
                        <button
                            onClick={() => deleteBlock(block.id)}
                            className="absolute top-2 left-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="מחק רכיב"
                        >
                            🗑️
                        </button>

                        {/* תווית סוג הבלוק */}
                        <span className="absolute top-2 right-2 text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {block.type === 'text' && 'טקסט'}
                            {block.type === 'video' && 'וידאו (YouTube)'}
                            {block.type === 'image' && 'תמונה'}
                            {block.type === 'pdf' && 'קובץ PDF'}
                            {block.type === 'multiple-choice' && 'שאלה אמריקאית'}
                            {block.type === 'open-question' && 'שאלה פתוחה'}
                        </span>

                        <div className="mt-4">
                            {/* עורך עבור טקסט / וידאו / תמונה / PDF */}
                            {['text', 'video', 'image', 'pdf'].includes(block.type) && (
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">
                                        {block.type === 'text' ? 'תוכן הטקסט:' : 'הדבק כאן קישור (URL):'}
                                    </label>
                                    {block.type === 'text' ? (
                                        <textarea
                                            className="w-full p-2 border rounded"
                                            rows={3}
                                            value={block.content}
                                            onChange={(e) => updateBlock(block.id, e.target.value)}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded ltr text-left"
                                            value={block.content}
                                            placeholder="https://..."
                                            onChange={(e) => updateBlock(block.id, e.target.value)}
                                        />
                                    )}
                                </div>
                            )}

                            {/* עורך לשאלה אמריקאית */}
                            {block.type === 'multiple-choice' && (
                                <div>
                                    <input
                                        type="text"
                                        className="w-full font-bold p-2 border rounded bg-blue-50 mb-2"
                                        placeholder="הקלד את השאלה..."
                                        value={block.content.question}
                                        onChange={(e) => updateBlock(block.id, { ...block.content, question: e.target.value })}
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        {block.content.options?.map((opt: string, idx: number) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs ${block.content.correctAnswer === opt ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
                                                    {idx + 1}
                                                </span>
                                                <input
                                                    type="text"
                                                    className="flex-1 p-1 text-sm border rounded"
                                                    value={opt}
                                                    onChange={(e) => {
                                                        const newOptions = [...block.content.options];
                                                        newOptions[idx] = e.target.value;
                                                        updateBlock(block.id, { ...block.content, options: newOptions });
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* עורך לשאלה פתוחה */}
                            {block.type === 'open-question' && (
                                <div>
                                    <textarea
                                        className="w-full p-2 border rounded font-medium mb-2"
                                        rows={2}
                                        placeholder="השאלה לתלמיד..."
                                        value={block.content.question}
                                        onChange={(e) => updateBlock(block.id, { ...block.content, question: e.target.value })}
                                    />
                                    <textarea
                                        className="w-full p-2 border border-green-200 rounded text-sm bg-green-50"
                                        rows={2}
                                        placeholder="תשובת בית ספר (למורה)..."
                                        value={block.metadata?.modelAnswer || ''}
                                        onChange={(e) => {
                                            const newBlocks = editedUnit.activityBlocks.map(b =>
                                                b.id === block.id ? { ...b, metadata: { ...b.metadata, modelAnswer: e.target.value } } : b
                                            );
                                            setEditedUnit({ ...editedUnit, activityBlocks: newBlocks });
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* 3. סרגל הוספת רכיבים (ה-LEGO) */}
            <div className="mt-8 p-4 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 text-center">
                <span className="text-sm text-gray-500 block mb-3">➕ הוסף רכיב לשיעור:</span>
                <div className="flex flex-wrap justify-center gap-2">
                    <button onClick={() => addBlock('text')} className="px-3 py-2 bg-white border hover:bg-gray-50 rounded shadow-sm text-sm">📝 טקסט</button>
                    <button onClick={() => addBlock('image')} className="px-3 py-2 bg-white border hover:bg-gray-50 rounded shadow-sm text-sm">🖼️ תמונה</button>
                    <button onClick={() => addBlock('video')} className="px-3 py-2 bg-white border hover:bg-gray-50 rounded shadow-sm text-sm">▶️ וידאו</button>
                    <button onClick={() => addBlock('multiple-choice')} className="px-3 py-2 bg-white border hover:bg-gray-50 rounded shadow-sm text-sm">❓ שאלה אמריקאית</button>
                    <button onClick={() => addBlock('open-question')} className="px-3 py-2 bg-white border hover:bg-gray-50 rounded shadow-sm text-sm">✍️ שאלה פתוחה</button>
                    <button onClick={() => alert('בקרוב: AI יגנרט שאלות על התוכן הזה!')} className="px-3 py-2 bg-indigo-100 text-indigo-700 border border-indigo-200 hover:bg-indigo-200 rounded shadow-sm text-sm font-bold">✨ AI Generate</button>
                </div>
            </div>

            {/* כפתורי שמירה */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button onClick={onCancel} className="px-6 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">ביטול</button>
                <button onClick={() => onSave(editedUnit)} className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-bold shadow-lg">שמור שינויים</button>
            </div>
        </div>
    );
};

export default UnitEditor;