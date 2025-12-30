import React, { useEffect, useState } from 'react';
import { PedagogicalTelemetry, type AuditSessionLog } from '../services/pedagogicalTelemetry';
import { IconSparkles, IconCheck, IconX, IconBrain, IconBook, IconBack, IconFlag } from '../icons';

interface PedagogicalInsightsProps {
    onBack?: () => void;
}

const PedagogicalInsights: React.FC<PedagogicalInsightsProps> = ({ onBack }) => {
    const [selectedLog, setSelectedLog] = useState<AuditSessionLog | null>(null);

    const [recentAudits, setRecentAudits] = useState<AuditSessionLog[]>([]);
    const [stats, setStats] = useState({ avgScore: 0, totalAudits: 0, topFailure: '' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const audits = await PedagogicalTelemetry.getRecentAudits(20);
                const failures = await PedagogicalTelemetry.getCommonFailures();

                setRecentAudits(audits);

                const avg = audits.length > 0
                    ? Math.round(audits.reduce((sum, a) => sum + a.avgScore, 0) / audits.length)
                    : 0;

                setStats({
                    avgScore: avg,
                    totalAudits: audits.length,
                    topFailure: failures.length > 0 ? failures[0].name : 'None'
                });

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const DetailModal = ({ log, onClose }: { log: AuditSessionLog, onClose: () => void }) => (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="bg-purple-900 p-6 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <IconSparkles className="w-6 h-6 text-purple-300" />
                            {log.unitTitle}
                        </h3>
                        <p className="text-purple-200 text-sm mt-1">
                            {new Date(log.timestamp?.seconds * 1000).toLocaleString()} | ציון: {log.avgScore}%
                        </p>
                    </div>
                    <button onClick={onClose} className="hover:bg-purple-800 p-2 rounded-full transition-colors"><IconX className="w-6 h-6" /></button>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    {log.failedRules.length === 0 ? (
                        <div className="text-center py-10 text-green-600">
                            <IconCheck className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <h4 className="text-xl font-bold">הכל נראה מצוין!</h4>
                            <p className="text-gray-500">לא נמצאו בעיות פדגוגיות בבדיקה זו.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <h4 className="font-bold text-gray-700 flex items-center gap-2 border-b pb-2">
                                <IconFlag className="w-5 h-5 text-red-500" />
                                זוהו {log.failedRules.length} בעיות לטיפול:
                            </h4>
                            {log.failedRules.map((fail, idx) => (
                                <div key={idx} className="bg-red-50 p-4 rounded-xl border border-red-100 flex gap-4">
                                    <div className="bg-white p-2 rounded-full shadow-sm text-red-500 h-fit shrink-0 font-bold text-xs">
                                        #{idx + 1}
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-red-900 text-sm">{fail.ruleName}</h5>
                                        <p className="text-red-700 text-sm mt-1">{fail.message}</p>
                                        <div className="mt-2 text-xs text-red-400 font-mono bg-red-100/50 px-2 py-1 rounded w-fit">
                                            Block ID: {fail.blockId}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="bg-gray-50 p-4 border-t flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors">
                        סגור
                    </button>
                </div>
            </div>
        </div>
    );

    const getRecommendation = (failureName: string) => {
        if (failureName.includes('Feedback')) return "Update System Prompt to enforce 'Constructive Feedback' in all outputs.";
        if (failureName.includes('Hint')) return "Ensure 'Progressive Hints' are enabled in the learning mode configuration.";
        if (failureName.includes('Question')) return "Review content generation prompt to ensure questions are explicitly defined.";
        if (failureName.includes('Wall of Text')) return "Adjust 'Chunk Size' parameter in content generation settings.";
        return "Review specific block configurations.";
    };

    if (loading) return <div className="p-10 text-center"><div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div><p className="mt-4 text-gray-500">Loading Insights...</p></div>;

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans" dir="ltr">
            {selectedLog && <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}

            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <IconBrain className="w-8 h-8 text-purple-600" />
                        Pedagogical Insights
                    </h1>
                    <p className="text-gray-500 mt-1">Real-time analysis of system performance against educational DNA.</p>
                </div>
                {onBack && (
                    <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-4 py-2 rounded-xl border border-gray-200 bg-white shadow-sm">
                        <IconBack className="w-4 h-4 rotate-180" /> Back to Dashboard
                    </button>
                )}
            </header>

            {/* Stats Components */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-purple-100">
                    <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Network Health (Avg Score)</h3>
                    <div className="text-4xl font-black text-purple-900 flex items-center gap-2">
                        {stats.avgScore}%
                        {stats.avgScore >= 90 ? <IconCheck className="w-6 h-6 text-green-500" /> : <IconX className="w-6 h-6 text-red-500" />}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-purple-100">
                    <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Total Audits Processed</h3>
                    <div className="text-4xl font-black text-indigo-900">{stats.totalAudits}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-purple-100">
                    <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Critical Failure Trend</h3>
                    <div className="text-lg font-bold text-red-500">{stats.topFailure}</div>
                    <p className="text-xs text-gray-500 mt-1">Suggested Fix: {getRecommendation(stats.topFailure)}</p>
                </div>
            </div>

            {/* Recent Logs Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-lg">Recent Audit Sessions</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs">
                            <tr>
                                <th className="p-4">Timestamp</th>
                                <th className="p-4">Unit Name</th>
                                <th className="p-4">Mode</th>
                                <th className="p-4">Quality Score</th>
                                <th className="p-4">Issues Found</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {recentAudits.map((log: any, idx) => (
                                <tr
                                    key={idx}
                                    onClick={() => setSelectedLog(log)}
                                    className="hover:bg-purple-50 transition-colors cursor-pointer group"
                                >
                                    <td className="p-4 text-gray-500 group-hover:text-purple-700 font-medium transition-colors">
                                        {new Date(log.timestamp?.seconds * 1000).toLocaleString()}
                                    </td>
                                    <td className="p-4 font-medium text-gray-800 group-hover:text-purple-900">{log.unitTitle}</td>
                                    <td className="p-4"><span className="px-2 py-1 rounded bg-blue-50 text-blue-600 font-bold text-xs uppercase">{log.mode}</span></td>
                                    <td className="p-4 font-bold">
                                        <span className={log.avgScore >= 90 ? 'text-green-600' : log.avgScore >= 70 ? 'text-yellow-600' : 'text-red-600'}>
                                            {log.avgScore}%
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {log.failedRules.length === 0 ? (
                                            <span className="text-green-500 flex items-center gap-1"><IconCheck className="w-3 h-3" /> Clean</span>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                {log.failedRules.slice(0, 2).map((f: any, i: number) => (
                                                    <span key={i} className="text-xs text-red-500 bg-red-50 px-1 rounded w-fit">{f.issue || f.ruleName}</span>
                                                ))}
                                                {log.failedRules.length > 2 && <span className="text-xs text-gray-400">+{log.failedRules.length - 2} more</span>}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PedagogicalInsights;
