/**
 * PresentationMode - Interactive presentation for smart board projection
 *
 * Shows content for classroom display:
 * - Hook: Curiosity image
 * - Direct Instruction: Board points (bullets)
 * - Summary: Infographic
 * - Interactive Questions: Fully functional components
 */

import React, { useState, useEffect, useCallback } from 'react';
import { IconX, IconArrowRight, IconArrowBack, IconMaximize } from '../icons';
import type { LearningUnit, ActivityBlock } from '../shared/types/courseTypes';

// Interactive Question Components
import MultipleChoiceQuestion from './MultipleChoiceQuestion';
import ClozeQuestion from './ClozeQuestion';
import OrderingQuestion from './OrderingQuestion';
import CategorizationQuestion from './CategorizationQuestion';
import MemoryGameQuestion from './MemoryGameQuestion';

interface PresentationSlide {
    id: string;
    type: 'hook' | 'instruction' | 'summary' | 'practice';
    title: string;
    content: React.ReactNode;
    blockData?: ActivityBlock; // Store original block for interactive rendering
}

interface PresentationModeProps {
    unit: LearningUnit;
    onClose: () => void;
}

const PresentationMode: React.FC<PresentationModeProps> = ({ unit, onClose }) => {
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Extract presentation slides from unit blocks
    const slides: PresentationSlide[] = React.useMemo(() => {
        const result: PresentationSlide[] = [];

        if (!unit.activityBlocks) return result;

        unit.activityBlocks.forEach((block: ActivityBlock) => {
            // Handle text blocks (Hook, Instruction, Summary)
            if (block.type === 'text' && typeof block.content === 'string') {
                const content = block.content;

                // Hook Section - Extract image only
                if (content.includes('lesson-section hook')) {
                    const imageMatch = content.match(/<img[^>]+src="([^"]+)"[^>]*>/);
                    if (imageMatch) {
                        result.push({
                            id: `hook-${block.id}`,
                            type: 'hook',
                            title: '🪝 פתיחה',
                            content: (
                                <div className="flex items-center justify-center h-full">
                                    <img
                                        src={imageMatch[1]}
                                        alt="Hook Visual"
                                        className="max-h-[70vh] max-w-full rounded-2xl shadow-2xl object-contain"
                                    />
                                </div>
                            )
                        });
                    }
                }

                // Direct Instruction - Extract board points
                if (content.includes('lesson-section instruction')) {
                    const titleMatch = content.match(/<h3[^>]*>.*?הוראה פרונטלית:\s*([^<]+)<\/h3>/);
                    const title = titleMatch ? titleMatch[1].trim() : 'הוראה פרונטלית';

                    const boardMatch = content.match(/<div class="board-points">([\s\S]*?)<\/div>/);
                    if (boardMatch) {
                        const listMatch = boardMatch[1].match(/<ul>([\s\S]*?)<\/ul>/);
                        if (listMatch) {
                            const bullets = listMatch[1].match(/<li>([^<]+)<\/li>/g);
                            if (bullets && bullets.length > 0) {
                                const bulletTexts = bullets.map(b => b.replace(/<\/?li>/g, ''));
                                result.push({
                                    id: `instruction-${block.id}`,
                                    type: 'instruction',
                                    title: `📝 ${title}`,
                                    content: (
                                        <div className="flex flex-col items-center justify-center h-full px-12">
                                            <ul className="text-right space-y-6 max-w-4xl">
                                                {bulletTexts.map((bullet, idx) => (
                                                    <li key={idx} className="flex items-start gap-4 text-3xl md:text-4xl leading-relaxed">
                                                        <span className="text-indigo-500 font-bold shrink-0">•</span>
                                                        <span>{bullet}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )
                                });
                            }
                        }
                    }
                }

                // Summary Section - Extract infographic
                if (content.includes('lesson-section summary')) {
                    const imageMatch = content.match(/<img[^>]+src="([^"]+)"[^>]*alt="Summary/);
                    if (imageMatch) {
                        result.push({
                            id: `summary-${block.id}`,
                            type: 'summary',
                            title: '📊 סיכום',
                            content: (
                                <div className="flex items-center justify-center h-full">
                                    <img
                                        src={imageMatch[1]}
                                        alt="Summary Infographic"
                                        className="max-h-[70vh] max-w-full rounded-2xl shadow-2xl object-contain"
                                    />
                                </div>
                            )
                        });
                    }
                }
            }

            // Handle interactive question blocks - store block data for rendering
            if (block.type === 'multiple-choice') {
                result.push({
                    id: `mc-${block.id}`,
                    type: 'practice',
                    title: '❓ שאלה אמריקאית',
                    content: null, // Will be rendered dynamically
                    blockData: block
                });
            }

            if (block.type === 'categorization') {
                result.push({
                    id: `cat-${block.id}`,
                    type: 'practice',
                    title: '📦 מיון לקטגוריות',
                    content: null,
                    blockData: block
                });
            }

            if (block.type === 'ordering') {
                result.push({
                    id: `order-${block.id}`,
                    type: 'practice',
                    title: '🔢 סידור רצף',
                    content: null,
                    blockData: block
                });
            }

            if (block.type === 'memory_game') {
                result.push({
                    id: `memory-${block.id}`,
                    type: 'practice',
                    title: '🧠 משחק זיכרון',
                    content: null,
                    blockData: block
                });
            }

            if (block.type === 'fill_in_blanks') {
                result.push({
                    id: `fill-${block.id}`,
                    type: 'practice',
                    title: '✏️ השלמת משפטים',
                    content: null,
                    blockData: block
                });
            }

            if (block.type === 'open-question') {
                const content = block.content as any;
                const question = content?.question || content?.text || '';
                result.push({
                    id: `open-${block.id}`,
                    type: 'practice',
                    title: '💭 שאלה פתוחה',
                    content: (
                        <div className="flex flex-col items-center justify-center h-full px-8">
                            <h2 className="text-3xl md:text-4xl font-bold text-center max-w-4xl leading-relaxed">{question}</h2>
                        </div>
                    )
                });
            }

            if (block.type === 'matching') {
                const content = block.content as any;
                const pairs = content?.pairs || [];
                result.push({
                    id: `match-${block.id}`,
                    type: 'practice',
                    title: '🔗 התאמה',
                    content: (
                        <div className="flex flex-col items-center justify-center h-full px-8">
                            <h2 className="text-3xl font-bold text-center mb-8">התאימו בין הצדדים</h2>
                            <div className="flex gap-12 max-w-4xl">
                                <div className="flex flex-col gap-4">
                                    {pairs.map((pair: any, idx: number) => (
                                        <div key={idx} className="bg-blue-500/30 backdrop-blur rounded-xl px-6 py-4 text-xl border border-blue-400/50">
                                            {pair?.left || pair?.item || ''}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-col gap-4">
                                    {pairs.map((pair: any, idx: number) => (
                                        <div key={idx} className="bg-green-500/30 backdrop-blur rounded-xl px-6 py-4 text-xl border border-green-400/50">
                                            {pair?.right || pair?.category || ''}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                });
            }
        });

        return result;
    }, [unit.activityBlocks]);

    // Keyboard navigation - Hebrew RTL: Left arrow = forward, Right arrow = back
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            // Right arrow = go back (RTL)
            setCurrentSlideIndex(prev => Math.max(0, prev - 1));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === ' ') {
            // Left arrow = go forward (RTL)
            setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1));
        } else if (e.key === 'f' || e.key === 'F') {
            toggleFullscreen();
        }
    }, [slides.length, onClose]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Prevent body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const currentSlide = slides[currentSlideIndex];
    const progress = slides.length > 0 ? ((currentSlideIndex + 1) / slides.length) * 100 : 0;

    // Render interactive question component
    const renderInteractiveBlock = (block: ActivityBlock) => {
        const content = block.content as any;
        const dummyHandler = () => {}; // No-op for presentation mode

        switch (block.type) {
            case 'multiple-choice':
                return (
                    <div className="presentation-question-wrapper max-w-4xl mx-auto p-8">
                        <MultipleChoiceQuestion
                            block={block}
                            onAnswer={dummyHandler}
                            disabled={false}
                        />
                    </div>
                );

            case 'categorization':
                return (
                    <div className="presentation-question-wrapper max-w-5xl mx-auto p-8">
                        <CategorizationQuestion
                            block={block}
                            onComplete={dummyHandler}
                        />
                    </div>
                );

            case 'ordering':
                return (
                    <div className="presentation-question-wrapper max-w-4xl mx-auto p-8">
                        <OrderingQuestion
                            block={block}
                            onComplete={dummyHandler}
                        />
                    </div>
                );

            case 'memory_game':
                return (
                    <div className="presentation-question-wrapper max-w-5xl mx-auto p-8">
                        <MemoryGameQuestion
                            block={block}
                            onComplete={dummyHandler}
                        />
                    </div>
                );

            case 'fill_in_blanks':
                return (
                    <div className="presentation-question-wrapper max-w-4xl mx-auto p-8">
                        <ClozeQuestion
                            block={block}
                            onComplete={dummyHandler}
                        />
                    </div>
                );

            default:
                return null;
        }
    };

    if (slides.length === 0) {
        return (
            <div className="fixed inset-0 z-[200] bg-gray-900 flex items-center justify-center" dir="rtl">
                <div className="text-center text-white">
                    <p className="text-2xl mb-4">אין תוכן להקרנה</p>
                    <p className="text-gray-400 mb-8">ודא שמערך השיעור כולל תמונות ואינפוגרפיקות</p>
                    <button
                        onClick={onClose}
                        className="bg-white text-gray-900 px-6 py-3 rounded-full font-bold hover:bg-gray-100"
                    >
                        סגור
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[200] bg-gradient-to-b from-gray-900 to-gray-800 flex flex-col" dir="rtl">
            {/* Presentation Mode Styles - Large display for smart board */}
            <style>{`
                .presentation-question-wrapper {
                    --tw-bg-opacity: 1;
                    transform: scale(1.3);
                    transform-origin: center center;
                }
                .presentation-question-wrapper > div {
                    background: rgba(255, 255, 255, 0.98) !important;
                    border-radius: 1.5rem;
                    padding: 2.5rem;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .presentation-question-wrapper .text-gray-800,
                .presentation-question-wrapper .text-gray-700,
                .presentation-question-wrapper .text-gray-600 {
                    color: #1f2937 !important;
                }
                .presentation-question-wrapper h2,
                .presentation-question-wrapper h3,
                .presentation-question-wrapper .text-xl {
                    font-size: 1.75rem !important;
                }
                .presentation-question-wrapper p,
                .presentation-question-wrapper span,
                .presentation-question-wrapper label {
                    font-size: 1.35rem !important;
                }
                .presentation-question-wrapper button {
                    font-size: 1.25rem !important;
                    padding: 1rem 1.5rem !important;
                }
                /* Memory game cards */
                .presentation-question-wrapper [class*="grid"] > div {
                    min-height: 100px !important;
                    font-size: 1.25rem !important;
                }
                /* Multiple choice options */
                .presentation-question-wrapper [class*="space-y"] > div,
                .presentation-question-wrapper [class*="gap"] > div {
                    padding: 1.25rem !important;
                }
            `}</style>

            {/* Top Bar */}
            <div className="flex-none h-16 flex items-center justify-between px-6 bg-black/30">
                {/* Title */}
                <div className="flex items-center gap-4">
                    <h2 className="text-white text-xl font-bold">{currentSlide?.title}</h2>
                    <span className="text-gray-400 text-sm">
                        {currentSlideIndex + 1} / {slides.length}
                    </span>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="מסך מלא (F)"
                    >
                        <IconMaximize className="w-5 h-5" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="סגור (ESC)"
                    >
                        <IconX className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="flex-none h-1 bg-gray-700">
                <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Slide Content */}
            <div className="flex-1 text-white overflow-y-auto">
                {currentSlide?.blockData
                    ? renderInteractiveBlock(currentSlide.blockData)
                    : currentSlide?.content
                }
            </div>

            {/* Navigation */}
            <div className="flex-none h-20 flex items-center justify-center gap-6 bg-black/30">
                <button
                    onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentSlideIndex === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-full text-white font-medium transition-colors"
                >
                    <IconArrowRight className="w-5 h-5" />
                    הקודם
                </button>

                {/* Slide indicators */}
                <div className="flex gap-2">
                    {slides.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentSlideIndex(idx)}
                            className={`w-3 h-3 rounded-full transition-colors ${
                                idx === currentSlideIndex
                                    ? 'bg-indigo-500'
                                    : 'bg-white/30 hover:bg-white/50'
                            }`}
                        />
                    ))}
                </div>

                <button
                    onClick={() => setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}
                    disabled={currentSlideIndex === slides.length - 1}
                    className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-full text-white font-medium transition-colors"
                >
                    הבא
                    <IconArrowBack className="w-5 h-5" />
                </button>
            </div>

            {/* Keyboard hints */}
            <div className="absolute bottom-2 left-4 text-gray-500 text-xs">
                ← קדימה | → אחורה | F מסך מלא | ESC יציאה
            </div>
        </div>
    );
};

export default PresentationMode;
