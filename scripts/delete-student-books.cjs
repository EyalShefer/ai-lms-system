// delete-student-books.cjs - Delete only student books from knowledge base
const admin = require('firebase-admin');

// Initialize Firebase Admin with project ID
admin.initializeApp({
  projectId: 'ai-lms-pro'
});

const db = admin.firestore();
const COLLECTION_NAME = 'math_knowledge';

async function deleteStudentBooks() {
  console.log('🗑️ מוחק את ספרי התלמיד מבסיס הידע...\n');

  try {
    // Query only student books
    const snapshot = await db.collection(COLLECTION_NAME)
      .where('volumeType', '==', 'student')
      .get();

    console.log(`📊 נמצאו ${snapshot.size} רשומות של ספרי תלמיד למחיקה\n`);

    if (snapshot.empty) {
      console.log('✅ אין ספרי תלמיד למחיקה');
      return;
    }

    // Count by grade before deletion
    const byGrade = {};
    snapshot.forEach(doc => {
      const grade = doc.data().grade || 'unknown';
      byGrade[grade] = (byGrade[grade] || 0) + 1;
    });

    console.log('לפי כיתה:');
    for (const [grade, count] of Object.entries(byGrade)) {
      console.log(`  ${grade}: ${count} chunks`);
    }
    console.log('');

    // Delete in batches of 500 (Firestore limit)
    const BATCH_SIZE = 500;
    let deletedCount = 0;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const batchDocs = docs.slice(i, i + BATCH_SIZE);

      batchDocs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      deletedCount += batchDocs.length;
      console.log(`🗑️ נמחקו ${deletedCount}/${docs.length} רשומות...`);
    }

    console.log(`\n✅ הושלם! נמחקו ${deletedCount} רשומות של ספרי תלמיד`);

    // Verify remaining data
    const remaining = await db.collection(COLLECTION_NAME).get();
    console.log(`\n📊 נותרו ${remaining.size} רשומות בבסיס הידע (מדריכים למורה)`);

  } catch (error) {
    console.error('❌ שגיאה:', error.message);
  }

  process.exit(0);
}

deleteStudentBooks();
