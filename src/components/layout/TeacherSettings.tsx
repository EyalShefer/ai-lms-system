/**
 * Teacher Settings Page
 * דף הגדרות למורים
 */

import React, { useState } from 'react';
import {
    IconSettings,
    IconBell,
    IconMail,
    IconLanguage,
    IconPalette,
    IconDownload,
    IconShield,
    IconUser,
    IconCheck,
    IconX,
    IconChevronRight,
    IconFlask
} from '@tabler/icons-react';
import { AdaptiveSimulationButton } from '../AdaptiveSimulationButton';

interface TeacherSettingsProps {
    settings?: {
        emailReports: boolean;
        emailFrequency: 'daily' | 'weekly' | 'never';
        language: 'he' | 'en';
        theme: 'light' | 'dark' | 'auto';
        notifications: {
            distressAlerts: boolean;
            lowPerformance: boolean;
            newSubmissions: boolean;
            weeklyReports: boolean;
        };
    };
    onSave?: (settings: TeacherSettingsProps['settings']) => Promise<void>;
    onExportData?: () => Promise<void>;
    className?: string;
}

const DEFAULT_SETTINGS: NonNullable<TeacherSettingsProps['settings']> = {
    emailReports: true,
    emailFrequency: 'weekly',
    language: 'he',
    theme: 'light',
    notifications: {
        distressAlerts: true,
        lowPerformance: true,
        newSubmissions: false,
        weeklyReports: true
    }
};

type SettingsSection = 'profile' | 'notifications' | 'appearance' | 'data' | 'privacy' | 'testing';

export const TeacherSettings: React.FC<TeacherSettingsProps> = ({
    settings: initialSettings = DEFAULT_SETTINGS,
    onSave,
    onExportData,
    className = ''
}) => {
    const [settings, setSettings] = useState(initialSettings);
    const [activeSection, setActiveSection] = useState<SettingsSection>('notifications');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const handleSave = async () => {
        if (!onSave) return;

        setIsSaving(true);
        try {
            await onSave(settings);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (err) {
            console.error('Failed to save settings:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const sections: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
        { id: 'profile', label: 'פרופיל', icon: <IconUser className="w-5 h-5" /> },
        { id: 'notifications', label: 'התראות', icon: <IconBell className="w-5 h-5" /> },
        { id: 'appearance', label: 'תצוגה', icon: <IconPalette className="w-5 h-5" /> },
        { id: 'data', label: 'נתונים', icon: <IconDownload className="w-5 h-5" /> },
        { id: 'privacy', label: 'פרטיות', icon: <IconShield className="w-5 h-5" /> },
        { id: 'testing', label: 'בדיקות מערכת', icon: <IconFlask className="w-5 h-5" /> }
    ];

    return (
        <div className={`bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden ${className}`}>
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-slate-50 to-white">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <IconSettings className="w-6 h-6 text-slate-500" />
                    הגדרות
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    התאם את חוויית השימוש שלך
                </p>
            </div>

            <div className="flex">
                {/* Sidebar */}
                <div className="w-56 border-l border-slate-100 p-4">
                    <nav className="space-y-1">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`
                                    w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors
                                    ${activeSection === section.id
                                        ? 'bg-indigo-100 text-indigo-700'
                                        : 'text-slate-600 hover:bg-slate-100'
                                    }
                                `}
                            >
                                {section.icon}
                                {section.label}
                                <IconChevronRight className="w-4 h-4 mr-auto" />
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1 p-6">
                    {/* Notifications Section */}
                    {activeSection === 'notifications' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-4">העדפות התראות</h3>

                                {/* Email Reports */}
                                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <IconMail className="w-5 h-5 text-slate-500" />
                                            <div>
                                                <h4 className="font-bold text-slate-700">דוחות במייל</h4>
                                                <p className="text-sm text-slate-500">קבל סיכום ביצועי כיתה</p>
                                            </div>
                                        </div>
                                        <Toggle
                                            checked={settings.emailReports}
                                            onChange={(v) => setSettings({ ...settings, emailReports: v })}
                                        />
                                    </div>

                                    {settings.emailReports && (
                                        <div className="pr-8">
                                            <label className="text-sm font-medium text-slate-600 block mb-2">תדירות</label>
                                            <div className="flex gap-2">
                                                {(['daily', 'weekly', 'never'] as const).map((freq) => (
                                                    <button
                                                        key={freq}
                                                        onClick={() => setSettings({ ...settings, emailFrequency: freq })}
                                                        className={`
                                                            px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                                            ${settings.emailFrequency === freq
                                                                ? 'bg-indigo-600 text-white'
                                                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                                            }
                                                        `}
                                                    >
                                                        {freq === 'daily' ? 'יומי' : freq === 'weekly' ? 'שבועי' : 'מושבת'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Notification Types */}
                                <h4 className="font-bold text-slate-700 mb-3">סוגי התראות</h4>
                                <div className="space-y-3">
                                    {[
                                        { key: 'distressAlerts', label: 'התראות מצוקה', desc: 'התראות קריטיות על תלמידים בסיכון' },
                                        { key: 'lowPerformance', label: 'ביצועים נמוכים', desc: 'תלמידים שצריכים חיזוק' },
                                        { key: 'newSubmissions', label: 'הגשות חדשות', desc: 'כאשר תלמידים מגישים פעילות' },
                                        { key: 'weeklyReports', label: 'סיכום שבועי', desc: 'דוח מצב כיתה אחת לשבוע' }
                                    ].map((item) => (
                                        <div key={item.key} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl">
                                            <div>
                                                <h5 className="font-medium text-slate-700">{item.label}</h5>
                                                <p className="text-xs text-slate-500">{item.desc}</p>
                                            </div>
                                            <Toggle
                                                checked={settings.notifications[item.key as keyof typeof settings.notifications]}
                                                onChange={(v) => setSettings({
                                                    ...settings,
                                                    notifications: { ...settings.notifications, [item.key]: v }
                                                })}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Appearance Section */}
                    {activeSection === 'appearance' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">תצוגה</h3>

                            {/* Language */}
                            <div>
                                <label className="text-sm font-bold text-slate-700 block mb-2 flex items-center gap-2">
                                    <IconLanguage className="w-4 h-4" />
                                    שפת ממשק
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSettings({ ...settings, language: 'he' })}
                                        className={`
                                            px-6 py-3 rounded-xl font-medium transition-colors
                                            ${settings.language === 'he'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }
                                        `}
                                    >
                                        עברית
                                    </button>
                                    <button
                                        onClick={() => setSettings({ ...settings, language: 'en' })}
                                        className={`
                                            px-6 py-3 rounded-xl font-medium transition-colors
                                            ${settings.language === 'en'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }
                                        `}
                                    >
                                        English
                                    </button>
                                </div>
                            </div>

                            {/* Theme */}
                            <div>
                                <label className="text-sm font-bold text-slate-700 block mb-2 flex items-center gap-2">
                                    <IconPalette className="w-4 h-4" />
                                    ערכת נושא
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'light', label: 'בהיר', icon: '☀️' },
                                        { id: 'dark', label: 'כהה', icon: '🌙' },
                                        { id: 'auto', label: 'אוטומטי', icon: '⚙️' }
                                    ].map((theme) => (
                                        <button
                                            key={theme.id}
                                            onClick={() => setSettings({ ...settings, theme: theme.id as 'light' | 'dark' | 'auto' })}
                                            className={`
                                                p-4 rounded-xl text-center transition-colors border-2
                                                ${settings.theme === theme.id
                                                    ? 'border-indigo-500 bg-indigo-50'
                                                    : 'border-slate-200 hover:border-slate-300'
                                                }
                                            `}
                                        >
                                            <div className="text-2xl mb-1">{theme.icon}</div>
                                            <div className="font-medium text-slate-700">{theme.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Data Section */}
                    {activeSection === 'data' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">ניהול נתונים</h3>

                            <div className="bg-slate-50 rounded-xl p-6 text-center">
                                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <IconDownload className="w-8 h-8 text-emerald-600" />
                                </div>
                                <h4 className="font-bold text-slate-700 mb-2">ייצוא כל הנתונים</h4>
                                <p className="text-sm text-slate-500 mb-4">
                                    הורד את כל נתוני התלמידים והפעילויות שלך
                                </p>
                                <button
                                    onClick={onExportData}
                                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                                >
                                    הורד נתונים
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Profile Section */}
                    {activeSection === 'profile' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">פרטי פרופיל</h3>
                            <p className="text-sm text-slate-500">
                                פרטי הפרופיל מנוהלים דרך חשבון Google שלך
                            </p>
                        </div>
                    )}

                    {/* Privacy Section */}
                    {activeSection === 'privacy' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">פרטיות ואבטחה</h3>
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                <div className="flex items-center gap-3">
                                    <IconShield className="w-8 h-8 text-green-600" />
                                    <div>
                                        <h4 className="font-bold text-green-700">החשבון שלך מאובטח</h4>
                                        <p className="text-sm text-green-600">
                                            אימות דו-שלבי פעיל דרך Google
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Testing Section */}
                    {activeSection === 'testing' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">בדיקות מערכת</h3>
                            <p className="text-sm text-slate-500 mb-6">
                                כלים לבדיקת תכונות המערכת
                            </p>

                            <AdaptiveSimulationButton />
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                        {saveSuccess && (
                            <span className="flex items-center gap-2 text-green-600 text-sm">
                                <IconCheck className="w-4 h-4" />
                                נשמר!
                            </span>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`
                                px-6 py-2.5 rounded-xl font-bold transition-colors
                                ${isSaving
                                    ? 'bg-slate-200 text-slate-400 cursor-wait'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }
                            `}
                        >
                            {isSaving ? 'שומר...' : 'שמור שינויים'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Toggle component
interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange }) => {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`
                relative w-12 h-6 rounded-full transition-colors
                ${checked ? 'bg-indigo-600' : 'bg-slate-300'}
            `}
        >
            <span
                className={`
                    absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                    ${checked ? 'right-1' : 'right-7'}
                `}
            />
        </button>
    );
};

export default TeacherSettings;
