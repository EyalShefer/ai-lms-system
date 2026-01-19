import React, { useState, useEffect, useRef } from 'react';
import { IconSparkles, IconWand, IconX, IconCheck, IconChevronLeft, IconChevronRight } from '../icons';
import { refineBlockContent, refineActivityIntroImage } from '../services/ai/geminiApi';
import { useVersionHistory } from '../hooks/useVersionHistory';

interface AiRefineToolbarProps {
    blockId: string;
    blockType: string;
    content: any;
    onUpdate: (newContent: any) => void;
    className?: string;
    unitId?: string; // Required for version history
}

/**
 * Generate a smart default prompt suggestion based on block type and content
 * Returns a focused, minimal prompt - favors refinement over expansion
 */
const generateDefaultPrompt = (blockType: string, content: any): string => {
    // Check if content exists and has substance
    const hasContent = (): boolean => {
        if (!content) return false;
        if (typeof content === 'string') return content.trim().length > 0;
        if (content.question) return content.question.trim().length > 0;
        if (content.text) return content.text.trim().length > 0;
        if (content.pairs?.length > 0) return true;
        if (content.items?.length > 0) return true;
        if (content.correct_order?.length > 0) return true;
        return false;
    };

    // If no content, suggest creation; otherwise suggest refinement
    if (!hasContent()) {
        // Empty content - suggest creating
        switch (blockType) {
            case 'multiple_choice':
            case 'multipleChoice':
            case 'multiple-choice':
                return `צור שאלת רב-ברירה עם 4 תשובות`;
            case 'open_question':
            case 'openQuestion':
            case 'open-question':
                return `צור שאלה פתוחה`;
            case 'matching':
                return `צור 5 זוגות התאמה`;
            case 'sorting':
            case 'ordering':
                return `צור רצף של 5 שלבים`;
            case 'fill_blanks':
            case 'fillBlanks':
            case 'fill_in_blanks':
                return `צור משפט עם מילים חסרות`;
            case 'categorization':
                return `צור 2 קטגוריות עם פריטים`;
            case 'memory_game':
                return `צור 6 זוגות למשחק זיכרון`;
            case 'true_false_speed':
                return `צור 5 משפטים לאמת/שקר`;
            default:
                return `צור תוכן על הנושא`;
        }
    }

    // Content exists - suggest refinement (not expansion!)
    // Return empty string so the user writes their own specific instruction
    return '';
};

export const AiRefineToolbar: React.FC<AiRefineToolbarProps> = ({ blockId, blockType, content, onUpdate, className, unitId }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [instruction, setInstruction] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Store user's custom prompt to preserve it across open/close
    const userEditedPromptRef = useRef<string | null>(null);

    // Version history hook - only active when unitId is provided
    const {
        saveVersion,
        goToPrevious,
        goToNext,
        canGoBack,
        canGoForward,
        currentVersionNumber,
        totalVersions,
        hasHistory
    } = useVersionHistory(unitId || '', blockId, content, onUpdate);

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

            // Check if content actually changed
            if (JSON.stringify(refinedContent) === JSON.stringify(content)) {
                // Content didn't change - show warning to user
                setError("התוכן לא השתנה. נסה הוראה אחרת או הוסף פרטים נוספים.");
                return;
            }

            // Save to version history (if unitId provided)
            if (unitId) {
                saveVersion(refinedContent, instruction);
            }

            onUpdate(refinedContent);
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setIsOpen(false);
                // Don't reset instruction - preserve user's prompt for next time
            }, 1000);

        } catch (err) {
            console.error("Refine failed", err);
            setError("שגיאה בשיפור התוכן. נסה שוב.");
        } finally {
            setIsLoading(false);
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

                {/* Version history navigation - shows when there are saved versions */}
                {hasHistory && totalVersions > 1 && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-1">
                        <button
                            onClick={goToPrevious}
                            disabled={!canGoBack}
                            className={`p-1 rounded-full transition-colors ${
                                canGoBack
                                    ? 'hover:bg-gray-200 text-gray-600'
                                    : 'text-gray-300 cursor-not-allowed'
                            }`}
                            title="גרסה קודמת"
                        >
                            <IconChevronRight className="w-3 h-3" />
                        </button>

                        <span className="font-medium min-w-[32px] text-center text-gray-600">
                            {currentVersionNumber}/{totalVersions}
                        </span>

                        <button
                            onClick={goToNext}
                            disabled={!canGoForward}
                            className={`p-1 rounded-full transition-colors ${
                                canGoForward
                                    ? 'hover:bg-gray-200 text-gray-600'
                                    : 'text-gray-300 cursor-not-allowed'
                            }`}
                            title="גרסה הבאה"
                        >
                            <IconChevronLeft className="w-3 h-3" />
                        </button>
                    </div>
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
                    placeholder="כתבו בשפה חופשית מה לשנות, למשל: 'נסח בטון יותר מקצועי', 'קצר את הטקסט', 'הוסף דוגמה אחת'..."
                    className="w-full min-w-[350px] text-sm p-3 pr-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 min-h-[100px] resize-y bg-white/80"
                    disabled={isLoading}
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleRefine();
                        }
                    }}
                />
                <div className="text-[10px] text-gray-400 mt-1">
                    טיפ: ככל שההוראה ממוקדת יותר, כך התוצאה תהיה קרובה יותר לציפיות
                </div>
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
