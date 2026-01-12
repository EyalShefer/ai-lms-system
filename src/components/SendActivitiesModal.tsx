/**
 * SendActivitiesModal
 *
 * Modal for teachers to select and send interactive activities
 * from a lesson plan to students.
 */

import React, { useState, useMemo } from 'react';
import {
    IconX,
    IconSend,
    IconCheck,
    IconUsers,
    IconCopy,
    IconBrandWhatsapp,
    IconMail,
    IconShare2,
    IconSparkles,
    IconAlertCircle
} from '@tabler/icons-react';
import type { LearningUnit, ActivityBlock, Course } from '../shared/types/courseTypes';
import {
    getSendableBlocks,
    getBlockTypeLabel,
    groupBlocksBySections,
    extractActivityFromLesson,
    extractAllActivities,
    isBlockSendable
} from '../services/lessonActivityService';

interface SendActivitiesModalProps {
    unit: LearningUnit;
    course: Course;
    onClose: () => void;
    onSuccess?: (activityCourseId: string, shareUrl: string) => void;
}

// Block type icons
const BLOCK_ICONS: Record<string, string> = {
    'multiple-choice': '📝',
    'open-question': '✍️',
    'fill_in_blanks': '📋',
    'ordering': '🔢',
    'categorization': '📊',
    'memory_game': '🧠',
    'true_false_speed': '⚡',
    'drag_and_drop': '🎯',
    'hotspot': '📍',
    'matching': '🔗',
    'audio-response': '🎤',
    'interactive-chat': '💬'
};

const SendActivitiesModal: React.FC<SendActivitiesModalProps> = ({
    unit,
    course,
    onClose,
    onSuccess
}) => {
    const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
    const [activityTitle, setActivityTitle] = useState(`פעילות: ${unit.title}`);
    const [step, setStep] = useState<'select' | 'share'>('select');
    const [isLoading, setIsLoading] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [activityCourseId, setActivityCourseId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Get sendable blocks
    const sendableBlocks = useMemo(() => getSendableBlocks(unit), [unit]);

    // Group blocks by sections
    const sections = useMemo(() => groupBlocksBySections(unit.activityBlocks || []), [unit]);

    // Toggle block selection
    const toggleBlock = (blockId: string) => {
        const newSelected = new Set(selectedBlockIds);
        if (newSelected.has(blockId)) {
            newSelected.delete(blockId);
        } else {
            newSelected.add(blockId);
        }
        setSelectedBlockIds(newSelected);
    };

    // Select all
    const selectAll = () => {
        setSelectedBlockIds(new Set(sendableBlocks.map(b => b.id)));
    };

    // Clear selection
    const clearSelection = () => {
        setSelectedBlockIds(new Set());
    };

    // Get block preview text
    const getBlockPreview = (block: ActivityBlock): string => {
        const content = block.content;
        if (typeof content === 'string') {
            return content.substring(0, 100) + (content.length > 100 ? '...' : '');
        }
        if (typeof content === 'object' && content !== null) {
            if ('question' in content) return (content as any).question;
            if ('instruction' in content) return (content as any).instruction;
        }
        return getBlockTypeLabel(block.type);
    };

    // Handle send
    const handleSend = async () => {
        if (selectedBlockIds.size === 0) return;

        setIsLoading(true);
        try {
            const result = await extractActivityFromLesson(
                course,
                unit,
                Array.from(selectedBlockIds),
                activityTitle
            );

            setActivityCourseId(result.activityCourseId);
            setShareUrl(result.shareUrl);
            setStep('share');
            onSuccess?.(result.activityCourseId, result.shareUrl);
        } catch (error) {
            console.error('Error extracting activity:', error);
            alert('שגיאה ביצירת הפעילות');
        } finally {
            setIsLoading(false);
        }
    };

    // Copy link
    const handleCopyLink = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    // Share via WhatsApp
    const handleWhatsAppShare = () => {
        if (!shareUrl) return;
        const text = encodeURIComponent(`${activityTitle}\n\nלחצו על הקישור להתחיל:\n${shareUrl}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    // Share via Email
    const handleEmailShare = () => {
        if (!shareUrl) return;
        const subject = encodeURIComponent(activityTitle);
        const body = encodeURIComponent(`שלום,\n\nמצורף קישור לפעילות "${activityTitle}":\n${shareUrl}\n\nבהצלחה!`);
        window.open(`mailto:?subject=${subject}&body=${body}`);
    };

    // Native share
    const handleNativeShare = async () => {
        if (!shareUrl || !navigator.share) return;
        try {
            await navigator.share({
                title: activityTitle,
                text: `לחצו להתחיל את הפעילות: ${activityTitle}`,
                url: shareUrl
            });
        } catch (error) {
            console.error('Share failed:', error);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" dir="rtl">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
                                <IconSend className="w-6 h-6" />
                                {step === 'select' ? 'שליחת פעילויות לתלמידים' : 'שיתוף הפעילות'}
                            </h2>
                            <p className="text-white/80 text-sm">
                                {step === 'select'
                                    ? 'בחרו את הפעילויות שברצונכם לשלוח לתלמידים'
                                    : 'הפעילות נוצרה בהצלחה! שתפו את הקישור עם התלמידים'
                                }
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <IconX className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'select' ? (
                        <>
                            {/* Activity Title */}
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    שם הפעילות
                                </label>
                                <input
                                    type="text"
                                    value={activityTitle}
                                    onChange={(e) => setActivityTitle(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                    placeholder="הקלידו שם לפעילות..."
                                />
                            </div>

                            {/* Selection Controls */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-500">
                                        נבחרו {selectedBlockIds.size} מתוך {sendableBlocks.length} פעילויות
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={selectAll}
                                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                    >
                                        בחר הכל
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button
                                        onClick={clearSelection}
                                        className="text-sm text-slate-500 hover:text-slate-700 font-medium"
                                    >
                                        נקה בחירה
                                    </button>
                                </div>
                            </div>

                            {/* Blocks List */}
                            {sendableBlocks.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <IconAlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p className="font-medium">אין פעילויות אינטראקטיביות במערך השיעור</p>
                                    <p className="text-sm mt-1">הוסיפו שאלות או משחקים למערך השיעור</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {sections.map((section, sIdx) => (
                                        <div key={sIdx} className="mb-4">
                                            {sections.length > 1 && (
                                                <h4 className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-2">
                                                    <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                                                    {section.sectionTitle}
                                                </h4>
                                            )}
                                            {section.blocks.map((block) => {
                                                const isSelected = selectedBlockIds.has(block.id);
                                                return (
                                                    <div
                                                        key={block.id}
                                                        onClick={() => toggleBlock(block.id)}
                                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all mb-2 ${
                                                            isSelected
                                                                ? 'border-indigo-500 bg-indigo-50'
                                                                : 'border-slate-200 hover:border-slate-300 bg-white'
                                                        }`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            {/* Checkbox */}
                                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                                                isSelected
                                                                    ? 'bg-indigo-500 border-indigo-500'
                                                                    : 'border-slate-300'
                                                            }`}>
                                                                {isSelected && <IconCheck className="w-4 h-4 text-white" />}
                                                            </div>

                                                            {/* Icon */}
                                                            <span className="text-2xl">
                                                                {BLOCK_ICONS[block.type] || '📄'}
                                                            </span>

                                                            {/* Content */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">
                                                                        {getBlockTypeLabel(block.type)}
                                                                    </span>
                                                                </div>
                                                                <p className="text-slate-700 text-sm line-clamp-2">
                                                                    {getBlockPreview(block)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        /* Share Step */
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <IconCheck className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">
                                הפעילות נוצרה בהצלחה!
                            </h3>
                            <p className="text-slate-500 mb-2">
                                {selectedBlockIds.size} פעילויות מוכנות לשליחה לתלמידים
                            </p>
                            <p className="text-sm text-indigo-600 font-medium mb-6">
                                הפעילות נשמרה ותופיע בלוח המורה שלך
                            </p>

                            {/* Share Link */}
                            <div className="bg-slate-50 rounded-xl p-4 mb-6 text-right">
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    קישור לשליחה לתלמידים:
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={shareUrl || ''}
                                        readOnly
                                        className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-700 text-left"
                                        dir="ltr"
                                    />
                                    <button
                                        onClick={handleCopyLink}
                                        className={`p-3 rounded-xl transition-all flex items-center gap-2 font-bold ${
                                            copied
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        }`}
                                    >
                                        {copied ? <IconCheck className="w-5 h-5" /> : <IconCopy className="w-5 h-5" />}
                                        <span className="hidden sm:inline">{copied ? 'הועתק!' : 'העתק'}</span>
                                    </button>
                                </div>
                                {copied && (
                                    <p className="text-emerald-600 text-sm mt-2 font-medium">
                                        הקישור הועתק! שלחו אותו לתלמידים בכל דרך שנוחה לכם
                                    </p>
                                )}
                            </div>

                            {/* Share Buttons */}
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    onClick={handleWhatsAppShare}
                                    className="flex flex-col items-center gap-2 p-4 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
                                >
                                    <IconBrandWhatsapp className="w-8 h-8 text-emerald-600" />
                                    <span className="text-sm font-medium text-emerald-700">WhatsApp</span>
                                </button>
                                <button
                                    onClick={handleEmailShare}
                                    className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                                >
                                    <IconMail className="w-8 h-8 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-700">אימייל</span>
                                </button>
                                {navigator.share && (
                                    <button
                                        onClick={handleNativeShare}
                                        className="flex flex-col items-center gap-2 p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors"
                                    >
                                        <IconShare2 className="w-8 h-8 text-purple-600" />
                                        <span className="text-sm font-medium text-purple-700">שיתוף</span>
                                    </button>
                                )}
                            </div>

                            {/* Info */}
                            <div className="mt-6 p-4 bg-indigo-50 rounded-xl text-right">
                                <div className="flex items-start gap-3">
                                    <IconSparkles className="w-5 h-5 text-indigo-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-indigo-800 font-medium">
                                            תוצאות התלמידים יופיעו בלוח הבקרה
                                        </p>
                                        <p className="text-xs text-indigo-600 mt-1">
                                            תוכלו לעקוב אחרי ההתקדמות והציונים בזמן אמת
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-200 shrink-0">
                    {step === 'select' ? (
                        <div className="flex items-center justify-between">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={selectedBlockIds.size === 0 || isLoading}
                                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        יוצר פעילות...
                                    </>
                                ) : (
                                    <>
                                        <IconSend className="w-5 h-5" />
                                        צור פעילות לתלמידים ({selectedBlockIds.size})
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            <button
                                onClick={onClose}
                                className="px-8 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                            >
                                סגור
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SendActivitiesModal;
