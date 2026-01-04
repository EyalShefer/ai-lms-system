import React, { useState } from 'react';
import { IconSparkles, IconBook, IconVideo, IconTarget, IconCheck, IconPrinter, IconEdit, IconX, IconWand, IconPlus, IconTrash, IconArrowUp, IconArrowDown, IconShare, IconText, IconImage, IconList, IconChat, IconUpload, IconPalette, IconLink, IconChevronRight, IconHeadphones, IconLayer, IconBrain, IconClock, IconMicrophone, IconInfographic } from '../icons';
import type { LearningUnit, ActivityBlock } from '../shared/types/courseTypes';
import { refineBlockContent, openai, generateInfographicFromText, type InfographicType } from '../services/ai/geminiApi';
import { detectInfographicType, analyzeInfographicSuitability } from '../utils/infographicDetector';
import { PEDAGOGICAL_PHASES, getPedagogicalPhase } from '../utils/pedagogicalIcons';
import { createBlock } from '../shared/config/blockDefinitions';
import { downloadLessonPlanPDF } from '../services/pdfExportService';
import type { TeacherLessonPlan } from '../shared/types/gemini.types';
import { TextToSpeechButton } from './TextToSpeechButton';


interface TeacherCockpitProps {
    unit: LearningUnit;
    onExit?: () => void;
    onEdit?: () => void; // Legacy
    onUpdateBlock?: (blockId: string, newContent: any) => void; // Legacy
    onUnitUpdate?: (unit: LearningUnit) => void; // New Full CRUD
    embedded?: boolean;
}

const BLOCK_TYPE_MAPPING: Record<string, string> = {
    'text': 'טקסט / הסבר',
    'image': 'תמונה',
    'video': 'וידאו',
    'multiple-choice': 'שאלה אמריקאית',
    'open-question': 'שאלה פתוחה',
    'interactive-chat': 'צ׳אט אינטראקטיבי',
    'fill_in_blanks': 'השלמת משפטים',
    'ordering': 'סידור רצף',
    'categorization': 'מיון לקטגוריות',
    'memory_game': 'משחק זיכרון',
    'true_false_speed': 'אמת או שקר',
    'drag_and_drop': 'גרור ושחרר',
    'hotspot': 'נקודות חמות',
    'matching': 'התאמה',
    'audio-response': 'תשובה קולית',
    'podcast': 'פודקאסט AI'
};

const getBlockTitle = (block: ActivityBlock): string | null => {
    if (block.type === 'text') {
        const text = typeof block.content === 'string' ? block.content : ((block.content as any)?.teach_content || (block.content as any)?.text || "");
        if (!text) return null;

        let title = null;

        // 1. Try extracting text from <h3> tag (HTML content)
        const h3Match = text.match(/<h3[^>]*>(.*?)<\/h3>/i);
        if (h3Match && h3Match[1]) {
            title = h3Match[1].replace(/<[^>]+>/g, '').trim();
        }

        // 2. Try extracting from Markdown # (Text content)
        if (!title) {
            const lines = text.split('\n');
            const titleLine = lines.find((line: string) => line.trim().startsWith('#'));
            if (titleLine) {
                title = titleLine.replace(/^#+\s*/, '').trim();
            }
        }

        // 3. Remove emojis from title
        if (title) {
            // Remove all emojis (including variations and combining characters)
            title = title.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F910}-\u{1F96B}]|[\u{1F980}-\u{1F9E0}]|[\u{FE00}-\u{FE0F}]|[\u{20D0}-\u{20FF}]/gu, '').trim();
        }

        return title;
    }
    return null;
};

// Helper component to render pedagogical phase icons based on position and type
const BlockIconRenderer: React.FC<{ blockType: string; blockIndex: number; totalBlocks: number; className?: string }> = ({
    blockType,
    blockIndex,
    totalBlocks,
    className = 'w-5 h-5'
}) => {
    // Use the pedagogical phase logic from pedagogicalIcons.ts
    const phase = getPedagogicalPhase(blockIndex, totalBlocks, blockType);
    const Icon = PEDAGOGICAL_PHASES[phase].icon;
    return <Icon className={className} />;
};

const TeacherCockpit: React.FC<TeacherCockpitProps> = ({ unit, onExit, onEdit, onUpdateBlock, onUnitUpdate, embedded = false }) => {
    const [activeSection, setActiveSection] = useState<string>('all');
    const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
    const [isRefining, setIsRefining] = useState(false);
    const [refinePrompt, setRefinePrompt] = useState("");
    const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null);

    // Media State
    const [mediaInputMode, setMediaInputMode] = useState<Record<string, string | null>>({});
    const [mediaInputValue, setMediaInputValue] = useState<Record<string, string>>({});
    const [loadingBlockId, setLoadingBlockId] = useState<string | null>(null);

    // Infographic State
    const [showInfographicMenu, setShowInfographicMenu] = useState<string | null>(null);
    const [isGeneratingInfographic, setIsGeneratingInfographic] = useState(false);
    const [infographicPreview, setInfographicPreview] = useState<{
        imageUrl: string;
        block: ActivityBlock;
        visualType: InfographicType;
    } | null>(null);

    // --- CRUD Helpers ---
    const updateUnitBlocks = (newBlocks: ActivityBlock[]) => {
        if (onUnitUpdate) {
            onUnitUpdate({ ...unit, activityBlocks: newBlocks });
        } else if (onUpdateBlock) {
            console.warn("Using Legacy onUpdateBlock - Full CRUD not supported properly without onUnitUpdate");
        }
    };

    const addBlockAtIndex = (type: string, index: number) => {
        const newBlock = createBlock(type, 'socratic');
        const newBlocks = [...(unit.activityBlocks || [])];
        newBlocks.splice(index, 0, newBlock);
        updateUnitBlocks(newBlocks);
        setActiveInsertIndex(null);
        if (type === 'text') setEditingBlockId(newBlock.id);
    };

    const deleteBlock = (blockId: string) => {
        if (confirm("למחוק את הרכיב?")) {
            const newBlocks = unit.activityBlocks?.filter(b => b.id !== blockId) || [];
            updateUnitBlocks(newBlocks);
        }
    };

    const moveBlock = (index: number, direction: 'up' | 'down') => {
        const newBlocks = [...(unit.activityBlocks || [])];
        if (direction === 'up' && index > 0) {
            [newBlocks[index], newBlocks[index - 1]] = [newBlocks[index - 1], newBlocks[index]];
        } else if (direction === 'down' && index < newBlocks.length - 1) {
            [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
        }
        updateUnitBlocks(newBlocks);
    };

    const updateBlockContent = (blockId: string, content: any, metadataUpdates?: any) => {
        const newBlocks = unit.activityBlocks?.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    content,
                    metadata: metadataUpdates ? { ...b.metadata, ...metadataUpdates } : b.metadata
                };
            }
            return b;
        }) || [];
        updateUnitBlocks(newBlocks);
    };


    const handleScrollTo = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            setActiveSection(id);
        }
    };

    const handleExportPDF = () => {
        // Use the stored lesson plan from metadata, or create a basic one from available data
        const lessonPlan: TeacherLessonPlan = unit.metadata?.lessonPlan || {
            lesson_metadata: {
                title: unit.title,
                target_audience: unit.metadata?.gradeLevel || 'לא צוין',
                duration: '45 דקות',
                subject: unit.metadata?.subject,
                learning_objectives: unit.goals || []
            },
            hook: {
                script_for_teacher: unit.baseContent || 'תוכן מערך השיעור',
            },
            direct_instruction: {
                slides: []
            },
            guided_practice: {
                teacher_facilitation_script: 'השתמשו בפעילויות האינטראקטיביות המצורפות כדי לתרגל את הנושא בכיתה. הנחו את התלמידים בצורה מדורגת.',
                suggested_activities: unit.activityBlocks
                    .filter(b => ['multiple-choice', 'memory_game', 'fill_in_blanks', 'ordering', 'categorization', 'drag_and_drop', 'hotspot', 'open-question'].includes(b.type))
                    .map(b => ({
                        activity_type: b.type,
                        description: `פעילות ${b.type} לתרגול`,
                        facilitation_tip: 'תנו לתלמידים זמן לעבודה עצמאית ואז דונו בתשובות'
                    })),
                differentiation_strategies: {
                    for_struggling_students: 'תנו רמזים נוספים ופרקו את המשימה לשלבים קטנים יותר',
                    for_advanced_students: 'הוסיפו שאלות העמקה ואתגרו אותם לחשיבה ביקורתית'
                },
                assessment_tips: ['שימו לב להבנת המושגים הבסיסיים', 'בדקו את יכולת היישום']
            },
            independent_practice: {
                introduction_text: 'פעילויות אינטראקטיביות לתרגול עצמאי',
                interactive_blocks: unit.activityBlocks
                    .filter(b => ['multiple-choice', 'memory_game', 'fill_in_blanks', 'ordering', 'categorization', 'drag_and_drop', 'hotspot', 'open-question'].includes(b.type))
                    .map(b => ({
                        type: b.type,
                        data: b.content
                    })),
                estimated_duration: '10-15 דקות'
            },
            discussion: {
                questions: []
            },
            summary: {
                takeaway_sentence: `סיכום: ${unit.title}`
            }
        };

        downloadLessonPlanPDF(lessonPlan, `${unit.title} - מערך שיעור.pdf`);
    };

    const handleShare = async () => {
        const shareUrl = window.location.href;
        try {
            if (navigator.share) {
                // Mobile share
                await navigator.share({
                    title: unit.title,
                    text: `מערך שיעור: ${unit.title}`,
                    url: shareUrl
                });
            } else {
                // Desktop - copy to clipboard
                await navigator.clipboard.writeText(shareUrl);
                alert('הקישור הועתק ללוח! 📋');
            }
        } catch (error) {
            console.error('Share failed:', error);
        }
    };

    // --- Media Handlers ---
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, blockId: string) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            updateBlockContent(blockId, reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleGenerateAiImage = async (blockId: string) => {
        const prompt = mediaInputValue[blockId];
        if (!prompt) return;

        setLoadingBlockId(blockId);
        try {
            const res = await openai.images.generate({
                prompt: prompt,
                model: "dall-e-3",
                size: "1024x1024",
                response_format: "b64_json",
                quality: "standard",
                n: 1,
            });

            const image_url = res.data[0].b64_json;
            if (image_url) {
                updateBlockContent(blockId, `data:image/png;base64,${image_url}`);
                setMediaInputMode(prev => ({ ...prev, [blockId]: null }));
            }
        } catch (error) {
            console.error("Image Gen Error:", error);
            alert("שגיאה ביצירת תמונה. נסה שנית.");
        } finally {
            setLoadingBlockId(null);
        }
    };

    const handleGenerateInfographic = async (block: ActivityBlock, visualType: InfographicType) => {
        setIsGeneratingInfographic(true);
        setShowInfographicMenu(null);

        try {
            // Extract text content from block
            let textContent = '';
            if (block.type === 'text') {
                textContent = typeof block.content === 'string'
                    ? block.content
                    : ((block.content as any)?.teach_content || (block.content as any)?.text || '');
            } else if (block.content && typeof block.content === 'object') {
                textContent = JSON.stringify(block.content);
            }

            if (!textContent) {
                alert("לא נמצא תוכן להמרה לאינפוגרפיקה");
                return;
            }

            // Generate infographic
            const imageBlob = await generateInfographicFromText(
                textContent,
                visualType,
                unit.title
            );

            if (imageBlob) {
                // Convert blob to base64 for preview
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const base64data = reader.result as string;

                    // Show preview modal instead of directly inserting
                    setInfographicPreview({
                        imageUrl: base64data,
                        block: block,
                        visualType: visualType
                    });

                    // Track preview opened
                    const { trackPreviewOpened } = await import('../services/infographicAnalytics');
                    trackPreviewOpened(visualType);
                };
                reader.readAsDataURL(imageBlob);
            } else {
                alert("שגיאה ביצירת אינפוגרפיקה. נסה שנית.");
            }
        } catch (error) {
            console.error("Infographic Generation Error:", error);
            alert("שגיאה ביצירת אינפוגרפיקה");
        } finally {
            setIsGeneratingInfographic(false);
        }
    };

    const handleConfirmInfographic = async () => {
        if (!infographicPreview) return;

        // Track preview confirmed
        const { trackPreviewConfirmed } = await import('../services/infographicAnalytics');
        trackPreviewConfirmed(infographicPreview.visualType);

        // Create new image block after current block
        const newBlock = createBlock('image', 'socratic');
        newBlock.content = infographicPreview.imageUrl;
        newBlock.metadata = {
            ...newBlock.metadata,
            infographicType: infographicPreview.visualType,
            generatedFrom: infographicPreview.block.id
        };

        const currentIndex = unit.activityBlocks?.findIndex(b => b.id === infographicPreview.block.id) || 0;
        const newBlocks = [...(unit.activityBlocks || [])];
        newBlocks.splice(currentIndex + 1, 0, newBlock);
        updateUnitBlocks(newBlocks);

        // Close preview
        setInfographicPreview(null);
    };


    // Use centralized pedagogical phases for consistency
    const timelineItems = Object.values(PEDAGOGICAL_PHASES).map(phase => ({
        id: phase.id,
        label: phase.label,
        icon: phase.icon
    }));

    const handleRefineBlock = async (block: ActivityBlock, instruction: string) => {
        if (!onUpdateBlock && !onUnitUpdate) return;
        setIsRefining(true);
        try {
            const newContent = await refineBlockContent(block.type, block.content, instruction);
            // If text block, we might get back just string or object.
            let finalContent = newContent;
            if (block.type === 'text' && newContent.text) {
                finalContent = newContent.text;
            }

            // Preserve tip if exists in old content
            if (block.type === 'text' && typeof block.content === 'object' && (block.content as any).teacher_tip) {
                if (typeof finalContent === 'string') {
                    // If we converted to string, we lose the tip unless we re-wrap.
                    // For now, keep as string if that's what the UI expects, OR upgrade to object.
                    // The getTeacherTip function below handles both.
                }
            }

            updateBlockContent(block.id, finalContent);
            setEditingBlockId(null);
            setRefinePrompt("");
        } catch (error) {
            console.error("Refine Error:", error);
            alert("שגיאה בעריכת התוכן");
        } finally {
            setIsRefining(false);
        }
    };

    // Helper to strip HTML for editing view
    const getTextContentForEdit = (content: any): string => {
        const text = typeof content === 'string' ? content : ((content as any)?.teach_content || (content as any)?.text || "");
        if (!text) return "";
        if (text.trim().startsWith('<div class="lesson-section')) {
            return text
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/p>/gi, '\n\n')
                .replace(/<\/h[1-6]>/gi, '\n\n')
                .replace(/<[^>]+>/g, '') // Strip remaining tags
                .replace(/\n\s*\n/g, '\n\n') // Normalize multiple newlines
                .trim();
        }
        return text;
    };


    // --- Sub-Components ---
    const InsertMenu = ({ index }: { index: number }) => (
        <div className="flex justify-center my-8 print:hidden group relative z-10 w-full">
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full border-t border-dashed border-slate-300"></div>
            </div>
            <div className="relative bg-[#f0f4f8] px-4">
                {activeInsertIndex === index ? (
                    <div className="glass border border-white/60 shadow-xl rounded-2xl p-4 flex flex-wrap gap-3 animate-scale-in items-center justify-center backdrop-blur-xl bg-white/95 ring-4 ring-blue-50/50 max-w-2xl mx-auto">
                        <button onClick={() => addBlockAtIndex('text', index)} className="insert-btn"><IconText className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['text']}</span></button>
                        <button onClick={() => addBlockAtIndex('image', index)} className="insert-btn"><IconImage className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['image']}</span></button>
                        <button onClick={() => addBlockAtIndex('video', index)} className="insert-btn"><IconVideo className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['video']}</span></button>
                        <button onClick={() => addBlockAtIndex('multiple-choice', index)} className="insert-btn"><IconList className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['multiple-choice']}</span></button>
                        <button onClick={() => addBlockAtIndex('open-question', index)} className="insert-btn"><IconEdit className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['open-question']}</span></button>
                        <button onClick={() => addBlockAtIndex('interactive-chat', index)} className="insert-btn"><IconChat className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['interactive-chat']}</span></button>

                        <button onClick={() => addBlockAtIndex('fill_in_blanks', index)} className="insert-btn"><IconEdit className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['fill_in_blanks']}</span></button>
                        <button onClick={() => addBlockAtIndex('ordering', index)} className="insert-btn"><IconList className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['ordering']}</span></button>
                        <button onClick={() => addBlockAtIndex('categorization', index)} className="insert-btn"><IconLayer className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['categorization']}</span></button>
                        <button onClick={() => addBlockAtIndex('memory_game', index)} className="insert-btn"><IconBrain className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['memory_game']}</span></button>
                        <button onClick={() => addBlockAtIndex('true_false_speed', index)} className="insert-btn"><IconClock className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['true_false_speed']}</span></button>
                        <button onClick={() => addBlockAtIndex('audio-response', index)} className="insert-btn"><IconMicrophone className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['audio-response']}</span></button>
                        <button onClick={() => addBlockAtIndex('podcast', index)} className="insert-btn"><IconHeadphones className="w-4 h-4" /><span>פודקאסט AI</span></button>

                        <div className="w-px bg-slate-200 mx-2"></div>
                        <button onClick={() => setActiveInsertIndex(null)} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors"><IconX className="w-5 h-5" /></button>
                    </div>
                ) : (
                    <button
                        onClick={() => setActiveInsertIndex(index)}
                        className="bg-white text-slate-500 border border-slate-300 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-sm hover:shadow-md hover:scale-105 transition-all hover:bg-blue-600 hover:text-white hover:border-blue-600"
                    >
                        <IconPlus className="w-4 h-4" />
                        <span className="text-xs font-bold">הוסף רכיב</span>
                    </button>
                )}
            </div>
            <style>{`
                .insert-btn { @apply px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-xs font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center gap-1.5 shadow-sm flex-col md:flex-row; }
            `}</style>
        </div>
    );

    const renderRefineToolbar = (block: ActivityBlock) => {
        if (editingBlockId !== block.id) return null;

        const presets = ["קצר יותר", "פשט שפה", "הוסף דוגמאות", "ניסוח מרתק"];

        return (
            <div className="absolute inset-x-0 bottom-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 animate-fade-in rounded-b-3xl border-t border-slate-100">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-wizdi-royal">
                    <IconWand className="w-4 h-4" />
                    עריכה עם AI
                </h4>
                <div className="flex flex-wrap gap-2 justify-center mb-3 max-w-md">
                    {presets.map(p => (
                        <button
                            key={p}
                            onClick={() => handleRefineBlock(block, p)}
                            disabled={isRefining}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-wizdi-royal hover:text-white rounded-full text-xs font-bold transition-colors border border-slate-200"
                        >
                            {p}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 w-full max-w-md">
                    <input
                        type="text"
                        value={refinePrompt}
                        onChange={(e) => setRefinePrompt(e.target.value)}
                        placeholder="או כתבו בקשה חופשית..."
                        className="flex-1 p-2 border border-slate-200 rounded-lg focus:border-wizdi-royal outline-none text-sm"
                    />
                    <button
                        onClick={() => handleRefineBlock(block, refinePrompt)}
                        disabled={!refinePrompt || isRefining}
                        className="bg-wizdi-royal text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isRefining ? <IconSparkles className="animate-spin w-4 h-4" /> : <IconCheck className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        );
    };

    const renderBlockContent = (block: ActivityBlock) => {
        // --- MEDIA BLOCKS ---
        if (block.type === 'image') {
            if (!block.content) {
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-48">
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all group">
                            <IconUpload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-2" />
                            <span className="font-bold text-gray-500 group-hover:text-blue-600">העלאת תמונה</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, block.id)} />
                        </label>
                        <button onClick={() => setMediaInputMode({ ...mediaInputMode, [block.id]: 'ai' })} className="flex flex-col items-center justify-center border-2 border-dashed border-blue-200 rounded-xl bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 transition-all group relative">
                            <IconPalette className="w-8 h-8 text-blue-400 group-hover:text-blue-600 mb-2" />
                            <span className="font-bold text-blue-500 group-hover:text-blue-700">יצירה ב-AI</span>

                            {mediaInputMode[block.id] === 'ai' && (
                                <div className="absolute inset-0 bg-white p-4 rounded-xl z-20 flex flex-col justify-center" onClick={e => e.stopPropagation()}>
                                    <h4 className="text-sm font-bold text-blue-700 mb-2">תארו את התמונה:</h4>
                                    <textarea
                                        className="w-full p-2 border rounded-lg mb-2 text-sm focus:border-blue-400 outline-none"
                                        rows={2}
                                        placeholder="למשל: מפה עתיקה של ירושלים..."
                                        onChange={(e) => setMediaInputValue({ ...mediaInputValue, [block.id]: e.target.value })}
                                        autoFocus
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={(e) => { e.stopPropagation(); setMediaInputMode({ ...mediaInputMode, [block.id]: null }) }} className="text-gray-500 text-xs px-2">ביטול</button>
                                        <button onClick={(e) => { e.stopPropagation(); handleGenerateAiImage(block.id) }} disabled={loadingBlockId === block.id} className="bg-blue-600 text-white text-xs px-3 py-1 rounded-lg">
                                            {loadingBlockId === block.id ? "יוצר..." : "צור"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </button>
                    </div>
                );
            }
            return (
                <div className="relative group">
                    <img src={block.content} className="w-full h-80 object-cover rounded-2xl shadow-md" alt="Lesson Visual" />
                    <button
                        onClick={() => updateBlockContent(block.id, '')}
                        className="absolute top-2 right-2 bg-white/80 p-2 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                        title="החלף תמונה"
                    >
                        <IconTrash className="w-4 h-4" />
                    </button>
                </div>
            );
        }

        if (block.type === 'video') {
            if (!block.content) {
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-48">
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all group">
                            <IconUpload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-2" />
                            <span className="font-bold text-gray-500 group-hover:text-blue-600">העלאת וידאו</span>
                            <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, block.id)} />
                        </label>
                        <button onClick={() => setMediaInputMode({ ...mediaInputMode, [block.id]: 'link' })} className="flex flex-col items-center justify-center border-2 border-dashed border-red-200 rounded-xl bg-red-50/50 hover:bg-red-50 hover:border-red-300 transition-all group relative">
                            <IconLink className="w-8 h-8 text-red-400 group-hover:text-red-600 mb-2" />
                            <span className="font-bold text-red-500 group-hover:text-red-700">YouTube</span>

                            {mediaInputMode[block.id] === 'link' && (
                                <div className="absolute inset-0 bg-white p-4 rounded-xl z-20 flex flex-col justify-center" onClick={e => e.stopPropagation()}>
                                    <h4 className="text-sm font-bold text-red-700 mb-2">קישור ליוטיוב:</h4>
                                    <input
                                        type="text"
                                        dir="ltr"
                                        className="w-full p-2 border rounded-lg mb-2 text-sm text-left focus:border-red-400 outline-none"
                                        placeholder="https://youtu.be/..."
                                        onChange={(e) => setMediaInputValue({ ...mediaInputValue, [block.id]: e.target.value })}
                                        autoFocus
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={(e) => { e.stopPropagation(); setMediaInputMode({ ...mediaInputMode, [block.id]: null }) }} className="text-gray-500 text-xs px-2">ביטול</button>
                                        <button onClick={(e) => {
                                            e.stopPropagation();
                                            updateBlockContent(block.id, mediaInputValue[block.id]);
                                            setMediaInputMode({ ...mediaInputMode, [block.id]: null });
                                        }} className="bg-red-600 text-white text-xs px-3 py-1 rounded-lg">
                                            הטמע
                                        </button>
                                    </div>
                                </div>
                            )}
                        </button>
                    </div>
                );
            }
            // Simple Video Embed
            const isYoutube = block.content.includes('youtube') || block.content.includes('youtu.be');
            return (
                <div className="relative aspect-video rounded-2xl overflow-hidden shadow-md bg-black group">
                    {isYoutube ? (
                        <iframe
                            src={block.content.replace('watch?v=', 'embed/').split('&')[0]}
                            className="w-full h-full"
                            allowFullScreen
                        />
                    ) : (
                        <video src={block.content} controls className="w-full h-full" />
                    )}
                    <button
                        onClick={() => updateBlockContent(block.id, '')}
                        className="absolute top-2 right-2 bg-white/80 p-2 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white z-10"
                        title="החלף וידאו"
                    >
                        <IconTrash className="w-4 h-4" />
                    </button>
                </div>
            )
        }

        // Editable Mode (Text)
        if (editingBlockId === block.id && block.type === 'text') {
            const rawContent = getTextContentForEdit(block.content);
            return (
                <div className="relative">
                    <textarea
                        className="w-full p-6 border border-blue-200 bg-white/50 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all text-slate-800 leading-relaxed resize-y min-h-[300px] font-sans shadow-inner"
                        defaultValue={rawContent}
                        onChange={(e) => updateBlockContent(block.id, e.target.value)}
                        placeholder="כתבו כאן את תוכן הפעילות..."
                        autoFocus
                    />
                    <div className="absolute bottom-4 left-4 flex gap-2 z-30">
                        <button onClick={() => setEditingBlockId(null)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md transition-all">
                            סיום עריכה
                        </button>
                    </div>
                </div>
            );
        }

        // View Mode
        if (block.type === 'text') {
            const textContent = typeof block.content === 'string' ? block.content : ((block.content as any)?.teach_content || (block.content as any)?.text || "");
            if (!textContent) return <div className="text-slate-400 italic p-4 text-center border-2 border-dashed border-slate-200 rounded-xl cursor-text" onClick={() => setEditingBlockId(block.id)}>לחצו כאן להוספת טקסט</div>;

            // Extract plain text for TTS (remove HTML tags if present)
            const plainText = textContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

            if (textContent.trim().startsWith('<div class="lesson-section')) {
                // Remove h3 title as it is now shown in the block header
                const contentWithoutTitle = textContent.replace(/<h3[^>]*>.*?<\/h3>/gi, '');
                return (
                    <div className="relative group">
                        <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TextToSpeechButton text={plainText} compact={true} />
                        </div>
                        <div
                            onClick={() => setEditingBlockId(block.id)}
                            className="teacher-lesson-content cursor-text hover:ring-2 hover:ring-blue-100 rounded-xl transition-all relative p-2 -m-2"
                            title="לחץ לעריכה"
                        >
                            <div dangerouslySetInnerHTML={{ __html: contentWithoutTitle }} />
                        </div>
                    </div>
                );
            }

            return (
                <div className="relative group">
                    <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TextToSpeechButton text={plainText} compact={true} />
                    </div>
                    <div onClick={() => setEditingBlockId(block.id)} className="cursor-text hover:ring-2 hover:ring-slate-100 rounded-lg p-2 transition-all -m-2">
                        {textContent.split('\n').map((line: string, i: number) => {
                            // Skip title lines (starting with #) as they are shown in block header
                            if (line.startsWith('#')) return null;
                            return <p key={i} className="mb-2">{line}</p>;
                        })}
                    </div>
                </div>
            )
        }
        if (block.type === 'multiple-choice') {
            return (
                <div onClick={() => setEditingBlockId(block.id)} className="cursor-pointer hover:ring-2 hover:ring-blue-100 rounded-xl p-2 transition-all -m-2">
                    <h3 className="text-lg font-bold mb-4">{block.content.question}</h3>
                    <ul className="list-disc pr-5 space-y-2">
                        {block.content.options.map((opt: any, idx: number) => (
                            <li key={idx} className={opt === block.content.correctAnswer ? 'text-green-600 font-bold' : ''}>
                                {typeof opt === 'string' ? opt : opt.value}
                            </li>
                        ))}
                    </ul>
                </div>
            )
        }
        if (block.type === 'open-question') {
            return (
                <div onClick={() => setEditingBlockId(block.id)} className="cursor-pointer hover:ring-2 hover:ring-blue-100 rounded-xl p-2 transition-all -m-2">
                    <h3 className="text-lg font-bold mb-4">שאלה לדיון: {block.content.question}</h3>
                    <p className="text-sm bg-slate-50 p-4 rounded-lg italic border-r-2 border-slate-300">
                        {/* @ts-ignore */}
                        {(block.content as any).model_answer || (block.content as any).modelAnswer || "תשובה לדוגמה לא זמינה"}
                    </p>
                </div>
            )
        }

        return (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200" onClick={() => setEditingBlockId(block.id)}>
                <h3 className="font-bold text-slate-700 mb-2">{block.type.toUpperCase().replace('_', ' ')}</h3>
                {block.type === 'fill_in_blanks' && (
                    <p className="text-lg leading-relaxed dir-rtl text-slate-800">
                        {(block.content?.text || "").split(/(\[.*?\])/g).map((part: string, i: number) =>
                            part.startsWith('[')
                                ? <span key={i} className="inline-block border-b-2 border-slate-400 w-24 mx-1 text-center text-slate-400 font-mono text-sm">{part.replace(/[\[\]]/g, '')}</span>
                                : part
                        )}
                    </p>
                )}
                {block.type === 'ordering' && (
                    <div className="space-y-2">
                        {/* @ts-ignore */}
                        <p className="font-bold mb-2">{block.content.instruction || (block.content as any).question}</p>
                        <ol className="list-decimal list-inside space-y-1 text-slate-600">
                            {/* @ts-ignore */}
                            {(block.content.correct_order || (block.content as any).items || []).map((item: any, i: number) => <li key={i}>{typeof item === 'string' ? item : item.text || item}</li>)}
                        </ol>
                    </div>
                )}
                <p className="text-slate-500 italic">[תוכן אינטראקטיבי: {block.type} - זמין בתצוגת תלמיד]</p>
            </div>
        );
    };

    const getTeacherTip = (block: ActivityBlock) => {
        // 1. Try to get from AI content
        if ((block.content as any)?.teacher_tip) {
            return (block.content as any).teacher_tip;
        }
        if (block.metadata?.teacher_tip) {
            return block.metadata.teacher_tip;
        }

        // 2. Fallback to generic rules if no AI tip
        console.log("No AI teacher tip found, using fallback");
        if (block.type === 'multiple-choice') return "ודאו שכל התלמידים מבינים את ההבדל בין המסיחים. שאלו: 'למה לדעתכם תשובה ב' אינה נכונה?'";
        if (block.type === 'open-question') return "עודדו תשובות מגוונות. אין תשובה אחת נכונה. שימו לב לתלמידים השקטים.";
        if (block.type === 'categorization') return "חלקו את הכיתה לקבוצות קטנות. תנו להם 5 דקות לדיון לפני האיסוף במליאה.";
        return null;
    };

    if (embedded) {
        return (
            <div className="w-full bg-slate-50 border-t border-slate-100 p-4 md:p-8 animate-fade-in" dir="rtl">
                <div className="max-w-4xl mx-auto space-y-8">
                    {/* Embedded Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
                            <IconEdit className="w-5 h-5 text-indigo-500" />
                            עריכת תוכן היחידה
                        </h2>
                        {onEdit && (
                            <button onClick={onEdit} className="text-sm text-indigo-600 font-bold hover:underline">
                                הגדרות מתקדמות
                            </button>
                        )}
                    </div>

                    {/* Content Loop Reuse */}
                    <div className="space-y-8">
                        {unit.activityBlocks?.map((block: ActivityBlock, idx: number) => {
                            return (
                                <div key={block.id} className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                                    {/* Step Header */}
                                    <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-4">
                                        <span className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-8 h-8 flex items-center justify-center rounded-lg font-black shadow-blue-200 shadow-lg glow">
                                            <BlockIconRenderer
                                                blockType={block.type}
                                                blockIndex={idx}
                                                totalBlocks={unit.activityBlocks?.length || 1}
                                                className="w-5 h-5"
                                            />
                                        </span>

                                        {/* Block Title */}
                                        <h3 className="text-lg font-bold text-slate-800">{getBlockTitle(block)}</h3>

                                        <button
                                            onClick={() => setEditingBlockId(block.id)}
                                            className="mr-auto flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:text-white hover:bg-wizdi-royal rounded-lg transition-all text-xs font-bold bg-slate-50"
                                        >
                                            <IconSparkles className="w-3.5 h-3.5" />
                                            שפרו עם AI
                                        </button>
                                    </div>

                                    {/* Refine Toolbar Overlay */}
                                    {renderRefineToolbar(block)}

                                    {/* Content */}
                                    <div className="prose prose-lg max-w-none prose-headings:font-black prose-p:text-slate-600 prose-li:text-slate-600">
                                        {renderBlockContent(block)}
                                    </div>

                                    {/* Teacher Tip */}
                                    {getTeacherTip(block) && (
                                        <div className="mt-8 bg-amber-50 rounded-xl p-4 md:p-6 border border-amber-100 flex gap-4">
                                            <div className="bg-white p-2 rounded-full shadow-sm text-amber-500 h-fit">
                                                <IconSparkles className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-amber-900 mb-1 text-sm uppercase tracking-wide">הנחיה למורה</h4>
                                                <p className="text-sm md:text-base text-amber-800/90 leading-relaxed font-medium">
                                                    {getTeacherTip(block)}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-[#f0f4f8] flex font-sans text-slate-800 z-50" dir="rtl">
            {/* Right Sidebar (Timeline) */}
            <div className="w-20 md:w-32 bg-white border-l border-slate-200 flex flex-col items-center py-8 shadow-sm z-10 print:hidden relative">
                <div className="mb-8 p-3 bg-blue-50 rounded-2xl text-blue-600">
                    <IconBook className="w-8 h-8" />
                </div>

                <div className="flex-1 w-full space-y-4 px-2">
                    {timelineItems.map(item => {
                        const Icon = item.icon; // Store icon component with capital letter
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleScrollTo(item.id)}
                                className={`w-full flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${activeSection === item.id ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-400'}`}
                            >
                                <Icon className="w-6 h-6" />
                                <span className="text-[10px] font-bold">{item.label}</span>
                            </button>
                        );
                    })}

                    {/* Time Tracker Visualization (Mock) */}
                    <div className="hidden md:block absolute bottom-8 right-1/2 translate-x-1/2 w-1 h-32 bg-slate-100 rounded-full overflow-hidden">
                        <div className="w-full h-1/3 bg-green-400 absolute bottom-0"></div>
                    </div>
                </div>
            </div>

            {/* Main Content (Cockpit) */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">

                {/* Header */}
                <div className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm print:hidden shrink-0 z-20">
                    <div className="flex items-center gap-4">
                        <button onClick={onExit || (() => window.history.back())} className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors" title="חזרה לבית">
                            <IconChevronRight className="w-5 h-5" />
                            <span className="font-bold text-sm hidden md:inline ml-2">חזרה</span>
                        </button>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                                {(unit.metadata?.status === 'generating') ? "בונה מערך שיעור..." : "מערך שיעור למורה"}
                            </span>
                            <h1 className="text-2xl font-black text-slate-800">{unit.title}</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Share Button */}
                        <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-xl font-bold transition shadow-sm border border-transparent hover:border-slate-200">
                            <IconShare className="w-5 h-5" />
                            <span className="hidden md:inline">שתף</span>
                        </button>

                        {/* Export PDF Button */}
                        <button onClick={handleExportPDF} className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold transition shadow-sm" title="יצוא ל-PDF">
                            <IconPrinter className="w-5 h-5" />
                            <span className="hidden md:inline">יצוא PDF</span>
                        </button>

                        <div className="h-8 w-px bg-slate-200 mx-2"></div>

                        <button onClick={onExit || (() => window.history.back())} className="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition" title="יציאה">
                            <IconX className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Script Scroll Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-12 print:p-0 bg-[#f0f4f8]">
                    <div className="max-w-4xl mx-auto space-y-8 print:max-w-none pb-32">

                        {/* Under Construction Banner */}
                        {(unit.metadata?.status === 'generating') && (
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 p-4 rounded-xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                                <div className="p-2 bg-white rounded-full shadow-sm">
                                    <IconSparkles className="w-5 h-5 text-amber-500 animate-spin" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-amber-800">המערך בבניה</h3>
                                    <p className="text-sm text-amber-700">ה-AI עובד כעת על יצירת התוכן. הרכיבים יופיעו בהדרגה.</p>
                                </div>
                            </div>
                        )}

                        {/* Goals Card (Static) */}
                        <div id="goals" className="bg-white p-8 rounded-3xl shadow-sm border-t-8 border-blue-500 print:shadow-none print:border scroll-mt-32">
                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <IconTarget className="text-blue-500 w-6 h-6" />
                                יעדי השיעור
                            </h2>
                            <ul className="space-y-2 text-slate-600 list-disc list-inside">
                                {(unit.goals && unit.goals.length > 0) ? (
                                    unit.goals.map((goal, i) => (
                                        <li key={i}>{goal}</li>
                                    ))
                                ) : (
                                    <>
                                        <li>התלמיד יבין את הנושא המרכזי ({unit.title}).</li>
                                        <li>התלמיד יתרגל חשיבה ביקורתית באמצעות שאלות דיון.</li>
                                        <li>התלמיד יתרגל יישום של החומר הנלמד.</li>
                                    </>
                                )}
                            </ul>
                        </div>

                        {/* Insert Initial Block */}
                        <InsertMenu index={0} />

                        {/* Blocks Loop */}
                        <div id="instruction" className="space-y-8">
                            {unit.activityBlocks?.map((block: ActivityBlock, idx: number) => {
                                return (
                                    <React.Fragment key={block.id}>
                                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 print:shadow-none print:break-inside-avoid relative overflow-hidden group hover:shadow-md transition-shadow">

                                            {/* Block Controls (Hover) */}
                                            <div className="absolute top-4 left-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur border border-slate-100 rounded-lg p-1 z-20 shadow-sm print:hidden">
                                                <button onClick={() => moveBlock(idx, 'up')} disabled={idx === 0} className="p-1 hover:text-blue-600 disabled:opacity-30 rounded hover:bg-blue-50 transition-colors" title="הזז למעלה"><IconArrowUp className="w-4 h-4" /></button>
                                                <button onClick={() => moveBlock(idx, 'down')} disabled={idx === (unit.activityBlocks?.length || 0) - 1} className="p-1 hover:text-blue-600 disabled:opacity-30 rounded hover:bg-blue-50 transition-colors" title="הזז למטה"><IconArrowDown className="w-4 h-4" /></button>
                                                <div className="w-px bg-slate-200 my-1 mx-1"></div>

                                                {/* Infographic Generator Button */}
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setShowInfographicMenu(showInfographicMenu === block.id ? null : block.id)}
                                                        className="p-1 hover:text-purple-600 rounded hover:bg-purple-50 transition-colors"
                                                        title="צור אינפוגרפיקה"
                                                        disabled={isGeneratingInfographic}
                                                    >
                                                        <IconInfographic className="w-4 h-4" />
                                                    </button>

                                                    {/* Infographic Type Selector Menu */}
                                                    {showInfographicMenu === block.id && (() => {
                                                        // Auto-detect infographic type
                                                        let textContent = '';
                                                        if (block.type === 'text') {
                                                            textContent = typeof block.content === 'string'
                                                                ? block.content
                                                                : ((block.content as any)?.teach_content || (block.content as any)?.text || '');
                                                        }
                                                        const detection = textContent ? detectInfographicType(textContent) : null;
                                                        const suitability = textContent ? analyzeInfographicSuitability(textContent) : null;

                                                        return (
                                                            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 min-w-[250px] z-30">
                                                                {/* Auto-detection header */}
                                                                {detection && suitability?.isSuitable && (
                                                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
                                                                        <div className="text-xs font-semibold text-blue-700 mb-1">💡 הצעה חכמה:</div>
                                                                        <button
                                                                            onClick={() => handleGenerateInfographic(block, detection.suggestedType)}
                                                                            className="w-full text-right px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-2 font-semibold"
                                                                            disabled={isGeneratingInfographic}
                                                                        >
                                                                            <IconSparkles className="w-4 h-4" />
                                                                            <div className="flex-1">
                                                                                <div>{detection.suggestedType === 'flowchart' ? 'תרשים זרימה' : detection.suggestedType === 'timeline' ? 'ציר זמן' : detection.suggestedType === 'comparison' ? 'השוואה' : 'מחזור'}</div>
                                                                                <div className="text-xs opacity-90">{detection.reason}</div>
                                                                            </div>
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                {/* Warning if not suitable */}
                                                                {suitability && !suitability.isSuitable && (
                                                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
                                                                        <div className="text-xs font-semibold text-amber-700 mb-1">⚠️ שים לב:</div>
                                                                        <div className="text-xs text-amber-600">
                                                                            {suitability.recommendations[0]}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <div className="text-xs font-semibold text-slate-600 mb-2 px-2">או בחר ידנית:</div>
                                                                <button
                                                                    onClick={() => handleGenerateInfographic(block, 'flowchart')}
                                                                    className={`w-full text-right px-3 py-2 text-sm hover:bg-purple-50 rounded transition-colors flex items-center gap-2 ${detection?.suggestedType === 'flowchart' ? 'bg-purple-50' : ''}`}
                                                                    disabled={isGeneratingInfographic}
                                                                >
                                                                    <IconList className="w-4 h-4 text-purple-600" />
                                                                    <span>תרשים זרימה</span>
                                                                    {detection?.suggestedType === 'flowchart' && <span className="mr-auto text-xs text-purple-600">מומלץ</span>}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleGenerateInfographic(block, 'timeline')}
                                                                    className={`w-full text-right px-3 py-2 text-sm hover:bg-blue-50 rounded transition-colors flex items-center gap-2 ${detection?.suggestedType === 'timeline' ? 'bg-blue-50' : ''}`}
                                                                    disabled={isGeneratingInfographic}
                                                                >
                                                                    <IconClock className="w-4 h-4 text-blue-600" />
                                                                    <span>ציר זמן</span>
                                                                    {detection?.suggestedType === 'timeline' && <span className="mr-auto text-xs text-blue-600">מומלץ</span>}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleGenerateInfographic(block, 'comparison')}
                                                                    className={`w-full text-right px-3 py-2 text-sm hover:bg-green-50 rounded transition-colors flex items-center gap-2 ${detection?.suggestedType === 'comparison' ? 'bg-green-50' : ''}`}
                                                                    disabled={isGeneratingInfographic}
                                                                >
                                                                    <IconLayer className="w-4 h-4 text-green-600" />
                                                                    <span>השוואה</span>
                                                                    {detection?.suggestedType === 'comparison' && <span className="mr-auto text-xs text-green-600">מומלץ</span>}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleGenerateInfographic(block, 'cycle')}
                                                                    className={`w-full text-right px-3 py-2 text-sm hover:bg-orange-50 rounded transition-colors flex items-center gap-2 ${detection?.suggestedType === 'cycle' ? 'bg-orange-50' : ''}`}
                                                                    disabled={isGeneratingInfographic}
                                                                >
                                                                    <IconTarget className="w-4 h-4 text-orange-600" />
                                                                    <span>מחזור</span>
                                                                    {detection?.suggestedType === 'cycle' && <span className="mr-auto text-xs text-orange-600">מומלץ</span>}
                                                                </button>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                                <div className="w-px bg-slate-200 my-1 mx-1"></div>
                                                <button onClick={() => deleteBlock(block.id)} className="p-1 hover:text-red-500 rounded hover:bg-red-50 transition-colors" title="מחק רכיב"><IconTrash className="w-4 h-4" /></button>
                                            </div>

                                            {/* Time Estimate Badge or Loading Indicator (Absolute) */}
                                            {isGeneratingInfographic ? (
                                                <div className="absolute top-6 left-6 bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full print:hidden animate-pulse flex items-center gap-2">
                                                    <IconInfographic className="w-4 h-4 animate-spin" />
                                                    <span>יוצר אינפוגרפיקה...</span>
                                                </div>
                                            ) : (
                                                <div className="absolute top-6 left-6 bg-slate-100 text-slate-500 text-xs font-bold px-3 py-1 rounded-full print:hidden">
                                                    ⏱️ 5 דק'
                                                </div>
                                            )}

                                            {/* Step Header */}
                                            <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-4">
                                                <span className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-8 h-8 flex items-center justify-center rounded-lg font-black shadow-blue-200 shadow-lg glow">
                                                    <BlockIconRenderer
                                                        blockType={block.type}
                                                        blockIndex={idx}
                                                        totalBlocks={unit.activityBlocks?.length || 1}
                                                        className="w-5 h-5"
                                                    />
                                                </span>

                                                {/* Block Title */}
                                                <h3 className="text-lg font-bold text-slate-800">{getBlockTitle(block)}</h3>
                                            </div>

                                            {/* Content */}
                                            <div className="prose prose-lg max-w-none prose-headings:font-black prose-p:text-slate-600 prose-li:text-slate-600 mb-6">
                                                {renderBlockContent(block)}
                                            </div>

                                            {/* Refine Toolbar - Now at bottom of block CONTENT area like UnitEditor */}
                                            {editingBlockId === block.id && renderRefineToolbar(block)}

                                            {/* Edit Trigger (If Not Editing) - Centered or accessible */}
                                            {editingBlockId !== block.id && (
                                                <div className="flex justify-end -mt-4 mb-4">
                                                    <button
                                                        onClick={() => setEditingBlockId(block.id)}
                                                        className="flex items-center gap-2 px-4 py-2 text-blue-500 hover:text-white hover:bg-blue-600 rounded-lg transition-all text-xs font-bold bg-blue-50 border border-blue-100"
                                                    >
                                                        <IconSparkles className="w-4 h-4" />
                                                        שפרו / ערכו עם AI
                                                    </button>
                                                </div>
                                            )}

                                            {/* Teacher Tip */}
                                            {getTeacherTip(block) && (
                                                <div className="mt-4 bg-amber-50 rounded-xl p-4 md:p-6 border border-amber-100 flex gap-4">
                                                    <div className="bg-white p-2 rounded-full shadow-sm text-amber-500 h-fit">
                                                        <IconSparkles className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-amber-900 mb-1 text-sm uppercase tracking-wide">הנחיה למורה</h4>
                                                        <p className="text-sm md:text-base text-amber-800/90 leading-relaxed font-medium">
                                                            {getTeacherTip(block)}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Insert Menu After Each Block */}
                                        <InsertMenu index={idx + 1} />
                                    </React.Fragment>
                                );
                            })}
                        </div>

                        {/* Summary Anchor */}
                        <div id="summary"></div>
                    </div>
                </div>
            </div>

            {/* Infographic Preview Modal */}
            {infographicPreview && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto animate-scale-in">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-t-2xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold">תצוגה מקדימה - אינפוגרפיקה</h3>
                                    <p className="text-sm opacity-90 mt-1">
                                        סוג: {infographicPreview.visualType === 'flowchart' ? 'תרשים זרימה' :
                                              infographicPreview.visualType === 'timeline' ? 'ציר זמן' :
                                              infographicPreview.visualType === 'comparison' ? 'השוואה' : 'מחזור'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setInfographicPreview(null)}
                                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                                    title="סגור"
                                >
                                    <IconX className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Image Preview */}
                        <div className="p-6">
                            <div className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200">
                                <img
                                    src={infographicPreview.imageUrl}
                                    alt="תצוגה מקדימה של אינפוגרפיקה"
                                    className="w-full h-auto rounded-lg shadow-lg"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-6 bg-slate-50 rounded-b-2xl flex gap-3 justify-end border-t">
                            <button
                                onClick={async () => {
                                    // Track preview rejection
                                    const { trackPreviewRejected } = await import('../services/infographicAnalytics');
                                    trackPreviewRejected(infographicPreview.visualType);
                                    setInfographicPreview(null);
                                }}
                                className="px-6 py-3 bg-white text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-semibold border border-slate-300"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={async () => {
                                    // Track type change intent
                                    const { trackTypeChanged } = await import('../services/infographicAnalytics');
                                    const oldType = infographicPreview.visualType;

                                    // Regenerate with different type
                                    setInfographicPreview(null);
                                    setShowInfographicMenu(infographicPreview.block.id);

                                    // Note: We'll track the actual new type when user selects it
                                    // For now just log that user wants to try another type
                                    console.log(`User wants to try different type from ${oldType}`);
                                }}
                                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold flex items-center gap-2"
                            >
                                <IconWand className="w-5 h-5" />
                                נסה סוג אחר
                            </button>
                            <button
                                onClick={handleConfirmInfographic}
                                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors font-semibold flex items-center gap-2 shadow-lg"
                            >
                                <IconCheck className="w-5 h-5" />
                                הוסף לשיעור
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherCockpit;
