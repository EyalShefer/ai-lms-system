import React, { useState } from 'react';
import { IconThumbUp, IconThumbDown, IconX, IconCheck } from '../icons';
import { feedbackService } from '../services/feedbackService';

interface FeedbackWidgetProps {
    courseId: string;
    unitId?: string;
    blockId?: string;
    blockType?: string;
    userId: string; // Should come from auth context normally, but passed here for flexibility
    className?: string; // Allow positioning customization
}

const NEGATIVE_TAGS = [
    { id: 'confusing', label: 'לא מובן' },
    { id: 'too_hard', label: 'קשה מדי' },
    { id: 'boring', label: 'משעמם' },
    { id: 'bug', label: 'תקלה טכנית' },
];

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
    courseId,
    unitId,
    blockId,
    blockType,
    userId,
    className = ""
}) => {
    const [state, setState] = useState<'idle' | 'positive' | 'negative_selecting' | 'submitted'>('idle');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handlePositive = async () => {
        setState('submitted');
        try {
            await feedbackService.submitFeedback({
                userId,
                userRole: 'student',
                courseId,
                unitId,
                blockId,
                type: 'positive',
                context: { blockType }
            });
        } catch (e) {
            console.error("Failed to submit positive feedback", e);
            // Silently fail UI-wise after showing success, or revert? Keeping simple for now.
        }
    };

    const handleNegativeClick = () => {
        setState('negative_selecting');
    };

    const toggleTag = (tagId: string) => {
        setSelectedTags(prev =>
            prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
        );
    };

    const submitNegative = async () => {
        if (selectedTags.length === 0) return; // Require at least one tag? Or allow empty? Let's require one.

        setIsSubmitting(true);
        try {
            await feedbackService.submitFeedback({
                userId,
                userRole: 'student',
                courseId,
                unitId,
                blockId,
                type: 'negative',
                tags: selectedTags,
                context: { blockType }
            });
            setState('submitted');
        } catch (e) {
            console.error("Failed to submit negative feedback", e);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (state === 'submitted') {
        return (
            <div className={`flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-full text-xs font-bold animate-fade-in ${className}`}>
                <IconCheck className="w-4 h-4" /> תודה על המשוב!
            </div>
        );
    }

    if (state === 'negative_selecting') {
        return (
            <div className={`bg-white shadow-lg border border-slate-200 rounded-xl p-3 absolute z-50 animate-scale-in w-64 ${className}`}>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-500">מה הבעיה?</span>
                    <button onClick={() => setState('idle')} className="text-slate-400 hover:text-slate-600"><IconX className="w-4 h-4" /></button>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                    {NEGATIVE_TAGS.map(tag => (
                        <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.id)}
                            className={`text-xs px-2 py-1 rounded-md border transition-all ${selectedTags.includes(tag.id)
                                    ? 'bg-red-100 border-red-300 text-red-700 font-bold'
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            {tag.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={submitNegative}
                    disabled={isSubmitting || selectedTags.length === 0}
                    className="w-full bg-slate-900 text-white rounded-lg py-1.5 text-xs font-bold hover:bg-black disabled:opacity-50 transition-colors"
                >
                    {isSubmitting ? 'שולח...' : 'שלח משוב'}
                </button>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity ${className}`}>
            <button
                onClick={handlePositive}
                className="p-1.5 hover:bg-green-50 hover:text-green-600 rounded-full transition-colors group"
                title="מועיל / אהבתי"
            >
                <IconThumbUp className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
            <button
                onClick={handleNegativeClick}
                className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors group"
                title="לא מובן / בעיה"
            >
                <IconThumbDown className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
        </div>
    );
};
