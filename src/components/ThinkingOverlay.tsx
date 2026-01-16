import React, { useState, useEffect } from 'react';
import { IconSparkles } from '../icons';

interface ThinkingOverlayProps {
    /** Optional custom messages for the typewriter effect */
    customMessages?: string[];
}

const DEFAULT_MESSAGES = [
    "מנתח את התשובה...",
    "מזהה פער בהבנה...",
    "בונה הסבר מותאם אישית...",
    "מכין את השלב הבא..."
];

const ThinkingOverlay: React.FC<ThinkingOverlayProps> = ({ customMessages }) => {
    const messages = customMessages || DEFAULT_MESSAGES;
    const [displayedText, setDisplayedText] = useState('');
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
    const [isTyping, setIsTyping] = useState(true);
    const [showCursor, setShowCursor] = useState(true);

    // Cursor blink effect
    useEffect(() => {
        const cursorInterval = setInterval(() => {
            setShowCursor(prev => !prev);
        }, 530);
        return () => clearInterval(cursorInterval);
    }, []);

    // Typewriter effect
    useEffect(() => {
        const currentMessage = messages[currentMessageIndex];
        let timeout: NodeJS.Timeout;

        if (isTyping) {
            // Typing phase
            if (displayedText.length < currentMessage.length) {
                timeout = setTimeout(() => {
                    setDisplayedText(currentMessage.slice(0, displayedText.length + 1));
                }, 50); // typing speed
            } else {
                // Finished typing, pause before erasing
                timeout = setTimeout(() => {
                    setIsTyping(false);
                }, 1500); // pause duration
            }
        } else {
            // Erasing phase
            if (displayedText.length > 0) {
                timeout = setTimeout(() => {
                    setDisplayedText(displayedText.slice(0, -1));
                }, 30); // erasing speed
            } else {
                // Finished erasing, move to next message
                setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
                setIsTyping(true);
            }
        }

        return () => clearTimeout(timeout);
    }, [displayedText, isTyping, currentMessageIndex, messages]);

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

            {/* Typewriter Text */}
            <div className="h-12 flex items-center justify-center overflow-hidden" dir="rtl">
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-wide">
                    {displayedText}
                    <span
                        className={`inline-block w-1 h-8 bg-white mr-1 align-middle transition-opacity duration-100 ${
                            showCursor ? 'opacity-100' : 'opacity-0'
                        }`}
                    />
                </h2>
            </div>

            {/* Progress Bar (Animated) */}
            <div className="w-64 h-1 bg-white/10 rounded-full mt-8 overflow-hidden">
                <div className="h-full bg-blue-400 animate-progress-indeterminate origin-right"></div>
            </div>
        </div>
    );
};

export default ThinkingOverlay;
