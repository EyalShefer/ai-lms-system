
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { IconBrandGoogle } from '@tabler/icons-react';

export const ClassroomConnectButton: React.FC = () => {
    const { googleClassroomToken, connectClassroom } = useAuth();

    if (googleClassroomToken) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200">
                <IconBrandGoogle className="w-5 h-5" />
                <span className="text-sm font-bold">מחובר לגוגל קלאסרום</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
        );
    }

    return (
        <button
            onClick={connectClassroom}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all shadow-sm group"
        >
            <IconBrandGoogle className="w-5 h-5 text-gray-500 group-hover:text-amber-500 transition-colors" />
            <span className="text-sm font-bold">חבר את Google Classroom</span>
        </button>
    );
};
