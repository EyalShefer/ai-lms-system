import React, { useState } from 'react';
import { IconX } from '../icons';
import { buyStreakFreeze } from '../services/gamificationService';
import { useAuth } from '../context/AuthContext';

// Fallback icon if IconSnowflake doesn't exist
const FreezeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M2 12h20M12 2v20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93" />
    </svg>
);

interface ShopModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentGems: number;
    frozenDays: number;
    onPurchaseComplete: (newGems: number) => void;
}

const ShopModal: React.FC<ShopModalProps> = ({ isOpen, onClose, currentGems, frozenDays, onPurchaseComplete }) => {
    const { currentUser } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    if (!isOpen) return null;

    const handleBuyFreeze = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        setMsg(null);

        const result = await buyStreakFreeze(currentUser.uid);

        setIsLoading(false);
        if (result.success) {
            setMsg({ type: 'success', text: result.message });
            if (result.newBalance !== undefined) {
                onPurchaseComplete(result.newBalance);
            }
        } else {
            setMsg({ type: 'error', text: result.message });
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Card */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" dir="rtl">

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-cyan-400 p-6 text-white text-center">
                    <h2 className="text-3xl font-black mb-2 drop-shadow-md">חנות היהלומים</h2>
                    <div className="flex items-center justify-center gap-2 bg-white/20 rounded-full py-1 px-4 w-fit mx-auto backdrop-blur-md">
                        <span className="text-2xl">💎</span>
                        <span className="text-xl font-bold">{currentGems}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
                    >
                        <IconX className="w-6 h-6 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">

                    {/* Item: Streak Freeze */}
                    <div className="flex items-center gap-4 p-4 border-2 border-slate-100 rounded-2xl hover:border-blue-100 transition-colors group">
                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <FreezeIcon className="w-8 h-8 text-cyan-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-slate-800">מקפיא רצף</h3>
                            <p className="text-sm text-slate-500 leading-tight">שומר על הרצף שלך גם אם לא תתרגל יום אחד.</p>
                            <div className="mt-2 text-xs font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-md w-fit">
                                יש לך: {frozenDays}
                            </div>
                        </div>
                        <button
                            onClick={handleBuyFreeze}
                            disabled={isLoading || currentGems < 50}
                            className={`flex flex-col items-center justify-center w-20 h-14 rounded-xl font-bold transition-all active:scale-95 border-b-4
                                ${currentGems >= 50
                                    ? 'bg-blue-500 hover:bg-blue-400 text-white border-blue-700 shadow-lg'
                                    : 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed'
                                }
                            `}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="text-lg leading-none">50</span>
                                    <span className="text-[10px] opacity-80">יהלומים</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Feedback Message */}
                    {msg && (
                        <div className={`p-3 rounded-xl text-center font-bold animate-in slide-in-from-bottom-2 ${msg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {msg.text}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default ShopModal;
