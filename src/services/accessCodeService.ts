/**
 * Access Code Service
 * ניהול קודי גישה לקורסים (8 ספרות)
 */

import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    getDocs,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

// Types
export interface AccessCode {
    code: string;
    courseId: string;
    teacherId: string;
    courseName?: string;
    createdAt: Timestamp | Date;
    expiresAt?: Timestamp | Date | null;
    usageLimit?: number | null;
    usedCount: number;
    isActive: boolean;
    groupType?: 'support' | 'core' | 'enrichment' | null;
}

export interface AccessCodeValidation {
    valid: boolean;
    courseId?: string;
    courseName?: string;
    groupType?: string;
    error?: string;
}

export interface CreateCodeOptions {
    expiresAt?: Date;
    usageLimit?: number;
    groupType?: 'support' | 'core' | 'enrichment';
    customCode?: string;
}

// Collection name
const COLLECTION = 'access_codes';

/**
 * יצירת קוד 8 ספרות אקראי
 */
export const generateCode = (): string => {
    // Generate 8 random digits
    const code = Math.floor(10000000 + Math.random() * 90000000).toString();
    // Format as XXXX-XXXX for readability
    return code;
};

/**
 * פורמט קוד להצגה (XXXX-XXXX)
 */
export const formatCode = (code: string): string => {
    const cleaned = code.replace(/\D/g, '');
    if (cleaned.length === 8) {
        return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    }
    return code;
};

/**
 * ניקוי קוד מפורמט (הסרת מקף)
 */
export const cleanCode = (code: string): string => {
    return code.replace(/\D/g, '');
};

/**
 * יצירת קוד גישה חדש
 */
export const createAccessCode = async (
    courseId: string,
    teacherId: string,
    courseName: string,
    options: CreateCodeOptions = {}
): Promise<AccessCode> => {
    const code = options.customCode || generateCode();

    // Check if code already exists
    const existingDoc = await getDoc(doc(db, COLLECTION, code));
    if (existingDoc.exists()) {
        // Generate new code if exists
        return createAccessCode(courseId, teacherId, courseName, {
            ...options,
            customCode: undefined
        });
    }

    const accessCode: AccessCode = {
        code,
        courseId,
        teacherId,
        courseName,
        createdAt: serverTimestamp() as any,
        expiresAt: options.expiresAt || null,
        usageLimit: options.usageLimit || null,
        usedCount: 0,
        isActive: true,
        groupType: options.groupType || null
    };

    await setDoc(doc(db, COLLECTION, code), accessCode);

    return {
        ...accessCode,
        createdAt: new Date()
    };
};

/**
 * וידוא קוד גישה
 */
export const validateAccessCode = async (code: string): Promise<AccessCodeValidation> => {
    const cleanedCode = cleanCode(code);

    if (cleanedCode.length !== 8) {
        return {
            valid: false,
            error: 'קוד לא תקין - נדרשות 8 ספרות'
        };
    }

    try {
        const codeDoc = await getDoc(doc(db, COLLECTION, cleanedCode));

        if (!codeDoc.exists()) {
            return {
                valid: false,
                error: 'קוד לא קיים'
            };
        }

        const data = codeDoc.data() as AccessCode;

        // Check if active
        if (!data.isActive) {
            return {
                valid: false,
                error: 'קוד לא פעיל'
            };
        }

        // Check expiration
        if (data.expiresAt) {
            const expiryDate = data.expiresAt instanceof Timestamp
                ? data.expiresAt.toDate()
                : new Date(data.expiresAt);

            if (expiryDate < new Date()) {
                return {
                    valid: false,
                    error: 'קוד פג תוקף'
                };
            }
        }

        // Check usage limit
        if (data.usageLimit && data.usedCount >= data.usageLimit) {
            return {
                valid: false,
                error: 'הקוד הגיע למגבלת השימושים'
            };
        }

        return {
            valid: true,
            courseId: data.courseId,
            courseName: data.courseName,
            groupType: data.groupType || undefined
        };
    } catch (error) {
        console.error('Error validating access code:', error);
        return {
            valid: false,
            error: 'שגיאה בבדיקת הקוד'
        };
    }
};

/**
 * הצטרפות לקורס עם קוד
 */
export const joinWithCode = async (
    code: string,
    studentId: string,
    studentName?: string
): Promise<{ success: boolean; courseId?: string; error?: string }> => {
    const validation = await validateAccessCode(code);

    if (!validation.valid) {
        return {
            success: false,
            error: validation.error
        };
    }

    const cleanedCode = cleanCode(code);

    try {
        // Increment usage count
        await updateDoc(doc(db, COLLECTION, cleanedCode), {
            usedCount: (await getDoc(doc(db, COLLECTION, cleanedCode))).data()?.usedCount + 1 || 1
        });

        // Create enrollment (optional - depends on your enrollment system)
        // await addDoc(collection(db, 'enrollments'), {
        //     studentId,
        //     studentName,
        //     courseId: validation.courseId,
        //     joinedViaCode: cleanedCode,
        //     joinedAt: serverTimestamp()
        // });

        return {
            success: true,
            courseId: validation.courseId
        };
    } catch (error) {
        console.error('Error joining with code:', error);
        return {
            success: false,
            error: 'שגיאה בהצטרפות לקורס'
        };
    }
};

/**
 * קבלת כל הקודים של מורה
 */
export const getTeacherCodes = async (teacherId: string): Promise<AccessCode[]> => {
    const q = query(
        collection(db, COLLECTION),
        where('teacherId', '==', teacherId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as AccessCode);
};

/**
 * קבלת כל הקודים של קורס
 */
export const getCourseCodes = async (courseId: string): Promise<AccessCode[]> => {
    const q = query(
        collection(db, COLLECTION),
        where('courseId', '==', courseId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as AccessCode);
};

/**
 * ביטול קוד גישה
 */
export const deactivateCode = async (code: string): Promise<void> => {
    const cleanedCode = cleanCode(code);
    await updateDoc(doc(db, COLLECTION, cleanedCode), {
        isActive: false
    });
};

/**
 * הפעלה מחדש של קוד
 */
export const reactivateCode = async (code: string): Promise<void> => {
    const cleanedCode = cleanCode(code);
    await updateDoc(doc(db, COLLECTION, cleanedCode), {
        isActive: true
    });
};

/**
 * מחיקת קוד
 */
export const deleteAccessCode = async (code: string): Promise<void> => {
    const cleanedCode = cleanCode(code);
    await deleteDoc(doc(db, COLLECTION, cleanedCode));
};

/**
 * עדכון הגדרות קוד
 */
export const updateCodeSettings = async (
    code: string,
    updates: {
        expiresAt?: Date | null;
        usageLimit?: number | null;
        groupType?: 'support' | 'core' | 'enrichment' | null;
    }
): Promise<void> => {
    const cleanedCode = cleanCode(code);
    await updateDoc(doc(db, COLLECTION, cleanedCode), updates);
};

/**
 * איפוס מונה שימושים
 */
export const resetUsageCount = async (code: string): Promise<void> => {
    const cleanedCode = cleanCode(code);
    await updateDoc(doc(db, COLLECTION, cleanedCode), {
        usedCount: 0
    });
};

// Export service object
export const accessCodeService = {
    generateCode,
    formatCode,
    cleanCode,
    createAccessCode,
    validateAccessCode,
    joinWithCode,
    getTeacherCodes,
    getCourseCodes,
    deactivateCode,
    reactivateCode,
    deleteAccessCode,
    updateCodeSettings,
    resetUsageCount
};

export default accessCodeService;
