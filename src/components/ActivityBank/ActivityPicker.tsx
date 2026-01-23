/**
 * ActivityPicker - Modal for selecting activities from the bank to add to a lesson
 */
import React, { useState } from 'react';
import {
    IconX,
    IconCheck,
    IconPlus,
    IconSparkles
} from '@tabler/icons-react';
import ActivityBankBrowser from './ActivityBankBrowser';
import { convertBankActivityToBlock, type BankActivity } from '../../services/activityBankService';
import type { ActivityBlock } from '../../courseTypes';

interface ActivityPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectActivity: (block: ActivityBlock) => void;
    multiSelect?: boolean;
}

export default function ActivityPicker({
    isOpen,
    onClose,
    onSelectActivity,
    multiSelect = false
}: ActivityPickerProps) {
    const [selectedActivities, setSelectedActivities] = useState<BankActivity[]>([]);

    if (!isOpen) return null;

    const handleActivitySelect = (activity: BankActivity) => {
        if (multiSelect) {
            setSelectedActivities(prev => {
                const exists = prev.find(a => a.id === activity.id);
                if (exists) {
                    return prev.filter(a => a.id !== activity.id);
                }
                return [...prev, activity];
            });
        } else {
            // Single select - convert and add immediately
            const block = convertBankActivityToBlock(activity);
            onSelectActivity(block);
            onClose();
        }
    };

    const handleConfirmSelection = () => {
        selectedActivities.forEach(activity => {
            const block = convertBankActivityToBlock(activity);
            onSelectActivity(block);
        });
        setSelectedActivities([]);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-50 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <IconSparkles size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">בחירת פעילות מהמאגר</h2>
                            <p className="text-sm text-gray-500">
                                {multiSelect
                                    ? `נבחרו ${selectedActivities.length} פעילויות`
                                    : 'לחץ על פעילות כדי להוסיף אותה לשיעור'
                                }
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <IconX size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <ActivityBankBrowser
                        embedded
                        onCopyToLesson={handleActivitySelect}
                    />
                </div>

                {/* Footer - only for multi-select */}
                {multiSelect && selectedActivities.length > 0 && (
                    <div className="bg-white px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-600">
                                נבחרו {selectedActivities.length} פעילויות
                            </span>
                            <button
                                onClick={() => setSelectedActivities([])}
                                className="text-red-600 hover:text-red-700 text-sm"
                            >
                                נקה בחירה
                            </button>
                        </div>
                        <button
                            onClick={handleConfirmSelection}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2"
                        >
                            <IconCheck size={18} />
                            הוסף {selectedActivities.length} פעילויות
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
