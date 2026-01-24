/**
 * Bagrut Seeding Progress Checker
 * בדיקת מצב אכלוס תוכן הבגרויות
 *
 * Usage:
 *   npx ts-node src/scripts/checkBagrutProgress.ts
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import * as admin from 'firebase-admin';
import { SUBJECT_CONTEXT } from '../prompts/bagrutPrompts';
import type { BagrutSubject } from '../../../src/shared/types/bagrutTypes';

const PROGRESS_FILE = path.join(__dirname, 'bagrut_seeding_progress.json');

// ============================================
// TYPES
// ============================================

interface SeedingProgress {
    startedAt: string;
    lastUpdated: string;
    subjects: Record<BagrutSubject, SubjectProgress>;
    totalQuestionsGenerated: number;
    totalErrors: number;
}

interface SubjectProgress {
    status: 'pending' | 'in_progress' | 'completed';
    chapters: Record<string, ChapterProgress>;
    moduleId?: string;
}

interface ChapterProgress {
    status: 'pending' | 'in_progress' | 'completed';
    questionsGenerated: number;
    questionIds: string[];
    errors: string[];
}

// ============================================
// MAIN
// ============================================

async function checkProgress(): Promise<void> {
    console.log('\n📊 Bagrut Seeding Progress Report');
    console.log('='.repeat(60));

    // Check local progress file
    console.log('\n📁 Local Progress File:');
    if (fs.existsSync(PROGRESS_FILE)) {
        const progress: SeedingProgress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));

        console.log(`   Started: ${progress.startedAt}`);
        console.log(`   Last Updated: ${progress.lastUpdated}`);
        console.log(`   Total Questions Generated: ${progress.totalQuestionsGenerated}`);
        console.log(`   Total Errors: ${progress.totalErrors}`);

        console.log('\n📚 Subjects Progress:');
        console.log('-'.repeat(60));

        for (const [subject, data] of Object.entries(progress.subjects)) {
            const subjectInfo = SUBJECT_CONTEXT[subject as BagrutSubject];
            const totalChapters = Object.keys(data.chapters).length;
            const completedChapters = Object.values(data.chapters).filter(c => c.status === 'completed').length;
            const totalQuestions = Object.values(data.chapters).reduce((sum, c) => sum + c.questionsGenerated, 0);

            const statusEmoji = data.status === 'completed' ? '✅' :
                               data.status === 'in_progress' ? '🔄' : '⏳';

            console.log(`\n${statusEmoji} ${subjectInfo.hebrewName} (${subject})`);
            console.log(`   Status: ${data.status}`);
            console.log(`   Chapters: ${completedChapters}/${totalChapters}`);
            console.log(`   Questions: ${totalQuestions}`);

            if (data.moduleId) {
                console.log(`   Module ID: ${data.moduleId}`);
            }

            // Show chapter details
            const pendingChapters = Object.entries(data.chapters)
                .filter(([_, c]) => c.status !== 'completed')
                .map(([name, _]) => name);

            if (pendingChapters.length > 0 && pendingChapters.length <= 5) {
                console.log(`   Pending chapters: ${pendingChapters.join(', ')}`);
            } else if (pendingChapters.length > 5) {
                console.log(`   Pending chapters: ${pendingChapters.length} chapters`);
            }

            // Show errors if any
            const totalErrors = Object.values(data.chapters)
                .reduce((sum, c) => sum + c.errors.length, 0);
            if (totalErrors > 0) {
                console.log(`   ⚠️  Errors: ${totalErrors}`);
            }
        }
    } else {
        console.log('   No progress file found. Run the seeder to start.');
    }

    // Check Firestore (if possible)
    try {
        console.log('\n🔥 Firestore Status:');
        console.log('-'.repeat(60));

        // Initialize Firebase if not already
        if (!admin.apps.length) {
            const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');
            if (fs.existsSync(serviceAccountPath)) {
                const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
            } else {
                admin.initializeApp({
                    credential: admin.credential.applicationDefault()
                });
            }
        }

        const db = admin.firestore();

        // Count questions
        const questionsSnapshot = await db.collection('bagrut_questions').count().get();
        const totalQuestions = questionsSnapshot.data().count;

        // Count modules
        const modulesSnapshot = await db.collection('bagrut_modules').get();

        console.log(`\n   Total Questions in DB: ${totalQuestions}`);
        console.log(`   Total Modules: ${modulesSnapshot.size}`);

        // Per-subject breakdown
        console.log('\n   Questions per Subject:');
        for (const subject of Object.keys(SUBJECT_CONTEXT) as BagrutSubject[]) {
            const subjectQuestions = await db.collection('bagrut_questions')
                .where('subject', '==', subject)
                .count()
                .get();

            const count = subjectQuestions.data().count;
            const subjectInfo = SUBJECT_CONTEXT[subject];
            const targetQuestions = subjectInfo.chapters.length * 8; // 8 questions per chapter

            const percentage = Math.round((count / targetQuestions) * 100);
            const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));

            console.log(`   ${subjectInfo.hebrewName.padEnd(10)} [${bar}] ${count}/${targetQuestions} (${percentage}%)`);
        }

        // Module details
        console.log('\n   Modules:');
        for (const doc of modulesSnapshot.docs) {
            const data = doc.data();
            const totalChapterQuestions = data.chapters?.reduce((sum: number, c: any) =>
                sum + (c.questionIds?.length || 0), 0) || 0;
            console.log(`   - ${data.title}: ${totalChapterQuestions} questions`);
        }

    } catch (error) {
        console.log('   Could not connect to Firestore:', (error as Error).message);
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    console.log('-'.repeat(60));

    if (!fs.existsSync(PROGRESS_FILE)) {
        console.log('   - Run: npm run seed:bagrut:full (to start full seeding)');
        console.log('   - Or: npm run seed:bagrut:dry-run (to test first)');
    } else {
        const progress: SeedingProgress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        const incompletSubjects = Object.entries(progress.subjects)
            .filter(([_, d]) => d.status !== 'completed')
            .map(([s, _]) => s);

        if (incompletSubjects.length > 0) {
            console.log('   - Run: npm run seed:bagrut:resume (to continue from last point)');
            console.log(`   - Pending subjects: ${incompletSubjects.join(', ')}`);
        } else {
            console.log('   - All subjects completed! ✅');
        }
    }

    console.log('\n');
    process.exit(0);
}

checkProgress().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
