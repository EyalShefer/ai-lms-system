import React, { useState, useEffect, useRef } from 'react';
import { IconSparkles, IconWand, IconX, IconCheck, IconArrowDown } from '../icons';
import { refineBlockContent, refineActivityIntroImage } from '../services/ai/geminiApi';

interface AiRefineToolbarProps {
    blockId: string;
    blockType: string;
    content: any;
    onUpdate: (newContent: any) => void;
    className?: string;
}

/**
 * Generate a smart default prompt suggestion based on block type and content
 * Returns a ready-to-use prompt that requires minimal editing from the teacher
 */
const generateDefaultPrompt = (blockType: string, content: any): string => {
    // Extract options count for multiple choice
    const getOptionsCount = (): number => {
        if (!content || typeof content === 'string') return 0;
        return (content.options || []).length;
    };

    // Extract items count for ordering/categorization
    const getItemsCount = (): number => {
        if (!content || typeof content === 'string') return 0;
        return (content.items || content.pairs || []).length;
    };

    // Generate ready-to-use suggestions based on block type
    switch (blockType) {
        case 'multiple_choice':
        case 'multipleChoice':
        case 'multiple-choice': {
            const count = getOptionsCount();
            if (count < 4) {
                return `הוסף עוד ${4 - count} מסיחים שגויים אבל הגיוניים`;
            }
            return `הפוך את המסיחים למתוחכמים יותר - שיהיו קרובים לתשובה הנכונה`;
        }

        case 'open_question':
        case 'openQuestion':
        case 'open-question':
            return `הפוך את השאלה למאתגרת יותר והוסף הנחיות ברורות לתשובה`;

        case 'matching': {
            const count = getItemsCount();
            if (count < 5) {
                return `הוסף עוד 2 זוגות להתאמה`;
            }
            return `שפר את הניסוח כדי שההתאמה תהיה מאתגרת יותר`;
        }

        case 'sorting':
        case 'ordering': {
            const count = getItemsCount();
            if (count < 5) {
                return `הוסף עוד שלבים לרצף`;
            }
            return `הוסף הסברים קצרים לכל שלב`;
        }

        case 'fill_blanks':
        case 'fillBlanks':
        case 'fill_in_blanks':
            return `הוסף רמזים בסוגריים ליד כל מילה חסרה`;

        case 'info':
        case 'text':
        case 'content':
            return `פשט את השפה והוסף דוגמה מחיי היומיום`;

        case 'video':
            return `הוסף 3 שאלות מנחות לצפייה בסרטון`;

        case 'image':
            return `הוסף תיאור לתמונה ושאלת התבוננות אחת`;

        case 'activity-intro':
            return `צור תמונה בסגנון אחר - יותר צבעונית ומזמינה`;

        case 'discussion':
            return `הוסף 3 שאלות מנחות לדיון`;

        case 'interactive_chat':
        case 'interactiveChat':
        case 'interactive-chat':
            return `הוסף תרחיש נוסף לשיחה`;

        case 'summary':
            return `הוסף 3 נקודות מפתח לסיכום`;

        case 'categorization': {
            const count = getItemsCount();
            if (count < 6) {
                return `הוסף עוד פריטים לכל קטגוריה`;
            }
            return `הוסף קטגוריה נוספת עם פריטים מתאימים`;
        }

        case 'memory_game': {
            const count = getItemsCount();
            if (count < 6) {
                return `הוסף עוד 3 זוגות למשחק`;
            }
            return `שפר את הניסוח של הזוגות כדי שיהיו מאתגרים יותר`;
        }

        case 'podcast':
            return `הוסף נקודות מפתח לדיון בסוף הפודקאסט`;

        case 'infographic':
            return `הוסף עוד נתון אחד לאינפוגרפיקה`;

        default:
            return `שפרו את התוכן: פשטו שפה, הוסיפו דוגמאות, או שנו את הניסוח`;
    }
};

export const AiRefineToolbar: React.FC<AiRefineToolbarProps> = ({ blockId, blockType, content, onUpdate, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [instruction, setInstruction] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Store user's custom prompt to preserve it across open/close
    const userEditedPromptRef = useRef<string | null>(null);

    // Store content before AI refinement to allow reverting if result is not good
    const contentBeforeRefineRef = useRef<any>(null);
    const [canRevert, setCanRevert] = useState(false);

    // When opening the panel, set default prompt if user hasn't edited one
    useEffect(() => {
        if (isOpen && instruction === "") {
            // If user previously edited a prompt, restore it; otherwise generate default
            if (userEditedPromptRef.current !== null) {
                setInstruction(userEditedPromptRef.current);
            } else {
                setInstruction(generateDefaultPrompt(blockType, content));
            }
        }
    }, [isOpen, blockType, content]);

    // Track user edits to preserve them
    const handleInstructionChange = (value: string) => {
        setInstruction(value);
        userEditedPromptRef.current = value;
    };

    const handleRefine = async () => {
        if (!instruction.trim()) return;

        // Save the current content BEFORE refinement so user can revert if result is not good
        contentBeforeRefineRef.current = JSON.parse(JSON.stringify(content));
        console.log(`💾 Saved content before refinement for block ${blockId}`);

        setIsLoading(true);
        setError(null);

        try {
            console.log(`🚀 Refining block ${blockId} (${blockType})...`);

            let refinedContent;

            // Special handling for activity-intro - generates new image
            if (blockType === 'activity-intro') {
                refinedContent = await refineActivityIntroImage(content, instruction);
                if (!refinedContent) {
                    throw new Error('Failed to generate new image');
                }
            } else {
                refinedContent = await refineBlockContent(blockType, content, instruction);
            }

            // Check if content actually changed (deep compare or just naive check)
            if (JSON.stringify(refinedContent) === JSON.stringify(content)) {
                // Even if identical, we treat it as success but maybe warn?
                // Actually, LLM might return same content if instruction was "keep as is".
            }

            onUpdate(refinedContent);
            setSuccess(true);
            setCanRevert(true); // Enable revert option after successful refinement
            setTimeout(() => {
                setSuccess(false);
                setIsOpen(false);
                // Don't reset instruction - preserve user's prompt for next time
            }, 1000);

        } catch (err) {
            console.error("Refine failed", err);
            setError("שגיאה בשיפור התוכן. נסה שוב.");
            // Clear saved content on error since we didn't change anything
            contentBeforeRefineRef.current = null;
        } finally {
            setIsLoading(false);
        }
    };

    // Revert to content before AI refinement
    const handleRevert = () => {
        if (contentBeforeRefineRef.current) {
            console.log(`↩️ Reverting block ${blockId} to pre-refinement content`);
            onUpdate(contentBeforeRefineRef.current);
            contentBeforeRefineRef.current = null;
            setCanRevert(false);
        }
    };

    if (!isOpen) {
        return (
            <div className={`flex items-center gap-2 justify-end ${className || ''}`}>
                <button
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all shadow-sm
                    bg-gradient-to-r from-violet-100 to-fuchsia-100 text-purple-700 border-purple-200 hover:from-violet-200 hover:to-fuchsia-200"
                    title="שפר או שנה את התוכן באמצעות הוראות חופשיות"
                >
                    <IconSparkles className="w-3 h-3 text-purple-600" />
                    שפרו עם AI
                </button>

                {/* Revert button - shows when AI refinement was just applied */}
                {canRevert && contentBeforeRefineRef.current && (
                    <button
                        onClick={handleRevert}
                        className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all shadow-sm
                        bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
                        title="חזרה לגרסה הקודמת"
                    >
                        <IconArrowDown className="w-3 h-3 rotate-180" />
                        בטל שיפור
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={`mt-2 p-3 bg-gradient-to-br from-violet-50 to-white rounded-xl border border-purple-100 shadow-lg animate-scale-in relative ${className || ''}`}>
            {/* Header */}
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5 text-purple-700 font-bold text-xs">
                    <IconWand className="w-3 h-3" />
                    <span>מה לשפר בתוכן?</span>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-full transition-colors"
                >
                    <IconX className="w-3 h-3" />
                </button>
            </div>

            {/* Input Area - Larger textarea to show full paragraph */}
            <div className="relative">
                <textarea
                    value={instruction}
                    onChange={(e) => handleInstructionChange(e.target.value)}
                    placeholder="למשל: 'הוסיפו עוד 2 מסיחים', 'הפכו את השאלה לקשה יותר', 'תנו דוגמאות מעולם החי'..."
                    className="w-full min-w-[350px] text-sm p-3 pr-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 min-h-[120px] resize-y bg-white/80"
                    disabled={isLoading}
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleRefine();
                        }
                    }}
                />
            </div>

            {/* Actions / Status */}
            <div className="flex justify-between items-center mt-2">
                <div className="text-xs">
                    {error && <span className="text-red-500 font-medium">{error}</span>}
                    {success && <span className="text-green-600 font-bold flex items-center gap-1"><IconCheck className="w-3 h-3" /> בוצע בהצלחה!</span>}
                </div>

                <button
                    onClick={handleRefine}
                    disabled={!instruction.trim() || isLoading}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm flex items-center gap-2 transition-all
                    ${success ? 'bg-green-500' : 'bg-purple-600 hover:bg-purple-700'} 
                    ${(!instruction.trim() || isLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
                >
                    {isLoading ? (
                        <>
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            חושב...
                        </>
                    ) : (
                        <>
                            <IconSparkles className="w-3 h-3" />
                            {success ? 'נשמר' : 'בצע'}
                        </>
                    )}
                </button>
            </div>

            <div className="absolute -top-1 right-6 w-3 h-3 bg-violet-50 border-t border-l border-purple-100 transform rotate-45 -translate-y-1/2"></div>
        </div>
    );
};
