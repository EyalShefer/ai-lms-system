import { db, storage } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { Course } from "./courseTypes";

// פונקציית עזר לניקוי נתונים לפני שמירה (מונעת קריסות של undefined ב-Firestore)
const cleanDataForFirestore = (data: any): any => {
    if (Array.isArray(data)) {
        return data.map(cleanDataForFirestore);
    } else if (data !== null && typeof data === 'object') {
        return Object.entries(data).reduce((acc, [key, value]) => {
            if (value !== undefined) {
                acc[key] = cleanDataForFirestore(value);
            }
            return acc;
        }, {} as any);
    }
    return data;
};

// שמירת קורס/מערך שיעור
export const saveCourseToFirestore = async (course: Course) => {
    if (!course.id) throw new Error("Course ID is missing");

    const courseRef = doc(db, "courses", course.id);
    const cleanCourse = cleanDataForFirestore(course);

    // עדכון תאריך שינוי
    cleanCourse.updatedAt = new Date().toISOString();

    try {
        await setDoc(courseRef, cleanCourse, { merge: true });
        console.log("Lesson plan saved successfully:", course.id);
    } catch (error) {
        console.error("Error saving lesson plan:", error);
        throw error;
    }
};

// טעינת קורס
export const getCourseFromFirestore = async (courseId: string): Promise<Course | null> => {
    try {
        const docRef = doc(db, "courses", courseId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as Course;
        } else {
            console.log("No such document!");
            return null;
        }
    } catch (error) {
        console.error("Error getting document:", error);
        throw error;
    }
};

// --- פונקציית העלאת קבצים (תמונות/וידאו) ---
export const uploadMediaFile = async (file: File, folder: string = 'media'): Promise<string> => {
    if (!file) throw new Error("No file provided");

    // בדיקת גודל קובץ
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024; // 50MB לווידאו, 5MB לתמונה

    if (file.size > maxSize) {
        throw new Error(`הקובץ גדול מדי. מקסימום מותר: ${isVideo ? '50MB' : '5MB'}`);
    }

    // יצירת נתיב ייחודי עם Timestamp למניעת דריסת קבצים
    const storagePath = `course_assets/${folder}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);

    try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error("Upload failed:", error);
        throw error;
    }
};