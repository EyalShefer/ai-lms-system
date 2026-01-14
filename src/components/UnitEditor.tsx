import React, { useState, useEffect, useRef } from 'react';
import type { LearningUnit, ActivityBlock } from '../shared/types/courseTypes';
import { v4 as uuidv4 } from 'uuid';
import { useCourseStore } from '../context/CourseContext';
import { AIStarsSpinner } from './ui/Loading/AIStarsSpinner';
import {
    refineContentWithPedagogy,
    generateSingleOpenQuestion, generateSingleMultipleChoiceQuestion,
    generateCategorizationQuestion, generateOrderingQuestion, generateFillInBlanksQuestion, generateMemoryGame,
    generateTrueFalseQuestion,
    generateAiImage, BOT_PERSONAS, generateUnitSkeleton, generateStepContent
} from '../gemini';
import { mapSystemItemToBlock } from '../shared/utils/geminiParsers';
import { AudioGenerator } from '../services/audioGenerator'; // AUDIO Feature
import { PodcastPlayer } from './PodcastPlayer'; // AUDIO Player
import { SourceViewer } from './SourceViewer';
import { AiRefineToolbar } from './AiRefineToolbar';
import { uploadMediaFile } from '../firebaseUtils';
import { MultimodalService } from '../services/multimodalService'; // Restore Import
import {
    enrichUnitBlocks, enrichActivityBlock
} from '../services/adaptiveContentService';
import {
    enrichActivityWithImages, isActivityEnriched, generateContextImageBlock
} from '../services/activityMediaService';
import { createBlock } from '../shared/config/blockDefinitions'; // DECOUPLER FIX
import { saveGenerationTiming } from '../services/generationTimingService'; // Speed Analytics

// ... (existing imports)

// ... (inside UnitEditor component, after other handlers)



// ... (render logic)

// Add button in the toolbar (e.g., near Save / Preview)
// Looking at the JSX (not fully visible but inferred placement near header actions)

import { ElevenLabsService } from '../services/elevenLabs'; // Added
import {
    IconEdit, IconTrash, IconPlus, IconImage, IconVideo, IconText,
    IconChat, IconList, IconSparkles, IconUpload, IconArrowUp,
    IconArrowDown, IconCheck, IconX, IconSave, IconBack,
    IconRobot, IconPalette, IconBalance, IconBrain, IconLink, IconWand, IconEye, IconClock, IconLayer, IconHeadphones, IconBook, IconLoader, IconMicrophone, IconInfographic
} from '../icons';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { createPortal } from 'react-dom';
import InspectorBadge from './InspectorBadge';
import InspectorDashboard from './InspectorDashboard';
import YouTubeSearchModal from './YouTubeSearchModal';
import type { YouTubeVideoResult } from '../services/youtubeService';
import MindMapEditor from './MindMapEditor';
import MindMapGeneratorModal from './MindMapGeneratorModal';
import type { MindMapContent } from '../shared/types/courseTypes';
import { RichTextEditor } from './RichTextEditor';

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
    'matching': 'התאמה',
    'audio-response': 'תשובה קולית',
    'mindmap': 'מפת חשיבה'
};

// --- הגדרות מקומיות ---
const IconShield = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

// Helper to safely extract text from option (string or object)
const getOptionText = (opt: any): string => {
    if (typeof opt === 'string') return opt;
    if (opt && typeof opt === 'object' && opt.text) return opt.text;
    return '';
};

const IconLock = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

interface UnitEditorProps {
    unit: LearningUnit;
    gradeLevel?: string;
    subject?: string;
    onSave: (updatedUnit: any) => void;
    onCancel: () => void;
    onPreview?: (unit: any) => void;
    cancelLabel?: string;
}

const getAiActions = (gradeLevel: string) => [
    { label: "שפר ניסוח", prompt: `שפר את הניסוח שיהיה זורם, מקצועי ומותאם לתלמידי ${gradeLevel}` },
    { label: "קצר טקסט", prompt: "קצר את הטקסט תוך שמירה על המסר העיקרי" },
    { label: "פשט שפה", prompt: `פשט את השפה והמושגים לרמה של תלמידי ${gradeLevel}, הסבר מילים קשות` },
    { label: "העמק תוכן", prompt: `הוסף עומק, דוגמאות והקשר רחב יותר` },
];

const UnitEditor: React.FC<UnitEditorProps> = ({ unit, gradeLevel = "כללי", subject, onSave, onCancel, onPreview }) => {
    const { course } = useCourseStore();
    const [editedUnit, setEditedUnit] = useState<LearningUnit>(unit);
    const editedUnitRef = useRef(unit); // Ref to track state for async operations

    // Sync Ref with State
    useEffect(() => {
        editedUnitRef.current = editedUnit;
    }, [editedUnit]);

    const [loadingBlockId, setLoadingBlockId] = useState<string | null>(null);
    const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
    const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null);
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);
    // const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false); // Podcast Loading State
    const [showSource, setShowSource] = useState(false); // New: Source Split View State

    // מצבי עריכה למדיה: כעת תומך בערכים מורכבים יותר (image_ai, video_link וכו')
    const [mediaInputMode, setMediaInputMode] = useState<Record<string, string | null>>({});
    const [mediaInputValue, setMediaInputValue] = useState<Record<string, string>>({});

    const hasInitialized = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [inspectorMode, setInspectorMode] = useState(false); // INSPECTOR STATE

    // --- Podcast Custom Source State ---
    const [podcastSourceMode, setPodcastSourceMode] = useState<Record<string, 'full' | 'custom'>>({});
    const [podcastCustomText, setPodcastCustomText] = useState<Record<string, string>>({});

    // --- YouTube Search Modal State ---
    const [youtubeSearchOpen, setYoutubeSearchOpen] = useState(false);
    const [youtubeSearchBlockId, setYoutubeSearchBlockId] = useState<string | null>(null);

    // --- Mind Map Modal State ---
    const [mindMapModalOpen, setMindMapModalOpen] = useState(false);
    const [mindMapBlockId, setMindMapBlockId] = useState<string | null>(null);

    // Handler for YouTube video selection
    const handleYouTubeVideoSelect = async (video: YouTubeVideoResult) => {
        const blockId = youtubeSearchBlockId;
        if (!blockId) return;

        setLoadingBlockId(blockId);

        try {
            // Try to get transcript
            let transcript = "";
            try {
                const result = await MultimodalService.processYoutubeUrl(video.watchUrl);
                if (result?.text) transcript = result.text;
            } catch (e) {
                console.warn("Could not get transcript for YouTube video:", e);
            }

            const block = editedUnit.activityBlocks.find((b: any) => b.id === blockId);
            if (block) {
                updateBlock(blockId, block.content, {
                    media: video.embedUrl,
                    mediaType: 'video',
                    transcript,
                    videoId: video.videoId,
                    videoTitle: video.title,
                    channelTitle: video.channelTitle,
                    duration: video.duration,
                    thumbnailUrl: video.thumbnailUrl,
                    hasCaptions: video.hasCaptions,
                    educationalScore: video.educationalScore,
                    source: 'youtube-search'
                });
            }
        } catch (e) {
            console.error("Error embedding YouTube video:", e);
        } finally {
            setLoadingBlockId(null);
            setMediaInputMode({ ...mediaInputMode, [blockId]: null });
        }
    };

    // Unsaved Changes Protection
    const handleBack = () => {
        if (isDirty) {
            if (window.confirm("יש לך שינויים שלא נשמרו. האם לצאת ללא שמירה?")) {
                onCancel();
            }
        } else {
            onCancel();
        }
    };

    // --- Assignment Modal State (Ported) ---
    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
    const [assignmentData, setAssignmentData] = useState({
        title: unit.title || '',
        dueDate: new Date().toISOString().split('T')[0],
        dueTime: '23:59',
        instructions: ''
    });

    const handleCopyLinkClick = () => {
        // Warn if there are unsaved changes
        if (isDirty) {
            const proceed = confirm(
                '⚠️ יש שינויים שלא נשמרו!\n\n' +
                'אם תיצרו קישור עכשיו, הקישור יפנה לגרסה ללא השינויים האחרונים.\n\n' +
                'מומלץ ללחוץ "שמירה" קודם, או לחצו "אישור" להמשיך בכל זאת.'
            );
            if (!proceed) return;
        }
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
            // If already filled or initialized, skip
            if ((unit.activityBlocks && unit.activityBlocks.length > 0) || hasInitialized.current) {
                setEditedUnit(unit);
                return;
            }

            hasInitialized.current = true;
            setIsAutoGenerating(true); // START LOADING STATE

            const settings = (course as any)?.wizardData?.settings || {};
            const productType = settings.productType || 'lesson'; // Get Product Type

            // ⏱️ Initialize timing tracker
            const timer = new (await import('../services/generationTimingService')).GenerationTimer(
                course.id,
                unit.id,
                productType as 'lesson' | 'activity' | 'exam' | 'podcast',
                course
            );

            try {
                // 1. SKELETON PHASE (Fast)
                console.log("🚀 Starting Incremental Generation: Skeleton Phase...");

                // Add a visual "Thinking..." block
                setEditedUnit((prev: any) => ({
                    ...prev,
                    activityBlocks: [
                        { id: 'skeleton-loader', type: 'text', content: 'נא להמתין מספר שניות, המערכת מייצרת עבורכם את התוכן...', metadata: { isSkeleton: true } }
                    ]
                }));

                const targetLength = settings.activityLength || 'medium';
                const safeIncludeBot = settings.includeBot === true;
                const sourceText = course?.fullBookContent || (course as any)?.wizardData?.pastedText || "";

                console.log("📚 Source Text Length:", sourceText?.length || 0);

                // --- SPECIAL HANDLING FOR PODCAST ---
                if (productType === 'podcast') {
                    console.log("🎙️ Generating Podcast Activity...");
                    const podcastBlock = {
                        id: uuidv4(),
                        type: 'podcast',
                        content: {
                            title: `פודקאסט: ${unit.title}`,
                            description: "האזינו לפרק הבא וענו על השאלות.",
                            // We will trigger script generation via AudioGenerator later or user action
                        },
                        metadata: {
                            autoGenerate: true // Flag to trigger auto-generation in effect if needed
                        }
                    };

                    setEditedUnit((prev: any) => ({
                        ...prev,
                        activityBlocks: [podcastBlock]
                    }));

                    // We can also trigger the actual script generation immediately if we have source text
                    if (sourceText) {
                        // Trigger script generation... (We'll rely on the user to click "Generate" or do it here)
                        // For now, let's just leave the block so the user sees "Podcast"
                    }

                    setIsAutoGenerating(false);
                    return;
                }

                // --- STANDARD SKELETON GENERATION ---
                const skeleton = await generateUnitSkeleton(
                    unit.title,
                    gradeLevel,
                    targetLength,
                    sourceText,
                    course.mode || settings.courseMode || 'learning', // Robust Fallback
                    settings.taxonomy // Pass Dynamic Bloom Preferences
                );

                if (!skeleton || !skeleton.steps) {
                    throw new Error("Failed to generate skeleton");
                }

                // ⏱️ Mark skeleton complete
                timer.mark('skeleton_complete');
                timer.setStepCount(skeleton.steps.length);
                console.log("✅ Skeleton Ready:", skeleton.steps.length, "steps");

                // 🖼️ START CONTEXT IMAGE GENERATION IN PARALLEL (for activities only)
                // This runs concurrently with content generation to reduce total time
                let contextImagePromise: Promise<ActivityBlock | null> | null = null;
                if (productType === 'activity') {
                    const topic = unit.title || course?.title || '';
                    const subject = settings.subject || 'כללי';
                    console.log("🖼️ [Parallel] Starting context image generation alongside content...");
                    contextImagePromise = generateContextImageBlock(topic, subject, gradeLevel);
                }

                // 2. PLACEHOLDER PHASE (Immediate Feedback)
                const placeholderBlocks = skeleton.steps.map((step: any) => ({
                    id: `step-${step.step_number}`, // Temporary ID
                    type: 'loading-placeholder', // Special type for loading state
                    content: {
                        stepNumber: step.step_number,
                        title: step.title,
                        message: 'כותב תוכן...'
                    },
                    metadata: {
                        isLoading: true,
                        stepInfo: step
                    }
                }));

                const introBlock = {
                    id: uuidv4(),
                    type: 'text',
                    content: `# מתחילים! 🚀\nהפעילות בנושא **${unit.title}** יוצאת לדרך.\nלפניכם תרגול קצר וממוקד. בהצלחה!`,
                    metadata: {}
                };

                let botBlock = null;
                if (safeIncludeBot) {
                    const personaId = settings.botPersona || 'socratic';
                    const personaData = BOT_PERSONAS[personaId as keyof typeof BOT_PERSONAS] || BOT_PERSONAS.socratic;

                    botBlock = {
                        id: uuidv4(),
                        type: 'interactive-chat',
                        content: { title: personaData.name, description: `עזרה בנושא ${unit.title}` },
                        metadata: {
                            botPersona: personaId,
                            initialMessage: personaData.initialMessage,
                            systemPrompt: personaData.systemPrompt
                        }
                    };
                }

                // Update UI with Placeholders
                const finalPlaceholders = [introBlock, ...(botBlock ? [botBlock] : []), ...placeholderBlocks];
                setEditedUnit((prev: any) => ({ ...prev, activityBlocks: finalPlaceholders }));

                // 3. PARALLEL CONTENT GENERATION (The Magic)
                console.log("⚡ Triggering Parallel Step Generation...");

                // Fire all requests at once (or batch if needed)
                const totalSteps = skeleton.steps.length;
                const promises = skeleton.steps.map(async (step: any) => {
                    const stepContent = await generateStepContent(unit.title, step, gradeLevel, sourceText, undefined, course.mode || 'learning', undefined, totalSteps); // Pass sourceText & totalSteps for scaffolding

                    console.log(`📦 AI Response for Step ${step.step_number}:`, Object.keys(stepContent || {}));
                    if (stepContent?.teach_content) console.log(`   📝 Found Teach Content for Step ${step.step_number}`);
                    else console.warn(`   ⚠️ NO Teach Content for Step ${step.step_number} (Mode: ${course.mode})`);

                    if (stepContent) {
                        const newBlocks: any[] = [];

                        // A. Teach Block
                        if (stepContent.teach_content) {
                            newBlocks.push({
                                id: uuidv4(),
                                type: 'text',
                                content: stepContent.teach_content,
                                metadata: { note: `Step ${step.step_number}` }
                            });
                        }

                        // B. Interaction Block (Unified Mapper)
                        const interactionBlock = mapSystemItemToBlock(stepContent) as unknown as ActivityBlock | null;
                        if (interactionBlock) {
                            newBlocks.push(interactionBlock);
                        }

                        // C. Update the SPECIFIC placeholder in state
                        setEditedUnit((currentUnit: any) => {
                            const currentBlocks = [...currentUnit.activityBlocks];
                            const placeholderIndex = currentBlocks.findIndex((b: any) => b.id === `step-${step.step_number}`);

                            if (placeholderIndex !== -1) {
                                // Replace placeholder with real blocks
                                currentBlocks.splice(placeholderIndex, 1, ...newBlocks);
                            }
                            return { ...currentUnit, activityBlocks: currentBlocks };
                        });

                        // 🚀 BACKGROUND ENRICHMENT (Zero-Click)
                        // This runs AFTER the block is rendered, so the user sees the content immediately.
                        // Then, a few seconds later, the metadata (Bloom, Difficulty) silently updates.
                        if (interactionBlock) {
                            enrichActivityBlock(interactionBlock, unit.title).then(enrichedBlock => {
                                console.log(`✨ Auto-Enriched block ${enrichedBlock.id}`);
                                setEditedUnit((prev: any) => ({
                                    ...prev,
                                    activityBlocks: prev.activityBlocks.map((b: any) =>
                                        b.id === enrichedBlock.id ? enrichedBlock : b
                                    )
                                }));
                            }).catch(err => console.warn("Auto-enrichment failed", err));
                        }
                    }
                });

                await Promise.all(promises);

                // ⏱️ Mark content generation complete
                timer.mark('content_complete');
                console.log("🏁 All steps generated. Auto-Saving to Firestore...");
                console.log("🔍 DEBUG: productType =", productType, "| Expected: 'activity'");

                // 🖼️ WAIT FOR CONTEXT IMAGE (started in parallel earlier)
                // This should be ready by now or very soon since it ran alongside content
                let contextImageBlock: ActivityBlock | null = null;
                if (contextImagePromise) {
                    timer.mark('image_start');
                    console.log("🖼️ [Parallel] Waiting for context image to complete...");
                    contextImageBlock = await contextImagePromise;
                    timer.mark('image_complete');

                    if (contextImageBlock) {
                        console.log("✅ [Parallel] Context image ready! Inserting at beginning...");
                        // Insert context image as first block
                        setEditedUnit((prev: any) => ({
                            ...prev,
                            activityBlocks: [contextImageBlock, ...prev.activityBlocks]
                        }));
                    } else {
                        console.warn("⚠️ [Parallel] Context image not available, continuing without it");
                    }
                }

                // Safe Save: Read from Ref instead of inside setState
                // Small timeout to allow last render to flush
                setTimeout(() => {
                    onSave(editedUnitRef.current);
                }, 100);

                // ⏱️ Finish timing and save to Firestore
                await timer.finish(true);

                // Mark generation as done
                setIsAutoGenerating(false);

                // 🖼️ FALLBACK: Only if parallel context image failed
                // We track success with a variable, not by checking state (which is async)
                if (productType === 'activity' && !contextImageBlock) {
                    // Parallel context image failed, try full enrichment as fallback
                    console.log("🖼️ [Fallback] Context image failed, trying full enrichment...");
                    const topic = unit.title || course?.title || '';
                    const subject = settings.subject || 'כללי';

                    // Need to get fresh unit from ref after state updates
                    setTimeout(() => {
                        const currentUnit = editedUnitRef.current;
                        if (currentUnit && !isActivityEnriched(currentUnit)) {
                            enrichActivityWithImages(
                                currentUnit,
                                topic,
                                subject,
                                gradeLevel,
                                (step, current, total) => {
                                    console.log(`🖼️ Media Generation: ${step} (${current}/${total})`);
                                }
                            ).then(enrichedUnit => {
                                console.log("✅ Activity enriched with images!");
                                setEditedUnit(enrichedUnit);
                                setTimeout(() => {
                                    onSave(enrichedUnit);
                                }, 100);
                            }).catch(err => {
                                console.warn("⚠️ Image enrichment failed (activity still works):", err);
                            });
                        }
                    }, 200);
                }

            } catch (error: any) {
                console.error("Incremental Auto Generation Failed", error);
                // ⏱️ Save timing with error
                await timer.finish(false, error?.message || 'Unknown error');
                setIsAutoGenerating(false);
            }
        };
        initContent();
    }, [unit.id]);

    // --- Podcast Auto-Trigger ---
    useEffect(() => {
        const pendingPodcast = editedUnit.activityBlocks?.find((b: any) => b.type === 'podcast' && b.metadata?.autoGenerate);
        if (pendingPodcast && !loadingBlockId) {
            console.log("🎙️ Auto-triggering podcast generation for block:", pendingPodcast.id);

            // 1. Visually lock immediately to prevent flicker
            setLoadingBlockId(pendingPodcast.id);

            // 2. Clear the flag to prevent infinite loops (without setting isDirty - this is internal operation)
            setEditedUnit((prev: any) => ({
                ...prev,
                activityBlocks: prev.activityBlocks.map((block: any) =>
                    block.id === pendingPodcast.id
                        ? { ...block, metadata: { ...block.metadata, autoGenerate: false } }
                        : block
                )
            }));

            // 3. Trigger generation
            handleGeneratePodcastBlock(pendingPodcast.id);
        }
    }, [editedUnit.activityBlocks, loadingBlockId]);

    const handleSaveWithFeedback = async () => {
        setIsSaving(true);
        try {
            await onSave(editedUnit);
            setTimeout(() => {
                setIsSaving(false);
                setSaveSuccess(true);
                setIsDirty(false); // Reset dirty flag
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

    const addBlockAtIndex = async (type: string, index: number) => {
        // Use course default persona if available, otherwise Socratic
        const initialPersonaId = course.botPersona || 'socratic';

        // DECOUPLER FIX: Use Factory
        const newBlock = createBlock(type, initialPersonaId);

        const newBlocks = [...(editedUnit.activityBlocks || [])];
        newBlocks.splice(index, 0, newBlock);
        setEditedUnit({ ...editedUnit, activityBlocks: newBlocks });
        setIsDirty(true);
        setActiveInsertIndex(null);

        // AUTO-GENERATE: For interactive block types, immediately generate content in unit context
        const autoGenerateTypes = ['fill_in_blanks', 'ordering', 'categorization', 'memory_game', 'multiple-choice', 'true_false_speed'];
        if (autoGenerateTypes.includes(type)) {
            // Trigger auto-generation after block is added
            setTimeout(() => {
                switch (type) {
                    case 'fill_in_blanks':
                        handleAutoGenerateFillInBlanks(newBlock.id);
                        break;
                    case 'ordering':
                        handleAutoGenerateOrdering(newBlock.id);
                        break;
                    case 'categorization':
                        handleAutoGenerateCategorization(newBlock.id);
                        break;
                    case 'memory_game':
                        handleAutoGenerateMemoryGame(newBlock.id);
                        break;
                    case 'multiple-choice':
                        handleAutoGenerateMCQuestion(newBlock.id);
                        break;
                    case 'true_false_speed':
                        handleAutoGenerateTrueFalseQuestion(newBlock.id);
                        break;
                }
            }, 100);
        }
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
        setIsDirty(true);
    };

    const handlePersonaChange = (blockId: string, newPersona: string, currentContent: any) => {
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

    const handleAutoGenerateOpenQuestion = async (blockId: string) => {
        setLoadingBlockId(blockId);
        try {
            // Context Aggregation: Global Source + Local Video Transcripts
            const videoTranscripts = editedUnit.activityBlocks
                .map((b: any) => b.metadata?.transcript).filter((t: any) => t).join("\n\n");

            const sourceText = (course.fullBookContent || "") + (videoTranscripts ? `\n\n--- Video Transcripts ---\n${videoTranscripts}` : "");

            // Fallback if no content at all
            if (!sourceText || sourceText.length < 10) {
                const userTopic = prompt("נראה שאין מספיק תוכן ליצירת שאלה. על מה תרצו שהשאלה תהיה?");
                if (!userTopic) return;
                // We'll proceed with the topic as source
                const result = await generateSingleOpenQuestion(editedUnit.title, gradeLevel, {}, userTopic);
                if (result) updateBlock(blockId, { question: result.content.question }, { modelAnswer: result.metadata.modelAnswer });
                return;
            }

            const result = await generateSingleOpenQuestion(editedUnit.title, gradeLevel, {}, sourceText);
            if (result) {
                updateBlock(blockId, { question: result.content.question }, { modelAnswer: result.metadata.modelAnswer });
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
            // Context Aggregation: Global Source + Local Video Transcripts
            const videoTranscripts = editedUnit.activityBlocks
                .map((b: any) => b.metadata?.transcript).filter((t: any) => t).join("\n\n");

            const sourceText = (course.fullBookContent || "") + (videoTranscripts ? `\n\n--- Video Transcripts ---\n${videoTranscripts}` : "");

            if (!sourceText || sourceText.length < 10) {
                const userTopic = prompt("נראה שאין מספיק תוכן ליצירת שאלה. על מה תרצו שהשאלה תהיה?");
                if (!userTopic) return;
                const result = await generateSingleMultipleChoiceQuestion(editedUnit.title, gradeLevel, {}, userTopic, subject);
                if (result) updateBlock(blockId, { question: result.content.question, options: result.content.options, correctAnswer: result.content.correctAnswer });
                return;
            }

            const result = await generateSingleMultipleChoiceQuestion(editedUnit.title, gradeLevel, {}, sourceText, subject);
            if (result) {
                updateBlock(blockId, { question: result.content.question, options: result.content.options, correctAnswer: result.content.correctAnswer });
            } else {
                alert("אירעה שגיאה ביצירת השאלה. אנא נסו שוב.");
            }
        } catch (e) {
            alert("שגיאה");
        } finally {
            setLoadingBlockId(null);
        }
    };

    // --- NEW GENERATORS ---
    const handleAutoGenerateCategorization = async (blockId: string) => {
        setLoadingBlockId(blockId);
        try {
            const sourceText = course.fullBookContent || "";
            const result = await generateCategorizationQuestion(editedUnit.title, gradeLevel, sourceText, subject);
            if (result) updateBlock(blockId, result);
        } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); }
    };
    const handleAutoGenerateOrdering = async (blockId: string) => {
        setLoadingBlockId(blockId);
        try {
            const sourceText = course.fullBookContent || "";
            const result = await generateOrderingQuestion(editedUnit.title, gradeLevel, sourceText, subject);
            if (result) updateBlock(blockId, result);
        } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); }
    };
    const handleAutoGenerateFillInBlanks = async (blockId: string) => {
        setLoadingBlockId(blockId);
        try {
            const sourceText = course.fullBookContent || "";
            const result = await generateFillInBlanksQuestion(editedUnit.title, gradeLevel, sourceText, subject);
            if (result) updateBlock(blockId, result);
        } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); }
    };
    const handleAutoGenerateMemoryGame = async (blockId: string) => {
        setLoadingBlockId(blockId);
        try {
            const sourceText = course.fullBookContent || "";
            const result = await generateMemoryGame(editedUnit.title, gradeLevel, sourceText, subject);
            if (result) updateBlock(blockId, result);
        } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); }
    };
    const handleAutoGenerateTrueFalseQuestion = async (blockId: string) => {
        setLoadingBlockId(blockId);
        try {
            const sourceText = course.fullBookContent || "";
            // Generate a true/false statement based on unit content
            const result = await generateTrueFalseQuestion(editedUnit.title, gradeLevel, sourceText, subject);
            if (result) updateBlock(blockId, result);
        } catch (e) { alert("שגיאה"); } finally { setLoadingBlockId(null); }
    };

    // --- שדרוג: יצירת פודקאסט עבור בלוק ספציפי ---
    const handleGeneratePodcastBlock = async (blockId: string) => {
        if (!ElevenLabsService.isConfigured()) {
            alert("נדרש מפתח API של ElevenLabs בקובץ .env לצורך יצירת פודקאסט.");
            return;
        }

        setLoadingBlockId(blockId);

        // IMMEDIATE FEEDBACK: Update the block to show it's working
        // currently we can't easily use setEditedUnit inside this if called from effect? 
        // We can, but need to be careful.
        // Let's use updateBlock which updates state safely.
        updateBlock(blockId, {
            title: "מייצר פודקאסט...",
            script: null,
            audioUrl: null,
            description: "⏳ המערכת מייצרת תסריט לפודקאסט... אנא המתן (פעולה זו עשויה לקחת כדקה)"
        });

        try {
            const block = editedUnit.activityBlocks.find((b: any) => b.id === blockId);
            const mode = podcastSourceMode[blockId] || 'full';
            let sourceText = "";

            if (mode === 'custom') {
                sourceText = podcastCustomText[blockId] || "";
                if (!sourceText || sourceText.length < 50) {
                    alert("אנא הזינו טקסט באורך של לפחות 50 תווים.");
                    return;
                }
            } else {
                sourceText = course.fullBookContent || "";

                // FALLBACK: If no course source, aggregate text from the unit's text blocks
                if (!sourceText || sourceText.length < 50) {
                    sourceText = editedUnit.activityBlocks
                        .filter((b: any) => b.type === 'text' && typeof b.content === 'string')
                        .map((b: any) => b.content)
                        .join('\n\n');
                }

                if (!sourceText || sourceText.length < 50) {
                    alert("אין מספיק תוכן ליצירת פודקאסט.\n\nהמערכת מחפשת תוכן מקור של הקורס, או בלוקים של טקסט ביחידה הנוכחית.\nאנא הוסף תוכן טקסט ליחידה או השתמש באפשרות 'טקסט מותאם'.");
                    return;
                }
            }

            // setIsGeneratingPodcast(true);
            setLoadingBlockId(blockId);
            console.log("🎙️ Starting Podcast Generation for Grade:", gradeLevel);

            try {
                const script = await AudioGenerator.generateScript({
                    sourceText: sourceText.substring(0, 15000), // Safety Cap
                    targetAudience: gradeLevel || "Student", // PEDAGOGY FIX: Pass the actual grade level
                    language: "he",
                    focusTopic: editedUnit.title
                });

                if (script) {
                    // 1. Update the Podcast Block with the script
                    const updatedPodcastBlock = {
                        ...editedUnit.activityBlocks.find(b => b.id === blockId),
                        content: {
                            title: "פודקאסט לסיכום היחידה",
                            description: "האזינו לשיחה המרתקת בין המנחים וענו על השאלות שאחרי.",
                            script: script,
                            audioUrl: null
                        },
                        metadata: { autoGenerate: false }
                    };

                    // 2. Generate Follow-up Questions (Assessment)
                    // We'll use the script itself as the source for the questions!
                    const scriptText = script.lines.map(l => `${l.speaker}: ${l.text}`).join('\n');

                    // A. Multiple Choice
                    const mcqBlock = await generateSingleMultipleChoiceQuestion(
                        editedUnit.title,
                        gradeLevel,
                        [],
                        scriptText
                    );

                    // B. Open Question
                    const openBlock = await generateSingleOpenQuestion(
                        editedUnit.title,
                        gradeLevel,
                        [],
                        scriptText
                    );

                    // 3. Update State with ALL new blocks
                    setEditedUnit(prev => {
                        const newBlocks = [...prev.activityBlocks];
                        const podcastIndex = newBlocks.findIndex(b => b.id === blockId);

                        if (podcastIndex !== -1) {
                            newBlocks[podcastIndex] = updatedPodcastBlock as ActivityBlock;

                            // Insert questions AFTER the podcast
                            if (mcqBlock) {
                                mcqBlock.id = uuidv4(); // Ensure unique
                                newBlocks.splice(podcastIndex + 1, 0, mcqBlock as ActivityBlock);
                            }
                            if (openBlock) {
                                openBlock.id = uuidv4(); // Ensure unique
                                newBlocks.splice(podcastIndex + 2, 0, openBlock as ActivityBlock);
                            }
                        }
                        return { ...prev, activityBlocks: newBlocks };
                    });

                } else {
                    alert("שגיאה ביצירת הפודקאסט. נסה שוב.");
                }
            } catch (error) {
                console.error(error);
                alert("שגיאה");
            } finally {
                setLoadingBlockId(null);
            }
        } catch (e: any) {
            console.error("Outer error in podcast generation:", e);
            alert("שגיאה כללית ביצירת הפודקאסט");
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

    const handleEnrichUnit = async () => {
        if (!confirm("פעולה זו תשדרג את כל השאלות ביחידה עם מטא-דאטה אדפטיבי (Tags, Difficulty, Bloom). להמשיך?")) return;

        setIsAutoGenerating(true);
        try {
            console.log("🚀 Starting Adaptive Batch Enrichment...");
            const currentBlocks = [...editedUnit.activityBlocks];
            const enrichedBlocks = await enrichUnitBlocks(currentBlocks, unit.title);

            setEditedUnit(prev => ({ ...prev, activityBlocks: enrichedBlocks }));
            alert("✅ היחידה שודרגה בהצלחה! השאלות כעת 'חכמות'.");
        } catch (e) {
            console.error("Enrichment error", e);
            alert("שגיאה בתהליך ההעשרה.");
        } finally {
            setIsAutoGenerating(false);
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
        updateBlock(blockId, block.content, { relatedQuestion: { ...(block.metadata?.relatedQuestion || {}), ...updatedData } });
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
                        {relatedQ.options?.map((opt: any, idx: number) => {
                            const optText = getOptionText(opt);
                            return (
                                <div key={idx} className="flex items-center gap-2">
                                    <button onClick={() => updateRelatedQuestion(blockId, { correctAnswer: optText })} className={`w-5 h-5 rounded-full border flex items-center justify-center ${relatedQ.correctAnswer === optText ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300'}`}>{relatedQ.correctAnswer === optText && <IconCheck className="w-3 h-3" />}</button>
                                    <input type="text" className="flex-1 p-1.5 text-sm border border-gray-200 rounded bg-white" value={optText} onChange={(e) => {
                                        const newOpts = [...relatedQ.options];
                                        if (typeof newOpts[idx] === 'object') newOpts[idx] = { ...newOpts[idx], text: e.target.value };
                                        else newOpts[idx] = e.target.value;
                                        updateRelatedQuestion(blockId, { options: newOpts });
                                    }} placeholder={`אפשרות ${idx + 1}`} />
                                </div>
                            );
                        })}
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

        // 3. תפריט משנה לוידאו (העלאה, קישור, או חיפוש YouTube)
        if (mode === 'video_select') {
            return (
                <div className="flex gap-2 bg-blue-50 p-1 rounded-lg animate-scale-in">
                    <button onClick={() => { setYoutubeSearchBlockId(blockId); setYoutubeSearchOpen(true); }} className={`${mediaBtnClass} bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border-red-200`}><IconVideo className="w-4 h-4" /> חפש YouTube</button>
                    <label className={mediaBtnClass}><IconUpload className="w-4 h-4" /> העלאה<input type="file" accept="video/*" className="hidden" onChange={(e) => { handleFileUpload(e, blockId, 'metadata'); setMediaInputMode({ ...mediaInputMode, [blockId]: null }); }} /></label>
                    <button onClick={() => setMediaInputMode({ ...mediaInputMode, [blockId]: 'video_link' })} className={mediaBtnClass}><IconLink className="w-4 h-4" /> קישור ידני</button>
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
                        <button onClick={() => handleGenerateAiImage(blockId, 'metadata')} disabled={loadingBlockId === blockId} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold whitespace-nowrap flex items-center gap-2">
                            {loadingBlockId === blockId ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> יוצר...</> : 'צור'}
                        </button>
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
                        <input type="text" dir="ltr" className="flex-1 p-2 border rounded text-sm text-left" placeholder="https://youtube.com/..." onChange={(e) => setMediaInputValue({ ...mediaInputValue, [blockId]: e.target.value })} />
                        <button onClick={async () => {
                            const url = mediaInputValue[blockId];
                            if (!url) return;

                            setLoadingBlockId(blockId); // Show loading
                            let transcript = "";

                            // Try to fetch transcript if it's a YouTube URL
                            console.log("Checking URL for transcription:", url);
                            const videoId = MultimodalService.validateYouTubeUrl(url);
                            console.log("Validation Result (Video ID):", videoId);

                            if (videoId) {
                                try {
                                    console.log("Calling processYoutubeUrl...");
                                    const result = await MultimodalService.processYoutubeUrl(url);
                                    console.log("Transcript Result Length:", result?.text?.length);

                                    if (result?.text) {
                                        transcript = result.text;
                                    } else {
                                        alert("השרת החזיר תמלול ריק. ייתכן ואין כתוביות בסרטון זה.");
                                    }
                                } catch (e) {
                                    console.error("Transcription Error Full:", e);
                                    alert("שגיאה במשיכת התמלול: " + (e as Error).message);
                                }
                            } else {
                                console.warn("URL failed validation for transcription but might still be embeddable.");
                            }

                            const block = editedUnit.activityBlocks.find((b: any) => b.id === blockId);
                            if (block) {
                                updateBlock(blockId, block.content, {
                                    media: getEmbedUrl(url),
                                    mediaType: 'video',
                                    transcript: transcript // Store the transcript!
                                });
                            }

                            setLoadingBlockId(null);
                            setMediaInputMode({ ...mediaInputMode, [blockId]: null });
                        }} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold whitespace-nowrap flex items-center gap-2">
                            {loadingBlockId === blockId ? <IconLoader className="w-3 h-3 animate-spin" /> : null}
                            הטמע
                        </button>
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
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('true_false_speed', index); }} className="insert-btn"><IconSparkles className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['true_false_speed']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('audio-response', index); }} className="insert-btn"><IconMicrophone className="w-4 h-4" /><span>{BLOCK_TYPE_MAPPING['audio-response']}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('podcast', index); }} className="insert-btn"><IconHeadphones className="w-4 h-4" /><span>פודקאסט AI</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('infographic', index); }} className="insert-btn"><IconInfographic className="w-4 h-4" /><span>אינפוגרפיקה</span></button>
                        <button onClick={(e) => { e.stopPropagation(); addBlockAtIndex('mindmap', index); }} className="insert-btn bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 hover:border-purple-300"><IconBrain className="w-4 h-4 text-purple-600" /><span className="text-purple-700">{BLOCK_TYPE_MAPPING['mindmap']}</span></button>

                        <button onClick={(e) => { e.stopPropagation(); setActiveInsertIndex(null); }} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors ml-2"><IconX className="w-5 h-5" /></button>
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
            <div className="mb-4 relative rounded-xl overflow-hidden border border-gray-200">
                {metadata.mediaType === 'video' ? <video src={metadata.media} controls className="w-full h-48 bg-black" /> : <img src={metadata.media} alt="מדיה" className="w-full h-48 object-cover bg-gray-50" loading="lazy" decoding="async" />}
                <button onClick={() => { const block = editedUnit.activityBlocks.find((b: any) => b.id === blockId); if (block) updateBlock(blockId, block.content, { media: null, mediaType: null }); }} className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors shadow-md border border-red-200" title="הסר מדיה"><IconTrash className="w-4 h-4" /></button>
            </div>
        );
    };

    // --- Dynamic Loading Text ---
    const productType = (course as any)?.wizardData?.settings?.productType || 'lesson';
    const productTypeHebrew = {
        'lesson': 'מערך השיעור',
        'activity': 'הפעילות לתלמיד',
        'exam': 'המבחן',
        'podcast': 'הפודקאסט'
    }[productType as string] || 'הפעילות';

    const productTypeStatusLabel = {
        'lesson': 'מצב למידה',
        'activity': 'מצב תרגול',
        'exam': 'מצב מבחן',
        'podcast': 'מצב האזנה'
    }[productType as string] || 'מצב פעילות';

    // --- Dynamic Source Text ---
    const sourceMode = (course as any)?.wizardData?.mode || 'topic';
    const sourceTextHebrew = {
        'upload': 'מהקובץ שהעלתם',
        'text': 'מהטקסט שהדבקתם',
        'multimodal': 'מהסרטון שתמללתם',
        'topic': 'על הנושא שבחרתם'
    }[sourceMode as string] || '';

    if (isAutoGenerating) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
                <div className="relative mb-6"><AIStarsSpinner size="xl" color="gradient" /></div>
                <h2 className="text-2xl font-bold text-gray-800">{productTypeHebrew} {sourceTextHebrew} בבניה...</h2>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8 font-sans pb-24 bg-gray-50/50">
            {/* Header */}
            <div className="sticky top-4 z-40 card-glass p-4 flex justify-between items-center mb-10 gap-4">
                <div className="flex-1 min-w-0">
                    <input type="text" value={editedUnit.title} onChange={(e) => { setEditedUnit({ ...editedUnit, title: e.target.value }); setIsDirty(true); }} className="text-2xl font-bold text-gray-800 bg-transparent border-b border-transparent focus:border-blue-500 outline-none px-2 transition-colors placeholder-gray-400 w-full" placeholder={`כותרת ${productTypeHebrew}`} />
                    <div className="text-sm text-gray-500 px-2 mt-1 flex items-center gap-2">
                        <span>שכבת גיל: {gradeLevel}</span>
                        {subject && (
                            <>
                                <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                <span>תחום דעת: {subject}</span>
                            </>
                        )}
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        <span className={`font-bold ${showScoring ? 'text-blue-800' : 'text-green-700'}`}>{showScoring ? 'מצב מבחן' : productTypeStatusLabel}</span>
                    </div>
                </div>

                <div className="flex gap-3 flex-shrink-0">
                    {/* Source Toggle */}
                    {(course.fullBookContent || course.pdfSource) && (
                        <button
                            onClick={() => setShowSource(!showSource)}
                            className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2 border 
                            ${showSource ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                            <IconBook className="w-4 h-4" /> {showSource ? 'סגור מקור' : 'הצג מקור'}
                        </button>
                    )}

                    {showScoring && (<button onClick={handleAutoDistributePoints} className="px-4 py-2 bg-yellow-100/80 hover:bg-yellow-200 text-yellow-800 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2 border border-yellow-200"><IconBalance className="w-4 h-4" />חלק ניקוד</button>)}

                    <button
                        onClick={handleEnrichUnit}
                        disabled={isAutoGenerating}
                        className="px-4 py-2 bg-gradient-to-r from-violet-100 to-purple-100 text-purple-700 hover:from-violet-200 hover:to-purple-200 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2 border border-purple-200 disabled:opacity-50"
                    >
                        <IconSparkles className="w-4 h-4 text-purple-600" /> העשרה אדפטיבית (AI)
                    </button>

                    <button
                        onClick={() => setInspectorMode(!inspectorMode)}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2 border ${inspectorMode ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-600 border-purple-200 hover:bg-purple-50'}`}
                    >
                        {inspectorMode ? <IconCheck className="w-4 h-4" /> : <IconBrain className="w-4 h-4" />} Wizdi-Monitor
                    </button>

                    <button onClick={handleBack} className="px-5 py-2 rounded-xl text-gray-600 hover:bg-white/50 font-medium transition-colors flex items-center gap-2">
                        <IconBack className="w-4 h-4 rotate-180" /> חזרה
                    </button>

                    {onPreview && (
                        <button onClick={() => onPreview(editedUnit)} className="px-5 py-2 rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 font-bold transition-colors flex items-center gap-2 border border-blue-200">
                            <IconEye className="w-4 h-4" /> תצוגת תלמיד
                        </button>
                    )}

                    <button
                        onClick={handleCopyLinkClick}
                        className={`px-5 py-2 text-sm flex items-center gap-2 rounded-xl font-bold transition-all ${isDirty
                            ? 'bg-amber-50 text-amber-600 border-2 border-amber-300 hover:bg-amber-100'
                            : 'btn-lip-primary'
                            }`}
                        title={isDirty ? 'יש שינויים לא שמורים - מומלץ לשמור קודם' : 'צור קישור לתלמידים'}
                    >
                        <IconLink className={`w-4 h-4 ${isDirty ? 'animate-pulse' : ''}`} />
                        {isDirty ? 'שמור לפני שיתוף!' : 'העתקת קישור לתלמיד'}
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

            <div className="flex-1 flex overflow-hidden relative">
                <div className={`flex-1 overflow-y-auto custom-scrollbar p-8 pb-32 transition-all ${showSource ? 'w-1/2' : 'w-full max-w-4xl mx-auto'}`}>
                    <div className="space-y-6">
                        {inspectorMode && (
                            <div className="mb-6 animate-fade-in">
                                <InspectorDashboard
                                    blocks={editedUnit.activityBlocks || []}
                                    mode={showScoring ? 'exam' : 'learning'}
                                    unitId={editedUnit.id || 'new-unit'}
                                    unitTitle={editedUnit.title}
                                />
                            </div>
                        )}

                        {/* PODCAST PLAYER AREA - Removed (Moved to Blocks) */}

                        <InsertMenu index={0} />

                        {editedUnit.activityBlocks?.map((block: any, index: number) => (
                            <React.Fragment key={block.id}>
                                <div className="card-glass p-6 relative group transition-all hover:scale-[1.01]">
                                    {/* Controls */}
                                    <div className="absolute top-4 left-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur border border-gray-100 rounded-lg p-1 z-10 shadow-sm">
                                        <button onClick={() => moveBlock(index, 'up')} disabled={index === 0} className="p-1 hover:text-blue-600 disabled:opacity-30 rounded hover:bg-blue-50 transition-colors"><IconArrowUp className="w-4 h-4" /></button>
                                        <button onClick={() => moveBlock(index, 'down')} disabled={index === editedUnit.activityBlocks.length - 1} className="p-1 hover:text-blue-600 disabled:opacity-30 rounded hover:bg-blue-50 transition-colors"><IconArrowDown className="w-4 h-4" /></button>
                                        <div className="w-px bg-gray-200 my-1 mx-1"></div>
                                        <button onClick={() => deleteBlock(block.id)} className="p-1 hover:text-red-500 rounded hover:bg-red-50 transition-colors"><IconTrash className="w-4 h-4" /></button>
                                    </div>
                                    <span className="absolute top-2 right-12 text-[10px] font-bold bg-gray-100/80 text-gray-500 px-2 py-1 rounded-full uppercase tracking-wide border border-white/50">{BLOCK_TYPE_MAPPING[block.type] || block.type}</span>

                                    {inspectorMode && (
                                        <div className="absolute top-2 left-32 z-20">
                                            <InspectorBadge block={block} mode={showScoring ? 'exam' : 'learning'} />
                                        </div>
                                    )}

                                    <div className="mt-2">
                                        {/* TEXT BLOCK */}
                                        {block.type === 'text' && (
                                            <div>
                                                {block.metadata?.isLoading || block.metadata?.isSkeleton ? (
                                                    <div className="w-full p-6 border border-blue-100 bg-blue-50/40 rounded-xl flex flex-col items-center justify-center text-center gap-3 animate-pulse min-h-[120px]">
                                                        <IconSparkles className="w-6 h-6 text-blue-400" />
                                                        <div className="text-blue-600 font-bold text-lg">{block.content}</div>
                                                        <div className="text-blue-300 text-xs">ה-AI עובד על זה...</div>
                                                    </div>
                                                ) : (
                                                    <RichTextEditor
                                                        value={block.content || ''}
                                                        onChange={(html) => updateBlock(block.id, html)}
                                                        placeholder={`כתבו כאן את תוכן ${productTypeHebrew}...`}
                                                        minHeight="200px"
                                                    />
                                                )}
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
                                                <div className="mt-2 flex justify-end">
                                                    <AiRefineToolbar
                                                        blockId={block.id}
                                                        blockType="text"
                                                        content={block.content}
                                                        onUpdate={(newContent) => updateBlock(block.id, newContent)}
                                                    />
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
                                                        <img src={block.content} className="w-full h-64 object-cover rounded-xl shadow-md bg-gray-100" alt="Block Media" loading="lazy" decoding="async" />
                                                        <button
                                                            onClick={() => updateBlock(block.id, '', { caption: null, mediaType: null, aiPrompt: null, uploadedFileUrl: null, fileName: null })}
                                                            className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors shadow-md border border-red-200"
                                                            title="הסר תמונה"
                                                        >
                                                            <IconTrash className="w-4 h-4" />
                                                        </button>
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
                                                                <input type="text" dir="ltr" className="w-full p-2 border rounded-lg mb-2 text-sm text-left" placeholder="https://www.youtube.com/watch?v=..." onChange={(e) => setMediaInputValue({ ...mediaInputValue, [block.id]: e.target.value })} />
                                                                <div className="flex gap-2 justify-end">
                                                                    <button onClick={() => setMediaInputMode({ ...mediaInputMode, [block.id]: null })} className="text-gray-500 text-xs hover:bg-gray-100 px-3 py-1 rounded">ביטול</button>
                                                                    <div className="flex flex-col gap-2 w-full">
                                                                        <button onClick={async () => {
                                                                            const url = mediaInputValue[block.id];
                                                                            if (!url) return;

                                                                            setLoadingBlockId(block.id);
                                                                            let transcript = "";

                                                                            const log = (msg: string) => {
                                                                                console.log(msg);
                                                                                const debugEl = document.getElementById(`debug-${block.id}`);
                                                                                if (debugEl) debugEl.innerHTML += `<div class="border-b border-gray-800 pb-1 mb-1">${new Date().toLocaleTimeString()} - ${msg}</div>`;
                                                                            };

                                                                            // Reset log
                                                                            const debugEl = document.getElementById(`debug-${block.id}`);
                                                                            if (debugEl) debugEl.innerHTML = "<div>Starting process...</div>";

                                                                            log(`URL: ${url}`);

                                                                            if (MultimodalService.validateYouTubeUrl(url)) {
                                                                                try {
                                                                                    log("Valid YouTube URL. Fetching transcript...");
                                                                                    const result = await MultimodalService.processYoutubeUrl(url);

                                                                                    if (result?.text) {
                                                                                        log(`Transcript found! Length: ${result.text.length} chars`);
                                                                                        transcript = result.text;
                                                                                    } else {
                                                                                        log("Transcript is empty/null from server.");
                                                                                        alert("השרת החזיר תמלול ריק.");
                                                                                    }
                                                                                } catch (e: any) {
                                                                                    log(`Error fetching: ${e.message}`);
                                                                                    console.warn("Failed to fetch transcript", e);
                                                                                    alert("שגיאה במשיכת התמלול: " + (e as Error).message);
                                                                                }
                                                                            } else {
                                                                                log("Invalid YouTube URL format.");
                                                                            }

                                                                            updateBlock(block.id, getEmbedUrl(url), {
                                                                                mediaType: 'video',
                                                                                transcript: transcript
                                                                            });

                                                                            log("Block updated. Finished.");
                                                                            setLoadingBlockId(null);
                                                                            setMediaInputMode({ ...mediaInputMode, [block.id]: null });
                                                                            setMediaInputValue({ ...mediaInputValue, [block.id]: '' });

                                                                        }} className="bg-red-600 text-white text-xs font-bold px-4 py-2 rounded shadow hover:bg-red-700 transition-colors">
                                                                            אישור והטמעה
                                                                        </button>

                                                                        <div id={`debug-${block.id}`} className="text-[10px] font-mono bg-black text-green-400 p-2 rounded h-32 overflow-y-auto w-full text-left ltr border border-gray-700 shadow-inner">
                                                                            Ready for logs...
                                                                        </div>
                                                                    </div>
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
                                                        <button
                                                            onClick={() => updateBlock(block.id, '', { caption: null, mediaType: null, transcript: null, videoId: null, videoTitle: null, channelTitle: null, duration: null, thumbnailUrl: null, hasCaptions: null, educationalScore: null, source: null })}
                                                            className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors shadow-md border border-red-200"
                                                            title="הסר וידאו"
                                                        >
                                                            <IconTrash className="w-4 h-4" />
                                                        </button>
                                                        <div className="mt-3">
                                                            <input type="text" className="w-full bg-transparent border-b border-gray-200 focus:border-blue-400 outline-none p-1 text-sm text-center text-gray-600 placeholder-gray-400" placeholder="הוסיפו כיתוב לוידאו..." value={block.metadata?.caption || ''} onChange={(e) => updateBlock(block.id, block.content, { caption: e.target.value })} />
                                                        </div>
                                                    </div>
                                                )}

                                                {block.metadata?.transcript && (
                                                    <div className="mt-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md inline-block font-bold">
                                                        ✅ תמלול וידאו זוהה ({block.metadata.transcript.length} תווים)
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

                                        {/* PODCAST BLOCK */}
                                        {block.type === 'podcast' && (
                                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-100 relative overflow-hidden">
                                                {/* Decorative Background */}
                                                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>

                                                <div className="relative z-10">
                                                    <div className="flex items-center gap-3 mb-6">
                                                        <div className="bg-white p-3 rounded-xl shadow-sm">
                                                            <IconHeadphones className="w-6 h-6 text-indigo-600" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-lg font-bold text-indigo-900">פודקאסט AI</h3>
                                                            <p className="text-xs text-indigo-600 opacity-80">יצירת סיכום שמע אוטומטי</p>
                                                        </div>
                                                    </div>

                                                    {block.content.script ? (
                                                        <div className="animate-fade-in w-full max-w-2xl mx-auto">
                                                            <PodcastPlayer
                                                                script={block.content.script}
                                                                title={block.content.title}
                                                            // Future: Handle onAudioGenerated to persist blobs?
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-8">
                                                            {/* Source Selection Toggle */}
                                                            <div className="inline-flex bg-white p-1 rounded-xl shadow-sm border border-indigo-100 mb-6">
                                                                <button
                                                                    onClick={() => setPodcastSourceMode((prev: any) => ({ ...prev, [block.id]: 'full' }))}
                                                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${(!podcastSourceMode[block.id] || podcastSourceMode[block.id] === 'full') ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                                                                    disabled={loadingBlockId === block.id}
                                                                >
                                                                    <IconBook className="w-4 h-4" /> כל היחידה
                                                                </button>
                                                                <button
                                                                    onClick={() => setPodcastSourceMode((prev: any) => ({ ...prev, [block.id]: 'custom' }))}
                                                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${podcastSourceMode[block.id] === 'custom' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                                                                    disabled={loadingBlockId === block.id}
                                                                >
                                                                    <IconEdit className="w-4 h-4" /> טקסט מותאם
                                                                </button>
                                                            </div>

                                                            {/* Custom Text Input */}
                                                            {podcastSourceMode[block.id] === 'custom' && (
                                                                <div className="mb-6 animate-scale-in">
                                                                    <RichTextEditor
                                                                        value={podcastCustomText[block.id] || ''}
                                                                        onChange={(html) => setPodcastCustomText((prev: any) => ({ ...prev, [block.id]: html }))}
                                                                        placeholder="הדביקו כאן את הטקסט עליו יבוסס הפודקאסט..."
                                                                        minHeight="120px"
                                                                        disabled={loadingBlockId === block.id}
                                                                        className="border-indigo-200"
                                                                    />
                                                                    <p className="text-right text-xs text-gray-400 mt-1">מינימום 50 תווים</p>
                                                                </div>
                                                            )}

                                                            {/* LOADING STATE vs ACTION STATE */}
                                                            {loadingBlockId === block.id ? (
                                                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 flex flex-col items-center animate-pulse">
                                                                    <IconLoader className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                                                                    <h4 className="text-indigo-800 font-bold mb-1">אנחנו על זה!</h4>
                                                                    <p className="text-indigo-600 text-sm">
                                                                        {block.content.description || "המערכת מייצרת תסריט לפודקאסט... אנא המתן."}
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleGeneratePodcastBlock(block.id)}
                                                                        className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all flex items-center gap-2 mx-auto"
                                                                    >
                                                                        <IconSparkles className="w-5 h-5" />
                                                                        צור פודקאסט עכשיו
                                                                    </button>
                                                                    <p className="text-xs text-indigo-400 mt-3 max-w-xs mx-auto">
                                                                        המערכת תנתח את {(!podcastSourceMode[block.id] || podcastSourceMode[block.id] === 'full') ? 'כל תוכן היחידה' : 'הטקסט שהזנתם'} ותפיק תסריט שיחה מרתק בין שני מנחים.
                                                                    </p>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* MINDMAP BLOCK */}
                                        {block.type === 'mindmap' && (
                                            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-2xl border border-purple-100 relative overflow-hidden">
                                                {/* Decorative Background */}
                                                <div className="absolute top-0 left-0 w-64 h-64 bg-purple-200/20 rounded-full -translate-y-1/2 -translate-x-1/2 blur-3xl"></div>

                                                <div className="relative z-10">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-white p-3 rounded-xl shadow-sm">
                                                                <IconBrain className="w-6 h-6 text-purple-600" />
                                                            </div>
                                                            <div>
                                                                <h3 className="text-lg font-bold text-purple-900">{block.content.title || 'מפת חשיבה'}</h3>
                                                                <p className="text-xs text-purple-600 opacity-80">המחשה ויזואלית של מושגים</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setMindMapBlockId(block.id);
                                                                setMindMapModalOpen(true);
                                                            }}
                                                            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-md"
                                                        >
                                                            <IconSparkles className="w-4 h-4" />
                                                            {block.content.nodes && block.content.nodes.length > 1 ? 'ייצר מחדש' : 'צור מפה'}
                                                        </button>
                                                    </div>

                                                    {block.content.nodes && block.content.nodes.length > 1 ? (
                                                        <MindMapEditor
                                                            content={block.content}
                                                            onChange={(newContent: MindMapContent) => updateBlock(block.id, newContent)}
                                                            onSave={() => setIsDirty(true)}
                                                        />
                                                    ) : (
                                                        <div className="text-center py-12 bg-white/50 rounded-xl border border-purple-100">
                                                            <div className="text-7xl mb-4">🗺️</div>
                                                            <h4 className="text-purple-800 font-bold text-lg mb-2">טרם נוצרה מפת חשיבה</h4>
                                                            <p className="text-purple-600 text-sm mb-6 max-w-md mx-auto">
                                                                לחצו על "צור מפה" כדי ליצור מפת חשיבה אוטומטית מתוכן היחידה
                                                            </p>
                                                            <button
                                                                onClick={() => {
                                                                    setMindMapBlockId(block.id);
                                                                    setMindMapModalOpen(true);
                                                                }}
                                                                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full font-bold shadow-lg hover:from-purple-700 hover:to-indigo-700 hover:scale-105 transition-all flex items-center gap-2 mx-auto"
                                                            >
                                                                <IconSparkles className="w-5 h-5" />
                                                                צור מפת חשיבה
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* AUDIO RESPONSE BLOCK */}
                                        {block.type === 'audio-response' && (
                                            <div className="bg-rose-50/50 p-5 rounded-xl border border-rose-100">
                                                <div className="flex items-center gap-2 mb-4 text-rose-700 font-bold">
                                                    <IconMicrophone className="w-5 h-5" /> תשובה קולית
                                                </div>
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="text-xs font-bold text-rose-400 uppercase mb-1 block">שאלה / הנחיה למשתמש</label>
                                                        <input type="text" className="w-full p-3 border border-rose-200 rounded-lg bg-white text-base focus:border-rose-400 outline-none" value={(block.content && block.content.question) || ''} onChange={(e) => updateBlock(block.id, { ...block.content, question: e.target.value })} placeholder="למשל: הסבירו במילים שלכם..." />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-rose-400 uppercase mb-1 block">תיאור נוסף (אופציונלי)</label>
                                                        <input type="text" className="w-full p-3 border border-rose-200 rounded-lg bg-white text-sm focus:border-rose-400 outline-none" value={(block.content && block.content.description) || ''} onChange={(e) => updateBlock(block.id, { ...block.content, description: e.target.value })} placeholder="הנחיות נוספות..." />
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1">
                                                            <label className="text-xs font-bold text-rose-400 uppercase mb-1 block">משך זמן מקסימלי (שניות)</label>
                                                            <input type="number" min="10" max="300" className="w-full p-3 border border-rose-200 rounded-lg bg-white text-sm focus:border-rose-400 outline-none" value={(block.content && block.content.maxDuration) || 60} onChange={(e) => updateBlock(block.id, { ...block.content, maxDuration: parseInt(e.target.value) })} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="bg-white p-3 rounded-lg border border-rose-100 text-xs text-gray-500">
                                                                * התלמיד יוכל להקליט תשובה, לשמוע אותה ולשלוח לבדיקה.
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
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
                                                            <span className="font-bold text-sm block">{productTypeStatusLabel}</span>
                                                            <span className="text-xs text-indigo-600">{`הבוט מוגדר כמנחה מלווה עבור ${productTypeHebrew}.`}</span>
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
                                                        <select className="w-full p-2.5 border border-indigo-200 rounded-lg bg-white/70 focus:bg-white transition-colors cursor-pointer text-sm" value={block.metadata?.botPersona || 'socratic'} onChange={(e) => handlePersonaChange(block.id, e.target.value, block.content)} disabled={showScoring}>
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
                                                        <textarea
                                                            className="flex-1 font-bold text-base p-1 bg-transparent border-b border-transparent focus:border-gray-300 outline-none text-gray-800 placeholder-gray-400 resize-none overflow-hidden min-h-[28px]"
                                                            value={(block.content && block.content.question) || ''}
                                                            onChange={(e) => {
                                                                updateBlock(block.id, { ...block.content, question: e.target.value });
                                                                // Auto-resize textarea
                                                                e.target.style.height = 'auto';
                                                                e.target.style.height = e.target.scrollHeight + 'px';
                                                            }}
                                                            onInput={(e) => {
                                                                // Auto-resize on load/paste
                                                                const target = e.target as HTMLTextAreaElement;
                                                                target.style.height = 'auto';
                                                                target.style.height = target.scrollHeight + 'px';
                                                            }}
                                                            ref={(el) => {
                                                                // Initial resize when content loads
                                                                if (el) {
                                                                    el.style.height = 'auto';
                                                                    el.style.height = el.scrollHeight + 'px';
                                                                }
                                                            }}
                                                            placeholder={block.type === 'multiple-choice' ? "כתבו שאלה אמריקאית..." : "כתבו שאלה פתוחה או צרו באמצעות AI"}
                                                            rows={1}
                                                        />
                                                    </div>
                                                    {showScoring && (<div className="flex flex-col items-center ml-2 bg-white/50 p-1 rounded-lg border border-gray-100"><span className="text-[10px] font-bold text-gray-400 uppercase">ניקוד</span><input type="number" className="w-14 text-center p-1 rounded border-2 border-transparent focus:border-blue-400 bg-white/80 font-bold text-blue-600 focus:bg-white transition-all outline-none" value={block.metadata?.score || 0} onChange={(e) => updateBlock(block.id, block.content, { score: Number(e.target.value) })} /></div>)}
                                                </div>
                                                {renderEmbeddedMedia(block.id, block.metadata)}

                                                {block.type === 'multiple-choice' && (
                                                    <div className="space-y-2 pr-7">
                                                        {!(block.content && block.content.question) && (<div className="flex justify-end mb-4"><button onClick={() => handleAutoGenerateMCQuestion(block.id)} disabled={loadingBlockId === block.id} className="bg-sky-100 text-sky-700 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-sky-200 transition-colors"><IconSparkles className="w-3 h-3" /> צרו שאלה</button></div>)}
                                                        {(block.content?.options || []).map((opt: any, idx: number) => {
                                                            const optText = getOptionText(opt);
                                                            return (
                                                                <div key={idx} className="flex items-center gap-3 group/option">
                                                                    <button onClick={() => updateBlock(block.id, { ...block.content, correctAnswer: optText })} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${block.content?.correctAnswer === optText ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300'}`}>{block.content?.correctAnswer === optText && <IconCheck className="w-3.5 h-3.5" />}</button>
                                                                    <input type="text" className={`flex-1 p-3 text-base border rounded-lg bg-white/80 focus:bg-white outline-none ${block.content?.correctAnswer === optText ? 'border-green-200' : 'border-gray-200'}`}
                                                                        value={optText}
                                                                        onChange={(e) => {
                                                                            const newOptions = [...(block.content?.options || [])];
                                                                            if (typeof newOptions[idx] === 'object') newOptions[idx] = { ...newOptions[idx], text: e.target.value };
                                                                            else newOptions[idx] = e.target.value;
                                                                            updateBlock(block.id, { ...block.content, options: newOptions });
                                                                        }}
                                                                        placeholder={`אפשרות ${idx + 1}`}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {block.type === 'open-question' && (
                                                    <div className="pr-7 mt-2">
                                                        {!(block.content && block.content.question) && (<div className="flex justify-end mb-2"><button onClick={() => handleAutoGenerateOpenQuestion(block.id)} disabled={loadingBlockId === block.id} className="bg-teal-100 text-teal-700 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-teal-200 transition-colors"><IconSparkles className="w-3 h-3" /> צרו שאלה באמצעות AI</button></div>)}
                                                        <label className="text-xs font-bold text-gray-400 mb-1 block flex items-center gap-1"><IconBrain className="w-3 h-3" /> הנחיות למורה / תשובה מצופה:</label>
                                                        <RichTextEditor
                                                            value={block.metadata?.modelAnswer || ''}
                                                            onChange={(html) => updateBlock(block.id, block.content, { modelAnswer: html })}
                                                            placeholder="כתבו כאן את התשובה המצופה..."
                                                            minHeight="100px"
                                                        />
                                                    </div>
                                                )}
                                                <div className="mt-3 pt-3 border-t border-gray-200/50 flex justify-between items-center">
                                                    <span className="text-xs text-gray-400 font-bold">הוסיפו מדיה לשאלה:</span>
                                                    {/* השימוש החדש ברכיב המאוחד */}
                                                    {renderMediaToolbar(block.id)}
                                                </div>
                                                <div className="mt-2 flex justify-end">
                                                    <AiRefineToolbar
                                                        blockId={block.id}
                                                        blockType={block.type}
                                                        content={block.content}
                                                        onUpdate={(newContent) => updateBlock(block.id, newContent)}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* FILL IN BLANKS */}
                                        {block.type === 'fill_in_blanks' && (
                                            <div className="bg-purple-50/50 p-5 rounded-xl border border-purple-100">
                                                <div className="flex items-center gap-2 mb-2 text-purple-700 font-bold justify-between">
                                                    <div className="flex items-center gap-2"><IconEdit className="w-5 h-5" /> השלמת משפטים (Cloze)</div>
                                                    {!block.content && (
                                                        <button onClick={() => handleAutoGenerateFillInBlanks(block.id)} disabled={loadingBlockId === block.id} className="bg-purple-200 hover:bg-purple-300 text-purple-800 px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm"><IconSparkles className="w-3 h-3" /> {loadingBlockId === block.id ? 'יוצר...' : 'צור ב-AI'}</button>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 mb-2">כתבו את הטקסט המלא, והקיפו מילים להסתרה ב-[סוגריים מרובעים]. למשל: "בירת ישראל היא [ירושלים]".</p>
                                                <RichTextEditor
                                                    value={typeof block.content === 'object' ? (block.content.sentence || block.content.text || '') : (block.content || '')}
                                                    onChange={(html) => updateBlock(block.id, html)}
                                                    placeholder="כתבו את הטקסט המלא עם [מילים להסתרה]..."
                                                    minHeight="160px"
                                                />
                                                <div className="mt-2 flex justify-end">
                                                    <AiRefineToolbar
                                                        blockId={block.id}
                                                        blockType="fill_in_blanks"
                                                        content={block.content}
                                                        onUpdate={(newContent) => updateBlock(block.id, newContent)}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* ORDERING */}
                                        {block.type === 'ordering' && (
                                            <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                                                <div className="flex items-center gap-2 mb-4 text-blue-700 font-bold justify-between">
                                                    <div className="flex items-center gap-2"><IconList className="w-5 h-5" /> סידור רצף</div>
                                                    {!(block.content?.instruction || block.content?.correct_order?.length > 0) && (
                                                        <button onClick={() => handleAutoGenerateOrdering(block.id)} disabled={loadingBlockId === block.id} className="bg-blue-200 hover:bg-blue-300 text-blue-800 px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm"><IconSparkles className="w-3 h-3" /> {loadingBlockId === block.id ? 'יוצר...' : 'צור ב-AI'}</button>
                                                    )}
                                                </div>
                                                <input type="text" className="w-full p-3 mb-4 border border-blue-200 rounded-lg bg-white text-base" placeholder="שאלה / הנחיה (למשל: סדר את האירועים...)" value={(block.content && block.content.instruction) || ''} onChange={(e) => updateBlock(block.id, { ...block.content, instruction: e.target.value })} />
                                                <div className="space-y-2">
                                                    {(block.content?.correct_order || []).map((item: string, idx: number) => (
                                                        <div key={idx} className="flex gap-2">
                                                            <span className="font-bold text-blue-300 w-6">{idx + 1}.</span>
                                                            <input type="text" className="flex-1 p-3 border rounded bg-white" value={item || ''} onChange={(e) => { const newItems = [...(block.content?.correct_order || [])]; newItems[idx] = e.target.value; updateBlock(block.id, { ...block.content, correct_order: newItems }); }} />
                                                            <button onClick={() => { const newItems = (block.content?.correct_order || []).filter((_: any, i: number) => i !== idx); updateBlock(block.id, { ...block.content, correct_order: newItems }); }} className="text-red-400 hover:text-red-600"><IconTrash className="w-4 h-4" /></button>
                                                        </div>
                                                    ))}
                                                    <button onClick={() => updateBlock(block.id, { ...block.content, correct_order: [...(block.content?.correct_order || []), "פריט חדש"] })} className="text-xs font-bold text-blue-600 bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded-full mt-2">+ הוסף פריט</button>
                                                </div>
                                                <div className="mt-4 border-t border-blue-100 pt-2 flex justify-end">
                                                    <AiRefineToolbar
                                                        blockId={block.id}
                                                        blockType="ordering"
                                                        content={block.content}
                                                        onUpdate={(newContent) => updateBlock(block.id, newContent)}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* CATEGORIZATION - TEAL THEME (NO ORANGE) */}
                                        {block.type === 'categorization' && (
                                            <div className="bg-teal-50/50 p-5 rounded-xl border border-teal-100">
                                                <div className="flex items-center gap-2 mb-4 text-teal-700 font-bold justify-between">
                                                    <div className="flex items-center gap-2"><IconLayer className="w-5 h-5" /> מיון לקטגוריות</div>
                                                    {!(block.content?.question || block.content?.categories?.length > 0 || block.content?.items?.length > 0) && (
                                                        <button onClick={() => handleAutoGenerateCategorization(block.id)} disabled={loadingBlockId === block.id} className="bg-teal-200 hover:bg-teal-300 text-teal-800 px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm"><IconSparkles className="w-3 h-3" /> {loadingBlockId === block.id ? 'יוצר...' : 'צור ב-AI'}</button>
                                                    )}
                                                </div>

                                                <input type="text" className="w-full p-3 mb-4 border border-teal-200 rounded-lg bg-white text-base" placeholder="הנחיה..." value={(block.content && block.content.question) || ''} onChange={(e) => updateBlock(block.id, { ...block.content, question: e.target.value })} />

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <h4 className="text-xs font-bold text-teal-400 uppercase mb-2">קטגוריות</h4>
                                                        <div className="space-y-2">
                                                            {(Array.isArray(block.content?.categories) ? block.content.categories : []).map((cat: string, idx: number) => (
                                                                <div key={idx} className="flex gap-2">
                                                                    <input type="text" className="flex-1 p-3 border rounded bg-white border-teal-200" value={cat || ''} onChange={(e) => { const newCats = [...(block.content?.categories || [])]; newCats[idx] = e.target.value; updateBlock(block.id, { ...block.content, categories: newCats }); }} placeholder={`קטגוריה ${idx + 1}`} />
                                                                    <button onClick={() => { const newCats = (block.content?.categories || []).filter((_: any, i: number) => i !== idx); updateBlock(block.id, { ...block.content, categories: newCats }); }} className="text-red-400"><IconTrash className="w-4 h-4" /></button>
                                                                </div>
                                                            ))}
                                                            <button onClick={() => updateBlock(block.id, { ...block.content, categories: [...(block.content?.categories || []), "קטגוריה חדשה"] })} className="text-xs font-bold text-teal-600 bg-teal-100 hover:bg-teal-200 px-3 py-1 rounded-full">+ קטגוריה</button>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <h4 className="text-xs font-bold text-teal-400 uppercase mb-2">פריטים למיון</h4>
                                                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
                                                            {(block.content?.items || []).map((item: any, idx: number) => (
                                                                <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border border-teal-100">
                                                                    <input type="text" className="flex-1 p-2 text-base border-b border-gray-200 focus:border-teal-400 outline-none" value={item?.text || ''} onChange={(e) => { const newItems = [...(block.content?.items || [])]; newItems[idx].text = e.target.value; updateBlock(block.id, { ...block.content, items: newItems }); }} placeholder="טקסט הפריט" />
                                                                    <select className="text-xs p-1 bg-gray-50 rounded border-none outline-none" value={item?.category || ''} onChange={(e) => { const newItems = [...(block.content?.items || [])]; newItems[idx].category = e.target.value; updateBlock(block.id, { ...block.content, items: newItems }); }}>
                                                                        <option value="" disabled>בחר קטגוריה</option>
                                                                        {(block.content?.categories || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
                                                                    </select>
                                                                    <button onClick={() => { const newItems = (block.content?.items || []).filter((_: any, i: number) => i !== idx); updateBlock(block.id, { ...block.content, items: newItems }); }} className="text-red-400 hover:text-red-600"><IconTrash className="w-3 h-3" /></button>
                                                                </div>
                                                            ))}
                                                            <button onClick={() => updateBlock(block.id, { ...block.content, items: [...(block.content?.items || []), { text: "פריט חדש", category: block.content?.categories?.[0] || "" }] })} className="text-xs font-bold text-teal-600 bg-teal-100 hover:bg-teal-200 px-3 py-1 rounded-full">+ פריט למיון</button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-4 border-t border-teal-100 pt-2 flex justify-end">
                                                    <AiRefineToolbar
                                                        blockId={block.id}
                                                        blockType="categorization"
                                                        content={block.content}
                                                        onUpdate={(newContent) => updateBlock(block.id, newContent)}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* MEMORY GAME */}
                                        {block.type === 'memory_game' && (
                                            <div className="bg-pink-50/50 p-5 rounded-xl border border-pink-100">
                                                <div className="flex items-center gap-2 mb-4 text-pink-700 font-bold justify-between">
                                                    <div className="flex items-center gap-2"><IconBrain className="w-5 h-5" /> משחק זיכרון</div>
                                                    {!(block.content?.pairs?.length > 0) && (
                                                        <button onClick={() => handleAutoGenerateMemoryGame(block.id)} disabled={loadingBlockId === block.id} className="bg-pink-200 hover:bg-pink-300 text-pink-800 px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm"><IconSparkles className="w-3 h-3" /> {loadingBlockId === block.id ? 'יוצר...' : 'צור ב-AI'}</button>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 mb-4">צרו זוגות תואמים. התלמיד יצטרך למצוא את ההתאמות.</p>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {(block.content?.pairs || []).map((pair: any, idx: number) => (
                                                        <div key={idx} className="bg-white p-3 rounded-xl border border-pink-100 shadow-sm relative group/pair">
                                                            <div className="mb-2">
                                                                <label className="text-[10px] font-bold text-gray-400 block mb-1">צד א' (גלוי תחילה / שאלה)</label>
                                                                <input type="text" className="w-full p-3 border rounded bg-gray-50 focus:bg-white transition-colors text-base" value={pair?.card_a || ''} onChange={(e) => { const newPairs = [...(block.content?.pairs || [])]; newPairs[idx].card_a = e.target.value; updateBlock(block.id, { ...block.content, pairs: newPairs }); }} />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-400 block mb-1">צד ב' (התאמה)</label>
                                                                <input type="text" className="w-full p-3 border rounded bg-gray-50 focus:bg-white transition-colors text-base" value={pair?.card_b || ''} onChange={(e) => { const newPairs = [...(block.content?.pairs || [])]; newPairs[idx].card_b = e.target.value; updateBlock(block.id, { ...block.content, pairs: newPairs }); }} />
                                                            </div>
                                                            <button onClick={() => { const newPairs = (block.content?.pairs || []).filter((_: any, i: number) => i !== idx); updateBlock(block.id, { ...block.content, pairs: newPairs }); }} className="absolute -top-2 -left-2 bg-white text-red-500 p-1 rounded-full shadow border border-gray-100 opacity-0 group-hover/pair:opacity-100 transition-opacity"><IconX className="w-3 h-3" /></button>
                                                        </div>
                                                    ))}
                                                    <button onClick={() => updateBlock(block.id, { ...block.content, pairs: [...(block.content?.pairs || []), { card_a: "", card_b: "" }] })} className="min-h-[140px] border-2 border-dashed border-pink-200 rounded-xl flex flex-col items-center justify-center text-pink-400 hover:bg-pink-50 hover:border-pink-300 transition-all">
                                                        <IconPlus className="w-6 h-6 mb-1" />
                                                        <span className="text-xs font-bold">הוסף זוג</span>
                                                    </button>
                                                </div>
                                                <div className="mt-4 border-t border-pink-100 pt-2 flex justify-end">
                                                    <AiRefineToolbar
                                                        blockId={block.id}
                                                        blockType="memory_game"
                                                        content={block.content}
                                                        onUpdate={(newContent) => updateBlock(block.id, newContent)}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* TRUE/FALSE SPEED */}
                                        {block.type === 'true_false_speed' && (
                                            <div className="bg-red-50/50 p-5 rounded-xl border border-red-100">
                                                <div className="flex items-center gap-2 mb-4 text-red-700 font-bold"><IconClock className="w-5 h-5" /> אמת או שקר (ספיד)</div>
                                                <p className="text-xs text-gray-500 mb-4">משחק מהירות: התלמיד צריך להחליט במהירות אם המשפט נכון או לא.</p>

                                                <div className="space-y-2">
                                                    {(block.content?.statements || []).map((item: any, idx: number) => (
                                                        <div key={idx} className="flex items-center gap-4 bg-white p-2 rounded-lg border border-red-100">
                                                            <span className="font-bold text-red-100 text-lg w-6 text-center">{idx + 1}</span>
                                                            <input type="text" className="flex-1 p-3 text-base border-b border-transparent focus:border-red-200 outline-none" value={item?.text || ''} onChange={(e) => { const newStmts = [...(block.content?.statements || [])]; newStmts[idx].text = e.target.value; updateBlock(block.id, { ...block.content, statements: newStmts }); }} placeholder="כתבו עובדה..." />

                                                            <button onClick={() => { const newStmts = [...(block.content?.statements || [])]; newStmts[idx].is_true = !newStmts[idx].is_true; updateBlock(block.id, { ...block.content, statements: newStmts }); }} className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${item?.is_true ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                                                {item?.is_true ? 'אמת' : 'שקר'}
                                                            </button>

                                                            <button onClick={() => { const newStmts = (block.content?.statements || []).filter((_: any, i: number) => i !== idx); updateBlock(block.id, { ...block.content, statements: newStmts }); }} className="text-gray-300 hover:text-red-500"><IconTrash className="w-4 h-4" /></button>
                                                        </div>
                                                    ))}
                                                    <button onClick={() => updateBlock(block.id, { ...block.content, statements: [...(block.content?.statements || []), { text: "", is_true: true }] })} className="w-full py-2 border-2 border-dashed border-red-200 rounded-lg text-red-400 font-bold text-sm hover:bg-red-50">+ הוסף שאלה</button>
                                                </div>
                                                <div className="mt-4 border-t border-red-100 pt-2 flex justify-end">
                                                    <AiRefineToolbar
                                                        blockId={block.id}
                                                        blockType="true_false_speed"
                                                        content={block.content}
                                                        onUpdate={(newContent) => updateBlock(block.id, newContent)}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* LOADING PLACEHOLDER - Shows during content generation */}
                                        {block.type === 'loading-placeholder' && (
                                            <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border-2 border-dashed border-blue-200 animate-pulse">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                                        {(block.content as any)?.stepNumber || '?'}
                                                    </div>
                                                    <span className="text-blue-700 font-medium">{(block.content as any)?.title || 'טוען...'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-blue-500">
                                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    <span>{(block.content as any)?.message || 'מייצר תוכן...'}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* ACTIVITY INTRO - Opening context image */}
                                        {block.type === 'activity-intro' && (
                                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                                                <div className="flex items-center gap-2 mb-3 text-indigo-700 font-bold">
                                                    <IconSparkles className="w-5 h-5" /> תמונת פתיחה
                                                </div>
                                                {(block.content as any)?.imageUrl ? (
                                                    <div className="relative">
                                                        <img
                                                            src={(block.content as any).imageUrl}
                                                            alt={(block.content as any)?.title || 'תמונת פתיחה'}
                                                            className="w-full h-64 object-cover rounded-xl shadow-md"
                                                            loading="lazy"
                                                        />
                                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 rounded-b-xl">
                                                            <h3 className="text-white font-bold text-lg">{(block.content as any)?.title}</h3>
                                                            {(block.content as any)?.description && (
                                                                <p className="text-white/80 text-sm">{(block.content as any).description}</p>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => deleteBlock(block.id)}
                                                            className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-red-500 hover:bg-red-50 transition-colors shadow-md"
                                                            title="הסר תמונה"
                                                        >
                                                            <IconTrash className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="h-48 bg-indigo-100/50 rounded-xl flex items-center justify-center text-indigo-400">
                                                        <div className="text-center">
                                                            <IconSparkles className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                                                            <span>מייצר תמונת פתיחה...</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* SCENARIO IMAGE - Dilemma/situation image before question */}
                                        {block.type === 'scenario-image' && (
                                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-100">
                                                <div className="flex items-center gap-2 mb-2 text-amber-700 font-bold text-sm">
                                                    <IconImage className="w-4 h-4" /> תמונת דילמה
                                                </div>
                                                {(block.content as any)?.imageUrl ? (
                                                    <div className="relative">
                                                        <img
                                                            src={(block.content as any).imageUrl}
                                                            alt={(block.content as any)?.caption || 'תמונת דילמה'}
                                                            className="w-full h-48 object-cover rounded-lg shadow-sm"
                                                            loading="lazy"
                                                        />
                                                        {(block.content as any)?.caption && (
                                                            <p className="mt-2 text-center text-amber-800 font-medium text-sm">{(block.content as any).caption}</p>
                                                        )}
                                                        <button
                                                            onClick={() => deleteBlock(block.id)}
                                                            className="absolute top-2 right-2 bg-white/90 p-1 rounded-full text-red-500 hover:bg-red-50 transition-colors shadow-sm"
                                                            title="הסר תמונה"
                                                        >
                                                            <IconTrash className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="h-32 bg-amber-100/50 rounded-lg flex items-center justify-center text-amber-400">
                                                        <span className="animate-pulse">מייצר תמונה...</span>
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
                </div>

                {/* Source Viewer Column */}
                {
                    showSource && (
                        <div className="w-1/2 border-r border-gray-200 bg-white shadow-xl z-20 animate-slide-in-left relative overflow-hidden flex flex-col h-full bg-slate-50">
                            <SourceViewer
                                content={course.fullBookContent || "אין תוכן זמין."}
                                pdfSource={course.pdfSource || undefined}
                                onClose={() => setShowSource(false)}
                            />
                        </div>
                    )
                }
            </div >
            {/* Sticky Score Footer */}
            {
                showScoring && (
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
                )
            }

            <style>{`
                .insert-btn { @apply px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-xs font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center gap-1.5 shadow-sm; }
                .animate-scale-in { animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; transform-origin: bottom center; }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            `}</style>

            {/* Assignment Creation Modal (Portal) */}
            {
                assignmentModalOpen && createPortal(
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
                )
            }

            {/* YouTube Search Modal */}
            <YouTubeSearchModal
                isOpen={youtubeSearchOpen}
                onClose={() => { setYoutubeSearchOpen(false); setYoutubeSearchBlockId(null); }}
                onSelectVideo={handleYouTubeVideoSelect}
                gradeLevel={gradeLevel}
                subject={subject}
                initialQuery={editedUnit.title || ''}
            />

            {/* Mind Map Generator Modal */}
            <MindMapGeneratorModal
                isOpen={mindMapModalOpen}
                onClose={() => {
                    setMindMapModalOpen(false);
                    setMindMapBlockId(null);
                }}
                onGenerate={(content: MindMapContent) => {
                    if (mindMapBlockId) {
                        updateBlock(mindMapBlockId, content);
                        setIsDirty(true);
                    }
                }}
                sourceText={course?.fullBookContent || editedUnit.baseContent || ''}
                topic={editedUnit.title}
                gradeLevel={gradeLevel}
            />
        </div >
    );
};

export default UnitEditor;