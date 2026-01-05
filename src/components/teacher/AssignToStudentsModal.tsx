/**
 * AssignToStudentsModal
 * Modal for teachers to assign activities/exams as tasks to students
 */

import React, { useState } from 'react';
import {
    IconX,
    IconSend,
    IconCalendar,
    IconUsers,
    IconSchool,
    IconFileText,
    IconTrophy,
    IconClock,
    IconCheck,
    IconAlertCircle
} from '@tabler/icons-react';
import { createTask, type CreateTaskParams } from '../../services/taskAssignmentService';
import { useAuth } from '../../context/AuthContext';

interface AssignToStudentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId: string;
    courseTitle: string;
    unitId?: string;
    unitTitle?: string;
    taskType?: 'activity' | 'exam' | 'practice';
}

type AssignmentTarget = 'all' | 'link';

export const AssignToStudentsModal: React.FC<AssignToStudentsModalProps> = ({
    isOpen,
    onClose,
    courseId,
    courseTitle,
    unitId,
    unitTitle,
    taskType = 'activity'
}) => {
    const { currentUser } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [assignmentTarget, setAssignmentTarget] = useState<AssignmentTarget>('all');
    const [title, setTitle] = useState(unitTitle || courseTitle);
    const [instructions, setInstructions] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [dueTime, setDueTime] = useState('23:59');
    const [maxPoints, setMaxPoints] = useState(100);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // Parse due date
            let parsedDueDate: Date | undefined;
            if (dueDate) {
                parsedDueDate = new Date(`${dueDate}T${dueTime}`);
            }

            const params: CreateTaskParams = {
                teacherId: currentUser?.uid || '',
                teacherName: currentUser?.displayName || 'מורה',
                courseId,
                courseTitle,
                unitId,
                unitTitle,
                title,
                instructions,
                assignedTo: 'all',
                dueDate: parsedDueDate,
                maxPoints,
                taskType
            };

            await createTask(params);
            setSuccess(true);

            // Close after showing success
            setTimeout(() => {
                onClose();
                setSuccess(false);
            }, 1500);
        } catch (err: any) {
            console.error('Error creating task:', err);
            setError(err.message || 'שגיאה ביצירת המשימה');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Get tomorrow's date as minimum
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-l from-indigo-600 to-purple-600 px-6 py-5 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-xl">
                                <IconSend size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">שליחה לתלמידים</h2>
                                <p className="text-white/80 text-sm mt-0.5">
                                    {unitTitle ? 'פעילות' : 'קורס'}: {unitTitle || courseTitle}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <IconX size={20} />
                        </button>
                    </div>
                </div>

                {/* Success State */}
                {success ? (
                    <div className="p-12 text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
                            <IconCheck size={40} className="text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">המשימה נשלחה בהצלחה!</h3>
                        <p className="text-gray-500">התלמידים יראו אותה בדשבורד שלהם</p>
                    </div>
                ) : (
                    /* Form */
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {/* Task Title */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                <IconFileText size={16} className="inline ml-1" />
                                כותרת המשימה
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                placeholder="לדוגמה: תרגול פרק 3 - שברים"
                                required
                            />
                        </div>

                        {/* Instructions */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                הוראות לתלמידים (אופציונלי)
                            </label>
                            <textarea
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                                placeholder="הוראות מיוחדות, טיפים, או הערות..."
                            />
                        </div>

                        {/* Due Date & Time */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    <IconCalendar size={16} className="inline ml-1" />
                                    תאריך הגשה
                                </label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    min={minDate}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    <IconClock size={16} className="inline ml-1" />
                                    שעת הגשה
                                </label>
                                <input
                                    type="time"
                                    value={dueTime}
                                    onChange={(e) => setDueTime(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        {/* Max Points */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                <IconTrophy size={16} className="inline ml-1" />
                                ניקוד מקסימלי
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    value={maxPoints}
                                    onChange={(e) => setMaxPoints(Number(e.target.value))}
                                    min={10}
                                    max={1000}
                                    step={10}
                                    className="w-32 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                />
                                <span className="text-gray-500 text-sm">נקודות</span>
                            </div>
                        </div>

                        {/* Assignment Target Info */}
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <IconUsers size={20} className="text-indigo-600 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-indigo-900">נשלח לכל התלמידים</h4>
                                    <p className="text-sm text-indigo-700 mt-1">
                                        המשימה תופיע בדשבורד של כל התלמידים שנכנסים למערכת
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                                <IconAlertCircle size={20} className="text-red-600" />
                                <span className="text-red-700 text-sm">{error}</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                ביטול
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !title.trim()}
                                className="flex-1 px-4 py-3 bg-gradient-to-l from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        שולח...
                                    </>
                                ) : (
                                    <>
                                        <IconSend size={18} />
                                        שלח משימה
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AssignToStudentsModal;
