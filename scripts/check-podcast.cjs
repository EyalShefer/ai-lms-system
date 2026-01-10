const admin = require('firebase-admin');

// Initialize with default credentials (works with gcloud auth or GOOGLE_APPLICATION_CREDENTIALS)
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'ai-lms-pro'
    });
}

const db = admin.firestore();

async function checkLatestPodcast() {
    // Get recent courses with podcast
    const coursesSnap = await db.collection('courses')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

    for (const doc of coursesSnap.docs) {
        const data = doc.data();
        const syllabus = data.syllabus || [];

        for (const mod of syllabus) {
            for (const unit of (mod.learningUnits || [])) {
                const blocks = unit.activityBlocks || [];
                const podcastBlock = blocks.find(b => b.type === 'podcast');
                if (podcastBlock) {
                    console.log('=== FOUND PODCAST ===');
                    console.log('Course ID:', doc.id);
                    console.log('Course Title:', data.title);
                    console.log('Unit Title:', unit.title);
                    console.log('Block Type:', podcastBlock.type);
                    console.log('Has Script:', !!podcastBlock.content?.script);
                    console.log('Script Lines:', podcastBlock.content?.script?.lines?.length || 0);
                    console.log('Audio URL:', podcastBlock.content?.audioUrl || 'null');
                    if (podcastBlock.content?.script?.lines?.[0]) {
                        console.log('First Line Sample:', JSON.stringify(podcastBlock.content.script.lines[0]).substring(0, 150));
                    }
                    console.log('Full Block Structure:', JSON.stringify(podcastBlock, null, 2).substring(0, 500));
                    return;
                }
            }
        }
    }
    console.log('No podcast found in recent courses');
}

checkLatestPodcast().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
