const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ai-lms-pro'
});

const db = admin.firestore();

async function checkProgress() {
  const progressDocs = await db.collection('extraction_progress').limit(5).get();
  console.log('Progress documents:', progressDocs.size);
  
  progressDocs.forEach(doc => {
    const data = doc.data();
    console.log('\nProgress ID:', doc.id);
    console.log('File:', data.fileName);
    console.log('Processed:', data.processedPages, '/', data.totalPages);
    console.log('Pages stored:', data.pages?.length || 0);
    
    // Show sample of page 10
    if (data.pages && data.pages.length > 0) {
      const page10 = data.pages.find(p => p.pageNumber === 10);
      if (page10) {
        console.log('\n=== Sample from page 10 ===');
        console.log(page10.consensusText?.substring(0, 800));
      }
    }
  });
}

checkProgress().catch(console.error);
