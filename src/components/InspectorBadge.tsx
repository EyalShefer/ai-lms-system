
import React, { useState } from 'react';
import type { ActivityBlock } from '../courseTypes';
import { validateBlock, type AuditResult, type ComplianceRule } from '../utils/pedagogicalValidator';
import { IconInfo, IconCheck, IconX } from '../icons';

interface InspectorBadgeProps {
    block: ActivityBlock;
    mode: 'learning' | 'exam';
}

const InspectorBadge: React.FC<InspectorBadgeProps> = ({ block, mode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const audit: AuditResult = validateBlock(block, mode);

    // Color logic
    let badgeColor = 'bg-green-500';
    if (audit.score < 90) badgeColor = 'bg-yellow-500';
    if (audit.score < 70) badgeColor = 'bg-red-500';

    return (
        <div className="relative font-mono z-50">
            {/* The Badge */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-white text-[10px] font-bold shadow-lg transition-transform hover:scale-110 ${badgeColor}`}
                title="Click for Pedagogical Analysis"
            >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                {block.metadata?.bloomLevel ? (
                    <span className="bg-black/30 px-1.5 py-0.5 rounded text-[9px] mx-1 uppercase tracking-tight">
                        {block.metadata.bloomLevel.split(' ')[0]}
                    </span>
                ) : null}
                WIZDI: {audit.score}%
            </button>

            {/* The Popover */}
            {isOpen && (
                <div className="absolute top-8 left-0 w-80 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 p-4 animate-fade-in text-xs z-[60]">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700">
                        <h4 className="font-bold flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${badgeColor}`}></span>
                            Pedagogical Audit
                        </h4>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                    </div>
                    {block.metadata?.bloomLevel && (
                        <div className="mb-2 text-[10px] text-purple-300 font-bold bg-purple-900/40 px-2 py-1 rounded w-fit border border-purple-800 flex items-center gap-2">
                            <span className="text-sm">🧠</span>
                            {block.metadata.bloomLevel}
                        </div>
                    )}

                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {audit.rules.map((rule) => (
                            <div key={rule.id} className={`p-2 rounded border ${rule.status === 'PASS' ? 'border-green-900 bg-green-900/20' :
                                rule.status === 'WARNING' ? 'border-yellow-900 bg-yellow-900/20' :
                                    'border-red-900 bg-red-900/20'
                                }`}>
                                <div className="flex justify-between items-start">
                                    <span className={`font-bold ${rule.status === 'PASS' ? 'text-green-400' :
                                        rule.status === 'WARNING' ? 'text-yellow-400' :
                                            'text-red-400'
                                        }`}>
                                        {rule.status === 'PASS' ? <IconCheck className="w-3 h-3 inline mr-1" /> : <IconX className="w-3 h-3 inline mr-1" />}
                                        {rule.name}
                                    </span>
                                    {rule.scoreImpact > 0 && <span className="text-xs text-red-500 font-bold">-{rule.scoreImpact}</span>}
                                </div>
                                <div className="mt-1 text-gray-300 opacity-80 leading-tight">
                                    {rule.message}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-700 text-[10px] text-gray-500 flex justify-between">
                        <span>Block ID: {block.id.substring(0, 6)}...</span>
                        <span>Mode: {mode.toUpperCase()}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InspectorBadge;
