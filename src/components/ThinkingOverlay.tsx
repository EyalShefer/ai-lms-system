import React, { useState, useEffect } from 'react';
import { IconSparkles } from '../icons';

const ThinkingOverlay: React.FC = () => {
    const [textIndex, setTextIndex] = useState(0);

    const messages = [
        "מנתח את התשובה...",
        "מזהה פער בהבנה...",
        "בונה הסבר מותאם אישית...",
        "מכין את השלב הבא..."
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setTextIndex((prev) => (prev + 1) % messages.length);
        }, 1800);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
            {/* Pulsing Brain/Chip Effect */}
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping"></div>
                <div className="absolute inset-0 bg-indigo-500 rounded-full opacity-20 animate-ping delay-75" style={{ animationDuration: '2s' }}></div>

                <div className="relative w-32 h-32 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center shadow-2xl border-4 border-blue-400/30">
                    <IconSparkles className="w-16 h-16 text-white animate-pulse" />
                </div>
            </div>

            {/* Cycling Text */}
            <div className="h-12 flex items-center justify-center overflow-hidden">
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-wide animate-pulse key-enter-active">
                    {messages[textIndex]}
                </h2>
            </div>

            {/* Progress Bar (Fake) */}
            <div className="w-64 h-1 bg-white/10 rounded-full mt-8 overflow-hidden">
                <div className="h-full bg-blue-400 animate-progress-indeterminate origin-right"></div>
            </div>
        </div>
    );
};

export default ThinkingOverlay;
