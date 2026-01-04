import React, { useState, useEffect, useRef } from 'react';
import type { DialogueScript, DialogueLine } from '../types/gemini.types';
import { ElevenLabsService } from '../services/elevenLabs';
import { IconHeadphones, IconLoader } from '../icons';

interface PodcastPlayerProps {
    script: DialogueScript;
    initialAudioUrl?: string | null;
    title?: string;
    onAudioGenerated?: (url: string) => void;
}

export const PodcastPlayer: React.FC<PodcastPlayerProps> = ({ script, initialAudioUrl, title, onAudioGenerated }) => {
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioCache, setAudioCache] = useState<Record<number, string>>(
        initialAudioUrl ? { 0: initialAudioUrl } : {}
    );
    const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Auto-play next track when ended
    const handleEnded = () => {
        if (currentIndex < script.lines.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setIsPlaying(false);
            setCurrentIndex(0); // Reset or stay at end?
        }
    };

    // Effect to handle track changes
    useEffect(() => {
        if (!isPlaying) return;

        const playCurrentLine = async () => {
            const line = script.lines[currentIndex];

            // Check cache first
            if (audioCache[currentIndex]) {
                if (audioRef.current) {
                    audioRef.current.src = audioCache[currentIndex];
                    audioRef.current.play();
                }
                return;
            }

            // Generate
            setLoadingIndex(currentIndex);
            const url = await ElevenLabsService.generateAudioSegment(line);
            setLoadingIndex(null);

            if (url) {
                setAudioCache(prev => ({ ...prev, [currentIndex]: url }));
                if (onAudioGenerated) onAudioGenerated(url); // Notify parent (e.g., to save)
                if (audioRef.current) {
                    audioRef.current.src = url;
                    audioRef.current.play();
                }
            } else {
                // If failed, skip? Or stop?
                console.error("Failed to generate audio for line", currentIndex);
                setIsPlaying(false);
            }
        };

        playCurrentLine();
    }, [currentIndex, isPlaying]); // Trigger when index changes while playing

    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
        } else {
            setIsPlaying(true);
        }
    };

    if (!ElevenLabsService.isConfigured()) {
        return (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center text-sm border border-red-200">
                חסר מפתח API של ElevenLabs. אנא הגדר את `VITE_ELEVENLABS_API_KEY`.
            </div>
        );
    }

    const currentLine = script.lines[currentIndex];

    return (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl p-6 shadow-2xl max-w-md mx-auto my-6 border border-gray-700">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6 border-b border-gray-700 pb-4">
                <div className="bg-purple-500/20 p-3 rounded-full">
                    <IconHeadphones className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                    <h3 className="font-bold text-lg">{title || script.title || "Audio Overview"}</h3>
                    <p className="text-xs text-gray-400 uppercase tracking-widest">NotebookLM Deep Dive</p>
                </div>
            </div>

            {/* Visualizer / Speakers */}
            <div className="flex justify-between items-end h-32 mb-8 px-4 relative">
                {/* Dan */}
                <div className={`transition-all duration-500 flex flex-col items-center gap-2 ${currentLine.speaker === 'Dan' ? 'opacity-100 scale-110' : 'opacity-40 scale-90 grayscale'}`}>
                    <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-2xl shadow-lg shadow-blue-500/50">👨🏻‍🏫</div>
                    <span className="text-xs font-bold text-blue-300">דן</span>
                </div>

                {/* Animation Bars (Simulated) */}
                <div className="flex gap-1 items-end h-16 opacity-80 pb-4">
                    {isPlaying && !loadingIndex && (
                        <>
                            <div className="w-1 bg-purple-500 animate-[bounce_1s_infinite] h-8"></div>
                            <div className="w-1 bg-purple-500 animate-[bounce_1.2s_infinite] h-12"></div>
                            <div className="w-1 bg-purple-500 animate-[bounce_0.8s_infinite] h-6"></div>
                            <div className="w-1 bg-purple-500 animate-[bounce_1.5s_infinite] h-10"></div>
                        </>
                    )}
                </div>

                {/* Noa */}
                <div className={`transition-all duration-500 flex flex-col items-center gap-2 ${currentLine.speaker === 'Noa' ? 'opacity-100 scale-110' : 'opacity-40 scale-90 grayscale'}`}>
                    <div className="w-16 h-16 rounded-full bg-pink-500 flex items-center justify-center text-2xl shadow-lg shadow-pink-500/50">👩🏻‍💻</div>
                    <span className="text-xs font-bold text-pink-300">נועה</span>
                </div>
            </div>

            {/* Subtitles */}
            <div className="bg-black/30 rounded-xl p-4 min-h-[80px] text-center mb-6 relative border border-white/5">
                {loadingIndex === currentIndex ? (
                    <div className="flex justify-center items-center gap-2 text-gray-400 text-sm h-full">
                        <IconLoader className="animate-spin w-4 h-4" /> טוען אודיו...
                    </div>
                ) : (
                    <p className="text-sm md:text-base font-light leading-relaxed direction-rtl">
                        "{currentLine.text}"
                    </p>
                )}
            </div>

            {/* Controls */}
            <div className="flex justify-center">
                <button
                    onClick={togglePlay}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all bg-white text-black hover:scale-105 active:scale-95 shadow-xl ${isPlaying ? 'bg-purple-400' : ''}`}
                >
                    {isPlaying ? (
                        <div className="w-4 h-4 bg-black rounded-sm"></div> // Pause
                    ) : (
                        <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-black border-b-[8px] border-b-transparent ml-1"></div> // Play
                    )}
                </button>
            </div>

            <p className="text-center text-[10px] text-gray-500 mt-4">
                Powered by ElevenLabs & Gemini 1.5 Pro • Auto-detects Hebrew/English
            </p>

            {/* Hidden Audio Element */}
            <audio ref={audioRef} onEnded={handleEnded} className="hidden" />
        </div>
    );
};
