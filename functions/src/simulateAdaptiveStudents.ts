/**
 * Cloud Function: Simulate Adaptive Students
 *
 * Creates 3 simulated students with different performance profiles
 * and runs them through a course to test adaptive learning features.
 *
 * Usage: Call from frontend or via HTTP
 */

import * as admin from 'firebase-admin';
import type { ActivityBlock } from '../../src/shared/types/courseTypes';

interface StudentProfile {
    id: string;
    email: string;
    displayName: string;
    profile: {
        type: 'struggling' | 'average' | 'advanced';
        mastery: number;
        accuracy: number;
        description: string;
    };
    behavior: {
        answerCorrectly: number;
        acceptScaffolding?: number;
        acceptEnrichment?: number;
        useHints: number;
        attemptsPerQuestion: number;
    };
}

const STUDENTS: StudentProfile[] = [
    {
        id: 'sim_sara_cohen',
        email: 'sara.cohen.sim@example.com',
        displayName: 'שרה כהן',
        profile: {
            type: 'struggling',
            mastery: 0.25,
            accuracy: 0.35,
            description: 'תלמידה מתקשה - צריכה תמיכה ו-scaffolding'
        },
        behavior: {
            answerCorrectly: 0.35,
            acceptScaffolding: 0.80,
            useHints: 0.90,
            attemptsPerQuestion: 2.5
        }
    },
    {
        id: 'sim_david_levi',
        email: 'david.levi.sim@example.com',
        displayName: 'דוד לוי',
        profile: {
            type: 'average',
            mastery: 0.60,
            accuracy: 0.70,
            description: 'תלמיד רגיל - ביצועים ממוצעים'
        },
        behavior: {
            answerCorrectly: 0.70,
            acceptScaffolding: 0.50,
            useHints: 0.40,
            attemptsPerQuestion: 1.5
        }
    },
    {
        id: 'sim_maya_abraham',
        email: 'maya.abraham.sim@example.com',
        displayName: 'מאיה אברהם',
        profile: {
            type: 'advanced',
            mastery: 0.85,
            accuracy: 0.95,
            description: 'תלמידה מצטיינת - מועמדת ל-enrichment'
        },
        behavior: {
            answerCorrectly: 0.95,
            acceptEnrichment: 0.70,
            useHints: 0.10,
            attemptsPerQuestion: 1.1
        }
    }
];

/**
 * Simulate Adaptive Students
 */
export const simulateAdaptiveStudents = async (data: {
    courseId: string;
    teacherId: string;
    numQuestions?: number;
}, context: any) => {
    const db = admin.firestore();
    const { courseId, teacherId, numQuestions = 10 } = data;

    console.log(`🎯 Starting simulation for course: ${courseId}, teacher: ${teacherId}`);

    const results: any[] = [];

    // Get course data
    const courseDoc = await db.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
        throw new Error(`Course ${courseId} not found`);
    }

    const courseData = courseDoc.data();
    console.log(`📚 Course: ${courseData?.title || courseId}`);

    // Validate that this is an Activity (mode='learning'), not a Lesson or Test
    if (courseData?.mode !== 'learning') {
        throw new Error(`Course "${courseData?.title}" is not an Activity (mode: ${courseData?.mode}). Simulation only works on Activities (mode='learning').`);
    }

    // Get course units and blocks
    const unitsSnapshot = await db.collection('courses').doc(courseId).collection('units').get();

    if (unitsSnapshot.empty) {
        throw new Error(`No units found in course ${courseId}. Please add activities to the course first.`);
    }

    // Collect all blocks from all units
    const allBlocks: ActivityBlock[] = [];
    unitsSnapshot.forEach(unitDoc => {
        const unitData = unitDoc.data();
        if (unitData.activityBlocks && Array.isArray(unitData.activityBlocks)) {
            allBlocks.push(...unitData.activityBlocks);
        }
    });

    if (allBlocks.length === 0) {
        throw new Error(`No activity blocks found in course ${courseId}. The course must contain questions/activities.`);
    }

    console.log(`📝 Found ${allBlocks.length} activity blocks across ${unitsSnapshot.size} units`);

    // Use only the first N blocks for simulation
    const blocksToUse = allBlocks.slice(0, Math.min(numQuestions, allBlocks.length));

    // Simulate each student
    for (const student of STUDENTS) {
        console.log(`\n👤 Simulating ${student.displayName} (${student.profile.type})...`);

        try {
            // 1. Create or update user
            let userRecord;
            try {
                userRecord = await admin.auth().getUserByEmail(student.email);
                console.log(`✓ User already exists: ${student.email}`);
            } catch (error: any) {
                if (error.code === 'auth/user-not-found') {
                    userRecord = await admin.auth().createUser({
                        uid: student.id,
                        email: student.email,
                        displayName: student.displayName,
                        emailVerified: true,
                        disabled: false
                    });
                    console.log(`✓ Created user: ${student.email}`);
                } else {
                    throw error;
                }
            }

            const userId = userRecord.uid;

            // 2. Create user profile
            await db.collection('users').doc(userId).set({
                displayName: student.displayName,
                email: student.email,
                role: 'student',
                teacherId: teacherId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                isSimulated: true,
                simulationProfile: student.profile.type
            }, { merge: true });

            // 3. Initialize learning profile
            await db.collection('users').doc(userId).collection('profile').doc('stats').set({
                hint_dependency: student.behavior.useHints,
                media_preference: { text: 0.5, video: 0.3, interactive: 0.2 },
                learning_style: 'visual',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // 4. Clean up old enrollments for this student in this course (avoid duplicates)
            const oldEnrollmentsQuery = db.collection('enrollments')
                .where('studentId', '==', userId)
                .where('courseId', '==', courseId);
            const oldEnrollments = await oldEnrollmentsQuery.get();

            // Delete old enrollments
            const deletePromises = oldEnrollments.docs.map(doc => doc.ref.delete());
            if (deletePromises.length > 0) {
                await Promise.all(deletePromises);
                console.log(`🗑️ Deleted ${deletePromises.length} old enrollments for ${student.displayName}`);
            }

            // 5. Enroll in course (fresh enrollment)
            await db.collection('enrollments').add({
                studentId: userId, // Changed from userId to studentId - matches what dashboard expects
                courseId: courseId,
                enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'active'
            });

            // 6. Clean up old sessions for this student in this course
            const oldSessionsQuery = db.collection('sessions')
                .where('userId', '==', userId)
                .where('courseId', '==', courseId);
            const oldSessions = await oldSessionsQuery.get();

            // Delete old sessions
            const deleteSessionPromises = oldSessions.docs.map(doc => doc.ref.delete());
            if (deleteSessionPromises.length > 0) {
                await Promise.all(deleteSessionPromises);
                console.log(`🗑️ Deleted ${deleteSessionPromises.length} old sessions for ${student.displayName}`);
            }

            // 7. Simulate course session
            const sessionId = `session_${userId}_${Date.now()}`;
            let currentMastery = student.profile.mastery;
            let consecutiveCorrect = 0;
            let consecutiveWrong = 0;
            const interactions: any[] = [];

            // Iterate through actual course blocks
            for (let i = 0; i < blocksToUse.length; i++) {
                const block = blocksToUse[i];
                const questionNum = i + 1;

                // Determine if answer is correct based on student profile
                const isCorrect = Math.random() < student.behavior.answerCorrectly;

                if (isCorrect) {
                    consecutiveCorrect++;
                    consecutiveWrong = 0;
                    // BKT-like update
                    currentMastery = Math.min(0.95, currentMastery + 0.05);
                } else {
                    consecutiveCorrect = 0;
                    consecutiveWrong++;
                    currentMastery = Math.max(0.1, currentMastery - 0.03);
                }

                // Ensure blockId is always defined (fallback to index-based ID)
                const effectiveBlockId = block.id || `block_${i}`;

                const interaction = {
                    blockId: effectiveBlockId,
                    questionId: effectiveBlockId, // For backward compatibility
                    type: block.type || 'multiple-choice',
                    isCorrect,
                    attemptCount: isCorrect ? 1 : Math.ceil(student.behavior.attemptsPerQuestion),
                    timeSpentSec: Math.floor(20 + Math.random() * 40),
                    hintsUsed: isCorrect ? 0 : (Math.random() < student.behavior.useHints ? 1 : 0),
                    timestamp: Date.now(),
                    currentMastery,
                    variantUsed: currentMastery < 0.4 ? 'הבנה' : currentMastery > 0.7 ? 'העמקה' : 'יישום'
                };

                interactions.push(interaction);

                // Log adaptive events
                // Scaffolding for struggling students
                if (consecutiveWrong >= 3 && currentMastery < 0.3) {
                    const acceptScaffolding = Math.random() < (student.behavior.acceptScaffolding || 0.5);

                    await db.collection('users').doc(userId).collection('adaptive_events').add({
                        type: 'scaffolding_offered',
                        blockId: effectiveBlockId,
                        courseId,
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        data: {
                            scaffoldingVariantType: 'הבנה',
                            mastery: currentMastery,
                            attempts: consecutiveWrong
                        }
                    });

                    if (acceptScaffolding) {
                        await db.collection('users').doc(userId).collection('adaptive_events').add({
                            type: 'scaffolding_accepted',
                            blockId: effectiveBlockId,
                            courseId,
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            data: { mastery: currentMastery }
                        });
                        consecutiveWrong = 0; // Reset after accepting help
                    } else {
                        await db.collection('users').doc(userId).collection('adaptive_events').add({
                            type: 'scaffolding_declined',
                            blockId: effectiveBlockId,
                            courseId,
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            data: { mastery: currentMastery }
                        });
                    }
                }

                // Enrichment for advanced students
                if (consecutiveCorrect >= 3 && currentMastery >= 0.7 && student.behavior.answerCorrectly >= 0.85) {
                    const acceptEnrichment = Math.random() < (student.behavior.acceptEnrichment || 0.5);

                    await db.collection('users').doc(userId).collection('adaptive_events').add({
                        type: 'enrichment_offered',
                        blockId: effectiveBlockId,
                        courseId,
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        data: {
                            scaffoldingVariantType: 'העמקה',
                            mastery: currentMastery,
                            attempts: consecutiveCorrect
                        }
                    });

                    if (acceptEnrichment) {
                        await db.collection('users').doc(userId).collection('adaptive_events').add({
                            type: 'enrichment_accepted',
                            blockId: effectiveBlockId,
                            courseId,
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            data: { mastery: currentMastery }
                        });
                    } else {
                        await db.collection('users').doc(userId).collection('adaptive_events').add({
                            type: 'enrichment_declined',
                            blockId: effectiveBlockId,
                            courseId,
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            data: { mastery: currentMastery }
                        });
                    }
                }
            }

            // 8. Save session
            await db.collection('sessions').add({
                userId,
                courseId,
                sessionId,
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                interactions,
                finalMastery: currentMastery,
                totalQuestions: blocksToUse.length,
                correctAnswers: interactions.filter(i => i.isCorrect).length,
                isSimulated: true
            });

            // 9. Update profile with actual simulation results
            const correctAnswersCount = interactions.filter(i => i.isCorrect).length;
            const totalQuestions = blocksToUse.length;
            const simulationAccuracy = totalQuestions > 0 ? correctAnswersCount / totalQuestions : 0;
            const avgResponseTime = interactions.reduce((sum, i) => sum + i.timeSpentSec, 0) / interactions.length;
            const totalHintsUsed = interactions.reduce((sum, i) => sum + i.hintsUsed, 0);
            const hintDependencyScore = totalQuestions > 0 ? totalHintsUsed / totalQuestions : 0;

            // Update profile/stats with complete performance data
            await db.collection('users').doc(userId).collection('profile').doc('stats').set({
                performance: {
                    global_accuracy_rate: simulationAccuracy,
                    total_questions_attempted: totalQuestions,
                    correct_answers: correctAnswersCount,
                    average_response_time_sec: Math.round(avgResponseTime),
                    incorrect_answers: totalQuestions - correctAnswersCount
                },
                behavioral: {
                    hint_dependency_score: hintDependencyScore,
                    average_attempts_per_question: student.behavior.attemptsPerQuestion
                },
                engagement: {
                    total_time_spent_min: Math.round(avgResponseTime * totalQuestions / 60),
                    session_count: 1
                },
                media_preference: { text: 0.5, video: 0.3, interactive: 0.2 },
                learning_style: 'visual',
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Create profile/proficiency with topic mastery
            await db.collection('users').doc(userId).collection('profile').doc('proficiency').set({
                topics: {
                    [courseId]: currentMastery
                },
                overall_mastery: currentMastery,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Create profile/error_fingerprint for struggling students
            if (currentMastery < 0.5) {
                const incorrectInteractions = interactions.filter(i => !i.isCorrect);
                const errorTypes: Record<string, number> = {};

                incorrectInteractions.forEach(i => {
                    const blockType = i.type || 'unknown';
                    errorTypes[blockType] = (errorTypes[blockType] || 0) + 1;
                });

                await db.collection('users').doc(userId).collection('profile').doc('error_fingerprint').set({
                    common_errors: errorTypes,
                    error_rate: 1 - simulationAccuracy,
                    needs_support: currentMastery < 0.4,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            console.log(`✓ Completed ${student.displayName}: Final mastery = ${(currentMastery * 100).toFixed(0)}%, Accuracy = ${(simulationAccuracy * 100).toFixed(0)}%`);

            results.push({
                student: student.displayName,
                userId,
                type: student.profile.type,
                finalMastery: currentMastery,
                correctAnswers: interactions.filter(i => i.isCorrect).length,
                totalQuestions: blocksToUse.length,
                accuracy: interactions.filter(i => i.isCorrect).length / blocksToUse.length
            });

        } catch (error: any) {
            console.error(`❌ Error simulating ${student.displayName}:`, error.message);
            results.push({
                student: student.displayName,
                error: error.message
            });
        }
    }

    console.log('\n✅ Simulation completed!');
    console.log('Results:', results);

    return {
        success: true,
        courseId,
        teacherId,
        results,
        message: `Successfully simulated ${results.filter(r => !r.error).length} students`
    };
};
