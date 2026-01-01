import React, { useState } from 'react';
import { IconCheck, IconX, IconSparkles, IconBrain, IconBook, IconTrophy } from '../icons';

interface PersonalityVerificationWidgetProps {
    inferredTraits: string[];
    onConfirm: (traits: string[]) => void;
    onDismiss: () => void;
}

export const PersonalityVerificationWidget: React.FC<PersonalityVerificationWidgetProps> = ({ inferredTraits, onConfirm, onDismiss }) => {
    const [traits, setTraits] = useState(inferredTraits.map(t => ({ id: t, label: t, status: 'pending' as 'pending' | 'confirmed' | 'rejected' })));
    const [step, setStep] = useState(0);

    const currentTrait = traits[step];

    const handleVote = (vote: 'like' | 'dislike') => {
        const newTraits = [...traits];
        newTraits[step].status = vote === 'like' ? 'confirmed' : 'rejected';
        setTraits(newTraits);

        if (step < traits.length - 1) {
            setStep(step + 1);
        } else {
            // Finished
            const confirmed = newTraits.filter(t => t.status === 'confirmed').map(t => t.label);
            onConfirm(confirmed);
        }
    };

    if (!currentTrait) return null;

    const getIconForTrait = (trait: string) => {
        if (trait.includes('Visual')) return <IconSparkles className="w-12 h-12 text-purple-500" />;
        if (trait.includes('Deep')) return <IconBrain className="w-12 h-12 text-blue-500" />;
        if (trait.includes('Speed')) return <IconTrophy className="w-12 h-12 text-yellow-500" />;
        if (trait.includes('Competitive')) return <IconTrophy className="w-12 h-12 text-orange-500" />;
        return <IconBook className="w-12 h-12 text-indigo-500" />;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 relative">

                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-500 to-purple-600"></div>

                <button onClick={onDismiss} className="absolute top-4 left-4 text-white/80 hover:text-white transition-colors bg-white/20 p-2 rounded-full backdrop-blur-md">
                    <IconX className="w-5 h-5" />
                </button>

                <div className="relative pt-12 px-8 pb-8 text-center">
                    <div className="mb-6 flex justify-center">
                        <div className="w-24 h-24 bg-white rounded-full shadow-lg flex items-center justify-center border-4 border-white">
                            {getIconForTrait(currentTrait.label)}
                        </div>
                    </div>

                    <h2 className="text-2xl font-black text-slate-800 mb-2">גילינו עליך משהו...</h2>
                    <p className="text-slate-500 mb-8 max-w-xs mx-auto">
                        האם נכון לומר שסגנון הלמידה שלך הוא:
                        <br />
                        <span className="font-bold text-indigo-600 text-lg block mt-2">{currentTrait.label}?</span>
                    </p>

                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={() => handleVote('dislike')}
                            className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all transform hover:scale-105"
                        >
                            <IconX className="w-8 h-8" />
                        </button>

                        <button
                            onClick={() => handleVote('like')}
                            className="w-16 h-16 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-200 transition-all transform hover:scale-105 active:scale-95"
                        >
                            <IconCheck className="w-8 h-8" />
                        </button>
                    </div>

                    <div className="mt-8 flex justify-center gap-1">
                        {traits.map((t, idx) => (
                            <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${idx === step ? 'w-8 bg-indigo-500' : idx < step ? 'w-4 bg-indigo-200' : 'w-2 bg-slate-100'}`}></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
