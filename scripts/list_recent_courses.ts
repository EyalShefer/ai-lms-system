/**
 * List Recent Courses
 * Run with: npx tsx scripts/list_recent_courses.ts
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SERVICE_ACCOUNT_PATH = path.join(PROJECT_ROOT, 'service-account-key.json');

async function listCourses() {
    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));

    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        });
    }

    const db = admin.firestore();
    const courses = await db.collection('courses')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

    console.log('Recent courses:\n');
    for (const doc of courses.docs) {
        const data = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`   Title: ${data.title}`);
        console.log(`   ProductType: ${data.productType || 'N/A'}`);
        console.log(`   ShareableLink: ${data.shareableLink || false}`);
        console.log('');
    }

    process.exit(0);
}

listCourses();
