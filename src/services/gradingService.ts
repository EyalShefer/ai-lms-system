import { db } from '../firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { safeGenerationWorkflow, generateGrading } from './ai/geminiApi';

export interface GradingResult {
    studentId: string;
    questionId: string;
    grade: number;
    feedback: string;
}

export const gradeBatch = async (
    assignment: any,
    submissions: any[]
) => {


    // 1. Extract Open Questions
    const openQuestions: any[] = [];
    if (assignment.units) {
        assignment.units.forEach((unit: any) => {
            if (unit.blocks) {
                unit.blocks.forEach((block: any) => {
                    // Check 'activity' blocks with questions
                    if (block.type === 'activity' && block.questions) {
                        block.questions.forEach((q: any) => {
                            if (q.type === 'open-question') openQuestions.push(q);
                        });
                    }
                    // Check direct open question blocks
                    if (block.type === 'open-question') {
                        openQuestions.push(block);
                    }
                });
            }
        });
    }

    if (openQuestions.length === 0) {

        return;
    }

    // 2. Process each question
    for (const question of openQuestions) {
        const questionId = question.id;
        const rubric = question.metadata?.modelAnswer || question.metadata?.teacher_guidelines || "No rubric provided";
        const questionText = question.content?.question || question.content;

        // Gather answers
        const pendingAnswers: { studentId: string, submissionId: string, answer: string }[] = [];
        submissions.forEach(sub => {
            const ans = sub.answers?.[questionId];
            if (ans) {
                pendingAnswers.push({
                    studentId: sub.studentName,
                    submissionId: sub.id,
                    answer: ans
                });
            }
        });

        if (pendingAnswers.length === 0) continue;

        // Batch in chunks
        const CHUNK_SIZE = 5; // Reduced chunk size for better reliability
        for (let i = 0; i < pendingAnswers.length; i += CHUNK_SIZE) {
            const chunk = pendingAnswers.slice(i, i + CHUNK_SIZE);
            const studentAnswersJson = JSON.stringify(chunk.map(p => ({ id: p.submissionId, answer: p.answer })));

            try {
                // Use Safe Workflow with new generateGrading function
                const gradingResults = await safeGenerationWorkflow(
                    () => generateGrading(questionText, rubric, studentAnswersJson),
                    "teachers" // Using 'teachers' audience for professional tone, or generic
                );

                // 3. Save results
                const batch = writeBatch(db);
                if (Array.isArray(gradingResults)) {
                    gradingResults.forEach((res: any) => {
                        if (!res.id || typeof res.grade !== 'number') return;

                        const subRef = doc(db, "submissions", res.id);
                        batch.update(subRef, {
                            [`feedback.${questionId}`]: {
                                score: res.grade,
                                feedback: res.feedback,
                                gradedAt: new Date()
                            },
                            [`grades.${questionId}`]: res.grade
                        });
                    });
                    await batch.commit();

                }
            } catch (e) {
                console.error("Error grading chunk:", e);
            }
        }
    }

};
