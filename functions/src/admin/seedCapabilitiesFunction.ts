/**
 * Seed Capabilities Function
 *
 * Admin function to seed/refresh capabilities in Firestore.
 * Should only be called by admins or during setup.
 */

import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { SEED_CAPABILITIES } from '../data/seedCapabilities';

const db = getFirestore();

/**
 * HTTP endpoint to seed capabilities
 * POST /seedCapabilities
 *
 * Query params:
 * - force=true: Replace existing capabilities
 */
export const seedCapabilities = onRequest({
    cors: true,
    region: 'us-central1'
}, async (req, res) => {
    // Check request method
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // Check for admin auth (simplified - in production use proper auth)
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const forceReplace = req.query.force === 'true';

    try {
        console.log(`📚 [seedCapabilities] Starting seed with ${SEED_CAPABILITIES.length} capabilities...`);
        console.log(`🔄 [seedCapabilities] Force replace: ${forceReplace}`);

        const batch = db.batch();
        const results = {
            created: 0,
            updated: 0,
            skipped: 0,
            errors: [] as string[]
        };

        for (const capability of SEED_CAPABILITIES) {
            const docRef = db.collection('capabilities').doc(capability.id);

            try {
                const existing = await docRef.get();

                if (existing.exists && !forceReplace) {
                    // Skip existing if not forcing
                    results.skipped++;
                    console.log(`⏭️ Skipping existing: ${capability.id}`);
                    continue;
                }

                // Prepare document data
                const docData = {
                    ...capability,
                    createdAt: existing.exists
                        ? existing.data()?.createdAt || new Date()
                        : new Date(),
                    updatedAt: new Date()
                };

                batch.set(docRef, docData, { merge: !forceReplace });

                if (existing.exists) {
                    results.updated++;
                    console.log(`🔄 Updating: ${capability.id}`);
                } else {
                    results.created++;
                    console.log(`✨ Creating: ${capability.id}`);
                }

            } catch (error: any) {
                results.errors.push(`${capability.id}: ${error.message}`);
                console.error(`❌ Error with ${capability.id}:`, error);
            }
        }

        // Commit batch
        await batch.commit();

        console.log(`✅ [seedCapabilities] Done!`, results);

        res.json({
            success: true,
            message: 'Capabilities seeded successfully',
            results
        });

    } catch (error: any) {
        console.error('❌ [seedCapabilities] Failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Callable function to seed capabilities (for admin dashboard)
 */
export const seedCapabilitiesCallable = onCall({
    region: 'us-central1'
}, async (request) => {
    // Check if user is admin
    const isAdmin = request.auth?.token?.admin === true;
    const isOwner = request.auth?.uid === 'OWNER_UID'; // Replace with actual owner UID

    if (!request.auth || (!isAdmin && !isOwner)) {
        throw new HttpsError('permission-denied', 'Only admins can seed capabilities');
    }

    const forceReplace = request.data?.force === true;

    console.log(`📚 [seedCapabilitiesCallable] User ${request.auth.uid} seeding capabilities...`);

    const batch = db.batch();
    const results = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [] as string[]
    };

    for (const capability of SEED_CAPABILITIES) {
        const docRef = db.collection('capabilities').doc(capability.id);

        try {
            const existing = await docRef.get();

            if (existing.exists && !forceReplace) {
                results.skipped++;
                continue;
            }

            const docData = {
                ...capability,
                createdAt: existing.exists
                    ? existing.data()?.createdAt || new Date()
                    : new Date(),
                updatedAt: new Date()
            };

            batch.set(docRef, docData, { merge: !forceReplace });

            if (existing.exists) {
                results.updated++;
            } else {
                results.created++;
            }

        } catch (error: any) {
            results.errors.push(`${capability.id}: ${error.message}`);
        }
    }

    await batch.commit();

    return {
        success: true,
        results
    };
});

/**
 * Get capability by ID
 */
export const getCapability = onCall({
    region: 'us-central1'
}, async (request) => {
    const capabilityId = request.data?.id;
    if (!capabilityId) {
        throw new HttpsError('invalid-argument', 'Capability ID is required');
    }

    const doc = await db.collection('capabilities').doc(capabilityId).get();

    if (!doc.exists) {
        throw new HttpsError('not-found', 'Capability not found');
    }

    return {
        success: true,
        capability: { id: doc.id, ...doc.data() }
    };
});

/**
 * List all capabilities (with optional filtering)
 */
export const listCapabilities = onCall({
    region: 'us-central1'
}, async (request) => {
    const { category, status, showInMenu } = request.data || {};

    let query: FirebaseFirestore.Query = db.collection('capabilities');

    if (status) {
        query = query.where('status', '==', status);
    }
    if (category) {
        query = query.where('category', '==', category);
    }
    if (showInMenu !== undefined) {
        query = query.where('ui.showInMenu', '==', showInMenu);
    }

    const snapshot = await query.get();

    const capabilities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    return {
        success: true,
        count: capabilities.length,
        capabilities
    };
});
