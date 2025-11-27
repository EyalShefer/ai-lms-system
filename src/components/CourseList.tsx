import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Course } from '../interfaces'; // או ../courseTypes תלוי איך קראת לקובץ

interface CourseListProps {
    onSelectCourse: (courseId: string) => void;
}

const CourseList: React.FC<CourseListProps> = ({ onSelectCourse }) => {
    const { currentUser, loading: authLoading } = useAuth(); // ניקח גם את סטטוס הטעינה של המשתמש
    const [courses, setCourses] = useState<Course[]>([]);
    const [dataLoading, setDataLoading] = useState(true);

    useEffect(() => {
        // 1. אם עדיין בודקים מי המשתמש - נחכה
        if (authLoading) return;

        // 2. אם סיימנו לבדוק ואין משתמש - נפסיק לטעון
        if (!currentUser) {
            setDataLoading(false);
            return;
        }

        console.log("Fetching courses for teacher:", currentUser.uid);

        // 3. שליפת הקורסים
        const q = query(
            collection(db, "courses"),
            where("teacherId", "==", currentUser.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log("Got courses snapshot:", snapshot.size);
            const coursesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Course[];

            setCourses(coursesData);
            setDataLoading(false); // סיימנו לטעון נתונים
        }, (error) => {
            console.error("Firebase Error:", error);
            setDataLoading(false);
            alert("שגיאה בטעינת הקורסים. בדוק את הקונסול (F12).");
        });

        return () => unsubscribe();
    }, [currentUser, authLoading]);

    const handleCreateNewCourse = async () => {
        if (!currentUser) return;

        const newCourseData = {
            title: "קורס חדש (ללא שם)",
            teacherId: currentUser.uid,
            targetAudience: "כללי",
            syllabus: [],
            createdAt: serverTimestamp()
        };

        try {
            const docRef = await addDoc(collection(db, "courses"), newCourseData);
            console.log("Created course:", docRef.id);
            onSelectCourse(docRef.id);
        } catch (e) {
            console.error("Error creating course:", e);
            alert("שגיאה ביצירת קורס");
        }
    };

    // מציגים טעינה רק אם אנחנו באמת מחכים למשהו
    if (authLoading || dataLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                <div className="text-4xl animate-spin">⏳</div>
                <div className="text-gray-500 font-bold">טוען את הקורסים שלך...</div>
                <div className="text-xs text-gray-400">מתחבר לענן...</div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">הקורסים שלי 📚</h1>
                    <p className="text-gray-500">שלום, {currentUser?.email}</p>
                </div>
                <button
                    onClick={handleCreateNewCourse}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all transform hover:-translate-y-1 flex items-center gap-2"
                >
                    <span>+</span> צור קורס חדש
                </button>
            </div>

            {courses.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-300 shadow-sm">
                    <div className="text-6xl mb-4">📭</div>
                    <h3 className="text-xl font-bold text-gray-600">עדיין אין לך קורסים</h3>
                    <p className="text-gray-500 mb-6">צור את הקורס הראשון שלך בעזרת ה-AI!</p>
                    <button onClick={handleCreateNewCourse} className="text-indigo-600 font-bold hover:underline">צור עכשיו</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {courses.map(course => (
                        <div key={course.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex flex-col h-64">
                            <div className="flex-1">
                                <div className="h-20 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg mb-4 flex items-center justify-center text-4xl">
                                    🎓
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2 truncate" title={course.title}>
                                    {course.title}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {course.syllabus?.length || 0} מודולים
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