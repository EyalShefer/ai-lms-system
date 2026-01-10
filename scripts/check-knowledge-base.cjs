// check-knowledge-base.cjs - Check knowledge base contents
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with project ID
admin.initializeApp({
  projectId: 'ai-lms-pro'
});

const db = admin.firestore();
const COLLECTION_NAME = 'math_knowledge';

async function checkKnowledgeBase() {
  console.log('🔍 בודק את בסיס הידע...\n');

  try {
    // Get all documents
    const snapshot = await db.collection(COLLECTION_NAME).get();

    console.log(`📊 סה"כ מסמכים: ${snapshot.size}\n`);

    if (snapshot.size === 0) {
      console.log('❌ בסיס הידע ריק!');
      return;
    }

    // Analyze by grade
    const byGrade = {};
    const byVolumeType = {};
    const byChapter = {};
    const samples = [];

    snapshot.forEach((doc, index) => {
      const data = doc.data();

      // By grade
      const grade = data.grade || 'unknown';
      byGrade[grade] = (byGrade[grade] || 0) + 1;

      // By volume type
      const volumeType = data.volumeType || 'unknown';
      byVolumeType[volumeType] = (byVolumeType[volumeType] || 0) + 1;

      // By chapter
      const chapter = data.chapter || 'unknown';
      byChapter[chapter] = (byChapter[chapter] || 0) + 1;

      // Collect samples (first 3 from grade א)
      if (grade === 'א' && samples.length < 3) {
        samples.push({
          id: doc.id,
          grade: data.grade,
          volumeType: data.volumeType,
          chapter: data.chapter,
          contentType: data.contentType,
          content: data.content?.substring(0, 200) + '...',
          hasEmbedding: !!data.embedding && data.embedding.length > 0
        });
      }
    });

    console.log('📚 לפי כיתה:');
    Object.entries(byGrade).sort().forEach(([grade, count]) => {
      console.log(`   כיתה ${grade}: ${count} קטעים`);
    });

    console.log('\n📖 לפי סוג:');
    Object.entries(byVolumeType).forEach(([type, count]) => {
      const label = type === 'student' ? 'ספר תלמיד' : type === 'teacher' ? 'מדריך למורה' : type;
      console.log(`   ${label}: ${count} קטעים`);
    });

    console.log('\n📑 לפי פרק (ראשונים):');
    Object.entries(byChapter).slice(0, 10).forEach(([chapter, count]) => {
      console.log(`   ${chapter}: ${count} קטעים`);
    });

    if (samples.length > 0) {
      console.log('\n🔎 דוגמאות מכיתה א:');
      samples.forEach((sample, i) => {
        console.log(`\n--- דוגמה ${i + 1} ---`);
        console.log(`ID: ${sample.id}`);
        console.log(`כיתה: ${sample.grade}`);
        console.log(`סוג: ${sample.volumeType}`);
        console.log(`פרק: ${sample.chapter}`);
        console.log(`סוג תוכן: ${sample.contentType}`);
        console.log(`יש embedding: ${sample.hasEmbedding ? 'כן' : 'לא'}`);
        console.log(`תוכן (קיצור): ${sample.content}`);
      });
    }

    // Test search simulation
    console.log('\n\n🧪 בדיקת חיפוש לכיתה א...');
    const gradeADocs = await db.collection(COLLECTION_NAME)
      .where('grade', '==', 'א')
      .where('subject', '==', 'math')
      .limit(5)
      .get();

    console.log(`תוצאות חיפוש grade='א' AND subject='math': ${gradeADocs.size} מסמכים`);

    if (gradeADocs.size > 0) {
      console.log('\n✅ יש מידע לכיתה א בבסיס הידע!');
    } else {
      console.log('\n⚠️ אין מידע לכיתה א - בדוק את ערכי grade ו-subject');

      // Check what grades exist
      const sampleDoc = snapshot.docs[0];
      if (sampleDoc) {
        const data = sampleDoc.data();
        console.log('\nדוגמה למסמך קיים:');
        console.log(`  grade: "${data.grade}"`);
        console.log(`  subject: "${data.subject}"`);
        console.log(`  volumeType: "${data.volumeType}"`);
      }
    }

  } catch (error) {
    console.error('❌ שגיאה:', error.message);
  }

  process.exit(0);
}

checkKnowledgeBase();
