import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

export interface SubmissionData {
    assignmentId: string;
    courseId: string;
    studentName: string;
    answers: Record<string, any>;
    submittedAt?: any;
    score?: number;
    maxScore?: number;
}

export const submitAssignment = async (data: SubmissionData) => {
    try {
        const docRef = await addDoc(collection(db, "submissions"), {
            ...data,
            submittedAt: serverTimestamp(),
            status: 'submitted'
        });

        // Attempt to update the student_assignment status if distinct document exists
        try {
            const assignmentRef = doc(db, "student_assignments", data.assignmentId);
            await updateDoc(assignmentRef, {
                status: 'completed',
                completedAt: serverTimestamp(),
                score: data.score
            });
        } catch (updateError) {
            // This is expected if the assignmentId refers to a template (Direct Link) 
            // rather than a tracked student_assignment. We don't want to fail the submission.
            console.log("Note: functional submission, but could not update status tracked document (likely Direct Link mode).", updateError);
        }

        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error submitting assignment:", error);
        throw error;
    }
};
