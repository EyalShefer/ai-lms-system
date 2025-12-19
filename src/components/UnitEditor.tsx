import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCourseStore } from '../context/CourseContext';
import {
    generateImagePromptBlock, refineContentWithPedagogy,
    generateSingleOpenQuestion, generateSingleMultipleChoiceQuestion, generateFullUnitContent
} from '../gemini';
import { uploadMediaFile } from '../firebaseUtils';
import {
    IconEdit, IconTrash, IconPlus, IconImage, IconVideo, IconText,
    IconChat, IconList, IconSparkles, IconUpload, IconArrowUp,
    IconArrowDown, IconCheck, IconX, IconWand, IconSave, IconBack,
    IconRobot, IconPalette, IconBalance, IconBrain, IconLink
} from '../icons';

// --- הגדרות מקומיות למניעת תלות בקבצים חיצוניים ---
const IconShield = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const IconLock = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

interface UnitEditorProps {
    unit: any;
    gradeLevel?: string;
    onSave: (updatedUnit: any) => void;
    onCancel: () => void;
    cancelLabel?: string;
}

const getAiActions = (gradeLevel: string) => [
    { label: "שפר ניסוח", prompt: `שפר את הניסוח שיהיה זורם, מקצועי ומותאם לתלמידי ${gradeLevel}` },
    { label: "קצר טקסט", prompt: "קצר את הטקסט תוך שמירה על המסר העיקרי" },
    { label: "פשט שפה", prompt: `פשט את השפה והמושגים לרמה של תלמידי ${gradeLevel}, הסבר מילים קשות` },
    { label: "העמק תוכן", prompt: `הוסף עומק, דוגמאות והקשר רחב יותר` },
];

const UnitEditor: React.FC<UnitEditorProps> = ({ unit, gradeLevel = "כללי", onSave, onCancel, cancelLabel = "חזרה" }) => {
    const { course } = useCourseStore();
    const [editedUnit, setEditedUnit] = useState<any>(unit);
    const [loadingBlockId, setLoadingBlockId] = useState<string | null>(null);
    const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
    const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null);
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);

    // מצבי עריכה מקומיים למדיה
    const [mediaInputMode, setMediaInputMode] = useState<Record<string, 'upload' | 'ai' | 'link' | null>>({});
    const [mediaInputValue, setMediaInputValue] = useState<Record<string, string>>({});

    const hasInitialized = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    if (!course) return null;

    const showScoring = course.mode === 'exam' || unit.type === 'test';
    const AI_ACTIONS = getAiActions(gradeLevel);
    const mediaBtnClass = "cursor-pointer bg-white text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-all shadow-sm";

    useEffect(() => {
        const initContent = async () => {
            if ((unit.activityBlocks && unit.activityBlocks.length > 0) || hasInitialized.current) {
                setEditedUnit(unit);
                return;
            }
            hasInitialized.current = true;
            setIsAutoGenerating(true);
            try {
                const newBlocks = await generateFullUnitContent(unit.title, course.title, gradeLevel);
                const updatedUnit = { ...unit, activityBlocks: newBlocks };
                setEditedUnit(updatedUnit);
                onSave(updatedUnit);
            } catch (error) {
                console.error("Auto generation failed", error);
                hasInitialized.current = false;
            } finally {
                setIsAutoGenerating(false);
            }
        };
        initContent();
    }, [unit.id]);

    const handleSaveWithFeedback = async () => {
        setIsSaving(true);
        try {
            await onSave(editedUnit);
            setTimeout(() => {
                setIsSaving(false);
                setSaveSuccess(true);
                setTimeout(() => { setSaveSuccess(false); }, 3000);
            }, 600);
        } catch (error) {
            console.error("Save failed", error);
            setIsSaving(false);
            alert("שגיאה בשמירה. אנא נסו שוב.");
        }
    };

    const handleAutoDistributePoints = () => {
        const questions = editedUnit.activityBlocks.filter((b: any) => b.type === 'multiple-choice' || b.type === 'open-question');
        if (questions.length === 0) return alert("אין שאלות ביחידה זו לחלוקת ניקוד.");
        const targetTotalStr = prompt("מה סך הניקוד הכולל ליחידה זו?", "100");
        const targetTotal = parseInt(targetTotalStr || "0");
        if (!targetTotal || targetTotal <= 0) return;
        const totalWeight = questions.reduce((sum: number, block: any) => sum + (block.type === 'open-question' ? 2 : 1), 0);
        const pointValue = targetTotal / totalWeight;
        let currentSum = 0;
        const newBlocks = editedUnit.activityBlocks.map((block: any) => {
            if (block.type === 'multiple-choice' || block.type === 'open-question') {
                const weight = block.type === 'open-question' ? 2 : 1;
                const score = Math.round(pointValue * weight);
                currentSum += score;
                return { ...block, metadata: { ...block.metadata, score } };
            }
            return block;
        });
        if (currentSum !== targetTotal) {
            const diff = targetTotal - currentSum;
            const firstQIndex = newBlocks.findIndex((b: any) => b.type === 'multiple-choice' || b.type === 'open-question');
            if (firstQIndex !== -1 && newBlocks[firstQIndex].metadata) {
                newBlocks[firstQIndex].metadata.score = (newBlocks[firstQIndex].metadata.score || 0) + diff;
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

    const generatePedagogicalPrompt = (persona: string, customCharName: string = ""): string => {
        const baseInfo = `אתה מנחה פעילות עבור משתתפים בשכבת גיל: ${gradeLevel}. הנושא הנלמד: "${editedUnit.title}".`;
        const safetyProtocol = `פרוטוקול בטיחות (חובה): 1. שמור על שפה מכבדת. 2. אם המשתתף מביע מצוקה או אלימות - הפסק את השיח ופנה לגורם אחראי.`;
        let specificInstructions = "";
        if (showScoring) {
            specificInstructions = `מצב מבחן (EXAM MODE): תפקידך הוא משגיח וסייען טכני בלבד. איסור מוחלט לתת תשובות או רמזים.`;
        } else {
            let personaGuidance = "";
            switch (persona) {
                case 'teacher': personaGuidance = "הייה מנחה סבלני ומעודד."; break;
                case 'socratic': personaGuidance = "השתמש בשיטה הסוקרטית (שאלות מנחות)."; break;
                case 'historical': personaGuidance = `כנס לדמות של ${customCharName || 'דמות היסטורית'}.`; break;
                case 'debate': personaGuidance = "הייה יריב לדיבייט."; break;
                default: personaGuidance = "הייה עוזר מועיל.";
            }
            specificInstructions = `מצב פעילות: ${personaGuidance}. אל תיתן תשובה מיד, אלא רמזים תחילה.`;
        }
        return `${baseInfo}\n${specificInstructions}\n${safetyProtocol}`;
    };

    const addBlockAtIndex = (type: string, index: number) => {
        const initialPersona = 'teacher';
        const safeSystemPrompt = type === 'interactive-chat' ? generatePedagogicalPrompt(initialPersona) : '';
        const newBlock = {
            id: uuidv4(),
            type: type,
            content: type === 'multiple-choice' ? { question: '', options: ['', '', '', ''], correctAnswer: '' }
                : type === 'open-question' ? { question: '' }
                    : type === 'interactive-chat' ? { title: showScoring ? 'עזרה במבחן' : 'דיאלוג עם המנחה', description: 'צאט...' }
                        : '', // For image/video/text, content starts empty string
            metadata: {
                score: 0,
                systemPrompt: safeSystemPrompt,
                initialMessage: showScoring ? 'אני כאן להשגחה בלבד.' : 'שלום! אפשר לשאול אותי כל דבר.',
                botPersona: initialPersona,
                caption: '', // New: For media caption
                relatedQuestion: null // New: For attached question
            }
        };
        const newBlocks = [...(editedUnit.activityBlocks || [])];
        newBlocks.splice(index, 0, newBlock);
        setEditedUnit({ ...editedUnit, activityBlocks: newBlocks });
        setActiveInsertIndex(null);
    };

    const deleteBlock = (blockId: string) => {
        if (confirm("למחוק את הרכיב?")) setEditedUnit({ ...editedUnit, activityBlocks: editedUnit.activityBlocks.filter((b: any) => b.id !== blockId) });
    };

    const updateBlock = (blockId: string, newContent: any, newMetadata?: any) => {
        setEditedUnit((prev: any) => ({
            ...prev,
            activityBlocks: prev.activityBlocks.map((block: any) =>
                block.id === blockId ? { ...block, content: newContent, metadata: { ...block.metadata, ...newMetadata } } : block
            )
        }));
    };

    const handlePersonaChange = (blockId: string, newPersona: string, currentContent: any, currentMetadata: any) => {
        const newPrompt = generatePedagogicalPrompt(newPersona, "");
        updateBlock(blockId, currentContent, { botPersona: newPersona, systemPrompt: newPrompt });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, blockId: string, field: 'content' | 'metadata' = 'content') => {
        const file = e.target.files?.[0];
        if (!file) return;

        // בדיקת גודל לוידאו
        if (file.type.startsWith('video') && file.size > 50 * 1024 * 1024) {
            alert("קובץ הוידאו גדול מדי. הגודל המקסימלי הוא 50MB.");
            return;
        }

        setUploadingBlockId(blockId);
        try {
            const url = await uploadMediaFile(file, file.type.startsWith('video') ? 'videos' : 'images');
            if (field === 'content') updateBlock(blockId, url, { fileName: file.name, uploadedFileUrl: url, mediaType: file.type.startsWith('video') ? 'video' : 'image' });
            else {
                const block = editedUnit.activityBlocks.find((b: any) => b.id === blockId);
                if (block) updateBlock(blockId, block.content, { media: url, mediaType: file.type.startsWith('video') ? 'video' : 'image' });
            }
        } catch (err: any) { alert(err.message || "שגיאה"); } finally { setUploadingBlockId(null); }
    };

    const handleAiAction = async (blockId: string, text: string, actionPrompt: string) => { if (!text) return; setLoadingBlockId(blockId); try { const res = await refineContentWithPedagogy(text, actionPrompt); updateBlock(blockId, res); } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); } };
    const handleSuggestImagePrompt = async (blockId: string) => { setLoadingBlockId(blockId); try { const prompt = await generateImagePromptBlock(editedUnit.baseContent || ""); const block = editedUnit.activityBlocks.find((b: any) => b.id === blockId); if (block) updateBlock(blockId, block.content, { aiPrompt: prompt }); } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); } };
    const handleAutoGenerateOpenQuestion = async (blockId: string) => { setLoadingBlockId(blockId); try { const result = await generateSingleOpenQuestion(editedUnit.title); updateBlock(blockId, { question: result.question }, { modelAnswer: result.modelAnswer }); } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); } };
    const handleAutoGenerateMCQuestion = async (blockId: string) => { setLoadingBlockId(blockId); try { const result = await generateSingleMultipleChoiceQuestion(editedUnit.title); updateBlock(blockId, { question: result.question, options: result.options, correctAnswer: result.correctAnswer }); } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); } };

    // --- Media & Embedded Question Logic ---
    const handleAddRelatedQuestion = (blockId: string, type: 'open-question' | 'multiple-choice') => {
        const block = editedUnit.activityBlocks.find((b: any) => b.id === blockId);
        if (!block) return;

        const newQuestionData = type === 'multiple-choice'
            ? { type, question: '', options: ['', '', '', ''], correctAnswer: '' }
            : { type, question: '' };

        updateBlock(blockId, block.content, { relatedQuestion: newQuestionData });
    };

    const updateRelatedQuestion = (blockId: string, updatedData: any) => {
        const block = editedUnit.activityBlocks.find((b: any) => b.id === blockId);
        if (!block) return;
        updateBlock(blockId, block.content, { relatedQuestion: { ...block.metadata.relatedQuestion, ...updatedData } });
    };

    const removeRelatedQuestion = (blockId: string) => {
        const block = editedUnit.activityBlocks.find((b: any) => b.id === blockId);
        if (block) updateBlock(blockId, block.content, { relatedQuestion: null });
    };

    // --- Helper to render the embedded question editor ---
    const renderRelatedQuestionEditor = (blockId: string, relatedQ: any) => {
        if (!relatedQ) return null;
        return (
            <div className="mt-4 pt-4 border-t border-gray-100 bg-gray-50/50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><IconSparkles className="w-3 h-3" /> שאלה משויכת</span>
                    <button onClick={() => removeRelatedQuestion(blockId)} className="text-red-400 hover:text-red-600 p-1"><IconTrash className="w-3 h-3" /></button>
                </div>

                <input
                    type="text"
                    className="w-full font-bold p-2 bg-white border border-gray-200 rounded-lg mb-2 focus:border-blue-400 outline-none"
                    value={relatedQ.question}
                    onChange={(e) => updateRelatedQuestion(blockId, { question: e.target.value })}
                    placeholder="כתבו את השאלה כאן..."
                />

                {relatedQ.type === 'multiple-choice' && (
                    <div className="space-y-2">
                        {relatedQ.options?.map((opt: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                                <button onClick={() => updateRelatedQuestion(blockId, { correctAnswer: opt })} className={`w-5 h-5 rounded-full border flex items-center justify-center ${relatedQ.correctAnswer === opt ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300'}`}>{relatedQ.correctAnswer === opt && <IconCheck className="w-3 h-3" />}</button>
                                <input type="text" className="flex-1 p-1.5 text-sm border border-gray-200 rounded bg-white" value={opt} onChange={(e) => { const newOpts = [...relatedQ.options]; newOpts[idx] = e.target.value; updateRelatedQuestion(blockId, { options: newOpts }); }} placeholder={`אפשרות ${idx + 1}`} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // --- Helper for YouTube Links ---
    const getEmbedUrl = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : url;
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
                        <button onClick={() => addBlockAtIndex('interactive-chat', index)} className="insert-btn text-indigo-600 border-indigo-100 hover:bg-indigo-50"><IconChat className="w-4 h-4" /><span>צ'אט AI</span></button>
                        <button onClick={() => setActiveInsertIndex(null)} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors ml-2"><IconX className="w-5 h-5" /></button>
                    </div>
                ) : (
                    <button onClick={() => setActiveInsertIndex(index)} className="bg-white text-blue-600 border border-blue-200 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-sm hover:shadow-md hover:scale-105 transition-all hover:bg-blue-50 hover:border-blue-300">
                        <IconPlus className="w-4 h-4" /><span className="text-xs font-bold">הוסיפו רכיב</span>
                    </button>
                )}
            </div>
        </div>
    );

    const renderEmbeddedMedia = (blockId: string, metadata: any) => {
        if (!metadata?.media) return null;
        return (
            <div className="mb-4 relative rounded-xl overflow-hidden border border-gray-200 group">
                {metadata.mediaType === 'video' ? <video src={metadata.media} controls className="w-full h-48 bg-black" /> : <img src={metadata.media} alt="מדיה" className="w-full h-48 object-cover bg-gray-50" />}
                <button onClick={() => { const block = editedUnit.activityBlocks.find((b: any) => b.id === blockId); if (block) updateBlock(blockId, block.content, { media: null, mediaType: null }); }} className="absolute top-2 right-2 bg-white/80 p-1.5 rounded-full text-red-500 hover:bg-white hover:text-red-600 transition-colors shadow-sm opacity-0 group-hover:opacity-100"><IconTrash className="w-4 h-4" /></button>
            </div>
        );
    };

    if (isAutoGenerating) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
                <div className="relative mb-6"><div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div></div>
                <h2 className="text-2xl font-bold text-gray-800">ה-AI כותב את תוכן הפעילות...</h2>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8 font-sans pb-24 bg-gray-50/50">
            {/* Header */}
            <div className="sticky top-4 z-40 glass backdrop-blur-lg shadow-lg rounded-2xl p-4 flex justify-between items-center mb-10 border border-white/60 bg-white/80 gap-4">
                <div className="flex-1 min-w-0">
                    <input type="text" value={editedUnit.title} onChange={(e) => setEditedUnit({ ...editedUnit, title: e.target.value })} className="text-2xl font-bold text-gray-800 bg-transparent border-b border-transparent focus:border-blue-500 outline-none px-2 transition-colors placeholder-gray-400 w-full" placeholder="כותרת הפעילות" />
                    <div className="text-sm text-gray-500 px-2 mt-1 flex items-center gap-2">
                        <span>שכבת גיל: {gradeLevel}</span><span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        <span className={`font-bold ${showScoring ? 'text-blue-800' : 'text-green-700'}`}>{showScoring ? 'מצב מבחן' : 'מצב פעילות'}</span>
                    </div>
                </div>
                <div className="flex gap-3 flex-shrink-0">
                    {showScoring && (<button onClick={handleAutoDistributePoints} className="px-4 py-2 bg-yellow-100/80 hover:bg-yellow-200 text-yellow-800 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2 border border-yellow-200"><IconBalance className="w-4 h-4" />חלק ניקוד</button>)}

                    <button onClick={onCancel} className="px-5 py-2 rounded-xl text-gray-600 hover:bg-white/50 font-medium transition-colors flex items-center gap-2">
                        <IconBack className="w-4 h-4 rotate-180" /> {cancelLabel}
                    </button>

                    <button
                        onClick={handleSaveWithFeedback}
                        disabled={isSaving}
                        className={`px-6 py-2 rounded-xl shadow-lg font-bold transition-all hover:-translate-y-0.5 flex items-center gap-2 min-w-[140px] justify-center
                        ${saveSuccess
                                ? 'bg-green-600 text-white shadow-green-200'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}
                    >
                        {isSaving ? (
                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> שומר...</>
                        ) : saveSuccess ? (
                            <><IconCheck className="w-4 h-4" /> נשמר!</>
                        ) : (
                            <><IconSave className="w-4 h-4" /> שמרו שינויים</>
                        )}
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
                <InsertMenu index={0} />

                {editedUnit.activityBlocks?.map((block: any, index: number) => (
                    <React.Fragment key={block.id}>
                        <div className="glass p-6 rounded-2xl shadow-sm border border-white/60 hover:shadow-xl hover:border-blue-200 transition-all relative group bg-white/80">
                            {/* Controls */}
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
                                        <textarea className="w-full p-4 border border-gray-200/60 bg-white/50 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-gray-700 leading-relaxed resize-y min-h-[120px]" value={block.content || ''} onChange={(e) => updateBlock(block.id, e.target.value)} placeholder="כתבו כאן את תוכן הפעילות..." />
                                        {renderEmbeddedMedia(block.id, block.metadata)}
                                        <div className="flex flex-wrap items-center gap-2 mt-3 bg-blue-50/40 p-2 rounded-xl border border-blue-100/50 backdrop-blur-sm justify-between">
                                            <div className="flex gap-2 items-center">
                                                <div className="flex items-center gap-1 text-blue-600 px-2 font-bold text-xs"><IconSparkles className="w-4 h-4" /> AI:</div>
                                                {AI_ACTIONS.map(action => (<button key={action.label} onClick={() => handleAiAction(block.id, block.content, action.prompt)} disabled={loadingBlockId === block.id} className="text-xs bg-white/80 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors font-medium shadow-sm disabled:opacity-50">{loadingBlockId === block.id ? '...' : action.label}</button>))}
                                            </div>
                                            <div className="flex gap-1 border-r border-blue-200 pr-2">
                                                <label className={mediaBtnClass} title="הוסיפו תמונה"><IconImage className="w-4 h-4" /><input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, block.id, 'metadata')} /></label>
                                                <label className={mediaBtnClass} title="הוסיפו וידאו"><IconVideo className="w-4 h-4" /><input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, block.id, 'metadata')} /></label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* IMAGE BLOCK IMPROVED */}
                                {block.type === 'image' && (
                                    <div className="p-2">
                                        {!block.content ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-48">
                                                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all group">
                                                    <IconUpload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-2" />
                                                    <span className="font-bold text-gray-500 group-hover:text-blue-600">העלאת תמונה</span>
                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, block.id)} />
                                                </label>
                                                <button onClick={() => setMediaInputMode({ ...mediaInputMode, [block.id]: 'ai' })} className="flex flex-col items-center justify-center border-2 border-dashed border-purple-200 rounded-xl bg-purple-50/50 hover:bg-purple-50 hover:border-purple-300 transition-all group">
                                                    <IconPalette className="w-8 h-8 text-purple-400 group-hover:text-purple-600 mb-2" />
                                                    <span className="font-bold text-purple-500 group-hover:text-purple-700">יצירה ב-AI</span>
                                                </button>
                                                {mediaInputMode[block.id] === 'ai' && (
                                                    <div className="col-span-2 bg-white p-4 rounded-xl border border-purple-100 shadow-lg absolute inset-0 z-10 flex flex-col justify-center">
                                                        <h4 className="text-sm font-bold text-purple-700 mb-2">תאר את התמונה שברצונך ליצור:</h4>
                                                        <textarea className="w-full p-2 border rounded-lg mb-2 text-sm" rows={2} placeholder="ילד רץ בשדה חמניות..." onChange={(e) => setMediaInputValue({ ...mediaInputValue, [block.id]: e.target.value })}></textarea>
                                                        <div className="flex gap-2 justify-end">
                                                            <button onClick={() => setMediaInputMode({ ...mediaInputMode, [block.id]: null })} className="text-gray-500 text-xs hover:bg-gray-100 px-3 py-1 rounded">ביטול</button>
                                                            <button onClick={() => { updateBlock(block.id, "https://via.placeholder.com/800x400?text=AI+Generated+Image"); setMediaInputMode({ ...mediaInputMode, [block.id]: null }); }} className="bg-purple-600 text-white text-xs px-4 py-1.5 rounded-lg font-bold">צור תמונה (סימולציה)</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <img src={block.content} className="w-full h-64 object-cover rounded-xl shadow-md bg-gray-100" alt="Block Media" />
                                                <div className="mt-3">
                                                    <input type="text" className="w-full bg-transparent border-b border-gray-200 focus:border-blue-400 outline-none p-1 text-sm text-center text-gray-600 placeholder-gray-400" placeholder="הוסיפו כיתוב לתמונה..." value={block.metadata?.caption || ''} onChange={(e) => updateBlock(block.id, block.content, { caption: e.target.value })} />
                                                </div>
                                            </div>
                                        )}

                                        {block.content && !block.metadata?.relatedQuestion && (
                                            <div className="flex justify-center mt-4">
                                                <div className="flex gap-2 bg-white border border-gray-200 rounded-full p-1 shadow-sm">
                                                    <button onClick={() => handleAddRelatedQuestion(block.id, 'open-question')} className="px-3 py-1 rounded-full text-xs font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">הוסף שאלה פתוחה</button>
                                                    <div className="w-px bg-gray-200"></div>
                                                    <button onClick={() => handleAddRelatedQuestion(block.id, 'multiple-choice')} className="px-3 py-1 rounded-full text-xs font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">הוסף שאלה אמריקאית</button>
                                                </div>
                                            </div>
                                        )}

                                        {renderRelatedQuestionEditor(block.id, block.metadata?.relatedQuestion)}
                                    </div>
                                )}

                                {/* VIDEO BLOCK IMPROVED */}
                                {block.type === 'video' && (
                                    <div className="p-2">
                                        {!block.content ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-48">
                                                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all group">
                                                    {uploadingBlockId === block.id ? <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div> : <IconUpload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-2" />}
                                                    <span className="font-bold text-gray-500 group-hover:text-blue-600">העלאת קובץ (עד 50MB)</span>
                                                    <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, block.id)} />
                                                </label>
                                                <button onClick={() => setMediaInputMode({ ...mediaInputMode, [block.id]: 'link' })} className="flex flex-col items-center justify-center border-2 border-dashed border-red-200 rounded-xl bg-red-50/50 hover:bg-red-50 hover:border-red-300 transition-all group">
                                                    <IconLink className="w-8 h-8 text-red-400 group-hover:text-red-600 mb-2" />
                                                    <span className="font-bold text-red-500 group-hover:text-red-700">קישור חיצוני (YouTube)</span>
                                                </button>
                                                {mediaInputMode[block.id] === 'link' && (
                                                    <div className="col-span-2 bg-white p-4 rounded-xl border border-red-100 shadow-lg absolute inset-0 z-10 flex flex-col justify-center">
                                                        <h4 className="text-sm font-bold text-red-700 mb-2">הדבק קישור (YouTube / Vimeo):</h4>
                                                        <input type="text" className="w-full p-2 border rounded-lg mb-2 text-sm" placeholder="https://www.youtube.com/watch?v=..." onChange={(e) => setMediaInputValue({ ...mediaInputValue, [block.id]: e.target.value })} />
                                                        <div className="flex gap-2 justify-end">
                                                            <button onClick={() => setMediaInputMode({ ...mediaInputMode, [block.id]: null })} className="text-gray-500 text-xs hover:bg-gray-100 px-3 py-1 rounded">ביטול</button>
                                                            <button onClick={() => { updateBlock(block.id, getEmbedUrl(mediaInputValue[block.id] || ""), { mediaType: 'video' }); setMediaInputMode({ ...mediaInputMode, [block.id]: null }); }} className="bg-red-600 text-white text-xs px-4 py-1.5 rounded-lg font-bold">הטמע וידאו</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                {block.content.includes('youtube') || block.content.includes('vimeo') ? (
                                                    <iframe src={block.content} className="w-full h-64 rounded-xl shadow-md bg-black" allowFullScreen title="Video Player"></iframe>
                                                ) : (
                                                    <video src={block.content} controls className="w-full h-64 bg-black rounded-xl shadow-md" />
                                                )}
                                                <div className="mt-3">
                                                    <input type="text" className="w-full bg-transparent border-b border-gray-200 focus:border-blue-400 outline-none p-1 text-sm text-center text-gray-600 placeholder-gray-400" placeholder="הוסיפו כיתוב לוידאו..." value={block.metadata?.caption || ''} onChange={(e) => updateBlock(block.id, block.content, { caption: e.target.value })} />
                                                </div>
                                            </div>
                                        )}

                                        {block.content && !block.metadata?.relatedQuestion && (
                                            <div className="flex justify-center mt-4">
                                                <div className="flex gap-2 bg-white border border-gray-200 rounded-full p-1 shadow-sm">
                                                    <button onClick={() => handleAddRelatedQuestion(block.id, 'open-question')} className="px-3 py-1 rounded-full text-xs font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">הוסף שאלה פתוחה</button>
                                                    <div className="w-px bg-gray-200"></div>
                                                    <button onClick={() => handleAddRelatedQuestion(block.id, 'multiple-choice')} className="px-3 py-1 rounded-full text-xs font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">הוסף שאלה אמריקאית</button>
                                                </div>
                                            </div>
                                        )}

                                        {renderRelatedQuestionEditor(block.id, block.metadata?.relatedQuestion)}
                                    </div>
                                )}

                                {/* CHAT BLOCK - BLUE/INDIGO THEME (NO ORANGE) */}
                                {block.type === 'interactive-chat' && (
                                    <div className="bg-gradient-to-r from-indigo-50/80 to-blue-50/80 p-5 rounded-xl border border-indigo-100 backdrop-blur-sm">

                                        {/* Status Banner - VISUAL REFERENCE */}
                                        {showScoring ? (
                                            <div className="flex items-center gap-2 bg-slate-100 p-3 rounded-lg text-slate-700 mb-4 border border-slate-200 shadow-sm">
                                                <div className="bg-slate-200 p-1.5 rounded-full"><IconShield className="w-5 h-5 text-slate-600" /></div>
                                                <div className="flex-1">
                                                    <span className="font-bold text-sm block">מצב מבחן פעיל</span>
                                                    <span className="text-xs text-slate-500">הבוט מוגדר כמשגיח: חסום למתן תשובות.</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 bg-white/60 p-3 rounded-lg text-indigo-800 mb-4 border border-indigo-100 shadow-sm">
                                                <div className="bg-indigo-100 p-1.5 rounded-full"><IconRobot className="w-5 h-5 text-indigo-600" /></div>
                                                <div className="flex-1">
                                                    <span className="font-bold text-sm block">מצב פעילות פעיל</span>
                                                    <span className="text-xs text-indigo-600">הבוט מוגדר כמנחה מלווה ומסייע בפעילות.</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-indigo-700 block mb-1">כותרת הבוט (תוצג למשתתפים)</label>
                                                <input type="text" className="w-full p-2.5 border border-indigo-200 rounded-lg bg-white/70 focus:bg-white transition-colors text-gray-800 font-medium" value={block.content.title || ''} onChange={(e) => updateBlock(block.id, { ...block.content, title: e.target.value })} placeholder="למשל: המנחה המלווה שלך" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div className={showScoring ? 'opacity-50 pointer-events-none grayscale' : ''}>
                                                <label className="text-xs font-bold text-indigo-700 block mb-1 flex justify-between">
                                                    <span>תפקיד הבוט (Persona)</span>
                                                    {showScoring && <span className="text-slate-500 flex items-center gap-1"><IconLock className="w-3 h-3" /> נעול במבחן</span>}
                                                </label>
                                                <select className="w-full p-2.5 border border-indigo-200 rounded-lg bg-white/70 focus:bg-white transition-colors cursor-pointer text-sm" value={block.metadata?.botPersona || 'teacher'} onChange={(e) => handlePersonaChange(block.id, e.target.value, block.content, block.metadata)} disabled={showScoring}>
                                                    <option value="teacher">מנחה פעילות</option>
                                                    <option value="socratic">מנחה סוקרטי (שואל שאלות)</option>
                                                    <option value="historical">דמות היסטורית</option>
                                                    <option value="debate">יריב לדיבייט</option>
                                                </select>
                                            </div>

                                            {block.metadata?.botPersona === 'historical' && !showScoring && (
                                                <div className="animate-scale-in">
                                                    <label className="text-xs font-bold text-indigo-700 block mb-1">שם הדמות</label>
                                                    <input type="text" className="w-full p-2.5 border border-indigo-200 rounded-lg bg-white/70 focus:bg-white transition-colors text-sm" placeholder="למשל: הרצל..." onChange={(e) => updateBlock(block.id, block.content, { systemPrompt: `אתה ${e.target.value}. דבר בגוף ראשון.` })} />
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-indigo-700 block mb-1">הודעת פתיחה למשתתפים</label>
                                            <input type="text" className="w-full p-2.5 border border-indigo-200 rounded-lg bg-white/70 text-sm focus:bg-white transition-colors" value={block.metadata?.initialMessage || ''} onChange={(e) => updateBlock(block.id, block.content, { initialMessage: e.target.value })} />
                                        </div>
                                    </div>
                                )}

                                {/* QUESTIONS - TEAL THEME (NO ORANGE) */}
                                {(block.type === 'multiple-choice' || block.type === 'open-question') && (
                                    <div className={`${block.type === 'multiple-choice' ? 'bg-sky-50/40 border-sky-100' : 'bg-teal-50/40 border-teal-100'} p-5 rounded-xl border backdrop-blur-sm`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1 flex gap-2">
                                                <div className={`mt-1 ${block.type === 'multiple-choice' ? 'text-sky-500' : 'text-teal-500'}`}>{block.type === 'multiple-choice' ? <IconList className="w-5 h-5" /> : <IconEdit className="w-5 h-5" />}</div>
                                                <input type="text" className="flex-1 font-bold text-lg p-1 bg-transparent border-b border-transparent focus:border-gray-300 outline-none text-gray-800 placeholder-gray-400" value={block.content.question} onChange={(e) => updateBlock(block.id, { ...block.content, question: e.target.value })} placeholder={block.type === 'multiple-choice' ? "כתבו שאלה אמריקאית..." : "כתבו שאלה פתוחה..."} />
                                            </div>
                                            {showScoring && (<div className="flex flex-col items-center ml-2 bg-white/50 p-1 rounded-lg border border-gray-100"><span className="text-[10px] font-bold text-gray-400 uppercase">ניקוד</span><input type="number" className="w-12 text-center p-1 rounded border-none bg-transparent text-sm font-bold" value={block.metadata?.score || 0} onChange={(e) => updateBlock(block.id, block.content, { score: Number(e.target.value) })} /></div>)}
                                        </div>
                                        {renderEmbeddedMedia(block.id, block.metadata)}

                                        {block.type === 'multiple-choice' && (
                                            <div className="space-y-2 pr-7">
                                                {!block.content.question && (<div className="flex justify-end mb-4"><button onClick={() => handleAutoGenerateMCQuestion(block.id)} disabled={loadingBlockId === block.id} className="bg-sky-100 text-sky-700 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-sky-200 transition-colors"><IconSparkles className="w-3 h-3" /> צרו שאלה</button></div>)}
                                                {block.content.options?.map((opt: string, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-3 group/option">
                                                        <button onClick={() => updateBlock(block.id, { ...block.content, correctAnswer: opt })} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${block.content.correctAnswer === opt ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300'}`}>{block.content.correctAnswer === opt && <IconCheck className="w-3.5 h-3.5" />}</button>
                                                        <input type="text" className={`flex-1 p-2 text-sm border rounded-lg bg-white/80 focus:bg-white outline-none ${block.content.correctAnswer === opt ? 'border-green-200' : 'border-gray-200'}`} value={opt} onChange={(e) => { const newOptions = [...block.content.options]; newOptions[idx] = e.target.value; updateBlock(block.id, { ...block.content, options: newOptions }); }} placeholder={`אפשרות ${idx + 1}`} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {block.type === 'open-question' && (
                                            <div className="pr-7 mt-2">
                                                {!block.content.question && (<div className="flex justify-end mb-2"><button onClick={() => handleAutoGenerateOpenQuestion(block.id)} disabled={loadingBlockId === block.id} className="bg-teal-100 text-teal-700 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-teal-200 transition-colors"><IconSparkles className="w-3 h-3" /> צרו שאלה</button></div>)}
                                                <label className="text-xs font-bold text-gray-400 mb-1 block flex items-center gap-1"><IconBrain className="w-3 h-3" /> תשובה לדוגמה:</label>
                                                <textarea className="w-full p-3 border border-gray-200/80 rounded-xl bg-white/80 text-sm focus:bg-white transition-colors outline-none focus:border-teal-300" rows={2} value={block.metadata?.modelAnswer || ''} onChange={(e) => updateBlock(block.id, block.content, { modelAnswer: e.target.value })} placeholder="כתבו כאן את התשובה המצופה..." />
                                            </div>
                                        )}
                                        <div className="mt-3 pt-3 border-t border-gray-200/50 flex justify-between items-center">
                                            <span className="text-xs text-gray-400 font-bold">הוסיפו מדיה לשאלה:</span>
                                            <div className="flex gap-2">
                                                <label className={mediaBtnClass} title="הוסיפו תמונה"><IconImage className="w-4 h-4" /> תמונה<input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, block.id, 'metadata')} /></label>
                                                <label className={mediaBtnClass} title="הוסיפו וידאו"><IconVideo className="w-4 h-4" /> וידאו<input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, block.id, 'metadata')} /></label>
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