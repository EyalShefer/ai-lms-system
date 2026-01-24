/**
 * Curriculum Data Verification Script
 *
 * This script checks and validates the curriculum_standards collection
 * Provides detailed breakdown by subject, grade, and data quality
 *
 * Run with: npx ts-node src/scripts/checkCurriculumData.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../../..', 'service-account-key.json');

// ============================================
// Helper Functions
// ============================================

function getGradeOrder(grade: string): number {
    const order: Record<string, number> = {
        'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6,
        'ז': 7, 'ח': 8, 'ט': 9, 'י': 10, 'יא': 11, 'יב': 12
    };
    return order[grade] || 999;
}

function getHebrewSubjectName(subject: string): string {
    const names: Record<string, string> = {
        math: 'מתמטיקה',
        hebrew: 'עברית',
        english: 'אנגלית',
        bible: 'תנ״ך',
        history: 'היסטוריה',
        geography: 'גיאוגרפיה',
        civics: 'אזרחות',
        science: 'מדעים',
        physics: 'פיזיקה',
        chemistry: 'כימיה',
        biology: 'ביולוגיה',
        cs: 'מדעי המחשב',
        literature: 'ספרות'
    };
    return names[subject] || subject;
}

// ============================================
// Main Check Function
// ============================================

async function checkCurriculumData() {
    console.log('🔍 CURRICULUM DATABASE VERIFICATION');
    console.log('='.repeat(70));
    console.log('');

    // Initialize Firebase
    try {
        const serviceAccount = require(SERVICE_ACCOUNT_PATH);
        initializeApp({
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id
        });
        console.log(`✅ Connected to project: ${serviceAccount.project_id}\n`);
    } catch (e: any) {
        console.log('Firebase init:', e.message);
        try {
            initializeApp();
        } catch {
            // Ignore
        }
    }

    const db = getFirestore();

    try {
        // Fetch all curriculum standards
        const snapshot = await db.collection('curriculum_standards').get();

        if (snapshot.empty) {
            console.log('❌ No curriculum standards found in database!');
            console.log('   Run seedCurriculumWithAI.ts to populate data.');
            return;
        }

        console.log(`📊 Total Standards: ${snapshot.size}\n`);

        // Collect data
        const bySubject: Record<string, number> = {};
        const byGrade: Record<string, number> = {};
        const bySubjectGrade: Record<string, Record<string, number>> = {};
        const byDomain: Record<string, number> = {};
        const allStandards: any[] = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            allStandards.push(data);

            // Count by subject
            bySubject[data.subject] = (bySubject[data.subject] || 0) + 1;

            // Count by grade
            byGrade[data.gradeLevel] = (byGrade[data.gradeLevel] || 0) + 1;

            // Count by subject-grade
            if (!bySubjectGrade[data.subject]) {
                bySubjectGrade[data.subject] = {};
            }
            bySubjectGrade[data.subject][data.gradeLevel] =
                (bySubjectGrade[data.subject][data.gradeLevel] || 0) + 1;

            // Count by domain
            if (data.domain) {
                byDomain[data.domain] = (byDomain[data.domain] || 0) + 1;
            }
        });

        // ============================================
        // 1. Subject Breakdown
        // ============================================
        console.log('📚 BREAKDOWN BY SUBJECT');
        console.log('-'.repeat(70));

        const sortedSubjects = Object.entries(bySubject)
            .sort((a, b) => b[1] - a[1]);

        for (const [subject, count] of sortedSubjects) {
            const hebrewName = getHebrewSubjectName(subject);
            const percentage = ((count / snapshot.size) * 100).toFixed(1);

            console.log(`   ${hebrewName.padEnd(20)} ${count.toString().padStart(4)} תקנים (${percentage}%)`);

            // Show grade distribution for this subject
            if (bySubjectGrade[subject]) {
                const grades = Object.entries(bySubjectGrade[subject])
                    .sort((a, b) => getGradeOrder(a[0]) - getGradeOrder(b[0]));

                const gradesList = grades.map(([g, c]) => `${g}:${c}`).join(' | ');
                console.log(`   ${''.padEnd(20)} כיתות: ${gradesList}`);
            }
            console.log('');
        }

        // ============================================
        // 2. Grade Breakdown
        // ============================================
        console.log('\n🎓 BREAKDOWN BY GRADE');
        console.log('-'.repeat(70));

        const sortedGrades = Object.entries(byGrade)
            .sort((a, b) => getGradeOrder(a[0]) - getGradeOrder(b[0]));

        let elementaryTotal = 0;
        let middleTotal = 0;
        let highTotal = 0;

        for (const [grade, count] of sortedGrades) {
            const gradeNum = getGradeOrder(grade);
            let category = '';

            if (gradeNum <= 6) {
                category = '(יסודי)';
                elementaryTotal += count;
            } else if (gradeNum <= 9) {
                category = '(חטיבה)';
                middleTotal += count;
            } else {
                category = '(תיכון)';
                highTotal += count;
            }

            const bar = '█'.repeat(Math.floor(count / 5));
            console.log(`   כיתה ${grade} ${category.padEnd(8)} ${count.toString().padStart(4)} ${bar}`);
        }

        console.log('\n   סיכום לפי שכבה:');
        console.log(`   • יסודי (א'-ו'):    ${elementaryTotal} תקנים`);
        console.log(`   • חטיבת ביניים (ז'-ט'): ${middleTotal} תקנים`);
        console.log(`   • תיכון (י'-י״ב):   ${highTotal} תקנים`);

        // ============================================
        // 3. Data Quality Check
        // ============================================
        console.log('\n\n🔍 DATA QUALITY CHECK');
        console.log('-'.repeat(70));

        let withDescription = 0;
        let withObjectives = 0;
        let withSkills = 0;
        let withActivityTypes = 0;
        let withBloomLevels = 0;
        let complete = 0;

        for (const std of allStandards) {
            if (std.description && std.description.length > 20) withDescription++;
            if (std.learningObjectives && std.learningObjectives.length >= 3) withObjectives++;
            if (std.requiredSkills && std.requiredSkills.length >= 2) withSkills++;
            if (std.recommendedActivityTypes && std.recommendedActivityTypes.length >= 2) withActivityTypes++;
            if (std.recommendedBloomLevels && std.recommendedBloomLevels.length >= 1) withBloomLevels++;

            if (std.description && std.learningObjectives?.length >= 3 &&
                std.requiredSkills?.length >= 2 && std.recommendedActivityTypes?.length >= 2) {
                complete++;
            }
        }

        const qualityPercent = (field: number) => ((field / snapshot.size) * 100).toFixed(1);

        console.log(`   ✅ תיאור מפורט:        ${withDescription.toString().padStart(4)} / ${snapshot.size} (${qualityPercent(withDescription)}%)`);
        console.log(`   ✅ מטרות למידה:        ${withObjectives.toString().padStart(4)} / ${snapshot.size} (${qualityPercent(withObjectives)}%)`);
        console.log(`   ✅ מיומנויות נדרשות:   ${withSkills.toString().padStart(4)} / ${snapshot.size} (${qualityPercent(withSkills)}%)`);
        console.log(`   ✅ סוגי פעילויות:      ${withActivityTypes.toString().padStart(4)} / ${snapshot.size} (${qualityPercent(withActivityTypes)}%)`);
        console.log(`   ✅ רמות Bloom:         ${withBloomLevels.toString().padStart(4)} / ${snapshot.size} (${qualityPercent(withBloomLevels)}%)`);
        console.log(`\n   🌟 תקנים מלאים:        ${complete.toString().padStart(4)} / ${snapshot.size} (${qualityPercent(complete)}%)`);

        // ============================================
        // 4. Top Domains
        // ============================================
        console.log('\n\n📂 TOP 10 DOMAINS');
        console.log('-'.repeat(70));

        const sortedDomains = Object.entries(byDomain)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        for (const [domain, count] of sortedDomains) {
            const bar = '▪'.repeat(Math.floor(count / 2));
            console.log(`   ${domain.padEnd(30)} ${count.toString().padStart(3)} ${bar}`);
        }

        // ============================================
        // 5. Sample Standards
        // ============================================
        console.log('\n\n📝 SAMPLE STANDARDS (5 random)');
        console.log('-'.repeat(70));

        const samples = allStandards
            .sort(() => Math.random() - 0.5)
            .slice(0, 5);

        for (const [index, std] of samples.entries()) {
            console.log(`\n   [${index + 1}] ${std.title}`);
            console.log(`       מקצוע: ${getHebrewSubjectName(std.subject)} | כיתה: ${std.gradeLevel} | תחום: ${std.domain || 'N/A'}`);
            console.log(`       נושא: ${std.topic}`);
            console.log(`       תיאור: ${(std.description || 'N/A').substring(0, 80)}...`);
            if (std.learningObjectives && std.learningObjectives.length > 0) {
                console.log(`       מטרות: ${std.learningObjectives.slice(0, 2).join(', ')}...`);
            }
        }

        // ============================================
        // 6. Coverage Matrix
        // ============================================
        console.log('\n\n📊 COVERAGE MATRIX (Subject × Grade)');
        console.log('-'.repeat(70));

        const subjects = Object.keys(bySubject).sort();
        const grades = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב'];

        console.log('   מקצוע'.padEnd(20) + grades.map(g => g.padStart(4)).join(''));
        console.log('   ' + '-'.repeat(68));

        for (const subject of subjects) {
            const hebrewName = getHebrewSubjectName(subject).substring(0, 18);
            let row = `   ${hebrewName.padEnd(20)}`;

            for (const grade of grades) {
                const count = bySubjectGrade[subject]?.[grade] || 0;
                if (count > 0) {
                    row += count.toString().padStart(4);
                } else {
                    row += '   -';
                }
            }

            console.log(row);
        }

        // ============================================
        // Final Summary
        // ============================================
        console.log('\n\n' + '='.repeat(70));
        console.log('✅ VERIFICATION COMPLETE');
        console.log('='.repeat(70));
        console.log(`   📚 Total Standards: ${snapshot.size}`);
        console.log(`   📖 Subjects: ${Object.keys(bySubject).length}`);
        console.log(`   🎓 Grades: ${Object.keys(byGrade).length}`);
        console.log(`   🌟 Data Quality: ${qualityPercent(complete)}% complete`);
        console.log('='.repeat(70));

        // Check for gaps
        const expectedSubjects = ['math', 'hebrew', 'english', 'science'];
        const expectedGrades = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
        const missingCombinations: string[] = [];

        for (const subject of expectedSubjects) {
            for (const grade of expectedGrades) {
                if (!bySubjectGrade[subject]?.[grade]) {
                    missingCombinations.push(`${getHebrewSubjectName(subject)} - כיתה ${grade}`);
                }
            }
        }

        if (missingCombinations.length > 0) {
            console.log('\n⚠️  GAPS DETECTED (Elementary Core Subjects):');
            console.log('-'.repeat(70));
            for (const gap of missingCombinations.slice(0, 10)) {
                console.log(`   • ${gap}`);
            }
            if (missingCombinations.length > 10) {
                console.log(`   ... and ${missingCombinations.length - 10} more`);
            }
        } else {
            console.log('\n✅ No gaps in elementary core subjects!');
        }

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

// Run
if (require.main === module) {
    checkCurriculumData()
        .then(() => {
            console.log('\n✅ Check complete!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Check failed:', error);
            process.exit(1);
        });
}

export { checkCurriculumData };
