// Script to scan ALL blocks for missing correct answers
const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function scanAllBlocks() {
  console.log('🔍 Scanning all courses for blocks with missing correct answers...\n');

  const coursesSnapshot = await db.collection('courses').get();
  console.log(`Found ${coursesSnapshot.size} courses\n`);

  const problems = [];

  for (const courseDoc of coursesSnapshot.docs) {
    const courseData = courseDoc.data();
    const courseId = courseDoc.id;
    const courseTitle = courseData.title || courseData.name || 'Untitled';

    // Get all units
    const unitsSnapshot = await db.collection('courses').doc(courseId).collection('units').get();

    for (const unitDoc of unitsSnapshot.docs) {
      const unitData = unitDoc.data();
      const unitId = unitDoc.id;
      const unitTitle = unitData.title || 'Untitled Unit';
      const blocks = unitData.blocks || [];

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        // Check multiple choice blocks
        if (block.type === 'multiple-choice' || block.type === 'multipleChoice') {
          const options = block.options || block.data?.options || [];
          const correctAnswer = block.correctAnswer ?? block.data?.correctAnswer;

          // Get option texts
          const optionTexts = options.map(o => {
            if (typeof o === 'string') return o;
            return o.text || o.label || o.value || JSON.stringify(o);
          });

          // Check if correct answer exists
          const hasCorrectAnswer = optionTexts.some(opt => opt === correctAnswer);

          if (!hasCorrectAnswer && options.length > 0) {
            problems.push({
              courseId,
              courseTitle,
              unitId,
              unitTitle,
              blockId: block.id,
              blockIndex: i,
              question: (block.question || block.data?.question || '').substring(0, 80),
              correctAnswer,
              options: optionTexts
            });
          }
        }
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔴 Found ${problems.length} blocks with missing correct answers:\n`);

  for (const p of problems) {
    console.log(`\n📋 Course: ${p.courseTitle}`);
    console.log(`   Course ID: ${p.courseId}`);
    console.log(`   Unit: ${p.unitTitle}`);
    console.log(`   Unit ID: ${p.unitId}`);
    console.log(`   Block ID: ${p.blockId}`);
    console.log(`   Question: ${p.question}...`);
    console.log(`   Current correctAnswer: "${p.correctAnswer}"`);
    console.log(`   Available options:`);
    p.options.forEach((opt, idx) => {
      console.log(`     ${idx + 1}. "${opt}"`);
    });
  }

  // Auto-fix
  if (problems.length > 0) {
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('🔧 Attempting to auto-fix...\n');

    for (const p of problems) {
      try {
        const unitRef = db.collection('courses').doc(p.courseId).collection('units').doc(p.unitId);
        const unitDoc = await unitRef.get();
        const unitData = unitDoc.data();
        const blocks = unitData.blocks || [];

        // Find the block
        const blockIndex = blocks.findIndex(b => b.id === p.blockId);
        if (blockIndex === -1) continue;

        const block = blocks[blockIndex];
        const options = block.options || block.data?.options || [];
        const optionTexts = options.map(o => typeof o === 'string' ? o : (o.text || o.label || o.value));

        // Try to find a match
        let newAnswer = null;

        // Check if any option is marked as correct
        const correctOption = options.find(o => o.isCorrect === true || o.correct === true);
        if (correctOption) {
          newAnswer = typeof correctOption === 'string' ? correctOption : (correctOption.text || correctOption.label || correctOption.value);
        }

        // If not, try partial match
        if (!newAnswer && p.correctAnswer) {
          const match = optionTexts.find(opt =>
            opt?.toLowerCase()?.trim() === p.correctAnswer?.toLowerCase()?.trim()
          );
          if (match) newAnswer = match;
        }

        // Last resort: use first option
        if (!newAnswer && optionTexts.length > 0) {
          newAnswer = optionTexts[0];
          console.log(`   ⚠️ WARNING: Using first option as fallback for block ${p.blockId}`);
        }

        if (newAnswer) {
          blocks[blockIndex].correctAnswer = newAnswer;
          if (blocks[blockIndex].data) {
            blocks[blockIndex].data.correctAnswer = newAnswer;
          }

          await unitRef.update({ blocks });
          console.log(`   ✅ Fixed block ${p.blockId}: "${newAnswer}"`);
        }

      } catch (error) {
        console.error(`   ❌ Error fixing ${p.blockId}: ${error.message}`);
      }
    }
  }

  console.log('\n\n✅ Scan complete!');
  process.exit(0);
}

scanAllBlocks();
