// Script to check curriculum data in Firestore
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkCurriculum() {
  console.log('🔍 Checking Knowledge Base data...\n');

  const snapshot = await db.collection('math_knowledge').get();

  // Count by volumeType
  const counts = { student: 0, teacher: 0, curriculum: 0, unknown: 0 };
  const curriculumDocs = [];

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
  const gradeB = { student: 0, teacher: 0, curriculum: 0 };
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
