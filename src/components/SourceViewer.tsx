import React, { useState, useEffect } from 'react';
import { IconBook, IconSparkles, IconX, IconLoader } from '../icons';
import { CitationService } from '../services/citationService';
import { SourceGuideService } from '../services/sourceGuideService';
import type { SourceGuideData } from '../types/gemini.types';
import ReactMarkdown from 'react-markdown';
// import remarkGfm from 'remark-gfm';

interface SourceViewerProps {
    content: string;
    onClose: () => void;
    pdfSource?: string;
}

export const SourceViewer: React.FC<SourceViewerProps> = ({ content, onClose, pdfSource }) => {
    const [activeTab, setActiveTab] = useState<'text' | 'guide'>('text');
    const [guideData, setGuideData] = useState<SourceGuideData | null>(null);
    const [loadingGuide, setLoadingGuide] = useState(false);

    // Auto-scroll to chunk if URL hash changes
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash.startsWith('#chunk-')) {
                const id = hash.replace('#', '');
                const el = document.getElementById(id);
                if (el) {
                    setActiveTab('text'); // Ensure we are on text tab
                    setTimeout(() => {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.classList.add('bg-yellow-200');
                        setTimeout(() => el.classList.remove('bg-yellow-200'), 2000);
                    }, 100);
                }
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const handleGenerateGuide = async () => {
        if (guideData) return; // Already generated
        setLoadingGuide(true);
        const data = await SourceGuideService.generateGuide(content);
        setGuideData(data);
        setLoadingGuide(false);
    };

    // Auto-generate on first tab switch
    useEffect(() => {
        if (activeTab === 'guide' && !guideData && !loadingGuide) {
            handleGenerateGuide();
        }
    }, [activeTab]);

    return (
        <div className="flex flex-col h-full bg-gray-50 border-l border-gray-200 shadow-xl relative">
            {/* Header / Tabs */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b sticky top-0 z-10">
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('text')}
                        className={`px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <IconBook className="w-4 h-4" /> טקסט מלא
                    </button>
                    <button
                        onClick={() => setActiveTab('guide')}
                        className={`px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'guide' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <IconSparkles className="w-4 h-4" /> מדריך לומד
                    </button>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                    <IconX className="w-5 h-5" />
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 relative">

                {/* TAB: TEXT */}
                {activeTab === 'text' && (
                    <div className="prose max-w-none prose-sm prose-indigo leading-relaxed font-serif text-gray-800">
                        {pdfSource ? (
                            <iframe src={pdfSource} className="w-full h-[800px] border-none" title="PDF Source" />
                        ) : (
                            CitationService.chunkText(content).map((chunk) => (
                                <span
                                    key={chunk.id}
                                    id={`chunk-${chunk.id}`}
                                    className="relative py-1 px-1 rounded transition-colors duration-1000 block md:inline hover:bg-yellow-50/50"
                                >
                                    <sup className="text-gray-400 text-[10px] select-none pr-1">[{chunk.id}]</sup>
                                    {chunk.text + " "}
                                </span>
                            ))
                        )}
                    </div>
                )}

                {/* TAB: GUIDE */}
                {activeTab === 'guide' && (
                    <div className="space-y-8 animate-fade-in">
                        {loadingGuide ? (
                            <div className="text-center py-20 text-purple-600">
                                <IconLoader className="w-10 h-10 animate-spin mx-auto mb-4" />
                                <p className="font-bold">מייצר תובנות מהטקסט...</p>
                            </div>
                        ) : guideData ? (
                            <>
                                {/* Summary */}
                                <section>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">תקציר ללומד</h3>
                                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-purple-100 text-gray-800 text-sm leading-7">
                                        <ReactMarkdown
                                            children={guideData.summary.replace(/\[(\d+)\]/g, '[$1](#chunk-$1)')}
                                            components={{
                                                a: ({ href, children }) => (
                                                    <a
                                                        href={href}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setActiveTab('text');
                                                            window.location.hash = href || "";
                                                        }}
                                                        className="inline-flex items-center justify-center w-4 h-4 mx-1 text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-200 rounded-full hover:bg-purple-100 hover:scale-110 transition-all align-middle no-underline"
                                                    >
                                                        {children}
                                                    </a>
                                                )
                                            }}
                                        />
                                    </div>
                                </section>

                                {/* Topics */}
                                <section>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">מושגי מפתח</h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {guideData.topics.map((t, i) => (
                                            <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex gap-3 items-start">
                                                <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5">{i + 1}</div>
                                                <div>
                                                    <div className="font-bold text-gray-900 text-sm mb-1">{t.term}</div>
                                                    <div className="text-xs text-gray-500">{t.definition}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* FAQ */}
                                <section>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">שאלות נפוצות</h3>
                                    <div className="space-y-3">
                                        {guideData.faq.map((q, i) => (
                                            <details key={i} className="group bg-white rounded-xl border border-gray-100 overflow-hidden">
                                                <summary className="p-4 cursor-pointer font-bold text-sm text-gray-800 flex justify-between items-center hover:bg-gray-50">
                                                    {q.question}
                                                    <span className="group-open:rotate-180 transition-transform">▼</span>
                                                </summary>
                                                <div className="p-4 pt-0 text-sm text-gray-600 leading-relaxed border-t border-gray-50">
                                                    {q.answer}
                                                </div>
                                            </details>
                                        ))}
                                    </div>
                                </section>
                            </>
                        ) : (
                            <div className="text-center py-10">
                                <p className="text-red-500">שגיאה בטעינת המדריך.</p>
                                <button onClick={handleGenerateGuide} className="mt-4 text-blue-600 underline">נסה שוב</button>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};
