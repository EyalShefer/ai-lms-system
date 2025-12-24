import { db } from '../firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { openai, MODEL_NAME, cleanJsonString } from '../gemini';

export interface GradingResult {
    studentId: string;
    questionId: string;
    grade: number;
    feedback: string;
}

export const gradeBatch = async (
    assignment: any, // The full assignment object containing units->blocks->questions
    submissions: any[] // Array of submission documents (with id and data)
) => {
    console.log("Starting batch grading...", submissions.length, "submissions");

    // 1. Extract Open Questions and Rubrics
    const openQuestions: any[] = [];

    // Traverse units and blocks to find questions
    // assignment.units -> block.type === 'activity' -> block.questions
    // OR if structure is flattened. 
    // Based on previous files, Course structure is complex. We need to handle 'activity' blocks.

    if (assignment.units) {
        assignment.units.forEach((unit: any) => {
            if (unit.blocks) {
                unit.blocks.forEach((block: any) => {
                    if (block.type === 'activity' && block.questions) {
                        block.questions.forEach((q: any) => {
                            if (q.type === 'open-question') {
                                openQuestions.push(q);
                            }
                        });
                    }
                    // Also check for generated content blocks that might have questions embedded?
                    // Currently 'interactive-quiz' or similar? 
                    // Based on gemini.ts, blocks have `type: 'open-question'`.
                    if (block.type === 'open-question') {
                        openQuestions.push(block);
                    }
                    if (block.type === 'multiple-choice') {
                        // MCQs are auto-graded locally usually, but we could batch verified them if needed.
                        // Focusing on open questions for token savings.
                    }
                });
            }
        });
    }

    if (openQuestions.length === 0) {
        console.log("No open questions found to grade.");
        return;
    }

    // 2. Process each question
    for (const question of openQuestions) {
        const questionId = question.id;
        const rubric = question.metadata?.modelAnswer || question.metadata?.teacher_guidelines || "No rubric provided";
        const questionText = question.content.question || question.content;

        // Gather answers for this question
        const pendingAnswers: { studentId: string, submissionId: string, answer: string }[] = [];

        submissions.forEach(sub => {
            // Check if already graded?
            // For now, force regrade or check flag.
            const ans = sub.answers?.[questionId];
            if (ans) {
                pendingAnswers.push({
                    studentId: sub.studentName, // or sub.id
                    submissionId: sub.id,
                    answer: ans
                });
            }
        });

        if (pendingAnswers.length === 0) continue;

        // Batch them (e.g., chunks of 10)
        const CHUNK_SIZE = 10;
        for (let i = 0; i < pendingAnswers.length; i += CHUNK_SIZE) {
            const chunk = pendingAnswers.slice(i, i + CHUNK_SIZE);

            const prompt = `
            You are an expert teacher grading student answers.
            
            Question: "${questionText}"
            
            Teacher Rubric / Ideal Answer:
            "${rubric}"
            
            Task:
            Grade the following ${chunk.length} student answers.
            Provide a grade (0-100) and short constructive feedback (Hebrew) for each.
            
            Input Format:
            [
              { "id": "student_1", "answer": "..." },
              ...
            ]
            
            Output Required: JSON Array
            [
              { "id": "student_1", "grade": 90, "feedback": "Nice job..." }
            ]

            Student Answers:
            ${JSON.stringify(chunk.map((p) => ({ id: p.submissionId, answer: p.answer })))}
            `;

            try {
                const completion = await openai.chat.completions.create({
                    model: MODEL_NAME,
                    messages: [{ role: "system", content: prompt }],
                    response_format: { type: "json_object" }
                });

                const responseText = completion.choices[0].message.content || "[]";
                const grades = JSON.parse(cleanJsonString(responseText));

                // 3. Save results (Batch Write)
                const batch = writeBatch(db);

                // We need to merge this grade into the submission's "grades" map to avoid overwriting other question grades
                // Note: Firestore update with dot notation for nested fields: "grades.questionId": { score: ..., feedback: ... }

                if (Array.isArray(grades.results) || Array.isArray(grades)) {
                    const results = Array.isArray(grades) ? grades : grades.results;

                    results.forEach((res: any) => {
                        const subId = res.id;
                        const subRef = doc(db, "submissions", subId);

                        // Construct nested update
                        // We maintain a 'feedbackMap' in the submission: 
                        // feedbackMap: { [questionId]: { score: 90, feedback: "..." } }

                        batch.update(subRef, {
                            [`feedback.${questionId}`]: {
                                score: res.grade,
                                feedback: res.feedback,
                                gradedAt: new Date()
                            },
                            [`grades.${questionId}`]: res.grade
                            // We might want to update a total 'score' later, but that requires aggregating all questions.
                        });
                    });

                    await batch.commit();
                    console.log(`Saved grades for chunk of ${chunk.length} answers`);
                }

            } catch (e) {
                console.error("Error grading batch:", e);
            }
        }
    }

    console.log("Batch grading complete.");
};
