/**
 * BagrutAssignmentModal
 * מודל ליצירת משימת תרגול בגרות ושיתוף קישור
 */

import React, { useState, useEffect } from 'react';
import {
    IconX,
    IconSchool,
    IconLink,
    IconCheck,
    IconCopy,
    IconCalendar,
    IconSend
} from '@tabler/icons-react';
import type { BagrutSubject, BagrutPracticeModule, BagrutChapter } from '../shared/types/bagrutTypes';
import { BAGRUT_SUBJECT_LABELS } from '../shared/types/bagrutTypes';
import * as bagrutService from '../services/bagrutService';

interface BagrutAssignmentModalProps {
    teacherId: string;
    teacherName?: string;
    onClose: () => void;
    onCreated?: (assignmentId: string, shareLink: string) => void;
}

export function BagrutAssignmentModal({
    teacherId,
    teacherName,
    onClose,
    onCreated
}: BagrutAssignmentModalProps) {
    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedSubject, setSelectedSubject] = useState<BagrutSubject | null>(null);
    const [selectedModule, setSelectedModule] = useState<BagrutPracticeModule | null>(null);
    const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
    const [dueDate, setDueDate] = useState('');
    const [allowRetry, setAllowRetry] = useState(true);

    // Data state
    const [modules, setModules] = useState<BagrutPracticeModule[]>([]);
    const [loading, setLoading] = useState(false);

    // Result state
    const [createdLink, setCreatedLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Load modules when subject changes
    useEffect(() => {
        if (selectedSubject) {
            loadModules(selectedSubject);
        }
    }, [selectedSubject]);

    async function loadModules(subject: BagrutSubject) {
        try {
            const mods = await bagrutService.getBagrutModules({ subject });
            setModules(mods);
            if (mods.length === 1) {
                setSelectedModule(mods[0]);
            }
        } catch (error) {
            console.error('Error loading modules:', error);
        }
    }

    function handleChapterToggle(chapterId: string) {
        setSelectedChapters(prev =>
            prev.includes(chapterId)
                ? prev.filter(id => id !== chapterId)
                : [...prev, chapterId]
        );
    }

    async function handleCreate() {
        if (!selectedSubject || !selectedModule || selectedChapters.length === 0) {
            return;
        }

        setLoading(true);
        try {
            const assignmentId = await bagrutService.createBagrutAssignment({
                teacherId,
                teacherName,
                title: title || `תרגול ${BAGRUT_SUBJECT_LABELS[selectedSubject]}`,
                description,
                subject: selectedSubject,
                moduleId: selectedModule.id,
                chapterIds: selectedChapters,
                dueDate: dueDate ? new Date(dueDate) : undefined,
                assigneeType: 'all',  // Link-based = open to anyone with link
                isActive: true,
                allowRetry,
                showAnswersAfter: 'immediate'
            });

            // Generate shareable link
            const baseUrl = window.location.origin;
            const shareLink = `${baseUrl}/bagrut/assignment/${assignmentId}`;

            setCreatedLink(shareLink);
            onCreated?.(assignmentId, shareLink);

        } catch (error) {
            console.error('Error creating assignment:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleCopyLink() {
        if (createdLink) {
            navigator.clipboard.writeText(createdLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    const subjects: BagrutSubject[] = ['civics', 'literature', 'bible', 'hebrew', 'english', 'history'];

    // Success view - show link
    if (createdLink) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
                    <div className="bg-gradient-to-l from-emerald-500 to-emerald-600 p-6 text-white">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                <IconCheck size={28} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">המשימה נוצרה!</h2>
                                <p className="opacity-80 text-sm">שתף את הקישור עם התלמידים</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-slate-600 mb-2">
                                קישור לשיתוף
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={createdLink}
                                    readOnly
                                    className="flex-1 px-4 py-3 bg-slate-100 rounded-xl text-sm font-mono text-slate-600"
                                    dir="ltr"
                                />
                                <button
                                    onClick={handleCopyLink}
                                    className={`px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
                                        copied
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED]'
                                    }`}
                                >
                                    {copied ? <IconCheck size={20} /> : <IconCopy size={20} />}
                                    {copied ? 'הועתק!' : 'העתק'}
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                            <h4 className="font-bold text-slate-700 mb-2">איך זה עובד?</h4>
                            <ul className="text-sm text-slate-600 space-y-1">
                                <li>• שלח את הקישור לתלמידים (וואטסאפ, מייל, וכו')</li>
                                <li>• התלמידים לוחצים ונכנסים לתרגול</li>
                                <li>• התוצאות נשמרות ומוצגות לך בדשבורד</li>
                            </ul>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full py-4 bg-[#2B59C3] hover:bg-[#1e40af] text-white rounded-full font-bold transition-colors"
                        >
                            סיום
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Creation form
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="bg-gradient-to-l from-[#8B5CF6] to-[#2B59C3] p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                <IconSchool size={28} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">שליחת משימת תרגול</h2>
                                <p className="opacity-80 text-sm">בחר מקצוע ופרקים לתרגול</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                        >
                            <IconX size={24} />
                        </button>
                    </div>
                </div>

                {/* Form */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {/* Title */}
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-slate-600 mb-2">
                            שם המשימה (אופציונלי)
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="למשל: תרגול לקראת הבחינה"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent"
                        />
                    </div>

                    {/* Subject Selection */}
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-slate-600 mb-2">
                            מקצוע *
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {subjects.map(subject => (
                                <button
                                    key={subject}
                                    onClick={() => {
                                        setSelectedSubject(subject);
                                        setSelectedModule(null);
                                        setSelectedChapters([]);
                                    }}
                                    className={`p-3 rounded-xl font-bold transition-all text-sm ${
                                        selectedSubject === subject
                                            ? 'bg-[#8B5CF6] text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {BAGRUT_SUBJECT_LABELS[subject]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Module Selection */}
                    {selectedSubject && modules.length > 1 && (
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-600 mb-2">
                                מודול
                            </label>
                            <select
                                value={selectedModule?.id || ''}
                                onChange={(e) => {
                                    const mod = modules.find(m => m.id === e.target.value);
                                    setSelectedModule(mod || null);
                                    setSelectedChapters([]);
                                }}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#8B5CF6]"
                            >
                                <option value="">בחר מודול</option>
                                {modules.map(mod => (
                                    <option key={mod.id} value={mod.id}>{mod.title}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Chapter Selection */}
                    {selectedModule && (
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-600 mb-2">
                                פרקים לתרגול *
                            </label>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {selectedModule.chapters.map(chapter => (
                                    <label
                                        key={chapter.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                                            selectedChapters.includes(chapter.id)
                                                ? 'bg-[#8B5CF6]/10 border-2 border-[#8B5CF6]'
                                                : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedChapters.includes(chapter.id)}
                                            onChange={() => handleChapterToggle(chapter.id)}
                                            className="w-5 h-5 rounded border-slate-300 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                                        />
                                        <div className="flex-1">
                                            <span className="font-bold text-slate-700">{chapter.title}</span>
                                            <span className="text-sm text-slate-500 mr-2">
                                                ({chapter.totalQuestions} שאלות)
                                            </span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Due Date */}
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-slate-600 mb-2">
                            תאריך הגשה (אופציונלי)
                        </label>
                        <div className="relative">
                            <IconCalendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#8B5CF6]"
                            />
                        </div>
                    </div>

                    {/* Options */}
                    <div className="mb-6">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={allowRetry}
                                onChange={(e) => setAllowRetry(e.target.checked)}
                                className="w-5 h-5 rounded border-slate-300 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                            />
                            <span className="text-slate-700">אפשר לתלמידים לנסות שוב</span>
                        </label>
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                        <label className="block text-sm font-bold text-slate-600 mb-2">
                            הוראות נוספות (אופציונלי)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="הוראות מיוחדות לתלמידים..."
                            rows={2}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#8B5CF6] resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-200">
                    <button
                        onClick={handleCreate}
                        disabled={loading || !selectedSubject || !selectedModule || selectedChapters.length === 0}
                        className={`w-full py-4 rounded-full font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                            loading || !selectedSubject || !selectedModule || selectedChapters.length === 0
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'btn-lip-action'
                        }`}
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                                יוצר משימה...
                            </>
                        ) : (
                            <>
                                <IconSend size={20} />
                                צור קישור לשיתוף
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default BagrutAssignmentModal;
