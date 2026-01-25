/**
 * Enrichment Offer Modal
 *
 * Modal להצעת אתגר לתלמידים חזקים שמצליחים בעקביות
 * מציע להם לנסות variant העמקה (קשה יותר) - עם אפשרות לבחור
 *
 * Created: 2026-01-23
 */

import React from 'react';
import type { ActivityBlock } from '../shared/types/courseTypes';
import { useVariantPolling } from '../hooks/useVariantPolling';
import type { VariantType } from '../types/variantCache.types';

interface EnrichmentOfferModalProps {
    /** האם המודל פתוח */
    isOpen: boolean;

    /** סגירת המודל */
    onClose: () => void;

    /** קבלת האתגר והמשך */
    onAccept: (variant: ActivityBlock) => void;

    /** דחיית האתגר והמשך ביישום רגיל */
    onDecline: () => void;

    /** ID של ה-block המקורי */
    blockId: string | null;

    /** סוג ה-variant (בדר"כ העמקה) */
    variantType: VariantType;

    /** ה-variant אם כבר קיים */
    initialVariant?: ActivityBlock | null;

    /** מידע על הביצועים */
    studentStats?: {
        mastery: number;
        recentAccuracy?: number;
    };
}

/**
 * Modal להצעת enrichment variant לתלמידים חזקים
 */
export const EnrichmentOfferModal: React.FC<EnrichmentOfferModalProps> = ({
    isOpen,
    onClose,
    onAccept,
    onDecline,
    blockId,
    variantType,
    initialVariant = null,
    studentStats
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 animate-fadeIn">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-6 animate-scaleIn border-2 border-purple-200">
                {/* Header */}
                <div className="text-center space-y-3">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                        <svg
                            className="w-10 h-10 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                        </svg>
                    </div>

                    <div>
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                            {variantType === 'העמקה' ? '🎉 כל הכבוד!' : '🚀 אתגר מיוחד!'}
                        </h2>
                        {studentStats && (
                            <div className="flex items-center justify-center gap-2 mt-2">
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold">
                                    {Math.round(studentStats.mastery * 100)}% שליטה
                                </span>
                                {studentStats.recentAccuracy !== undefined && (
                                    <span className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded-full font-bold">
                                        {Math.round(studentStats.recentAccuracy * 100)}% דיוק
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <p className="text-slate-700 font-medium leading-relaxed">
                        {variantType === 'העמקה'
                            ? 'נראה שאת/ה שולט/ת בחומר! 💪'
                            : 'הביצועים שלך מעולים!'}
                    </p>
                    <p className="text-slate-600 text-sm leading-relaxed">
                        {variantType === 'העמקה'
                            ? 'יש לי אתגר מיוחד שיעזור לך להעמיק ולחשוב יצירתית. רוצה לנסות?'
                            : 'האם תרצה/י לנסות משהו מאתגר יותר?'}
                    </p>
                </div>

                {/* What to expect */}
                <div className="bg-white rounded-xl p-4 space-y-3 border-2 border-purple-100">
                    <h3 className="font-bold text-purple-800 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        מה האתגר כולל?
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-700">
                        <li className="flex items-start gap-2">
                            <span className="text-purple-500 font-bold">•</span>
                            <span>שאלות מורכבות יותר שדורשות חשיבה עמוקה</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-pink-500 font-bold">•</span>
                            <span>קשר לחיים האמיתיים ויישומים מעשיים</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-purple-500 font-bold">•</span>
                            <span>הזדמנות לפתח חשיבה יצירתית</span>
                        </li>
                    </ul>
                </div>

                {/* Content Status */}
                <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl p-4 border border-purple-200">
                    {isLoading && !displayVariant ? (
                        // Loading State
                        <div className="text-center py-6 space-y-4">
                            <div className="relative w-12 h-12 mx-auto">
                                <div className="absolute inset-0 border-4 border-purple-200 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-purple-600 rounded-full border-t-transparent animate-spin"></div>
                            </div>
                            <p className="text-purple-700 font-medium">
                                מכין לך אתגר מיוחד...
                            </p>
                            <p className="text-purple-600 text-sm">
                                זה ייקח רגע קט! ⚡
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
                                הכנת האתגר לוקחת זמן רב מהרגיל
                            </p>
                            <p className="text-amber-600 text-sm">
                                אפשר להמשיך עם השאלות הרגילות בינתיים
                            </p>
                        </div>
                    ) : displayVariant ? (
                        // Ready State
                        <div className="text-center py-6 space-y-3">
                            <div className="relative w-16 h-16 mx-auto">
                                <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full animate-ping opacity-20"></div>
                                <div className="relative bg-gradient-to-br from-green-400 to-emerald-500 rounded-full w-16 h-16 flex items-center justify-center">
                                    <svg
                                        className="w-8 h-8 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={3}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                </div>
                            </div>
                            <p className="text-green-700 font-bold text-lg">
                                האתגר מוכן! 🎉
                            </p>
                            <p className="text-green-600 text-sm">
                                {variantType === 'העמקה'
                                    ? 'בואו נראה מה יש!'
                                    : 'קדימה לאתגר!'}
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
                                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
                            >
                                {variantType === 'העמקה' ? 'בואו לאתגר! 🚀' : 'אני רוצה לנסות! 💪'}
                            </button>
                            <button
                                onClick={onDecline}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-6 rounded-xl transition-all border-2 border-slate-200"
                            >
                                אולי בפעם הבאה
                            </button>
                        </>
                    ) : isTimeout ? (
                        // Timeout - offer to continue normally
                        <>
                            <button
                                onClick={onDecline}
                                className="flex-1 bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
                            >
                                המשך עם השאלות הרגילות
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-6 rounded-xl transition-all border-2 border-slate-200"
                            >
                                סגור
                            </button>
                        </>
                    ) : (
                        // Loading - offer to skip
                        <button
                            onClick={onDecline}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-6 rounded-xl transition-all border-2 border-slate-200"
                        >
                            לא יכול/ה לחכות, המשך רגיל
                        </button>
                    )}
                </div>

                {/* Motivation message */}
                <div className="text-center">
                    <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
                        <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="font-medium">אתגרים עוזרים לנו לגדול ולהשתפר!</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default EnrichmentOfferModal;
