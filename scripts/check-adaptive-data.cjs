/**
 * Script: Check Adaptive Learning Data in Firestore
 *
 * Run with: node scripts/check-adaptive-data.cjs [userId]
 *
 * This script checks:
 * 1. Student profiles exist and have data
 * 2. Proficiency vectors are being updated
 * 3. Error fingerprints are collected
 * 4. Adaptive events are logged
 * 5. Variants exist in course content
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (e) {
    console.log('⚠️  No service account key found. Using default credentials.');
    admin.initializeApp();
}

const db = admin.firestore();

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(color, ...args) {
    console.log(colors[color], ...args, colors.reset);
}

async function checkStudentProfile(userId) {
    log('cyan', '\n📊 Checking Student Profile...');

    // Profile stats
    const statsRef = db.doc(`users/${userId}/profile/stats`);
    const statsSnap = await statsRef.get();

    if (statsSnap.exists) {
        const data = statsSnap.data();
        log('green', '✅ Profile stats found:');
        console.log('   Performance:');
        console.log(`     - Accuracy: ${Math.round((data.performance?.global_accuracy_rate || 0) * 100)}%`);
        console.log(`     - Response time: ${data.performance?.average_response_time_sec || 0}s`);
        console.log(`     - Total questions: ${data.performance?.total_questions_attempted || 0}`);
        console.log('   Behavioral:');
        console.log(`     - Hint dependency: ${Math.round((data.behavioral?.hint_dependency_score || 0) * 100)}%`);
        console.log(`     - Media preference:`, data.behavioral?.media_preference || 'N/A');
        console.log('   Engagement:');
        console.log(`     - Completed lessons: ${data.engagement?.completed_lessons_count || 0}`);
        console.log(`     - Last active: ${data.engagement?.last_active_at?.toDate?.() || 'N/A'}`);
    } else {
        log('red', '❌ No profile stats found');
    }

    // Proficiency vector
    const profRef = db.doc(`users/${userId}/profile/proficiency_vector`);
    const profSnap = await profRef.get();

    if (profSnap.exists) {
        const data = profSnap.data();
        const topics = data.topics || {};
        log('green', `✅ Proficiency vector found (${Object.keys(topics).length} topics):`);
        Object.entries(topics).slice(0, 5).forEach(([topic, mastery]) => {
            console.log(`     - ${topic}: ${Math.round(mastery * 100)}%`);
        });
    } else {
        log('yellow', '⚠️  No proficiency vector found');
    }

    // Error fingerprint
    const errorRef = db.doc(`users/${userId}/profile/error_fingerprint`);
    const errorSnap = await errorRef.get();

    if (errorSnap.exists) {
        const data = errorSnap.data();
        const tags = data.errorTags || {};
        log('green', `✅ Error fingerprint found (${Object.keys(tags).length} patterns):`);
        Object.entries(tags).forEach(([tag, count]) => {
            console.log(`     - ${tag}: ${count}`);
        });
    } else {
        log('yellow', '⚠️  No error fingerprint found');
    }

    // Adaptive stats
    const adaptiveRef = db.doc(`users/${userId}/profile/adaptive_stats`);
    const adaptiveSnap = await adaptiveRef.get();

    if (adaptiveSnap.exists) {
        const data = adaptiveSnap.data();
        const counts = data.counts || {};
        log('green', `✅ Adaptive stats found:`);
        console.log(`     - Total events: ${counts.total || 0}`);
        console.log(`     - BKT updates: ${counts.bkt_update || 0}`);
        console.log(`     - Variants selected: ${counts.variant_selected || 0}`);
        console.log(`     - Challenge mode: ${counts.challenge_mode || 0}`);
        console.log(`     - Remediation: ${counts.remediation_injected || 0}`);
    } else {
        log('yellow', '⚠️  No adaptive stats found (new logging system)');
    }

    // Adaptive events (recent)
    const eventsRef = db.collection(`users/${userId}/adaptive_events`).orderBy('timestamp', 'desc').limit(5);
    const eventsSnap = await eventsRef.get();

    if (!eventsSnap.empty) {
        log('green', `✅ Adaptive events found (${eventsSnap.size} recent):`);
        eventsSnap.docs.forEach(doc => {
            const e = doc.data();
            console.log(`     - ${e.type}: ${JSON.stringify(e.data).slice(0, 60)}...`);
        });
    } else {
        log('yellow', '⚠️  No adaptive events found');
    }
}

async function checkCourseVariants(courseId) {
    log('cyan', '\n📚 Checking Course Variants...');

    const courseRef = db.doc(`courses/${courseId}`);
    const courseSnap = await courseRef.get();

    if (!courseSnap.exists) {
        log('red', `❌ Course ${courseId} not found`);
        return;
    }

    const course = courseSnap.data();
    log('green', `✅ Course found: ${course.title || 'Untitled'}`);

    // Check blocks in first unit
    const units = course.syllabus?.[0]?.learningUnits || course.units || [];
    if (units.length === 0) {
        log('yellow', '⚠️  No units found in course');
        return;
    }

    const blocks = units[0]?.blocks || [];
    let withVariants = 0;
    let withoutVariants = 0;

    blocks.forEach(block => {
        const hasScaffolding = !!block.metadata?.scaffolding_variant || !!block.metadata?.scaffolding_id;
        const hasEnrichment = !!block.metadata?.enrichment_variant || !!block.metadata?.enrichment_id;

        if (hasScaffolding || hasEnrichment) {
            withVariants++;
        } else if (['multiple-choice', 'open-question', 'fill_in_blanks', 'ordering'].includes(block.type)) {
            withoutVariants++;
        }
    });

    console.log(`   Total blocks: ${blocks.length}`);
    console.log(`   Question blocks with variants: ${withVariants}`);
    console.log(`   Question blocks WITHOUT variants: ${withoutVariants}`);

    if (withoutVariants > 0) {
        log('yellow', `⚠️  ${withoutVariants} question blocks missing variants (content created before Jan 10)`);
    } else if (withVariants > 0) {
        log('green', '✅ All question blocks have variants!');
    }
}

async function findRecentUsers() {
    log('cyan', '\n👥 Finding Recent Active Users...');

    const enrollmentsRef = db.collection('enrollments').orderBy('enrolledAt', 'desc').limit(10);
    const enrollmentsSnap = await enrollmentsRef.get();

    if (enrollmentsSnap.empty) {
        log('yellow', '⚠️  No enrollments found');
        return [];
    }

    const userIds = [...new Set(enrollmentsSnap.docs.map(d => d.data().studentId))];
    log('green', `Found ${userIds.length} recent users`);

    return userIds;
}

async function findRecentCourses() {
    log('cyan', '\n📚 Finding Recent Courses...');

    const coursesRef = db.collection('courses').orderBy('createdAt', 'desc').limit(5);
    const coursesSnap = await coursesRef.get();

    if (coursesSnap.empty) {
        log('yellow', '⚠️  No courses found');
        return [];
    }

    const courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    courses.forEach(c => {
        console.log(`   - ${c.id}: ${c.title || 'Untitled'}`);
    });

    return courses.map(c => c.id);
}

async function main() {
    log('bold', '\n🔬 Adaptive Learning System - Data Check\n');
    log('blue', '=' .repeat(50));

    const specificUserId = process.argv[2];

    if (specificUserId) {
        // Check specific user
        await checkStudentProfile(specificUserId);
    } else {
        // Find and check recent users
        const userIds = await findRecentUsers();
        if (userIds.length > 0) {
            await checkStudentProfile(userIds[0]);
        }
    }

    // Check recent courses for variants
    const courseIds = await findRecentCourses();
    if (courseIds.length > 0) {
        await checkCourseVariants(courseIds[0]);
    }

    log('blue', '\n' + '=' .repeat(50));
    log('bold', '\n✅ Check complete!\n');

    process.exit(0);
}

main().catch(err => {
    log('red', 'Error:', err);
    process.exit(1);
});
