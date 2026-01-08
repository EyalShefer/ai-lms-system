// Script to fix a single MC block with no correct answer
const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixSingleBlock() {
  const courseId = '0GO0XTt6VW4KcSBwoDwW';
  const targetUnitId = '34fa6c9f-8970-406e-b61f-60e19e6daf02';
  const targetBlockId = '3e129c9d-b46f-4003-9dfd-4424c848d6f0';

  console.log('🔧 Fixing single MC block with no correct answer...\n');

  const courseDoc = await db.collection('courses').doc(courseId).get();
  if (!courseDoc.exists) {
    console.log('❌ Course not found');
    process.exit(1);
  }

  const data = courseDoc.data();
  const syllabus = data.syllabus || [];
  let fixed = false;

  syllabus.forEach((module, mIdx) => {
    (module.learningUnits || []).forEach((unit, uIdx) => {
      if (unit.id === targetUnitId) {
        (unit.activityBlocks || []).forEach((block, bIdx) => {
          if (block.id === targetBlockId) {
            console.log(`📋 Found block in unit: ${unit.title}`);
            console.log(`   Block type: ${block.type}`);

            const content = block.content || {};
            const options = content.options || [];

            console.log(`   Question: ${(content.question || '').substring(0, 50)}...`);
            console.log(`   Options: ${options.length}`);
            console.log(`   Current correctAnswer: ${content.correctAnswer || 'MISSING'}`);

            if (options.length > 0) {
              // Find option marked as correct
              const correctOption = options.find(o =>
                (typeof o === 'object') && (o.isCorrect === true || o.is_correct === true || o.correct === true)
              );

              let newAnswer;
              if (correctOption) {
                newAnswer = typeof correctOption === 'string'
                  ? correctOption
                  : (correctOption.text || correctOption.label || correctOption.value);
                console.log(`   ✅ Found correct option marked: "${newAnswer}"`);
              } else {
                // Use first option as fallback
                const firstOpt = options[0];
                newAnswer = typeof firstOpt === 'string'
                  ? firstOpt
                  : (firstOpt.text || firstOpt.label || firstOpt.value);
                console.log(`   ⚠️ No correct option marked, using first: "${newAnswer}"`);
              }

              // Update the block
              syllabus[mIdx].learningUnits[uIdx].activityBlocks[bIdx].content.correctAnswer = newAnswer;
              fixed = true;
            } else {
              console.log('   ❌ No options to choose from');
            }
          }
        });
      }
    });
  });

  if (fixed) {
    await db.collection('courses').doc(courseId).update({ syllabus });
    console.log('\n💾 Saved course with fix');
  } else {
    console.log('\n❌ Block not found or could not be fixed');
  }

  console.log('\n✅ Done!');
  process.exit(0);
}

fixSingleBlock();
