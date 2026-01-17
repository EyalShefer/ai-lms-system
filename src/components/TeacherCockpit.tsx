import React, { useState, useEffect, useRef } from 'react';
import { IconSparkles, IconBook, IconVideo, IconTarget, IconCheck, IconPrinter, IconEdit, IconX, IconWand, IconPlus, IconTrash, IconArrowUp, IconArrowDown, IconShare, IconText, IconImage, IconList, IconChat, IconUpload, IconPalette, IconLink, IconChevronRight, IconHeadphones, IconLayer, IconBrain, IconClock, IconMicrophone, IconInfographic, IconEye, IconSend, IconMaximize, IconBalance } from '../icons';
import type { LearningUnit, ActivityBlock, Course } from '../shared/types/courseTypes';
import { refineBlockContent, generateAiImage, generateInfographicFromText, type InfographicType } from '../services/ai/geminiApi';
import {
    generateSingleMultipleChoiceQuestion,
    generateSingleOpenQuestion,
    generateCategorizationQuestion,
    generateOrderingQuestion,
    generateFillInBlanksQuestion,
    generateMemoryGame
} from '../gemini';
import { detectInfographicType, analyzeInfographicSuitability } from '../utils/infographicDetector';
import { PEDAGOGICAL_PHASES, getPedagogicalPhase } from '../utils/pedagogicalIcons';
import { trackPreviewOpened, trackPreviewConfirmed, trackPreviewRejected, trackTypeChanged } from '../services/infographicAnalytics';
import { createBlock } from '../shared/config/blockDefinitions';
import { downloadLessonPlanPDF } from '../services/pdfExportService';
import { uploadGeneratedImage } from '../services/storageService';
import type { TeacherLessonPlan } from '../shared/types/gemini.types';
import { RichTextEditor } from './RichTextEditor';
import { sanitizeHtml } from '../utils/sanitize';
import { TypewriterLoader } from './ui/Loading/TypewriterLoader';

// Interactive Question Components for preview mode
import MultipleChoiceQuestion from './MultipleChoiceQuestion';
import ClozeQuestion from './ClozeQuestion';
import OrderingQuestion from './OrderingQuestion';
import CategorizationQuestion from './CategorizationQuestion';
import MemoryGameQuestion from './MemoryGameQuestion';

// Lazy load CoursePlayer for full preview mode
const CoursePlayer = React.lazy(() => import('./CoursePlayer'));

// Lazy load SendActivitiesModal
const SendActivitiesModal = React.lazy(() => import('./SendActivitiesModal'));

// Lazy load PresentationMode for smart board projection
const PresentationMode = React.lazy(() => import('./PresentationMode'));


interface TeacherCockpitProps {
    unit: LearningUnit;
    courseId?: string; // For generating proper share links
    course?: Course; // Full course object for activity extraction
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
    'infographic': 'אינפוגרפיקה',
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
    'podcast': 'פודקאסט AI',
    'highlight': 'סימון בטקסט',
    'sentence_builder': 'בניית משפט',
    'image_labeling': 'תיוג תמונה',
    'table_completion': 'השלמת טבלה',
    'text_selection': 'בחירה מטקסט',
    'rating_scale': 'סקאלת דירוג',
    'matrix': 'מטריקס'
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

// Debounce delay - should match CourseContext SAVE_DEBOUNCE_MS
const SAVE_DEBOUNCE_MS = 2000;

const TeacherCockpit: React.FC<TeacherCockpitProps> = ({ unit, courseId, course, onExit, onEdit, onUpdateBlock, onUnitUpdate, embedded = false }) => {
    const [activeSection, setActiveSection] = useState<string>('all');
    const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
    const [refiningBlockId, setRefiningBlockId] = useState<string | null>(null); // Separate state for AI refine mode
    const [isRefining, setIsRefining] = useState(false);
    const [refinePrompt, setRefinePrompt] = useState("");

    // Store user's custom prompts per block to preserve them across open/close
    const userEditedPromptsRef = useRef<Record<string, string>>({});

    // Store content before AI refinement to allow reverting if result is not good
    const contentBeforeRefineRef = useRef<Record<string, any>>({});
    const [canRevertBlockId, setCanRevertBlockId] = useState<string | null>(null);

    const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null);

    // Track unsaved changes (for share warning)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const unsavedTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Send Activities Modal State
    const [showSendActivitiesModal, setShowSendActivitiesModal] = useState(false);

    // Editing state for goals
    const [isEditingGoals, setIsEditingGoals] = useState(false);
    const [editedGoals, setEditedGoals] = useState<string[]>(unit.goals || []);

    // Media State
    const [mediaInputMode, setMediaInputMode] = useState<Record<string, string | null>>({});
    const [mediaInputValue, setMediaInputValue] = useState<Record<string, string>>({});
    const [loadingBlockId, setLoadingBlockId] = useState<string | null>(null);

    // Infographic State
    const [showInfographicMenu, setShowInfographicMenu] = useState<string | null>(null);
    const [generatingInfographicBlockId, setGeneratingInfographicBlockId] = useState<string | null>(null);
    const [infographicPreview, setInfographicPreview] = useState<{
        imageUrl: string;
        block: ActivityBlock;
        visualType: InfographicType;
    } | null>(null);
    const [infographicTextInput, setInfographicTextInput] = useState<Record<string, string>>({});
    const [selectedInfographicType, setSelectedInfographicType] = useState<Record<string, InfographicType | 'auto'>>({});

    // Interactive Preview State - shows questions as students see them
    const [previewBlockIds, setPreviewBlockIds] = useState<Set<string>>(new Set());

    // Variant Preview Modal State
    const [variantPreviewBlock, setVariantPreviewBlock] = useState<ActivityBlock | null>(null);

    // AI Block Generation State
    const [generatingBlockIndex, setGeneratingBlockIndex] = useState<number | null>(null);

    // Full Preview Mode State - shows entire lesson as students see it
    const [isFullPreviewMode, setIsFullPreviewMode] = useState(false);

    // Presentation Mode State - clean projection for smart board
    const [isPresentationMode, setIsPresentationMode] = useState(false);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (unsavedTimeoutRef.current) {
                clearTimeout(unsavedTimeoutRef.current);
            }
        };
    }, []);

    // Sync editedGoals when unit.goals changes
    useEffect(() => {
        setEditedGoals(unit.goals || []);
    }, [unit.goals]);

    // --- CRUD Helpers ---
    const markAsUnsaved = () => {
        setHasUnsavedChanges(true);
        // Clear existing timeout
        if (unsavedTimeoutRef.current) {
            clearTimeout(unsavedTimeoutRef.current);
        }
        // Auto-clear after debounce period (when save should be complete)
        unsavedTimeoutRef.current = setTimeout(() => {
            setHasUnsavedChanges(false);
        }, SAVE_DEBOUNCE_MS + 500); // Add 500ms buffer
    };

    const updateUnitBlocks = (newBlocks: ActivityBlock[]) => {
        console.log('[updateUnitBlocks] Called with', newBlocks.length, 'blocks');
        console.log('[updateUnitBlocks] onUnitUpdate:', !!onUnitUpdate, 'onUpdateBlock:', !!onUpdateBlock);
        if (onUnitUpdate) {
            console.log('[updateUnitBlocks] Calling onUnitUpdate...');
            onUnitUpdate({ ...unit, activityBlocks: newBlocks });
            markAsUnsaved();
        } else if (onUpdateBlock) {
            console.warn("Using Legacy onUpdateBlock - Full CRUD not supported properly without onUnitUpdate");
        } else {
            console.error('[updateUnitBlocks] No update handler available!');
        }
    };

    const addBlockAtIndex = async (type: string, index: number) => {
        console.log('[addBlockAtIndex] Adding block:', type, 'at index:', index);
        console.log('[addBlockAtIndex] onUnitUpdate exists:', !!onUnitUpdate);

        // Get context from unit for AI generation
        const topic = unit.title || 'נושא כללי';
        const gradeLevel = unit.metadata?.gradeLevel || 'כיתה ו׳';
        const subject = unit.metadata?.subject || 'כללי';

        // Get source text from existing text blocks
        const sourceText = unit.activityBlocks
            ?.filter(b => b.type === 'text')
            .map(b => typeof b.content === 'string' ? b.content : (b.content?.text || b.content?.teach_content || ''))
            .join('\n')
            .substring(0, 2000) || '';

        // Create placeholder block with loading state
        const newBlock = createBlock(type, 'socratic');
        const newBlocks = [...(unit.activityBlocks || [])];
        newBlocks.splice(index, 0, newBlock);
        updateUnitBlocks(newBlocks);
        setActiveInsertIndex(null);
        setGeneratingBlockIndex(index);

        // For types that need AI generation, call the appropriate function
        const aiGeneratableTypes = ['multiple-choice', 'open-question', 'categorization', 'ordering', 'fill_in_blanks', 'memory_game', 'infographic'];

        if (aiGeneratableTypes.includes(type)) {
            try {
                let generatedContent: any = null;

                switch (type) {
                    case 'multiple-choice':
                        generatedContent = await generateSingleMultipleChoiceQuestion(topic, gradeLevel, sourceText, subject);
                        break;
                    case 'open-question':
                        generatedContent = await generateSingleOpenQuestion(topic, gradeLevel, sourceText, subject);
                        break;
                    case 'categorization':
                        generatedContent = await generateCategorizationQuestion(topic, gradeLevel, sourceText, subject);
                        break;
                    case 'ordering':
                        generatedContent = await generateOrderingQuestion(topic, gradeLevel, sourceText, subject);
                        break;
                    case 'fill_in_blanks':
                        generatedContent = await generateFillInBlanksQuestion(topic, gradeLevel, sourceText, subject);
                        break;
                    case 'memory_game':
                        generatedContent = await generateMemoryGame(topic, gradeLevel, sourceText, subject);
                        break;
                    case 'infographic':
                        // Generate infographic from source text
                        if (sourceText && sourceText.length > 50) {
                            setIsGeneratingInfographic(true);
                            try {
                                // Auto-detect best infographic type
                                const detection = detectInfographicType(sourceText);
                                const visualType = detection?.suggestedType || 'flowchart';

                                console.log('[addBlockAtIndex] Generating infographic, type:', visualType);
                                const imageBlob = await generateInfographicFromText(sourceText, visualType, topic);

                                if (imageBlob) {
                                    // Convert blob to base64 data URL
                                    const reader = new FileReader();
                                    const base64Promise = new Promise<string>((resolve) => {
                                        reader.onloadend = () => resolve(reader.result as string);
                                        reader.readAsDataURL(imageBlob);
                                    });
                                    const base64data = await base64Promise;

                                    generatedContent = {
                                        imageUrl: base64data,
                                        title: `אינפוגרפיקה: ${topic}`,
                                        caption: '',
                                        visualType: visualType
                                    };
                                }
                            } finally {
                                setIsGeneratingInfographic(false);
                            }
                        } else {
                            console.log('[addBlockAtIndex] Not enough source text for infographic');
                            // Keep the empty infographic block - user can generate manually
                        }
                        break;
                }

                if (generatedContent) {
                    console.log('[addBlockAtIndex] AI generated content:', generatedContent);
                    // Update the block with generated content
                    const updatedBlocks = [...(unit.activityBlocks || [])];
                    const blockIndex = updatedBlocks.findIndex(b => b.id === newBlock.id);
                    if (blockIndex !== -1) {
                        updatedBlocks[blockIndex] = { ...updatedBlocks[blockIndex], content: generatedContent };
                        updateUnitBlocks(updatedBlocks);
                    }
                }
            } catch (error) {
                console.error('[addBlockAtIndex] AI generation failed:', error);
                // Block already added with default content, so no need to do anything
            }
        }

        setGeneratingBlockIndex(null);
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

    const saveGoals = () => {
        if (onUnitUpdate) {
            const filteredGoals = editedGoals.filter(g => g.trim() !== '');
            onUnitUpdate({ ...unit, goals: filteredGoals });
            markAsUnsaved();
        }
        setIsEditingGoals(false);
    };

    const addGoal = () => {
        setEditedGoals([...editedGoals, '']);
    };

    const updateGoal = (index: number, value: string) => {
        const newGoals = [...editedGoals];
        newGoals[index] = value;
        setEditedGoals(newGoals);
    };

    const removeGoal = (index: number) => {
        const newGoals = editedGoals.filter((_, i) => i !== index);
        setEditedGoals(newGoals);
    };


    const handleScrollTo = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            setActiveSection(id);
        }
    };

    const handleExportPDF = async () => {
        // Helper to extract text content from a block
        const extractTextContent = (block: ActivityBlock): string => {
            if (block.type === 'text') {
                const content = block.content;
                if (typeof content === 'string') return content;
                if (content && typeof content === 'object') {
                    return (content as any).teach_content || (content as any).text || '';
                }
            }
            return '';
        };

        // Helper to strip HTML tags for plain text
        const stripHtml = (html: string): string => {
            const div = document.createElement('div');
            div.innerHTML = html;
            return div.textContent || div.innerText || '';
        };

        // Build slides from text blocks
        const textBlocks = unit.activityBlocks.filter(b => b.type === 'text');
        const slides = textBlocks.map((block, index) => {
            const content = extractTextContent(block);
            const title = getBlockTitle(block) || `חלק ${index + 1}`;
            // Extract bullet points from content (split by newlines or list items)
            const plainText = stripHtml(content);
            const lines = plainText.split(/\n+/).filter(l => l.trim());
            const bulletPoints = lines.slice(0, 5); // First 5 lines as bullet points

            return {
                slide_title: title,
                bullet_points_for_board: bulletPoints.length > 0 ? bulletPoints : [plainText.slice(0, 200) + '...'],
                script_to_say: plainText,
                timing_estimate: '5 דקות'
            };
        });

        // Extract questions for discussion from question blocks
        const questionBlocks = unit.activityBlocks.filter(b =>
            ['multiple-choice', 'open-question'].includes(b.type)
        );
        const discussionQuestions = questionBlocks.slice(0, 5).map(b => {
            if (b.type === 'multiple-choice' && b.content && typeof b.content === 'object') {
                return (b.content as any).question || '';
            }
            if (b.type === 'open-question' && b.content && typeof b.content === 'object') {
                return (b.content as any).question || '';
            }
            return '';
        }).filter(q => q);

        // Use the stored lesson plan from metadata, or create a rich one from available data
        const lessonPlan: TeacherLessonPlan = unit.metadata?.lessonPlan || {
            lesson_metadata: {
                title: unit.title,
                target_audience: unit.metadata?.gradeLevel || 'לא צוין',
                duration: '45 דקות',
                subject: unit.metadata?.subject,
                learning_objectives: unit.goals || []
            },
            hook: {
                script_for_teacher: unit.baseContent || stripHtml(extractTextContent(textBlocks[0]) || 'תוכן מערך השיעור'),
            },
            direct_instruction: {
                slides: slides.length > 0 ? slides : [{
                    slide_title: unit.title,
                    bullet_points_for_board: unit.goals || ['תוכן השיעור'],
                    script_to_say: unit.baseContent || 'תוכן מערך השיעור',
                    timing_estimate: '10 דקות'
                }]
            },
            guided_practice: {
                teacher_facilitation_script: 'השתמשו בפעילויות האינטראקטיביות המצורפות כדי לתרגל את הנושא בכיתה. הנחו את התלמידים בצורה מדורגת.',
                example_questions: [
                    {
                        question_text: 'מה למדנו עד עכשיו על הנושא הזה?',
                        expected_answer: 'תשובה שמסכמת את עיקרי הנושא',
                        common_mistakes: ['תשובה שטחית מדי', 'התמקדות בפרט אחד בלבד'],
                        follow_up_prompt: 'האם יש דוגמה נוספת מהחיים שלכם?'
                    }
                ],
                suggested_activities: unit.activityBlocks
                    .filter(b => ['multiple-choice', 'memory_game', 'fill_in_blanks', 'ordering', 'categorization', 'drag_and_drop', 'hotspot', 'open-question'].includes(b.type))
                    .map(b => ({
                        activity_type: b.type,
                        description: `פעילות ${BLOCK_TYPE_MAPPING[b.type] || b.type} לתרגול`,
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
                questions: discussionQuestions.length > 0 ? discussionQuestions : ['מה למדנו היום?', 'איך נוכל ליישם את הנלמד?']
            },
            summary: {
                takeaway_sentence: `סיכום: ${unit.title}`
            }
        };

        await downloadLessonPlanPDF(lessonPlan, `${unit.title} - מערך שיעור.pdf`);
    };

    const handleShare = async () => {
        // Check for unsaved changes and warn user
        if (hasUnsavedChanges) {
            const proceed = confirm(
                '⚠️ יש שינויים שעדיין נשמרים!\n\n' +
                'אם תשתפו עכשיו, הקישור עלול להפנות לגרסה ללא השינויים האחרונים.\n\n' +
                'המתינו מספר שניות ונסו שוב, או לחצו "אישור" להמשיך בכל זאת.'
            );
            if (!proceed) return;
        }

        // Build proper student share URL with courseId and unitId
        let shareUrl = window.location.href;
        if (courseId) {
            const baseUrl = `${window.location.origin}/?studentCourseId=${courseId}`;
            shareUrl = unit.id ? `${baseUrl}&unit=${unit.id}` : baseUrl;
        }

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
            const blob = await generateAiImage(prompt);
            if (blob) {
                // Upload to Firebase Storage instead of saving base64 in document
                const imageUrl = await uploadGeneratedImage(blob, 'ai-image', courseId, unit.id);
                updateBlockContent(blockId, imageUrl);
                setMediaInputMode(prev => ({ ...prev, [blockId]: null }));
            } else {
                alert("שגיאה ביצירת תמונה. נסה שנית.");
            }
        } catch (error) {
            console.error("Image Gen Error:", error);
            alert("שגיאה ביצירת תמונה. נסה שנית.");
        } finally {
            setLoadingBlockId(null);
        }
    };

    const handleGenerateInfographic = async (block: ActivityBlock, visualType: InfographicType, customText?: string) => {
        setGeneratingInfographicBlockId(block.id);
        setShowInfographicMenu(null);

        try {
            // Extract text content from block or use provided custom text
            let textContent = customText || '';

            if (!textContent) {
                if (block.type === 'text') {
                    textContent = typeof block.content === 'string'
                        ? block.content
                        : ((block.content as any)?.teach_content || (block.content as any)?.text || '');
                } else if (block.type === 'infographic') {
                    // For empty infographic blocks, get content from other text blocks in the unit
                    console.log('[handleGenerateInfographic] Infographic block detected, gathering text from unit...');
                    textContent = unit.activityBlocks
                        ?.filter(b => b.type === 'text')
                        .map(b => typeof b.content === 'string' ? b.content : ((b.content as any)?.teach_content || (b.content as any)?.text || ''))
                        .join('\n')
                        .substring(0, 2000) || '';
                } else if (block.content && typeof block.content === 'object') {
                    textContent = JSON.stringify(block.content);
                }
            }

            console.log('[handleGenerateInfographic] textContent length:', textContent.length, 'type:', visualType);

            if (!textContent || textContent.length < 3) {
                alert("נא להזין תוכן ליצירת האינפוגרפיקה");
                return;
            }

            // Generate infographic
            const imageBlob = await generateInfographicFromText(
                textContent,
                visualType,
                unit.title
            );

            if (imageBlob) {
                // Upload to Firebase Storage instead of saving base64 in document
                const imageUrl = await uploadGeneratedImage(imageBlob, 'infographic', courseId, unit.id);

                // Show preview modal with Storage URL
                setInfographicPreview({
                    imageUrl: imageUrl,
                    block: block,
                    visualType: visualType
                });

                // Track preview opened
                trackPreviewOpened(visualType);
            } else {
                alert("שגיאה ביצירת אינפוגרפיקה. נסה שנית.");
            }
        } catch (error) {
            console.error("Infographic Generation Error:", error);
            alert("שגיאה ביצירת אינפוגרפיקה");
        } finally {
            setGeneratingInfographicBlockId(null);
        }
    };

    const handleConfirmInfographic = async () => {
        if (!infographicPreview) return;

        // Track preview confirmed
        trackPreviewConfirmed(infographicPreview.visualType);

        const newBlocks = [...(unit.activityBlocks || [])];
        const currentIndex = newBlocks.findIndex(b => b.id === infographicPreview.block.id);

        // If the source block is an empty infographic block, update it directly
        if (infographicPreview.block.type === 'infographic') {
            if (currentIndex !== -1) {
                newBlocks[currentIndex] = {
                    ...newBlocks[currentIndex],
                    content: {
                        imageUrl: infographicPreview.imageUrl,
                        title: `אינפוגרפיקה: ${unit.title}`,
                        caption: '',
                        visualType: infographicPreview.visualType
                    },
                    metadata: {
                        ...newBlocks[currentIndex].metadata,
                        infographicType: infographicPreview.visualType
                    }
                };
                updateUnitBlocks(newBlocks);
            }
        } else {
            // Create new image block after current text block
            const newBlock = createBlock('image', 'socratic');
            newBlock.content = infographicPreview.imageUrl;
            newBlock.metadata = {
                ...newBlock.metadata,
                infographicType: infographicPreview.visualType,
                generatedFrom: infographicPreview.block.id
            };

            newBlocks.splice(currentIndex + 1, 0, newBlock);
            updateUnitBlocks(newBlocks);
        }

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

        // Save the current content BEFORE refinement so user can revert if result is not good
        contentBeforeRefineRef.current[block.id] = JSON.parse(JSON.stringify(block.content));
        console.log(`💾 Saved content before refinement for block ${block.id}`);

        try {
            console.log(`🔧 Refining block ${block.id} (type: ${block.type}) with instruction: "${instruction}"`);
            console.log(`📄 Original content:`, typeof block.content === 'string' ? block.content.substring(0, 100) + '...' : block.content);

            const newContent = await refineBlockContent(block.type, block.content, instruction);

            // Determine the final content to use
            let finalContent = newContent;

            // For text blocks, handle various response formats
            if (block.type === 'text') {
                if (typeof newContent === 'string') {
                    // Already a string - use as is
                    finalContent = newContent;
                } else if (newContent && typeof newContent === 'object') {
                    // Object response - try to extract text
                    finalContent = newContent.text || newContent.content || newContent.teach_content || newContent;
                }
            }

            // Preserve tip if exists in old content and we converted to string
            if (block.type === 'text' && typeof block.content === 'object' && (block.content as any).teacher_tip) {
                if (typeof finalContent === 'string') {
                    // Wrap back into object to preserve teacher_tip
                    finalContent = {
                        text: finalContent,
                        teacher_tip: (block.content as any).teacher_tip
                    };
                }
            }

            console.log(`✅ Final content to apply:`, typeof finalContent === 'string' ? finalContent.substring(0, 100) + '...' : finalContent);

            updateBlockContent(block.id, finalContent);
            setRefiningBlockId(null);
            setRefinePrompt("");

            // Enable revert option for this block
            setCanRevertBlockId(block.id);
        } catch (error) {
            console.error("Refine Error:", error);
            alert("שגיאה בעריכת התוכן");
            // Clear the saved content on error since we didn't change anything
            delete contentBeforeRefineRef.current[block.id];
        } finally {
            setIsRefining(false);
        }
    };

    // Revert to content before AI refinement
    const handleRevertRefinement = (blockId: string) => {
        const savedContent = contentBeforeRefineRef.current[blockId];
        if (savedContent) {
            console.log(`↩️ Reverting block ${blockId} to pre-refinement content`);
            updateBlockContent(blockId, savedContent);
            delete contentBeforeRefineRef.current[blockId];
            setCanRevertBlockId(null);
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
                {generatingBlockIndex === index ? (
                    <div className="glass border border-indigo-200 shadow-xl rounded-2xl p-6 flex flex-col items-center gap-3 backdrop-blur-xl bg-indigo-50/95 ring-4 ring-indigo-100/50">
                        <TypewriterLoader contentType="activity" isVisible={true} showSpinner={true} />
                    </div>
                ) : activeInsertIndex === index ? (
                    <div className="glass border border-white/60 shadow-xl rounded-2xl p-4 flex flex-wrap gap-3 animate-scale-in items-center justify-center backdrop-blur-xl bg-white/95 ring-4 ring-blue-50/50 max-w-2xl mx-auto" onClick={(e) => e.stopPropagation()}>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('text', index); }} className="insert-btn"><IconText className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['text']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('image', index); }} className="insert-btn"><IconImage className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['image']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('video', index); }} className="insert-btn"><IconVideo className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['video']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('multiple-choice', index); }} className="insert-btn"><IconList className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['multiple-choice']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('open-question', index); }} className="insert-btn"><IconEdit className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['open-question']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('interactive-chat', index); }} className="insert-btn"><IconChat className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['interactive-chat']}</span></button>

                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('fill_in_blanks', index); }} className="insert-btn"><IconEdit className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['fill_in_blanks']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('ordering', index); }} className="insert-btn"><IconList className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['ordering']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('categorization', index); }} className="insert-btn"><IconLayer className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['categorization']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('memory_game', index); }} className="insert-btn"><IconBrain className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['memory_game']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('true_false_speed', index); }} className="insert-btn"><IconClock className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['true_false_speed']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('audio-response', index); }} className="insert-btn"><IconMicrophone className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['audio-response']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('podcast', index); }} className="insert-btn"><IconHeadphones className="w-4 h-4" /><span>פודקאסט AI</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('infographic', index); }} className="insert-btn"><IconInfographic className="w-4 h-4" /><span>אינפוגרפיקה</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('mindmap', index); }} className="insert-btn bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 hover:border-purple-300"><IconBrain className="w-4 h-4 text-purple-600" /><span className="text-purple-700">{BLOCK_TYPE_MAPPING['mindmap']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('matching', index); }} className="insert-btn"><IconLink className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['matching']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('highlight', index); }} className="insert-btn"><IconEdit className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['highlight']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('sentence_builder', index); }} className="insert-btn"><IconText className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['sentence_builder']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('image_labeling', index); }} className="insert-btn"><IconImage className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['image_labeling']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('table_completion', index); }} className="insert-btn"><IconList className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['table_completion']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('text_selection', index); }} className="insert-btn"><IconCheck className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['text_selection']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('rating_scale', index); }} className="insert-btn"><IconBalance className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['rating_scale']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('matrix', index); }} className="insert-btn"><IconLayer className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['matrix']}</span></button>

                        <div className="w-px bg-slate-200 mx-2"></div>
                        <button onClick={(e) => { e.stopPropagation(); setActiveInsertIndex(null); }} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors"><IconX className="w-5 h-5" /></button>
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

    /**
     * Generate a smart default prompt suggestion based on block type and content
     * Returns a ready-to-use prompt that requires minimal editing from the teacher
     */
    const generateDefaultPromptForBlock = (block: ActivityBlock): string => {
        const blockType = block.type;
        const content = block.content;

        // Extract options count for multiple choice
        const getOptionsCount = (): number => {
            if (!content || typeof content === 'string') return 0;
            return ((content as any).options || []).length;
        };

        // Extract items count for ordering/categorization
        const getItemsCount = (): number => {
            if (!content || typeof content === 'string') return 0;
            return ((content as any).items || (content as any).pairs || []).length;
        };

        switch (blockType) {
            case 'multiple-choice': {
                const count = getOptionsCount();
                if (count < 4) {
                    return `הוסף עוד ${4 - count} מסיחים שגויים אבל הגיוניים`;
                }
                return `הפוך את המסיחים למתוחכמים יותר - שיהיו קרובים לתשובה הנכונה`;
            }
            case 'open-question':
                return `הפוך את השאלה למאתגרת יותר והוסף הנחיות ברורות לתשובה`;
            case 'categorization': {
                const itemsCount = getItemsCount();
                if (itemsCount < 6) {
                    return `הוסף עוד פריטים לכל קטגוריה`;
                }
                return `הוסף קטגוריה נוספת עם פריטים מתאימים`;
            }
            case 'memory_game': {
                const itemsCount = getItemsCount();
                if (itemsCount < 6) {
                    return `הוסף עוד 3 זוגות למשחק`;
                }
                return `שפר את הניסוח של הזוגות כדי שיהיו מאתגרים יותר`;
            }
            case 'ordering': {
                const itemsCount = getItemsCount();
                if (itemsCount < 5) {
                    return `הוסף עוד שלבים לרצף`;
                }
                return `הוסף הסברים קצרים לכל שלב`;
            }
            case 'fill_in_blanks':
                return `הוסף רמזים בסוגריים ליד כל מילה חסרה`;
            case 'text':
                return `פשט את השפה והוסף דוגמה מחיי היומיום`;
            case 'video':
                return `הוסף 3 שאלות מנחות לצפייה בסרטון`;
            case 'image':
                return `הוסף תיאור לתמונה ושאלת התבוננות אחת`;
            case 'interactive-chat':
                return `הוסף תרחיש נוסף לשיחה`;
            case 'podcast':
                return `הוסף נקודות מפתח לדיון בסוף הפודקאסט`;
            case 'infographic':
                return `הוסף עוד נתון אחד לאינפוגרפיקה`;
            // New question types
            case 'matching':
                return `הוסף עוד 2 זוגות להתאמה`;
            case 'highlight':
                return `הוסף עוד 2 מילים או ביטויים לסימון`;
            case 'sentence_builder':
                return `הוסף עוד משפט אחד לבנייה`;
            case 'image_labeling':
                return `הוסף עוד 2 תוויות לתמונה`;
            case 'table_completion':
                return `הוסף עוד שורה אחת לטבלה`;
            case 'text_selection':
                return `הוסף עוד קטע טקסט לבחירה`;
            case 'rating_scale':
                return `הוסף תיאור לכל רמה בסקאלה`;
            case 'matrix':
                return `הוסף עוד שורה ועמודה למטריצה`;
            default:
                return `פשט את השפה והוסף דוגמה`;
        }
    };

    // Handle refine prompt change and save to ref
    const handleRefinePromptChange = (blockId: string, value: string) => {
        setRefinePrompt(value);
        userEditedPromptsRef.current[blockId] = value;
    };

    // When opening refine toolbar, set default or restore saved prompt
    useEffect(() => {
        if (refiningBlockId) {
            const savedPrompt = userEditedPromptsRef.current[refiningBlockId];
            if (savedPrompt !== undefined) {
                setRefinePrompt(savedPrompt);
            } else {
                const block = unit.activityBlocks.find((b: ActivityBlock) => b.id === refiningBlockId);
                if (block) {
                    const defaultPrompt = generateDefaultPromptForBlock(block);
                    setRefinePrompt(defaultPrompt);
                }
            }
        }
    }, [refiningBlockId, unit.activityBlocks]);

    const renderRefineToolbar = (block: ActivityBlock) => {
        if (refiningBlockId !== block.id) return null;

        const presets = ["קצר יותר", "פשט שפה", "הוסף דוגמאות", "ניסוח מרתק"];

        return (
            <div className="absolute inset-x-0 bottom-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 animate-fade-in rounded-b-3xl border-t border-slate-100">
                <button
                    onClick={() => setRefiningBlockId(null)}
                    className="absolute top-3 left-3 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title="סגור"
                >
                    <IconX className="w-4 h-4" />
                </button>
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-wizdi-royal">
                    <IconWand className="w-4 h-4" />
                    שיפור עם AI
                </h4>
                <div className="flex flex-wrap gap-2 justify-center mb-3 max-w-lg">
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
                <div className="flex flex-col gap-2 w-full max-w-lg">
                    <textarea
                        value={refinePrompt}
                        onChange={(e) => handleRefinePromptChange(block.id, e.target.value)}
                        placeholder="כתבו הנחיות לשיפור התוכן..."
                        className="w-full p-3 border border-slate-200 rounded-lg focus:border-wizdi-royal outline-none text-sm min-h-[100px] resize-y"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (refinePrompt) handleRefineBlock(block, refinePrompt);
                            }
                        }}
                    />
                    <button
                        onClick={() => handleRefineBlock(block, refinePrompt)}
                        disabled={!refinePrompt || isRefining}
                        className="bg-wizdi-royal text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-bold text-sm self-end"
                    >
                        {isRefining ? (
                            <>
                                <IconSparkles className="animate-spin w-4 h-4" />
                                משפר...
                            </>
                        ) : (
                            <>
                                <IconCheck className="w-4 h-4" />
                                בצע שיפור
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    };

    const renderBlockContent = (block: ActivityBlock) => {
        // --- LOADING BLOCKS (Skeleton with Typewriter) ---
        if (block.metadata?.isLoading) {
            // Main loader block with full typewriter animation
            if (block.metadata?.isMainLoader) {
                return (
                    <div className="py-8 flex flex-col items-center justify-center min-h-[200px]">
                        <TypewriterLoader contentType="lesson" isVisible={true} />
                        <div className="mt-6 flex flex-wrap gap-2 justify-center">
                            <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">🪝 פתיחה מעניינת</span>
                            <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">🎓 הוראה פרונטלית</span>
                            <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">🧑‍🏫 תרגול מודרך</span>
                            <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">💻 פעילויות אינטראקטיביות</span>
                            <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">💬 דיון</span>
                            <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">📝 סיכום</span>
                        </div>
                    </div>
                );
            }
            // Secondary skeleton blocks - simple shimmer animation
            return (
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                    <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                </div>
            );
        }

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
                    <img src={block.content} className="w-full h-80 object-cover rounded-2xl shadow-md" alt="Lesson Visual" loading="lazy" decoding="async" />
                    {/* Control buttons - always visible */}
                    <div className="absolute top-2 right-2 flex gap-2">
                        <button
                            onClick={() => setMediaInputMode({ ...mediaInputMode, [block.id]: 'ai' })}
                            className="bg-white/90 p-2 rounded-full text-blue-500 hover:bg-blue-50 hover:text-blue-600 shadow-sm transition-all"
                            title="יצירת תמונה חדשה עם AI"
                        >
                            <IconWand className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => updateBlockContent(block.id, '')}
                            className="bg-white/90 p-2 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 shadow-sm transition-all"
                            title="מחק תמונה"
                        >
                            <IconTrash className="w-4 h-4" />
                        </button>
                    </div>
                    {/* AI regenerate overlay */}
                    {mediaInputMode[block.id] === 'ai' && (
                        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl p-6 flex flex-col justify-center z-20">
                            <h4 className="text-sm font-bold text-blue-700 mb-2">תארו את התמונה החדשה:</h4>
                            <textarea
                                className="w-full p-3 border border-blue-200 rounded-lg mb-3 text-sm focus:border-blue-400 outline-none"
                                rows={3}
                                placeholder="למשל: מפה עתיקה של ירושלים..."
                                onChange={(e) => setMediaInputValue({ ...mediaInputValue, [block.id]: e.target.value })}
                                autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setMediaInputMode({ ...mediaInputMode, [block.id]: null })} className="text-gray-500 text-sm px-3 py-2 hover:bg-gray-100 rounded-lg">ביטול</button>
                                <button onClick={() => handleGenerateAiImage(block.id)} disabled={loadingBlockId === block.id} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                                    {loadingBlockId === block.id ? <><IconSparkles className="w-4 h-4 animate-spin" /> יוצר...</> : <><IconPalette className="w-4 h-4" /> צור תמונה</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Infographic block
        if (block.type === 'infographic') {
            const infographicSrc = typeof block.content === 'string'
                ? block.content
                : (block.content?.imageUrl || block.metadata?.uploadedFileUrl || '');
            const infographicType = block.metadata?.infographicType || (typeof block.content === 'object' ? block.content?.visualType : undefined);
            const sourceBlockId = block.metadata?.generatedFrom;

            if (!infographicSrc) {
                // Check if there's text content in the unit to generate from
                const hasTextContent = unit.activityBlocks?.some(b =>
                    b.type === 'text' &&
                    (typeof b.content === 'string' ? b.content : ((b.content as any)?.teach_content || (b.content as any)?.text || '')).length > 50
                );
                const currentInputText = infographicTextInput[block.id] || '';

                const currentSelectedType = selectedInfographicType[block.id] || 'auto';

                return (
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-purple-200 rounded-xl bg-purple-50/50 relative">
                        <IconInfographic className="w-8 h-8 text-purple-400 mb-2" />
                        <span className="text-purple-600 font-bold mb-1">צור אינפוגרפיקה</span>
                        <span className="text-sm text-purple-500 mb-4">הזן נושא או תוכן ליצירת אינפוגרפיקה</span>

                        {/* Text input field */}
                        <textarea
                            value={currentInputText}
                            onChange={(e) => setInfographicTextInput(prev => ({ ...prev, [block.id]: e.target.value }))}
                            placeholder="לדוגמה: תהליך הפוטוסינתזה בצמחים, שלבי מחזור המים, השוואה בין יונקים לזוחלים..."
                            className="w-full max-w-md h-24 p-3 border border-purple-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent mb-3"
                            dir="rtl"
                        />

                        {/* Infographic type selector */}
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-sm text-purple-600">סוג:</span>
                            <select
                                value={currentSelectedType}
                                onChange={(e) => setSelectedInfographicType(prev => ({ ...prev, [block.id]: e.target.value as InfographicType | 'auto' }))}
                                className="px-3 py-1.5 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                                dir="rtl"
                            >
                                <option value="auto">🤖 זיהוי אוטומטי</option>
                                <option value="flowchart">🔄 תרשים זרימה</option>
                                <option value="timeline">📅 ציר זמן</option>
                                <option value="comparison">⚖️ השוואה</option>
                                <option value="cycle">🔁 מחזור</option>
                            </select>
                        </div>

                        <button
                            onClick={() => {
                                const textToUse = currentInputText.trim() || (hasTextContent ? undefined : '');
                                if (!textToUse && !hasTextContent) {
                                    alert('נא להזין נושא ליצירת האינפוגרפיקה');
                                    return;
                                }
                                // Use selected type or auto-detect
                                let typeToUse: InfographicType;
                                if (currentSelectedType === 'auto') {
                                    const contentForDetection = textToUse || (block.content?.text as string) || '';
                                    const detection = detectInfographicType(contentForDetection);
                                    typeToUse = detection.suggestedType;
                                } else {
                                    typeToUse = currentSelectedType;
                                }
                                handleGenerateInfographic(block, typeToUse, textToUse || undefined);
                            }}
                            disabled={generatingInfographicBlockId === block.id}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-bold text-sm disabled:opacity-50"
                        >
                            {generatingInfographicBlockId === block.id ? (
                                <>
                                    <IconInfographic className="w-4 h-4 animate-spin" />
                                    <span>יוצר...</span>
                                </>
                            ) : (
                                <>
                                    <IconSparkles className="w-4 h-4" />
                                    <span>צור אינפוגרפיקה עכשיו</span>
                                </>
                            )}
                        </button>

                        {hasTextContent && !currentInputText && (
                            <span className="text-xs text-purple-400 mt-2">או ישתמש בטקסט מהיחידה</span>
                        )}
                    </div>
                );
            }

            return (
                <div className="relative group">
                    <img src={infographicSrc} className="w-full rounded-2xl shadow-md" alt="אינפוגרפיקה" loading="lazy" decoding="async" />
                    {/* Type badge */}
                    {infographicType && (
                        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-purple-700 shadow-sm">
                            {infographicType === 'flowchart' ? '🔄 תרשים זרימה' :
                             infographicType === 'timeline' ? '📅 ציר זמן' :
                             infographicType === 'comparison' ? '⚖️ השוואה' : '🔁 מחזור'}
                        </div>
                    )}
                    {/* Control buttons */}
                    <div className="absolute top-2 right-2 flex gap-2">
                        {sourceBlockId && (
                            <button
                                onClick={() => {
                                    const sourceBlock = unit.activityBlocks?.find(b => b.id === sourceBlockId);
                                    if (sourceBlock) {
                                        setShowInfographicMenu(sourceBlock.id);
                                    }
                                }}
                                className="bg-white/90 p-2 rounded-full text-purple-500 hover:bg-purple-50 hover:text-purple-600 shadow-sm transition-all"
                                title="יצירת אינפוגרפיקה חדשה"
                            >
                                <IconWand className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={() => deleteBlock(block.id)}
                            className="bg-white/90 p-2 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 shadow-sm transition-all"
                            title="מחק אינפוגרפיקה"
                        >
                            <IconTrash className="w-4 h-4" />
                        </button>
                    </div>
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
            const textContent = typeof block.content === 'string' ? block.content : ((block.content as any)?.teach_content || (block.content as any)?.text || "");
            return (
                <div className="relative">
                    <RichTextEditor
                        value={textContent}
                        onChange={(html) => updateBlockContent(block.id, html)}
                        placeholder="כתבו כאן את תוכן הפעילות..."
                        minHeight="300px"
                        autoFocus
                    />
                    <div className="mt-3 flex gap-2 justify-end">
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

            // Check if content contains HTML tags that should be rendered
            const containsHtmlTags = /<(div|p|h[1-6]|ul|ol|li|strong|em|span|br|table|tr|td|th)[^>]*>/i.test(textContent.trim());

            if (containsHtmlTags) {
                // Remove h3 title as it is now shown in the block header
                const contentWithoutTitle = textContent.replace(/<h3[^>]*>.*?<\/h3>/gi, '');
                return (
                    <div
                        onClick={() => setEditingBlockId(block.id)}
                        className="teacher-lesson-content cursor-text hover:ring-2 hover:ring-blue-100 rounded-xl transition-all relative p-2 -m-2"
                        title="לחץ לעריכה"
                    >
                        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(contentWithoutTitle) }} />
                    </div>
                );
            }

            return (
                <div onClick={() => setEditingBlockId(block.id)} className="cursor-text hover:ring-2 hover:ring-slate-100 rounded-lg p-2 transition-all -m-2">
                    {textContent.split('\n').map((line: string, i: number) => {
                        // Skip title lines (starting with #) as they are shown in block header
                        if (line.startsWith('#')) return null;
                        return <p key={i} className="mb-2">{line}</p>;
                    })}
                </div>
            )
        }
        // --- INTERACTIVE QUESTION BLOCKS (with preview toggle) ---
        const isInteractiveBlock = ['multiple-choice', 'fill_in_blanks', 'ordering', 'categorization', 'memory_game', 'true_false_speed'].includes(block.type);
        const isInPreviewMode = previewBlockIds.has(block.id);

        if (isInteractiveBlock) {
            const togglePreview = () => {
                setPreviewBlockIds(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(block.id)) {
                        newSet.delete(block.id);
                    } else {
                        newSet.add(block.id);
                    }
                    return newSet;
                });
            };

            // Interactive Preview Mode - show full interactive component
            if (isInPreviewMode) {
                return (
                    <div className="relative">
                        <button
                            onClick={togglePreview}
                            className="absolute -top-2 -left-2 z-20 flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold shadow-lg hover:bg-blue-700 transition-all"
                        >
                            <IconEdit className="w-3.5 h-3.5" />
                            חזרה לעריכה
                        </button>
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border-2 border-blue-200">
                            <div className="text-xs text-blue-600 font-bold mb-3 flex items-center gap-2">
                                <IconEye className="w-4 h-4" />
                                תצוגה מקדימה אינטראקטיבית - כך יראו התלמידים
                            </div>
                            {block.type === 'multiple-choice' && (
                                <MultipleChoiceQuestion block={block} onAnswer={() => {}} isReviewMode={true} />
                            )}
                            {block.type === 'fill_in_blanks' && (
                                <ClozeQuestion block={block} onComplete={() => {}} />
                            )}
                            {block.type === 'ordering' && (
                                <OrderingQuestion block={block} onComplete={() => {}} />
                            )}
                            {block.type === 'categorization' && (
                                <CategorizationQuestion block={block} onComplete={() => {}} />
                            )}
                            {block.type === 'memory_game' && (
                                <MemoryGameQuestion block={block} onComplete={() => {}} />
                            )}
                        </div>
                    </div>
                );
            }

            // Teacher Edit View - show structured data
            return (
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setEditingBlockId(block.id)}>
                        {block.type === 'multiple-choice' && (
                            <div>
                                <h3 className="text-lg font-bold mb-4" dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content.question || '') }} />
                                <ul className="list-disc pr-5 space-y-2">
                                    {block.content.options?.map((opt: any, idx: number) => (
                                        <li key={idx} className={opt === block.content.correctAnswer ? 'text-green-600 font-bold' : ''}>
                                            {typeof opt === 'string' ? opt : opt.value}
                                            {opt === block.content.correctAnswer && <span className="mr-2 text-xs bg-green-100 px-2 py-0.5 rounded-full">✓ תשובה נכונה</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {block.type === 'fill_in_blanks' && (
                            <div>
                                <h4 className="font-bold text-slate-700 mb-2">השלמת משפטים</h4>
                                <p className="text-lg leading-relaxed dir-rtl text-slate-800">
                                    {(block.content?.text || "").split(/(\[.*?\])/g).map((part: string, i: number) =>
                                        part.startsWith('[')
                                            ? <span key={i} className="inline-block bg-yellow-100 border-b-2 border-yellow-400 px-2 mx-1 font-bold text-yellow-800">{part.replace(/[\[\]]/g, '')}</span>
                                            : <span key={i} dangerouslySetInnerHTML={{ __html: sanitizeHtml(part) }} />
                                    )}
                                </p>
                            </div>
                        )}
                        {block.type === 'ordering' && (
                            <div>
                                <h4 className="font-bold text-slate-700 mb-2">סידור רצף</h4>
                                <p className="text-sm text-slate-500 mb-3">{(block.content as any).instruction || (block.content as any).question}</p>
                                <ol className="list-decimal list-inside space-y-1 text-slate-600 bg-white p-3 rounded-lg border">
                                    {((block.content as any).correct_order || (block.content as any).items || []).map((item: any, i: number) => (
                                        <li key={i} className="py-1 border-b border-slate-100 last:border-0">
                                            <span className="font-medium">{typeof item === 'string' ? item : item.text || item}</span>
                                        </li>
                                    ))}
                                </ol>
                                <p className="text-xs text-green-600 mt-2">✓ הסדר המוצג הוא הסדר הנכון</p>
                            </div>
                        )}
                        {block.type === 'categorization' && (
                            <div>
                                <h4 className="font-bold text-slate-700 mb-2">מיון לקטגוריות</h4>
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                    {(block.content?.categories || []).map((cat: string, i: number) => (
                                        <div key={i} className="bg-white p-3 rounded-lg border">
                                            <h5 className="font-bold text-blue-700 mb-2">{cat}</h5>
                                            <ul className="text-sm text-slate-600 space-y-1">
                                                {(block.content?.items || [])
                                                    .filter((item: any) => item.category === cat)
                                                    .map((item: any, j: number) => (
                                                        <li key={j} className="bg-slate-50 px-2 py-1 rounded">{item.text}</li>
                                                    ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {block.type === 'memory_game' && (
                            <div>
                                <h4 className="font-bold text-slate-700 mb-2">משחק זיכרון</h4>
                                <div className="grid grid-cols-2 gap-2 mt-3">
                                    {(block.content?.pairs || []).map((pair: any, i: number) => (
                                        <div key={i} className="flex gap-2 items-center bg-white p-2 rounded-lg border">
                                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm font-medium flex-1 text-center">{pair.card_a || pair.front}</span>
                                            <span className="text-slate-400">↔</span>
                                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium flex-1 text-center">{pair.card_b || pair.back}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {block.type === 'true_false_speed' && (
                            <div>
                                <h4 className="font-bold text-slate-700 mb-2">אמת או שקר</h4>
                                <ul className="space-y-2 mt-3">
                                    {(block.content?.statements || []).map((stmt: any, i: number) => (
                                        <li key={i} className="flex items-center gap-3 bg-white p-2 rounded-lg border">
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${stmt.isTrue || stmt.is_true ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {stmt.isTrue || stmt.is_true ? 'אמת' : 'שקר'}
                                            </span>
                                            <span className="text-slate-700">{stmt.text || stmt.statement}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                </div>
            );
        }

        if (block.type === 'open-question') {
            return (
                <div onClick={() => setEditingBlockId(block.id)} className="cursor-pointer hover:ring-2 hover:ring-blue-100 rounded-xl p-2 transition-all -m-2">
                    <h3 className="text-lg font-bold mb-4">שאלה לדיון: <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content.question || '') }} /></h3>
                    <p className="text-sm bg-slate-50 p-4 rounded-lg italic border-r-2 border-slate-300">
                        {(block.content as any).model_answer || (block.content as any).modelAnswer || "תשובה לדוגמה לא זמינה"}
                    </p>
                </div>
            )
        }

        // Editable Mode (Fill in Blanks) - when in edit mode
        if (editingBlockId === block.id && block.type === 'fill_in_blanks') {
            const clozeText = block.content?.text || "";
            return (
                <div className="relative">
                    <div className="mb-2 text-sm text-slate-500">
                        הקיפו מילים בסוגריים מרובעים [כך] כדי ליצור חללים למילוי
                    </div>
                    <RichTextEditor
                        value={clozeText}
                        onChange={(html) => updateBlockContent(block.id, { ...block.content, text: html })}
                        placeholder="כתבו את הטקסט והקיפו מילים ב-[סוגריים מרובעים] ליצירת חללים..."
                        minHeight="200px"
                        autoFocus
                    />
                    <div className="mt-3 flex gap-2 justify-end">
                        <button onClick={() => setEditingBlockId(null)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md transition-all">
                            סיום עריכה
                        </button>
                    </div>
                </div>
            );
        }

        // Default fallback for other block types
        return (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setEditingBlockId(block.id)}>
                <h3 className="font-bold text-slate-700 mb-2">{BLOCK_TYPE_MAPPING[block.type] || block.type}</h3>
                <p className="text-slate-500 italic">[לחצו לעריכה]</p>
            </div>
        );
    };
    // Teacher tips removed - good lesson content should be self-explanatory
    const getTeacherTip = (_block: ActivityBlock) => {
        return null;
    };

    if (embedded) {
        return (
            <div className="w-full bg-slate-50 border-t border-slate-100 p-4 md:p-8 animate-fade-in" dir="rtl">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Embedded Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
                            <IconEdit className="w-5 h-5 text-indigo-500" />
                            עריכת תוכן היחידה
                        </h2>
                        <div className="flex items-center gap-3">
                            {hasUnsavedChanges && (
                                <span className="text-xs text-amber-600 font-medium flex items-center gap-1 animate-pulse">
                                    <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                    שומר...
                                </span>
                            )}
                            {!hasUnsavedChanges && onUnitUpdate && (
                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                    <IconCheck className="w-3 h-3" />
                                    נשמר
                                </span>
                            )}
                            {onEdit && (
                                <button onClick={onEdit} className="text-sm text-indigo-600 font-bold hover:underline">
                                    הגדרות מתקדמות
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Insert Menu at Top */}
                    <InsertMenu index={0} />

                    {/* Content Loop Reuse */}
                    <div className="space-y-6">
                        {unit.activityBlocks?.map((block: ActivityBlock, idx: number) => {
                            return (
                                <React.Fragment key={block.id}>
                                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                                        {/* Block Controls (Hover) */}
                                        <div className="absolute top-4 left-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur border border-slate-100 rounded-lg p-1 z-20 shadow-sm">
                                            <button onClick={() => moveBlock(idx, 'up')} disabled={idx === 0} className="p-1 hover:text-blue-600 disabled:opacity-30 rounded hover:bg-blue-50 transition-colors" title="הזז למעלה"><IconArrowUp className="w-4 h-4" /></button>
                                            <button onClick={() => moveBlock(idx, 'down')} disabled={idx === (unit.activityBlocks?.length || 0) - 1} className="p-1 hover:text-blue-600 disabled:opacity-30 rounded hover:bg-blue-50 transition-colors" title="הזז למטה"><IconArrowDown className="w-4 h-4" /></button>
                                            <div className="w-px bg-slate-200 my-1 mx-1"></div>
                                            <button onClick={() => deleteBlock(block.id)} className="p-1 hover:text-red-600 rounded hover:bg-red-50 transition-colors" title="מחק רכיב"><IconTrash className="w-4 h-4" /></button>
                                        </div>

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

                                            {/* Adaptive Variants Indicator - Clickable to Preview */}
                                            {block.metadata?.has_variants && (
                                                <div className="flex items-center gap-1.5">
                                                    {/* Original (Middle) Badge */}
                                                    <button
                                                        onClick={() => setVariantPreviewBlock(block)}
                                                        className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full flex items-center gap-1 hover:bg-blue-200 transition-colors cursor-pointer"
                                                        title="צפייה ב-3 הגרסאות"
                                                    >
                                                        <span>📄</span> מקורית
                                                    </button>
                                                    {block.metadata?.scaffolding_variant && (
                                                        <button
                                                            onClick={() => setVariantPreviewBlock(block)}
                                                            className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1 hover:bg-emerald-200 transition-colors cursor-pointer"
                                                            title="צפייה בגרסה הקלה"
                                                        >
                                                            <span>📚</span> קלה
                                                        </button>
                                                    )}
                                                    {block.metadata?.enrichment_variant && (
                                                        <button
                                                            onClick={() => setVariantPreviewBlock(block)}
                                                            className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 rounded-full flex items-center gap-1 hover:bg-purple-200 transition-colors cursor-pointer"
                                                            title="צפייה בגרסה המאתגרת"
                                                        >
                                                            <span>🚀</span> מאתגרת
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            <button
                                                onClick={() => setRefiningBlockId(block.id)}
                                                className="mr-auto flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:text-white hover:bg-wizdi-royal rounded-lg transition-all text-xs font-bold bg-slate-50"
                                            >
                                                <IconSparkles className="w-3.5 h-3.5" />
                                                שפרו עם AI
                                            </button>

                                            {/* Revert button - shows when AI refinement was just applied to this block */}
                                            {canRevertBlockId === block.id && contentBeforeRefineRef.current[block.id] && (
                                                <button
                                                    onClick={() => handleRevertRefinement(block.id)}
                                                    className="flex items-center gap-2 px-3 py-1.5 text-orange-600 hover:text-white hover:bg-orange-500 rounded-lg transition-all text-xs font-bold bg-orange-50 border border-orange-200"
                                                    title="חזרה לגרסה הקודמת"
                                                >
                                                    <IconArrowUp className="w-3.5 h-3.5 rotate-180" />
                                                    בטל שיפור
                                                </button>
                                            )}
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

                                    {/* Insert Menu After Block */}
                                    <InsertMenu index={idx + 1} />
                                </React.Fragment>
                            )
                        })}
                    </div>

                    {/* Empty State */}
                    {(!unit.activityBlocks || unit.activityBlocks.length === 0) && (
                        <div className="text-center py-12 text-slate-400">
                            <IconPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>אין רכיבים ביחידה זו. לחצו על "הוסיפו רכיב" להתחיל.</p>
                        </div>
                    )}
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
                        <button onClick={() => {
                            console.log('🔙 Back button clicked, onExit:', typeof onExit);
                            if (onExit) {
                                onExit();
                            } else {
                                // Fallback: reload to home
                                window.location.href = '/';
                            }
                        }} className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors" title="חזרה לבית">
                            <IconChevronRight className="w-5 h-5" />
                            <span className="font-bold text-sm hidden md:inline ml-2">חזרה</span>
                        </button>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                                {(unit.metadata?.status === 'generating') ? "בונה מערך שיעור..." : "מערך שיעור למורה"}
                            </span>
                            <h1 className="text-2xl font-black text-slate-800">{unit.title?.replace(/^יחידת לימוד:\s*/i, '')}</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Send Activities to Students Button */}
                        {course && (
                            <button
                                onClick={() => setShowSendActivitiesModal(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition shadow-sm border text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
                                title="שלח פעילויות לתלמידים"
                            >
                                <IconSend className="w-5 h-5" />
                                <span className="hidden md:inline">שלח לתלמידים</span>
                            </button>
                        )}

                        {/* Preview Button */}
                        <button
                            onClick={() => setIsFullPreviewMode(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition shadow-sm border text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                            title="תצוגה מקדימה - ראה איך התלמידים יראו את המערך"
                        >
                            <IconEye className="w-5 h-5" />
                            <span className="hidden md:inline">תצוגה מקדימה</span>
                        </button>

                        {/* Presentation Mode Button - Project to Smart Board */}
                        <button
                            onClick={() => setIsPresentationMode(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition shadow-sm border text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100"
                            title="הקרנה ללוח - הצג תוכן נקי על הלוח החכם"
                        >
                            <IconMaximize className="w-5 h-5" />
                            <span className="hidden md:inline">הקרן ללוח</span>
                        </button>

                        {/* Share Button */}
                        <button
                            onClick={handleShare}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition shadow-sm border ${
                                hasUnsavedChanges
                                    ? 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100'
                                    : 'text-slate-600 hover:bg-slate-50 border-transparent hover:border-slate-200'
                            }`}
                            title={hasUnsavedChanges ? 'יש שינויים שעדיין נשמרים...' : 'שתף קישור לתלמידים'}
                        >
                            <IconShare className={`w-5 h-5 ${hasUnsavedChanges ? 'animate-pulse' : ''}`} />
                            <span className="hidden md:inline">{hasUnsavedChanges ? 'שומר...' : 'שתף'}</span>
                        </button>

                        {/* Export PDF Button */}
                        <button onClick={handleExportPDF} className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold transition shadow-sm" title="יצוא ל-PDF">
                            <IconPrinter className="w-5 h-5" />
                            <span className="hidden md:inline">יצוא PDF</span>
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

                        {/* Goals Card (Editable) */}
                        <div id="goals" className="bg-white p-8 rounded-3xl shadow-sm border-t-8 border-blue-500 print:shadow-none print:border scroll-mt-32 relative group hover:shadow-md transition-shadow">
                            {/* Edit Button (Hover) */}
                            {!isEditingGoals && (
                                <button
                                    onClick={() => setIsEditingGoals(true)}
                                    className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:text-white hover:bg-blue-600 rounded-lg transition-all text-xs font-bold bg-slate-50 border border-slate-100 opacity-0 group-hover:opacity-100 print:hidden"
                                >
                                    <IconEdit className="w-3.5 h-3.5" />
                                    ערוך
                                </button>
                            )}

                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <IconTarget className="text-blue-500 w-6 h-6" />
                                יעדי השיעור
                            </h2>

                            {isEditingGoals ? (
                                <div className="space-y-3">
                                    {editedGoals.map((goal, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={goal}
                                                onChange={(e) => updateGoal(i, e.target.value)}
                                                className="flex-1 p-2 border border-slate-200 rounded-lg focus:border-blue-400 outline-none text-slate-600"
                                                placeholder="הכנס יעד..."
                                                autoFocus={i === editedGoals.length - 1}
                                            />
                                            <button
                                                onClick={() => removeGoal(i)}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="הסר יעד"
                                            >
                                                <IconTrash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex gap-2 mt-4">
                                        <button
                                            onClick={addGoal}
                                            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-bold border border-blue-200"
                                        >
                                            <IconPlus className="w-4 h-4" />
                                            הוסף יעד
                                        </button>
                                        <div className="flex-1"></div>
                                        <button
                                            onClick={() => {
                                                setEditedGoals(unit.goals || []);
                                                setIsEditingGoals(false);
                                            }}
                                            className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors text-sm font-bold"
                                        >
                                            ביטול
                                        </button>
                                        <button
                                            onClick={saveGoals}
                                            className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors text-sm font-bold shadow-sm"
                                        >
                                            שמור
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <ul className="space-y-2 text-slate-600 list-disc list-inside cursor-pointer hover:bg-slate-50 rounded-lg p-2 -m-2 transition-colors" onClick={() => setIsEditingGoals(true)}>
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
                            )}
                        </div>

                        {/* Insert Initial Block */}
                        <InsertMenu index={0} />

                        {/* Blocks Loop */}
                        <div className="space-y-8">
                            {unit.activityBlocks?.filter((block): block is ActivityBlock => block !== null && block !== undefined).map((block: ActivityBlock, idx: number) => {
                                const totalBlocks = unit.activityBlocks?.length || 0;
                                const phase = getPedagogicalPhase(idx, totalBlocks, block.type);
                                const prevBlock = idx > 0 ? unit.activityBlocks?.[idx - 1] : null;
                                const prevPhase = prevBlock ? getPedagogicalPhase(idx - 1, totalBlocks, prevBlock.type) : null;

                                // Determine which section anchors to show before this block
                                const showOpeningAnchor = idx === 0; // First block is always opening
                                const showInstructionAnchor = phase === 'instruction' && prevPhase !== 'instruction' && prevPhase !== null;
                                const showPracticeAnchor = phase === 'practice' && prevPhase !== 'practice';
                                const showSummaryAnchor = phase === 'summary' && prevPhase !== 'summary';

                                return (
                                    <React.Fragment key={block.id}>
                                        {/* Opening Section Anchor - inserted before first block */}
                                        {showOpeningAnchor && <div id="opening" className="scroll-mt-32"></div>}
                                        {/* Instruction Section Anchor - inserted before first instruction block */}
                                        {showInstructionAnchor && <div id="instruction" className="scroll-mt-32"></div>}
                                        {/* Practice Section Anchor - inserted before first practice block */}
                                        {showPracticeAnchor && <div id="practice" className="scroll-mt-32"></div>}
                                        {/* Summary Section Anchor - inserted before first summary block */}
                                        {showSummaryAnchor && <div id="summary" className="scroll-mt-32"></div>}
                                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 print:shadow-none print:break-inside-avoid relative overflow-hidden group hover:shadow-md transition-shadow">

                                            {/* Block Controls (Hover) */}
                                            <div className="absolute top-4 left-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur border border-slate-100 rounded-lg p-1 z-20 shadow-sm print:hidden">
                                                <button onClick={() => moveBlock(idx, 'up')} disabled={idx === 0} className="p-1 hover:text-blue-600 disabled:opacity-30 rounded hover:bg-blue-50 transition-colors" title="הזז למעלה"><IconArrowUp className="w-4 h-4" /></button>
                                                <button onClick={() => moveBlock(idx, 'down')} disabled={idx === (unit.activityBlocks?.length || 0) - 1} className="p-1 hover:text-blue-600 disabled:opacity-30 rounded hover:bg-blue-50 transition-colors" title="הזז למטה"><IconArrowDown className="w-4 h-4" /></button>
                                                <div className="w-px bg-slate-200 my-1 mx-1"></div>
                                                <button onClick={() => deleteBlock(block.id)} className="p-1 hover:text-red-500 rounded hover:bg-red-50 transition-colors" title="מחק רכיב"><IconTrash className="w-4 h-4" /></button>
                                            </div>

                                            {/* Time Estimate Badge or Loading Indicator (Absolute) */}
                                            {generatingInfographicBlockId === block.id ? (
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
                                            {refiningBlockId === block.id && renderRefineToolbar(block)}

                                            {/* AI Refine Trigger (If Not Already Refining) */}
                                            {refiningBlockId !== block.id && (
                                                <div className="flex justify-end gap-2 -mt-4 mb-4">
                                                    <button
                                                        onClick={() => setRefiningBlockId(block.id)}
                                                        className="flex items-center gap-2 px-4 py-2 text-blue-500 hover:text-white hover:bg-blue-600 rounded-lg transition-all text-xs font-bold bg-blue-50 border border-blue-100"
                                                    >
                                                        <IconSparkles className="w-4 h-4" />
                                                        שפרו עם AI
                                                    </button>

                                                    {/* Revert button - shows when AI refinement was just applied to this block */}
                                                    {canRevertBlockId === block.id && contentBeforeRefineRef.current[block.id] && (
                                                        <button
                                                            onClick={() => handleRevertRefinement(block.id)}
                                                            className="flex items-center gap-2 px-4 py-2 text-orange-600 hover:text-white hover:bg-orange-500 rounded-lg transition-all text-xs font-bold bg-orange-50 border border-orange-200"
                                                            title="חזרה לגרסה הקודמת"
                                                        >
                                                            <IconArrowUp className="w-4 h-4 rotate-180" />
                                                            בטל שיפור
                                                        </button>
                                                    )}
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

                        {/* Instruction Anchor - fallback if no instruction block exists */}
                        {!unit.activityBlocks?.some((block, idx) => {
                            const totalBlocks = unit.activityBlocks?.length || 0;
                            const phase = getPedagogicalPhase(idx, totalBlocks, block?.type || '');
                            const prevBlock = idx > 0 ? unit.activityBlocks?.[idx - 1] : null;
                            const prevPhase = prevBlock ? getPedagogicalPhase(idx - 1, totalBlocks, prevBlock?.type || '') : null;
                            return phase === 'instruction' && prevPhase !== 'instruction' && prevPhase !== null;
                        }) && <div id="instruction" className="scroll-mt-32"></div>}

                        {/* Practice Anchor - fallback if no practice block exists */}
                        {!unit.activityBlocks?.some((block, idx) => {
                            const totalBlocks = unit.activityBlocks?.length || 0;
                            return getPedagogicalPhase(idx, totalBlocks, block?.type || '') === 'practice';
                        }) && <div id="practice" className="scroll-mt-32"></div>}

                        {/* Summary Anchor - fallback if no summary block exists */}
                        {!unit.activityBlocks?.some((block, idx) => {
                            const totalBlocks = unit.activityBlocks?.length || 0;
                            return getPedagogicalPhase(idx, totalBlocks, block?.type || '') === 'summary';
                        }) && <div id="summary" className="scroll-mt-32"></div>}
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
                                    loading="lazy"
                                    decoding="async"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-6 bg-slate-50 rounded-b-2xl flex gap-3 justify-end border-t">
                            <button
                                onClick={() => {
                                    // Track preview rejection
                                    trackPreviewRejected(infographicPreview.visualType);
                                    setInfographicPreview(null);
                                }}
                                className="px-6 py-3 bg-white text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-semibold border border-slate-300"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={() => {
                                    // Track type change intent
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

            {/* Variant Preview Modal */}
            {variantPreviewBlock && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setVariantPreviewBlock(null)}>
                    <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold mb-1">תצוגת 3 רמות התוכן</h2>
                                    <p className="text-white/80 text-sm">
                                        המערכת בוחרת אוטומטית את הרמה המתאימה לכל תלמיד לפי הביצועים שלו
                                    </p>
                                </div>
                                <button
                                    onClick={() => setVariantPreviewBlock(null)}
                                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                                >
                                    <IconX className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* 3-Column Grid */}
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                            {/* Scaffolding (Easy) */}
                            <div className="bg-emerald-50 rounded-xl border-2 border-emerald-200 overflow-hidden">
                                <div className="bg-emerald-500 text-white p-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">📚</span>
                                        <div>
                                            <h3 className="font-bold">גרסה קלה</h3>
                                            <p className="text-xs text-white/80">לתלמידים שמתקשים (mastery &lt; 0.4)</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4">
                                    {variantPreviewBlock.metadata?.scaffolding_variant ? (
                                        <div className="prose prose-sm max-w-none">
                                            {/* Pre-context hint if available */}
                                            {variantPreviewBlock.metadata?.scaffolding_variant?.metadata?.preContext && (
                                                <div className="bg-emerald-100 p-3 rounded-lg mb-3 text-sm">
                                                    <strong>💡 רמז:</strong> {variantPreviewBlock.metadata.scaffolding_variant.metadata.preContext}
                                                </div>
                                            )}
                                            {/* Question content */}
                                            <div className="text-slate-700">
                                                {typeof variantPreviewBlock.metadata.scaffolding_variant.content === 'string'
                                                    ? variantPreviewBlock.metadata.scaffolding_variant.content
                                                    : JSON.stringify(variantPreviewBlock.metadata.scaffolding_variant.content, null, 2)}
                                            </div>
                                            {/* Progressive hints */}
                                            {variantPreviewBlock.metadata?.scaffolding_variant?.metadata?.progressiveHints?.length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    <p className="text-xs font-bold text-emerald-700">רמזים מדורגים:</p>
                                                    {variantPreviewBlock.metadata.scaffolding_variant.metadata.progressiveHints.map((hint: string, i: number) => (
                                                        <div key={i} className="text-xs bg-white p-2 rounded border border-emerald-200">
                                                            {i + 1}. {hint}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-slate-400 text-sm text-center py-8">לא נוצרה גרסה קלה</p>
                                    )}
                                </div>
                            </div>

                            {/* Original (Middle) */}
                            <div className="bg-blue-50 rounded-xl border-2 border-blue-300 overflow-hidden ring-2 ring-blue-400">
                                <div className="bg-blue-500 text-white p-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">📄</span>
                                        <div>
                                            <h3 className="font-bold">גרסה מקורית</h3>
                                            <p className="text-xs text-white/80">ברירת מחדל (0.4 ≤ mastery ≤ 0.8)</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <div className="prose prose-sm max-w-none text-slate-700">
                                        {typeof variantPreviewBlock.content === 'string'
                                            ? variantPreviewBlock.content
                                            : JSON.stringify(variantPreviewBlock.content, null, 2)}
                                    </div>
                                </div>
                            </div>

                            {/* Enrichment (Hard) */}
                            <div className="bg-purple-50 rounded-xl border-2 border-purple-200 overflow-hidden">
                                <div className="bg-purple-500 text-white p-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">🚀</span>
                                        <div>
                                            <h3 className="font-bold">גרסה מאתגרת</h3>
                                            <p className="text-xs text-white/80">לתלמידים מצטיינים (mastery &gt; 0.8)</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4">
                                    {variantPreviewBlock.metadata?.enrichment_variant ? (
                                        <div className="prose prose-sm max-w-none">
                                            {/* Question content */}
                                            <div className="text-slate-700">
                                                {typeof variantPreviewBlock.metadata.enrichment_variant.content === 'string'
                                                    ? variantPreviewBlock.metadata.enrichment_variant.content
                                                    : JSON.stringify(variantPreviewBlock.metadata.enrichment_variant.content, null, 2)}
                                            </div>
                                            {/* Extension question */}
                                            {variantPreviewBlock.metadata?.enrichment_variant?.metadata?.extensionQuestion && (
                                                <div className="mt-3 bg-purple-100 p-3 rounded-lg text-sm">
                                                    <strong>🎯 שאלת הרחבה:</strong> {variantPreviewBlock.metadata.enrichment_variant.metadata.extensionQuestion}
                                                </div>
                                            )}
                                            {/* Connection note */}
                                            {variantPreviewBlock.metadata?.enrichment_variant?.metadata?.connectionNote && (
                                                <div className="mt-2 text-xs text-purple-600">
                                                    <em>קישור לנושאים מתקדמים: {variantPreviewBlock.metadata.enrichment_variant.metadata.connectionNote}</em>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-slate-400 text-sm text-center py-8">לא נוצרה גרסה מאתגרת</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer with info */}
                        <div className="bg-slate-100 p-4 text-center text-sm text-slate-600">
                            <span className="font-semibold">איך זה עובד?</span> המערכת עוקבת אחרי ביצועי התלמיד ובוחרת אוטומטית את הגרסה המתאימה.
                            תלמידים מתקשים מקבלים גרסה עם רמזים, תלמידים מצטיינים מקבלים אתגרים נוספים.
                        </div>
                    </div>
                </div>
            )}

            {/* Full Preview Mode Modal */}
            {isFullPreviewMode && (
                <div className="fixed inset-0 bg-white z-[100] animate-fade-in flex flex-col overflow-y-auto">
                    <React.Suspense fallback={
                        <div className="flex-1 flex items-center justify-center text-blue-600 font-bold">
                            <div className="text-center">
                                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                                טוען תצוגה מקדימה...
                            </div>
                        </div>
                    }>
                        <CoursePlayer
                            reviewMode={true}
                            hideReviewHeader={true}
                            simulateGuest={true}
                            unitOverride={unit}
                            onExitReview={() => setIsFullPreviewMode(false)}
                        />
                    </React.Suspense>
                </div>
            )}

            {/* Presentation Mode Modal - Smart Board Projection */}
            {isPresentationMode && (
                <React.Suspense fallback={
                    <div className="fixed inset-0 bg-gray-900 z-[200] flex items-center justify-center">
                        <div className="text-center text-white">
                            <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
                            טוען מצב הקרנה...
                        </div>
                    </div>
                }>
                    <PresentationMode
                        unit={unit}
                        onClose={() => setIsPresentationMode(false)}
                    />
                </React.Suspense>
            )}

            {/* Send Activities Modal */}
            {showSendActivitiesModal && course && (
                <React.Suspense fallback={
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-8 text-center">
                            <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-slate-600">טוען...</p>
                        </div>
                    </div>
                }>
                    <SendActivitiesModal
                        unit={unit}
                        course={course}
                        onClose={() => setShowSendActivitiesModal(false)}
                        onSuccess={(activityCourseId, shareUrl) => {
                            console.log('Activity created:', activityCourseId, shareUrl);
                        }}
                    />
                </React.Suspense>
            )}
        </div>
    );
};

export default TeacherCockpit;
