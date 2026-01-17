/**
 * Fix Activity Course Permissions
 *
 * Adds shareableLink: true to all activity courses
 * Run with: npx tsx scripts/fix_activity_permissions.ts
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SERVICE_ACCOUNT_PATH = path.join(PROJECT_ROOT, 'service-account-key.json');

async function fixActivityPermissions() {
    console.log('🔧 Fixing Activity Course Permissions...\n');

    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error('❌ service-account-key.json not found');
        process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));

    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        });
    }

    const db = admin.firestore();

    // Find all activity courses
    const coursesRef = db.collection('courses');
    const activityCourses = await coursesRef.where('productType', '==', 'activity').get();

    console.log(`Found ${activityCourses.size} activity courses\n`);

    let updated = 0;
    for (const doc of activityCourses.docs) {
        const data = doc.data();
        if (!data.shareableLink) {
            console.log(`  Updating: ${doc.id} - ${data.title}`);
            await doc.ref.update({ shareableLink: true });
            updated++;
        }
    }

    console.log(`\n✅ Updated ${updated} courses`);
    process.exit(0);
}

fixActivityPermissions().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
