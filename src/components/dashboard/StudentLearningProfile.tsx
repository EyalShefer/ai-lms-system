/**
 * StudentLearningProfile - Display adaptive learning profile for teachers
 *
 * Shows:
 * - Performance metrics (accuracy, response time)
 * - Behavioral patterns (hint dependency, retry persistence)
 * - Learning style preferences (text/video/gamified)
 * - Error fingerprint (common mistake patterns)
 * - Adaptive stats (variants used, challenge modes, etc.)
 */

import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import {
    IconBrain,
    IconBulb,
    IconTarget,
    IconTrendingUp,
    IconClock,
    IconBook,
    IconVideo,
    IconDeviceGamepad2,
    IconAlertTriangle,
    IconSparkles,
    IconChartBar,
    IconRefresh
} from '@tabler/icons-react';
import type { StudentProfile } from '../../types/studentProfile';
import { getAdaptiveStats, type AdaptiveEventType } from '../../services/adaptiveLoggingService';

interface StudentLearningProfileProps {
    studentId: string;
    studentName?: string;
    onClose?: () => void;
}

interface AdaptiveStats {
    counts: Record<AdaptiveEventType, number>;
    lastUpdated: Date | null;
}

export const StudentLearningProfile: React.FC<StudentLearningProfileProps> = ({
    studentId,
    studentName,
    onClose
}) => {
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [errorFingerprint, setErrorFingerprint] = useState<Record<string, number> | null>(null);
    const [proficiencyVector, setProficiencyVector] = useState<Record<string, number> | null>(null);
    const [adaptiveStats, setAdaptiveStats] = useState<AdaptiveStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            setError(null);

            try {
                // Fetch profile stats
                const statsRef = doc(db, 'users', studentId, 'profile', 'stats');
                const statsSnap = await getDoc(statsRef);

                if (statsSnap.exists()) {
                    setProfile(statsSnap.data() as StudentProfile);
                }

                // Fetch error fingerprint
                const errorRef = doc(db, 'users', studentId, 'profile', 'error_fingerprint');
                const errorSnap = await getDoc(errorRef);
                if (errorSnap.exists()) {
                    setErrorFingerprint(errorSnap.data().errorTags || {});
                }

                // Fetch proficiency vector
                const profRef = doc(db, 'users', studentId, 'profile', 'proficiency_vector');
                const profSnap = await getDoc(profRef);
                if (profSnap.exists()) {
                    setProficiencyVector(profSnap.data().topics || {});
                }

                // Fetch adaptive stats
                const stats = await getAdaptiveStats(studentId);
                setAdaptiveStats(stats);

            } catch (err) {
                console.error('Failed to fetch student profile:', err);
                setError('שגיאה בטעינת פרופיל התלמיד');
            } finally {
                setLoading(false);
            }
        };

        if (studentId) {
            fetchProfile();
        }
    }, [studentId]);

    if (loading) {
        return (
            <div className="p-6 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-slate-500">טוען פרופיל...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-center text-red-500">
                <IconAlertTriangle className="w-8 h-8 mx-auto mb-2" />
                <p>{error}</p>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="p-6 text-center text-slate-500">
                <IconBrain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold">אין נתוני פרופיל</p>
                <p className="text-sm mt-1">התלמיד טרם התחיל ללמוד</p>
            </div>
        );
    }

    const { performance, behavioral, engagement } = profile;

    // Calculate learning style preference
    const mediaPrefs = behavioral?.media_preference || { text: 0, video: 0, gamified: 0 };
    const totalPref = mediaPrefs.text + mediaPrefs.video + mediaPrefs.gamified || 1;
    const preferredStyle =
        mediaPrefs.video > mediaPrefs.text && mediaPrefs.video > mediaPrefs.gamified ? 'חזותי' :
            mediaPrefs.gamified > mediaPrefs.text ? 'אינטראקטיבי' : 'טקסטואלי';

    return (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden" dir="rtl">
            {/* Header */}
            <div className="bg-gradient-to-l from-indigo-600 to-purple-600 p-5 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <IconBrain className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">פרופיל למידה אדפטיבי</h3>
                            {studentName && <p className="text-white/80 text-sm">{studentName}</p>}
                        </div>
                    </div>
                    {onClose && (
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
                            ✕
                        </button>
                    )}
                </div>
            </div>

            <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Performance Metrics */}
                <section>
                    <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <IconChartBar className="w-5 h-5 text-indigo-500" />
                        מדדי ביצוע
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <MetricCard
                            label="דיוק כללי"
                            value={`${Math.round((performance?.global_accuracy_rate || 0) * 100)}%`}
                            color={performance?.global_accuracy_rate > 0.7 ? 'green' : performance?.global_accuracy_rate > 0.5 ? 'yellow' : 'red'}
                            icon={<IconTarget className="w-5 h-5" />}
                        />
                        <MetricCard
                            label="זמן תגובה"
                            value={`${Math.round(performance?.average_response_time_sec || 0)}s`}
                            color="blue"
                            icon={<IconClock className="w-5 h-5" />}
                        />
                        <MetricCard
                            label="שאלות"
                            value={performance?.total_questions_attempted || 0}
                            color="purple"
                            icon={<IconBulb className="w-5 h-5" />}
                        />
                        <MetricCard
                            label="שיעורים"
                            value={engagement?.completed_lessons_count || 0}
                            color="indigo"
                            icon={<IconBook className="w-5 h-5" />}
                        />
                    </div>
                </section>

                {/* Behavioral Patterns */}
                <section>
                    <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <IconTrendingUp className="w-5 h-5 text-green-500" />
                        דפוסי התנהגות
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Hint Dependency */}
                        <div className="bg-slate-50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-slate-600">תלות ברמזים</span>
                                <span className={`text-sm font-bold ${(behavioral?.hint_dependency_score || 0) > 0.5 ? 'text-amber-600' : 'text-green-600'}`}>
                                    {Math.round((behavioral?.hint_dependency_score || 0) * 100)}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all ${(behavioral?.hint_dependency_score || 0) > 0.5 ? 'bg-amber-500' : 'bg-green-500'}`}
                                    style={{ width: `${(behavioral?.hint_dependency_score || 0) * 100}%` }}
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                {(behavioral?.hint_dependency_score || 0) > 0.5
                                    ? '⚠️ תלות גבוהה - מומלץ לעודד עצמאות'
                                    : '✅ תלות נמוכה - פותר באופן עצמאי'}
                            </p>
                        </div>

                        {/* Retry Persistence */}
                        <div className="bg-slate-50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-slate-600">התמדה בניסיונות</span>
                                <span className={`text-sm font-bold ${(behavioral?.retry_persistence || 0) > 0.5 ? 'text-green-600' : 'text-amber-600'}`}>
                                    {Math.round((behavioral?.retry_persistence || 0) * 100)}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all ${(behavioral?.retry_persistence || 0) > 0.5 ? 'bg-green-500' : 'bg-amber-500'}`}
                                    style={{ width: `${(behavioral?.retry_persistence || 0) * 100}%` }}
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                {(behavioral?.retry_persistence || 0) > 0.5
                                    ? '✅ התמדה גבוהה - לא מוותר בקלות'
                                    : '⚠️ נוטה לוותר - מומלץ לעודד'}
                            </p>
                        </div>
                    </div>
                </section>

                {/* Learning Style */}
                <section>
                    <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <IconSparkles className="w-5 h-5 text-amber-500" />
                        סגנון למידה מועדף: <span className="text-indigo-600">{preferredStyle}</span>
                    </h4>
                    <div className="flex gap-2">
                        <StyleChip
                            label="טקסט"
                            value={mediaPrefs.text / totalPref}
                            icon={<IconBook className="w-4 h-4" />}
                            color="blue"
                        />
                        <StyleChip
                            label="וידאו"
                            value={mediaPrefs.video / totalPref}
                            icon={<IconVideo className="w-4 h-4" />}
                            color="red"
                        />
                        <StyleChip
                            label="משחקי"
                            value={mediaPrefs.gamified / totalPref}
                            icon={<IconDeviceGamepad2 className="w-4 h-4" />}
                            color="green"
                        />
                    </div>
                </section>

                {/* Error Fingerprint */}
                {errorFingerprint && Object.keys(errorFingerprint).length > 0 && (
                    <section>
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <IconAlertTriangle className="w-5 h-5 text-red-500" />
                            דפוסי שגיאות נפוצים
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(errorFingerprint)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 5)
                                .map(([tag, count]) => (
                                    <span
                                        key={tag}
                                        className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm font-medium border border-red-200"
                                    >
                                        {translateErrorTag(tag)} ({count})
                                    </span>
                                ))}
                        </div>
                    </section>
                )}

                {/* Proficiency Vector - Curriculum Topics */}
                {proficiencyVector && Object.keys(proficiencyVector).length > 0 && (
                    <section>
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <IconBook className="w-5 h-5 text-purple-500" />
                            שליטה לפי נושאי תכנית הלימודים
                        </h4>
                        <div className="space-y-3">
                            {/* Curriculum topics (not bloom_ or general) */}
                            {Object.entries(proficiencyVector)
                                .filter(([topic]) => !topic.startsWith('bloom_') && topic !== 'general')
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 8)
                                .map(([topic, mastery]) => (
                                    <div key={topic} className="flex items-center gap-3">
                                        <span className="text-sm text-slate-600 w-36 truncate" title={topic}>
                                            {topic}
                                        </span>
                                        <div className="flex-1 bg-slate-200 rounded-full h-2.5">
                                            <div
                                                className={`h-2.5 rounded-full transition-all ${mastery > 0.8 ? 'bg-green-500' :
                                                    mastery > 0.5 ? 'bg-yellow-500' : 'bg-red-400'
                                                    }`}
                                                style={{ width: `${Math.round(mastery * 100)}%` }}
                                            />
                                        </div>
                                        <span className={`text-sm font-bold w-12 text-right ${
                                            mastery > 0.8 ? 'text-green-600' :
                                            mastery > 0.5 ? 'text-yellow-600' : 'text-red-500'
                                        }`}>
                                            {Math.round(mastery * 100)}%
                                        </span>
                                    </div>
                                ))}
                        </div>

                        {/* Bloom fallback section (for blocks without curriculum topic mapping) */}
                        {Object.entries(proficiencyVector).some(([t]) => t.startsWith('bloom_') || t === 'general') && (
                            <div className="mt-4 pt-3 border-t border-slate-100">
                                <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                                    <IconTarget className="w-3 h-3" />
                                    רמות בלום (תוכן ללא מיפוי לתכנית)
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(proficiencyVector)
                                        .filter(([topic]) => topic.startsWith('bloom_') || topic === 'general')
                                        .map(([topic, mastery]) => {
                                            const displayName = topic === 'general' ? 'כללי' :
                                                topic.replace('bloom_', '').replace('knowledge', 'ידע')
                                                .replace('comprehension', 'הבנה').replace('application', 'יישום')
                                                .replace('analysis', 'ניתוח').replace('synthesis', 'יצירה')
                                                .replace('evaluation', 'הערכה');
                                            return (
                                                <span key={topic} className="text-xs px-2 py-1 bg-slate-100 rounded-full text-slate-500">
                                                    {displayName}: {Math.round(mastery * 100)}%
                                                </span>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* Adaptive Stats */}
                {adaptiveStats && adaptiveStats.counts && (
                    <section>
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <IconRefresh className="w-5 h-5 text-cyan-500" />
                            סטטיסטיקות התאמה
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                            <StatBadge label="עדכוני BKT" value={adaptiveStats.counts.bkt_update || 0} />
                            <StatBadge label="וריאנטים" value={adaptiveStats.counts.variant_selected || 0} />
                            <StatBadge label="Challenge Mode" value={adaptiveStats.counts.challenge_mode || 0} />
                            <StatBadge label="תיקונים" value={adaptiveStats.counts.remediation_injected || 0} />
                        </div>
                    </section>
                )}

                {/* Last Active */}
                {engagement?.last_active_at && (
                    <p className="text-xs text-slate-400 text-center pt-2 border-t">
                        פעילות אחרונה: {formatDate(engagement.last_active_at)}
                    </p>
                )}
            </div>
        </div>
    );
};

// Helper Components

const MetricCard: React.FC<{
    label: string;
    value: string | number;
    color: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'indigo';
    icon: React.ReactNode;
}> = ({ label, value, color, icon }) => {
    const colorClasses = {
        green: 'bg-green-50 text-green-700 border-green-200',
        yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        red: 'bg-red-50 text-red-700 border-red-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        purple: 'bg-purple-50 text-purple-700 border-purple-200',
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    };

    return (
        <div className={`p-3 rounded-xl border ${colorClasses[color]}`}>
            <div className="flex items-center gap-2 mb-1 opacity-70">
                {icon}
                <span className="text-xs font-medium">{label}</span>
            </div>
            <div className="text-2xl font-black">{value}</div>
        </div>
    );
};

const StyleChip: React.FC<{
    label: string;
    value: number;
    icon: React.ReactNode;
    color: 'blue' | 'red' | 'green';
}> = ({ label, value, icon, color }) => {
    const colorClasses = {
        blue: 'bg-blue-100 text-blue-700',
        red: 'bg-red-100 text-red-700',
        green: 'bg-green-100 text-green-700'
    };

    const percentage = Math.round(value * 100);

    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${colorClasses[color]}`}>
            {icon}
            <span className="text-sm font-medium">{label}</span>
            <span className="font-bold">{percentage}%</span>
        </div>
    );
};

const StatBadge: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="bg-slate-100 rounded-lg p-2">
        <div className="text-lg font-black text-slate-700">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
    </div>
);

// Helpers

const translateErrorTag = (tag: string): string => {
    const translations: Record<string, string> = {
        'calculation_error': 'שגיאת חישוב',
        'sign_error': 'שגיאת סימן',
        'conceptual_error': 'שגיאה מושגית',
        'order_error': 'סדר שגוי',
        'reading_error': 'שגיאת קריאה',
        'careless_error': 'שגיאת חוסר תשומת לב'
    };
    return translations[tag] || tag;
};

const formatDate = (date: any): string => {
    if (!date) return 'לא ידוע';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('he-IL', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export default StudentLearningProfile;
