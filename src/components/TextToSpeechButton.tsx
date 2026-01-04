import React, { useState, useEffect } from 'react';
import { IconPlayerPlay, IconPlayerPause, IconPlayerStop } from '../icons';
import { ttsService } from '../services/textToSpeechService';

interface TextToSpeechButtonProps {
    text: string;
    label?: string;
    className?: string;
    compact?: boolean; // Smaller button style
}

/**
 * Reusable Text-to-Speech Button Component
 *
 * Provides play/pause/stop controls for reading text aloud using Web Speech API
 */
export const TextToSpeechButton: React.FC<TextToSpeechButtonProps> = ({
    text,
    label = 'הקרא',
    className = '',
    compact = false
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    // Check if TTS is supported
    const isSupported = ttsService.isSupported();

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (isPlaying || isPaused) {
                ttsService.stop();
            }
        };
    }, [isPlaying, isPaused]);

    const handlePlay = async () => {
        if (isPaused) {
            // Resume if paused
            ttsService.resume();
            setIsPaused(false);
            setIsPlaying(true);
        } else {
            // Start speaking
            setIsPlaying(true);
            setIsPaused(false);

            try {
                await ttsService.speakLessonScript(text, {
                    rate: 0.9, // Slightly slower for better comprehension
                    pitch: 1.0,
                    volume: 1.0
                });
                // Speech completed
                setIsPlaying(false);
            } catch (error) {
                console.error('TTS Error:', error);
                setIsPlaying(false);
                setIsPaused(false);
            }
        }
    };

    const handlePause = () => {
        ttsService.pause();
        setIsPaused(true);
        setIsPlaying(false);
    };

    const handleStop = () => {
        ttsService.stop();
        setIsPlaying(false);
        setIsPaused(false);
    };

    if (!isSupported) {
        return null; // Don't render if not supported
    }

    if (compact) {
        // Compact icon-only version
        return (
            <div className={`flex items-center gap-1 ${className}`}>
                {!isPlaying && !isPaused && (
                    <button
                        onClick={handlePlay}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="הקרא טקסט"
                    >
                        <IconPlayerPlay className="w-4 h-4" />
                    </button>
                )}

                {isPlaying && (
                    <>
                        <button
                            onClick={handlePause}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                            title="השהה"
                        >
                            <IconPlayerPause className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleStop}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="עצור"
                        >
                            <IconPlayerStop className="w-4 h-4" />
                        </button>
                    </>
                )}

                {isPaused && (
                    <>
                        <button
                            onClick={handlePlay}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                            title="המשך"
                        >
                            <IconPlayerPlay className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleStop}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="עצור"
                        >
                            <IconPlayerStop className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
        );
    }

    // Full button version with labels
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {!isPlaying && !isPaused && (
                <button
                    onClick={handlePlay}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold transition shadow-sm"
                >
                    <IconPlayerPlay className="w-4 h-4" />
                    <span>{label}</span>
                </button>
            )}

            {isPlaying && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePause}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-bold transition shadow-sm"
                    >
                        <IconPlayerPause className="w-4 h-4" />
                        <span>השהה</span>
                    </button>
                    <button
                        onClick={handleStop}
                        className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold transition shadow-sm"
                    >
                        <IconPlayerStop className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1 text-blue-600 text-sm animate-pulse">
                        <div className="w-1 h-4 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1 h-4 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1 h-4 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                </div>
            )}

            {isPaused && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePlay}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold transition shadow-sm"
                    >
                        <IconPlayerPlay className="w-4 h-4" />
                        <span>המשך</span>
                    </button>
                    <button
                        onClick={handleStop}
                        className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold transition shadow-sm"
                    >
                        <IconPlayerStop className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-amber-600 font-bold">מושהה</span>
                </div>
            )}
        </div>
    );
};
