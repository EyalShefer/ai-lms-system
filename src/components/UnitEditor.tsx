import React, { useState, useEffect } from 'react';
import type { LearningUnit, ActivityBlock, ActivityBlockType } from '../courseTypes';
import { generateImagePromptBlock, generateQuestionsFromText, refineContentWithPedagogy } from '../gemini';

interface UnitEditorProps {
    unit: LearningUnit;
    onSave: (updatedUnit: LearningUnit) => void;
    onCancel: () => void;
}

const PEDAGOGICAL_SKILLS = [
    "חשיבה ביקורתית", "יצירתיות ודמיון", "פרספקטיבה ואמפתיה",
    "אוריינות מידע", "פשטות ובהירות", "טיעון ונימוק"
];

const UnitEditor: React.FC<UnitEditorProps> = ({ unit, onSave, onCancel }) => {
    const [editedUnit, setEditedUnit] = useState<LearningUnit>(unit);
    const [loadingBlockId, setLoadingBlockId] = useState<string | null>(null);
    const [selectedSkill, setSelectedSkill] = useState<Record<string, string>>({});

    useEffect(() => { setEditedUnit(unit); }, [unit]);

    const addBlock = (type: ActivityBlockType) => {
        const newBlock: ActivityBlock = {
            id: Date.now().toString(),
            type: type,
            content: type === 'multiple-choice'
                ? { question: '', options: ['', '', '', ''], correctAnswer: '' }
                : type === 'open-question' ? { question: '' }
                    : type === 'gem-link' ? { title: 'משימת דיאלוג', url: '', instructions: '' }
                        : '',
            metadata: { aiPrompt: '' } // אתחול שדה הפרומפט
        };
        setEditedUnit({ ...editedUnit, activityBlocks: [...(editedUnit.activityBlocks || []), newBlock] });
        setTimeout(() => {
            const el = document.getElementById('end-of-blocks');
            el?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const deleteBlock = (blockId: string) => {
        if (confirm("למחוק?")) {
            setEditedUnit({ ...editedUnit, activityBlocks: editedUnit.activityBlocks.filter(b => b.id !== blockId) });
        }
    };

    const moveBlock = (index: number, direction: 'up' | 'down') => {
        const newBlocks = [...editedUnit.activityBlocks];
        if (direction === 'up' && index > 0) {
            [newBlocks[index], newBlocks[index - 1]] = [newBlocks[index - 1], newBlocks[index]];
        } else if (direction === 'down' && index < newBlocks.length - 1) {
            [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
        }
        setEditedUnit({ ...editedUnit, activityBlocks: newBlocks });
    };

    const updateBlock = (blockId: string, newContent: any, newMetadata?: any) => {
        setEditedUnit({
            ...editedUnit,
            activityBlocks: editedUnit.activityBlocks.map(block =>
                block.id === blockId ? { ...block, content: newContent, metadata: newMetadata || block.metadata } : block
            )
        });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, blockId: string) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => updateBlock(blockId, reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    // --- AI Functions ---

    // 1. הצעת פרומפט לתמונה (רק טקסט)
    const handleSuggestImagePrompt = async (blockId: string) => {
        setLoadingBlockId(blockId);
        try {
            const prompt = await generateImagePromptBlock(editedUnit.baseContent);
            // מעדכנים רק את שדה ה-metadata.aiPrompt כדי שהמשתמש יראה ויערוך
            const block = editedUnit.activityBlocks.find(b => b.id === blockId);
            if (block) {
                updateBlock(blockId, block.content, { ...block.metadata, aiPrompt: prompt });
            }
        } catch (e) { alert("שגיאה ביצירת תיאור"); } finally { setLoadingBlockId(null); }
    };

    // 2. ציור התמונה בפועל (לפי מה שכתוב בתיבה)
    const handlePaintImage = (blockId: string, promptText: string) => {
        if (!promptText) return alert("התיאור ריק! כתוב משהו או בקש מה-AI להציע.");

        setLoadingBlockId(blockId);
        const safePrompt = encodeURIComponent(promptText.replace(/[^\w\s,.]/gi, '')); // ניקוי בסיסי
        const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=800&height=600&nologo=true&seed=${Math.random()}`;

        // עדכון התמונה והפרומפט
        updateBlock(blockId, imageUrl, { aiPrompt: promptText });
        setLoadingBlockId(null);
    };

    const handleGenerateQuestions = async (blockId: string, text: string, type: 'multiple-choice' | 'open-question') => {
        if (!text || text.length < 10) return alert("חסר טקסט");
        setLoadingBlockId(blockId);
        try {
            const questions = await generateQuestionsFromText(text, type);
            const newBlocks: ActivityBlock[] = questions.map((q: any) => {
                if (type === 'multiple-choice') {
                    return {
                        id: `gen-${Date.now()}-${Math.random()}`,
                        type: 'multiple-choice',
                        content: { question: q.question, options: q.options || ["", "", "", ""], correctAnswer: q.correctAnswer || "" },
                        metadata: {}
                    };
                } else {
                    return {
                        id: `gen-${Date.now()}-${Math.random()}`,
                        type: 'open-question',
                        content: { question: q.question },
                        metadata: { modelAnswer: q.modelAnswer }
                    };
                }
            });
            const idx = editedUnit.activityBlocks.findIndex(b => b.id === blockId);
            const updated = [...editedUnit.activityBlocks];
            updated.splice(idx + 1, 0, ...newBlocks);
            setEditedUnit({ ...editedUnit, activityBlocks: updated });
        } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); }
    };

    const handleRefineText = async (blockId: string, text: string) => {
        if (!selectedSkill[blockId]) return alert("בחר מיומנות");
        setLoadingBlockId(blockId);
        try {
            const res = await refineContentWithPedagogy(text, selectedSkill[blockId]);
            updateBlock(blockId, res);
        } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); }
    };

    const getYoutubeId = (url: string) => {
        if (!url) return null;
        const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    return (
        <div className="bg-white border-2 border-blue-500 rounded-lg p-6 my-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4 sticky top-0 bg-white z-20">
                <h3 className="font-bold text-2xl text-blue-900">🛠️ עורך יחידה</h3>
                <div className="flex gap-2">
                    <button onClick={onCancel} className="px-4 py-1 bg-gray-100 rounded hover:bg-gray-200 text-gray-700">ביטול</button>
                    <button onClick={() => onSave(editedUnit)} className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 shadow">שמור</button>
                </div>
            </div>

            <div className="mb-8 space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <input type="text" value={editedUnit.title} onChange={(e) => setEditedUnit({ ...editedUnit, title: e.target.value })} className="w-full p-2 border rounded font-bold text-lg" placeholder="כותרת השיעור" />
                <textarea rows={3} value={editedUnit.baseContent} onChange={(e) => setEditedUnit({ ...editedUnit, baseContent: e.target.value })} className="w-full p-2 border rounded" placeholder="הסבר ראשי..." />
            </div>

            <div className="space-y-6 pb-10">
                {editedUnit.activityBlocks?.map((block, index) => (
                    <div key={block.id} className="relative bg-white p-5 rounded-lg border border-gray-300 shadow-sm hover:border-blue-400 transition-all group">
                        <div className="absolute top-2 left-2 flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity bg-white p-1 rounded border shadow-sm z-10">
                            <button onClick={() => moveBlock(index, 'up')} disabled={index === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">⬆️</button>
                            <button onClick={() => moveBlock(index, 'down')} disabled={index === (editedUnit.activityBlocks.length - 1)} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">⬇️</button>
                            <div className="w-px bg-gray-300 mx-1"></div>
                            <button onClick={() => deleteBlock(block.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">🗑️</button>
                        </div>
                        <span className="absolute top-2 right-2 text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">{block.type}</span>

                        <div className="mt-8">
                            {block.type === 'text' && (
                                <div>
                                    <textarea className="w-full p-2 border rounded mb-2" rows={4} value={block.content || ''} onChange={(e) => updateBlock(block.id, e.target.value)} />
                                    <div className="flex flex-wrap items-center gap-2 bg-purple-50 p-2 rounded border border-purple-100">
                                        <select className="text-xs p-1 rounded border border-purple-200" value={selectedSkill[block.id] || ""} onChange={(e) => setSelectedSkill({ ...selectedSkill, [block.id]: e.target.value })}>
                                            <option value="">מיומנות...</option>
                                            {PEDAGOGICAL_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <button onClick={() => handleRefineText(block.id, block.content)} disabled={loadingBlockId === block.id || !selectedSkill[block.id]} className="text-xs bg-purple-600 text-white px-2 py-1 rounded">שכתב</button>
                                        <div className="border-l border-purple-300 h-4 mx-1"></div>
                                        <button onClick={() => handleGenerateQuestions(block.id, block.content, 'multiple-choice')} className="text-xs bg-white text-blue-700 border border-blue-200 px-2 py-1 rounded">❓ שאלה</button>
                                        <button onClick={() => handleGenerateQuestions(block.id, block.content, 'open-question')} className="text-xs bg-white text-green-700 border border-green-200 px-2 py-1 rounded">✍️ פתוחה</button>
                                    </div>
                                </div>
                            )}

                            {/* --- עורך התמונה החדש: עם שליטה מלאה --- */}
                            {block.type === 'image' && (
                                <div>
                                    <div className="flex gap-2 mb-2">
                                        <input type="text" className="flex-1 p-2 border rounded ltr text-left" value={typeof block.content === 'string' && block.content.startsWith('http') ? block.content : ''} placeholder="לינק לתמונה..." onChange={(e) => updateBlock(block.id, e.target.value)} />
                                        <label className="px-2 py-1 bg-gray-200 rounded cursor-pointer text-xs font-bold pt-2">📂<input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, block.id)} /></label>
                                    </div>

                                    {block.content && typeof block.content === 'string' && <img src={block.content} className="max-h-40 rounded shadow-sm mx-auto mb-2" onError={(e) => (e.currentTarget.src = 'https://placehold.co/600x400?text=No+Image')} />}

                                    {/* אזור ה-AI לתמונה */}
                                    <div className="bg-indigo-50 p-3 rounded border border-indigo-100">
                                        <label className="text-xs font-bold text-indigo-800 block mb-1">הנחיה ל-AI (ערוך חופשי):</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                className="flex-1 p-2 border rounded text-sm"
                                                placeholder="תאר את התמונה שאתה רוצה..."
                                                value={block.metadata?.aiPrompt || ''}
                                                onChange={(e) => updateBlock(block.id, block.content, { ...block.metadata, aiPrompt: e.target.value })}
                                            />
                                            <button
                                                onClick={() => handleSuggestImagePrompt(block.id)}
                                                disabled={loadingBlockId === block.id}
                                                className="bg-white text-indigo-600 border border-indigo-200 px-3 py-1 rounded text-xs hover:bg-indigo-50"
                                            >
                                                💡 הצע
                                            </button>
                                            <button
                                                onClick={() => handlePaintImage(block.id, block.metadata?.aiPrompt || '')}
                                                disabled={loadingBlockId === block.id}
                                                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-1 rounded text-xs font-bold shadow hover:opacity-90"
                                            >
                                                {loadingBlockId === block.id ? 'מצייר...' : '🎨 צייר!'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {block.type === 'video' && (
                                <div>
                                    <input type="text" className="w-full p-2 border rounded ltr text-left" value={block.content || ''} placeholder="YouTube URL..." onChange={(e) => updateBlock(block.id, e.target.value)} />
                                    {getYoutubeId(block.content) && <div className="aspect-video bg-black rounded mt-2"><iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${getYoutubeId(block.content)}`} frameBorder="0" allowFullScreen></iframe></div>}
                                </div>
                            )}
                            {block.type === 'multiple-choice' && (
                                <div className="bg-blue-50 p-3 rounded border border-blue-100">
                                    <input type="text" className="w-full font-bold p-2 border rounded bg-white mb-2" value={block.content.question} onChange={(e) => updateBlock(block.id, { ...block.content, question: e.target.value })} />
                                    <div className="grid grid-cols-2 gap-2">
                                        {block.content.options?.map((opt: string, idx: number) => (
                                            <div key={idx} className="flex items-center gap-1">
                                                <button onClick={() => updateBlock(block.id, { ...block.content, correctAnswer: opt })} className={`w-5 h-5 rounded-full border text-[10px] ${block.content.correctAnswer === opt ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>✓</button>
                                                <input type="text" className="flex-1 p-1 text-sm border rounded" value={opt} onChange={(e) => { const newOptions = [...block.content.options]; newOptions[idx] = e.target.value; const newContent = { ...block.content, options: newOptions }; if (block.content.correctAnswer === opt) newContent.correctAnswer = e.target.value; updateBlock(block.id, newContent); }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {block.type === 'open-question' && (
                                <div className="bg-green-50 p-3 rounded border border-green-100">
                                    <textarea className="w-full p-2 border rounded bg-white mb-2" value={block.content.question} onChange={(e) => updateBlock(block.id, { ...block.content, question: e.target.value })} />
                                    <label className="text-xs text-green-700 font-bold">תשובת מורה:</label>
                                    <textarea className="w-full p-2 border border-green-200 rounded text-sm bg-white" value={block.metadata?.modelAnswer || ''} onChange={(e) => updateBlock(block.id, block.content, { ...block.metadata, modelAnswer: e.target.value })} />
                                </div>
                            )}
                            {block.type === 'gem-link' && (
                                <div className="bg-purple-50 p-3 rounded border border-purple-200">
                                    <input type="text" className="w-full p-2 border rounded mb-1 font-bold" value={block.content.title} onChange={(e) => updateBlock(block.id, { ...block.content, title: e.target.value })} placeholder="כותרת" />
                                    <input type="text" className="w-full p-2 border rounded mb-1 ltr text-left" value={block.content.url} onChange={(e) => updateBlock(block.id, { ...block.content, url: e.target.value })} placeholder="Link..." />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div id="end-of-blocks"></div>
            </div>

            <div className="sticky bottom-0 bg-white p-4 border-t shadow-lg flex flex-wrap justify-center gap-3 z-20">
                <button onClick={() => addBlock('text')} className="btn-tool">📝 טקסט</button>
                <button onClick={() => addBlock('image')} className="btn-tool">🖼️ תמונה</button>
                <button onClick={() => addBlock('video')} className="btn-tool">▶️ וידאו</button>
                <button onClick={() => addBlock('multiple-choice')} className="btn-tool">❓ אמריקאית</button>
                <button onClick={() => addBlock('open-question')} className="btn-tool">✍️ פתוחה</button>
                <button onClick={() => addBlock('gem-link')} className="btn-tool text-purple-700 bg-purple-50 border-purple-200">💎 Gem</button>
            </div>
            <style>{` .btn-tool { @apply px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium hover:bg-gray-50 hover:-translate-y-1 transition-all; } `}</style>
        </div>
    );
};

export default UnitEditor;