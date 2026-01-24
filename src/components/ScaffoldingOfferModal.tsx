/**
 * Scaffolding Offer Modal
 *
 * Modal שמוצג לתלמיד אחרי 3 כישלונות עם mastery נמוך
 * מציע לנסות variant קל יותר (הבנה)
 *
 * Created: 2026-01-23
 */

import React from 'react';
import type { ActivityBlock } from '../shared/types/courseTypes';
import { useVariantPolling } from '../hooks/useVariantPolling';
import type { VariantType } from '../types/variantCache.types';

interface ScaffoldingOfferModalProps {
    /** האם המודל פתוח */
    isOpen: boolean;

    /** סגירת המודל */
    onClose: () => void;

    /** קבלת ה-variant והמשך */
    onAccept: (variant: ActivityBlock) => void;

    /** דחיית ה-variant וחשיפת תשובה */
    onDecline: () => void;

    /** ID של ה-block המקורי */
    blockId: string | null;

    /** סוג ה-variant (בדר"כ הבנה) */
    variantType: VariantType;

    /** ה-variant אם כבר קיים */
    initialVariant?: ActivityBlock | null;
}

/**
 * Modal להצעת scaffolding variant
 */
export const ScaffoldingOfferModal: React.FC<ScaffoldingOfferModalProps> = ({
    isOpen,
    onClose,
    onAccept,
    onDecline,
    blockId,
    variantType,
    initialVariant = null
}) => {
    // Poll for variant if not provided
    const { variant, isLoading, isTimeout } = useVariantPolling(
        blockId,
        variantType,
        { enabled: isOpen && !initialVariant }
    );

    const displayVariant = initialVariant || variant;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-6 animate-fadeIn">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 mx-auto bg-cyan-100 rounded-full flex items-center justify-center">
                        <svg
                            className="w-8 h-8 text-cyan-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                            />
                        </svg>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800">
                        {variantType === 'הבנה' ? 'בואו ננסה משהו פשוט יותר' : 'בואו ננסה אתגר'}
                    </h2>

                    <p className="text-slate-600 text-sm">
                        {variantType === 'הבנה'
                            ? 'נראה שיש כאן קצת קושי. יש לי שאלה דומה שתעזור לך להבין טוב יותר!'
                            : 'נראה שאת/ה שולט/ת בחומר! יש לי אתגר מעניין בשבילך.'}
                    </p>
                </div>

                {/* Content */}
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-4 border border-cyan-200">
                    {isLoading && !displayVariant ? (
                        // Loading State
                        <div className="text-center py-8 space-y-4">
                            <div className="relative w-12 h-12 mx-auto">
                                <div className="absolute inset-0 border-4 border-cyan-200 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-cyan-600 rounded-full border-t-transparent animate-spin"></div>
                            </div>
                            <p className="text-cyan-700 font-medium">
                                מכין לך שאלה מותאמת...
                            </p>
                            <p className="text-cyan-600 text-sm">
                                זה ייקח רגע קט! 😊
                            </p>
                        </div>
                    ) : isTimeout ? (
                        // Timeout State
                        <div className="text-center py-6 space-y-3">
                            <svg
                                className="w-12 h-12 mx-auto text-amber-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <p className="text-amber-700 font-medium">
                                הכנת השאלה לוקחת זמן רב מהרגיל
                            </p>
                            <p className="text-amber-600 text-sm">
                                אפשר לראות את התשובה הנכונה במקום
                            </p>
                        </div>
                    ) : displayVariant ? (
                        // Ready State
                        <div className="text-center py-6 space-y-3">
                            <svg
                                className="w-12 h-12 mx-auto text-green-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <p className="text-green-700 font-bold text-lg">
                                מוכן! 🎉
                            </p>
                            <p className="text-green-600 text-sm">
                                {variantType === 'הבנה'
                                    ? 'השאלה המותאמת מוכנה - בואו ננסה!'
                                    : 'האתגר מוכן - בואו נראה מה יש!'}
                            </p>
                        </div>
                    ) : null}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    {displayVariant ? (
                        // Variant is ready
                        <>
                            <button
                                onClick={() => onAccept(displayVariant)}
                                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg"
                            >
                                {variantType === 'הבנה' ? 'בואו ננסה! 💪' : 'קדימה לאתגר! 🚀'}
                            </button>
                            <button
                                onClick={onDecline}
                                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-3 px-6 rounded-xl transition-all"
                            >
                                לא תודה, תראה לי את התשובה
                            </button>
                        </>
                    ) : isTimeout ? (
                        // Timeout - offer to see answer
                        <>
                            <button
                                onClick={onDecline}
                                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
                            >
                                הצג תשובה
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-3 px-6 rounded-xl transition-all"
                            >
                                סגור
                            </button>
                        </>
                    ) : (
                        // Loading - offer to cancel
                        <button
                            onClick={onDecline}
                            className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-3 px-6 rounded-xl transition-all"
                        >
                            לא יכול לחכות, תראה לי את התשובה
                        </button>
                    )}
                </div>

                {/* Helper text */}
                <p className="text-center text-xs text-slate-500">
                    💡 טיפ: לנסות שאלה קלה יותר עוזר להבין טוב יותר את החומר
                </p>
            </div>
        </div>
    );
};

export default ScaffoldingOfferModal;
