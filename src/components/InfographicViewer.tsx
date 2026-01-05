import React, { useState } from 'react';

interface InfographicViewerProps {
    src: string;
    title?: string;
    caption?: string;
    infographicType?: 'flowchart' | 'timeline' | 'comparison' | 'cycle';
    className?: string;
}

const TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
    flowchart: { label: 'תרשים זרימה', emoji: '🔄' },
    timeline: { label: 'ציר זמן', emoji: '📅' },
    comparison: { label: 'השוואה', emoji: '⚖️' },
    cycle: { label: 'מחזור', emoji: '🔁' }
};

export const InfographicViewer: React.FC<InfographicViewerProps> = ({
    src, title, caption, infographicType, className = ''
}) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const typeInfo = infographicType ? TYPE_LABELS[infographicType] : null;

    return (
        <>
            <div className={`bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 overflow-hidden shadow-sm ${className}`} dir="rtl">
                {(title || typeInfo) && (
                    <div className="p-4 bg-white/80 border-b border-blue-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {typeInfo && <span className="text-2xl">{typeInfo.emoji}</span>}
                            <div>
                                {title && <h3 className="font-bold text-gray-800">{title}</h3>}
                                {typeInfo && <span className="text-xs text-blue-600 font-medium">{typeInfo.label}</span>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setZoomLevel(z => Math.max(z - 0.25, 0.5))} className="p-2 hover:bg-blue-100 rounded-lg text-gray-600 font-bold">−</button>
                            <span className="text-xs text-gray-500 font-mono">{Math.round(zoomLevel * 100)}%</span>
                            <button onClick={() => setZoomLevel(z => Math.min(z + 0.25, 3))} className="p-2 hover:bg-blue-100 rounded-lg text-gray-600 font-bold">+</button>
                            <button onClick={() => setIsFullscreen(true)} className="p-2 hover:bg-blue-100 rounded-lg text-gray-600">⛶</button>
                        </div>
                    </div>
                )}
                <div className="p-4 overflow-auto max-h-[500px] bg-white/50">
                    <div className="flex justify-center transition-transform" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center top' }}>
                        <img src={src} alt={title || 'אינפוגרפיקה'} className="rounded-xl shadow-lg max-w-full cursor-pointer" onClick={() => setIsFullscreen(true)} />
                    </div>
                </div>
                {caption && <div className="p-3 bg-white/80 border-t border-blue-100 text-center"><p className="text-sm text-gray-600 italic">{caption}</p></div>}
            </div>
            {isFullscreen && (
                <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" onClick={() => setIsFullscreen(false)}>
                    <button onClick={() => setIsFullscreen(false)} className="absolute top-4 right-4 p-3 bg-white/20 hover:bg-white/30 rounded-full text-white text-xl">✕</button>
                    <img src={src} alt={title || 'אינפוגרפיקה'} className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </>
    );
};

export default InfographicViewer;
