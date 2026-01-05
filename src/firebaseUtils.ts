import { db, storage } from "./firebase";
import { doc, getDoc, setDoc, writeBatch, collection, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { Course } from "./shared/types/courseTypes";

// Debounce state for saveCourseToFirestore
const SAVE_DEBOUNCE_MS = 2500;
let saveTimeout: NodeJS.Timeout | null = null;
let pendingCourse: Course | null = null;

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

// Internal function that actually performs the save
const executeSave = async (course: Course) => {
    const batch = writeBatch(db);
    const courseRef = doc(db, "courses", course.id);

    // 1. Prepare Main Course Document (Lightweight)
    const lightweightSyllabus = course.syllabus.map(module => ({
        ...module,
        learningUnits: module.learningUnits.map(unit => ({
            id: unit.id,
            title: unit.title,
            type: unit.type,
            isLazy: true, // Marker for new schema
            // Strip heavy content
            baseContent: null,
            activityBlocks: [],
            audioOverview: null
        }))
    }));

    const cleanCourseMain = cleanDataForFirestore({
        ...course,
        syllabus: lightweightSyllabus,
        updatedAt: new Date().toISOString()
    });

    batch.set(courseRef, cleanCourseMain, { merge: true });

    // 2. Prepare Unit Documents (Sub-collection)
    course.syllabus.forEach(module => {
        module.learningUnits.forEach(unit => {
            if (unit.id) {
                const unitRef = doc(db, "courses", course.id, "units", unit.id);
                const cleanUnit = cleanDataForFirestore(unit);
                batch.set(unitRef, cleanUnit, { merge: true });
            }
        });
    });

    await batch.commit();
    console.log("✅ Lesson plan (split) saved successfully:", course.id);
};

// שמירת קורס/מערך שיעור (Split to Sub-collections) - WITH DEBOUNCE
export const saveCourseToFirestore = async (course: Course): Promise<void> => {
    if (!course.id) throw new Error("Course ID is missing");

    // Store the latest course to save
    pendingCourse = course;

    // Return a promise that resolves when the debounced save completes
    return new Promise((resolve, reject) => {
        // Clear existing timeout
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }

        // Set new debounced save
        saveTimeout = setTimeout(async () => {
            const courseToSave = pendingCourse;
            if (!courseToSave) {
                resolve();
                return;
            }

            try {
                await executeSave(courseToSave);
                pendingCourse = null;
                resolve();
            } catch (error) {
                console.error("Error saving lesson plan:", error);
                reject(error);
            }
        }, SAVE_DEBOUNCE_MS);
    });
};

// Force immediate save (use sparingly - for critical saves like wizard completion)
export const saveCourseToFirestoreImmediate = async (course: Course): Promise<void> => {
    if (!course.id) throw new Error("Course ID is missing");

    // Clear any pending debounced save
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    pendingCourse = null;

    try {
        await executeSave(course);
    } catch (error) {
        console.error("Error saving lesson plan:", error);
        throw error;
    }
};

// שמירת יחידה בודדת (Granular Update)
export const saveUnitToFirestore = async (courseId: string, unit: any) => {
    if (!courseId || !unit.id) throw new Error("Missing Course ID or Unit ID");

    const unitRef = doc(db, "courses", courseId, "units", unit.id);
    const cleanUnit = cleanDataForFirestore(unit);

    try {
        await setDoc(unitRef, cleanUnit, { merge: true });
        console.log(`Unit ${unit.id} saved to sub-collection.`);
    } catch (error) {
        console.error(`Error saving unit ${unit.id}:`, error);
        throw error;
    }
};

// טעינת קורס (עם תמיכה בטעינה עצלה/תת-אוספים)
export const getCourseFromFirestore = async (courseId: string): Promise<Course | null> => {
    try {
        const docRef = doc(db, "courses", courseId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const courseData = docSnap.data() as Course;

            // בדיקה אם הקורס בפורמט החדש (Lazy)
            const hasLazyUnits = courseData.syllabus?.some(m => m.learningUnits?.some(u => (u as any).isLazy));

            if (hasLazyUnits) {
                console.log("Loading lazy units for course:", courseId);
                // שליפת כל היחידות מתת-האוסף
                // אופטימיזציה לעתיד: שליפה רק לפי הצורך (Lazy Loading ממש)
                const unitsRef = collection(db, "courses", courseId, "units");
                const unitsSnap = await getDocs(unitsRef);

                const unitsMap = new Map();
                unitsSnap.forEach(doc => {
                    unitsMap.set(doc.id, doc.data());
                });

                // מיזוג היחידות המלאות לתוך הסילבוס
                courseData.syllabus = courseData.syllabus.map(module => ({
                    ...module,
                    learningUnits: module.learningUnits.map(unit => {
                        if ((unit as any).isLazy && unitsMap.has(unit.id)) {
                            // מיזוג: לוקחים את המידע מהמסמך המלא, אך שומרים על הסדר מהסילבוס
                            return unitsMap.get(unit.id) as any;
                        }
                        return unit;
                    })
                }));
            }

            return courseData;
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