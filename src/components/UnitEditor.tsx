import React, { useState, useEffect } from 'react';
import type { LearningUnit, ActivityBlock, ActivityBlockType } from '../types';
import { generateImagePromptBlock, generateQuestionsFromText, refineContentWithPedagogy } from '../gemini';

interface UnitEditorProps {
    unit: LearningUnit;
    onSave: (updatedUnit: LearningUnit) => void;
    onCancel: () => void;
}

// רשימת המיומנויות
const PEDAGOGICAL_SKILLS = [
    "חשיבה ביקורתית (Critical Thinking)",
    "יצירתיות ודמיון (Creativity)",
    "פרספקטיבה ואמפתיה (Empathy)",
    "אוריינות מידע וחקר (Inquiry)",
    "פשטות ובהירות (Simplification)",
    "טיעון ונימוק (Argumentation)"
];

const UnitEditor: React.FC<UnitEditorProps> = ({ unit, onSave, onCancel }) => {
    const [editedUnit, setEditedUnit] = useState<LearningUnit>(unit);
    const [loadingBlockId, setLoadingBlockId] = useState<string | null>(null);

    // משתנה ששומר איזו מיומנות נבחרה עבור כל בלוק
    const [selectedSkill, setSelectedSkill] = useState<Record<string, string>>({});

    useEffect(() => {
        setEditedUnit(unit);
    }, [unit]);

    const addBlock = (type: ActivityBlockType) => {
        const newBlock: ActivityBlock = {
            id: Date.now().toString(),
            type: type,
            content: type === 'multiple-choice'
                ? { question: '', options: ['', '', '', ''], correctAnswer: '' }
                : type === 'open-question' ? { question: '' }
                    : type === 'gem-link' ? { title: 'משימת דיאלוג', url: '', instructions: '' }
                        : '',
            metadata: {}
        };
        setEditedUnit({ ...editedUnit, activityBlocks: [...(editedUnit.activityBlocks || []), newBlock] });
    };

    const deleteBlock = (blockId: string) => {
        setEditedUnit({ ...editedUnit, activityBlocks: editedUnit.activityBlocks.filter(b => b.id !== blockId) });
    };

    const updateBlock = (blockId: string, newContent: any, newMetadata?: any) => {
        setEditedUnit({
            ...editedUnit,
            activityBlocks: editedUnit.activityBlocks.map(block =>
                block.id === blockId ? { ...block, content: newContent, metadata: newMetadata || block.metadata } : block
            )
        });
    };

    // --- AI Functions ---

    const handleGenerateImagePrompt = async (blockId: string) => {
        setLoadingBlockId(blockId);
        try {
            const prompt = await generateImagePromptBlock(editedUnit.baseContent);
            const block = editedUnit.activityBlocks.find(b => b.id === blockId);
            if (block) updateBlock(blockId, block.content, { ...block.metadata, aiPrompt: prompt });
        } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); }
    };

    const handleGenerateQuestionsFromText = async (textBlockId: string, textContent: string) => {
        if (!textContent || textContent.length < 10) return alert("חסר טקסט");
        setLoadingBlockId(textBlockId);
        try {
            const newQuestions = await generateQuestionsFromText(textContent);
            const newBlocks = newQuestions.map(q => ({
                id: Date.now().toString() + Math.random(),
                type: 'multiple-choice' as ActivityBlockType,
                content: q,
                metadata: {}
            }));
            const idx = editedUnit.activityBlocks.findIndex(b => b.id === textBlockId);
            const updated = [...editedUnit.activityBlocks];
            updated.splice(idx + 1, 0, ...newBlocks);
            setEditedUnit({ ...editedUnit, activityBlocks: updated });
            alert(`✨ נוספו ${newQuestions.length} שאלות!`);
        } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); }
    };

    // שכתוב פדגוגי
    const handleRefineText = async (blockId: string, currentText: string) => {
        const skill = selectedSkill[blockId];
        if (!skill) return alert("אנא בחר מיומנות מהרשימה");

        setLoadingBlockId(blockId);
        try {
            const refinedText = await refineContentWithPedagogy(currentText, skill);
            updateBlock(blockId, refinedText);
        } catch (e) {
            alert("שגיאה בשכתוב");
        } finally {
            setLoadingBlockId(null);
        }
    };

    // Youtube Helper
    const getYoutubeId = (url: string) => {
        if (!url) return null;
        const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    return (
        <div className="bg-white border-2 border-blue-500 rounded-lg p-6 my-4 shadow-xl animate-fade-in max-h-[90vh] overflow-y-auto">

            <div className="flex justify-between items-center mb-6 border-b pb-4 sticky top-0 bg-white z-10">
                <h3 className="font-bold text-2xl text-blue-900">🛠️ עורך יחידה</h3>
                <div className="flex gap-2">
                    <button onClick={onCancel} className="px-4 py-1 bg-gray-100 rounded hover:bg-gray-200 text-gray-700">ביטול</button>
                    <button onClick={() => onSave(editedUnit)} className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 shadow">שמור</button>
                </div>
            </div>

            <div className="mb-8 space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">כותרת השיעור</label>
                    <input type="text" value={editedUnit.title} onChange={(e) => setEditedUnit({ ...editedUnit, title: e.target.value })} className="w-full p-2 border rounded font-bold text-lg" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">תוכן פתיחה</label>
                    <textarea rows={3} value={editedUnit.baseContent} onChange={(e) => setEditedUnit({ ...editedUnit, baseContent: e.target.value })} className="w-full p-2 border rounded" />
                </div>
            </div>

            <div className="space-y-6 pb-10">
                <h4 className="font-bold text-gray-800 border-b pb-2">🧩 רכיבי התוכן</h4>

                {editedUnit.activityBlocks?.map((block) => (
                    <div key={block.id} className="relative bg-white p-5 rounded-lg border border-gray-300 shadow-sm group hover:border-blue-400 transition-all">
                        <button onClick={() => deleteBlock(block.id)} className="absolute top-2 left-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1">🗑️</button>
                        <span className="absolute top-2 right-2 text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">{block.type}</span>

                        <div className="mt-4">

                            {/* --- כאן נמצא התיקון החשוב: עורך טקסט עם מטה הקסם --- */}
                            {block.type === 'text' && (
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">תוכן הטקסט:</label>
                                    <textarea className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-100 mb-2" rows={4} value={block.content} onChange={(e) => updateBlock(block.id, e.target.value)} />

                                    {/* --- סרגל הכלים הסגול --- */}
                                    <div className="flex flex-wrap items-center gap-2 bg-purple-50 p-3 rounded border border-purple-100 shadow-sm">
                                        <span className="text-sm font-bold text-purple-800">✨ מטה הקסם:</span>

                                        <select
                                            className="text-sm p-1 rounded border border-purple-200 flex-1"
                                            value={selectedSkill[block.id] || ""}
                                            onChange={(e) => setSelectedSkill({ ...selectedSkill, [block.id]: e.target.value })}
                                        >
                                            <option value="">בחר מיומנות לחיזוק...</option>
                                            {PEDAGOGICAL_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>

                                        <button
                                            onClick={() => handleRefineText(block.id, block.content)}
                                            disabled={loadingBlockId === block.id || !selectedSkill[block.id]}
                                            className="text-sm bg-purple-600 text-white px-4 py-1 rounded hover:bg-purple-700 disabled:bg-gray-300 transition-colors font-bold"
                                        >
                                            {loadingBlockId === block.id ? 'משכתב...' : 'שכתב'}
                                        </button>

                                        <div className="border-l border-purple-200 h-6 mx-2"></div>

                                        <button
                                            onClick={() => handleGenerateQuestionsFromText(block.id, block.content)}
                                            disabled={loadingBlockId === block.id}
                                            className="text-sm bg-white text-purple-700 border border-purple-200 px-3 py-1 rounded hover:bg-purple-100"
                                        >
                                            {loadingBlockId === block.id ? '...' : 'צור שאלות'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {block.type === 'image' && (
                                <div>
                                    <input type="text" className="w-full p-2 border rounded mb-2 ltr text-left" value={block.content} placeholder="URL..." onChange={(e) => updateBlock(block.id, e.target.value)} />
                                    {block.content && <img src={block.content} className="max-h-40 rounded shadow-sm" />}
                                    <div className="bg-indigo-50 p-2 rounded mt-2 flex justify-between items-center">
                                        <span className="text-xs text-indigo-700">עזרה ביצירת תמונה:</span>
                                        <button onClick={() => handleGenerateImagePrompt(block.id)} disabled={loadingBlockId === block.id} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">{loadingBlockId === block.id ? '...' : 'הצע תיאור'}</button>
                                    </div>
                                    {block.metadata?.aiPrompt && <textarea readOnly className="w-full p-2 text-xs border rounded bg-white text-gray-600 italic mt-2" rows={2} value={block.metadata.aiPrompt} />}
                                </div>
                            )}

                            {block.type === 'video' && (
                                <div>
                                    <input type="text" className="w-full p-2 border rounded ltr text-left" value={block.content} placeholder="YouTube URL..." onChange={(e) => updateBlock(block.id, e.target.value)} />
                                    {getYoutubeId(block.content) && <div className="aspect-video bg-black rounded mt-2"><iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${getYoutubeId(block.content)}`} frameBorder="0" allowFullScreen></iframe></div>}
                                </div>
                            )}

                            {block.type === 'multiple-choice' && (
                                <div className="bg-blue-50 p-3 rounded">
                                    <input type="text" className="w-full font-bold p-2 border rounded bg-white mb-2" value={block.content.question} onChange={(e) => updateBlock(block.id, { ...block.content, question: e.target.value })} />
                                    <div className="grid grid-cols-2 gap-2">
                                        {block.content.options?.map((opt: string, idx: number) => (
                                            <input key={idx} type="text" className="flex-1 p-1 text-sm border rounded" value={opt} onChange={(e) => { const newOptions = [...block.content.options]; newOptions[idx] = e.target.value; updateBlock(block.id, { ...block.content, options: newOptions }); }} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {block.type === 'open-question' && (
                                <div className="bg-purple-50 p-3 rounded">
                                    <textarea className="w-full p-2 border rounded mb-2" rows={2} value={block.content.question} onChange={(e) => updateBlock(block.id, { ...block.content, question: e.target.value })} />
                                    <textarea className="w-full p-2 border border-green-200 rounded text-sm bg-green-50" rows={2} placeholder="תשובת בית ספר..." value={block.metadata?.modelAnswer || ''} onChange={(e) => updateBlock(block.id, block.content, { ...block.metadata, modelAnswer: e.target.value })} />
                                </div>
                            )}

                            {block.type === 'gem-link' && (
                                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded">
                                    <input type="text" className="w-full p-2 border rounded mb-2 font-bold" value={block.content.title} onChange={(e) => updateBlock(block.id, { ...block.content, title: e.target.value })} />
                                    <textarea className="w-full p-2 border rounded bg-white" rows={2} value={block.content.instructions} onChange={(e) => updateBlock(block.id, { ...block.content, instructions: e.target.value })} />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="sticky bottom-0 bg-gray-100 p-4 rounded-t-xl border-t-2 border-blue-200 shadow-lg flex flex-wrap justify-center gap-3 z-20">
                <button onClick={() => addBlock('text')} className="btn-tool">📝 טקסט</button>
                <button onClick={() => addBlock('image')} className="btn-tool">🖼️ תמונה</button>
                <button onClick={() => addBlock('video')} className="btn-tool">▶️ וידאו</button>
                <button onClick={() => addBlock('multiple-choice')} className="btn-tool">❓ אמריקאית</button>
                <button onClick={() => addBlock('open-question')} className="btn-tool">✍️ פתוחה</button>
                <button onClick={() => addBlock('gem-link')} className="btn-tool text-purple-700 bg-purple-50 border-purple-200">💎 AI Gem</button>
            </div>

            <style>{` .btn-tool { @apply px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium hover:bg-gray-50 hover:-translate-y-1 transition-all; } `}</style>
        </div>
    );
};

export default UnitEditor;