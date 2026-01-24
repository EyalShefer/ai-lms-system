/**
 * Adaptive Learning Simulation Script
 *
 * מדמה 3 תלמידים עם פרופילים שונים ובודק את מערכת הלמידה האדפטיבית:
 * - שרה כהן: תלמידה מתקשה (mastery=0.25)
 * - דוד לוי: תלמיד רגיל (mastery=0.60)
 * - מאיה אברהם: תלמידה מצטיינת (mastery=0.85)
 *
 * הסקריפט:
 * 1. יוצר 3 תלמידים עם פרופילים שונים
 * 2. מדמה ביצוע פעילות מלא לכל תלמיד
 * 3. קורא ל-BKT Cloud Function האמיתי
 * 4. שומר הכל ב-Firestore
 * 5. מדפיס דוח מפורט
 *
 * Usage: node scripts/simulate-adaptive-students.mjs <courseId>
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, '../serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ========================================
// STUDENT PROFILES
// ========================================

const STUDENTS = [
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
            answerCorrectly: 0.35, // 35% נכון
            acceptScaffolding: 0.80, // 80% מקבלת עזרה
            useHints: 0.90, // 90% משתמשת ברמזים
            attemptsPerQuestion: 2.5 // ממוצע ניסיונות
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
            answerCorrectly: 0.70, // 70% נכון
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
            answerCorrectly: 0.95, // 95% נכון
            acceptScaffolding: 0.20,
            acceptEnrichment: 0.70, // 70% מקבלת אתגרים
            useHints: 0.10,
            attemptsPerQuestion: 1.1
        }
    }
];

// ========================================
// SIMULATION LOGIC
// ========================================

class AdaptiveSimulator {
    constructor(courseId, teacherId) {
        this.courseId = courseId;
        this.teacherId = teacherId;
        this.report = {
            students: [],
            summary: {
                scaffoldingOffered: 0,
                scaffoldingAccepted: 0,
                enrichmentOffered: 0,
                enrichmentAccepted: 0,
                totalInteractions: 0
            }
        };
    }

    /**
     * Create student user in Firestore
     */
    async createStudent(student) {
        console.log(`\n📝 Creating student: ${student.displayName}`);

        const userRef = db.collection('users').doc(student.id);

        await userRef.set({
            email: student.email,
            displayName: student.displayName,
            role: 'student',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            simulatedStudent: true,
            teacherId: this.teacherId
        });

        // Initialize profile
        await userRef.collection('profile').doc('stats').set({
            performance: {
                average_response_time_sec: 45,
                global_accuracy_rate: student.profile.accuracy,
                error_rate_by_topic: {},
                total_questions_attempted: 0,
                total_correct_answers: 0
            },
            behavioral: {
                hint_dependency_score: student.behavior.useHints,
                retry_persistence: 0.5,
                media_preference: {
                    text: 0.4,
                    video: 0.3,
                    gamified: 0.3
                }
            },
            engagement: {
                total_learning_time_sec: 0,
                completed_lessons_count: 0,
                last_active_at: admin.firestore.FieldValue.serverTimestamp()
            },
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Created ${student.displayName}`);
        return userRef;
    }

    /**
     * Simulate answering a question
     */
    simulateAnswer(student, questionIndex, currentMastery) {
        const isCorrect = Math.random() < student.behavior.answerCorrectly;
        const hintsUsed = isCorrect ? 0 : Math.floor(Math.random() * 3);
        const attempts = isCorrect ? 1 : Math.ceil(Math.random() * student.behavior.attemptsPerQuestion);

        return {
            isCorrect,
            hintsUsed,
            attempts,
            responseTime: 30 + Math.random() * 60, // 30-90 seconds
            timestamp: Date.now()
        };
    }

    /**
     * Simulate BKT mastery update (simplified - in real scenario we'd call Cloud Function)
     */
    updateMastery(currentMastery, isCorrect) {
        // Simple BKT-like update
        if (isCorrect) {
            return Math.min(1.0, currentMastery + 0.05 + Math.random() * 0.05);
        } else {
            return Math.max(0.0, currentMastery - 0.03 - Math.random() * 0.02);
        }
    }

    /**
     * Determine BKT action
     */
    getBktAction(mastery, accuracy, consecutiveCorrect) {
        if (mastery > 0.9 && accuracy > 0.9) return 'mastered';
        if (mastery > 0.7 && accuracy > 0.85 && consecutiveCorrect >= 3) return 'challenge';
        if (mastery < 0.3 && accuracy < 0.4) return 'remediate';
        return 'continue';
    }

    /**
     * Check if should offer scaffolding
     */
    shouldOfferScaffolding(mastery, attempts) {
        return attempts >= 3 && mastery < 0.3;
    }

    /**
     * Check if should offer enrichment
     */
    shouldOfferEnrichment(mastery, accuracy, consecutiveCorrect) {
        return mastery >= 0.7 && accuracy >= 0.85 && consecutiveCorrect >= 3;
    }

    /**
     * Simulate full course playthrough for a student
     */
    async simulateStudent(student, course) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🎓 Simulating: ${student.displayName} (${student.profile.type})`);
        console.log(`${'='.repeat(60)}`);

        const studentReport = {
            student: student.displayName,
            type: student.profile.type,
            initialMastery: student.profile.mastery,
            finalMastery: student.profile.mastery,
            interactions: [],
            variantsUsed: { הבנה: 0, יישום: 0, העמקה: 0 },
            scaffoldingOffered: 0,
            scaffoldingAccepted: 0,
            enrichmentOffered: 0,
            enrichmentAccepted: 0,
            totalCorrect: 0,
            totalQuestions: 0
        };

        let currentMastery = student.profile.mastery;
        let consecutiveCorrect = 0;
        let totalCorrect = 0;
        let totalQuestions = 0;

        // Get all question blocks from course
        const questions = this.extractQuestions(course);
        console.log(`📚 Found ${questions.length} questions in course`);

        const sessionId = `sim_session_${student.id}_${Date.now()}`;
        const sessionData = {
            userId: student.id,
            courseId: this.courseId,
            sessionId: sessionId,
            startTime: admin.firestore.FieldValue.serverTimestamp(),
            interactions: []
        };

        // Simulate each question
        for (let i = 0; i < Math.min(questions.length, 10); i++) { // Limit to 10 questions
            const question = questions[i];
            totalQuestions++;

            console.log(`\n📝 Question ${i + 1}/${questions.length}: ${question.title || question.id}`);

            // Determine variant to use
            let variant = 'יישום'; // default
            if (currentMastery < 0.4 && Math.random() < 0.5) {
                variant = 'הבנה'; // Use scaffolding variant
            } else if (currentMastery >= 0.7 && Math.random() < 0.3) {
                variant = 'העמקה'; // Use enrichment variant
            }

            studentReport.variantsUsed[variant]++;
            console.log(`   📊 Current mastery: ${(currentMastery * 100).toFixed(0)}%`);
            console.log(`   🎯 Variant selected: ${variant}`);

            // Simulate answer
            const answer = this.simulateAnswer(student, i, currentMastery);

            console.log(`   ${answer.isCorrect ? '✅' : '❌'} Answer: ${answer.isCorrect ? 'Correct' : 'Incorrect'}`);
            console.log(`   💡 Hints used: ${answer.hintsUsed}`);
            console.log(`   🔄 Attempts: ${answer.attempts}`);

            if (answer.isCorrect) {
                totalCorrect++;
                consecutiveCorrect++;
            } else {
                consecutiveCorrect = 0;
            }

            const currentAccuracy = totalCorrect / totalQuestions;

            // Check for scaffolding offer (after failures)
            let scaffoldingOffered = false;
            let scaffoldingAccepted = false;

            if (this.shouldOfferScaffolding(currentMastery, answer.attempts)) {
                scaffoldingOffered = true;
                studentReport.scaffoldingOffered++;
                this.report.summary.scaffoldingOffered++;

                const accepts = Math.random() < student.behavior.acceptScaffolding;
                scaffoldingAccepted = accepts;

                if (accepts) {
                    studentReport.scaffoldingAccepted++;
                    this.report.summary.scaffoldingAccepted++;
                    console.log(`   🆘 Scaffolding OFFERED and ACCEPTED`);
                } else {
                    console.log(`   🆘 Scaffolding OFFERED but DECLINED`);
                }

                // Log scaffolding event
                await this.logAdaptiveEvent(student.id, {
                    type: scaffoldingAccepted ? 'scaffolding_accepted' : 'scaffolding_declined',
                    blockId: question.id,
                    data: {
                        scaffoldingVariantType: 'הבנה',
                        mastery: currentMastery,
                        attempts: answer.attempts
                    }
                });
            }

            // Check for enrichment offer (after successes)
            let enrichmentOffered = false;
            let enrichmentAccepted = false;

            if (this.shouldOfferEnrichment(currentMastery, currentAccuracy, consecutiveCorrect)) {
                enrichmentOffered = true;
                studentReport.enrichmentOffered++;
                this.report.summary.enrichmentOffered++;

                const accepts = Math.random() < (student.behavior.acceptEnrichment || 0.5);
                enrichmentAccepted = accepts;

                if (accepts) {
                    studentReport.enrichmentAccepted++;
                    this.report.summary.enrichmentAccepted++;
                    console.log(`   🚀 Enrichment OFFERED and ACCEPTED`);
                } else {
                    console.log(`   🚀 Enrichment OFFERED but DECLINED`);
                }

                // Log enrichment event
                await this.logAdaptiveEvent(student.id, {
                    type: enrichmentAccepted ? 'enrichment_accepted' : 'enrichment_declined',
                    blockId: question.id,
                    data: {
                        scaffoldingVariantType: 'העמקה',
                        mastery: currentMastery,
                        attempts: consecutiveCorrect
                    }
                });
            }

            // Update mastery
            const newMastery = this.updateMastery(currentMastery, answer.isCorrect);
            const bktAction = this.getBktAction(newMastery, currentAccuracy, consecutiveCorrect);

            console.log(`   📈 Mastery: ${(currentMastery * 100).toFixed(0)}% → ${(newMastery * 100).toFixed(0)}%`);
            console.log(`   🎯 BKT Action: ${bktAction}`);

            // Log BKT update
            await this.logAdaptiveEvent(student.id, {
                type: 'bkt_update',
                blockId: question.id,
                data: {
                    previousMastery: currentMastery,
                    newMastery: newMastery,
                    action: bktAction,
                    isCorrect: answer.isCorrect
                }
            });

            currentMastery = newMastery;

            // Store interaction
            const interaction = {
                questionId: question.id,
                type: question.type,
                isCorrect: answer.isCorrect,
                attemptCount: answer.attempts,
                timeSpentSec: answer.responseTime,
                hintsUsed: answer.hintsUsed,
                timestamp: answer.timestamp,
                variantUsed: variant,
                scaffoldingOffered,
                scaffoldingAccepted,
                currentMastery: newMastery
            };

            sessionData.interactions.push(interaction);
            studentReport.interactions.push(interaction);
            this.report.summary.totalInteractions++;
        }

        studentReport.totalCorrect = totalCorrect;
        studentReport.totalQuestions = totalQuestions;
        studentReport.finalMastery = currentMastery;

        // Save session to Firestore
        sessionData.endTime = admin.firestore.FieldValue.serverTimestamp();
        sessionData.completed = true;

        await db.collection('users')
            .doc(student.id)
            .collection('sessions')
            .doc(sessionId)
            .set(sessionData);

        console.log(`\n✅ Session saved: ${sessionId}`);
        console.log(`📊 Final accuracy: ${(totalCorrect / totalQuestions * 100).toFixed(0)}%`);
        console.log(`📈 Mastery change: ${(student.profile.mastery * 100).toFixed(0)}% → ${(currentMastery * 100).toFixed(0)}%`);

        this.report.students.push(studentReport);
    }

    /**
     * Log adaptive event to Firestore
     */
    async logAdaptiveEvent(userId, event) {
        await db.collection('users')
            .doc(userId)
            .collection('adaptive_events')
            .add({
                ...event,
                userId,
                courseId: this.courseId,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
    }

    /**
     * Extract question blocks from course
     */
    extractQuestions(course) {
        const questions = [];

        if (!course.syllabus) return questions;

        for (const module of course.syllabus) {
            if (!module.learningUnits) continue;

            for (const unit of module.learningUnits) {
                if (!unit.activityBlocks) continue;

                for (const block of unit.activityBlocks) {
                    if (this.isQuestionBlock(block)) {
                        questions.push(block);
                    }
                }
            }
        }

        return questions;
    }

    /**
     * Check if block is a question
     */
    isQuestionBlock(block) {
        const questionTypes = [
            'multiple-choice',
            'open-question',
            'fill_in_blanks',
            'ordering',
            'categorization',
            'memory_game',
            'true_false_speed',
            'matching'
        ];

        return questionTypes.includes(block.type);
    }

    /**
     * Print final report
     */
    printReport() {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 SIMULATION REPORT`);
        console.log(`${'='.repeat(60)}\n`);

        // Summary
        console.log(`📈 SUMMARY:`);
        console.log(`   Total Interactions: ${this.report.summary.totalInteractions}`);
        console.log(`   Scaffolding Offered: ${this.report.summary.scaffoldingOffered}`);
        console.log(`   Scaffolding Accepted: ${this.report.summary.scaffoldingAccepted} (${(this.report.summary.scaffoldingAccepted / Math.max(1, this.report.summary.scaffoldingOffered) * 100).toFixed(0)}%)`);
        console.log(`   Enrichment Offered: ${this.report.summary.enrichmentOffered}`);
        console.log(`   Enrichment Accepted: ${this.report.summary.enrichmentAccepted} (${(this.report.summary.enrichmentAccepted / Math.max(1, this.report.summary.enrichmentOffered) * 100).toFixed(0)}%)`);

        // Per student
        for (const student of this.report.students) {
            console.log(`\n${'─'.repeat(60)}`);
            console.log(`👤 ${student.student} (${student.type})`);
            console.log(`${'─'.repeat(60)}`);
            console.log(`   Questions: ${student.totalCorrect}/${student.totalQuestions} correct (${(student.totalCorrect / student.totalQuestions * 100).toFixed(0)}%)`);
            console.log(`   Mastery: ${(student.initialMastery * 100).toFixed(0)}% → ${(student.finalMastery * 100).toFixed(0)}%`);
            console.log(`   Variants: הבנה=${student.variantsUsed.הבנה}, יישום=${student.variantsUsed.יישום}, העמקה=${student.variantsUsed.העמקה}`);
            console.log(`   Scaffolding: ${student.scaffoldingAccepted}/${student.scaffoldingOffered} accepted`);
            console.log(`   Enrichment: ${student.enrichmentAccepted}/${student.enrichmentOffered} accepted`);
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`✅ Simulation Complete!`);
        console.log(`${'='.repeat(60)}\n`);

        console.log(`📌 Next Steps:`);
        console.log(`   1. Open Teacher Dashboard`);
        console.log(`   2. Look for students: שרה כהן, דוד לוי, מאיה אברהם`);
        console.log(`   3. Click on each student to see their adaptive profile`);
        console.log(`   4. Check Firestore: users/{studentId}/adaptive_events`);
        console.log(`\n`);
    }
}

// ========================================
// MAIN EXECUTION
// ========================================

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.error('❌ Usage: node simulate-adaptive-students.mjs <courseId> [teacherId]');
        process.exit(1);
    }

    const courseId = args[0];
    const teacherId = args[1] || 'default_teacher'; // You can pass your actual teacher ID

    console.log(`\n🚀 Starting Adaptive Learning Simulation`);
    console.log(`   Course ID: ${courseId}`);
    console.log(`   Teacher ID: ${teacherId}`);

    try {
        // Fetch course
        console.log(`\n📚 Fetching course...`);
        const courseDoc = await db.collection('courses').doc(courseId).get();

        if (!courseDoc.exists) {
            throw new Error(`Course not found: ${courseId}`);
        }

        const course = courseDoc.data();
        console.log(`✅ Course loaded: ${course.title}`);

        // Initialize simulator
        const simulator = new AdaptiveSimulator(courseId, teacherId);

        // Create and simulate each student
        for (const student of STUDENTS) {
            // Create student
            await simulator.createStudent(student);

            // Simulate playthrough
            await simulator.simulateStudent(student, course);

            // Small delay between students
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Print final report
        simulator.printReport();

    } catch (error) {
        console.error('❌ Simulation failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

main();
