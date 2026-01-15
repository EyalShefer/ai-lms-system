/**
 * Access Code Modal Component
 * יצירה וניהול קודי גישה להצטרפות לפעילות
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    IconKey,
    IconX,
    IconCopy,
    IconCheck,
    IconRefresh,
    IconCalendar,
    IconUsers,
    IconTrash,
    IconShare,
    IconQrcode,
    IconClock
} from '@tabler/icons-react';
import {
    accessCodeService,
    formatCode,
    type AccessCode
} from '../../services/accessCodeService';

interface AccessCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId: string;
    courseTitle: string;
    teacherId: string;
}

export const AccessCodeModal: React.FC<AccessCodeModalProps> = ({
    isOpen,
    onClose,
    courseId,
    courseTitle,
    teacherId
}) => {
    const [existingCodes, setExistingCodes] = useState<AccessCode[]>([]);
    const [activeCode, setActiveCode] = useState<AccessCode | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [copied, setCopied] = useState(false);

    // Options for new code
    const [expiresIn, setExpiresIn] = useState<number | null>(null); // hours
    const [usageLimit, setUsageLimit] = useState<number | null>(null);

    // Load existing codes
    useEffect(() => {
        if (isOpen) {
            loadCodes();
        }
    }, [isOpen, teacherId]);

    const loadCodes = async () => {
        setIsLoading(true);
        try {
            const codes = await accessCodeService.getTeacherCodes(teacherId);
            const courseCodes = codes.filter(c => c.courseId === courseId && c.isActive);
            setExistingCodes(courseCodes);
            if (courseCodes.length > 0) {
                setActiveCode(courseCodes[0]);
            }
        } catch (err) {
            console.error('Failed to load codes:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateCode = async () => {
        setIsCreating(true);
        try {
            const options: { expiresAt?: Date; usageLimit?: number } = {};

            if (expiresIn) {
                const expiry = new Date();
                expiry.setHours(expiry.getHours() + expiresIn);
                options.expiresAt = expiry;
            }

            if (usageLimit) {
                options.usageLimit = usageLimit;
            }

            const newCode = await accessCodeService.createAccessCode(
                courseId,
                teacherId,
                options
            );

            setActiveCode(newCode);
            setExistingCodes([newCode, ...existingCodes]);
        } catch (err) {
            console.error('Failed to create code:', err);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeactivate = async (code: string) => {
        try {
            await accessCodeService.deactivateCode(code);
            setExistingCodes(existingCodes.filter(c => c.code !== code));
            if (activeCode?.code === code) {
                setActiveCode(existingCodes.find(c => c.code !== code) || null);
            }
        } catch (err) {
            console.error('Failed to deactivate code:', err);
        }
    };

    const handleCopy = useCallback(async () => {
        if (!activeCode) return;
        try {
            await navigator.clipboard.writeText(activeCode.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, [activeCode]);

    const handleShare = useCallback(async () => {
        if (!activeCode) return;
        const shareText = `הצטרפו לפעילות "${courseTitle}"\nקוד גישה: ${formatCode(activeCode.code)}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: courseTitle,
                    text: shareText
                });
            } catch (err) {
                // User cancelled
            }
        } else {
            await navigator.clipboard.writeText(shareText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [activeCode, courseTitle]);

    if (!isOpen) return null;

    const formatExpiryTime = (date: Date) => {
        const now = new Date();
        const diff = date.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (diff < 0) return 'פג תוקף';
        if (hours > 24) return `${Math.floor(hours / 24)} ימים`;
        if (hours > 0) return `${hours} שעות`;
        return `${minutes} דקות`;
    };

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
                <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-violet-50 to-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <IconKey className="w-5 h-5 text-violet-500" />
                                קוד גישה לפעילות
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {courseTitle}
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
                <div className="p-5">
                    {isLoading ? (
                        <div className="text-center py-8">
                            <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto" />
                            <p className="text-sm text-slate-500 mt-3">טוען...</p>
                        </div>
                    ) : activeCode ? (
                        <div className="space-y-5">
                            {/* Active Code Display */}
                            <div className="bg-violet-50 rounded-2xl p-6 text-center">
                                <div className="text-sm text-violet-600 font-medium mb-2">
                                    קוד הגישה שלך
                                </div>
                                <div className="text-4xl font-black text-violet-700 tracking-widest font-mono">
                                    {formatCode(activeCode.code)}
                                </div>

                                {/* Code info */}
                                <div className="flex items-center justify-center gap-4 mt-4 text-xs text-violet-600">
                                    {activeCode.expiresAt && (
                                        <span className="flex items-center gap-1">
                                            <IconClock className="w-4 h-4" />
                                            {formatExpiryTime(activeCode.expiresAt)}
                                        </span>
                                    )}
                                    {activeCode.usageLimit && (
                                        <span className="flex items-center gap-1">
                                            <IconUsers className="w-4 h-4" />
                                            {activeCode.usedCount}/{activeCode.usageLimit}
                                        </span>
                                    )}
                                    {!activeCode.expiresAt && !activeCode.usageLimit && (
                                        <span>ללא הגבלה</span>
                                    )}
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleCopy}
                                    className={`
                                        flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all
                                        ${copied
                                            ? 'bg-green-500 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }
                                    `}
                                >
                                    {copied ? (
                                        <>
                                            <IconCheck className="w-5 h-5" />
                                            הועתק!
                                        </>
                                    ) : (
                                        <>
                                            <IconCopy className="w-5 h-5" />
                                            העתק קוד
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={handleShare}
                                    className="flex items-center justify-center gap-2 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition-colors"
                                >
                                    <IconShare className="w-5 h-5" />
                                    שתף
                                </button>
                            </div>

                            {/* Generate new code */}
                            <div className="pt-4 border-t border-slate-100">
                                <button
                                    onClick={() => setActiveCode(null)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 text-slate-500 hover:text-slate-700 text-sm transition-colors"
                                >
                                    <IconRefresh className="w-4 h-4" />
                                    צור קוד חדש
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* Create new code form */}
                            <div className="text-center py-4">
                                <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <IconKey className="w-8 h-8 text-violet-600" />
                                </div>
                                <h4 className="font-bold text-slate-800">צור קוד גישה חדש</h4>
                                <p className="text-sm text-slate-500 mt-1">
                                    תלמידים יוכלו להצטרף לפעילות באמצעות הקוד
                                </p>
                            </div>

                            {/* Options */}
                            <div className="space-y-4">
                                {/* Expiry */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        תוקף הקוד
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { value: null, label: 'ללא הגבלה' },
                                            { value: 1, label: 'שעה אחת' },
                                            { value: 24, label: 'יום אחד' },
                                            { value: 168, label: 'שבוע' }
                                        ].map((opt) => (
                                            <button
                                                key={opt.label}
                                                onClick={() => setExpiresIn(opt.value)}
                                                className={`
                                                    px-4 py-2 rounded-xl text-sm font-medium transition-all
                                                    ${expiresIn === opt.value
                                                        ? 'bg-violet-600 text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    }
                                                `}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Usage limit */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        מגבלת שימושים
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { value: null, label: 'ללא הגבלה' },
                                            { value: 10, label: '10 תלמידים' },
                                            { value: 30, label: '30 תלמידים' },
                                            { value: 50, label: '50 תלמידים' }
                                        ].map((opt) => (
                                            <button
                                                key={opt.label}
                                                onClick={() => setUsageLimit(opt.value)}
                                                className={`
                                                    px-4 py-2 rounded-xl text-sm font-medium transition-all
                                                    ${usageLimit === opt.value
                                                        ? 'bg-violet-600 text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    }
                                                `}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Create button */}
                            <button
                                onClick={handleCreateCode}
                                disabled={isCreating}
                                className={`
                                    w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-lg transition-all
                                    ${isCreating
                                        ? 'bg-slate-200 text-slate-400 cursor-wait'
                                        : 'bg-violet-600 text-white hover:bg-violet-700 shadow-lg hover:shadow-xl'
                                    }
                                `}
                            >
                                {isCreating ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        יוצר קוד...
                                    </>
                                ) : (
                                    <>
                                        <IconKey className="w-5 h-5" />
                                        צור קוד גישה
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Existing codes list */}
                    {existingCodes.length > 1 && activeCode && (
                        <div className="mt-5 pt-5 border-t border-slate-100">
                            <h4 className="text-sm font-bold text-slate-700 mb-3">קודים קיימים</h4>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                                {existingCodes.filter(c => c.code !== activeCode.code).map((code) => (
                                    <div
                                        key={code.code}
                                        className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                                    >
                                        <div>
                                            <span className="font-mono font-bold text-slate-700">
                                                {formatCode(code.code)}
                                            </span>
                                            <span className="text-xs text-slate-500 mr-2">
                                                ({code.usedCount} שימושים)
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setActiveCode(code)}
                                                className="text-xs text-violet-600 hover:underline"
                                            >
                                                השתמש
                                            </button>
                                            <button
                                                onClick={() => handleDeactivate(code.code)}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <IconTrash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Compact access code display for cards
interface AccessCodeBadgeProps {
    code: string;
    onClick?: () => void;
}

export const AccessCodeBadge: React.FC<AccessCodeBadgeProps> = ({
    code,
    onClick
}) => {
    const [copied, setCopied] = useState(false);

    const handleClick = async () => {
        if (onClick) {
            onClick();
        } else {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    };

    return (
        <button
            onClick={handleClick}
            className={`
                inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono font-bold transition-all
                ${copied
                    ? 'bg-green-100 text-green-700'
                    : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                }
            `}
        >
            <IconKey className="w-4 h-4" />
            {formatCode(code)}
            {copied && <IconCheck className="w-4 h-4" />}
        </button>
    );
};

// Student join form
interface JoinWithCodeFormProps {
    onJoin: (code: string) => Promise<void>;
}

export const JoinWithCodeForm: React.FC<JoinWithCodeFormProps> = ({ onJoin }) => {
    const [code, setCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanCode = code.replace(/[\s-]/g, '');
        if (cleanCode.length !== 8) {
            setError('הקוד חייב להכיל 8 ספרות');
            return;
        }

        setIsJoining(true);
        setError(null);

        try {
            await onJoin(cleanCode);
        } catch (err) {
            setError('קוד לא תקין או פג תוקף');
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                    קוד גישה
                </label>
                <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                        // Auto-format with dash
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val.length <= 8) {
                            setCode(val.length > 4 ? `${val.slice(0, 4)}-${val.slice(4)}` : val);
                        }
                    }}
                    placeholder="1234-5678"
                    className="w-full px-4 py-3 text-2xl font-mono font-bold text-center border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none"
                    maxLength={9}
                />
            </div>

            {error && (
                <div className="text-sm text-red-600 text-center">{error}</div>
            )}

            <button
                type="submit"
                disabled={isJoining || code.replace(/[\s-]/g, '').length !== 8}
                className={`
                    w-full py-3 rounded-xl font-bold text-lg transition-all
                    ${isJoining || code.replace(/[\s-]/g, '').length !== 8
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-violet-600 text-white hover:bg-violet-700'
                    }
                `}
            >
                {isJoining ? 'מצטרף...' : 'הצטרף לפעילות'}
            </button>
        </form>
    );
};

export default AccessCodeModal;
