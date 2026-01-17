import React, { useState, useEffect, useRef } from 'react';
import type { ActivityBlock, TelemetryData, ImageLabelingContent } from '../../shared/types/courseTypes';
import { IconCheck, IconX } from '../../icons';
import { calculateQuestionScore } from '../../utils/scoring';

interface ImageLabelingQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number, telemetry?: TelemetryData) => void;
    isExamMode?: boolean;
    hints?: string[];
    onHintUsed?: () => void;
}

interface PlacedLabel {
    labelId: string;
    zoneId: string;
}

const ImageLabelingQuestion: React.FC<ImageLabelingQuestionProps> = ({
    block,
    onComplete,
    isExamMode = false,
    hints = [],
    onHintUsed
}) => {
    const startTimeRef = useRef<number>(Date.now());
    const attemptsRef = useRef<number>(0);
    const hintsUsedRef = useRef<number>(0);
    const imageRef = useRef<HTMLDivElement>(null);

    const content = block.content as ImageLabelingContent;
    const { instruction, imageUrl, labels, dropZones } = content;

    const [availableLabels, setAvailableLabels] = useState<typeof labels>([]);
    const [placedLabels, setPlacedLabels] = useState<PlacedLabel[]>([]);
    const [draggedLabel, setDraggedLabel] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [results, setResults] = useState<Record<string, boolean>>({});
    const [currentHintLevel, setCurrentHintLevel] = useState(0);
    const [hasAttempted, setHasAttempted] = useState(false);

    useEffect(() => {
        startTimeRef.current = Date.now();
        attemptsRef.current = 0;
        setAvailableLabels([...labels]);
        setPlacedLabels([]);
        setIsSubmitted(false);
        setResults({});
    }, [labels]);

    const handleDragStart = (labelId: string) => {
        if (isSubmitted) return;
        setDraggedLabel(labelId);
    };

    const handleDragEnd = () => {
        setDraggedLabel(null);
    };

    const handleDrop = (zoneId: string) => {
        if (isSubmitted || !draggedLabel) return;

        // Remove label from previous zone if exists
        const existingPlacement = placedLabels.find(p => p.labelId === draggedLabel);

        // Remove any label already in this zone
        const labelInZone = placedLabels.find(p => p.zoneId === zoneId);

        let newPlaced = placedLabels.filter(
            p => p.labelId !== draggedLabel && p.zoneId !== zoneId
        );

        // If the dropped label was in available, remove it
        if (!existingPlacement) {
            setAvailableLabels(availableLabels.filter(l => l.id !== draggedLabel));
        }

        // If there was a label in this zone, return it to available
        if (labelInZone) {
            const returnedLabel = labels.find(l => l.id === labelInZone.labelId);
            if (returnedLabel && !availableLabels.find(l => l.id === returnedLabel.id)) {
                setAvailableLabels(prev => [...prev, returnedLabel]);
            }
        }

        newPlaced.push({ labelId: draggedLabel, zoneId });
        setPlacedLabels(newPlaced);
        setDraggedLabel(null);
    };

    const handleLabelClick = (labelId: string, fromZone?: string) => {
        if (isSubmitted) return;

        if (fromZone) {
            // Return to available
            setPlacedLabels(placedLabels.filter(p => p.labelId !== labelId));
            const label = labels.find(l => l.id === labelId);
            if (label) {
                setAvailableLabels(prev => [...prev, label]);
            }
        }
    };

    const checkAnswers = () => {
        setIsSubmitted(true);
        setHasAttempted(true);
        attemptsRef.current += 1;

        const newResults: Record<string, boolean> = {};
        let correctCount = 0;

        placedLabels.forEach(placed => {
            const zone = dropZones.find(z => z.id === placed.zoneId);
            const isCorrect = zone?.correctLabelId === placed.labelId;
            newResults[placed.zoneId] = isCorrect;
            if (isCorrect) correctCount++;
        });

        setResults(newResults);

        const isAllCorrect = correctCount === dropZones.length && placedLabels.length === dropZones.length;

        const score = calculateQuestionScore({
            isCorrect: isAllCorrect,
            attempts: attemptsRef.current,
            hintsUsed: hintsUsedRef.current,
            responseTimeSec: (Date.now() - startTimeRef.current) / 1000
        });

        if (onComplete) {
            onComplete(score, {
                timeSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
                attempts: attemptsRef.current,
                hintsUsed: hintsUsedRef.current,
                lastAnswer: placedLabels
            });
        }
    };

    const handleShowHint = () => {
        if (currentHintLevel < hints.length) {
            setCurrentHintLevel(prev => prev + 1);
            hintsUsedRef.current += 1;
            onHintUsed?.();
        }
    };

    const resetQuestion = () => {
        setIsSubmitted(false);
        setAvailableLabels([...labels]);
        setPlacedLabels([]);
        setResults({});
    };

    const getLabelInZone = (zoneId: string) => {
        const placed = placedLabels.find(p => p.zoneId === zoneId);
        if (!placed) return null;
        return labels.find(l => l.id === placed.labelId);
    };

    return (
        <div className="w-full mx-auto">
            <h3 className="text-3xl font-black mb-4 text-white text-center drop-shadow-sm">תיוג תמונה</h3>
            <p className="text-lg text-white/90 mb-8 text-center font-medium">{instruction}</p>

            {/* Image with Drop Zones */}
            <div
                ref={imageRef}
                className="relative bg-white rounded-2xl overflow-hidden shadow-lg mb-6"
                style={{ aspectRatio: '16/10' }}
            >
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt="תמונה לתיוג"
                        className="w-full h-full object-contain"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <span className="text-gray-400 text-lg">תמונה לתיוג</span>
                    </div>
                )}

                {/* Drop Zones */}
                {dropZones.map((zone) => {
                    const labelInZone = getLabelInZone(zone.id);
                    const isCorrect = results[zone.id];

                    return (
                        <div
                            key={zone.id}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop(zone.id)}
                            className={`absolute flex items-center justify-center transition-all
                                ${!labelInZone && !isSubmitted
                                    ? 'border-2 border-dashed border-blue-400 bg-blue-100/50 hover:bg-blue-200/50'
                                    : ''
                                }
                                ${labelInZone && !isSubmitted
                                    ? 'border-2 border-solid border-blue-500 bg-blue-100'
                                    : ''
                                }
                                ${isSubmitted && isCorrect
                                    ? 'border-2 border-green-500 bg-green-100'
                                    : ''
                                }
                                ${isSubmitted && isCorrect === false
                                    ? 'border-2 border-red-500 bg-red-100'
                                    : ''
                                }
                                ${isSubmitted && isCorrect === undefined
                                    ? 'border-2 border-dashed border-yellow-500 bg-yellow-100'
                                    : ''
                                }
                            `}
                            style={{
                                left: `${zone.x}%`,
                                top: `${zone.y}%`,
                                width: zone.width ? `${zone.width}%` : '15%',
                                height: zone.height ? `${zone.height}%` : '10%',
                                borderRadius: '8px',
                                transform: 'translate(-50%, -50%)'
                            }}
                        >
                            {labelInZone ? (
                                <button
                                    onClick={() => handleLabelClick(labelInZone.id, zone.id)}
                                    disabled={isSubmitted}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all
                                        ${isSubmitted
                                            ? isCorrect
                                                ? 'bg-green-500 text-white'
                                                : 'bg-red-500 text-white'
                                            : 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer'
                                        }
                                    `}
                                >
                                    {labelInZone.text}
                                    {isSubmitted && isCorrect && <IconCheck className="w-4 h-4 inline ml-1" />}
                                    {isSubmitted && !isCorrect && <IconX className="w-4 h-4 inline ml-1" />}
                                </button>
                            ) : (
                                <span className="text-blue-400 text-xs">גרור לכאן</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Available Labels */}
            <div className="bg-white/10 rounded-2xl p-6 mb-6">
                <p className="text-sm text-white/70 mb-3">תוויות זמינות:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                    {availableLabels.map((label) => (
                        <div
                            key={label.id}
                            draggable={!isSubmitted}
                            onDragStart={() => handleDragStart(label.id)}
                            onDragEnd={handleDragEnd}
                            className={`px-4 py-2 rounded-xl font-medium transition-all
                                ${isSubmitted
                                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                    : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-400 hover:shadow-md cursor-grab active:cursor-grabbing'
                                }
                            `}
                        >
                            {label.text}
                        </div>
                    ))}
                    {availableLabels.length === 0 && !isSubmitted && (
                        <span className="text-white/50 text-sm">כל התוויות הוצבו</span>
                    )}
                </div>
            </div>

            {/* Hints Section */}
            {!isExamMode && hints.length > 0 && !isSubmitted && (
                <div className="mb-6">
                    {currentHintLevel === 0 ? (
                        <div className="text-center">
                            <button
                                onClick={handleShowHint}
                                disabled={!hasAttempted}
                                className={`px-6 py-2 rounded-full font-medium transition-all ${
                                    hasAttempted
                                        ? 'bg-yellow-500 text-white hover:bg-yellow-600 shadow-md'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                {hasAttempted ? 'רמז' : 'רמז (זמין אחרי ניסיון ראשון)'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {hints.slice(0, currentHintLevel).map((hint, idx) => (
                                <div key={idx} className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">💡</span>
                                        <div>
                                            <div className="text-xs text-yellow-700 font-bold mb-1">רמז {idx + 1}</div>
                                            <div className="text-gray-700">{hint}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {currentHintLevel < hints.length && (
                                <div className="text-center">
                                    <button
                                        onClick={handleShowHint}
                                        className="px-6 py-2 rounded-full font-medium bg-yellow-500 text-white hover:bg-yellow-600"
                                    >
                                        רמז נוסף ({currentHintLevel}/{hints.length})
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Submit Button */}
            {!isSubmitted && (
                <div className="text-center">
                    <button
                        onClick={checkAnswers}
                        disabled={placedLabels.length === 0}
                        className={`px-8 py-3 rounded-full font-bold shadow-lg transition-transform active:scale-95
                            ${placedLabels.length > 0
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }
                        `}
                    >
                        בדיקה
                    </button>
                </div>
            )}

            {/* Results */}
            {isSubmitted && (
                <div className="mt-6 text-center animate-fade-in">
                    {Object.values(results).every(r => r) && placedLabels.length === dropZones.length ? (
                        <span className="text-green-400 flex items-center justify-center gap-2 text-lg font-bold">
                            <IconCheck className="w-6 h-6" /> כל הכבוד! כל התוויות במקום הנכון
                        </span>
                    ) : (
                        <div className="space-y-4">
                            <span className="text-red-400 flex items-center justify-center gap-2 text-lg font-bold">
                                <IconX className="w-6 h-6" /> יש תוויות שלא במקום
                            </span>
                            <button
                                onClick={resetQuestion}
                                className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700"
                            >
                                נסה שוב
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ImageLabelingQuestion;
