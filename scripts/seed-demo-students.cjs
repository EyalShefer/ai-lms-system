/**
 * Seed Demo Students for Dashboard Testing
 *
 * This script creates 3 demo students with full adaptive data
 * for testing the AdaptiveDashboard and TeacherCockpit.
 *
 * Run with: node scripts/seed-demo-students.cjs
 *
 * Note: Requires Firebase emulator or production credentials
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'ai-lms-pro'
    });
}

const db = admin.firestore();

// Demo course for testing
const DEMO_COURSE = {
    id: 'demo-adaptive-course',
    title: 'מתמטיקה - שברים פשוטים',
    topic: 'fractions_basic'
};

// 3 Demo students with different profiles
const DEMO_STUDENTS = [
    {
        id: 'demo-student-struggling',
        name: 'דני כהן',
        email: 'dani@demo.wizdi.co',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dani-struggling',
        profile: {
            type: 'struggling',
            mastery: 0.28,
            accuracy: 0.35,
            hintDependency: 0.72,
            avgResponseTime: 38,
            totalQuestions: 42,
            sessions: 5,
            riskLevel: 'high',
            errorTags: {
                'calculation_error': 15,
                'sign_error': 8,
                'conceptual_misunderstanding': 6,
                'fraction_addition_no_common_denominator': 4
            },
            expectedVariant: 'scaffolding'
        },
        journey: [
            { type: 'question', status: 'failure', timestamp: Date.now() - 3600000 * 5 },
            { type: 'remediation', status: 'viewed', timestamp: Date.now() - 3600000 * 4.9 },
            { type: 'question', status: 'failure', timestamp: Date.now() - 3600000 * 4.8 },
            { type: 'remediation', status: 'viewed', timestamp: Date.now() - 3600000 * 4.7 },
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 4.5 },
            { type: 'question', status: 'failure', timestamp: Date.now() - 3600000 * 4 },
            { type: 'remediation', status: 'viewed', timestamp: Date.now() - 3600000 * 3.9 },
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 3.5 },
            { type: 'content', status: 'viewed', timestamp: Date.now() - 3600000 * 3 },
            { type: 'question', status: 'failure', timestamp: Date.now() - 3600000 * 2.5 }
        ]
    },
    {
        id: 'demo-student-average',
        name: 'מיכל לוי',
        email: 'michal@demo.wizdi.co',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=michal-average',
        profile: {
            type: 'average',
            mastery: 0.58,
            accuracy: 0.67,
            hintDependency: 0.28,
            avgResponseTime: 22,
            totalQuestions: 65,
            sessions: 12,
            riskLevel: 'medium',
            errorTags: {
                'calculation_error': 5,
                'careless_error': 3,
                'sign_error': 2
            },
            expectedVariant: 'original'
        },
        journey: [
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 6 },
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 5.5 },
            { type: 'question', status: 'failure', timestamp: Date.now() - 3600000 * 5 },
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 4.5 },
            { type: 'content', status: 'viewed', timestamp: Date.now() - 3600000 * 4 },
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 3.5 },
            { type: 'question', status: 'failure', timestamp: Date.now() - 3600000 * 3 },
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 2.5 },
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 2 },
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 1.5 }
        ]
    },
    {
        id: 'demo-student-advanced',
        name: 'יוסי פרץ',
        email: 'yossi@demo.wizdi.co',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yossi-advanced',
        profile: {
            type: 'advanced',
            mastery: 0.91,
            accuracy: 0.94,
            hintDependency: 0.03,
            avgResponseTime: 11,
            totalQuestions: 85,
            sessions: 18,
            riskLevel: 'low',
            errorTags: {
                'careless_error': 2
            },
            expectedVariant: 'enrichment'
        },
        journey: [
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 8 },
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 7.5 },
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 7 },
            { type: 'challenge', status: 'success', timestamp: Date.now() - 3600000 * 6.5 },
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 6 },
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 5.5 },
            { type: 'challenge', status: 'success', timestamp: Date.now() - 3600000 * 5 },
            { type: 'question', status: 'failure', timestamp: Date.now() - 3600000 * 4.5 },
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 4 },
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 3.5 },
            { type: 'challenge', status: 'success', timestamp: Date.now() - 3600000 * 3 },
            { type: 'question', status: 'success', timestamp: Date.now() - 3600000 * 2.5 }
        ]
    }
];

async function seedDemoStudents() {
    console.log('🌱 Seeding Demo Students for Adaptive Dashboard Testing...\n');

    try {
        for (const student of DEMO_STUDENTS) {
            console.log(`📚 Creating: ${student.name} (${student.profile.type})`);

            const userRef = db.collection('users').doc(student.id);

            // 1. Create user document
            await userRef.set({
                displayName: student.name,
                email: student.email,
                photoURL: student.avatar,
                role: 'student',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`   ✓ User document created`);

            // 2. Create proficiency vector
            await userRef.collection('profile').doc('proficiency_vector').set({
                topics: {
                    [DEMO_COURSE.topic]: student.profile.mastery,
                    'fractions_advanced': student.profile.mastery * 0.7,
                    'decimals': Math.min(1, student.profile.mastery * 1.15),
                    'percentages': student.profile.mastery * 0.85
                },
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`   ✓ Proficiency vector created (mastery: ${student.profile.mastery})`);

            // 3. Create stats
            await userRef.collection('profile').doc('stats').set({
                performance: {
                    global_accuracy_rate: student.profile.accuracy,
                    average_response_time_sec: student.profile.avgResponseTime,
                    total_questions_attempted: student.profile.totalQuestions
                },
                behavioral: {
                    hint_dependency_score: student.profile.hintDependency,
                    skip_rate: student.profile.type === 'struggling' ? 0.12 : 0.02
                },
                engagement: {
                    last_active_at: admin.firestore.FieldValue.serverTimestamp(),
                    total_sessions: student.profile.sessions
                }
            });
            console.log(`   ✓ Stats created (accuracy: ${student.profile.accuracy})`);

            // 4. Create error fingerprint
            await userRef.collection('profile').doc('error_fingerprint').set({
                errorTags: student.profile.errorTags,
                topMisconceptions: Object.keys(student.profile.errorTags).slice(0, 3),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`   ✓ Error fingerprint created`);

            // 5. Create enrollment
            await db.collection('enrollments').doc(`${student.id}_${DEMO_COURSE.id}`).set({
                studentId: student.id,
                courseId: DEMO_COURSE.id,
                enrolledAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`   ✓ Enrollment created`);

            // 6. Create sessions with interactions
            const numSessions = Math.min(student.profile.sessions, 5);
            for (let s = 0; s < numSessions; s++) {
                const interactions = [];
                const numInteractions = Math.floor(student.profile.totalQuestions / numSessions);

                for (let i = 0; i < numInteractions; i++) {
                    const isCorrect = Math.random() < student.profile.accuracy;
                    interactions.push({
                        questionId: `demo-q-${s}-${i}`,
                        type: 'multiple-choice',
                        isCorrect,
                        responseTime: student.profile.avgResponseTime + (Math.random() - 0.5) * 10,
                        hintsUsed: student.profile.type === 'struggling' && !isCorrect ? Math.floor(Math.random() * 3) : 0,
                        attemptCount: isCorrect ? 1 : Math.floor(Math.random() * 2) + 1,
                        timestamp: Date.now() - (numSessions - s) * 86400000 + i * 120000,
                        variantUsed: student.profile.expectedVariant
                    });
                }

                await userRef.collection('sessions').doc(`demo-session-${s}`).set({
                    courseId: DEMO_COURSE.id,
                    startTime: Date.now() - (numSessions - s) * 86400000,
                    endTime: Date.now() - (numSessions - s) * 86400000 + 1800000,
                    interactions
                });
            }
            console.log(`   ✓ ${numSessions} sessions created\n`);
        }

        console.log('✅ Demo students seeded successfully!\n');
        console.log('📊 Dashboard Data Summary:');
        console.log('=' .repeat(50));
        console.log(`Course ID: ${DEMO_COURSE.id}`);
        console.log(`Course Name: ${DEMO_COURSE.title}`);
        console.log('\nStudents:');
        for (const student of DEMO_STUDENTS) {
            console.log(`  - ${student.name}`);
            console.log(`    ID: ${student.id}`);
            console.log(`    Type: ${student.profile.type}`);
            console.log(`    Risk: ${student.profile.riskLevel}`);
            console.log(`    Mastery: ${(student.profile.mastery * 100).toFixed(0)}%`);
            console.log(`    Accuracy: ${(student.profile.accuracy * 100).toFixed(0)}%`);
            console.log(`    Expected Variant: ${student.profile.expectedVariant}`);
            console.log('');
        }

        console.log('\n🎯 To view in dashboard:');
        console.log(`   1. Navigate to AdaptiveDashboard`);
        console.log(`   2. Use course ID: "${DEMO_COURSE.id}"`);
        console.log(`   3. Or modify getSmartCourseAnalytics to use this course ID`);

    } catch (error) {
        console.error('❌ Error seeding demo students:', error.message);
        console.log('\n💡 If you see credentials error, run:');
        console.log('   gcloud auth application-default login');
        console.log('   OR use Firebase emulator');
    }
}

// Run
seedDemoStudents()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
