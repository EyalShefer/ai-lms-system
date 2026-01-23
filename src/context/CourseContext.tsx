import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { Course, LearningUnit } from '../courseTypes';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, getDoc, collection, getDocs } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext';
import * as GamificationService from '../services/gamificationService';
import type { GamificationProfile } from '../courseTypes';

// Debounce delay for Firestore saves (prevents write stream exhaustion)
const SAVE_DEBOUNCE_MS = 2000;

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

        const cleanUnits = learningUnits.filter((unit: any) => unit !== null && unit !== undefined).map((unit: any) => {
            const unitId = unit.id || uuidv4();
            const activityBlocks = Array.isArray(unit.activityBlocks) ? unit.activityBlocks : [];

            // Filter out null/undefined blocks before mapping
            const cleanBlocks = activityBlocks
                .filter((block: any) => block !== null && block !== undefined)
                .map((block: any) => ({
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
        pdfSource: baseData.pdfSource || null,
        createdAt: baseData.createdAt || null // Preserve createdAt for recent activities
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

    // Debounce refs for Firestore saves
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pendingSaveRef = useRef<{ course: Course; bookContent: string; pdf: string | null } | null>(null);

    // Refs to access latest values without causing re-renders
    const courseRef = useRef(course);
    const fullBookContentRef = useRef(fullBookContent);
    const pdfSourceRef = useRef(pdfSource);
    courseRef.current = course;
    fullBookContentRef.current = fullBookContent;
    pdfSourceRef.current = pdfSource;

    // Flag to prevent onSnapshot from overwriting local state during active editing
    // This prevents race conditions where Firestore returns stale data before the save completes
    const isLocalUpdateRef = useRef(false);
    const localUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    const loadCourse = React.useCallback((id: string) => {
        console.log('[CourseContext] loadCourse called with id:', id);
        setCurrentCourseId(id);
    }, []);

    useEffect(() => {
        if (!currentCourseId) {
            console.log('[CourseContext] No currentCourseId, skipping load');
            return;
        }

        console.log('[CourseContext] Setting up onSnapshot for courseId:', currentCourseId);

        // האזנה לשינויים במסמך
        const unsubscribe = onSnapshot(doc(db, "courses", currentCourseId), async (docSnap) => {
            console.log('[CourseContext] onSnapshot callback - exists:', docSnap.exists());
            if (docSnap.exists()) {
                const data = docSnap.data() as Course;

                // בדיקה אם הקורס בפורמט החדש (Lazy) - צריך לטעון יחידות מתת-אוסף
                const hasLazyUnits = data.syllabus?.some(m => m.learningUnits?.some(u => (u as any).isLazy));

                if (hasLazyUnits) {
                    // שליפת כל היחידות מתת-האוסף
                    const unitsRef = collection(db, "courses", currentCourseId, "units");
                    const unitsSnap = await getDocs(unitsRef);

                    const unitsMap = new Map();
                    unitsSnap.forEach(doc => {
                        unitsMap.set(doc.id, doc.data());
                    });

                    // מיזוג היחידות המלאות לתוך הסילבוס
                    data.syllabus = data.syllabus.map(module => ({
                        ...module,
                        learningUnits: module.learningUnits.map(unit => {
                            if ((unit as any).isLazy && unitsMap.has(unit.id)) {
                                return unitsMap.get(unit.id) as any;
                            }
                            return unit;
                        })
                    }));
                }

                if (docSnap.id === currentCourseId) {
                    const newCourse = sanitizeCourseData(data, docSnap.id);

                    // Debug: Log block counts from Firestore
                    const totalBlocks = newCourse.syllabus?.flatMap(m => m.learningUnits?.flatMap(u => u.activityBlocks || []) || [])?.length || 0;
                    const interactiveBlocks = newCourse.syllabus?.flatMap(m => m.learningUnits?.flatMap(u => (u.activityBlocks || []).filter(b => ['multiple-choice', 'ordering', 'categorization'].includes(b?.type))) || [])?.length || 0;
                    console.log(`📦 Firestore snapshot: ${totalBlocks} total blocks, ${interactiveBlocks} interactive`);

                    setCourseState(prev => {
                        // 🛡️ RACE CONDITION FIX: Don't overwrite local state if we just updated it
                        // This prevents Firestore from returning stale data before the save completes
                        if (isLocalUpdateRef.current) {
                            // Compare interactive block counts - local interactive blocks should be preserved
                            const prevInteractive = prev.syllabus?.flatMap(m => m.learningUnits?.flatMap(u => (u.activityBlocks || []).filter(b => ['multiple-choice', 'ordering', 'categorization', 'matching', 'fill-blanks'].includes(b?.type))) || [])?.length || 0;
                            const newInteractive = newCourse.syllabus?.flatMap(m => m.learningUnits?.flatMap(u => (u.activityBlocks || []).filter(b => ['multiple-choice', 'ordering', 'categorization', 'matching', 'fill-blanks'].includes(b?.type))) || [])?.length || 0;

                            // Also compare total blocks
                            const prevBlocks = prev.syllabus?.flatMap(m => m.learningUnits?.flatMap(u => u.activityBlocks || []) || [])?.length || 0;
                            const newBlocks = newCourse.syllabus?.flatMap(m => m.learningUnits?.flatMap(u => u.activityBlocks || []) || [])?.length || 0;

                            // Preserve local state if it has more blocks OR more interactive blocks
                            if (prevBlocks > newBlocks || prevInteractive > newInteractive) {
                                console.log(`🛡️ Preserving local state: ${prevBlocks} blocks (${prevInteractive} interactive) vs Firestore ${newBlocks} blocks (${newInteractive} interactive)`);
                                return prev;
                            }
                        }

                        // Deep comparison to prevent unnecessary re-renders
                        if (JSON.stringify(prev) === JSON.stringify(newCourse)) {
                            // console.log("CourseContext: Data unchanged, skipping update");
                            return prev;
                        }
                        console.log("CourseContext: Data changed, updating state");
                        return newCourse;
                    });
                }
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

    // Debounced save to Firestore - prevents write stream exhaustion
    const saveToCloud = React.useCallback((newCourse: Course, newBookContent: string, newPdf: string | null) => {
        if (!currentCourseId) return;

        // Store the latest data to save
        pendingSaveRef.current = { course: newCourse, bookContent: newBookContent, pdf: newPdf };

        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Set new debounced save
        saveTimeoutRef.current = setTimeout(async () => {
            const pending = pendingSaveRef.current;
            if (!pending) return;

            try {
                const { id, ...courseFields } = pending.course;
                // מנקים undefined כדי שפיירבייס לא יצעק
                const cleanFields = JSON.parse(JSON.stringify(courseFields));

                await setDoc(doc(db, "courses", currentCourseId), {
                    ...cleanFields,
                    fullBookContent: pending.bookContent,
                    pdfSource: pending.pdf,
                    lastUpdated: new Date()
                }, { merge: true });
                console.log("✅ Course saved to Firestore (debounced)");
            } catch (e) {
                console.error("Error saving:", e);
            }
            pendingSaveRef.current = null;
        }, SAVE_DEBOUNCE_MS);
    }, [currentCourseId]);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            if (localUpdateTimeoutRef.current) {
                clearTimeout(localUpdateTimeoutRef.current);
            }
        };
    }, []);

    const setCourse = React.useCallback((newCourse: Course | ((prev: Course) => Course)) => {
        // 🛡️ Set flag to prevent onSnapshot from overwriting our local update
        isLocalUpdateRef.current = true;

        // Clear any existing timeout and set a new one
        if (localUpdateTimeoutRef.current) {
            clearTimeout(localUpdateTimeoutRef.current);
        }

        // Keep the flag active for 5 seconds to allow Firestore batch to complete
        localUpdateTimeoutRef.current = setTimeout(() => {
            isLocalUpdateRef.current = false;
            console.log("🔓 Local update protection expired");
        }, 5000);

        setCourseState((prevCourse) => {
            const resolvedCourse = typeof newCourse === 'function'
                ? (newCourse as (prev: Course) => Course)(prevCourse)
                : newCourse;

            // NOTE: Auto-save removed to avoid conflict with saveCourseToFirestore (sub-collection save)
            // The caller should call saveCourseToFirestore() explicitly after setCourse()
            // This prevents race conditions where saveToCloud (full doc) and saveCourseToFirestore (sub-collections) fight

            return resolvedCourse;
        });
    }, []);

    // Use refs to create stable callbacks that don't change on every render
    const setFullBookContent = React.useCallback((text: string) => {
        setFullBookContentState(text);
        saveToCloud(courseRef.current, text, pdfSourceRef.current);
    }, [saveToCloud]);

    const setPdfSource = React.useCallback((data: string) => {
        setPdfSourceState(data);
        saveToCloud(courseRef.current, fullBookContentRef.current, data);
    }, [saveToCloud]);

    const updateCourseTitle = React.useCallback((newTitle: string) => {
        setCourseState(prev => {
            const updated = { ...prev, title: newTitle };
            saveToCloud(updated, fullBookContentRef.current, pdfSourceRef.current);
            return updated;
        });
    }, [saveToCloud]);

    const updateLearningUnit = React.useCallback((moduleId: string, updatedUnit: LearningUnit) => {
        setCourseState(prev => {
            const updatedCourse = { ...prev };
            updatedCourse.syllabus = updatedCourse.syllabus.map(m => {
                if (m.id !== moduleId) return m;
                return { ...m, learningUnits: m.learningUnits.map(u => u.id === updatedUnit.id ? updatedUnit : u) };
            });
            saveToCloud(updatedCourse, fullBookContentRef.current, pdfSourceRef.current);
            return updatedCourse;
        });
    }, [saveToCloud]);

    // Memoize context value - only re-create when data actually changes
    const contextValue = React.useMemo(() => ({
        course, fullBookContent, pdfSource, currentCourseId,
        gamificationProfile, triggerXp,
        loadCourse, setCourse, setFullBookContent, setPdfSource, updateCourseTitle, updateLearningUnit
    }), [course, fullBookContent, pdfSource, currentCourseId, gamificationProfile, triggerXp, loadCourse, setCourse, setFullBookContent, setPdfSource, updateCourseTitle, updateLearningUnit]);

    return (
        <CourseContext.Provider value={contextValue}>
            {children}
        </CourseContext.Provider>
    );
};

export const useCourseStore = () => {
    const context = useContext(CourseContext);
    if (!context) throw new Error('useCourseStore must be used within a CourseProvider');
    return context;
};