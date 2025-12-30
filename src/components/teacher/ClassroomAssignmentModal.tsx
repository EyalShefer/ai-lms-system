
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { googleClassroomService } from '../../services/googleClassroom';
import type { ClassroomCourse } from '../../services/googleClassroom';
import { IconBrandGoogle, IconX, IconCheck } from '@tabler/icons-react';

interface ClassroomAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    examTitle: string;
    examId: string;
}

export const ClassroomAssignmentModal: React.FC<ClassroomAssignmentModalProps> = ({ isOpen, onClose, examTitle, examId }) => {
    const { googleClassroomToken } = useAuth();
    const [courses, setCourses] = useState<ClassroomCourse[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCourseId, setSelectedCourseId] = useState<string>('');
    const [isAssigning, setIsAssigning] = useState(false);

    useEffect(() => {
        if (isOpen && googleClassroomToken) {
            loadCourses();
        }
    }, [isOpen, googleClassroomToken]);

    const loadCourses = async () => {
        if (!googleClassroomToken) return;
        setLoading(true);
        try {
            const list = await googleClassroomService.listCourses(googleClassroomToken);
            setCourses(list);
        } catch (error) {
            console.error(error);
            alert("שגיאה בטעינת הקורסים מקלאסרום");
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedCourseId || !googleClassroomToken) return;
        setIsAssigning(true);
        try {
            // Construct assignment link
            // For now assuming localhost/prod distinction, but let's use window.location.origin
            const link = `${window.location.origin}/student?exam=${examId}`;

            await googleClassroomService.createAssignment(googleClassroomToken, selectedCourseId, {
                title: examTitle,
                description: "אנא היכנסו לקישור המצורף כדי לבצע את המבחן. בהצלחה!",
                workType: "ASSIGNMENT",
                state: "PUBLISHED",
                maxPoints: 100,
                materials: [
                    {
                        link: {
                            url: link,
                            title: `מבחן: ${examTitle}`
                        }
                    }
                ]
            });
            alert("המשימה נוצרה בהצלחה ב-Google Classroom!");
            onClose();
        } catch (error) {
            console.error(error);
            alert("שגיאה ביצירת המשימה");
        } finally {
            setIsAssigning(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                <div className="bg-green-50 p-4 border-b border-green-100 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-green-800">
                        <IconBrandGoogle className="w-6 h-6" />
                        <h2 className="font-bold text-lg">שיוך ל-Google Classroom</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-green-100 rounded-full text-green-700 transition-colors">
                        <IconX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="mb-4">
                        <h3 className="font-bold text-gray-700 mb-1">מבחן נבחר:</h3>
                        <p className="text-gray-600 bg-gray-50 p-2 rounded-lg border">{examTitle}</p>
                    </div>

                    {!googleClassroomToken ? (
                        <div className="text-center py-6 text-gray-500">
                            אנא התחבר לחשבון הגוגל שלך כדי להמשיך.
                        </div>
                    ) : loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">בחר כיתה (Course):</label>
                                <select
                                    className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-green-500 bg-white"
                                    value={selectedCourseId}
                                    onChange={(e) => setSelectedCourseId(e.target.value)}
                                >
                                    <option value="">-- בחר כיתה --</option>
                                    {courses.map(course => (
                                        <option key={course.id} value={course.id}>
                                            {course.name} {course.section ? `- ${course.section}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleAssign}
                                disabled={!selectedCourseId || isAssigning}
                                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${!selectedCourseId || isAssigning
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl'
                                    }`}
                            >
                                {isAssigning ? (
                                    <>
                                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></span>
                                        יוצר משימה...
                                    </>
                                ) : (
                                    <>
                                        <IconCheck className="w-5 h-5" />
                                        צור משימה בקלאסרום
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
