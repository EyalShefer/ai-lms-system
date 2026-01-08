// Script to fix ALL MC blocks where options are empty but richOptions exist
const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixAllRichOptionsBlocks() {
  console.log('🔧 Scanning for MC blocks with empty options but richOptions...\n');

  const coursesSnapshot = await db.collection('courses').get();
  console.log(`Scanning ${coursesSnapshot.size} courses...\n`);

  let totalFixed = 0;
  let coursesSaved = 0;

  for (const courseDoc of coursesSnapshot.docs) {
    const data = courseDoc.data();
    const courseId = courseDoc.id;
    const syllabus = data.syllabus || [];
    let courseModified = false;

    syllabus.forEach((module, mIdx) => {
      (module.learningUnits || []).forEach((unit, uIdx) => {
        (unit.activityBlocks || []).forEach((block, bIdx) => {
          if (block.type === 'multiple-choice' || block.type === 'multipleChoice') {
            const content = block.content || {};
            const options = content.options || [];
            const richOptions = block.metadata?.richOptions || [];

            // Check if options are empty/invalid but richOptions exist
            const hasEmptyOptions = options.length === 0 || options.every(o => !o || o === '');
            const hasRichOptions = richOptions.length > 0;

            if (hasEmptyOptions && hasRichOptions) {
              // Extract from richOptions
              const newOptions = richOptions.map(ro => ro.answer || ro.text || ro.label || '').filter(Boolean);

              // Skip if we couldn't extract valid options
              if (newOptions.length < 2) {
                console.log(`⚠️ Skipping block in "${data.title}" - couldn't extract valid options from richOptions`);
                return;
              }

              const correctOption = richOptions.find(ro => ro.is_correct === true || ro.isCorrect === true);
              const correctAnswer = correctOption
                ? (correctOption.answer || correctOption.text || correctOption.label)
                : newOptions[0];

              // Skip if no valid correct answer
              if (!correctAnswer) {
                console.log(`⚠️ Skipping block in "${data.title}" - no valid correct answer`);
                return;
              }

              console.log(`📋 Course: ${data.title || courseId}`);
              console.log(`   Unit: ${unit.title}`);
              console.log(`   Question: ${(content.question || '').substring(0, 50)}...`);
              console.log(`   ✅ Fixed: ${newOptions.length} options, answer: "${correctAnswer}"`);

              syllabus[mIdx].learningUnits[uIdx].activityBlocks[bIdx].content.options = newOptions;
              syllabus[mIdx].learningUnits[uIdx].activityBlocks[bIdx].content.correctAnswer = correctAnswer;
              courseModified = true;
              totalFixed++;
            }
          }
        });
      });
    });

    if (courseModified) {
      await db.collection('courses').doc(courseId).update({ syllabus });
      coursesSaved++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Summary:`);
  console.log(`   Fixed ${totalFixed} blocks in ${coursesSaved} courses`);
  console.log('\n✅ Done!');
  process.exit(0);
}

fixAllRichOptionsBlocks();
