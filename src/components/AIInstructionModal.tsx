import React, { useState } from 'react';
import { IconSparkles, IconX, IconWand } from '@tabler/icons-react';

interface AIInstructionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (instruction: string) => void;
    title?: string;
    initialPrompt?: string;
    isGenerating?: boolean;
}

export const AIInstructionModal: React.FC<AIInstructionModalProps> = ({
    isOpen,
    onClose,
    onGenerate,
    title = "עריכה / יצירה באמצעות AI",
    initialPrompt = "",
    isGenerating = false
}) => {
    const [instruction, setInstruction] = useState(initialPrompt);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in border border-white/40 ring-4 ring-blue-50/50">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2 font-bold text-lg">
                        <IconSparkles className="w-5 h-5 text-yellow-300" />
                        {title}
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isGenerating}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50"
                    >
                        <IconX className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        הנחיות ל-AI (מה לשנות / ליצור?):
                    </label>
                    <textarea
                        className="w-full p-4 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none h-32 text-gray-800"
                        placeholder="למשל: 'הפוך את השאלה לקשה יותר', 'הוסף עוד 2 אפשרויות', 'התמקד בנושא החלל'..."
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        disabled={isGenerating}
                        autoFocus
                    />

                    {/* Suggestions */}
                    <div className="mt-3 flex flex-wrap gap-2">
                        <span className="text-xs text-gray-400 font-bold ml-1">הצעות:</span>
                        {["פשט את השפה", "הפוך לקשה יותר", "תקן שגיאות", "הוסף הומור"].map(s => (
                            <button
                                key={s}
                                onClick={() => setInstruction(s)}
                                disabled={isGenerating}
                                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        disabled={isGenerating}
                        className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        ביטול
                    </button>
                    <button
                        onClick={() => onGenerate(instruction)}
                        disabled={isGenerating || (!instruction.trim() && !initialPrompt)} // Allow empty if initial prompt exists? logic decision: better to require input unless "Quick Gen" mode which bypasses modal
                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300 transform active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:transform-none"
                    >
                        {isGenerating ? (
                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> מעבד...</>
                        ) : (
                            <><IconWand className="w-4 h-4" /> צור עכשיו</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
