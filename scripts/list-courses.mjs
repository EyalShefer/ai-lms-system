/**
 * List all courses from Firestore
 *
 * Usage: node scripts/list-courses.mjs
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
let serviceAccount;
try {
    const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch (error) {
    console.error('❌ Error: serviceAccountKey.json not found');
    console.error('Please download it from Firebase Console:');
    console.error('1. Go to Firebase Console → Project Settings → Service Accounts');
    console.error('2. Click "Generate New Private Key"');
    console.error('3. Save as serviceAccountKey.json in project root');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listCourses() {
    console.log('\n📚 Fetching courses from Firestore...\n');

    try {
        const coursesSnapshot = await db.collection('courses').get();

        if (coursesSnapshot.empty) {
            console.log('⚠️  No courses found in Firestore');
            console.log('\nAlternative: You can also check the "tasks" collection:');

            const tasksSnapshot = await db.collection('tasks').limit(5).get();
            if (!tasksSnapshot.empty) {
                console.log('\n📝 Found tasks (these might have courseId):');
                tasksSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    console.log(`  - Task ID: ${doc.id}`);
                    if (data.courseId) {
                        console.log(`    Course ID: ${data.courseId}`);
                    }
                });
            }
            return;
        }

        console.log(`✅ Found ${coursesSnapshot.size} course(s):\n`);

        coursesSnapshot.forEach((doc, index) => {
            const data = doc.data();
            console.log(`${index + 1}. Course ID: ${doc.id}`);
            console.log(`   Title: ${data.title || data.name || 'Untitled'}`);
            console.log(`   Created by: ${data.createdBy || 'Unknown'}`);
            console.log(`   Created at: ${data.createdAt?.toDate?.() || 'Unknown'}`);
            console.log('');
        });

        console.log('\n💡 To run the simulation, use:');
        console.log(`   node scripts/simulate-adaptive-students.mjs <COURSE_ID> fBWl9vvkdcX5nFVWm7cOd6Qu4hv2`);
        console.log('');

    } catch (error) {
        console.error('❌ Error fetching courses:', error.message);
        console.error(error);
    }
}

listCourses()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
