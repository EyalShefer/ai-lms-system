import React from 'react';
import { IconTrophy, IconStar, IconDiamond, IconRotateClockwise, IconArrowLeft } from '@tabler/icons-react';

interface SuccessModalProps {
    onContinue: () => void;
    onReview?: () => void;
    xpGained?: number;
    gemsGained?: number;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
    onContinue,
    onReview,
    xpGained = 50,
    gemsGained = 2
}) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop with Blur */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"></div>

            {/* Modal Card */}
            <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-8 flex flex-col items-center text-center animate-in zoom-in-90 slide-in-from-bottom-10 duration-500 overflow-hidden">

                {/* Background Confetti/Rays Effect (CSS only) */}
                <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-blue-50 to-transparent -z-10"></div>

                {/* 3D Icon Container */}
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-blue-400 blur-2xl opacity-20 animate-pulse"></div>
                    <div className="relative transform hover:scale-110 transition-transform duration-500">
                        <IconTrophy
                            size={80}
                            className="text-yellow-400 drop-shadow-[0_10px_10px_rgba(0,0,0,0.2)]"
                            stroke={1.5}
                            fill="#FACC15"
                        />
                        {/* Floating Stars */}
                        <IconStar className="absolute -top-2 -right-4 text-yellow-300 w-8 h-8 animate-bounce delay-100 drop-shadow-sm" fill="currentColor" />
                        <IconStar className="absolute top-10 -left-6 text-yellow-300 w-6 h-6 animate-bounce delay-300 drop-shadow-sm" fill="currentColor" />
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">
                    סיימתם את היחידה!
                </h2>
                <p className="text-slate-500 font-medium mb-8">
                    כל הכבוד! עשיתם צעד ענק קדימה.
                </p>

                {/* Stats Container */}
                <div className="flex items-center justify-center gap-4 w-full mb-8">
                    {/* XP Badge */}
                    <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-100 px-4 py-2 rounded-2xl w-full justify-center shadow-sm">
                        <IconStar className="text-yellow-500 w-6 h-6" fill="currentColor" />
                        <span className="font-black text-slate-700 text-lg">+{xpGained} XP</span>
                    </div>

                    {/* Gems Badge */}
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-4 py-2 rounded-2xl w-full justify-center shadow-sm">
                        <IconDiamond className="text-blue-500 w-6 h-6" fill="currentColor" />
                        <span className="font-black text-slate-700 text-lg">+{gemsGained}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 w-full">
                    <button
                        onClick={onContinue}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xl shadow-lg shadow-blue-200 transform transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <span>המשיכו</span>
                        <IconArrowLeft size={24} />
                    </button>

                    {onReview && (
                        <button
                            onClick={onReview}
                            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <IconRotateClockwise size={20} />
                            <span>חזרה על החומר</span>
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default SuccessModal;
