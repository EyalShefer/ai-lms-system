import React, { useState, useRef, useEffect } from 'react';
import type { AudioResponseBlock } from '../courseTypes';
import { uploadStudentAudio } from '../services/storageService';

interface AudioRecorderBlockProps {
    block: AudioResponseBlock;
    onAnswer: (url: string) => void;
    userAnswer?: string; // The URL if already answered
    isReadOnly?: boolean;
}

export const AudioRecorderBlock: React.FC<AudioRecorderBlockProps> = ({
    block,
    onAnswer,
    userAnswer,
    isReadOnly
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(userAnswer || null);
    const [isUploading, setIsUploading] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);
    const timerRef = useRef<number | null>(null);

    const MAX_DURATION = block.content.maxDuration || 60;

    useEffect(() => {
        // Clean up URL object on unmount
        return () => {
            if (previewUrl && !userAnswer && previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl, userAnswer]);

    const startRecording = async () => {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setPreviewUrl(url);
                stream.getTracks().forEach(track => track.stop()); // Stop mic
            };

            mediaRecorder.start();
            setIsRecording(true);
            setElapsedTime(0);

            // Timer
            timerRef.current = window.setInterval(() => {
                setElapsedTime(prev => {
                    if (prev >= MAX_DURATION) {
                        stopRecording();
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1000);

        } catch (err) {
            console.error("Mic Error:", err);
            setError("גישה למיקרופון נחסמה או לא זמינה.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    const handleReset = () => {
        setAudioBlob(null);
        setPreviewUrl(null);
        setError(null);
        setElapsedTime(0);
    };

    const handleUpload = async () => {
        if (!audioBlob) return;
        setIsUploading(true);
        setError(null);

        try {
            // Use 'guest' or actual ID depending on context (can be passed via props later)
            const userId = 'student_' + (Math.random() * 10000).toFixed(0);
            // Dummy logic for ID since we might not have auth context easily here. 
            // Real app should get userId from context.

            const url = await uploadStudentAudio(audioBlob, userId, 'assignment_context');
            onAnswer(url);
        } catch (err: any) {
            setError(err.message || "שגיאה בהעלאת הקובץ.");
        } finally {
            setIsUploading(false);
        }
    };

    // If read-only or already answered (and checking previous), just show player
    if (isReadOnly && userAnswer) {
        return (
            <div className="p-4 bg-gray-50 border rounded-lg">
                <h3 className="font-bold text-lg mb-2">{block.content.question}</h3>
                <p className="text-sm text-gray-600 mb-4">{block.content.description}</p>
                <div className="flex items-center gap-2">
                    <audio controls src={userAnswer} className="w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
            <h3 className="font-bold text-xl mb-2 text-gray-800">{block.content.question}</h3>
            {block.content.description && (
                <p className="text-gray-600 mb-4">{block.content.description}</p>
            )}

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <div className="flex flex-col items-center gap-4">
                {/* Timer Display */}
                {isRecording && (
                    <div className="text-red-600 font-mono text-xl animate-pulse">
                        {elapsedTime}s / {MAX_DURATION}s
                    </div>
                )}

                {/* Controls */}
                {!previewUrl ? (
                    !isRecording ? (
                        <button
                            onClick={startRecording}
                            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all transform hover:scale-105 shadow-md"
                        >
                            <span className="w-3 h-3 bg-white rounded-full animate-pulse" />
                            התחל הקלטה
                        </button>
                    ) : (
                        <button
                            onClick={stopRecording}
                            className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-full hover:bg-gray-900 transition-all shadow-md"
                        >
                            <span className="w-3 h-3 bg-red-500 rounded-sm" />
                            שמור הקלטה
                        </button>
                    )
                ) : (
                    <div className="w-full flex flex-col gap-4">
                        <audio controls src={previewUrl} className="w-full" />

                        {!userAnswer && (
                            <div className="flex justify-center gap-4">
                                <button
                                    onClick={handleReset}
                                    disabled={isUploading}
                                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    הקלט מחדש
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={isUploading}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                                >
                                    {isUploading ? 'מעלה...' : 'שלח תשובה'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
