import React, { useState, useEffect } from 'react';
import type { LearningUnit, ActivityBlock, ActivityBlockType } from '../courseTypes';
import { generateImagePromptBlock, generateQuestionsFromText, refineContentWithPedagogy } from '../gemini';
import { uploadMediaFile } from '../firebaseUtils';
import { v4 as uuidv4 } from 'uuid';
import { useCourseStore } from '../context/CourseContext'; // ייבוא ה-Store כדי לדעת את מצב הקורס

interface UnitEditorProps {
    unit: LearningUnit;
    gradeLevel?: string;
    onSave: (updatedUnit: LearningUnit) => void;
    onCancel: () => void;
}

const getAiActions = (gradeLevel: string) => [
    { label: "✨ שפר ניסוח", prompt: `שפר את הניסוח שיהיה זורם, מקצועי ומותאם לתלמידי ${gradeLevel}` },
    { label: "✂️ קצר", prompt: "קצר את הטקסט תוך שמירה על המסר העיקרי" },
    { label: "👶 פשט שפה", prompt: `פשט את השפה והמושגים לרמה של תלמידי ${gradeLevel}, הסבר מילים קשות` },
    { label: "🧠 העמק", prompt: `הוסף עומק, דוגמאות והקשר רחב יותר` },
    { label: "🤣 הוסף הומור", prompt: `הוסף נגיעה של הומור בטוב טעם` },
];

const UnitEditor: React.FC<UnitEditorProps> = ({ unit, gradeLevel = "כללי", onSave, onCancel }) => {
    const { course } = useCourseStore(); // שליפת נתוני הקורס
    const [editedUnit, setEditedUnit] = useState<LearningUnit>(unit);
    const [loadingBlockId, setLoadingBlockId] = useState<string | null>(null);
    const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
    const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null);

    // בדיקה האם להציג ניקוד (רק במצב מבחן או ביחידת מבחן)
    const showScoring = course.mode === 'exam' || unit.type === 'test';

    const AI_ACTIONS = getAiActions(gradeLevel);

    useEffect(() => { setEditedUnit(unit); }, [unit]);

    // --- לוגיקה לחלוקת ניקוד חכמה ---
    const handleAutoDistributePoints = () => {
        const questions = editedUnit.activityBlocks.filter(b => b.type === 'multiple-choice' || b.type === 'open-question');
        if (questions.length === 0) return alert("אין שאלות ביחידה זו לחלוקת ניקוד.");

        // שואלים את המורה מה סך הניקוד ליחידה זו (גמישות למבחנים מרובי פרקים)
        const targetTotalStr = prompt("מה סך הניקוד הכולל ליחידה זו?", "100");
        const targetTotal = parseInt(targetTotalStr || "0");

        if (!targetTotal || targetTotal <= 0) return;

        // משקלות: שאלה פתוחה = 2 נקודות זכות, אמריקאית = 1 נקודת זכות
        const totalWeight = questions.reduce((sum, block) => sum + (block.type === 'open-question' ? 2 : 1), 0);
        const pointValue = targetTotal / totalWeight;

        let currentSum = 0;
        const newBlocks = editedUnit.activityBlocks.map(block => {
            if (block.type === 'multiple-choice' || block.type === 'open-question') {
                const weight = block.type === 'open-question' ? 2 : 1;
                const score = Math.round(pointValue * weight);
                currentSum += score;
                return { ...block, metadata: { ...block.metadata, score } };
            }
            return block;
        });

        // תיקון שארית (כדי להגיע בדיוק למספר היעד)
        if (currentSum !== targetTotal) {
            const diff = targetTotal - currentSum;
            // הוספת ההפרש לשאלה הראשונה
            const firstQIndex = newBlocks.findIndex(b => b.type === 'multiple-choice' || b.type === 'open-question');
            if (firstQIndex !== -1 && newBlocks[firstQIndex].metadata) {
                newBlocks[firstQIndex].metadata!.score = (newBlocks[firstQIndex].metadata!.score || 0) + diff;
            }
        }

        setEditedUnit({ ...editedUnit, activityBlocks: newBlocks });
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

    const addBlockAtIndex = (type: ActivityBlockType, index: number) => {
        const newBlock: ActivityBlock = {
            id: uuidv4(),
            type: type,
            content: type === 'multiple-choice' ? { question: '', options: ['', '', '', ''], correctAnswer: '' }
                : type === 'open-question' ? { question: '' }
                    : type === 'interactive-chat' ? { title: 'דיאלוג עם דמות', description: 'שוחח עם הבוט...' }
                        : '',
            metadata: {
                score: 0, // ברירת מחדל 0, המורה יחלק בסוף
                systemPrompt: type === 'interactive-chat' ? 'אתה מורה סבלני ועוזר. ענה בעברית.' : '',
                initialMessage: type === 'interactive-chat' ? 'שלום! שאל אותי כל דבר.' : ''
            }
        };
        const newBlocks = [...(editedUnit.activityBlocks || [])];
        newBlocks.splice(index, 0, newBlock);
        setEditedUnit({ ...editedUnit, activityBlocks: newBlocks });
        setActiveInsertIndex(null);
    };

    const deleteBlock = (blockId: string) => {
        if (confirm("למחוק את הרכיב?")) setEditedUnit({ ...editedUnit, activityBlocks: editedUnit.activityBlocks.filter(b => b.id !== blockId) });
    };

    const updateBlock = (blockId: string, newContent: any, newMetadata?: any) => {
        setEditedUnit(prev => ({
            ...prev,
            activityBlocks: prev.activityBlocks.map(block =>
                block.id === blockId ? { ...block, content: newContent, metadata: { ...block.metadata, ...newMetadata } } : block
            )
        }));
    };

    // --- Media Helpers ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, blockId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingBlockId(blockId);
        try {
            const url = await uploadMediaFile(file, file.type.startsWith('video') ? 'videos' : 'images');
            updateBlock(blockId, url, { fileName: file.name, uploadedFileUrl: url });
        } catch (err: any) {
            alert(err.message || "שגיאה בהעלאה");
        } finally {
            setUploadingBlockId(null);
        }
    };

    const getYoutubeId = (url: string) => {
        if (!url) return null;
        const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    // --- AI Helpers ---
    const handleAiAction = async (blockId: string, text: string, actionPrompt: string) => { if (!text) return; setLoadingBlockId(blockId); try { const res = await refineContentWithPedagogy(text, actionPrompt); updateBlock(blockId, res); } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); } };
    const handleSuggestImagePrompt = async (blockId: string) => { setLoadingBlockId(blockId); try { const prompt = await generateImagePromptBlock(editedUnit.baseContent); const block = editedUnit.activityBlocks.find(b => b.id === blockId); if (block) updateBlock(blockId, block.content, { aiPrompt: prompt }); } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); } };
    const handlePaintImage = (blockId: string, promptText: string) => { if (!promptText) return alert("חסר תיאור!"); setLoadingBlockId(blockId); const safePrompt = encodeURIComponent(promptText.replace(/[^\w\s,.]/gi, '')); const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=800&height=600&nologo=true&seed=${Math.random()}`; const img = new Image(); img.src = imageUrl; img.onload = () => { updateBlock(blockId, imageUrl, { aiPrompt: promptText }); setLoadingBlockId(null); }; };
    const handleGenerateQuestions = async (blockId: string, text: string, type: 'multiple-choice' | 'open-question') => { if (!text || text.length < 10) return alert("חסר טקסט"); setLoadingBlockId(blockId); try { const questions = await generateQuestionsFromText(text, type); const newBlocks: ActivityBlock[] = questions.map((q: any) => { const id = uuidv4(); if (type === 'multiple-choice') return { id, type: 'multiple-choice', content: { question: q.question, options: q.options, correctAnswer: q.correctAnswer }, metadata: { score: 0 } }; return { id, type: 'open-question', content: { question: q.question }, metadata: { modelAnswer: q.modelAnswer, score: 0 } }; }); const idx = editedUnit.activityBlocks.findIndex(b => b.id === blockId); const updated = [...editedUnit.activityBlocks]; updated.splice(idx + 1, 0, ...newBlocks); setEditedUnit({ ...editedUnit, activityBlocks: updated }); } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); } };

    const InsertMenu = ({ index }: { index: number }) => (
        <div className="relative py-2 group">
            <div className="absolute inset-x-0 top-1/2 h-0.5 bg-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex justify-center relative z-10">
                {activeInsertIndex === index ? (
                    <div className="bg-white border border-indigo-200 shadow-xl rounded-xl p-2 flex gap-2 animate-scale-in z-50">
                        <button onClick={() => addBlockAtIndex('text', index)} className="insert-btn">📝 טקסט</button>
                        <button onClick={() => addBlockAtIndex('image', index)} className="insert-btn">🖼️ תמונה</button>
                        <button onClick={() => addBlockAtIndex('video', index)} className="insert-btn">▶️ וידאו</button>
                        <div className="w-px bg-gray-200 mx-1"></div>
                        <button onClick={() => addBlockAtIndex('multiple-choice', index)} className="insert-btn">❓ אמריקאית</button>
                        <button onClick={() => addBlockAtIndex('open-question', index)} className="insert-btn">✍️ פתוחה</button>
                        <button onClick={() => addBlockAtIndex('interactive-chat', index)} className="insert-btn text-purple-600">💬 צ'אט</button>
                        <button onClick={() => setActiveInsertIndex(null)} className="text-gray-400 hover:text-red-500 px-2">✕</button>
                    </div>
                ) : (
                    <button onClick={() => setActiveInsertIndex(index)} className="bg-white text-indigo-500 border border-indigo-200 rounded-full w-6 h-6 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-600 hover:text-white transform hover:scale-110 text-xs" title="הוסף רכיב">+</button>
                )}
            </div>
        </div>
    );

    return (
        <div className="bg-gray-50 min-h-screen p-8 font-sans">
            <div className="sticky top-4 z-30 bg-white/90 backdrop-blur shadow-lg rounded-2xl p-4 flex justify-between items-center mb-8 border border-gray-200">
                <div>
                    <input type="text" value={editedUnit.title} onChange={(e) => setEditedUnit({ ...editedUnit, title: e.target.value })} className="text-2xl font-bold text-gray-800 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none px-2" />
                    <div className="text-xs text-gray-400 px-2 mt-1">שכבת גיל: {gradeLevel} {showScoring ? '| מצב מבחן' : '| מצב למידה'}</div>
                </div>
                <div className="flex gap-3">
                    {/* כפתור חלוקת ניקוד - מוצג רק במצב רלוונטי */}
                    {showScoring && (
                        <button onClick={handleAutoDistributePoints} className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-xl font-bold text-sm hover:bg-yellow-200 transition-colors shadow-sm">
                            ⚖️ חלק ניקוד
                        </button>
                    )}
                    <button onClick={onCancel} className="px-5 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-medium transition-colors">ביטול</button>
                    <button onClick={() => onSave(editedUnit)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 font-bold transition-transform hover:-translate-y-0.5">שמור שינויים</button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto space-y-4 pb-20">
                <InsertMenu index={0} />
                {editedUnit.activityBlocks?.map((block, index) => (
                    <React.Fragment key={block.id}>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative group">
                            <div className="absolute top-4 left-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white border rounded p-1 z-10">
                                <button onClick={() => moveBlock(index, 'up')} disabled={index === 0} className="text-xs px-1 hover:text-indigo-600 disabled:opacity-30">⬆️</button>
                                <button onClick={() => moveBlock(index, 'down')} disabled={index === editedUnit.activityBlocks.length - 1} className="text-xs px-1 hover:text-indigo-600 disabled:opacity-30">⬇️</button>
                                <button onClick={() => deleteBlock(block.id)} className="text-xs px-1 hover:text-red-500 border-r mr-1 pr-1">🗑️</button>
                            </div>

                            <span className="absolute top-2 right-12 text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded uppercase tracking-wide">{block.type}</span>

                            <div className="mt-4">
                                {block.type === 'text' && (
                                    <div>
                                        <textarea className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-gray-700 leading-relaxed" rows={4} value={block.content || ''} onChange={(e) => updateBlock(block.id, e.target.value)} />
                                        <div className="flex flex-wrap items-center gap-2 mt-3 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
                                            <span className="text-lg">✨</span>
                                            {AI_ACTIONS.map(action => <button key={action.label} onClick={() => handleAiAction(block.id, block.content, action.prompt)} disabled={loadingBlockId === block.id} className="text-xs bg-white text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-md hover:bg-indigo-50 transition-colors font-medium shadow-sm">{loadingBlockId === block.id ? '...' : action.label}</button>)}
                                            <div className="w-px h-5 bg-indigo-200 mx-1"></div>
                                            <button onClick={() => handleGenerateQuestions(block.id, block.content, 'multiple-choice')} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md shadow-sm hover:bg-indigo-700">➕ שאלות</button>
                                        </div>
                                    </div>
                                )}

                                {block.type === 'image' && (
                                    <div>
                                        <div className="flex gap-2 mb-3">
                                            <input type="text" className="flex-1 p-3 border rounded-xl bg-gray-50 text-sm" value={block.content} onChange={(e) => updateBlock(block.id, e.target.value)} placeholder="הדבק קישור לתמונה או העלה קובץ..." />
                                            <label className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-3 rounded-xl cursor-pointer transition-colors font-bold text-sm flex items-center">
                                                {uploadingBlockId === block.id ? '...' : '📂 העלה'}
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, block.id)} />
                                            </label>
                                        </div>

                                        {block.content && <img src={block.content} className="h-48 rounded-lg object-cover border bg-gray-100" />}

                                        <div className="bg-indigo-50 p-3 rounded border border-indigo-100 mt-2 flex gap-2 items-center">
                                            <span className="text-xs font-bold text-indigo-400">AI Generator:</span>
                                            <input type="text" className="flex-1 p-2 border rounded text-sm bg-white" placeholder="תאר את התמונה ל-AI..." value={block.metadata?.aiPrompt || ''} onChange={(e) => updateBlock(block.id, block.content, { aiPrompt: e.target.value })} />
                                            <button onClick={() => handleSuggestImagePrompt(block.id)} disabled={loadingBlockId === block.id} className="bg-white text-indigo-600 border px-3 py-1 rounded text-xs">💡 הצע</button>
                                            <button onClick={() => handlePaintImage(block.id, block.metadata?.aiPrompt || '')} disabled={loadingBlockId === block.id} className="bg-indigo-600 text-white px-4 py-1 rounded text-xs font-bold">צייר!</button>
                                        </div>
                                    </div>
                                )}

                                {block.type === 'video' && (
                                    <div>
                                        <div className="flex gap-2 mb-3">
                                            <input type="text" className="flex-1 p-3 border rounded-xl bg-gray-50 text-sm" value={block.content} onChange={(e) => updateBlock(block.id, e.target.value)} placeholder="הדבק קישור YouTube או העלה קובץ..." />
                                            <label className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-3 rounded-xl cursor-pointer transition-colors font-bold text-sm flex items-center">
                                                {uploadingBlockId === block.id ? '...' : '📂 העלה'}
                                                <input type="file" className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, block.id)} />
                                            </label>
                                        </div>

                                        {getYoutubeId(block.content) ? (
                                            <div className="relative aspect-video rounded-lg overflow-hidden border bg-black group-video">
                                                <img src={`https://img.youtube.com/vi/${getYoutubeId(block.content)}/0.jpg`} className="w-full h-full object-cover opacity-60" />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white text-xl">▶</div>
                                                </div>
                                                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">YouTube Preview</div>
                                            </div>
                                        ) : block.content ? (
                                            <video src={block.content} className="w-full h-48 bg-black rounded-lg" controls />
                                        ) : null}
                                    </div>
                                )}

                                {block.type === 'interactive-chat' && (
                                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-xl border border-purple-100">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="bg-purple-600 text-white p-2 rounded-lg text-xl">💬</div>
                                            <h3 className="font-bold text-purple-900">הגדרות צ'אט אינטראקטיבי</h3>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-bold text-purple-800 block mb-1">כותרת הפעילות</label>
                                                <input type="text" className="w-full p-2 border border-purple-200 rounded-lg bg-white" value={block.content.title || ''} onChange={(e) => updateBlock(block.id, { ...block.content, title: e.target.value })} placeholder="למשל: שיחה עם דמות היסטורית" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-purple-800 block mb-1">הנחיה ל-AI (System Prompt) - מי אתה ואיך להתנהג?</label>
                                                <textarea className="w-full p-2 border border-purple-200 rounded-lg bg-white h-20 text-sm" value={block.metadata?.systemPrompt || ''} onChange={(e) => updateBlock(block.id, block.content, { systemPrompt: e.target.value })} placeholder='למשל: "אתה בנימין זאב הרצל. ענה לשאלות תלמידים בשפה גבוהה אך מובנת, והדגש את חזון המדינה."' />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-purple-800 block mb-1">הודעת פתיחה לתלמיד</label>
                                                <input type="text" className="w-full p-2 border border-purple-200 rounded-lg bg-white text-sm" value={block.metadata?.initialMessage || ''} onChange={(e) => updateBlock(block.id, block.content, { initialMessage: e.target.value })} placeholder='למשל: "שלום, אני הרצל. שאל אותי כל דבר על אלטנוילנד."' />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(block.type === 'multiple-choice' || block.type === 'open-question') && (
                                    <div className={`${block.type === 'multiple-choice' ? 'bg-blue-50/50' : 'bg-orange-50/50'} p-4 rounded-xl border ${block.type === 'multiple-choice' ? 'border-blue-100' : 'border-orange-100'}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <input type="text" className="flex-1 font-bold p-2 bg-transparent border-b border-transparent focus:border-gray-300 outline-none" value={block.content.question} onChange={(e) => updateBlock(block.id, { ...block.content, question: e.target.value })} placeholder="השאלה..." />

                                            {/* הצגת שדה הניקוד רק אם showScoring הוא true */}
                                            {showScoring && (
                                                <div className="flex flex-col items-center ml-2">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">ניקוד</span>
                                                    <input type="number" className="w-12 text-center p-1 rounded border text-sm font-bold bg-white" value={block.metadata?.score || 0} onChange={(e) => updateBlock(block.id, block.content, { score: Number(e.target.value) })} />
                                                </div>
                                            )}
                                        </div>

                                        {block.type === 'multiple-choice' && <div className="space-y-2">{block.content.options?.map((opt: string, idx: number) => <div key={idx} className="flex items-center gap-2"><button onClick={() => updateBlock(block.id, { ...block.content, correctAnswer: opt })} className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ${block.content.correctAnswer === opt ? 'bg-green-500 text-white' : 'bg-white'}`}>{block.content.correctAnswer === opt && '✓'}</button><input type="text" className="flex-1 p-2 text-sm border rounded bg-white" value={opt} onChange={(e) => { const newOptions = [...block.content.options]; newOptions[idx] = e.target.value; updateBlock(block.id, { ...block.content, options: newOptions }); }} /></div>)}</div>}

                                        {block.type === 'open-question' && (
                                            <div>
                                                <label className="text-xs font-bold text-gray-500">תשובה לדוגמה (למחוון AI):</label>
                                                <textarea className="w-full p-2 border rounded bg-white text-sm" rows={2} value={block.metadata?.modelAnswer || ''} onChange={(e) => updateBlock(block.id, block.content, { modelAnswer: e.target.value })} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <InsertMenu index={index + 1} />
                    </React.Fragment>
                ))}
            </div>
            <style>{` .insert-btn { @apply px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all; } .animate-scale-in { animation: scaleIn 0.2s ease-out forwards; transform-origin: bottom center; } @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } } `}</style>
        </div>
    );
};

export default UnitEditor;