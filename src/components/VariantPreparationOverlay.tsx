/**
 * VariantPreparationOverlay Component
 *
 * Shows a loading state while adaptive content variants are being generated.
 * Displays progress information and allows the user to skip waiting.
 *
 * Created: 2026-01-25
 */

import React from 'react';

interface VariantPreparationOverlayProps {
    /** Generation progress statistics */
    stats?: {
        totalBlocks: number;
        processed: number;
        failed?: number;
    };

    /** Callback when user wants to skip waiting */
    onSkip?: () => void;

    /** Custom title text */
    title?: string;

    /** Custom description text */
    description?: string;
}

/**
 * Full-screen overlay showing variant generation progress.
 */
export const VariantPreparationOverlay: React.FC<VariantPreparationOverlayProps> = ({
    stats,
    onSkip,
    title = 'מכינים את התוכן המותאם',
    description = 'המערכת יוצרת גרסאות מותאמות אישית עבורך...'
}) => {
    // Calculate progress percentage
    const progress = stats && stats.totalBlocks > 0
        ? Math.round((stats.processed / stats.totalBlocks) * 100)
        : 0;

    return (
        <div
            className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50"
            dir="rtl"
        >
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl animate-in fade-in zoom-in duration-300">
                {/* Animated Spinner */}
                <div className="mb-6">
                    <div className="w-20 h-20 mx-auto mb-4 relative">
                        {/* Outer ring */}
                        <svg
                            className="w-full h-full animate-spin"
                            viewBox="0 0 50 50"
                        >
                            <circle
                                cx="25"
                                cy="25"
                                r="20"
                                fill="none"
                                stroke="#E5E7EB"
                                strokeWidth="4"
                            />
                            <circle
                                cx="25"
                                cy="25"
                                r="20"
                                fill="none"
                                stroke="#3B82F6"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray="80"
                                strokeDashoffset="60"
                            />
                        </svg>

                        {/* Center icon */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-2xl">🧠</span>
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-gray-800 mb-2">
                        {title}
                    </h2>
                    <p className="text-gray-600 text-sm">
                        {description}
                    </p>
                </div>

                {/* Progress Bar */}
                {stats && stats.totalBlocks > 0 && (
                    <div className="mb-6">
                        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-sm text-gray-500">
                            <span>{stats.processed} / {stats.totalBlocks} בלוקים</span>
                            <span>{progress}%</span>
                        </div>
                    </div>
                )}

                {/* Info text */}
                <p className="text-xs text-gray-400 mb-4">
                    ההתאמה האישית עוזרת לך ללמוד בצורה יעילה יותר
                </p>

                {/* Skip Button */}
                {onSkip && (
                    <button
                        onClick={onSkip}
                        className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
                    >
                        המשך ללא התאמה אישית
                    </button>
                )}
            </div>
        </div>
    );
};

export default VariantPreparationOverlay;
