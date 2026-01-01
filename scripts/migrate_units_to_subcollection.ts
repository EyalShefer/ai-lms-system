
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Hack for ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Load env
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const SERVICE_ACCOUNT_PATH = path.join(PROJECT_ROOT, 'service-account-key.json');

// --- Types (Re-defined to avoid import issues outside src) ---
interface LearningUnit {
    id: string;
    title: string;
    type: string;
    baseContent: string;
    activityBlocks: any[];
    audioOverview?: any;
    [key: string]: any;
}

interface Module {
    id: string;
    title: string;
    learningUnits: LearningUnit[];
}

interface Course {
    id: string;
    title: string;
    syllabus: Module[];
    [key: string]: any;
}

async function startMigration() {
    console.log("🚀 Starting Firestore Migration: Units to Sub-collections...");

    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error("❌ Error: service-account-key.json not found in root.");
        process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    const db = admin.firestore();
    const coursesRef = db.collection('courses');
    const snapshot = await coursesRef.get();

    console.log(`Found ${snapshot.size} courses to migrate.`);

    let migratedCount = 0;
    let errorsCount = 0;

    for (const doc of snapshot.docs) {
        const courseId = doc.id;
        const courseData = doc.data() as Course;

        console.log(`\n📦 Processing Course: ${courseData.title} (${courseId})`);

        if (!courseData.syllabus || !Array.isArray(courseData.syllabus)) {
            console.log("   - Skipped: No syllabus found.");
            continue;
        }

        const batch = db.batch();
        let opsCount = 0;
        let unitsMigrated = 0;

        // New Syllabus (Stipped)
        const newSyllabus = courseData.syllabus.map(module => {
            const newUnits = module.learningUnits.map(unit => {
                // 1. Prepare Unit Document for Sub-collection
                const unitRef = coursesRef.doc(courseId).collection('units').doc(unit.id);

                // Full unit data goes to sub-collection
                batch.set(unitRef, unit);
                opsCount++;
                unitsMigrated++;

                // 2. Return Lightweight Unit for Main Doc
                // Keep minimal metadata, strip heavy arrays/text
                return {
                    id: unit.id,
                    title: unit.title,
                    type: unit.type,
                    // Flag to indicate content is elsewhere
                    isLazy: true,
                    // Keep undefined/null for stripped fields
                    baseContent: null,
                    activityBlocks: [],
                    audioOverview: null
                };
            });

            return {
                ...module,
                learningUnits: newUnits
            };
        });

        // 3. Update Main Course Document
        const courseRef = coursesRef.doc(courseId);
        batch.update(courseRef, { syllabus: newSyllabus });
        opsCount++;

        // Commit Batch (Max 500 ops - assuming standard course isn't huge, otherwise we'd chunk)
        if (opsCount > 0) {
            try {
                await batch.commit();
                console.log(`   ✅ Migrated ${unitsMigrated} units.`);
                migratedCount++;
            } catch (error) {
                console.error(`   ❌ Error migrating course ${courseId}:`, error);
                errorsCount++;
            }
        } else {
            console.log("   - No changes needed.");
        }
    }

    console.log("\n-----------------------------------");
    console.log(`Migration Complete.`);
    console.log(`Success: ${migratedCount}`);
    console.log(`Errors: ${errorsCount}`);
    process.exit(0);
}

startMigration();
