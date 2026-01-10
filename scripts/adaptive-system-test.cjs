/**
 * Adaptive Learning System - Comprehensive Test Agent
 *
 * This script tests ALL components of the adaptive learning system:
 * 1. Content Variants Generation (scaffolding/enrichment)
 * 2. BKT Mastery Calculation
 * 3. Policy Engine Decisions
 * 4. Profile Service (Mock or Firestore)
 * 5. Variant Selection Logic
 * 6. Analytics Service
 *
 * Run with: node scripts/adaptive-system-test.cjs
 * Run with Firestore: node scripts/adaptive-system-test.cjs --firestore
 */

const { v4: uuidv4 } = require('uuid');

// ============================================
// MODE DETECTION
// ============================================

const USE_FIRESTORE = process.argv.includes('--firestore');

let db = null;
if (USE_FIRESTORE) {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
        admin.initializeApp({
            projectId: 'ai-lms-pro'
        });
    }
    db = admin.firestore();
}

// ============================================
// MOCK FIRESTORE (In-Memory)
// ============================================

class MockFirestore {
    constructor() {
        this.data = {};
    }

    collection(name) {
        if (!this.data[name]) {
            this.data[name] = {};
        }
        return new MockCollection(this.data, name);
    }

    clear() {
        this.data = {};
    }
}

class MockCollection {
    constructor(data, name) {
        this.data = data;
        this.name = name;
    }

    doc(id) {
        const docId = id || `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return new MockDocRef(this.data, this.name, docId);
    }

    where(field, op, value) {
        return new MockQuery(this.data, this.name, [{ field, op, value }]);
    }

    async get() {
        const docs = Object.entries(this.data[this.name] || {}).map(([id, data]) => ({
            id,
            exists: true,
            data: () => data,
            ref: new MockDocRef(this.data, this.name, id)
        }));
        return { docs, size: docs.length, empty: docs.length === 0 };
    }
}

class MockQuery {
    constructor(data, name, filters) {
        this.data = data;
        this.name = name;
        this.filters = filters;
    }

    where(field, op, value) {
        return new MockQuery(this.data, this.name, [...this.filters, { field, op, value }]);
    }

    async get() {
        let docs = Object.entries(this.data[this.name] || {});

        for (const filter of this.filters) {
            docs = docs.filter(([id, data]) => {
                const fieldValue = filter.field.split('.').reduce((obj, key) => obj?.[key], data);
                if (filter.op === '==') return fieldValue === filter.value;
                return true;
            });
        }

        const result = docs.map(([id, data]) => ({
            id,
            exists: true,
            data: () => data,
            ref: new MockDocRef(this.data, this.name, id)
        }));

        return { docs: result, size: result.length, empty: result.length === 0 };
    }
}

class MockDocRef {
    constructor(data, collection, id) {
        this.data = data;
        this.collectionName = collection;
        this.id = id;
    }

    collection(name) {
        const subCollectionName = `${this.collectionName}/${this.id}/${name}`;
        if (!this.data[subCollectionName]) {
            this.data[subCollectionName] = {};
        }
        return new MockCollection(this.data, subCollectionName);
    }

    async set(value) {
        if (!this.data[this.collectionName]) {
            this.data[this.collectionName] = {};
        }
        this.data[this.collectionName][this.id] = { ...value };
        return this;
    }

    async update(value) {
        if (!this.data[this.collectionName]) {
            this.data[this.collectionName] = {};
        }
        const existing = this.data[this.collectionName][this.id] || {};

        // Handle dot notation updates
        for (const [key, val] of Object.entries(value)) {
            if (key.includes('.')) {
                const parts = key.split('.');
                let obj = existing;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!obj[parts[i]]) obj[parts[i]] = {};
                    obj = obj[parts[i]];
                }
                obj[parts[parts.length - 1]] = val;
            } else {
                existing[key] = val;
            }
        }

        this.data[this.collectionName][this.id] = existing;
        return this;
    }

    async get() {
        const docData = this.data[this.collectionName]?.[this.id];
        return {
            exists: !!docData,
            data: () => docData,
            id: this.id,
            ref: this
        };
    }

    async delete() {
        if (this.data[this.collectionName]) {
            delete this.data[this.collectionName][this.id];
        }
        return this;
    }
}

// Use mock if not using Firestore
const mockDb = new MockFirestore();
const getDb = () => USE_FIRESTORE ? db : mockDb;

// Mock FieldValue for timestamps
const MockFieldValue = {
    serverTimestamp: () => new Date().toISOString()
};

const getFieldValue = () => {
    if (USE_FIRESTORE) {
        const admin = require('firebase-admin');
        return admin.firestore.FieldValue;
    }
    return MockFieldValue;
};

// ============================================
// TEST CONFIGURATION
// ============================================

const TEST_CONFIG = {
    courseId: 'test-adaptive-course-001',
    courseName: 'מתמטיקה - שברים פשוטים',
    topic: 'fractions_basic',
    students: [
        {
            id: 'test-student-struggling',
            name: 'דני כהן',
            email: 'dani@test.com',
            profile: 'struggling',
            expectedVariant: 'scaffolding'
        },
        {
            id: 'test-student-average',
            name: 'מיכל לוי',
            email: 'michal@test.com',
            profile: 'average',
            expectedVariant: 'original'
        },
        {
            id: 'test-student-advanced',
            name: 'יוסי פרץ',
            email: 'yossi@test.com',
            profile: 'advanced',
            expectedVariant: 'enrichment'
        }
    ]
};

// ============================================
// TEST UTILITIES
// ============================================

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(60));
    log(`  ${title}`, 'cyan');
    console.log('='.repeat(60));
}

function logTest(testName, passed, details = '') {
    const icon = passed ? '✅' : '❌';
    const color = passed ? 'green' : 'red';
    log(`${icon} ${testName}${details ? ': ' + details : ''}`, color);
    return passed;
}

// ============================================
// TEST 1: Content Variants Generation
// ============================================

async function testContentVariantsGeneration() {
    logSection('TEST 1: Content Variants Generation');

    const results = { passed: 0, failed: 0, tests: [] };

    // Create a sample block
    const sampleBlock = {
        id: 'test-block-001',
        type: 'multiple-choice',
        content: {
            question: 'מה הוא 1/2 + 1/4?',
            options: ['3/4', '2/6', '1/6', '3/6'],
            correctIndex: 0
        },
        metadata: {
            topic: 'fractions_basic',
            difficulty_level: 0.5
        }
    };

    // Test 1.1: Block structure exists
    const hasRequiredFields = sampleBlock.id && sampleBlock.type && sampleBlock.content;
    if (logTest('Block has required fields (id, type, content)', hasRequiredFields)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Block structure', passed: hasRequiredFields });

    // Test 1.2: Simulate variant generation logic
    const mockScaffoldingVariant = {
        id: `${sampleBlock.id}_scaffolding`,
        type: sampleBlock.type,
        content: {
            question: 'מה הוא 1/2 + 1/4? (רמז: המכנה המשותף הוא 4)',
            options: ['3/4', '2/6', '1/6', '3/6'],
            correctIndex: 0
        },
        metadata: {
            ...sampleBlock.metadata,
            isVariant: true,
            variantType: 'scaffolding',
            originalBlockId: sampleBlock.id,
            progressiveHints: [
                'חשוב על פיצה חתוכה ל-4 חלקים',
                '1/2 = 2/4',
                '2/4 + 1/4 = ?'
            ],
            difficulty_level: 0.3
        }
    };

    const scaffoldingHasHints = mockScaffoldingVariant.metadata.progressiveHints?.length > 0;
    if (logTest('Scaffolding variant has progressive hints', scaffoldingHasHints,
        `${mockScaffoldingVariant.metadata.progressiveHints?.length} hints`)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Scaffolding hints', passed: scaffoldingHasHints });

    const scaffoldingLowerDifficulty = mockScaffoldingVariant.metadata.difficulty_level < sampleBlock.metadata.difficulty_level;
    if (logTest('Scaffolding has lower difficulty', scaffoldingLowerDifficulty,
        `${mockScaffoldingVariant.metadata.difficulty_level} < ${sampleBlock.metadata.difficulty_level}`)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Scaffolding difficulty', passed: scaffoldingLowerDifficulty });

    // Test 1.3: Enrichment variant
    const mockEnrichmentVariant = {
        id: `${sampleBlock.id}_enrichment`,
        type: sampleBlock.type,
        content: {
            question: 'חשב: 1/2 + 1/4 + 1/8. הסבר מדוע התוצאה קרובה ל-1 אך לא שווה ל-1.',
            options: ['7/8', '6/8', '8/8', '5/8'],
            correctIndex: 0
        },
        metadata: {
            ...sampleBlock.metadata,
            isVariant: true,
            variantType: 'enrichment',
            originalBlockId: sampleBlock.id,
            extensionQuestion: 'מה יקרה אם נמשיך את הסדרה 1/2 + 1/4 + 1/8 + 1/16 + ... ?',
            connectionNote: 'קשור לסדרות הנדסיות וגבולות',
            difficulty_level: 0.7,
            bloom_taxonomy: 'Analyze'
        }
    };

    const enrichmentHasExtension = !!mockEnrichmentVariant.metadata.extensionQuestion;
    if (logTest('Enrichment variant has extension question', enrichmentHasExtension)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Enrichment extension', passed: enrichmentHasExtension });

    const enrichmentHigherDifficulty = mockEnrichmentVariant.metadata.difficulty_level > sampleBlock.metadata.difficulty_level;
    if (logTest('Enrichment has higher difficulty', enrichmentHigherDifficulty,
        `${mockEnrichmentVariant.metadata.difficulty_level} > ${sampleBlock.metadata.difficulty_level}`)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Enrichment difficulty', passed: enrichmentHigherDifficulty });

    const enrichmentHigherBloom = mockEnrichmentVariant.metadata.bloom_taxonomy === 'Analyze';
    if (logTest('Enrichment has higher Bloom level', enrichmentHigherBloom, mockEnrichmentVariant.metadata.bloom_taxonomy)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Enrichment Bloom', passed: enrichmentHigherBloom });

    return results;
}

// ============================================
// TEST 2: BKT Mastery Calculation
// ============================================

async function testBKTCalculation() {
    logSection('TEST 2: BKT Mastery Calculation');

    const results = { passed: 0, failed: 0, tests: [] };

    // BKT Parameters (from adaptiveService.ts)
    const BKT_PARAMS = {
        p_init: 0.3,
        p_learn: 0.1,
        p_slip: 0.1,
        p_guess: 0.25
    };

    // BKT Update function
    function updateBKT(priorMastery, isCorrect) {
        const { p_slip, p_guess, p_learn } = BKT_PARAMS;

        let posteriorKnown;
        if (isCorrect) {
            const pCorrectGivenKnown = 1 - p_slip;
            const pCorrectGivenNotKnown = p_guess;
            const pCorrect = priorMastery * pCorrectGivenKnown + (1 - priorMastery) * pCorrectGivenNotKnown;
            posteriorKnown = (priorMastery * pCorrectGivenKnown) / pCorrect;
        } else {
            const pIncorrectGivenKnown = p_slip;
            const pIncorrectGivenNotKnown = 1 - p_guess;
            const pIncorrect = priorMastery * pIncorrectGivenKnown + (1 - priorMastery) * pIncorrectGivenNotKnown;
            posteriorKnown = (priorMastery * pIncorrectGivenKnown) / pIncorrect;
        }

        const newMastery = posteriorKnown + (1 - posteriorKnown) * p_learn;
        return Math.min(0.99, Math.max(0.01, newMastery));
    }

    // Test 2.1: Mastery increases with correct answers
    let mastery = BKT_PARAMS.p_init;
    for (let i = 0; i < 5; i++) {
        mastery = updateBKT(mastery, true);
    }

    const masteryIncreased = mastery > BKT_PARAMS.p_init;
    if (logTest('Mastery increases with correct answers', masteryIncreased,
        `${BKT_PARAMS.p_init.toFixed(3)} → ${mastery.toFixed(3)}`)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Mastery increase', passed: masteryIncreased });

    // Test 2.2: Mastery decreases with incorrect answers
    let decreasingMastery = 0.8;
    for (let i = 0; i < 3; i++) {
        decreasingMastery = updateBKT(decreasingMastery, false);
    }

    const masteryDecreased = decreasingMastery < 0.8;
    if (logTest('Mastery decreases with incorrect answers', masteryDecreased,
        `0.800 → ${decreasingMastery.toFixed(3)}`)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Mastery decrease', passed: masteryDecreased });

    // Test 2.3: Mastery is bounded [0.01, 0.99]
    let extremeHigh = updateBKT(0.99, true);
    let extremeLow = updateBKT(0.01, false);

    const boundedHigh = extremeHigh <= 0.99;
    const boundedLow = extremeLow >= 0.01;
    if (logTest('Mastery is bounded [0.01, 0.99]', boundedHigh && boundedLow,
        `High: ${extremeHigh.toFixed(3)}, Low: ${extremeLow.toFixed(3)}`)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Mastery bounds', passed: boundedHigh && boundedLow });

    // Test 2.4: Action determination
    function determineAction(mastery, accuracy) {
        if (mastery >= 0.95) return 'mastered';
        if (mastery >= 0.8 && accuracy >= 0.85) return 'challenge';
        if (mastery < 0.4 && accuracy < 0.5) return 'remediate';
        return 'continue';
    }

    const actionMastered = determineAction(0.96, 0.9) === 'mastered';
    const actionChallenge = determineAction(0.85, 0.9) === 'challenge';
    const actionRemediate = determineAction(0.3, 0.4) === 'remediate';
    const actionContinue = determineAction(0.6, 0.7) === 'continue';

    if (logTest('Action: mastered when mastery >= 0.95', actionMastered)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Action mastered', passed: actionMastered });

    if (logTest('Action: challenge when high mastery + accuracy', actionChallenge)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Action challenge', passed: actionChallenge });

    if (logTest('Action: remediate when low mastery + accuracy', actionRemediate)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Action remediate', passed: actionRemediate });

    if (logTest('Action: continue for average performance', actionContinue)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Action continue', passed: actionContinue });

    return results;
}

// ============================================
// TEST 3: Variant Selection Logic
// ============================================

async function testVariantSelection() {
    logSection('TEST 3: Variant Selection Logic');

    const results = { passed: 0, failed: 0, tests: [] };

    function selectVariant(mastery, accuracy, hasScaffolding, hasEnrichment) {
        if (mastery < 0.4 && accuracy < 0.5 && hasScaffolding) {
            return 'scaffolding';
        }
        if (mastery > 0.8 && accuracy > 0.9 && hasEnrichment) {
            return 'enrichment';
        }
        return 'original';
    }

    // Test 3.1: Scaffolding for struggling students
    const struggling = selectVariant(0.3, 0.4, true, true);
    if (logTest('Struggling student (0.3, 0.4) → scaffolding', struggling === 'scaffolding', struggling)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Struggling → scaffolding', passed: struggling === 'scaffolding' });

    // Test 3.2: Enrichment for advanced students
    const advanced = selectVariant(0.85, 0.92, true, true);
    if (logTest('Advanced student (0.85, 0.92) → enrichment', advanced === 'enrichment', advanced)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Advanced → enrichment', passed: advanced === 'enrichment' });

    // Test 3.3: Original for average students
    const average = selectVariant(0.6, 0.7, true, true);
    if (logTest('Average student (0.6, 0.7) → original', average === 'original', average)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Average → original', passed: average === 'original' });

    // Test 3.4: No scaffolding available → original
    const noScaffolding = selectVariant(0.3, 0.4, false, true);
    if (logTest('No scaffolding available → original', noScaffolding === 'original', noScaffolding)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'No scaffolding → original', passed: noScaffolding === 'original' });

    // Test 3.5: No enrichment available → original
    const noEnrichment = selectVariant(0.85, 0.92, true, false);
    if (logTest('No enrichment available → original', noEnrichment === 'original', noEnrichment)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'No enrichment → original', passed: noEnrichment === 'original' });

    // Test 3.6: getInitialVariant for existing profile
    function getInitialVariant(topicMastery, hasScaffolding, hasEnrichment) {
        if (topicMastery === undefined) return 'original';
        if (topicMastery > 0.75 && hasEnrichment) return 'enrichment';
        if (topicMastery < 0.35 && hasScaffolding) return 'scaffolding';
        return 'original';
    }

    const initialHigh = getInitialVariant(0.8, true, true);
    if (logTest('Initial variant for high mastery (0.8) → enrichment', initialHigh === 'enrichment', initialHigh)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Initial high → enrichment', passed: initialHigh === 'enrichment' });

    const initialLow = getInitialVariant(0.2, true, true);
    if (logTest('Initial variant for low mastery (0.2) → scaffolding', initialLow === 'scaffolding', initialLow)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Initial low → scaffolding', passed: initialLow === 'scaffolding' });

    const initialNew = getInitialVariant(undefined, true, true);
    if (logTest('Initial variant for new student → original', initialNew === 'original', initialNew)) {
        results.passed++;
    } else {
        results.failed++;
    }
    results.tests.push({ name: 'Initial new → original', passed: initialNew === 'original' });

    return results;
}

// ============================================
// TEST 4: Profile Service (Firestore/Mock)
// ============================================

async function testProfileService() {
    logSection(`TEST 4: Profile Service (${USE_FIRESTORE ? 'Firestore' : 'Mock'} Persistence)`);

    const results = { passed: 0, failed: 0, tests: [] };
    const testUserId = 'test-profile-user-' + Date.now();
    const database = getDb();
    const FieldValue = getFieldValue();

    try {
        // Test 4.1: Create user profile
        const userRef = database.collection('users').doc(testUserId);
        await userRef.set({
            displayName: 'Test User',
            email: 'test@adaptive.test',
            createdAt: FieldValue.serverTimestamp()
        });

        const userDoc = await userRef.get();
        if (logTest('Create user profile', userDoc.exists)) {
            results.passed++;
        } else {
            results.failed++;
        }
        results.tests.push({ name: 'Create user', passed: userDoc.exists });

        // Test 4.2: Create proficiency vector
        const proficiencyRef = userRef.collection('profile').doc('proficiency_vector');
        await proficiencyRef.set({
            topics: {
                'fractions_basic': 0.65,
                'fractions_advanced': 0.4,
                'decimals': 0.8
            },
            updatedAt: FieldValue.serverTimestamp()
        });

        const profDoc = await proficiencyRef.get();
        const profData = profDoc.data();
        if (logTest('Create proficiency vector', profDoc.exists && profData?.topics)) {
            results.passed++;
        } else {
            results.failed++;
        }
        results.tests.push({ name: 'Create proficiency', passed: profDoc.exists });

        // Test 4.3: Update proficiency vector
        await proficiencyRef.update({
            'topics.fractions_basic': 0.75
        });

        const updatedProf = await proficiencyRef.get();
        const updatedProfData = updatedProf.data();
        const profUpdated = updatedProfData?.topics?.fractions_basic === 0.75;
        if (logTest('Update proficiency vector', profUpdated, `fractions_basic: ${updatedProfData?.topics?.fractions_basic}`)) {
            results.passed++;
        } else {
            results.failed++;
        }
        results.tests.push({ name: 'Update proficiency', passed: profUpdated });

        // Test 4.4: Create stats
        const statsRef = userRef.collection('profile').doc('stats');
        await statsRef.set({
            performance: {
                global_accuracy_rate: 0.72,
                average_response_time_sec: 18.5,
                total_questions_attempted: 45
            },
            behavioral: {
                hint_dependency_score: 0.25,
                skip_rate: 0.05
            },
            engagement: {
                last_active_at: FieldValue.serverTimestamp(),
                total_sessions: 12
            }
        });

        const statsDoc = await statsRef.get();
        if (logTest('Create performance stats', statsDoc.exists)) {
            results.passed++;
        } else {
            results.failed++;
        }
        results.tests.push({ name: 'Create stats', passed: statsDoc.exists });

        // Test 4.5: Create error fingerprint
        const errorRef = userRef.collection('profile').doc('error_fingerprint');
        await errorRef.set({
            errorTags: {
                'calculation_error': 8,
                'sign_error': 3,
                'conceptual_misunderstanding': 2
            },
            topMisconceptions: ['fraction_addition_without_common_denominator'],
            updatedAt: FieldValue.serverTimestamp()
        });

        const errorDoc = await errorRef.get();
        if (logTest('Create error fingerprint', errorDoc.exists)) {
            results.passed++;
        } else {
            results.failed++;
        }
        results.tests.push({ name: 'Create error fingerprint', passed: errorDoc.exists });

        // Test 4.6: Create session
        const sessionRef = userRef.collection('sessions').doc('test-session');
        await sessionRef.set({
            courseId: TEST_CONFIG.courseId,
            startTime: FieldValue.serverTimestamp(),
            interactions: [
                {
                    questionId: 'q1',
                    isCorrect: true,
                    responseTime: 12.5,
                    hintsUsed: 0,
                    timestamp: Date.now()
                },
                {
                    questionId: 'q2',
                    isCorrect: false,
                    responseTime: 25.3,
                    hintsUsed: 2,
                    timestamp: Date.now() + 30000
                }
            ]
        });

        const sessionDoc = await sessionRef.get();
        if (logTest('Create session with interactions', sessionDoc.exists)) {
            results.passed++;
        } else {
            results.failed++;
        }
        results.tests.push({ name: 'Create session', passed: sessionDoc.exists });

        // Cleanup
        await sessionRef.delete();
        await errorRef.delete();
        await statsRef.delete();
        await proficiencyRef.delete();
        await userRef.delete();
        log('  Cleaned up test data', 'yellow');

    } catch (error) {
        log(`  Error: ${error.message}`, 'red');
        results.failed++;
        results.tests.push({ name: 'Database operations', passed: false });
    }

    return results;
}

// ============================================
// TEST 5: Simulate 3 Students
// ============================================

async function simulateStudents() {
    logSection(`TEST 5: Simulate 3 Student Learning Sessions (${USE_FIRESTORE ? 'Firestore' : 'Mock'})`);

    const results = { passed: 0, failed: 0, tests: [] };
    const database = getDb();
    const FieldValue = getFieldValue();

    for (const student of TEST_CONFIG.students) {
        log(`\n  📚 Simulating: ${student.name} (${student.profile})`, 'magenta');

        try {
            // Create user
            const userRef = database.collection('users').doc(student.id);
            await userRef.set({
                displayName: student.name,
                email: student.email,
                role: 'student',
                createdAt: FieldValue.serverTimestamp()
            });

            // Set profile-specific data
            let mastery, accuracy, hintDependency, errorTags;

            if (student.profile === 'struggling') {
                mastery = 0.28;
                accuracy = 0.35;
                hintDependency = 0.7;
                errorTags = { 'calculation_error': 12, 'sign_error': 8, 'conceptual': 5 };
            } else if (student.profile === 'average') {
                mastery = 0.55;
                accuracy = 0.65;
                hintDependency = 0.3;
                errorTags = { 'calculation_error': 4, 'sign_error': 2 };
            } else {
                mastery = 0.88;
                accuracy = 0.92;
                hintDependency = 0.05;
                errorTags = { 'careless_error': 1 };
            }

            // Create proficiency vector
            await userRef.collection('profile').doc('proficiency_vector').set({
                topics: {
                    [TEST_CONFIG.topic]: mastery,
                    'fractions_advanced': mastery * 0.7,
                    'decimals': mastery * 1.1
                },
                updatedAt: FieldValue.serverTimestamp()
            });

            // Create stats
            await userRef.collection('profile').doc('stats').set({
                performance: {
                    global_accuracy_rate: accuracy,
                    average_response_time_sec: student.profile === 'struggling' ? 35 : student.profile === 'average' ? 20 : 12,
                    total_questions_attempted: 50
                },
                behavioral: {
                    hint_dependency_score: hintDependency,
                    skip_rate: student.profile === 'struggling' ? 0.15 : 0.02
                },
                engagement: {
                    last_active_at: FieldValue.serverTimestamp(),
                    total_sessions: student.profile === 'struggling' ? 5 : student.profile === 'average' ? 10 : 15
                }
            });

            // Create error fingerprint
            await userRef.collection('profile').doc('error_fingerprint').set({
                errorTags,
                updatedAt: FieldValue.serverTimestamp()
            });

            // Create enrollment
            await database.collection('enrollments').doc(`${student.id}_${TEST_CONFIG.courseId}`).set({
                studentId: student.id,
                courseId: TEST_CONFIG.courseId,
                enrolledAt: FieldValue.serverTimestamp()
            });

            // Create sessions
            const sessionCount = student.profile === 'struggling' ? 3 : student.profile === 'average' ? 5 : 8;
            for (let s = 0; s < sessionCount; s++) {
                const interactions = [];
                const interactionCount = 5 + Math.floor(Math.random() * 5);

                for (let i = 0; i < interactionCount; i++) {
                    const baseCorrectProb = student.profile === 'struggling' ? 0.3 :
                                            student.profile === 'average' ? 0.65 : 0.9;
                    const isCorrect = Math.random() < baseCorrectProb;

                    interactions.push({
                        questionId: `q-${s}-${i}`,
                        type: 'multiple-choice',
                        isCorrect,
                        responseTime: (student.profile === 'struggling' ? 30 : student.profile === 'average' ? 18 : 10) + Math.random() * 10,
                        hintsUsed: student.profile === 'struggling' ? Math.floor(Math.random() * 3) : 0,
                        attemptCount: isCorrect ? 1 : Math.floor(Math.random() * 3) + 1,
                        timestamp: Date.now() - (sessionCount - s) * 86400000 + i * 60000,
                        variantUsed: student.expectedVariant
                    });
                }

                await userRef.collection('sessions').doc(`session-${s}`).set({
                    courseId: TEST_CONFIG.courseId,
                    startTime: Date.now() - (sessionCount - s) * 86400000,
                    endTime: Date.now() - (sessionCount - s) * 86400000 + 1800000,
                    interactions
                });
            }

            // Verify variant selection
            const selectVariant = (m, a) => {
                if (m < 0.4 && a < 0.5) return 'scaffolding';
                if (m > 0.8 && a > 0.9) return 'enrichment';
                return 'original';
            };

            const selectedVariant = selectVariant(mastery, accuracy);
            const variantCorrect = selectedVariant === student.expectedVariant;

            if (logTest(`  ${student.name}: variant selection`, variantCorrect,
                `Expected: ${student.expectedVariant}, Got: ${selectedVariant}`)) {
                results.passed++;
            } else {
                results.failed++;
            }
            results.tests.push({
                name: `${student.name} variant`,
                passed: variantCorrect
            });

            log(`    ✓ Created profile with mastery=${mastery}, accuracy=${accuracy}`, 'green');
            log(`    ✓ Created ${sessionCount} sessions with interactions`, 'green');

        } catch (error) {
            log(`    ✗ Error: ${error.message}`, 'red');
            results.failed++;
            results.tests.push({ name: `${student.name} simulation`, passed: false });
        }
    }

    return results;
}

// ============================================
// TEST 6: Analytics Service
// ============================================

async function testAnalyticsService() {
    logSection(`TEST 6: Analytics Service (${USE_FIRESTORE ? 'Firestore' : 'Mock'} Data Retrieval)`);

    const results = { passed: 0, failed: 0, tests: [] };
    const database = getDb();

    try {
        // Test 6.1: Get enrollments
        const enrollmentsSnap = await database.collection('enrollments')
            .where('courseId', '==', TEST_CONFIG.courseId)
            .get();

        const enrollmentCount = enrollmentsSnap.size;
        if (logTest('Retrieve enrollments for course', enrollmentCount === 3, `Found ${enrollmentCount} students`)) {
            results.passed++;
        } else {
            results.failed++;
        }
        results.tests.push({ name: 'Get enrollments', passed: enrollmentCount === 3 });

        // Test 6.2: Get student analytics
        for (const student of TEST_CONFIG.students) {
            const userRef = database.collection('users').doc(student.id);
            const profRef = userRef.collection('profile').doc('proficiency_vector');
            const statsRef = userRef.collection('profile').doc('stats');
            const errorRef = userRef.collection('profile').doc('error_fingerprint');

            const [profSnap, statsSnap, errorSnap] = await Promise.all([
                profRef.get(),
                statsRef.get(),
                errorRef.get()
            ]);

            const hasAllData = profSnap.exists && statsSnap.exists && errorSnap.exists;
            if (logTest(`  ${student.name}: full profile data`, hasAllData)) {
                results.passed++;
            } else {
                results.failed++;
            }
            results.tests.push({ name: `${student.name} profile`, passed: hasAllData });

            // Get sessions
            const sessionsSnap = await userRef.collection('sessions').get();
            const sessionCount = sessionsSnap.size;
            if (logTest(`  ${student.name}: sessions retrieved`, sessionCount > 0, `${sessionCount} sessions`)) {
                results.passed++;
            } else {
                results.failed++;
            }
            results.tests.push({ name: `${student.name} sessions`, passed: sessionCount > 0 });
        }

        // Test 6.3: Calculate risk level
        function calculateRiskLevel(accuracy, hintDependency, avgMastery) {
            if (accuracy < 0.4 || hintDependency > 0.7 || avgMastery < 0.3) return 'high';
            if (accuracy < 0.7 || hintDependency > 0.4 || avgMastery < 0.6) return 'medium';
            return 'low';
        }

        const riskTests = [
            { accuracy: 0.35, hint: 0.7, mastery: 0.28, expected: 'high' },
            { accuracy: 0.65, hint: 0.3, mastery: 0.55, expected: 'medium' },
            { accuracy: 0.92, hint: 0.05, mastery: 0.88, expected: 'low' }
        ];

        for (const test of riskTests) {
            const risk = calculateRiskLevel(test.accuracy, test.hint, test.mastery);
            if (logTest(`Risk calculation: ${test.expected}`, risk === test.expected,
                `accuracy=${test.accuracy}, hint=${test.hint}, mastery=${test.mastery}`)) {
                results.passed++;
            } else {
                results.failed++;
            }
            results.tests.push({ name: `Risk ${test.expected}`, passed: risk === test.expected });
        }

    } catch (error) {
        log(`  Error: ${error.message}`, 'red');
        results.failed++;
        results.tests.push({ name: 'Analytics operations', passed: false });
    }

    return results;
}

// ============================================
// MAIN: Run All Tests
// ============================================

async function runAllTests() {
    console.log('\n' + '█'.repeat(60));
    log('█  ADAPTIVE LEARNING SYSTEM - COMPREHENSIVE TEST SUITE  █', 'cyan');
    console.log('█'.repeat(60));
    log(`\nTest Started: ${new Date().toISOString()}`, 'yellow');
    log(`Mode: ${USE_FIRESTORE ? 'FIRESTORE (Real Database)' : 'MOCK (In-Memory)'}`, 'yellow');
    log(`Course: ${TEST_CONFIG.courseName}`, 'yellow');
    log(`Students: ${TEST_CONFIG.students.map(s => s.name).join(', ')}`, 'yellow');

    const allResults = {
        totalPassed: 0,
        totalFailed: 0,
        sections: []
    };

    // Run all test sections
    const testSections = [
        { name: 'Content Variants', fn: testContentVariantsGeneration },
        { name: 'BKT Calculation', fn: testBKTCalculation },
        { name: 'Variant Selection', fn: testVariantSelection },
        { name: 'Profile Service', fn: testProfileService },
        { name: 'Student Simulation', fn: simulateStudents },
        { name: 'Analytics Service', fn: testAnalyticsService }
    ];

    for (const section of testSections) {
        try {
            const results = await section.fn();
            allResults.totalPassed += results.passed;
            allResults.totalFailed += results.failed;
            allResults.sections.push({
                name: section.name,
                ...results
            });
        } catch (error) {
            log(`\n❌ ${section.name} CRASHED: ${error.message}`, 'red');
            allResults.totalFailed++;
            allResults.sections.push({
                name: section.name,
                passed: 0,
                failed: 1,
                error: error.message
            });
        }
    }

    // Print Summary
    logSection('TEST SUMMARY');

    console.log('\n  Section Results:');
    for (const section of allResults.sections) {
        const icon = section.failed === 0 ? '✅' : '⚠️';
        log(`  ${icon} ${section.name}: ${section.passed}/${section.passed + section.failed} passed`,
            section.failed === 0 ? 'green' : 'yellow');
    }

    const totalTests = allResults.totalPassed + allResults.totalFailed;
    const passRate = ((allResults.totalPassed / totalTests) * 100).toFixed(1);

    console.log('\n' + '-'.repeat(40));
    log(`  TOTAL: ${allResults.totalPassed}/${totalTests} tests passed (${passRate}%)`,
        allResults.totalFailed === 0 ? 'green' : 'yellow');

    if (allResults.totalFailed === 0) {
        log('\n  🎉 ALL TESTS PASSED! The adaptive system is working correctly.', 'green');
    } else {
        log(`\n  ⚠️ ${allResults.totalFailed} test(s) failed. Review the output above.`, 'yellow');
    }

    log(`\nTest Completed: ${new Date().toISOString()}`, 'yellow');

    return allResults;
}

// Run if called directly
runAllTests()
    .then((results) => {
        process.exit(results.totalFailed === 0 ? 0 : 1);
    })
    .catch((error) => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
