import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { generateStudentAnalysis } from '../gemini';

export interface SubmissionData {
    assignmentId: string;
    courseId: string;
    studentName: string;
    answers: Record<string, any>;
    submittedAt?: any;
    score?: number;
    maxScore?: number;
    courseTopic?: string; // Added for context
    telemetry?: Record<string, any>; // Sensor data
}

export const submitAssignment = async (data: SubmissionData) => {
    try {
        // 1. Initial Submission
        const docRef = await addDoc(collection(db, "submissions"), {
            ...data,
            submittedAt: serverTimestamp(),
            status: 'submitted',
            analysisStatus: 'pending' // UI can show "Analyzing..."
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

        // 2. Trigger Async Analysis (Client-side trigger for now, ideally Cloud Function)
        // We do this non-blocking to return fast to UI
        generateStudentAnalysis(data.studentName, data.answers, data.courseTopic || "General Topic")
            .then(async (analysis) => {
                if (analysis) {
                    await updateDoc(docRef, {
                        analytics: analysis,
                        analysisStatus: 'completed'
                    });
                    console.log("Analysis saved for submission:", docRef.id);
                }
            })
            .catch(err => console.error("Analysis trigger failed:", err));

        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error submitting assignment:", error);
        throw error;
    }
};
