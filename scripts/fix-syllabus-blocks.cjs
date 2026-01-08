// Script to fix blocks in syllabus structure (not units collection)
const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixSyllabusBlocks() {
  console.log('🔍 Scanning syllabus for blocks with missing correct answers...\n');

  const coursesSnapshot = await db.collection('courses').limit(50).get();
  console.log(`Found ${coursesSnapshot.size} courses\n`);

  const problems = [];
  let fixedCount = 0;

  for (const courseDoc of coursesSnapshot.docs) {
    const courseData = courseDoc.data();
    const courseId = courseDoc.id;
    const courseTitle = courseData.title || courseData.name || 'Untitled';
    const syllabus = courseData.syllabus || [];

    let courseHasProblems = false;
    let courseFixed = false;

    syllabus.forEach((module, moduleIndex) => {
      const learningUnits = module.learningUnits || [];

      learningUnits.forEach((unit, unitIndex) => {
        const activityBlocks = unit.activityBlocks || [];

        activityBlocks.forEach((block, blockIndex) => {
          if (block.type === 'multiple-choice') {
            const content = block.content || {};
            const hasCorrectAnswer = content.correctAnswer || content.correct_answer;

            if (!hasCorrectAnswer) {
              courseHasProblems = true;
              problems.push({
                courseId,
                courseTitle,
                moduleIndex,
                unitIndex,
                unitTitle: unit.title,
                blockIndex,
                blockId: block.id,
                question: (content.question || '').substring(0, 60),
                options: content.options || []
              });

              // Try to fix
              const options = content.options || [];
              if (options.length > 0) {
                // Find option marked as correct
                const correctOption = options.find(o => o.isCorrect === true || o.correct === true);

                if (correctOption) {
                  // Found a correct option
                  const answer = correctOption.text || correctOption.label || correctOption.value || correctOption;
                  syllabus[moduleIndex].learningUnits[unitIndex].activityBlocks[blockIndex].content.correctAnswer = answer;
                  courseFixed = true;
                  console.log(`   ✅ Fixed: ${courseTitle} > ${unit.title} > Block ${blockIndex}`);
                  console.log(`      Set correctAnswer to: "${answer}"`);
                } else {
                  // No correct option marked, use first option as fallback
                  const firstOption = typeof options[0] === 'string' ? options[0] : (options[0].text || options[0].label || options[0].value);
                  if (firstOption) {
                    syllabus[moduleIndex].learningUnits[unitIndex].activityBlocks[blockIndex].content.correctAnswer = firstOption;
                    courseFixed = true;
                    console.log(`   ⚠️ Fixed (fallback): ${courseTitle} > ${unit.title} > Block ${blockIndex}`);
                    console.log(`      Set correctAnswer to first option: "${firstOption}"`);
                  }
                }
              }
            }
          }
        });
      });
    });

    // Save if we fixed anything
    if (courseFixed) {
      await db.collection('courses').doc(courseId).update({ syllabus });
      fixedCount++;
      console.log(`   💾 Saved course: ${courseTitle}\n`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Summary:`);
  console.log(`   Found ${problems.length} blocks with missing correct answers`);
  console.log(`   Fixed ${fixedCount} courses`);

  if (problems.length > 0) {
    console.log(`\n📋 Problems found:`);
    for (const p of problems) {
      console.log(`\n   Course: ${p.courseTitle} (${p.courseId})`);
      console.log(`   Unit: ${p.unitTitle}`);
      console.log(`   Question: ${p.question}...`);
      console.log(`   Options: ${p.options.length}`);
    }
  }

  console.log('\n\n✅ Done!');
  process.exit(0);
}

fixSyllabusBlocks();
