// Script to fix MC block with richOptions but empty options array
const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixBlock() {
  const courseId = '0GO0XTt6VW4KcSBwoDwW';
  const targetUnitId = '34fa6c9f-8970-406e-b61f-60e19e6daf02';
  const targetBlockId = '3e129c9d-b46f-4003-9dfd-4424c848d6f0';

  console.log('🔧 Fixing MC block with richOptions...\n');

  const courseDoc = await db.collection('courses').doc(courseId).get();
  const data = courseDoc.data();
  const syllabus = data.syllabus || [];
  let fixed = false;

  syllabus.forEach((module, mIdx) => {
    (module.learningUnits || []).forEach((unit, uIdx) => {
      if (unit.id === targetUnitId) {
        (unit.activityBlocks || []).forEach((block, bIdx) => {
          if (block.id === targetBlockId) {
            console.log(`📋 Found block in unit: ${unit.title}`);

            const richOptions = block.metadata?.richOptions || [];
            if (richOptions.length > 0) {
              // Extract options from richOptions
              const options = richOptions.map(ro => ro.answer || ro.text || ro.label || '');
              const correctOption = richOptions.find(ro => ro.is_correct === true || ro.isCorrect === true);
              const correctAnswer = correctOption ? (correctOption.answer || correctOption.text || correctOption.label) : options[0];

              console.log(`   Extracted options: ${options.join(', ')}`);
              console.log(`   Correct answer: ${correctAnswer}`);

              // Update content
              syllabus[mIdx].learningUnits[uIdx].activityBlocks[bIdx].content.options = options;
              syllabus[mIdx].learningUnits[uIdx].activityBlocks[bIdx].content.correctAnswer = correctAnswer;
              fixed = true;
            }
          }
        });
      }
    });
  });

  if (fixed) {
    await db.collection('courses').doc(courseId).update({ syllabus });
    console.log('\n💾 Saved course with fix');
  }

  console.log('\n✅ Done!');
  process.exit(0);
}

fixBlock();
