import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Course } from '../courseTypes';
import {
    IconTrash, IconLink, IconEdit,
    IconBook, IconRocket, IconCheck, IconList
} from '../icons';

interface CourseListProps {
    onSelectCourse: (courseId: string) => void;
    onCreateNew: (mode: 'learning' | 'exam') => void;
}

const CourseList: React.FC<CourseListProps> = ({ onSelectCourse, onCreateNew }) => {
    const { currentUser, loading: authLoading } = useAuth();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading || !currentUser) return;

        const q = query(
            collection(db, "courses"),
            where("teacherId", "==", currentUser.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const coursesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Course[];

            coursesData.sort((a, b) => {
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
            });

            setCourses(coursesData);
            setLoading(false);
        }, (error) => {
            console.error("Firebase Error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, authLoading]);

    const handleDeleteCourse = async (e: React.MouseEvent, courseId: string, courseTitle: string) => {
        e.stopPropagation();
        if (window.confirm(`האם למחוק את השיעור "${courseTitle}" לצמיתות?`)) {
            try {
                await deleteDoc(doc(db, "courses", courseId));
            } catch (error) {
                console.error("Error deleting course:", error);
                alert("שגיאה במחיקה");
            }
        }
    };

    const handleCopyLink = (e: React.MouseEvent, courseId: string) => {
        e.stopPropagation();
        const link = `${window.location.origin}/?studentCourseId=${courseId}`;
        navigator.clipboard.writeText(link);
        setCopiedId(courseId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (loading) return <div className="h-screen flex items-center justify-center text-gray-500 font-bold bg-gray-50">טוען שיעורים...</div>;

    return (
        <div className="max-w-6xl mx-auto p-8 font-sans pb-24">

            {/* Hero Section */}
            <div className="text-center mb-12 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

                {/* לוגו בלבד - ללא טקסט כותרת */}
                {/* ריווח תחתון מינימלי (mb-1) כדי לקרב את הטקסט */}
                <div className="flex justify-center mb-1 relative z-10">
                    <img
                        src="/WizdiLogo.png"
                        alt="Wizdi Studio"
                        className="h-32 w-auto object-contain hover:scale-105 transition-transform duration-500 drop-shadow-sm"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                </div>

                {/* כותרת משנה - צבע כחול-כהה (text-indigo-900) וקרוב יותר */}
                <p className="text-xl text-indigo-900 relative z-10 font-bold opacity-80 tracking-wide">
                    יצירה, למידה והערכה – הכל במקום אחד
                </p>
            </div>

            {/* Create Bar */}
            <div className="flex flex-col sm:flex-row justify-center gap-6 mb-16 relative z-20">
                <button
                    onClick={() => onCreateNew('learning')}
                    className="group relative bg-white hover:bg-blue-50 border-2 border-blue-100 hover:border-blue-300 text-blue-600 px-6 py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center gap-4 min-w-[220px]"
                >
                    <div className="bg-blue-100 p-3 rounded-xl group-hover:scale-110 transition-transform text-blue-600">
                        <IconBook className="w-8 h-8" />
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-normal text-gray-500">פעילות למידה</div>
                        <div className="text-xl">יצירת שיעור</div>
                    </div>
                </button>

                <button
                    onClick={() => onCreateNew('exam')}
                    className="group relative bg-white hover:bg-red-50 border-2 border-red-100 hover:border-red-300 text-red-600 px-6 py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center gap-4 min-w-[220px]"
                >
                    <div className="bg-red-100 p-3 rounded-xl group-hover:scale-110 transition-transform text-red-600">
                        <IconList className="w-8 h-8" />
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-normal text-gray-500">פעילות הערכה</div>
                        <div className="text-xl">יצירת מבחן</div>
                    </div>
                </button>
            </div>

            {/* Courses Grid */}
            {courses.length === 0 ? (
                <div className="text-center py-20 opacity-60 flex flex-col items-center">
                    <IconRocket className="w-24 h-24 text-gray-300 mb-4" />
                    <div className="text-2xl font-bold text-gray-400">אין פעילויות עדיין</div>
                    <p className="text-gray-400">בחר באחת האפשרויות למעלה כדי להתחיל 👆</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {courses.map(course => (
                        <div
                            key={course.id}
                            onClick={() => onSelectCourse(course.id)}
                            className="glass group bg-white/70 hover:bg-white/90 p-6 rounded-3xl border border-white/60 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[240px]"
                        >
                            <div className={`absolute top-0 left-0 w-full h-1.5 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ${course.mode === 'exam' ? 'bg-gradient-to-r from-red-400 to-pink-500' : 'bg-gradient-to-r from-blue-400 to-indigo-400'}`}></div>

                            <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                                <button
                                    onClick={(e) => handleDeleteCourse(e, course.id, course.title)}
                                    className="p-2 bg-white text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full shadow-sm transition-colors"
                                    title="מחק"
                                >
                                    <IconTrash className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="absolute top-4 right-4 flex gap-2 z-10">
                                <button
                                    onClick={(e) => handleCopyLink(e, course.id)}
                                    className="p-2 bg-white/50 hover:bg-white text-blue-400 hover:text-blue-600 rounded-full transition-colors relative shadow-sm"
                                    title="העתק קישור לתלמיד"
                                >
                                    {copiedId === course.id ? <IconCheck className="w-4 h-4 text-green-500" /> : <IconLink className="w-4 h-4" />}
                                </button>
                            </div>

                            <div className="mt-8 text-center flex flex-col items-center">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 ${course.mode === 'exam' ? 'bg-red-50 text-red-500 group-hover:bg-red-100' : 'bg-blue-50 text-blue-500 group-hover:bg-blue-100'}`}>
                                    {course.mode === 'exam' ? <IconList className="w-8 h-8" /> : <IconBook className="w-8 h-8" />}
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-800 mb-2 leading-tight group-hover:text-blue-700 transition-colors line-clamp-2">
                                    {course.title}
                                </h3>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-xs font-bold bg-gray-100 text-gray-500 px-3 py-1 rounded-full border border-gray-200">
                                        {course.syllabus?.length || 0} פרקים
                                    </span>
                                    {course.mode === 'exam' && (
                                        <span className="text-xs font-bold bg-red-100 text-red-500 px-3 py-1 rounded-full border border-red-200">
                                            מבחן
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-100/50">
                                <button className="w-full py-2 rounded-xl font-bold text-sm transition-all text-blue-600 group-hover:bg-blue-50 flex items-center justify-center gap-2">
                                    הכנס לעריכה <IconEdit className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <style>{`
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                .animate-blob { animation: blob 7s infinite; }
                .animation-delay-2000 { animation-delay: 2s; }
            `}</style>
        </div>
    );
};

export default CourseList;