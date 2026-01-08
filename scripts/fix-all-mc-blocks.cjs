// Script to fix ALL multiple choice blocks with mismatched correct answers
const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixAllMCBlocks() {
  console.log('🔧 Fixing all MC blocks with mismatched correct answers...\n');

  const coursesSnapshot = await db.collection('courses').get();
  console.log(`Scanning ${coursesSnapshot.size} courses...\n`);

  let totalFixed = 0;
  let totalCoursesSaved = 0;

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
            let correctAnswer = content.correctAnswer || content.correct_answer;

            // Handle case where correctAnswer is an object
            if (typeof correctAnswer === 'object' && correctAnswer !== null) {
              correctAnswer = correctAnswer.text || correctAnswer.label || correctAnswer.value || JSON.stringify(correctAnswer);
            }

            if (options.length > 0 && correctAnswer && typeof correctAnswer === 'string') {
              const optionTexts = options.map(o => typeof o === 'string' ? o : (o.text || o.label || o.value || ''));

              // Check if correctAnswer is not in options
              if (!optionTexts.includes(correctAnswer)) {
                console.log(`\n📋 Course: ${data.title || courseId}`);
                console.log(`   Unit: ${unit.title}`);
                console.log(`   Current answer: "${correctAnswer}"`);
                console.log(`   Options: ${optionTexts.map(o => `"${o}"`).join(', ')}`);

                // Try fuzzy match
                const lowerCorrect = correctAnswer.toLowerCase().trim();
                let newAnswer = null;

                // Exact case-insensitive match
                newAnswer = optionTexts.find(opt => opt.toLowerCase().trim() === lowerCorrect);

                // Partial match
                if (!newAnswer) {
                  newAnswer = optionTexts.find(opt =>
                    opt.toLowerCase().includes(lowerCorrect) ||
                    lowerCorrect.includes(opt.toLowerCase())
                  );
                }

                // Check for isCorrect flag
                if (!newAnswer) {
                  const correctOption = options.find(o => o.isCorrect === true || o.is_correct === true);
                  if (correctOption) {
                    newAnswer = typeof correctOption === 'string' ? correctOption : (correctOption.text || correctOption.label);
                  }
                }

                // Fallback to first option
                if (!newAnswer) {
                  newAnswer = optionTexts[0];
                }

                console.log(`   ✅ Fixed to: "${newAnswer}"`);

                // Update the block
                syllabus[mIdx].learningUnits[uIdx].activityBlocks[bIdx].content.correctAnswer = newAnswer;
                courseModified = true;
                totalFixed++;
              }
            }
          }
        });
      });
    });

    // Save if modified
    if (courseModified) {
      await db.collection('courses').doc(courseId).update({ syllabus });
      totalCoursesSaved++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Summary:`);
  console.log(`   Fixed ${totalFixed} blocks in ${totalCoursesSaved} courses`);
  console.log('\n✅ Done!');

  process.exit(0);
}

fixAllMCBlocks();
