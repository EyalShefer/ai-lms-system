import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Course } from '../courseTypes';
// וודא שקובץ icons.tsx קיים בתיקיית src
import { IconTrash, IconLink, IconEdit, IconStudent, IconPlus, IconBook } from '../icons';

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
            title: "מערך שיעור חדש",
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

    const handleCopyLink = (courseId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const link = `${window.location.origin}/?studentCourseId=${courseId}`;

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(link).then(() => {
                alert("הקישור הועתק! 🔗\nשלח אותו לתלמידים.");
            });
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = link;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                alert("הקישור הועתק! 🔗\nשלח אותו לתלמידים.");
            } catch (err) {
                console.error('Failed to copy link', err);
            }
            document.body.removeChild(textArea);
        }
    };

    if (authLoading || dataLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                <div className="text-4xl animate-spin text-indigo-600">⏳</div>
                <div className="text-gray-500 font-bold">טוען את מערכי השיעור...</div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto animate-fade-in">
            {/* כותרת ראשית */}
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-800 flex items-center gap-3">
                        מערכי השיעור שלי <IconBook className="w-8 h-8 text-indigo-600 opacity-80" />
                    </h1>
                    <p className="text-gray-500 font-medium mt-2 text-lg">שלום, {currentUser?.email}</p>
                </div>
                <button
                    onClick={handleCreateNewCourse}
                    className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg hover:bg-indigo-700 transition-all transform hover:-translate-y-1 flex items-center gap-3 text-lg"
                >
                    <IconPlus className="w-6 h-6" />
                    <span>צור מערך שיעור חדש</span>
                </button>
            </div>

            {courses.length === 0 ? (
                <div className="text-center py-32 bg-white rounded-3xl border-4 border-dashed border-indigo-100 shadow-sm flex flex-col items-center justify-center">
                    <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6 text-indigo-500">
                        <IconBook className="w-12 h-12" />
                    </div>
                    <h3 className="text-3xl font-bold text-gray-700 mb-3">עדיין אין לך מערכי שיעור</h3>
                    <p className="text-gray-500 mb-8 text-lg max-w-md">התחל ליצור תוכן לימודי מדהים בעזרת הבינה המלאכותית שלנו.</p>
                    <button onClick={handleCreateNewCourse} className="text-indigo-600 font-bold hover:underline text-xl flex items-center gap-2">
                        <IconPlus className="w-5 h-5" /> צור את המערך הראשון
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {courses.map(course => (
                        <div
                            key={course.id}
                            className="bg-white p-6 rounded-3xl shadow-sm border border-white/60 hover:border-indigo-200 transition-all duration-300 flex flex-col h-80 relative group overflow-hidden"
                        >
                            {/* כפתורי פעולה עליונים (מוסתרים עד מעבר עכבר) */}
                            <div className="absolute top-4 left-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button
                                    onClick={(e) => handleDeleteCourse(course.id, course.title, e)}
                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition-colors bg-white shadow-sm"
                                    title="מחק מערך שיעור"
                                >
                                    <IconTrash className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="absolute top-4 right-4 z-20">
                                <button
                                    onClick={(e) => handleCopyLink(course.id, e)}
                                    className="text-gray-400 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition-all"
                                    title="העתק קישור לתלמיד"
                                >
                                    <IconLink className="w-5 h-5" />
                                </button>
                            </div>

                            {/* גוף הכרטיס */}
                            <div className="flex-1 cursor-pointer mt-2 flex flex-col items-center justify-center text-center" onClick={() => onSelectCourse(course.id)}>
                                <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-full mb-5 flex items-center justify-center shadow-inner text-white transform group-hover:scale-110 transition-transform duration-300">
                                    <IconStudent className="w-12 h-12 text-indigo-600 opacity-80" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-800 mb-2 line-clamp-2 px-4 leading-tight" title={course.title}>
                                    {course.title}
                                </h3>
                                <p className="text-sm text-gray-500 font-medium bg-gray-100/80 px-4 py-1.5 rounded-full mt-2">
                                    {course.syllabus?.length || 0} פרקים • {course.targetAudience || "כללי"}
                                </p>
                            </div>

                            {/* כפתור תחתון */}
                            <div className="mt-auto pt-4 w-full">
                                <button
                                    onClick={() => onSelectCourse(course.id)}
                                    className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all bg-indigo-50 text-indigo-600 hover:bg-indigo-500 hover:text-white flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                                >
                                    <IconEdit className="w-4 h-4" />
                                    פתח לעריכה
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CourseList;