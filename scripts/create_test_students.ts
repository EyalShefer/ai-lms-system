/**
 * Create Test Student Users Script
 *
 * Creates 3 test student accounts for testing the student experience
 * Run with: npx tsx scripts/create_test_students.ts
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname hack
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Load env
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const SERVICE_ACCOUNT_PATH = path.join(PROJECT_ROOT, 'service-account-key.json');

// Fix for firebase-admin types
const { credential, firestore: adminFirestore } = admin;

// Test students configuration
const TEST_STUDENTS = [
    {
        email: 'student1.test@wizdi.io',
        password: 'Test123456!',
        displayName: 'תלמיד בדיקה 1',
        role: 'student' as const,
    },
    {
        email: 'student2.test@wizdi.io',
        password: 'Test123456!',
        displayName: 'תלמידה בדיקה 2',
        role: 'student' as const,
    },
    {
        email: 'student3.test@wizdi.io',
        password: 'Test123456!',
        displayName: 'תלמיד בדיקה 3',
        role: 'student' as const,
    },
];

async function createTestStudents() {
    console.log('🚀 Starting Test Students Creation...\n');

    // Check for service account
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error('❌ Error: service-account-key.json not found in project root.');
        console.log('\n📋 How to get it:');
        console.log('   1. Go to Firebase Console → Project Settings → Service Accounts');
        console.log('   2. Click "Generate new private key"');
        console.log('   3. Save the file as "service-account-key.json" in the project root');
        process.exit(1);
    }

    // Initialize Firebase Admin
    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));

    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: credential.cert(serviceAccount as admin.ServiceAccount),
        });
    }

    const auth = admin.auth();
    const db = admin.firestore();

    console.log('📦 Connected to Firebase\n');
    console.log('=' .repeat(50));

    const createdUsers: { email: string; uid: string; password: string }[] = [];

    for (const student of TEST_STUDENTS) {
        console.log(`\n👤 Creating: ${student.displayName} (${student.email})`);

        try {
            // Check if user already exists
            let userRecord: admin.auth.UserRecord;

            try {
                userRecord = await auth.getUserByEmail(student.email);
                console.log(`   ⚠️  User already exists with UID: ${userRecord.uid}`);
            } catch (error: any) {
                if (error.code === 'auth/user-not-found') {
                    // Create new user
                    userRecord = await auth.createUser({
                        email: student.email,
                        password: student.password,
                        displayName: student.displayName,
                        emailVerified: true, // Skip email verification for test users
                    });
                    console.log(`   ✅ Created Auth user with UID: ${userRecord.uid}`);
                } else {
                    throw error;
                }
            }

            // Create/update Firestore user document
            const userDocRef = db.collection('users').doc(userRecord.uid);
            const userDoc = await userDocRef.get();

            const userData = {
                uid: userRecord.uid,
                email: student.email,
                displayName: student.displayName,
                role: student.role,
                isTestUser: true, // Mark as test user for easy cleanup
                xp: 0,
                streak: 0,
                lastLearnDate: '',
                createdAt: userDoc.exists ? userDoc.data()?.createdAt : adminFirestore.FieldValue.serverTimestamp(),
                updatedAt: adminFirestore.FieldValue.serverTimestamp(),
            };

            await userDocRef.set(userData, { merge: true });
            console.log(`   ✅ Created/Updated Firestore document`);

            createdUsers.push({
                email: student.email,
                uid: userRecord.uid,
                password: student.password,
            });

        } catch (error) {
            console.error(`   ❌ Error creating ${student.email}:`, error);
        }
    }

    console.log('\n' + '=' .repeat(50));
    console.log('\n✅ Test Students Creation Complete!\n');

    console.log('📋 Created Users Summary:');
    console.log('-'.repeat(50));

    for (const user of createdUsers) {
        console.log(`\n   Email:    ${user.email}`);
        console.log(`   Password: ${user.password}`);
        console.log(`   UID:      ${user.uid}`);
    }

    console.log('\n' + '-'.repeat(50));
    console.log('\n💡 How to use these test users:');
    console.log('   1. Open an Incognito/Private browser window');
    console.log('   2. Go to your app login page');
    console.log('   3. Sign in with email/password using one of the accounts above');
    console.log('   4. Open a student activity link to test the student experience');
    console.log('\n⚠️  Note: These users are marked with isTestUser: true');
    console.log('    You can filter them out in analytics queries if needed.\n');

    process.exit(0);
}

// Run
createTestStudents().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});
