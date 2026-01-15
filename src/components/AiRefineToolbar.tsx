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
 * Suggestions are contextual and include specific references to the block's content
 */
const generateDefaultPrompt = (blockType: string, content: any): string => {
    // Extract text content for context
    const getTextContent = (): string => {
        if (!content) return '';
        if (typeof content === 'string') return content;
        if (content.question) return content.question;
        if (content.text) return content.text;
        if (content.title) return content.title;
        if (content.prompt) return content.prompt;
        if (content.teach_content) return content.teach_content;
        if (content.content) return typeof content.content === 'string' ? content.content : '';
        return '';
    };

    // Extract question for question-type blocks
    const getQuestion = (): string => {
        if (!content || typeof content === 'string') return '';
        return content.question || '';
    };

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

    const textContent = getTextContent();
    const question = getQuestion();
    const shortContent = textContent.length > 60 ? textContent.substring(0, 60) + '...' : textContent;
    const shortQuestion = question.length > 50 ? question.substring(0, 50) + '...' : question;

    // Generate contextual suggestions based on block type
    switch (blockType) {
        case 'multiple_choice':
        case 'multipleChoice':
        case 'multiple-choice': {
            const count = getOptionsCount();
            if (shortQuestion) {
                return `עבור השאלה "${shortQuestion}" - הוסיפו מסיחים מתוחכמים יותר${count < 4 ? ` (כרגע יש ${count} תשובות)` : ''}, או שפרו את ניסוח השאלה`;
            }
            return `שפרו את השאלה: הוסיפו מסיחים מתוחכמים יותר, או שפרו את הניסוח`;
        }

        case 'open_question':
        case 'openQuestion':
        case 'open-question':
            if (shortQuestion) {
                return `עבור השאלה "${shortQuestion}" - הפכו אותה למאתגרת יותר או הוסיפו הנחיות ברורות לתשובה`;
            }
            return `שפרו את השאלה הפתוחה: הפכו אותה למאתגרת יותר או הוסיפו הנחיות ברורות לתשובה`;

        case 'matching': {
            const count = getItemsCount();
            if (count > 0) {
                return `שפרו את משחק ההתאמה (${count} זוגות): הוסיפו זוגות נוספים או שפרו את הקשר בין הפריטים`;
            }
            return `שפרו את משחק ההתאמה: הוסיפו זוגות נוספים או שפרו את הקשר בין הפריטים`;
        }

        case 'sorting':
        case 'ordering': {
            const count = getItemsCount();
            if (count > 0) {
                return `שפרו את פעילות הסידור (${count} פריטים): הוסיפו פריטים או הבהירו את קריטריון המיון`;
            }
            return `שפרו את פעילות המיון: הוסיפו פריטים או הבהירו את קריטריון המיון`;
        }

        case 'fill_blanks':
        case 'fillBlanks':
        case 'fill_in_blanks':
            if (shortContent) {
                return `עבור הטקסט "${shortContent}" - הוסיפו רמזים או שפרו את ההקשר סביב החסר`;
            }
            return `שפרו את ההשלמה: הוסיפו רמזים או שפרו את ההקשר סביב החסר`;

        case 'info':
        case 'text':
        case 'content':
            if (shortContent) {
                return `עבור הטקסט "${shortContent}" - פשטו את השפה, הוסיפו דוגמאות, או הפכו למרתק יותר`;
            }
            return `שפרו את הטקסט: פשטו את השפה, הוסיפו דוגמאות, או הפכו אותו למרתק יותר`;

        case 'video':
            return `הוסיפו שאלות מנחות לצפייה בסרטון או סיכום של נקודות המפתח`;

        case 'image':
            return `הוסיפו תיאור לתמונה או שאלות התבוננות`;

        case 'activity-intro': {
            const title = content?.title || '';
            if (title) {
                return `צרו תמונת פתיחה חדשה עבור "${title}" - שנו את הסגנון, הוסיפו אלמנטים, או שפרו את האווירה`;
            }
            return `שפרו את תמונת הפתיחה: שנו את הסגנון, הוסיפו אלמנטים, או צרו תמונה חדשה`;
        }

        case 'discussion':
            if (shortContent) {
                return `עבור הדיון בנושא "${shortContent}" - הוסיפו שאלות מנחות או נקודות למחשבה`;
            }
            return `שפרו את נושא הדיון: הוסיפו שאלות מנחות או נקודות למחשבה`;

        case 'interactive_chat':
        case 'interactiveChat':
        case 'interactive-chat':
            if (shortContent) {
                return `עבור השיחה בנושא "${shortContent}" - הוסיפו תרחישים או שאלות העמקה`;
            }
            return `שפרו את השיחה האינטראקטיבית: הוסיפו תרחישים או שאלות העמקה`;

        case 'summary':
            if (shortContent) {
                return `עבור הסיכום "${shortContent}" - הוסיפו נקודות מפתח או קשרו לנושאים קודמים`;
            }
            return `שפרו את הסיכום: הוסיפו נקודות מפתח או קשרו לנושאים קודמים`;

        case 'categorization': {
            const count = getItemsCount();
            if (count > 0) {
                return `שפרו את פעילות המיון (${count} פריטים): הוסיפו פריטים או קטגוריות נוספות`;
            }
            return `שפרו את פעילות המיון לקטגוריות: הוסיפו פריטים או קטגוריות`;
        }

        case 'memory_game': {
            const count = getItemsCount();
            if (count > 0) {
                return `שפרו את משחק הזיכרון (${count} זוגות): הוסיפו זוגות או שפרו את התוכן`;
            }
            return `שפרו את משחק הזיכרון: הוסיפו זוגות או שפרו את התוכן`;
        }

        default:
            if (shortContent) {
                return `עבור התוכן "${shortContent}" - פשטו שפה, הוסיפו דוגמאות, או הפכו למרתק יותר`;
            }
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
