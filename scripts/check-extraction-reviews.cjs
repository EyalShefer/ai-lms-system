// check-extraction-reviews.cjs
// Quick script to check if extraction_reviews collection has data
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccountPath = path.join(__dirname, '..', 'ai-lms-pro-firebase-adminsdk-fbsvc-0e6e4dfc5c.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
  projectId: 'ai-lms-pro'
});

const db = admin.firestore();

async function checkReviews() {
  console.log('Checking extraction_reviews collection...\n');

  try {
    // Get all reviews without any filter
    const snapshot = await db.collection('extraction_reviews').get();

    console.log(`Total documents: ${snapshot.size}\n`);

    if (snapshot.empty) {
      console.log('No reviews found in collection.');
    } else {
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`  Grade: ${data.grade}`);
        console.log(`  Volume: ${data.volume}`);
        console.log(`  Type: ${data.volumeType}`);
        console.log(`  Status: ${data.status}`);
        console.log(`  Total Pages: ${data.totalPages}`);
        console.log(`  Pages Needing Review: ${data.pagesNeedingReview?.length || 0}`);
        console.log(`  Created: ${data.createdAt?.toDate?.() || data.createdAt}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

checkReviews();
