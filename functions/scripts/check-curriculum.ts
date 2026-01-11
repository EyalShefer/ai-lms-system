// Script to check curriculum data in Firestore
// Run with: npx ts-node scripts/check-curriculum.ts

import * as admin from 'firebase-admin';

// Initialize with application default credentials
admin.initializeApp({
  projectId: 'ai-lms-pro'
});

const db = admin.firestore();

async function checkCurriculum() {
  console.log('🔍 Checking Knowledge Base data...\n');

  const snapshot = await db.collection('math_knowledge').get();

  // Count by volumeType
  const counts: Record<string, number> = { student: 0, teacher: 0, curriculum: 0, unknown: 0 };
  const curriculumDocs: Array<{
    id: string;
    grade: string;
    grades?: string[];
    subject: string;
    chapter: string;
    source: string;
  }> = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const vt = data.volumeType || 'unknown';
    counts[vt] = (counts[vt] || 0) + 1;

    if (vt === 'curriculum') {
      curriculumDocs.push({
        id: doc.id,
        grade: data.grade,
        grades: data.grades,
        subject: data.subject,
        chapter: data.chapter,
        source: data.source?.substring(0, 60)
      });
    }
  });

  console.log('📊 Volume Type Distribution:');
  console.log(`   Student: ${counts.student}`);
  console.log(`   Teacher: ${counts.teacher}`);
  console.log(`   Curriculum: ${counts.curriculum}`);
  if (counts.unknown > 0) console.log(`   Unknown: ${counts.unknown}`);
  console.log(`   TOTAL: ${snapshot.size}\n`);

  if (curriculumDocs.length > 0) {
    console.log('📋 Curriculum Documents:');
    curriculumDocs.forEach((doc, i) => {
      console.log(`\n   [${i + 1}] ID: ${doc.id}`);
      console.log(`       grade: "${doc.grade}"`);
      console.log(`       grades: ${JSON.stringify(doc.grades)}`);
      console.log(`       subject: "${doc.subject}"`);
      console.log(`       chapter: "${doc.chapter}"`);
      console.log(`       source: "${doc.source}..."`);
    });
  } else {
    console.log('❌ No curriculum documents found!');
  }

  // Check grade 'ב' specifically
  console.log('\n\n🎓 Documents for grade "ב":');
  const gradeB: Record<string, number> = { student: 0, teacher: 0, curriculum: 0 };
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.grade === 'ב' || (data.grades && data.grades.includes('ב'))) {
      gradeB[data.volumeType] = (gradeB[data.volumeType] || 0) + 1;
    }
  });
  console.log(`   Student: ${gradeB.student}`);
  console.log(`   Teacher: ${gradeB.teacher}`);
  console.log(`   Curriculum: ${gradeB.curriculum}`);

  process.exit(0);
}

checkCurriculum().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
