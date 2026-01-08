// Script to add QA tester role to a user
// Run with: node scripts/add-qa-role.js

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const USER_ID = 'fBWl9vvkdcX5nFVWm7cOd6Qu4hv2';

async function addQARole() {
  try {
    const userRef = db.collection('users').doc(USER_ID);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Create user document with QA role
      await userRef.set({
        roles: ['qa_tester'],
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Created user document with qa_tester role');
    } else {
      // Update existing user document
      const userData = userDoc.data();
      const existingRoles = userData.roles || [];

      if (!existingRoles.includes('qa_tester')) {
        await userRef.update({
          roles: admin.firestore.FieldValue.arrayUnion('qa_tester'),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Added qa_tester role to existing user');
      } else {
        console.log('ℹ️ User already has qa_tester role');
      }
    }

    // Verify
    const updatedDoc = await userRef.get();
    console.log('📋 Current user data:', updatedDoc.data());

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

addQARole();
