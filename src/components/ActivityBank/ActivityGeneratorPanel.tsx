/**
 * ActivityGeneratorPanel - UI for triggering autonomous activity generation
 */
import React, { useState, useEffect } from 'react';
import {
    IconSparkles,
    IconRobot,
    IconCheck,
    IconX,
    IconLoader,
    IconAlertTriangle,
    IconBook,
    IconFlask
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { requestActivityGeneration, subscribeToGenerationStatus, type GenerationRequestParams } from '../../services/activityBankService';
import type { BloomLevel } from '../../courseTypes';

const SUBJECTS = [
    { value: 'hebrew', label: 'עברית', icon: IconBook },
    { value: 'science', label: 'מדעים', icon: IconFlask }
];

const GRADE_LEVELS = [
    { value: 'ה', label: "כיתה ה'" },
    { value: 'ו', label: "כיתה ו'" }
];

const BLOOM_LEVELS: { value: BloomLevel; label: string; description: string }[] = [
    { value: 'remember', label: 'זכירה', description: 'זיהוי והיזכרות' },
    { value: 'understand', label: 'הבנה', description: 'הסבר ופרשנות' },
    { value: 'apply', label: 'יישום', description: 'שימוש בידע' },
    { value: 'analyze', label: 'ניתוח', description: 'פירוק וזיהוי קשרים' },
    { value: 'evaluate', label: 'הערכה', description: 'שיפוט וביקורת' },
    { value: 'create', label: 'יצירה', description: 'יצירת תוכן חדש' }
];

type GenerationStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';

interface GenerationProgress {
    status: GenerationStatus;
    activitiesCreated?: number;
    totalRequested?: number;
    errors?: string[];
}

export default function ActivityGeneratorPanel() {
    const { currentUser } = useAuth();
    const [subject, setSubject] = useState<'hebrew' | 'science'>('hebrew');
    const [gradeLevel, setGradeLevel] = useState<'ה' | 'ו'>('ה');
    const [topic, setTopic] = useState('');
    const [activityCount, setActivityCount] = useState(5);
    const [selectedBloomLevels, setSelectedBloomLevels] = useState<BloomLevel[]>(['understand', 'apply']);
    const [isGenerating, setIsGenerating] = useState(false);
    const [requestId, setRequestId] = useState<string | null>(null);
    const [progress, setProgress] = useState<GenerationProgress>({ status: 'idle' });

    // Subscribe to generation status
    useEffect(() => {
        if (!requestId) return;

        const unsubscribe = subscribeToGenerationStatus(requestId, (status, result, error) => {
            setProgress({
                status: status as GenerationStatus,
                activitiesCreated: result?.activitiesCreated,
                totalRequested: activityCount,
                errors: error ? [error] : result?.errors
            });

            if (status === 'completed' || status === 'failed') {
                setIsGenerating(false);
            }
        });

        return unsubscribe;
    }, [requestId, activityCount]);

    const handleGenerate = async () => {
        if (!currentUser || selectedBloomLevels.length === 0) return;

        setIsGenerating(true);
        setProgress({ status: 'pending' });

        try {
            const params: GenerationRequestParams = {
                subject,
                gradeLevel,
                activityCount,
                bloomLevels: selectedBloomLevels,
                topic: topic.trim() || undefined
            };

            const id = await requestActivityGeneration(currentUser.uid, params);
            setRequestId(id);
        } catch (error: any) {
            console.error('Error starting generation:', error);
            setProgress({ status: 'failed', errors: [error.message] });
            setIsGenerating(false);
        }
    };

    const toggleBloomLevel = (level: BloomLevel) => {
        setSelectedBloomLevels(prev =>
            prev.includes(level)
                ? prev.filter(l => l !== level)
                : [...prev, level]
        );
    };

    const resetForm = () => {
        setProgress({ status: 'idle' });
        setRequestId(null);
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                        <IconRobot size={24} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">סוכן יצירת פעילויות</h2>
                        <p className="text-indigo-100 text-sm">יצירה אוטומטית של פעילויות איכותיות לפי תוכנית הלימודים</p>
                    </div>
                </div>
            </div>

            <div className="p-6">
                {/* Generation in Progress or Completed */}
                {(progress.status !== 'idle') && (
                    <div className="mb-6">
                        {/* Status Card */}
                        <div className={`rounded-xl p-4 ${
                            progress.status === 'completed' ? 'bg-green-50 border border-green-200' :
                            progress.status === 'failed' ? 'bg-red-50 border border-red-200' :
                            'bg-blue-50 border border-blue-200'
                        }`}>
                            <div className="flex items-center gap-3">
                                {progress.status === 'pending' && (
                                    <IconLoader size={24} className="text-blue-600 animate-spin" />
                                )}
                                {progress.status === 'processing' && (
                                    <IconSparkles size={24} className="text-blue-600 animate-pulse" />
                                )}
                                {progress.status === 'completed' && (
                                    <IconCheck size={24} className="text-green-600" />
                                )}
                                {progress.status === 'failed' && (
                                    <IconAlertTriangle size={24} className="text-red-600" />
                                )}

                                <div className="flex-1">
                                    <p className={`font-medium ${
                                        progress.status === 'completed' ? 'text-green-900' :
                                        progress.status === 'failed' ? 'text-red-900' :
                                        'text-blue-900'
                                    }`}>
                                        {progress.status === 'pending' && 'ממתין להפעלת הסוכן...'}
                                        {progress.status === 'processing' && `יוצר פעילויות... (${progress.activitiesCreated || 0}/${progress.totalRequested})`}
                                        {progress.status === 'completed' && `נוצרו ${progress.activitiesCreated} פעילויות בהצלחה!`}
                                        {progress.status === 'failed' && 'שגיאה ביצירת הפעילויות'}
                                    </p>
                                    {progress.errors && progress.errors.length > 0 && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {progress.errors[0]}
                                        </p>
                                    )}
                                </div>

                                {(progress.status === 'completed' || progress.status === 'failed') && (
                                    <button
                                        onClick={resetForm}
                                        className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        צור עוד
                                    </button>
                                )}
                            </div>

                            {/* Progress Bar */}
                            {progress.status === 'processing' && (
                                <div className="mt-3">
                                    <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-600 transition-all duration-500"
                                            style={{
                                                width: `${((progress.activitiesCreated || 0) / (progress.totalRequested || 1)) * 100}%`
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Form */}
                {progress.status === 'idle' && (
                    <div className="space-y-6">
                        {/* Subject Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">מקצוע</label>
                            <div className="grid grid-cols-2 gap-3">
                                {SUBJECTS.map(s => {
                                    const Icon = s.icon;
                                    return (
                                        <button
                                            key={s.value}
                                            onClick={() => setSubject(s.value as 'hebrew' | 'science')}
                                            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                                                subject === s.value
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <Icon size={24} />
                                            <span className="font-medium">{s.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Grade Level */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">כיתה</label>
                            <div className="flex gap-3">
                                {GRADE_LEVELS.map(g => (
                                    <button
                                        key={g.value}
                                        onClick={() => setGradeLevel(g.value as 'ה' | 'ו')}
                                        className={`flex-1 py-3 rounded-xl border-2 transition-all font-medium ${
                                            gradeLevel === g.value
                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        {g.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Topic (Optional) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                נושא ספציפי <span className="text-gray-400">(אופציונלי)</span>
                            </label>
                            <input
                                type="text"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="לדוגמה: מערכת העיכול, שורשים ומשקלים..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        {/* Activity Count */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                מספר פעילויות: <span className="text-indigo-600 font-bold">{activityCount}</span>
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={activityCount}
                                onChange={(e) => setActivityCount(Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>1</span>
                                <span>5</span>
                                <span>10</span>
                            </div>
                        </div>

                        {/* Bloom Levels */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">רמות בלום</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {BLOOM_LEVELS.map(b => (
                                    <button
                                        key={b.value}
                                        onClick={() => toggleBloomLevel(b.value)}
                                        className={`p-3 rounded-xl border-2 text-right transition-all ${
                                            selectedBloomLevels.includes(b.value)
                                                ? 'border-indigo-500 bg-indigo-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className={`font-medium ${selectedBloomLevels.includes(b.value) ? 'text-indigo-700' : 'text-gray-900'}`}>
                                            {b.label}
                                        </div>
                                        <div className="text-xs text-gray-500">{b.description}</div>
                                    </button>
                                ))}
                            </div>
                            {selectedBloomLevels.length === 0 && (
                                <p className="text-sm text-red-500 mt-2">יש לבחור לפחות רמת בלום אחת</p>
                            )}
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || selectedBloomLevels.length === 0}
                            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                                isGenerating || selectedBloomLevels.length === 0
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
                            }`}
                        >
                            {isGenerating ? (
                                <>
                                    <IconLoader size={24} className="animate-spin" />
                                    מפעיל את הסוכן...
                                </>
                            ) : (
                                <>
                                    <IconSparkles size={24} />
                                    צור {activityCount} פעילויות
                                </>
                            )}
                        </button>

                        {/* Info */}
                        <p className="text-xs text-gray-500 text-center">
                            הסוכן יוצר פעילויות באופן אוטונומי לפי תוכנית הלימודים של משרד החינוך.
                            כל הפעילויות עוברות בדיקת איכות אוטומטית.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
