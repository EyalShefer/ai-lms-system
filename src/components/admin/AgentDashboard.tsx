/**
 * AgentDashboard - Admin panel for monitoring the Curriculum Agent
 *
 * Shows:
 * - Real-time generation requests
 * - Activities created
 * - Quality metrics
 * - Curriculum standards coverage
 */
import React, { useState, useEffect } from 'react';
import {
    IconRobot,
    IconSparkles,
    IconBook,
    IconFlask,
    IconCheck,
    IconX,
    IconClock,
    IconLoader,
    IconChartBar,
    IconRefresh,
    IconEye,
    IconStar,
    IconAlertTriangle,
    IconPlus
} from '@tabler/icons-react';
import ActivityGeneratorPanel from '../ActivityBank/ActivityGeneratorPanel';
import {
    getAllGenerationRequests,
    subscribeToGenerationRequests,
    getAllActivities,
    subscribeToActivities,
    getAgentStats,
    getCurriculumStandards,
    type GenerationRequest,
    type AgentActivity,
    type AgentStats,
    type CurriculumStandard
} from '../../services/agentMonitoringService';

// Tab types
type TabType = 'overview' | 'requests' | 'activities' | 'standards';

// Status badge component
function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
        'pending': { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <IconClock size={14} /> },
        'processing': { bg: 'bg-blue-100', text: 'text-blue-700', icon: <IconLoader size={14} className="animate-spin" /> },
        'completed': { bg: 'bg-green-100', text: 'text-green-700', icon: <IconCheck size={14} /> },
        'failed': { bg: 'bg-red-100', text: 'text-red-700', icon: <IconX size={14} /> },
        'auto_approved': { bg: 'bg-green-100', text: 'text-green-700', icon: <IconCheck size={14} /> },
        'pending_review': { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <IconClock size={14} /> },
        'approved': { bg: 'bg-green-100', text: 'text-green-700', icon: <IconCheck size={14} /> },
        'rejected': { bg: 'bg-red-100', text: 'text-red-700', icon: <IconX size={14} /> }
    };

    const statusLabels: Record<string, string> = {
        'pending': 'ממתין',
        'processing': 'בעיבוד',
        'completed': 'הושלם',
        'failed': 'נכשל',
        'auto_approved': 'אושר אוטומטית',
        'pending_review': 'ממתין לבדיקה',
        'approved': 'אושר',
        'rejected': 'נדחה'
    };

    const c = config[status] || config['pending'];
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
            {c.icon}
            {statusLabels[status] || status}
        </span>
    );
}

// Quality score badge
function QualityBadge({ score }: { score: number }) {
    let color = 'bg-gray-100 text-gray-700';
    if (score >= 80) color = 'bg-green-100 text-green-700';
    else if (score >= 70) color = 'bg-blue-100 text-blue-700';
    else if (score >= 60) color = 'bg-yellow-100 text-yellow-700';
    else color = 'bg-red-100 text-red-700';

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${color}`}>
            <IconSparkles size={12} />
            {score}
        </span>
    );
}

// Subject icon
function SubjectIcon({ subject }: { subject: 'hebrew' | 'science' }) {
    if (subject === 'hebrew') {
        return <IconBook size={16} className="text-purple-600" />;
    }
    return <IconFlask size={16} className="text-green-600" />;
}

export default function AgentDashboard() {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [requests, setRequests] = useState<GenerationRequest[]>([]);
    const [activities, setActivities] = useState<AgentActivity[]>([]);
    const [standards, setStandards] = useState<CurriculumStandard[]>([]);
    const [stats, setStats] = useState<AgentStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<GenerationRequest | null>(null);

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            console.log('🤖 AgentDashboard: Loading data...');
            setLoading(true);

            // Load stats (may fail due to empty collections)
            try {
                const statsData = await getAgentStats();
                console.log('🤖 AgentDashboard: Stats loaded:', statsData);
                setStats(statsData);
            } catch (error) {
                console.error('❌ AgentDashboard: Error loading stats:', error);
                // Set default stats on error
                setStats({
                    totalActivities: 0,
                    activitiesBySubject: { hebrew: 0, science: 0 },
                    activitiesByGrade: { 'ה': 0, 'ו': 0 },
                    averageQualityScore: 0,
                    qualityDistribution: { excellent: 0, good: 0, fair: 0 },
                    totalRequests: 0,
                    completedRequests: 0,
                    failedRequests: 0,
                    pendingRequests: 0
                });
            }

            // Load curriculum standards (separate try-catch)
            try {
                const standardsData = await getCurriculumStandards();
                console.log('🤖 AgentDashboard: Standards loaded:', standardsData.length, 'standards');
                setStandards(standardsData);
            } catch (error) {
                console.error('❌ AgentDashboard: Error loading standards:', error);
            }

            setLoading(false);
        };
        loadData();
    }, []);

    // Subscribe to real-time updates
    useEffect(() => {
        const unsubRequests = subscribeToGenerationRequests(setRequests);
        const unsubActivities = subscribeToActivities(setActivities);

        return () => {
            unsubRequests();
            unsubActivities();
        };
    }, []);

    // Refresh stats
    const refreshStats = async () => {
        const newStats = await getAgentStats();
        setStats(newStats);
    };

    // Format timestamp
    const formatTime = (timestamp: any) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('he-IL');
    };

    const tabs = [
        { id: 'overview', label: 'סקירה כללית', icon: <IconChartBar size={18} /> },
        { id: 'requests', label: 'בקשות יצירה', icon: <IconRobot size={18} /> },
        { id: 'activities', label: 'פעילויות', icon: <IconSparkles size={18} /> },
        { id: 'standards', label: 'תקני תוכ"ל', icon: <IconBook size={18} /> }
    ];

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                        <IconRobot size={32} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">ניהול סוכן יצירת פעילויות</h1>
                        <p className="text-gray-500">מעקב אחר ביצועים, תוכן ואיכות</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 -mb-px ${
                            activeTab === tab.id
                                ? 'text-indigo-600 border-indigo-600'
                                : 'text-gray-500 border-transparent hover:text-gray-700'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <IconLoader size={32} className="animate-spin text-indigo-600" />
                </div>
            ) : (
                <>
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Generator Panel - Always Visible */}
                            <ActivityGeneratorPanel />

                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-gray-500 text-sm">סה"כ פעילויות</span>
                                        <IconSparkles size={20} className="text-indigo-500" />
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">{stats?.totalActivities || 0}</p>
                                </div>
                                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-gray-500 text-sm">ציון איכות ממוצע</span>
                                        <IconStar size={20} className="text-yellow-500" />
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">{stats?.averageQualityScore?.toFixed(1) || '0.0'}</p>
                                </div>
                                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-gray-500 text-sm">בקשות שהושלמו</span>
                                        <IconCheck size={20} className="text-green-500" />
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">{stats?.completedRequests || 0}</p>
                                </div>
                                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-gray-500 text-sm">בקשות שנכשלו</span>
                                        <IconAlertTriangle size={20} className="text-red-500" />
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">{stats?.failedRequests || 0}</p>
                                </div>
                            </div>

                            {/* Breakdown - only show if there's data */}
                            {stats && stats.totalActivities > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* By Subject */}
                                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                                        <h3 className="font-bold text-gray-900 mb-4">פעילויות לפי מקצוע</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <IconBook size={18} className="text-purple-600" />
                                                    <span>עברית</span>
                                                </div>
                                                <span className="font-bold">{stats.activitiesBySubject.hebrew}</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-purple-500"
                                                    style={{ width: `${stats.totalActivities > 0 ? (stats.activitiesBySubject.hebrew / stats.totalActivities) * 100 : 0}%` }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between mt-4">
                                                <div className="flex items-center gap-2">
                                                    <IconFlask size={18} className="text-green-600" />
                                                    <span>מדעים</span>
                                                </div>
                                                <span className="font-bold">{stats.activitiesBySubject.science}</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500"
                                                    style={{ width: `${stats.totalActivities > 0 ? (stats.activitiesBySubject.science / stats.totalActivities) * 100 : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quality Distribution */}
                                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                                        <h3 className="font-bold text-gray-900 mb-4">התפלגות איכות</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-green-600">מעולה (80+)</span>
                                                <span className="font-bold">{stats.qualityDistribution.excellent}</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500"
                                                    style={{ width: `${stats.totalActivities > 0 ? (stats.qualityDistribution.excellent / stats.totalActivities) * 100 : 0}%` }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-blue-600">טוב (70-79)</span>
                                                <span className="font-bold">{stats.qualityDistribution.good}</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500"
                                                    style={{ width: `${stats.totalActivities > 0 ? (stats.qualityDistribution.good / stats.totalActivities) * 100 : 0}%` }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-yellow-600">סביר (60-69)</span>
                                                <span className="font-bold">{stats.qualityDistribution.fair}</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-yellow-500"
                                                    style={{ width: `${stats.totalActivities > 0 ? (stats.qualityDistribution.fair / stats.totalActivities) * 100 : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Empty state message */}
                            {(!stats || stats.totalActivities === 0) && (
                                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-8 text-center border border-indigo-100">
                                    <IconSparkles size={48} className="mx-auto mb-4 text-indigo-400" />
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">עדיין אין פעילויות במאגר</h3>
                                    <p className="text-gray-600 mb-4">
                                        השתמש בפאנל למעלה כדי ליצור את הפעילויות הראשונות שלך.
                                        <br />
                                        הסוכן ייצור פעילויות איכותיות לפי תוכנית הלימודים.
                                    </p>
                                </div>
                            )}

                            {/* Refresh Button */}
                            <div className="flex justify-center">
                                <button
                                    onClick={refreshStats}
                                    className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                    <IconRefresh size={18} />
                                    רענן נתונים
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Requests Tab */}
                    {activeTab === 'requests' && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                                <h3 className="font-bold text-gray-900">בקשות יצירת פעילויות</h3>
                                <span className="text-sm text-gray-500">{requests.length} בקשות</span>
                            </div>
                            {requests.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <IconRobot size={48} className="mx-auto mb-4 opacity-30" />
                                    <p>אין בקשות יצירה עדיין</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">סטטוס</th>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">מקצוע</th>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">כיתה</th>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">נושא</th>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">כמות</th>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">תוצאה</th>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">נוצר</th>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">פעולות</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {requests.map(req => (
                                                <tr key={req.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <StatusBadge status={req.status} />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <SubjectIcon subject={req.subject} />
                                                            <span>{req.subject === 'hebrew' ? 'עברית' : 'מדעים'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">{req.gradeLevel}</td>
                                                    <td className="px-4 py-3 max-w-[200px] truncate">{req.topic || '-'}</td>
                                                    <td className="px-4 py-3">{req.activityCount}</td>
                                                    <td className="px-4 py-3">
                                                        {req.result ? (
                                                            <span className="text-green-600 font-medium">
                                                                {req.result.activitiesCreated} נוצרו
                                                            </span>
                                                        ) : req.error ? (
                                                            <span className="text-red-600 text-sm truncate max-w-[150px] block">
                                                                {req.error}
                                                            </span>
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">
                                                        {formatTime(req.createdAt)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            onClick={() => setSelectedRequest(req)}
                                                            className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                                        >
                                                            <IconEye size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Activities Tab */}
                    {activeTab === 'activities' && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                                <h3 className="font-bold text-gray-900">פעילויות שנוצרו</h3>
                                <span className="text-sm text-gray-500">{activities.length} פעילויות</span>
                            </div>
                            {activities.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <IconSparkles size={48} className="mx-auto mb-4 opacity-30" />
                                    <p>אין פעילויות במאגר עדיין</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">מקצוע</th>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">כיתה</th>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">נושא</th>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">סוג</th>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">בלום</th>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">איכות</th>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">סטטוס</th>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">שימושים</th>
                                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">נוצר</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {activities.map(activity => (
                                                <tr key={activity.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <SubjectIcon subject={activity.subject} />
                                                            <span>{activity.subject === 'hebrew' ? 'עברית' : 'מדעים'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">{activity.gradeLevel}</td>
                                                    <td className="px-4 py-3 max-w-[200px] truncate">{activity.topic}</td>
                                                    <td className="px-4 py-3 text-sm">{activity.activityType}</td>
                                                    <td className="px-4 py-3 text-sm">{activity.bloomLevel}</td>
                                                    <td className="px-4 py-3">
                                                        <QualityBadge score={activity.qualityScore} />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <StatusBadge status={activity.reviewStatus} />
                                                    </td>
                                                    <td className="px-4 py-3">{activity.usageCount}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">
                                                        {formatTime(activity.createdAt)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Standards Tab */}
                    {activeTab === 'standards' && (
                        <div className="space-y-6">
                            {standards.length === 0 && (
                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-8 text-center">
                                    <IconBook size={48} className="mx-auto mb-4 text-orange-400" />
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">לא נמצאו תקני תוכנית לימודים</h3>
                                    <p className="text-gray-600 mb-4">
                                        יש להריץ את סקריפט ה-seeding כדי לטעון את התקנים.
                                    </p>
                                    <code className="bg-gray-800 text-green-400 px-4 py-2 rounded text-sm block max-w-md mx-auto">
                                        cd functions && npx ts-node src/scripts/seedCurriculumStandards.ts
                                    </code>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Hebrew Standards */}
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                                    <div className="p-4 border-b border-gray-200 flex items-center gap-2">
                                        <IconBook size={20} className="text-purple-600" />
                                        <h3 className="font-bold text-gray-900">עברית</h3>
                                        <span className="text-sm text-gray-500">
                                            ({standards.filter(s => s.subject === 'hebrew').length} תקנים)
                                        </span>
                                    </div>
                                    <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                                        {standards
                                            .filter(s => s.subject === 'hebrew')
                                            .map(standard => (
                                                <div key={standard.id} className="p-3 bg-purple-50 rounded-lg">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded">
                                                            כיתה {standard.gradeLevel}
                                                        </span>
                                                        <span className="text-xs text-gray-500">{standard.domain}</span>
                                                    </div>
                                                    <h4 className="font-medium text-gray-900">{standard.title}</h4>
                                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{standard.description}</p>
                                                </div>
                                            ))}
                                    </div>
                                </div>

                                {/* Science Standards */}
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                                    <div className="p-4 border-b border-gray-200 flex items-center gap-2">
                                        <IconFlask size={20} className="text-green-600" />
                                        <h3 className="font-bold text-gray-900">מדעים</h3>
                                        <span className="text-sm text-gray-500">
                                            ({standards.filter(s => s.subject === 'science').length} תקנים)
                                        </span>
                                    </div>
                                    <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                                        {standards
                                            .filter(s => s.subject === 'science')
                                            .map(standard => (
                                                <div key={standard.id} className="p-3 bg-green-50 rounded-lg">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs bg-green-200 text-green-700 px-2 py-0.5 rounded">
                                                            כיתה {standard.gradeLevel}
                                                        </span>
                                                        <span className="text-xs text-gray-500">{standard.domain}</span>
                                                    </div>
                                                    <h4 className="font-medium text-gray-900">{standard.title}</h4>
                                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{standard.description}</p>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Request Detail Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">פרטי בקשה</h2>
                            <button
                                onClick={() => setSelectedRequest(null)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <IconX size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-gray-500">סטטוס</label>
                                    <div className="mt-1">
                                        <StatusBadge status={selectedRequest.status} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">מקצוע</label>
                                    <p className="font-medium">{selectedRequest.subject === 'hebrew' ? 'עברית' : 'מדעים'}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">כיתה</label>
                                    <p className="font-medium">{selectedRequest.gradeLevel}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">כמות מבוקשת</label>
                                    <p className="font-medium">{selectedRequest.activityCount}</p>
                                </div>
                            </div>

                            {selectedRequest.topic && (
                                <div>
                                    <label className="text-sm text-gray-500">נושא</label>
                                    <p className="font-medium">{selectedRequest.topic}</p>
                                </div>
                            )}

                            <div>
                                <label className="text-sm text-gray-500">רמות בלום</label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {selectedRequest.bloomLevels.map(level => (
                                        <span key={level} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs">
                                            {level}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {selectedRequest.result && (
                                <div className="p-4 bg-green-50 rounded-xl">
                                    <h4 className="font-medium text-green-900 mb-2">תוצאות</h4>
                                    <p className="text-green-700">נוצרו {selectedRequest.result.activitiesCreated} פעילויות</p>
                                    {selectedRequest.result.qualityScores.length > 0 && (
                                        <p className="text-sm text-green-600 mt-1">
                                            ציוני איכות: {selectedRequest.result.qualityScores.join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}

                            {selectedRequest.error && (
                                <div className="p-4 bg-red-50 rounded-xl">
                                    <h4 className="font-medium text-red-900 mb-2">שגיאה</h4>
                                    <p className="text-red-700 text-sm">{selectedRequest.error}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                                <div>
                                    <label>נוצר</label>
                                    <p>{formatTime(selectedRequest.createdAt)}</p>
                                </div>
                                {selectedRequest.completedAt && (
                                    <div>
                                        <label>הושלם</label>
                                        <p>{formatTime(selectedRequest.completedAt)}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
