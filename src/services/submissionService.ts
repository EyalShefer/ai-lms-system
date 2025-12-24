import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface SubmissionData {
    assignmentId: string;
    courseId: string;
    studentName: string;
    answers: Record<string, any>;
    submittedAt?: any;
}

export const submitAssignment = async (data: SubmissionData) => {
    try {
        const docRef = await addDoc(collection(db, "submissions"), {
            ...data,
            submittedAt: serverTimestamp(),
            status: 'submitted'
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error submitting assignment:", error);
        throw error;
    }
};
