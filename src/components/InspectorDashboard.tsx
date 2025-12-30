
import React from 'react';
import type { ActivityBlock } from '../courseTypes';
import { validateBlock } from '../utils/pedagogicalValidator';
import { IconSparkles } from '../icons';

interface InspectorDashboardProps {
    blocks: ActivityBlock[];
    mode: 'learning' | 'exam';
    unitTitle?: string;
    unitId?: string;
}

const InspectorDashboard: React.FC<InspectorDashboardProps> = ({ blocks, mode, unitTitle = "Unknown Unit", unitId = "unknown" }) => {
    const [isUploading, setIsUploading] = React.useState(false);

    if (!blocks || blocks.length === 0) return null;

    const results = blocks.map(b => validateBlock(b, mode));
    const avgScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
    const criticalIssues = results.flatMap(r => r.rules.filter(rule => rule.status === 'FAIL').map(rule => ({
        blockId: r.blockId,
        issue: rule.name
    })));

    let statusColor = 'bg-gray-800';
    if (avgScore >= 90) statusColor = 'bg-stone-900 border-b-4 border-green-500';
    else if (avgScore >= 70) statusColor = 'bg-stone-900 border-b-4 border-yellow-500';
    else statusColor = 'bg-stone-900 border-b-4 border-red-500';

    const handleUpload = async () => {
        setIsUploading(true);
        // Dynamic import to avoid circular dependencies if any
        const { PedagogicalTelemetry } = await import('../services/pedagogicalTelemetry');
        await PedagogicalTelemetry.logAuditSession(unitId, unitTitle, mode, results);
        alert("דוח פדגוגי נשלח בהצלחה למאגר הנתונים!");
        setIsUploading(false);
    };

    return (
        <div className={`fixed top-0 left-0 right-0 z-[100] ${statusColor} text-white shadow-2xl p-2 font-mono text-xs flex items-center justify-between px-4 animate-slide-down`}>
            {/* Left Side */}
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest">Wizdi-Monitor Active</span>
                    <span className="font-bold text-lg flex items-center gap-2">
                        <IconSparkles className="w-4 h-4 text-purple-400" />
                        Global Audit: {avgScore}%
                    </span>
                </div>

                <div className="h-8 w-px bg-gray-700 mx-2"></div>

                <div className="flex gap-4">
                    <div className="flex flex-col">
                        <span className="text-gray-500">Mode</span>
                        <span className="font-bold text-blue-300 uppercase">{mode}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-500">Blocks</span>
                        <span className="font-bold">{blocks.length}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-500">Issues</span>
                        <span className={`font-bold ${criticalIssues.length > 0 ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
                            {criticalIssues.length} Critical
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Side */}
            <div className="text-right flex items-center gap-2">
                {criticalIssues.length > 0 && (
                    <div className="bg-red-900/50 px-3 py-1 rounded text-red-200 border border-red-800 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        Failures detected in {criticalIssues.length} blocks
                    </div>
                )}

                <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="bg-purple-700 hover:bg-purple-600 px-3 py-1 rounded text-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    {isUploading ? 'שולח...' : '📤 שלח דוח לתובנות'}
                </button>

                <button
                    onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.delete('inspector');
                        window.history.pushState({}, '', url.toString());
                        window.location.reload();
                    }}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs transition-colors"
                >
                    ✕ Close
                </button>
            </div>
        </div>
    );
};

export default InspectorDashboard;
