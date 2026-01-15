/**
 * Grade Override Component
 * מודאל לעדכון ציון ידני עם תיעוד סיבה
 */

import React, { useState, useCallback } from 'react';
import {
    IconEdit,
    IconX,
    IconCheck,
    IconAlertCircle,
    IconHistory,
    IconUser
} from '@tabler/icons-react';

export interface GradeOverrideData {
    originalScore: number;
    newScore: number;
    reason: string;
    overriddenBy: string;
    overriddenAt: number;
}

interface GradeOverrideModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentName: string;
    taskTitle: string;
    currentScore: number;
    previousOverride?: GradeOverrideData;
    onSave: (newScore: number, reason: string) => Promise<void>;
}

export const GradeOverrideModal: React.FC<GradeOverrideModalProps> = ({
    isOpen,
    onClose,
    studentName,
    taskTitle,
    currentScore,
    previousOverride,
    onSave
}) => {
    const [newScore, setNewScore] = useState<number>(currentScore);
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = useCallback(async () => {
        // Validation
        if (newScore < 0 || newScore > 100) {
            setError('הציון חייב להיות בין 0 ל-100');
            return;
        }
        if (!reason.trim()) {
            setError('חובה לציין סיבה לשינוי הציון');
            return;
        }
        if (reason.trim().length < 10) {
            setError('הסיבה חייבת להכיל לפחות 10 תווים');
            return;
        }
        if (newScore === currentScore) {
            setError('הציון החדש זהה לציון הנוכחי');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onSave(newScore, reason.trim());
            onClose();
        } catch (err) {
            setError('שגיאה בשמירת הציון. נסה שוב.');
        } finally {
            setIsSubmitting(false);
        }
    }, [newScore, reason, currentScore, onSave, onClose]);

    // Reset state when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setNewScore(currentScore);
            setReason('');
            setError(null);
        }
    }, [isOpen, currentScore]);

    if (!isOpen) return null;

    const scoreDiff = newScore - currentScore;
    const isIncrease = scoreDiff > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-indigo-50 to-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <IconEdit className="w-5 h-5 text-indigo-500" />
                                עדכון ציון ידני
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {studentName} | {taskTitle}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            <IconX className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5">
                    {/* Current Score */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <div className="text-sm text-slate-500 mb-1">ציון נוכחי</div>
                        <div className="text-3xl font-black text-slate-800">
                            {Math.round(currentScore)}%
                        </div>
                        {previousOverride && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-amber-600">
                                <IconHistory className="w-4 h-4" />
                                עודכן קודם מ-{previousOverride.originalScore}%
                            </div>
                        )}
                    </div>

                    {/* New Score Input */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            ציון חדש
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={newScore}
                                onChange={(e) => setNewScore(Number(e.target.value))}
                                className="w-full px-4 py-3 text-2xl font-bold text-center border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                                %
                            </span>
                        </div>

                        {/* Score change indicator */}
                        {newScore !== currentScore && (
                            <div className={`
                                mt-2 text-sm font-bold text-center
                                ${isIncrease ? 'text-green-600' : 'text-red-600'}
                            `}>
                                {isIncrease ? '↑' : '↓'} {Math.abs(scoreDiff).toFixed(0)} נקודות
                            </div>
                        )}
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            סיבה לשינוי <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="נא לפרט את הסיבה לשינוי הציון (לפחות 10 תווים)..."
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none resize-none h-24"
                            dir="rtl"
                        />
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-slate-400">
                                {reason.length} תווים
                            </span>
                            {reason.length > 0 && reason.length < 10 && (
                                <span className="text-xs text-amber-500">
                                    נדרשים עוד {10 - reason.length} תווים
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Quick reason buttons */}
                    <div>
                        <label className="block text-xs text-slate-500 mb-2">סיבות נפוצות:</label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                'בעיות טכניות בהגשה',
                                'נסיבות אישיות מוצדקות',
                                'הצגת הבנה בעל-פה',
                                'תיקון טעות בבדיקה אוטומטית',
                                'התחשבות בקשיי למידה'
                            ].map((quickReason) => (
                                <button
                                    key={quickReason}
                                    onClick={() => setReason(quickReason)}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs text-slate-600 transition-colors"
                                >
                                    {quickReason}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            <IconAlertCircle className="w-5 h-5 shrink-0" />
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors"
                    >
                        ביטול
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || newScore === currentScore || !reason.trim()}
                        className={`
                            flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all
                            ${isSubmitting || newScore === currentScore || !reason.trim()
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-xl'
                            }
                        `}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                שומר...
                            </>
                        ) : (
                            <>
                                <IconCheck className="w-4 h-4" />
                                שמור ציון
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Compact inline grade override button
interface GradeOverrideButtonProps {
    currentScore: number;
    hasOverride?: boolean;
    onClick: () => void;
}

export const GradeOverrideButton: React.FC<GradeOverrideButtonProps> = ({
    currentScore,
    hasOverride,
    onClick
}) => {
    return (
        <button
            onClick={onClick}
            className={`
                group flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all
                ${hasOverride
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }
            `}
            title={hasOverride ? 'ציון עודכן ידנית' : 'עדכן ציון'}
        >
            <span className="font-bold">{Math.round(currentScore)}%</span>
            <IconEdit className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
            {hasOverride && (
                <span className="text-[10px] font-bold bg-amber-200 px-1.5 py-0.5 rounded">
                    עודכן
                </span>
            )}
        </button>
    );
};

// Grade history display
interface GradeHistoryProps {
    overrides: GradeOverrideData[];
}

export const GradeHistory: React.FC<GradeHistoryProps> = ({ overrides }) => {
    if (overrides.length === 0) return null;

    return (
        <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <IconHistory className="w-4 h-4" />
                היסטוריית שינויים
            </h4>
            <div className="space-y-2">
                {overrides.map((override, i) => (
                    <div
                        key={i}
                        className="bg-slate-50 rounded-xl p-3 text-sm"
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-800">
                                {override.originalScore}% → {override.newScore}%
                            </span>
                            <span className="text-xs text-slate-500">
                                {new Date(override.overriddenAt).toLocaleDateString('he-IL')}
                            </span>
                        </div>
                        <p className="text-slate-600 text-xs">{override.reason}</p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                            <IconUser className="w-3 h-3" />
                            {override.overriddenBy}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GradeOverrideModal;
