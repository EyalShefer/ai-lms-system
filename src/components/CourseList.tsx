import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Course } from '../courseTypes';

interface CourseListProps {
    onSelectCourse: (courseId: string) => void;
}

const CourseList: React.FC<CourseListProps> = ({ onSelectCourse }) => {
    const { currentUser, loading: authLoading } = useAuth();
    const [courses, setCourses] = useState<Course[]>([]);
    const [dataLoading, setDataLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;

        if (!currentUser) {
            setDataLoading(false);
            return;
        }

        const q = query(
            collection(db, "courses"),
            where("teacherId", "==", currentUser.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const coursesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Course[];

            // מיון לפי תאריך יצירה (מהחדש לישן)
            coursesData.sort((a, b) => {
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
            });

            setCourses(coursesData);
            setDataLoading(false);
        }, (error) => {
            console.error("Firebase Error:", error);
            setDataLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, authLoading]);

    const handleCreateNewCourse = async () => {
        if (!currentUser) return;

        const newCourseData = {
            title: "מערך שיעור חדש", // השם ברירת מחדל החדש
            teacherId: currentUser.uid,
            targetAudience: "כללי",
            syllabus: [],
            createdAt: serverTimestamp()
        };

        try {
            const docRef = await addDoc(collection(db, "courses"), newCourseData);
            onSelectCourse(docRef.id);
        } catch (e) {
            console.error("Error creating course:", e);
            alert("שגיאה ביצירת מערך שיעור");
        }
    };

    const handleDeleteCourse = async (courseId: string, courseTitle: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`האם אתה בטוח שברצונך למחוק את מערך השיעור "${courseTitle}"?`)) {
            try {
                await deleteDoc(doc(db, "courses", courseId));
            } catch (error) {
                console.error("Error deleting course:", error);
                alert("שגיאה במחיקת מערך השיעור");
            }
        }
    };

    if (authLoading || dataLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                <div className="text-4xl animate-spin">⏳</div>
                <div className="text-gray-500 font-bold">טוען את מערכי השיעור...</div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">מערכי השיעור שלי 📚</h1>
                    <p className="text-gray-500">שלום, {currentUser?.email}</p>
                </div>
                <button
                    onClick={handleCreateNewCourse}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all transform hover:-translate-y-1 flex items-center gap-2"
                >
                    <span>+</span> צור מערך שיעור חדש
                </button>
            </div>

            {courses.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-300 shadow-sm">
                    <div className="text-6xl mb-4">📭</div>
                    <h3 className="text-xl font-bold text-gray-600">עדיין אין לך מערכי שיעור</h3>
                    <p className="text-gray-500 mb-6">צור את המערך הראשון שלך בעזרת ה-AI!</p>
                    <button onClick={handleCreateNewCourse} className="text-indigo-600 font-bold hover:underline">צור עכשיו</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {courses.map(course => (
                        <div
                            key={course.id}
                            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex flex-col h-64 relative group"
                        >
                            {/* כפתור מחיקה */}
                            <button
                                onClick={(e) => handleDeleteCourse(course.id, course.title, e)}
                                className="absolute top-4 left-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 z-10"
                                title="מחק מערך שיעור"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>

                            <div className="flex-1 cursor-pointer" onClick={() => onSelectCourse(course.id)}>
                                <div className="h-20 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg mb-4 flex items-center justify-center text-4xl">
                                    🎓
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2 truncate" title={course.title}>
                                    {course.title}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {course.syllabus?.length || 0} פרקים
                                </p>
                            </div>

                            <button
                                onClick={() => onSelectCourse(course.id)}
                                className="w-full bg-gray-50 text-indigo-600 py-2 rounded-lg text-sm font-bold hover:bg-indigo-50 border border-indigo-100 mt-4"
                            >
                                פתח עורך ✏️
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CourseList;