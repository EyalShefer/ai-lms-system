// Script to find and fix blocks with missing correct answers
const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Problem blocks from QA report
const PROBLEM_BLOCKS = [
  {
    courseId: 'kybHVuOjpvPT1w6VFZh1',
    unitId: '69bbd817-4768-4f7d-9e2f-7cc995873bfa',
    description: 'המהפכה התעשייתית הקיטור - המצאת מנוע הקיטור'
  },
  {
    courseId: '0GO0XTt6VW4KcSBwoDwW',
    unitId: '34fa6c9f-8970-406e-b61f-60e19e6daf02',
    blockId: '3e129c9d-b46f-4003-9dfd-4424c848d6f0',
    description: 'Unknown course'
  }
];

async function analyzeAndFix() {
  console.log('🔍 Analyzing blocks with missing correct answers...\n');

  for (const problem of PROBLEM_BLOCKS) {
    console.log(`\n📋 Checking: ${problem.description}`);
    console.log(`   Course: ${problem.courseId}`);
    console.log(`   Unit: ${problem.unitId}`);

    try {
      // Get the unit
      const unitRef = db.collection('courses').doc(problem.courseId).collection('units').doc(problem.unitId);
      const unitDoc = await unitRef.get();

      if (!unitDoc.exists) {
        console.log('   ❌ Unit not found');
        continue;
      }

      const unitData = unitDoc.data();
      console.log(`   Unit Title: ${unitData.title}`);

      // Find blocks with multiple choice questions
      const blocks = unitData.blocks || [];
      console.log(`   Total blocks: ${blocks.length}`);

      let fixedCount = 0;

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        // Check if it's a multiple choice block
        if (block.type === 'multiple-choice' || block.type === 'multipleChoice') {
          const options = block.options || block.data?.options || [];
          const correctAnswer = block.correctAnswer || block.data?.correctAnswer;

          console.log(`\n   Block ${i + 1} (${block.id}):`);
          console.log(`     Type: ${block.type}`);
          console.log(`     Question: ${(block.question || block.data?.question || '').substring(0, 50)}...`);
          console.log(`     Options: ${options.length}`);
          console.log(`     Correct Answer: "${correctAnswer}"`);

          // Check if correct answer exists in options
          const optionTexts = options.map(o => typeof o === 'string' ? o : (o.text || o.label || o.value));
          const hasCorrectAnswer = optionTexts.some(opt => opt === correctAnswer);

          if (!hasCorrectAnswer) {
            console.log(`     ⚠️ PROBLEM: Correct answer not in options!`);
            console.log(`     Options available: ${JSON.stringify(optionTexts)}`);

            // Try to find a matching option (case insensitive or partial match)
            const possibleMatch = optionTexts.find(opt =>
              opt?.toLowerCase()?.includes(correctAnswer?.toLowerCase()) ||
              correctAnswer?.toLowerCase()?.includes(opt?.toLowerCase())
            );

            if (possibleMatch) {
              console.log(`     🔧 Found possible match: "${possibleMatch}"`);

              // Fix the block
              blocks[i].correctAnswer = possibleMatch;
              if (blocks[i].data) {
                blocks[i].data.correctAnswer = possibleMatch;
              }
              fixedCount++;
              console.log(`     ✅ Fixed: Set correctAnswer to "${possibleMatch}"`);
            } else {
              // If no match found, set to first option as fallback
              if (optionTexts.length > 0) {
                console.log(`     🔧 No match found, setting to first option: "${optionTexts[0]}"`);
                blocks[i].correctAnswer = optionTexts[0];
                if (blocks[i].data) {
                  blocks[i].data.correctAnswer = optionTexts[0];
                }
                fixedCount++;
                console.log(`     ⚠️ WARNING: Manually review this block!`);
              }
            }
          } else {
            console.log(`     ✅ Correct answer exists in options`);
          }
        }
      }

      // Save if we made fixes
      if (fixedCount > 0) {
        console.log(`\n   💾 Saving ${fixedCount} fixes to Firestore...`);
        await unitRef.update({ blocks });
        console.log(`   ✅ Saved!`);
      }

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n\n✅ Analysis complete!');
  process.exit(0);
}

analyzeAndFix();
