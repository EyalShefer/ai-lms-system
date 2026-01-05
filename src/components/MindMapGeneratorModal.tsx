import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { generateMindMapFromContent } from '../services/ai/mindMapGenerator';
import type { MindMapContent } from '../shared/types/courseTypes';
import MindMapViewer from './MindMapViewer';
import { IconLoader2, IconSparkles, IconX, IconCheck, IconBrain, IconRefresh } from '@tabler/icons-react';

interface MindMapGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (content: MindMapContent) => void;
    sourceText: string;
    topic: string;
    gradeLevel: string;
}

const MindMapGeneratorModal: React.FC<MindMapGeneratorModalProps> = ({
    isOpen,
    onClose,
    onGenerate,
    sourceText,
    topic,
    gradeLevel
}) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<MindMapContent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [maxNodes, setMaxNodes] = useState(12);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);

        try {
            const result = await generateMindMapFromContent(sourceText, topic, gradeLevel, maxNodes);

            if (result) {
                const content: MindMapContent = {
                    title: result.title,
                    nodes: result.nodes,
                    edges: result.edges,
                    layoutDirection: result.suggestedLayout || 'RL',
                };
                setGeneratedContent(content);
            } else {
                setError('לא הצלחנו לייצר את מפת החשיבה. נסו שוב.');
            }
        } catch (err: any) {
            setError(err.message || 'שגיאה ביצירת מפת החשיבה');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirm = () => {
        if (generatedContent) {
            onGenerate(generatedContent);
            handleClose();
        }
    };

    const handleClose = () => {
        setGeneratedContent(null);
        setError(null);
        onClose();
    };

    const handleRegenerate = () => {
        setGeneratedContent(null);
        handleGenerate();
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            dir="rtl"
            onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-[900px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-l from-purple-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                            <IconBrain className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">יצירת מפת חשיבה</h2>
                            <p className="text-sm text-gray-500">מפה ויזואלית מתוכן השיעור</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <IconX className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!generatedContent ? (
                        <div className="space-y-6">
                            {/* Settings */}
                            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-5 rounded-xl border border-purple-100">
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    מספר צמתים מקסימלי
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="6"
                                        max="20"
                                        value={maxNodes}
                                        onChange={(e) => setMaxNodes(parseInt(e.target.value))}
                                        className="flex-1 h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                    />
                                    <div className="w-12 h-12 rounded-xl bg-white border-2 border-purple-200 flex items-center justify-center font-bold text-purple-600 text-lg">
                                        {maxNodes}
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    מפה עם פחות צמתים תהיה פשוטה יותר להבנה. מפה עם יותר צמתים תכיל יותר פרטים.
                                </p>
                            </div>

                            {/* Topic Info */}
                            {topic && (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <div className="flex items-center gap-2 text-blue-700">
                                        <span className="text-lg">📚</span>
                                        <span className="font-medium">נושא:</span>
                                        <span>{topic}</span>
                                    </div>
                                </div>
                            )}

                            {/* Info */}
                            <div className="text-center py-8">
                                <div className="text-7xl mb-4">🗺️</div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2">
                                    צור מפת חשיבה מהתוכן
                                </h3>
                                <p className="text-gray-500 text-sm max-w-md mx-auto">
                                    המערכת תנתח את תוכן היחידה ותיצור מפת חשיבה ויזואלית
                                    עם הקשרים בין המושגים המרכזיים.
                                </p>
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center border border-red-200">
                                    <span className="text-lg mr-2">⚠️</span>
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-indigo-700 transition-all disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                            >
                                {isGenerating ? (
                                    <>
                                        <IconLoader2 className="w-5 h-5 animate-spin" />
                                        מייצר מפת חשיבה...
                                    </>
                                ) : (
                                    <>
                                        <IconSparkles className="w-5 h-5" />
                                        צור מפת חשיבה
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                    <span className="text-2xl">✨</span>
                                    תצוגה מקדימה
                                </h3>
                                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                    {generatedContent.nodes.length} צמתים
                                </span>
                            </div>

                            <MindMapViewer
                                content={generatedContent}
                                title={generatedContent.title}
                                className="shadow-lg"
                            />

                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-sm text-amber-800">
                                <span className="font-medium">💡 טיפ:</span> לאחר ההוספה ליחידה, תוכל לערוך את המפה - להוסיף צמתים, לשנות צבעים ולהזיז אלמנטים.
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleRegenerate}
                                    disabled={isGenerating}
                                    className="flex-1 py-3 border-2 border-purple-300 text-purple-600 rounded-xl font-bold hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isGenerating ? (
                                        <>
                                            <IconLoader2 className="w-5 h-5 animate-spin" />
                                            מייצר מחדש...
                                        </>
                                    ) : (
                                        <>
                                            <IconRefresh className="w-5 h-5" />
                                            ייצר מחדש
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <IconCheck className="w-5 h-5" />
                                    הוסף ליחידה
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default MindMapGeneratorModal;
