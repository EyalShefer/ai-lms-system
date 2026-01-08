// Script to inspect a specific block
const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspectBlock() {
  const courseId = '0GO0XTt6VW4KcSBwoDwW';
  const targetUnitId = '34fa6c9f-8970-406e-b61f-60e19e6daf02';
  const targetBlockId = '3e129c9d-b46f-4003-9dfd-4424c848d6f0';

  console.log('🔍 Inspecting block...\n');

  const courseDoc = await db.collection('courses').doc(courseId).get();
  const data = courseDoc.data();
  const syllabus = data.syllabus || [];

  syllabus.forEach((module, mIdx) => {
    (module.learningUnits || []).forEach((unit, uIdx) => {
      if (unit.id === targetUnitId) {
        (unit.activityBlocks || []).forEach((block, bIdx) => {
          if (block.id === targetBlockId) {
            console.log('Full block:');
            console.log(JSON.stringify(block, null, 2));
          }
        });
      }
    });
  });

  process.exit(0);
}

inspectBlock();
