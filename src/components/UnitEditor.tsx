import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCourseStore } from '../context/CourseContext';
import {
    generateImagePromptBlock, refineContentWithPedagogy,
    generateSingleOpenQuestion, generateSingleMultipleChoiceQuestion, generateFullUnitContent,
    generateAiImage, BOT_PERSONAS
} from '../gemini';
import { uploadMediaFile } from '../firebaseUtils';
import {
    IconEdit, IconTrash, IconPlus, IconImage, IconVideo, IconText,
    IconChat, IconList, IconSparkles, IconUpload, IconArrowUp,
    IconArrowDown, IconCheck, IconX, IconSave, IconBack,
    IconRobot, IconPalette, IconBalance, IconBrain, IconLink, IconWand, IconEye, IconClock, IconLayer
} from '../icons';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { createPortal } from 'react-dom';

// --- הגדרות מקומיות ---
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
    subject?: string;
    onSave: (updatedUnit: any) => void;
    onCancel: () => void;
    onPreview?: () => void;
    cancelLabel?: string;
}

const getAiActions = (gradeLevel: string) => [
    { label: "שפר ניסוח", prompt: `שפר את הניסוח שיהיה זורם, מקצועי ומותאם לתלמידי ${gradeLevel}` },
    { label: "קצר טקסט", prompt: "קצר את הטקסט תוך שמירה על המסר העיקרי" },
    { label: "פשט שפה", prompt: `פשט את השפה והמושגים לרמה של תלמידי ${gradeLevel}, הסבר מילים קשות` },
    { label: "העמק תוכן", prompt: `הוסף עומק, דוגמאות והקשר רחב יותר` },
];

const UnitEditor: React.FC<UnitEditorProps> = ({ unit, gradeLevel = "כללי", subject, onSave, onCancel, onPreview, cancelLabel = "חזרה" }) => {
    const { course } = useCourseStore();
    const [editedUnit, setEditedUnit] = useState<any>(unit);
    const [loadingBlockId, setLoadingBlockId] = useState<string | null>(null);
    const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
    const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null);
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);

    // מצבי עריכה למדיה: כעת תומך בערכים מורכבים יותר (image_ai, video_link וכו')
    const [mediaInputMode, setMediaInputMode] = useState<Record<string, string | null>>({});
    const [mediaInputValue, setMediaInputValue] = useState<Record<string, string>>({});

    const hasInitialized = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // --- Assignment Modal State (Ported) ---
    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
    const [assignmentData, setAssignmentData] = useState({
        title: unit.title || '',
        dueDate: new Date().toISOString().split('T')[0],
        dueTime: '23:59',
        instructions: ''
    });

    const handleCopyLinkClick = () => {
        setAssignmentData(prev => ({ ...prev, title: `הגשה: ${unit.title || editedUnit.title}` }));
        setAssignmentModalOpen(true);
    };

    const handleCreateAssignment = async () => {
        if (!assignmentData.title || !assignmentData.dueDate) return alert("חסרים פרטים");
        try {
            const combinedDate = new Date(`${assignmentData.dueDate}T${assignmentData.dueTime}`);
            const docRef = await addDoc(collection(db, "assignments"), {
                courseId: course.id, // Using current course ID
                title: assignmentData.title,
                dueDate: combinedDate.toISOString(),
                instructions: assignmentData.instructions,
                createdAt: serverTimestamp(),
                teacherId: course.teacherId || "unknown"
            });
            const link = `${window.location.origin}/?assignmentId=${docRef.id}`;
            navigator.clipboard.writeText(link);
            setAssignmentModalOpen(false);
            alert("קישור משימה הועתק ללוח!");
        } catch (e) {
            console.error("Error creating assignment", e);
            alert("שגיאה ביצירת המשימה");
        }
    };

    if (!course) return null;

    const showScoring = course.mode === 'exam' || unit.type === 'test';
    const AI_ACTIONS = getAiActions(gradeLevel);
    const mediaBtnClass = "cursor-pointer bg-white text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-all shadow-sm";

    // --- חישוב ניקוד בזמן אמת ---
    const totalScore = React.useMemo(() => {
        if (!editedUnit.activityBlocks) return 0;
        return editedUnit.activityBlocks.reduce((sum: number, block: any) => sum + (block.metadata?.score || 0), 0);
    }, [editedUnit.activityBlocks]);

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
        const qCount = questions.length;
        if (qCount === 0) return alert("אין שאלות ביחידה זו לחלוקת ניקוד.");

        const targetTotalStr = prompt("מה סך הניקוד הכולל ליחידה זו?", "100");
        const targetTotal = parseInt(targetTotalStr || "0");
        if (!targetTotal || targetTotal <= 0) return;

        // משקלות: פתוחה = 2, אמריקאית = 1
        const totalWeight = questions.reduce((sum: number, block: any) => sum + (block.type === 'open-question' ? 2 : 1), 0);
        const pointPerWeight = Math.floor(targetTotal / totalWeight);

        let currentSum = 0;

        // 1. חלוקה ראשונית לפי משקולות (מעוגל למטה)
        const newBlocks = editedUnit.activityBlocks.map((block: any) => {
            if (block.type === 'multiple-choice' || block.type === 'open-question') {
                const weight = block.type === 'open-question' ? 2 : 1;
                const score = pointPerWeight * weight;
                currentSum += score;
                return { ...block, metadata: { ...block.metadata, score } };
            }
            return block;
        });

        // 2. חלוקת שארית (Round Robin)
        let remainder = targetTotal - currentSum;
        let i = 0;
        while (remainder > 0) {
            const blockIndex = newBlocks.findIndex((b: any, idx: number) => (b.type === 'multiple-choice' || b.type === 'open-question') && idx >= i);

            // אם מצאנו בבלוק נוכחי או הבא
            if (blockIndex !== -1) {
                newBlocks[blockIndex].metadata.score += 1;
                remainder -= 1;
                i = blockIndex + 1;
            } else {
                i = 0; // התחל מחדש אם הגענו לסוף
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

    const generatePedagogicalPrompt = (personaId: string, customCharName: string = ""): string => {
        const baseInfo = `אתה מנחה פעילות עבור משתתפים בשכבת גיל: ${gradeLevel}. הנושא הנלמד: "${editedUnit.title}".`;
        const safetyProtocol = `פרוטוקול בטיחות (חובה): 1. שמור על שפה מכבדת. 2. אם המשתתף מביע מצוקה או אלימות - הפסק את השיח ופנה לגורם אחראי.`;
        let specificInstructions = "";

        if (showScoring) {
            specificInstructions = `מצב מבחן (EXAM MODE): תפקידך הוא משגיח וסייען טכני בלבד. איסור מוחלט לתת תשובות או רמזים.`;
        } else {
            const persona = BOT_PERSONAS[personaId as keyof typeof BOT_PERSONAS] || BOT_PERSONAS.socratic;
            if (personaId === 'historical') {
                specificInstructions = `כנס לדמות של ${customCharName || 'דמות היסטורית'}.`;
            } else {
                specificInstructions = persona.systemPrompt;
            }
        }
        return `${baseInfo}\n${specificInstructions}\n${safetyProtocol}`;
    };

    const addBlockAtIndex = (type: string, index: number) => {
        // Use course default persona if available, otherwise Socratic
        const initialPersonaId = course.botPersona || 'socratic';
        const personaData = BOT_PERSONAS[initialPersonaId as keyof typeof BOT_PERSONAS] || BOT_PERSONAS.socratic;

        const safeSystemPrompt = type === 'interactive-chat' ? generatePedagogicalPrompt(initialPersonaId) : '';
        const newBlock = {
            id: uuidv4(),
            type: type,
            content: type === 'multiple-choice' ? { question: '', options: ['', '', '', ''], correctAnswer: '' }
                : type === 'open-question' ? { question: '' }
                    : type === 'interactive-chat' ? { title: personaData.name, description: 'צ\'אט...' }
                        : type === 'fill_in_blanks' ? "השלימו את המשפט: [מילה] חסרה."
                            : type === 'ordering' ? { instruction: 'סדרו את ...', correct_order: ['פריט 1', 'פריט 2', 'פריט 3'] }
                                : type === 'categorization' ? { question: 'מיינו לקטגוריות...', categories: ['קטגוריה 1', 'קטגוריה 2'], items: [{ text: 'פריט 1', category: 'קטגוריה 1' }] }
                                    : type === 'memory_game' ? { pairs: [{ card_a: 'חתול', card_b: 'Cat' }, { card_a: 'כלב', card_b: 'Dog' }] }
                                        : '',
            metadata: {
                score: 0,
                systemPrompt: safeSystemPrompt,
                initialMessage: showScoring ? 'אני כאן להשגחה בלבד.' : personaData.initialMessage,
                botPersona: initialPersonaId,
                caption: '',
                relatedQuestion: null
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
    const handleAutoGenerateOpenQuestion = async (blockId: string) => {
        setLoadingBlockId(blockId);
        try {
            const result = await generateSingleOpenQuestion(editedUnit.title);
            if (result) {
                updateBlock(blockId, { question: result.question }, { modelAnswer: result.modelAnswer });
            } else {
                alert("אירעה שגיאה ביצירת השאלה. אנא נסו שוב.");
            }
        } catch (e) {
            alert("שגיאה");
        } finally {
            setLoadingBlockId(null);
        }
    };
    const handleAutoGenerateMCQuestion = async (blockId: string) => {
        setLoadingBlockId(blockId);
        try {
            const result = await generateSingleMultipleChoiceQuestion(editedUnit.title);
            if (result) {
                updateBlock(blockId, { question: result.question, options: result.options, correctAnswer: result.correctAnswer });
            } else {
                alert("אירעה שגיאה ביצירת השאלה. אנא נסו שוב.");
            }
        } catch (e) {
            alert("שגיאה");
        } finally {
            setLoadingBlockId(null);
        }
    };

    // --- שדרוג: טיפול ביצירת תמונה ב-AI (תומך גם בתוכן ראשי וגם במטא-דאטה לשאלות) ---
    const handleGenerateAiImage = async (blockId: string, targetField: 'content' | 'metadata' = 'content') => {
        const prompt = mediaInputValue[blockId];
        if (!prompt) return;

        setLoadingBlockId(blockId);
        try {
            const imageBlob = await generateAiImage(prompt);
            if (!imageBlob) throw new Error("Failed to generate image");

            const fileName = `ai_gen_${uuidv4()}.png`;
            const file = new File([imageBlob], fileName, { type: "image/png" });
            const url = await uploadMediaFile(file, 'images');

            // עדכון בהתאם ליעד (תוכן ראשי או מטא-דאטה של שאלה)
            if (targetField === 'content') {
                updateBlock(blockId, url, { mediaType: 'image', aiPrompt: prompt });
            } else {
                const block = editedUnit.activityBlocks.find((b: any) => b.id === blockId);
                if (block) updateBlock(blockId, block.content, { media: url, mediaType: 'image', aiPrompt: prompt });
            }

            setMediaInputMode((prev: any) => ({ ...prev, [blockId]: null }));
        } catch (error) {
            console.error("AI Generation Error:", error);
            alert("שגיאה ביצירת התמונה. נסה שוב.");
        } finally {
            setLoadingBlockId(null);
        }
    };

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

    const renderRelatedQuestionEditor = (blockId: string, relatedQ: any) => {
        if (!relatedQ) return null;
        return (
            <div className="mt-4 pt-4 border-t border-gray-100 bg-gray-50/50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><IconSparkles className="w-3 h-3" /> שאלה משויכת</span>
                    <button onClick={() => removeRelatedQuestion(blockId)} className="text-red-400 hover:text-red-600 p-1"><IconTrash className="w-3 h-3" /></button>
                </div>
                <input type="text" className="w-full font-bold p-2 bg-white border border-gray-200 rounded-lg mb-2 focus:border-blue-400 outline-none" value={relatedQ.question} onChange={(e) => updateRelatedQuestion(blockId, { question: e.target.value })} placeholder="כתבו את השאלה כאן..." />
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

    const getEmbedUrl = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : url;
    };

    // --- New: Unified Media Toolbar for Questions (Upload / AI / Link) ---
    const renderMediaToolbar = (blockId: string) => {
        const mode = mediaInputMode[blockId]; // 'image_select', 'video_select', 'image_ai', 'video_link'

        // 1. מצב התחלתי - בחירה בין תמונה לוידאו
        if (!mode) {
            return (
                <div className="flex gap-2">
                    <button onClick={() => setMediaInputMode({ ...mediaInputMode, [blockId]: 'image_select' })} className={mediaBtnClass} title="הוסיפו תמונה"><IconImage className="w-4 h-4" /> תמונה</button>
                    <button onClick={() => setMediaInputMode({ ...mediaInputMode, [blockId]: 'video_select' })} className={mediaBtnClass} title="הוסיפו וידאו"><IconVideo className="w-4 h-4" /> וידאו</button>
                </div>
            );
        }

        // 2. תפריט משנה לתמונה (העלאה או AI)
        if (mode === 'image_select') {
            return (
                <div className="flex gap-2 bg-blue-50 p-1 rounded-lg animate-scale-in">
                    <label className={mediaBtnClass}><IconUpload className="w-4 h-4" /> העלאה<input type="file" accept="image/*" className="hidden" onChange={(e) => { handleFileUpload(e, blockId, 'metadata'); setMediaInputMode({ ...mediaInputMode, [blockId]: null }); }} /></label>
                    <button onClick={() => setMediaInputMode({ ...mediaInputMode, [blockId]: 'image_ai' })} className={mediaBtnClass}><IconPalette className="w-4 h-4" /> צור ב-AI</button>
                    <button onClick={() => setMediaInputMode({ ...mediaInputMode, [blockId]: null })} className="p-1.5 text-gray-400 hover:text-red-500"><IconX className="w-4 h-4" /></button>
                </div>
            );
        }

        // 3. תפריט משנה לוידאו (העלאה או קישור)
        if (mode === 'video_select') {
            return (
                <div className="flex gap-2 bg-blue-50 p-1 rounded-lg animate-scale-in">
                    <label className={mediaBtnClass}><IconUpload className="w-4 h-4" /> העלאה<input type="file" accept="video/*" className="hidden" onChange={(e) => { handleFileUpload(e, blockId, 'metadata'); setMediaInputMode({ ...mediaInputMode, [blockId]: null }); }} /></label>
                    <button onClick={() => setMediaInputMode({ ...mediaInputMode, [blockId]: 'video_link' })} className={mediaBtnClass}><IconLink className="w-4 h-4" /> קישור</button>
                    <button onClick={() => setMediaInputMode({ ...mediaInputMode, [blockId]: null })} className="p-1.5 text-gray-400 hover:text-red-500"><IconX className="w-4 h-4" /></button>
                </div>
            );
        }

        // 4. ממשק יצירת AI (פרומפט)
        if (mode === 'image_ai') {
            return (
                <div className="flex flex-col gap-2 w-full bg-blue-50 p-3 rounded-lg border border-blue-100 animate-scale-in mt-2">
                    <span className="text-xs font-bold text-blue-600">תיאור התמונה ליצירה:</span>
                    <div className="flex gap-2">
                        <input type="text" className="flex-1 p-2 border rounded text-sm" placeholder="למשל: תא ביולוגי מתחת למיקרוסקופ..." onChange={(e) => setMediaInputValue({ ...mediaInputValue, [blockId]: e.target.value })} />
                        <button onClick={() => handleGenerateAiImage(blockId, 'metadata')} disabled={loadingBlockId === blockId} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold whitespace-nowrap">{loadingBlockId === blockId ? '...' : 'צור'}</button>
                        <button onClick={() => setMediaInputMode({ ...mediaInputMode, [blockId]: null })} className="text-gray-400 hover:text-red-500"><IconX className="w-5 h-5" /></button>
                    </div>
                </div>
            );
        }

        // 5. ממשק קישור לוידאו
        if (mode === 'video_link') {
            return (
                <div className="flex flex-col gap-2 w-full bg-blue-50 p-3 rounded-lg border border-blue-100 animate-scale-in mt-2">
                    <span className="text-xs font-bold text-blue-600">קישור ל-YouTube:</span>
                    <div className="flex gap-2">
                        <input type="text" className="flex-1 p-2 border rounded text-sm" placeholder="https://youtube.com/..." onChange={(e) => setMediaInputValue({ ...mediaInputValue, [blockId]: e.target.value })} />
                        <button onClick={() => {
                            const block = editedUnit.activityBlocks.find((b: any) => b.id === blockId);
                            if (block) updateBlock(blockId, block.content, { media: getEmbedUrl(mediaInputValue[blockId] || ""), mediaType: 'video' });
                            setMediaInputMode({ ...mediaInputMode, [blockId]: null });
                        }} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold whitespace-nowrap">הטמע</button>
                        <button onClick={() => setMediaInputMode({ ...mediaInputMode, [blockId]: null })} className="text-gray-400 hover:text-red-500"><IconX className="w-5 h-5" /></button>
                    </div>
                </div>
            );
        }

        return null;
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
                        <button onClick={() => addBlockAtIndex('multiple-choice', index)} className="insert-btn"><IconList className="w-4 h-4" /><span>אמריקאית</span></button>
                        <button onClick={() => addBlockAtIndex('open-question', index)} className="insert-btn"><IconEdit className="w-4 h-4" /><span>פתוחה</span></button>
                        <button onClick={() => addBlockAtIndex('interactive-chat', index)} className="insert-btn"><IconChat className="w-4 h-4" /><span>צ'אט AI</span></button>

                        <button onClick={() => addBlockAtIndex('fill_in_blanks', index)} className="insert-btn"><IconEdit className="w-4 h-4" /><span>השלמה</span></button>
                        <button onClick={() => addBlockAtIndex('ordering', index)} className="insert-btn"><IconList className="w-4 h-4" /><span>סידור</span></button>
                        <button onClick={() => addBlockAtIndex('categorization', index)} className="insert-btn"><IconLayer className="w-4 h-4" /><span>מיון</span></button>
                        <button onClick={() => addBlockAtIndex('memory_game', index)} className="insert-btn"><IconBrain className="w-4 h-4" /><span>זיכרון</span></button>

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
                        <span>שכבת גיל: {gradeLevel}</span>
                        {subject && (
                            <>
                                <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                <span>תחום דעת: {subject}</span>
                            </>
                        )}
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        <span className={`font-bold ${showScoring ? 'text-blue-800' : 'text-green-700'}`}>{showScoring ? 'מצב מבחן' : 'מצב פעילות'}</span>
                    </div>
                </div>
                <div className="flex gap-3 flex-shrink-0">
                    {showScoring && (<button onClick={handleAutoDistributePoints} className="px-4 py-2 bg-yellow-100/80 hover:bg-yellow-200 text-yellow-800 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2 border border-yellow-200"><IconBalance className="w-4 h-4" />חלק ניקוד</button>)}

                    <button onClick={onCancel} className="px-5 py-2 rounded-xl text-gray-600 hover:bg-white/50 font-medium transition-colors flex items-center gap-2">
                        <IconBack className="w-4 h-4 rotate-180" /> חזרה
                    </button>

                    {onPreview && (
                        <button onClick={onPreview} className="px-5 py-2 rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 font-bold transition-colors flex items-center gap-2 border border-blue-200">
                            <IconEye className="w-4 h-4" /> תצוגת תלמיד
                        </button>
                    )}

                    <button onClick={handleCopyLinkClick} className="px-5 py-2 rounded-xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-bold transition-colors flex items-center gap-2 border border-indigo-200">
                        <IconLink className="w-4 h-4" /> קישור לתלמיד
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
                                                {renderMediaToolbar(block.id)}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* IMAGE BLOCK IMPROVED - REAL AI GENERATION */}
                                {block.type === 'image' && (
                                    <div className="p-2">
                                        {!block.content ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-48">
                                                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all group">
                                                    <IconUpload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-2" />
                                                    <span className="font-bold text-gray-500 group-hover:text-blue-600">העלאת תמונה</span>
                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, block.id)} />
                                                </label>
                                                <button onClick={() => setMediaInputMode({ ...mediaInputMode, [block.id]: 'ai' })} className="flex flex-col items-center justify-center border-2 border-dashed border-blue-200 rounded-xl bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 transition-all group">
                                                    <IconPalette className="w-8 h-8 text-blue-400 group-hover:text-blue-600 mb-2" />
                                                    <span className="font-bold text-blue-500 group-hover:text-blue-700">יצירה ב-AI</span>
                                                </button>
                                                {mediaInputMode[block.id] === 'ai' && (
                                                    <div className="col-span-2 bg-white p-4 rounded-xl border border-blue-100 shadow-lg absolute inset-0 z-10 flex flex-col justify-center">
                                                        <h4 className="text-sm font-bold text-blue-700 mb-2">תאר את התמונה שברצונך ליצור:</h4>
                                                        <textarea className="w-full p-2 border rounded-lg mb-2 text-sm focus:border-blue-400 outline-none" rows={2} placeholder="ילד רץ בשדה חמניות..." onChange={(e) => setMediaInputValue({ ...mediaInputValue, [block.id]: e.target.value })}></textarea>
                                                        <div className="flex gap-2 justify-end">
                                                            <button onClick={() => setMediaInputMode({ ...mediaInputMode, [block.id]: null })} className="text-gray-500 text-xs hover:bg-gray-100 px-3 py-1 rounded">ביטול</button>
                                                            <button
                                                                onClick={() => handleGenerateAiImage(block.id, 'content')}
                                                                disabled={loadingBlockId === block.id}
                                                                className="bg-blue-600 text-white text-xs px-4 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                                            >
                                                                {loadingBlockId === block.id ? (
                                                                    <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> יוצר...</>
                                                                ) : (
                                                                    <> <IconWand className="w-3 h-3" /> צור תמונה</>
                                                                )}
                                                            </button>
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
                                                <select className="w-full p-2.5 border border-indigo-200 rounded-lg bg-white/70 focus:bg-white transition-colors cursor-pointer text-sm" value={block.metadata?.botPersona || 'socratic'} onChange={(e) => handlePersonaChange(block.id, e.target.value, block.content, block.metadata)} disabled={showScoring}>
                                                    <option value="socratic">🧠 מנחה סוקרטי (מומלץ)</option>
                                                    <option value="teacher">👨‍🏫 מורה מלווה</option>
                                                    <option value="concise">⚡ תמציתי</option>
                                                    <option value="coach">🏆 מאמן מאתגר</option>
                                                    <option value="historical">📜 דמות היסטורית</option>
                                                    <option value="debate">🗣️ יריב לדיבייט</option>
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
                                            {showScoring && (<div className="flex flex-col items-center ml-2 bg-white/50 p-1 rounded-lg border border-gray-100"><span className="text-[10px] font-bold text-gray-400 uppercase">ניקוד</span><input type="number" className="w-14 text-center p-1 rounded border-2 border-transparent focus:border-blue-400 bg-white/80 font-bold text-blue-600 focus:bg-white transition-all outline-none" value={block.metadata?.score || 0} onChange={(e) => updateBlock(block.id, block.content, { score: Number(e.target.value) })} /></div>)}
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
                                                <label className="text-xs font-bold text-gray-400 mb-1 block flex items-center gap-1"><IconBrain className="w-3 h-3" /> הנחיות למורה / תשובה מצופה:</label>
                                                <textarea className="w-full p-3 border border-gray-200/80 rounded-xl bg-white/80 text-sm focus:bg-white transition-colors outline-none focus:border-teal-300" rows={2} value={block.metadata?.modelAnswer || ''} onChange={(e) => updateBlock(block.id, block.content, { modelAnswer: e.target.value })} placeholder="כתבו כאן את התשובה המצופה..." />
                                            </div>
                                        )}
                                        <div className="mt-3 pt-3 border-t border-gray-200/50 flex justify-between items-center">
                                            <span className="text-xs text-gray-400 font-bold">הוסיפו מדיה לשאלה:</span>
                                            {/* השימוש החדש ברכיב המאוחד */}
                                            {renderMediaToolbar(block.id)}
                                        </div>
                                    </div>
                                )}

                                {/* FILL IN BLANKS */}
                                {block.type === 'fill_in_blanks' && (
                                    <div className="bg-purple-50/50 p-5 rounded-xl border border-purple-100">
                                        <div className="flex items-center gap-2 mb-2 text-purple-700 font-bold"><IconEdit className="w-5 h-5" /> השלמת משפטים (Cloze)</div>
                                        <p className="text-xs text-gray-500 mb-2">כתבו את הטקסט המלא, והקיפו מילים להסתרה ב-[סוגריים מרובעים]. למשל: "בירת ישראל היא [ירושלים]".</p>
                                        <textarea className="w-full p-4 border border-purple-200/60 bg-white rounded-xl focus:ring-2 focus:ring-purple-100 outline-none transition-all text-gray-800 text-lg leading-relaxed min-h-[100px]" dir="rtl" value={block.content} onChange={(e) => updateBlock(block.id, e.target.value)} />
                                    </div>
                                )}

                                {/* ORDERING */}
                                {block.type === 'ordering' && (
                                    <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                                        <div className="flex items-center gap-2 mb-4 text-blue-700 font-bold"><IconList className="w-5 h-5" /> סידור רצף</div>
                                        <input type="text" className="w-full p-2 mb-4 border border-blue-200 rounded-lg bg-white" placeholder="שאלה / הנחיה (למשל: סדר את האירועים...)" value={block.content.instruction || ''} onChange={(e) => updateBlock(block.id, { ...block.content, instruction: e.target.value })} />
                                        <div className="space-y-2">
                                            {block.content.correct_order?.map((item: string, idx: number) => (
                                                <div key={idx} className="flex gap-2">
                                                    <span className="font-bold text-blue-300 w-6">{idx + 1}.</span>
                                                    <input type="text" className="flex-1 p-2 border rounded bg-white" value={item} onChange={(e) => { const newItems = [...block.content.correct_order]; newItems[idx] = e.target.value; updateBlock(block.id, { ...block.content, correct_order: newItems }); }} />
                                                    <button onClick={() => { const newItems = block.content.correct_order.filter((_: any, i: number) => i !== idx); updateBlock(block.id, { ...block.content, correct_order: newItems }); }} className="text-red-400 hover:text-red-600"><IconTrash className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                            <button onClick={() => updateBlock(block.id, { ...block.content, correct_order: [...(block.content.correct_order || []), "פריט חדש"] })} className="text-xs font-bold text-blue-600 bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded-full mt-2">+ הוסף פריט</button>
                                        </div>
                                    </div>
                                )}

                                {/* CATEGORIZATION - TEAL THEME (NO ORANGE) */}
                                {block.type === 'categorization' && (
                                    <div className="bg-teal-50/50 p-5 rounded-xl border border-teal-100">
                                        <div className="flex items-center gap-2 mb-4 text-teal-700 font-bold"><IconLayer className="w-5 h-5" /> מיון לקטגוריות</div>

                                        <input type="text" className="w-full p-2 mb-4 border border-teal-200 rounded-lg bg-white" placeholder="הנחיה..." value={block.content.question || ''} onChange={(e) => updateBlock(block.id, { ...block.content, question: e.target.value })} />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <h4 className="text-xs font-bold text-teal-400 uppercase mb-2">קטגוריות</h4>
                                                <div className="space-y-2">
                                                    {block.content.categories?.map((cat: string, idx: number) => (
                                                        <div key={idx} className="flex gap-2">
                                                            <input type="text" className="flex-1 p-2 border rounded bg-white border-teal-200" value={cat} onChange={(e) => { const newCats = [...block.content.categories]; newCats[idx] = e.target.value; updateBlock(block.id, { ...block.content, categories: newCats }); }} placeholder={`קטגוריה ${idx + 1}`} />
                                                            <button onClick={() => { const newCats = block.content.categories.filter((_: any, i: number) => i !== idx); updateBlock(block.id, { ...block.content, categories: newCats }); }} className="text-red-400"><IconTrash className="w-4 h-4" /></button>
                                                        </div>
                                                    ))}
                                                    <button onClick={() => updateBlock(block.id, { ...block.content, categories: [...(block.content.categories || []), "קטגוריה חדשה"] })} className="text-xs font-bold text-teal-600 bg-teal-100 hover:bg-teal-200 px-3 py-1 rounded-full">+ קטגוריה</button>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-xs font-bold text-teal-400 uppercase mb-2">פריטים למיון</h4>
                                                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
                                                    {block.content.items?.map((item: any, idx: number) => (
                                                        <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border border-teal-100">
                                                            <input type="text" className="flex-1 p-1 text-sm border-b border-gray-200 focus:border-teal-400 outline-none" value={item.text} onChange={(e) => { const newItems = [...block.content.items]; newItems[idx].text = e.target.value; updateBlock(block.id, { ...block.content, items: newItems }); }} placeholder="טקסט הפריט" />
                                                            <select className="text-xs p-1 bg-gray-50 rounded border-none outline-none" value={item.category} onChange={(e) => { const newItems = [...block.content.items]; newItems[idx].category = e.target.value; updateBlock(block.id, { ...block.content, items: newItems }); }}>
                                                                <option value="" disabled>בחר קטגוריה</option>
                                                                {block.content.categories?.map((c: string) => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                            <button onClick={() => { const newItems = block.content.items.filter((_: any, i: number) => i !== idx); updateBlock(block.id, { ...block.content, items: newItems }); }} className="text-red-400 hover:text-red-600"><IconTrash className="w-3 h-3" /></button>
                                                        </div>
                                                    ))}
                                                    <button onClick={() => updateBlock(block.id, { ...block.content, items: [...(block.content.items || []), { text: "פריט חדש", category: block.content.categories?.[0] || "" }] })} className="text-xs font-bold text-teal-600 bg-teal-100 hover:bg-teal-200 px-3 py-1 rounded-full">+ פריט למיון</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* MEMORY GAME */}
                                {block.type === 'memory_game' && (
                                    <div className="bg-pink-50/50 p-5 rounded-xl border border-pink-100">
                                        <div className="flex items-center gap-2 mb-4 text-pink-700 font-bold"><IconBrain className="w-5 h-5" /> משחק זיכרון</div>
                                        <p className="text-xs text-gray-500 mb-4">צרו זוגות תואמים. התלמיד יצטרך למצוא את ההתאמות.</p>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {block.content.pairs?.map((pair: any, idx: number) => (
                                                <div key={idx} className="bg-white p-3 rounded-xl border border-pink-100 shadow-sm relative group/pair">
                                                    <div className="mb-2">
                                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">צד א' (גלוי תחילה / שאלה)</label>
                                                        <input type="text" className="w-full p-2 border rounded bg-gray-50 focus:bg-white transition-colors text-sm" value={pair.card_a} onChange={(e) => { const newPairs = [...block.content.pairs]; newPairs[idx].card_a = e.target.value; updateBlock(block.id, { ...block.content, pairs: newPairs }); }} />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">צד ב' (התאמה)</label>
                                                        <input type="text" className="w-full p-2 border rounded bg-gray-50 focus:bg-white transition-colors text-sm" value={pair.card_b} onChange={(e) => { const newPairs = [...block.content.pairs]; newPairs[idx].card_b = e.target.value; updateBlock(block.id, { ...block.content, pairs: newPairs }); }} />
                                                    </div>
                                                    <button onClick={() => { const newPairs = block.content.pairs.filter((_: any, i: number) => i !== idx); updateBlock(block.id, { ...block.content, pairs: newPairs }); }} className="absolute -top-2 -left-2 bg-white text-red-500 p-1 rounded-full shadow border border-gray-100 opacity-0 group-hover/pair:opacity-100 transition-opacity"><IconX className="w-3 h-3" /></button>
                                                </div>
                                            ))}
                                            <button onClick={() => updateBlock(block.id, { ...block.content, pairs: [...(block.content.pairs || []), { card_a: "", card_b: "" }] })} className="min-h-[140px] border-2 border-dashed border-pink-200 rounded-xl flex flex-col items-center justify-center text-pink-400 hover:bg-pink-50 hover:border-pink-300 transition-all">
                                                <IconPlus className="w-6 h-6 mb-1" />
                                                <span className="text-xs font-bold">הוסף זוג</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* TRUE/FALSE SPEED */}
                                {block.type === 'true_false_speed' && (
                                    <div className="bg-red-50/50 p-5 rounded-xl border border-red-100">
                                        <div className="flex items-center gap-2 mb-4 text-red-700 font-bold"><IconClock className="w-5 h-5" /> אמת או שקר (ספיד)</div>
                                        <p className="text-xs text-gray-500 mb-4">משחק מהירות: התלמיד צריך להחליט במהירות אם המשפט נכון או לא.</p>

                                        <div className="space-y-2">
                                            {block.content.statements?.map((item: any, idx: number) => (
                                                <div key={idx} className="flex items-center gap-4 bg-white p-2 rounded-lg border border-red-100">
                                                    <span className="font-bold text-red-100 text-lg w-6 text-center">{idx + 1}</span>
                                                    <input type="text" className="flex-1 p-2 text-sm border-b border-transparent focus:border-red-200 outline-none" value={item.text} onChange={(e) => { const newStmts = [...block.content.statements]; newStmts[idx].text = e.target.value; updateBlock(block.id, { ...block.content, statements: newStmts }); }} placeholder="כתבו עובדה..." />

                                                    <button onClick={() => { const newStmts = [...block.content.statements]; newStmts[idx].is_true = !newStmts[idx].is_true; updateBlock(block.id, { ...block.content, statements: newStmts }); }} className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${item.is_true ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                                        {item.is_true ? 'אמת' : 'שקר'}
                                                    </button>

                                                    <button onClick={() => { const newStmts = block.content.statements.filter((_: any, i: number) => i !== idx); updateBlock(block.id, { ...block.content, statements: newStmts }); }} className="text-gray-300 hover:text-red-500"><IconTrash className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                            <button onClick={() => updateBlock(block.id, { ...block.content, statements: [...(block.content.statements || []), { text: "", is_true: true }] })} className="w-full py-2 border-2 border-dashed border-red-200 rounded-lg text-red-400 font-bold text-sm hover:bg-red-50">+ הוסף שאלה</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <InsertMenu index={index + 1} />
                    </React.Fragment>
                ))}
            </div>
            {/* Sticky Score Footer */}
            {showScoring && (
                <div className={`fixed bottom-0 left-0 right-0 p-3 flex justify-between items-center px-10 transition-colors shadow-[0_-5px_20px_rgba(0,0,0,0.1)] backdrop-blur-md border-t z-50 animate-slide-up
                    ${totalScore === 100 ? 'bg-green-50/90 border-green-200 text-green-900' : 'bg-white/90 border-red-200 text-slate-800'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`text-2xl font-black flex items-center gap-2 ${totalScore === 100 ? 'text-green-600' : 'text-red-500'}`}>
                            <IconBalance className="w-6 h-6" />
                            {totalScore} / 100
                        </div>
                        {totalScore !== 100 && (
                            <div className="text-sm font-bold text-red-500 bg-red-100 px-3 py-1 rounded-full animate-pulse">
                                {totalScore < 100 ? `חסרות ${100 - totalScore} נקודות` : `עודף של ${totalScore - 100} נקודות`}
                            </div>
                        )}
                        {totalScore === 100 && (
                            <div className="text-sm font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full flex items-center gap-1">
                                <IconCheck className="w-4 h-4" /> סך הכל תקין
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleAutoDistributePoints} className="text-xs bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-bold shadow-sm transition-colors">
                            חישוב מחדש (אוטומטי)
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                .insert-btn { @apply px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-xs font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center gap-1.5 shadow-sm; }
                .animate-scale-in { animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; transform-origin: bottom center; }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            `}</style>

            {/* Assignment Creation Modal (Portal) */}
            {assignmentModalOpen && createPortal(
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4 text-right" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                        <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg flex items-center gap-2"><IconLink className="w-5 h-5" /> יצירת קישור למשימה</h3>
                            <button onClick={() => setAssignmentModalOpen(false)} className="hover:bg-indigo-700 p-1 rounded-full text-indigo-100"><IconX className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">שם המשימה / מבחן</label>
                                <input type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    value={assignmentData.title} onChange={e => setAssignmentData({ ...assignmentData, title: e.target.value })}
                                    placeholder="למשל: סיום פרק ב׳ - חזרה למבחן"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">תאריך הגשה</label>
                                    <input type="date" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                                        value={assignmentData.dueDate} onChange={e => setAssignmentData({ ...assignmentData, dueDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">שעה</label>
                                    <input type="time" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                                        value={assignmentData.dueTime} onChange={e => setAssignmentData({ ...assignmentData, dueTime: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">הנחיות לתלמיד (אופציונלי)</label>
                                <textarea className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none h-20 resize-none"
                                    value={assignmentData.instructions} onChange={e => setAssignmentData({ ...assignmentData, instructions: e.target.value })}
                                    placeholder="הנחיות מיוחדות, זמן מומלץ, וכו'..."
                                />
                            </div>

                            <button onClick={handleCreateAssignment} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2 mt-2">
                                <IconLink className="w-5 h-5" /> צור קישור והעתק
                            </button>
                            <p className="text-xs text-center text-slate-400">הקישור ישמר בהיסטוריית המשימות של הכיתה</p>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default UnitEditor;