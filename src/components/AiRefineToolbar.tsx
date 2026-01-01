import React, { useState } from 'react';
import { IconSparkles, IconWand, IconX, IconCheck } from '../icons';
import { refineBlockContent } from '../services/ai/geminiApi';

interface AiRefineToolbarProps {
    blockId: string;
    blockType: string;
    content: any;
    onUpdate: (newContent: any) => void;
    className?: string;
}

export const AiRefineToolbar: React.FC<AiRefineToolbarProps> = ({ blockId, blockType, content, onUpdate, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [instruction, setInstruction] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleRefine = async () => {
        if (!instruction.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            console.log(`🚀 Refining block ${blockId} (${blockType})...`);
            const refinedContent = await refineBlockContent(blockType, content, instruction);

            // Check if content actually changed (deep compare or just naive check)
            if (JSON.stringify(refinedContent) === JSON.stringify(content)) {
                // Even if identical, we treat it as success but maybe warn? 
                // Actually, LLM might return same content if instruction was "keep as is".
            }

            onUpdate(refinedContent);
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setIsOpen(false);
                setInstruction("");
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
            <button
                onClick={() => setIsOpen(true)}
                className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all shadow-sm 
                bg-gradient-to-r from-violet-100 to-fuchsia-100 text-purple-700 border-purple-200 hover:from-violet-200 hover:to-fuchsia-200 ${className || ''}`}
                title="שפר או שנה את התוכן באמצעות הוראות חופשיות"
            >
                <IconSparkles className="w-3 h-3 text-purple-600" />
                שפר עם AI
            </button>
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

            {/* Input Area */}
            <div className="relative">
                <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="למשל: 'הוסיפו עוד 2 מסיחים', 'הפכו את השאלה לקשה יותר', 'תנו דוגמאות מעולם החי'..."
                    className="w-full text-sm p-3 pr-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 min-h-[60px] resize-none bg-white/80"
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
