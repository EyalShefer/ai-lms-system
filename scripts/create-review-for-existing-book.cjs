// create-review-for-existing-book.cjs
// Creates an extraction review record for an already uploaded book
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccountPath = path.join(__dirname, '..', 'ai-lms-pro-firebase-adminsdk-fbsvc-0e6e4dfc5c.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
  projectId: 'ai-lms-pro'
});

const db = admin.firestore();
const { v4: uuidv4 } = require('uuid');

async function createReviewForExistingBook() {
  console.log('Creating extraction review for existing book...\n');

  try {
    // Get all chunks for grade ב, volume 1, student book
    const chunksSnapshot = await db.collection('math_knowledge')
      .where('grade', '==', 'ב')
      .where('volume', '==', 1)
      .where('volumeType', '==', 'student')
      .get();

    if (chunksSnapshot.empty) {
      console.log('No chunks found for this book');
      return;
    }

    console.log(`Found ${chunksSnapshot.size} chunks`);

    // Get unique page numbers and content
    const pageMap = new Map();
    chunksSnapshot.forEach(doc => {
      const data = doc.data();
      // Extract page number from content if available
      const pageMatch = data.content?.match(/עמוד (\d+)/);
      if (pageMatch) {
        const pageNum = parseInt(pageMatch[1]);
        if (!pageMap.has(pageNum)) {
          pageMap.set(pageNum, data.content);
        }
      }
    });

    // Get the first chunk to extract metadata
    const firstChunk = chunksSnapshot.docs[0].data();
    const documentId = firstChunk.id?.split('_')[0] || uuidv4();

    // Create pages array (we'll mark all as needing review since we don't have the original extraction data)
    const totalPages = 204; // Known from the upload
    const pages = [];

    for (let i = 1; i <= totalPages; i++) {
      pages.push({
        pageNumber: i,
        extractedText: pageMap.get(i) || 'תוכן עמוד ' + i,
        verificationText: '',
        confidence: 'medium',
        agreementScore: 0.85,
        needsReview: true, // Mark all as needing review
      });
    }

    // Create the review document
    const reviewId = uuidv4();
    const review = {
      id: reviewId,
      documentId: documentId,
      fileName: 'השבחה ב ספר 1.pdf',
      storagePath: 'knowledge_pdfs/' + documentId + '.pdf',
      grade: 'ב',
      volume: 1,
      volumeType: 'student',
      subject: 'math',
      pages: pages,
      totalPages: totalPages,
      averageConfidence: 0.85,
      pagesNeedingReview: Array.from({length: totalPages}, (_, i) => i + 1),
      status: 'pending_review',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await db.collection('extraction_reviews').doc(reviewId).set(review);

    console.log('\n✅ Created extraction review: ' + reviewId);
    console.log('   Book: ספר תלמיד כיתה ב כרך 1');
    console.log('   Total pages: ' + totalPages);
    console.log('   Pages needing review: ' + totalPages);

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

createReviewForExistingBook();
