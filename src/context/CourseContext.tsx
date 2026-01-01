import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Course, LearningUnit } from '../courseTypes';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext';
import * as GamificationService from '../services/gamificationService';
import type { GamificationProfile } from '../courseTypes';

const initialEmptyCourse: Course = {
    id: 'loading',
    teacherId: '',
    title: 'טוען...',
    targetAudience: '',
    syllabus: []
};

interface CourseContextType {
    course: Course;
    fullBookContent: string;
    pdfSource: string | null;
    currentCourseId: string | null;

    // Gamification
    gamificationProfile: GamificationProfile | null;
    triggerXp: (amount: number, reason: string) => void;

    loadCourse: (id: string) => void;
    setCourse: (course: Course) => void;
    setFullBookContent: (text: string) => void;
    setPdfSource: (data: string) => void;
    updateCourseTitle: (newTitle: string) => void;
    updateLearningUnit: (moduleId: string, updatedUnit: LearningUnit) => void;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

// פונקציה לניקוי וסידור הדאטה שמגיע מ-Firebase
const sanitizeCourseData = (data: any, docId: string): Course => {
    // תמיכה גם במבנה ישן (מקונן) וגם במבנה חדש (שטוח)
    const baseData = data.course ? data.course : data;

    // וידוא שהסילבוס הוא מערך תקין
    const rawSyllabus = Array.isArray(baseData.syllabus) ? baseData.syllabus : [];

    // ניקוי עמוק של הסילבוס (הוספת IDs חסרים)
    const cleanSyllabus = rawSyllabus.map((mod: any) => {
        const modId = mod.id || uuidv4();
        const learningUnits = Array.isArray(mod.learningUnits) ? mod.learningUnits : [];

        const cleanUnits = learningUnits.map((unit: any) => {
            const unitId = unit.id || uuidv4();
            const activityBlocks = Array.isArray(unit.activityBlocks) ? unit.activityBlocks : [];

            const cleanBlocks = activityBlocks.map((block: any) => ({
                ...block,
                id: block.id || uuidv4()
            }));

            return { ...unit, id: unitId, activityBlocks: cleanBlocks };
        });

        return { ...mod, id: modId, learningUnits: cleanUnits };
    });

    // החזרת האובייקט המלא כולל שדות חדשים (mode, wizardData)
    return {
        id: docId,
        teacherId: baseData.teacherId || '',
        title: baseData.title || 'ללא כותרת',
        targetAudience: baseData.targetAudience || '',
        syllabus: cleanSyllabus,
        mode: baseData.mode || baseData.wizardData?.settings?.courseMode || 'learning', // Fallback to wizardData if mode is missing
        wizardData: baseData.wizardData || null, // חשוב: שומר את המידע מהויזארד
        subject: baseData.subject || '',
        gradeLevel: baseData.gradeLevel || '',
        fullBookContent: baseData.fullBookContent || '',
        showSourceToStudent: baseData.showSourceToStudent ?? true, // Default to true if missing
        pdfSource: baseData.pdfSource || null
    } as Course;
};


export const CourseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const [course, setCourseState] = useState<Course>(initialEmptyCourse);
    const [fullBookContent, setFullBookContentState] = useState<string>("");
    const [pdfSource, setPdfSourceState] = useState<string | null>(null);
    const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);

    // Gamification State
    const [gamificationProfile, setGamificationProfile] = useState<GamificationProfile | null>(null);

    // Load Gamification Profile
    useEffect(() => {
        if (!currentUser) {
            setGamificationProfile(null);
            return;
        }

        const profileRef = doc(db, `users/${currentUser.uid}/profile/gamification`);
        const unsubscribe = onSnapshot(profileRef, (snap) => {
            if (snap.exists()) {
                setGamificationProfile(snap.data() as GamificationProfile);
            } else {
                // Initialize if missing
                const init = GamificationService.getInitialProfile();
                setDoc(profileRef, init);
            }
        });

        return () => unsubscribe();
    }, [currentUser]);

    const triggerXp = React.useCallback(async (amount: number, reason: string) => {
        if (!currentUser || !gamificationProfile) return;

        // 1. Calculate New State
        const { newProfile, events } = GamificationService.addXp(gamificationProfile, amount, reason);

        // 2. Persist to Firestore
        try {
            const profileRef = doc(db, `users/${currentUser.uid}/profile/gamification`);
            await setDoc(profileRef, newProfile, { merge: true });
        } catch (e) {
            console.error("Failed to update gamification profile:", e);
        }
    }, [currentUser, gamificationProfile]);

    const loadCourse = React.useCallback((id: string) => setCurrentCourseId(id), []);

    useEffect(() => {
        if (!currentCourseId) return;

        // האזנה לשינויים במסמך
        const unsubscribe = onSnapshot(doc(db, "courses", currentCourseId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setCourseState(sanitizeCourseData(data, docSnap.id));
                setFullBookContentState(data.fullBookContent || "");
                setPdfSourceState(data.pdfSource || null);
            } else {
                // --- התיקון כאן: טיפול עדין יותר במצב של "לא נמצא" ---
                console.warn(`⚠️ הקורס המבוקש (${currentCourseId}) לא נמצא או שטרם נוצר.`);

                const url = new URL(window.location.href);
                // רק אם זה לינק חיצוני של תלמיד - נבצע רענון קשיח
                if (url.searchParams.has('studentCourseId')) {
                    url.searchParams.delete('studentCourseId');
                    window.location.href = url.toString();
                    return;
                }

                // אם אנחנו במצב עריכה רגיל - פשוט נאפס את המצב בלי להרוג את האפליקציה
                // זה מונע לולאת רענון אם יש עיכוב ביצירת המסמך
                setCurrentCourseId(null);
                setCourseState(initialEmptyCourse);
            }
        }, (error) => {
            console.error("Error fetching course:", error);
            // גם במקרה שגיאה, לא מרעננים בכוח
            setCurrentCourseId(null);
        });

        return () => unsubscribe();
    }, [currentCourseId]);

    const saveToCloud = React.useCallback(async (newCourse: Course, newBookContent: string, newPdf: string | null) => {
        if (!currentCourseId) return;
        try {
            const { id, ...courseFields } = newCourse;
            // מנקים undefined כדי שפיירבייס לא יצעק
            const cleanFields = JSON.parse(JSON.stringify(courseFields));

            await setDoc(doc(db, "courses", currentCourseId), {
                ...cleanFields,
                fullBookContent: newBookContent,
                pdfSource: newPdf,
                lastUpdated: new Date()
            }, { merge: true });
        } catch (e) { console.error("Error saving:", e); }
    }, [currentCourseId]);

    const setCourse = React.useCallback((newCourse: Course) => {
        setCourseState(newCourse);
        // We can't access fullBookContent state directly safely in callback if not in dependency, 
        // but state setter is stable.
        // Better to use refs or just accept that fullBookContent might be stale if not updating dependencies?
        // Actually, best to pass all needed data to saveToCloud or just use current state in save helper.
        // But for simplicity and stability, let's keep it simple:
        // We need 'saveToCloud' to have access to latest state.
        // To avoid complex dependency chains, let's just use refs for the side-effect values (content/pdf) 
        // OR just memoize with dependencies.
        // Given the infinite loop was likely just 'loadCourse', let's prioritize that.
        // saveToCloud needs 'currentCourseId'.
        saveToCloud(newCourse, fullBookContent, pdfSource);
    }, [saveToCloud, fullBookContent, pdfSource]);

    // WARNING: Memoizing setCourse with fullBookContent dependency means it changes when content changes.
    // This might trigger re-renders if App depends on setCourse.
    // Ideally, we want 'loadCourse' to be stable (dependency-free).
    // 'setCourse' is less critical for the infinite loop in App.tsx (which depends on loadCourse).

    // Let's TRY just stabilizing 'loadCourse' first, as that is the one App.tsx calls.
    // The others are called by Editor/components.

    const setFullBookContent = (text: string) => { setFullBookContentState(text); saveToCloud(course, text, pdfSource); };
    const setPdfSource = (data: string) => { setPdfSourceState(data); saveToCloud(course, fullBookContent, data); };

    const updateCourseTitle = (newTitle: string) => {
        const updated = { ...course, title: newTitle };
        setCourseState(updated);
        saveToCloud(updated, fullBookContent, pdfSource);
    };

    const updateLearningUnit = (moduleId: string, updatedUnit: LearningUnit) => {
        const updatedCourse = { ...course };
        updatedCourse.syllabus = updatedCourse.syllabus.map(m => {
            if (m.id !== moduleId) return m;
            return { ...m, learningUnits: m.learningUnits.map(u => u.id === updatedUnit.id ? updatedUnit : u) };
        });
        setCourseState(updatedCourse);
        saveToCloud(updatedCourse, fullBookContent, pdfSource);
    };

    return (
        <CourseContext.Provider value={{
            course, fullBookContent, pdfSource, currentCourseId,
            gamificationProfile, triggerXp,
            loadCourse, setCourse, setFullBookContent, setPdfSource, updateCourseTitle, updateLearningUnit
        }}>
            {children}
        </CourseContext.Provider>
    );
};

export const useCourseStore = () => {
    const context = useContext(CourseContext);
    if (!context) throw new Error('useCourseStore must be used within a CourseProvider');
    return context;
};