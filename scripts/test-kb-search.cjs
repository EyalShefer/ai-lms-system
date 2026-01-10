// test-kb-search.cjs - Test Knowledge Base search via Firebase Functions
const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable, connectFunctionsEmulator } = require('firebase/functions');

// Firebase config (from src/firebase.ts)
const firebaseConfig = {
  apiKey: "AIzaSyDpxLgDKJqGxKpL6O5SG-L6OG1s00NfJsE",
  authDomain: "ai-lms-pro.firebaseapp.com",
  projectId: "ai-lms-pro",
  storageBucket: "ai-lms-pro.firebasestorage.app",
  messagingSenderId: "258045449498",
  appId: "1:258045449498:web:c748bbeb48cc9ccd13f7fa",
  measurementId: "G-DD8RMXC5WX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, 'us-central1');

async function testKBSearch() {
  console.log('🔍 Testing Knowledge Base search...\n');

  const searchFunc = httpsCallable(functions, 'searchKnowledge');

  // Test queries for grade ב (2) math content
  const testQueries = [
    { query: 'חיבור', grade: 'ב', desc: 'Addition for grade 2' },
    { query: 'מספרים עד 100', grade: 'ב', desc: 'Numbers up to 100' },
    { query: 'תרגילים בחיבור', grade: 'ב', desc: 'Addition exercises' },
    { query: 'חיסור', grade: 'ב', desc: 'Subtraction' },
  ];

  for (const { query, grade, desc } of testQueries) {
    console.log(`\n📚 Testing: "${query}" (${desc})`);
    console.log('-'.repeat(50));

    try {
      const result = await searchFunc({
        query,
        filters: { subject: 'math', grade },
        limit: 3,
        minSimilarity: 0.35
      });

      const data = result.data;

      if (data.results && data.results.length > 0) {
        console.log(`✅ Found ${data.results.length} results:`);

        for (const res of data.results) {
          console.log(`\n  📖 [${res.chunk.chapter || 'unknown'}] Similarity: ${(res.similarity * 100).toFixed(1)}%`);
          console.log(`     Volume: ${res.chunk.volumeType}, Page: ${res.chunk.source}`);
          console.log(`     Content preview: ${res.chunk.content.substring(0, 150)}...`);

          // Check for exercise patterns
          const exerciseMatch = res.chunk.content.match(/(?:תרגיל|פתור|חשב)[^\n]+/);
          if (exerciseMatch) {
            console.log(`     📝 Exercise found: "${exerciseMatch[0]}"`);
          }
        }
      } else {
        console.log('❌ No results found');
      }

      console.log(`\n   ⏱️ Processing time: ${data.processingTimeMs}ms`);

    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }
}

testKBSearch().then(() => {
  console.log('\n\n✅ Test completed!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
