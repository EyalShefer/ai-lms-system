import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
    IconChartBar,
    IconBuilding,
    IconUsers,
    IconCoins,
    IconTrendingUp,
    IconAlertTriangle,
    IconRefresh,
    IconChevronDown,
    IconChevronUp,
} from '@tabler/icons-react';

interface InstitutionUsage {
    id: string;
    name: string;
    tier: 'free' | 'basic' | 'pro' | 'enterprise';
    status: string;
    usage: {
        tokens: number;
        images: number;
        cost: number;
    };
    percentUsed: number;
}

interface UsageDashboardProps {
    className?: string;
}

const TIER_COLORS: Record<string, string> = {
    free: 'bg-slate-100 text-slate-700',
    basic: 'bg-blue-100 text-blue-700',
    pro: 'bg-purple-100 text-purple-700',
    enterprise: 'bg-amber-100 text-amber-700',
};

const TIER_NAMES: Record<string, string> = {
    free: 'חינמי',
    basic: 'בסיסי',
    pro: 'מקצועי',
    enterprise: 'ארגוני',
};

export const UsageDashboard: React.FC<UsageDashboardProps> = ({ className = '' }) => {
    const { isAdmin } = useAuth();
    const [institutions, setInstitutions] = useState<InstitutionUsage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortField, setSortField] = useState<'name' | 'percentUsed' | 'tokens'>('percentUsed');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const fetchData = async () => {
        if (!isAdmin) return;

        setLoading(true);
        setError(null);

        try {
            const getAllUsage = httpsCallable(functions, 'getAllUsage');
            const result = await getAllUsage();
            const data = result.data as { institutions: InstitutionUsage[] };
            setInstitutions(data.institutions || []);
        } catch (err: any) {
            console.error('Error fetching usage data:', err);
            setError(err.message || 'שגיאה בטעינת נתונים');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [isAdmin]);

    const handleSort = (field: 'name' | 'percentUsed' | 'tokens') => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const sortedInstitutions = [...institutions].sort((a, b) => {
        const direction = sortDirection === 'asc' ? 1 : -1;
        switch (sortField) {
            case 'name':
                return direction * a.name.localeCompare(b.name, 'he');
            case 'percentUsed':
                return direction * (a.percentUsed - b.percentUsed);
            case 'tokens':
                return direction * (a.usage.tokens - b.usage.tokens);
            default:
                return 0;
        }
    });

    // Calculate summary stats
    const totalInstitutions = institutions.length;
    const activeInstitutions = institutions.filter(i => i.status === 'active').length;
    const totalTokens = institutions.reduce((sum, i) => sum + i.usage.tokens, 0);
    const totalCost = institutions.reduce((sum, i) => sum + i.usage.cost, 0);
    const atRiskCount = institutions.filter(i => i.percentUsed >= 80).length;

    if (!isAdmin) {
        return (
            <div className={`bg-white rounded-xl p-8 text-center ${className}`}>
                <IconAlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-800 mb-2">אין הרשאה</h2>
                <p className="text-slate-600">רק מנהלי מערכת יכולים לצפות בדשבורד זה</p>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className}`} dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">דשבורד שימוש</h1>
                    <p className="text-slate-600">ניטור שימוש ב-AI לכל המוסדות</p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    <IconRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    רענן
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <IconBuilding className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-600">מוסדות</p>
                            <p className="text-xl font-bold text-slate-800">{totalInstitutions}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <IconUsers className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-600">פעילים</p>
                            <p className="text-xl font-bold text-slate-800">{activeInstitutions}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <IconChartBar className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-600">טוקנים החודש</p>
                            <p className="text-xl font-bold text-slate-800">{totalTokens.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <IconCoins className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-600">עלות משוערת</p>
                            <p className="text-xl font-bold text-slate-800">${totalCost.toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <IconAlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-600">מתקרבים למכסה</p>
                            <p className="text-xl font-bold text-slate-800">{atRiskCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
                    {error}
                </div>
            )}

            {/* Institutions Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-800">מוסדות</h2>
                </div>

                {loading ? (
                    <div className="p-8 text-center">
                        <IconRefresh className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-4" />
                        <p className="text-slate-600">טוען נתונים...</p>
                    </div>
                ) : institutions.length === 0 ? (
                    <div className="p-8 text-center">
                        <IconBuilding className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-600">אין מוסדות להצגה</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th
                                        className="px-4 py-3 text-right text-sm font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                                        onClick={() => handleSort('name')}
                                    >
                                        <div className="flex items-center gap-1">
                                            שם המוסד
                                            {sortField === 'name' && (sortDirection === 'asc' ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />)}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                                        רישיון
                                    </th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                                        סטטוס
                                    </th>
                                    <th
                                        className="px-4 py-3 text-right text-sm font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                                        onClick={() => handleSort('tokens')}
                                    >
                                        <div className="flex items-center gap-1">
                                            טוקנים
                                            {sortField === 'tokens' && (sortDirection === 'asc' ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />)}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                                        תמונות
                                    </th>
                                    <th
                                        className="px-4 py-3 text-right text-sm font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                                        onClick={() => handleSort('percentUsed')}
                                    >
                                        <div className="flex items-center gap-1">
                                            שימוש
                                            {sortField === 'percentUsed' && (sortDirection === 'asc' ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />)}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                                        עלות
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {sortedInstitutions.map((institution) => (
                                    <tr key={institution.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-800">{institution.name}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${TIER_COLORS[institution.tier]}`}>
                                                {TIER_NAMES[institution.tier]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                institution.status === 'active'
                                                    ? 'bg-green-100 text-green-700'
                                                    : institution.status === 'grace_period'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-red-100 text-red-700'
                                            }`}>
                                                {institution.status === 'active' ? 'פעיל' :
                                                 institution.status === 'grace_period' ? 'תקופת חסד' :
                                                 institution.status === 'expired' ? 'פג תוקף' : institution.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-700">
                                            {institution.usage.tokens.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-slate-700">
                                            {institution.usage.images}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${
                                                            institution.percentUsed >= 95 ? 'bg-red-500' :
                                                            institution.percentUsed >= 80 ? 'bg-amber-500' :
                                                            'bg-green-500'
                                                        }`}
                                                        style={{ width: `${Math.min(institution.percentUsed, 100)}%` }}
                                                    />
                                                </div>
                                                <span className={`text-sm font-medium ${
                                                    institution.percentUsed >= 95 ? 'text-red-600' :
                                                    institution.percentUsed >= 80 ? 'text-amber-600' :
                                                    'text-slate-600'
                                                }`}>
                                                    {institution.percentUsed}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-700">
                                            ${institution.usage.cost.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UsageDashboard;
