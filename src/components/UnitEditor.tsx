import React, { useState, useEffect } from 'react';
import type { LearningUnit, ActivityBlock, ActivityBlockType } from '../courseTypes';
import {
    generateImagePromptBlock, generateQuestionsFromText, refineContentWithPedagogy,
    generateSingleOpenQuestion, generateSingleMultipleChoiceQuestion, generateFullUnitContent
} from '../gemini';
import { uploadMediaFile } from '../firebaseUtils';
import { v4 as uuidv4 } from 'uuid';
import { useCourseStore } from '../context/CourseContext';
import {
    IconEdit, IconTrash, IconPlus, IconImage, IconVideo, IconText,
    IconChat, IconList, IconSparkles, IconUpload, IconArrowUp,
    IconArrowDown, IconCheck, IconX, IconWand, IconSave, IconBack,
    IconRobot, IconPalette, IconBalance, IconBrain
} from '../icons';

interface UnitEditorProps {
    unit: LearningUnit;
    gradeLevel?: string;
    onSave: (updatedUnit: LearningUnit) => void;
    onCancel: () => void;
    cancelLabel?: string;
}

const getAiActions = (gradeLevel: string) => [
    { label: "שפר ניסוח", prompt: `שפר את הניסוח שיהיה זורם, מקצועי ומותאם לתלמידי ${gradeLevel}` },
    { label: "קצר טקסט", prompt: "קצר את הטקסט תוך שמירה על המסר העיקרי" },
    { label: "פשט שפה", prompt: `פשט את השפה והמושגים לרמה של תלמידי ${gradeLevel}, הסבר מילים קשות` },
    { label: "העמק תוכן", prompt: `הוסף עומק, דוגמאות והקשר רחב יותר` },
    { label: "הוסף הומור", prompt: `הוסף נגיעה של הומור בטוב טעם` },
];

const UnitEditor: React.FC<UnitEditorProps> = ({ unit, gradeLevel = "כללי", onSave, onCancel, cancelLabel = "חזרה" }) => {
    const { course } = useCourseStore();
    const [editedUnit, setEditedUnit] = useState<LearningUnit>(unit);
    const [loadingBlockId, setLoadingBlockId] = useState<string | null>(null);
    const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
    const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null);

    // מצב טעינה ראשוני לתוכן האוטומטי
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);

    const showScoring = course.mode === 'exam' || unit.type === 'test';
    const AI_ACTIONS = getAiActions(gradeLevel);
    const mediaBtnClass = "cursor-pointer bg-white text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-all shadow-sm";

    // --- Smart Loading Logic ---
    // מזהה אם היחידה ריקה ומפעיל יצירה אוטומטית אם כן
    useEffect(() => {
        const initContent = async () => {
            if (!unit.activityBlocks || unit.activityBlocks.length === 0) {
                setIsAutoGenerating(true);
                try {
                    const newBlocks = await generateFullUnitContent(unit.title, course.title);
                    const updatedUnit = { ...unit, activityBlocks: newBlocks };

                    setEditedUnit(updatedUnit);
                    // שמירה ראשונית כדי שהתוכן לא יאבד אם יוצאים מיד
                    onSave(updatedUnit);
                } catch (error) {
                    console.error("Auto generation failed", error);
                } finally {
                    setIsAutoGenerating(false);
                }
            } else {
                setEditedUnit(unit);
            }
        };

        initContent();
    }, [unit.id]);


    const handleAutoDistributePoints = () => {
        const questions = editedUnit.activityBlocks.filter(b => b.type === 'multiple-choice' || b.type === 'open-question');
        if (questions.length === 0) return alert("אין שאלות ביחידה זו לחלוקת ניקוד.");

        const targetTotalStr = prompt("מה סך הניקוד הכולל ליחידה זו?", "100");
        const targetTotal = parseInt(targetTotalStr || "0");

        if (!targetTotal || targetTotal <= 0) return;

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

        // תיקון שאריות עיגול (מוסיף לשאלה הראשונה)
        if (currentSum !== targetTotal) {
            const diff = targetTotal - currentSum;
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
                score: 0,
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, blockId: string, field: 'content' | 'metadata' = 'content') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingBlockId(blockId);
        try {
            const url = await uploadMediaFile(file, file.type.startsWith('video') ? 'videos' : 'images');
            if (field === 'content') {
                updateBlock(blockId, url, { fileName: file.name, uploadedFileUrl: url });
            } else {
                const block = editedUnit.activityBlocks.find(b => b.id === blockId);
                if (block) {
                    updateBlock(blockId, block.content, { media: url, mediaType: file.type.startsWith('video') ? 'video' : 'image' });
                }
            }
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

    const handleAiAction = async (blockId: string, text: string, actionPrompt: string) => { if (!text) return; setLoadingBlockId(blockId); try { const res = await refineContentWithPedagogy(text, actionPrompt); updateBlock(blockId, res); } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); } };
    const handleSuggestImagePrompt = async (blockId: string) => { setLoadingBlockId(blockId); try { const prompt = await generateImagePromptBlock(editedUnit.baseContent || ""); const block = editedUnit.activityBlocks.find(b => b.id === blockId); if (block) updateBlock(blockId, block.content, { aiPrompt: prompt }); } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); } };
    const handlePaintImage = (blockId: string, promptText: string) => { if (!promptText) return alert("חסר תיאור!"); setLoadingBlockId(blockId); const safePrompt = encodeURIComponent(promptText.replace(/[^\w\s,.]/gi, '')); const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=800&height=600&nologo=true&seed=${Math.random()}`; const img = new Image(); img.src = imageUrl; img.onload = () => { updateBlock(blockId, imageUrl, { aiPrompt: promptText }); setLoadingBlockId(null); }; };

    const handleAutoGenerateOpenQuestion = async (blockId: string) => {
        setLoadingBlockId(blockId);
        try {
            const result = await generateSingleOpenQuestion(editedUnit.title);
            updateBlock(blockId, { question: result.question }, { modelAnswer: result.modelAnswer });
        } catch (e) {
            console.error(e);
            alert("שגיאה ביצירת השאלה");
        } finally {
            setLoadingBlockId(null);
        }
    };

    const handleAutoGenerateMCQuestion = async (blockId: string) => {
        setLoadingBlockId(blockId);
        try {
            const result = await generateSingleMultipleChoiceQuestion(editedUnit.title);
            updateBlock(blockId, {
                question: result.question,
                options: result.options,
                correctAnswer: result.correctAnswer
            });
        } catch (e) {
            console.error(e);
            alert("שגיאה ביצירת השאלה");
        } finally {
            setLoadingBlockId(null);
        }
    };

    const InsertMenu = ({ index }: { index: number }) => (
        <div className="relative py-4 flex justify-center z-20">
            <div className="absolute inset-x-0 top-1/2 h-0.5 bg-blue-100/50 -z-10"></div>
            <div>
                {activeInsertIndex === index ? (
                    <div className="glass border border-white/60 shadow-xl rounded-2xl p-4 flex flex-wrap gap-3 animate-scale-in items-center justify-center backdrop-blur-xl bg-white/95 ring-4 ring-blue-50/50">
                        <button onClick={() => addBlockAtIndex('text', index)} className="insert-btn"><IconText className="w-4 h-4" /><span>טקסט</span></button>
                        <button onClick={() => addBlockAtIndex('image', index)} className="insert-btn"><IconImage className="w-4 h-4" /><span>תמונה</span></button>
                        <button onClick={() => addBlockAtIndex('video', index)} className="insert-btn"><IconVideo className="w-4 h-4" /><span>וידאו</span></button>
                        <div className="w-px h-6 bg-gray-300 mx-2 hidden sm:block"></div>
                        <button onClick={() => addBlockAtIndex('multiple-choice', index)} className="insert-btn"><IconList className="w-4 h-4" /><span>אמריקאית</span></button>
                        <button onClick={() => addBlockAtIndex('open-question', index)} className="insert-btn"><IconEdit className="w-4 h-4" /><span>פתוחה</span></button>
                        <button onClick={() => addBlockAtIndex('interactive-chat', index)} className="insert-btn hover:text-purple-600 hover:border-purple-200 transition-colors"><IconChat className="w-4 h-4 text-purple-500" /><span>צ'אט AI</span></button>
                        <button onClick={() => setActiveInsertIndex(null)} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors ml-2"><IconX className="w-5 h-5" /></button>
                    </div>
                ) : (
                    <button
                        onClick={() => setActiveInsertIndex(index)}
                        className="bg-white text-blue-600 border border-blue-200 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-sm hover:shadow-md hover:scale-105 transition-all hover:bg-blue-50 hover:border-blue-300"
                        title="הוסף רכיב חדש"
                    >
                        <IconPlus className="w-4 h-4" />
                        <span className="text-xs font-bold">הוסף רכיב</span>
                    </button>
                )}
            </div>
        </div>
    );

    const renderEmbeddedMedia = (blockId: string, metadata: any) => {
        if (!metadata?.media) return null;
        return (
            <div className="mb-4 relative rounded-xl overflow-hidden border border-gray-200 group">
                {metadata.mediaType === 'video' ? (
                    <video src={metadata.media} controls className="w-full h-48 bg-black" />
                ) : (
                    <img src={metadata.media} alt="מדיה מצורפת" className="w-full h-48 object-cover bg-gray-50" />
                )}
                <button
                    onClick={() => {
                        const block = editedUnit.activityBlocks.find(b => b.id === blockId);
                        if (block) updateBlock(blockId, block.content, { media: null, mediaType: null });
                    }}
                    className="absolute top-2 right-2 bg-white/80 p-1.5 rounded-full text-red-500 hover:bg-white hover:text-red-600 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                    title="הסר מדיה"
                >
                    <IconTrash className="w-4 h-4" />
                </button>
            </div>
        );
    };

    if (isAutoGenerating) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
                <div className="relative mb-6">
                    <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <IconSparkles className="w-8 h-8 text-blue-600 animate-pulse" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">ה-AI כותב את תוכן היחידה...</h2>
                <p className="text-gray-500 mt-2 text-lg">
                    מייצר הסברים, נקודות מפתח ושאלות עבור: <span className="font-bold text-blue-600">{unit.title}</span>
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8 font-sans pb-24 bg-gray-50/50">
            {/* Header */}
            <div className="sticky top-4 z-40 glass backdrop-blur-lg shadow-lg rounded-2xl p-4 flex justify-between items-center mb-10 border border-white/60 bg-white/80 gap-4">
                <div className="flex-1 min-w-0">
                    <input
                        type="text"
                        value={editedUnit.title}
                        onChange={(e) => setEditedUnit({ ...editedUnit, title: e.target.value })}
                        className="text-2xl font-bold text-gray-800 bg-transparent border-b border-transparent focus:border-blue-500 outline-none px-2 transition-colors placeholder-gray-400 w-full"
                        placeholder="כותרת היחידה"
                    />
                    <div className="text-sm text-gray-500 px-2 mt-1 flex items-center gap-2">
                        <span>שכבת גיל: {gradeLevel}</span>
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        <span>{showScoring ? 'מצב מבחן' : 'מצב למידה'}</span>
                    </div>
                </div>
                <div className="flex gap-3 flex-shrink-0">
                    {showScoring && (
                        <button onClick={handleAutoDistributePoints} className="px-4 py-2 bg-yellow-100/80 hover:bg-yellow-200 text-yellow-800 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2 border border-yellow-200">
                            <IconBalance className="w-4 h-4" />
                            חלק ניקוד
                        </button>
                    )}
                    <button onClick={onCancel} className="px-5 py-2 rounded-xl text-gray-600 hover:bg-white/50 font-medium transition-colors flex items-center gap-2">
                        <IconBack className="w-4 h-4" /> {cancelLabel}
                    </button>
                    <button onClick={() => onSave(editedUnit)} className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 font-bold transition-all hover:-translate-y-0.5 flex items-center gap-2">
                        <IconSave className="w-4 h-4" /> שמור שינויים
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
                <InsertMenu index={0} />

                {editedUnit.activityBlocks?.map((block, index) => (
                    <React.Fragment key={block.id}>
                        <div className="glass p-6 rounded-2xl shadow-sm border border-white/60 hover:shadow-xl hover:border-blue-200 transition-all relative group bg-white/80">

                            {/* Block Controls */}
                            <div className="absolute top-4 left-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur border border-gray-100 rounded-lg p-1 z-10 shadow-sm">
                                <button onClick={() => moveBlock(index, 'up')} disabled={index === 0} className="p-1 hover:text-blue-600 disabled:opacity-30 rounded hover:bg-blue-50 transition-colors"><IconArrowUp className="w-4 h-4" /></button>
                                <button onClick={() => moveBlock(index, 'down')} disabled={index === editedUnit.activityBlocks.length - 1} className="p-1 hover:text-blue-600 disabled:opacity-30 rounded hover:bg-blue-50 transition-colors"><IconArrowDown className="w-4 h-4" /></button>
                                <div className="w-px bg-gray-200 my-1 mx-1"></div>
                                <button onClick={() => deleteBlock(block.id)} className="p-1 hover:text-red-500 rounded hover:bg-red-50 transition-colors"><IconTrash className="w-4 h-4" /></button>
                            </div>

                            <span className="absolute top-2 right-12 text-[10px] font-bold bg-gray-100/80 text-gray-500 px-2 py-1 rounded-full uppercase tracking-wide border border-white/50">{block.type}</span>

                            <div className="mt-2">
                                {/* TEXT BLOCK */}
                                {block.type === 'text' && (
                                    <div>
                                        <textarea
                                            className="w-full p-4 border border-gray-200/60 bg-white/50 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-gray-700 leading-relaxed resize-y min-h-[120px]"
                                            value={block.content || ''}
                                            onChange={(e) => updateBlock(block.id, e.target.value)}
                                            placeholder="הקלד כאן את תוכן הלימוד..."
                                        />
                                        {renderEmbeddedMedia(block.id, block.metadata)}
                                        <div className="flex flex-wrap items-center gap-2 mt-3 bg-blue-50/40 p-2 rounded-xl border border-blue-100/50 backdrop-blur-sm justify-between">
                                            <div className="flex gap-2 items-center">
                                                <div className="flex items-center gap-1 text-blue-600 px-2 font-bold text-xs">
                                                    <IconSparkles className="w-4 h-4" /> AI:
                                                </div>
                                                {AI_ACTIONS.map(action => (
                                                    <button
                                                        key={action.label}
                                                        onClick={() => handleAiAction(block.id, block.content, action.prompt)}
                                                        disabled={loadingBlockId === block.id}
                                                        className="text-xs bg-white/80 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors font-medium shadow-sm disabled:opacity-50"
                                                    >
                                                        {loadingBlockId === block.id ? '...' : action.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex gap-1 border-r border-blue-200 pr-2">
                                                <label className={mediaBtnClass} title="הוסף תמונה">
                                                    <IconImage className="w-4 h-4" />
                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, block.id, 'metadata')} />
                                                </label>
                                                <label className={mediaBtnClass} title="הוסף וידאו">
                                                    <IconVideo className="w-4 h-4" />
                                                    <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, block.id, 'metadata')} />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* IMAGE BLOCK */}
                                {block.type === 'image' && (
                                    <div>
                                        <div className="flex gap-2 mb-3">
                                            <div className="flex-1 relative">
                                                <input type="text" className="w-full p-3 pl-10 border border-gray-200/60 rounded-xl bg-white/50 text-sm focus:border-blue-400 outline-none" value={block.content} onChange={(e) => updateBlock(block.id, e.target.value)} placeholder="הדבק קישור לתמונה או העלה קובץ..." />
                                                <IconImage className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                                            </div>
                                            <label className="bg-white/80 hover:bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded-xl cursor-pointer transition-colors font-bold text-sm flex items-center gap-2 shadow-sm">
                                                {uploadingBlockId === block.id ? <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div> : <IconUpload className="w-4 h-4" />}
                                                <span>העלה</span>
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, block.id)} />
                                            </label>
                                        </div>
                                        {block.content && (
                                            <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                                                <img src={block.content} className="w-full h-64 object-cover" alt="Content" />
                                            </div>
                                        )}
                                        <div className="mt-2">
                                            <textarea
                                                className="w-full p-3 text-sm border border-gray-100 rounded-xl bg-white/50 focus:bg-white outline-none transition-all placeholder-gray-400"
                                                placeholder="הוסף כיתוב או הסבר לתמונה..."
                                                value={block.metadata?.caption || ''}
                                                onChange={(e) => updateBlock(block.id, block.content, { caption: e.target.value })}
                                                rows={2}
                                            />
                                        </div>
                                        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mt-2 flex gap-2 items-center backdrop-blur-sm">
                                            <div className="flex items-center gap-1 text-blue-600 px-2 font-bold text-xs"><IconPalette className="w-4 h-4" /> AI Art:</div>
                                            <input type="text" className="flex-1 p-2 border border-blue-100 rounded-lg text-sm bg-white/80 focus:ring-1 focus:ring-blue-300 outline-none" placeholder="תאר את התמונה ל-AI..." value={block.metadata?.aiPrompt || ''} onChange={(e) => updateBlock(block.id, block.content, { aiPrompt: e.target.value })} />
                                            <button onClick={() => handleSuggestImagePrompt(block.id)} disabled={loadingBlockId === block.id} className="bg-white text-blue-600 border border-blue-100 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-50"><IconWand className="w-3 h-3 inline ml-1" /> הצע</button>
                                            <button onClick={() => handlePaintImage(block.id, block.metadata?.aiPrompt || '')} disabled={loadingBlockId === block.id} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-blue-700 transition-transform hover:scale-105">צייר!</button>
                                        </div>
                                    </div>
                                )}

                                {/* VIDEO BLOCK */}
                                {block.type === 'video' && (
                                    <div>
                                        <div className="flex gap-2 mb-3">
                                            <div className="flex-1 relative">
                                                <input type="text" className="w-full p-3 pl-10 border border-gray-200/60 rounded-xl bg-white/50 text-sm focus:border-blue-400 outline-none" value={block.content} onChange={(e) => updateBlock(block.id, e.target.value)} placeholder="הדבק קישור YouTube או העלה קובץ..." />
                                                <IconVideo className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                                            </div>
                                            <label className="bg-white/80 hover:bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded-xl cursor-pointer transition-colors font-bold text-sm flex items-center gap-2 shadow-sm">
                                                {uploadingBlockId === block.id ? <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div> : <IconUpload className="w-4 h-4" />}
                                                <span>העלה</span>
                                                <input type="file" className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, block.id)} />
                                            </label>
                                        </div>
                                        {getYoutubeId(block.content) ? (
                                            <div className="relative aspect-video rounded-xl overflow-hidden border border-gray-200 bg-black group-video shadow-md">
                                                <img src={`https://img.youtube.com/vi/${getYoutubeId(block.content)}/maxresdefault.jpg`} className="w-full h-full object-cover opacity-80" onError={(e) => e.currentTarget.src = `https://img.youtube.com/vi/${getYoutubeId(block.content)}/0.jpg`} />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-16 h-16 bg-red-600/90 rounded-full flex items-center justify-center text-white pl-1 shadow-xl transform group-video-hover:scale-110 transition-transform">
                                                        <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-white border-b-[10px] border-b-transparent ml-1"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : block.content ? (
                                            <video src={block.content} className="w-full h-64 bg-black rounded-xl shadow-md" controls />
                                        ) : null}
                                        <div className="mt-2">
                                            <textarea className="w-full p-3 text-sm border border-gray-100 rounded-xl bg-white/50 focus:bg-white outline-none transition-all placeholder-gray-400" placeholder="הוסף כיתוב או הסבר לסרטון..." value={block.metadata?.caption || ''} onChange={(e) => updateBlock(block.id, block.content, { caption: e.target.value })} rows={2} />
                                        </div>
                                    </div>
                                )}

                                {/* CHAT BLOCK */}
                                {block.type === 'interactive-chat' && (
                                    <div className="bg-gradient-to-r from-purple-50/80 to-indigo-50/80 p-5 rounded-xl border border-purple-100 backdrop-blur-sm">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="bg-purple-600 text-white p-2 rounded-lg shadow-md"><IconRobot className="w-6 h-6" /></div>
                                            <h3 className="font-bold text-purple-900 text-lg">הגדרות צ'אט אינטראקטיבי</h3>
                                        </div>
                                        <div className="space-y-4">
                                            <div><label className="text-xs font-bold text-purple-700 block mb-1">כותרת הפעילות</label><input type="text" className="w-full p-2.5 border border-purple-200 rounded-lg bg-white/70 focus:bg-white transition-colors" value={block.content.title || ''} onChange={(e) => updateBlock(block.id, { ...block.content, title: e.target.value })} placeholder="למשל: שיחה עם דמות היסטורית" /></div>
                                            <div><label className="text-xs font-bold text-purple-700 block mb-1">הנחיה ל-AI (System Prompt) - מי הדמות?</label><textarea className="w-full p-2.5 border border-purple-200 rounded-lg bg-white/70 h-24 text-sm focus:bg-white transition-colors resize-none" value={block.metadata?.systemPrompt || ''} onChange={(e) => updateBlock(block.id, block.content, { systemPrompt: e.target.value })} placeholder='למשל: "אתה הרצל. ענה לתלמידים בשפה גבוהה והדגש את הציונות."' /></div>
                                            <div><label className="text-xs font-bold text-purple-700 block mb-1">הודעת פתיחה לתלמיד</label><input type="text" className="w-full p-2.5 border border-purple-200 rounded-lg bg-white/70 text-sm focus:bg-white transition-colors" value={block.metadata?.initialMessage || ''} onChange={(e) => updateBlock(block.id, block.content, { initialMessage: e.target.value })} placeholder='למשל: "שלום, שאל אותי כל דבר על אלטנוילנד."' /></div>
                                        </div>
                                    </div>
                                )}

                                {/* QUESTIONS */}
                                {(block.type === 'multiple-choice' || block.type === 'open-question') && (
                                    <div className={`${block.type === 'multiple-choice' ? 'bg-blue-50/40 border-blue-100' : 'bg-orange-50/40 border-orange-100'} p-5 rounded-xl border backdrop-blur-sm`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1 flex gap-2">
                                                <div className={`mt-1 ${block.type === 'multiple-choice' ? 'text-blue-500' : 'text-orange-500'}`}>{block.type === 'multiple-choice' ? <IconList className="w-5 h-5" /> : <IconEdit className="w-5 h-5" />}</div>
                                                <input type="text" className="flex-1 font-bold text-lg p-1 bg-transparent border-b border-transparent focus:border-gray-300 outline-none text-gray-800 placeholder-gray-400" value={block.content.question} onChange={(e) => updateBlock(block.id, { ...block.content, question: e.target.value })} placeholder={block.type === 'multiple-choice' ? "הקלד שאלה אמריקאית..." : "הקלד שאלה פתוחה..."} />
                                            </div>
                                            {showScoring && (<div className="flex flex-col items-center ml-2 bg-white/50 p-1 rounded-lg border border-gray-100"><span className="text-[10px] font-bold text-gray-400 uppercase">ניקוד</span><input type="number" className="w-12 text-center p-1 rounded border-none bg-transparent text-sm font-bold" value={block.metadata?.score || 0} onChange={(e) => updateBlock(block.id, block.content, { score: Number(e.target.value) })} /></div>)}
                                        </div>
                                        {renderEmbeddedMedia(block.id, block.metadata)}
                                        {block.type === 'multiple-choice' && (
                                            <div className="space-y-2 pr-7">
                                                {!block.content.question && (<div className="flex justify-end mb-4"><button onClick={() => handleAutoGenerateMCQuestion(block.id)} disabled={loadingBlockId === block.id} className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2">{loadingBlockId === block.id ? 'חושב...' : <><IconSparkles className="w-3 h-3" /> Wizdi Magic: צור שאלה אמריקאית</>}</button></div>)}
                                                {block.content.options?.map((opt: string, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-3 group/option">
                                                        <button onClick={() => updateBlock(block.id, { ...block.content, correctAnswer: opt })} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${block.content.correctAnswer === opt ? 'bg-green-500 border-green-500 text-white shadow-sm scale-110' : 'bg-white border-gray-300 hover:border-gray-400'}`}>{block.content.correctAnswer === opt && <IconCheck className="w-3.5 h-3.5" />}</button>
                                                        <input type="text" className={`flex-1 p-2 text-sm border rounded-lg bg-white/80 focus:bg-white focus:ring-2 outline-none transition-all ${block.content.correctAnswer === opt ? 'border-green-200 ring-green-50' : 'border-gray-200 focus:ring-blue-50 focus:border-blue-300'}`} value={opt} onChange={(e) => { const newOptions = [...block.content.options]; newOptions[idx] = e.target.value; updateBlock(block.id, { ...block.content, options: newOptions }); }} placeholder={`אפשרות ${idx + 1}`} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {block.type === 'open-question' && (
                                            <div className="pr-7 mt-2">
                                                {!block.content.question && (<div className="flex justify-end mb-2"><button onClick={() => handleAutoGenerateOpenQuestion(block.id)} disabled={loadingBlockId === block.id} className="bg-gradient-to-r from-orange-400 to-pink-500 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2">{loadingBlockId === block.id ? 'חושב...' : <><IconSparkles className="w-3 h-3" /> Wizdi Magic: צור שאלה ומחוון אוטומטית</>}</button></div>)}
                                                <label className="text-xs font-bold text-gray-400 mb-1 block flex items-center gap-1"><IconBrain className="w-3 h-3" /> תשובה לדוגמה (עבור ה-AI):</label>
                                                <textarea className="w-full p-3 border border-gray-200/80 rounded-xl bg-white/80 text-sm focus:bg-white transition-colors outline-none focus:border-orange-300" rows={2} value={block.metadata?.modelAnswer || ''} onChange={(e) => updateBlock(block.id, block.content, { modelAnswer: e.target.value })} placeholder="כתוב כאן את התשובה המצופה..." />
                                            </div>
                                        )}
                                        <div className="mt-3 pt-3 border-t border-gray-200/50 flex justify-between items-center">
                                            <span className="text-xs text-gray-400 font-bold">הוסף מדיה לשאלה:</span>
                                            <div className="flex gap-2">
                                                <label className={mediaBtnClass} title="הוסף תמונה"><IconImage className="w-4 h-4" /> תמונה<input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, block.id, 'metadata')} /></label>
                                                <label className={mediaBtnClass} title="הוסף וידאו"><IconVideo className="w-4 h-4" /> וידאו<input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, block.id, 'metadata')} /></label>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <InsertMenu index={index + 1} />
                    </React.Fragment>
                ))}
            </div>
            <style>{`
                .insert-btn { @apply px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-xs font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center gap-1.5 shadow-sm; }
                .animate-scale-in { animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; transform-origin: bottom center; }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            `}</style>
        </div>
    );
};

export default UnitEditor;