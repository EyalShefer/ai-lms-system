/**
 * Database Migration Utilities
 * Run these functions from the browser console or via admin panel
 */

import { db } from '../firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

/**
 * Migrate productType from 'game' to 'activity' in all courses
 * Run this once after deploying the code change
 *
 * Usage (from browser console):
 * import { migrateGameToActivity } from './utils/migrations';
 * await migrateGameToActivity();
 */
export async function migrateGameToActivity(): Promise<{
    total: number;
    updated: number;
    skipped: number;
    errors: string[];
}> {
    console.log('🚀 Starting migration: game → activity');

    const results = {
        total: 0,
        updated: 0,
        skipped: 0,
        errors: [] as string[]
    };

    try {
        const coursesRef = collection(db, 'courses');
        const snapshot = await getDocs(coursesRef);

        results.total = snapshot.size;
        console.log(`📊 Found ${results.total} courses to check`);

        for (const docSnapshot of snapshot.docs) {
            const courseId = docSnapshot.id;
            const data = docSnapshot.data();

            try {
                const currentProductType = data.wizardData?.settings?.productType;

                if (currentProductType === 'game') {
                    // Update the productType
                    const courseRef = doc(db, 'courses', courseId);
                    await updateDoc(courseRef, {
                        'wizardData.settings.productType': 'activity'
                    });

                    results.updated++;
                    console.log(`✅ Updated course: ${data.title || courseId}`);
                } else {
                    results.skipped++;
                    // Only log if it has a productType (skip silent for undefined)
                    if (currentProductType) {
                        console.log(`⏭️ Skipped (${currentProductType}): ${data.title || courseId}`);
                    }
                }
            } catch (error: any) {
                results.errors.push(`${courseId}: ${error.message}`);
                console.error(`❌ Error updating ${courseId}:`, error);
            }
        }

        console.log('\n📋 Migration Summary:');
        console.log(`   Total courses: ${results.total}`);
        console.log(`   Updated: ${results.updated}`);
        console.log(`   Skipped: ${results.skipped}`);
        console.log(`   Errors: ${results.errors.length}`);

        if (results.errors.length > 0) {
            console.log('\n❌ Errors:', results.errors);
        }

        return results;

    } catch (error: any) {
        console.error('❌ Migration failed:', error);
        results.errors.push(`Global error: ${error.message}`);
        return results;
    }
}

// Expose to window for easy console access
if (typeof window !== 'undefined') {
    (window as any).migrateGameToActivity = migrateGameToActivity;
}
