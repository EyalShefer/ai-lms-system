/**
 * Comprehensive Bagrut Content Seeder
 * מערכת אכלוס מקיפה לתוכן בגרויות
 *
 * מיועד לרוץ כל הלילה ולאכלס את כל התוכן הנדרש
 *
 * Usage:
 *   npx ts-node src/scripts/comprehensiveBagrutSeeder.ts
 *   npx ts-node src/scripts/comprehensiveBagrutSeeder.ts --subject=civics
 *   npx ts-node src/scripts/comprehensiveBagrutSeeder.ts --resume
 *   npx ts-node src/scripts/comprehensiveBagrutSeeder.ts --dry-run
 */

// Load environment variables from .env file
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    SUBJECT_CONTEXT,
    QUESTION_TYPE_TEMPLATES,
    DIFFICULTY_GUIDELINES,
    generateBagrutQuestionPrompt
} from '../prompts/bagrutPrompts';
import {
    EXAM_STRUCTURES,
    getPointsForQuestionType,
    type ExamStructure
} from '../prompts/bagrutExamStructures';
import type {
    BagrutSubject,
    BagrutQuestion,
    BagrutQuestionType,
    BagrutDifficulty,
    BagrutPracticeModule,
    BagrutChapter
} from '../../../src/shared/types/bagrutTypes';

// ============================================
// CONFIGURATION - מותאם למבנה בחינות בגרות אמיתי
// ============================================

const CONFIG = {
    // Questions per chapter target - מספר שאלות לפרק (מבוסס מבנה בחינה)
    // ברירת מחדל: 25-30 שאלות לפרק לכיסוי מקיף
    QUESTIONS_PER_CHAPTER: 25,

    // Difficulty distribution (percentages)
    DIFFICULTY_DISTRIBUTION: {
        1: 0.25,  // 25% easy - לתרגול בסיסי
        2: 0.45,  // 45% medium - רמת הבחינה
        3: 0.30   // 30% hard - אתגר
    } as Record<BagrutDifficulty, number>,

    // Rate limiting
    DELAY_BETWEEN_QUESTIONS_MS: 1500,
    DELAY_BETWEEN_CHAPTERS_MS: 3000,
    DELAY_BETWEEN_SUBJECTS_MS: 5000,
    DELAY_ON_ERROR_MS: 30000,

    // Retry settings
    MAX_RETRIES: 3,

    // Progress file
    PROGRESS_FILE: path.join(__dirname, 'bagrut_seeding_progress.json'),

    // Batch settings
    BATCH_SIZE: 5,

    // Gemini model - use gemini-2.0-flash as per AI_MODELS_POLICY.md
    MODEL_NAME: 'gemini-2.0-flash'
};

// Standard point values for Bagrut questions - ניקוד סטנדרטי
const STANDARD_POINTS: Record<BagrutQuestionType, number> = {
    'multiple-choice': 10,
    'open': 15,
    'source-analysis': 20,
    'essay': 25,
    'fill-in-blanks': 10,
    'matching': 10
};

/**
 * Get question type distribution based on real exam structure
 */
function getQuestionDistributionForSubject(subject: BagrutSubject): Array<{ type: BagrutQuestionType; count: number }> {
    const structure = EXAM_STRUCTURES[subject];
    const total = CONFIG.QUESTIONS_PER_CHAPTER;
    const dist = structure.questionDistribution;

    return [
        { type: 'source-analysis', count: Math.round(total * dist['source-analysis']) },
        { type: 'open', count: Math.round(total * dist['open']) },
        { type: 'multiple-choice', count: Math.round(total * dist['multiple-choice']) },
        { type: 'essay', count: Math.round(total * dist['essay']) }
    ];
}

// ============================================
// TYPES
// ============================================

interface SeedingProgress {
    startedAt: string;
    lastUpdated: string;
    subjects: Record<BagrutSubject, SubjectProgress>;
    totalQuestionsGenerated: number;
    totalErrors: number;
}

interface SubjectProgress {
    status: 'pending' | 'in_progress' | 'completed';
    chapters: Record<string, ChapterProgress>;
    moduleId?: string;
}

interface ChapterProgress {
    status: 'pending' | 'in_progress' | 'completed';
    questionsGenerated: number;
    questionIds: string[];
    errors: string[];
}

interface GeneratedQuestion {
    question: string;
    sourceText?: string;
    sourceReference?: string;
    options?: string[];
    correctOptionIndex?: number;
    modelAnswer: string;
    rubric?: Array<{
        criterion: string;
        maxPoints: number;
        levels?: Array<{ points: number; description: string }>;
    }>;
    keywords?: string[];
    commonMistakes?: string[];
    hints?: string[];
    timeEstimate?: number;
}

// ============================================
// INITIALIZATION
// ============================================

// Auto-detect Firebase credentials from CLI login
function findFirebaseCredentials(): string | null {
    // Check common locations for Firebase CLI credentials
    const appData = process.env.APPDATA || '';
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';

    const possiblePaths = [
        path.join(appData, 'firebase'),
        path.join(homeDir, '.config', 'firebase'),
        path.join(homeDir, '.firebase')
    ];

    for (const dir of possiblePaths) {
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir).filter(f => f.endsWith('_application_default_credentials.json'));
            if (files.length > 0) {
                return path.join(dir, files[0]);
            }
        }
    }
    return null;
}

// Set credentials if not already set
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credPath = findFirebaseCredentials();
    if (credPath) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
        console.log(`📋 Using Firebase credentials: ${path.basename(credPath)}`);
    }
}

// Initialize Firebase Admin
if (!admin.apps.length) {
    const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || 'ai-lms-pro';

    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId
        });
    } else {
        // Try default credentials with explicit project ID
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId
        });
    }
}

const db = admin.firestore();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ============================================
// PROGRESS MANAGEMENT
// ============================================

function loadProgress(): SeedingProgress {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
        const data = fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf8');
        return JSON.parse(data);
    }

    // Initialize fresh progress
    const progress: SeedingProgress = {
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        subjects: {} as Record<BagrutSubject, SubjectProgress>,
        totalQuestionsGenerated: 0,
        totalErrors: 0
    };

    // Initialize all subjects
    const subjects: BagrutSubject[] = ['civics', 'literature', 'bible', 'hebrew', 'english', 'history'];
    for (const subject of subjects) {
        progress.subjects[subject] = {
            status: 'pending',
            chapters: {}
        };

        // Initialize all chapters
        for (const chapter of SUBJECT_CONTEXT[subject].chapters) {
            progress.subjects[subject].chapters[chapter] = {
                status: 'pending',
                questionsGenerated: 0,
                questionIds: [],
                errors: []
            };
        }
    }

    return progress;
}

/**
 * Initialize progress from existing Firestore data
 * Counts existing questions per subject/chapter to avoid regenerating
 */
async function initializeProgressFromFirestore(): Promise<SeedingProgress> {
    console.log('🔍 Checking existing questions in Firestore...');

    const progress: SeedingProgress = {
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        subjects: {} as Record<BagrutSubject, SubjectProgress>,
        totalQuestionsGenerated: 0,
        totalErrors: 0
    };

    const subjects: BagrutSubject[] = ['civics', 'literature', 'bible', 'hebrew', 'english', 'history'];

    for (const subject of subjects) {
        progress.subjects[subject] = {
            status: 'pending',
            chapters: {}
        };

        // Initialize chapters and count existing questions
        for (const chapter of SUBJECT_CONTEXT[subject].chapters) {
            // Count existing questions for this chapter
            const existingSnapshot = await db.collection('bagrut_questions')
                .where('subject', '==', subject)
                .where('chapter', '==', chapter)
                .get();

            const existingCount = existingSnapshot.size;
            const questionIds = existingSnapshot.docs.map(doc => doc.id);

            progress.subjects[subject].chapters[chapter] = {
                status: existingCount >= CONFIG.QUESTIONS_PER_CHAPTER ? 'completed' : 'pending',
                questionsGenerated: existingCount,
                questionIds,
                errors: []
            };

            progress.totalQuestionsGenerated += existingCount;

            if (existingCount > 0) {
                console.log(`  📊 ${SUBJECT_CONTEXT[subject].hebrewName} - ${chapter}: ${existingCount} questions`);
            }
        }

        // Check if subject is complete
        const allChaptersComplete = Object.values(progress.subjects[subject].chapters)
            .every(ch => ch.questionsGenerated >= CONFIG.QUESTIONS_PER_CHAPTER);
        if (allChaptersComplete) {
            progress.subjects[subject].status = 'completed';
        }
    }

    console.log(`\n📈 Total existing questions: ${progress.totalQuestionsGenerated}\n`);

    // Save the initialized progress
    saveProgress(progress);

    return progress;
}

function saveProgress(progress: SeedingProgress): void {
    progress.lastUpdated = new Date().toISOString();
    fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ============================================
// AI QUESTION GENERATION
// ============================================

async function generateQuestionWithAI(
    subject: BagrutSubject,
    chapter: string,
    questionType: BagrutQuestionType,
    difficulty: BagrutDifficulty,
    existingTopics: string[] = []
): Promise<GeneratedQuestion | null> {
    const model = genAI.getGenerativeModel({ model: CONFIG.MODEL_NAME });

    // Generate a unique topic within the chapter
    const topicHint = existingTopics.length > 0
        ? `\n\nנושאים שכבר נוצרו (הימנע מהם): ${existingTopics.join(', ')}`
        : '';

    // Use standard point values based on question type
    const points = STANDARD_POINTS[questionType] || 15;

    const prompt = generateBagrutQuestionPrompt({
        subject,
        chapter,
        topic: `נושא מתוך הפרק${topicHint}`,
        questionType,
        difficulty,
        points
    });

    try {
        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Extract JSON from response
        let jsonString: string | null = null;

        const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
            jsonString = jsonMatch[1];
        } else {
            // Try to find JSON without code blocks
            const directJsonMatch = response.match(/\{[\s\S]*\}/);
            if (directJsonMatch) {
                jsonString = directJsonMatch[0];
            }
        }

        if (!jsonString) {
            console.error('No JSON found in response');
            return null;
        }

        // Try to parse, with fallback sanitization
        try {
            return JSON.parse(jsonString);
        } catch (parseError) {
            // Try to fix common JSON issues
            let sanitized = jsonString
                // Fix unescaped newlines in strings
                .replace(/(?<!\\)\n/g, '\\n')
                // Fix unescaped tabs
                .replace(/(?<!\\)\t/g, '\\t')
                // Fix trailing commas before closing brackets
                .replace(/,\s*([}\]])/g, '$1');

            try {
                return JSON.parse(sanitized);
            } catch {
                console.error('JSON parse failed even after sanitization');
                return null;
            }
        }
    } catch (error) {
        console.error('Error generating question:', error);
        return null;
    }
}

// ============================================
// QUESTION SAVING
// ============================================

async function saveQuestionToFirestore(
    question: GeneratedQuestion,
    subject: BagrutSubject,
    chapter: string,
    questionType: BagrutQuestionType,
    difficulty: BagrutDifficulty,
    points: number
): Promise<string | null> {
    try {
        // Build document, excluding undefined values
        const questionDoc: Record<string, any> = {
            subject,
            chapter,
            questionType,
            difficulty,
            points,
            question: question.question,
            modelAnswer: question.modelAnswer,
            rubric: (question.rubric || []).map((r, i) => ({
                id: `rubric-${i}`,
                criterion: r.criterion,
                maxPoints: r.maxPoints,
                levels: r.levels || [
                    { points: r.maxPoints, description: 'תשובה מלאה ומדויקת' },
                    { points: Math.floor(r.maxPoints * 0.5), description: 'תשובה חלקית' },
                    { points: 0, description: 'תשובה שגויה או חסרה' }
                ]
            })),
            keywords: question.keywords || [],
            commonMistakes: question.commonMistakes || [],
            hints: question.hints || [],
            timeEstimate: question.timeEstimate || 10,
            topic: chapter,
            units: 3,
            usageCount: 0,
            reviewStatus: 'approved',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: 'ai-seeder'
        };

        // Only add optional fields if they have values
        if (question.sourceText) questionDoc.sourceText = question.sourceText;
        if (question.sourceReference) questionDoc.sourceReference = question.sourceReference;
        if (question.options && question.options.length > 0) questionDoc.options = question.options;
        if (question.correctOptionIndex !== undefined) questionDoc.correctOptionIndex = question.correctOptionIndex;

        const docRef = await db.collection('bagrut_questions').add(questionDoc);
        return docRef.id;
    } catch (error) {
        console.error('Error saving question:', error);
        return null;
    }
}

// ============================================
// MODULE MANAGEMENT
// ============================================

async function getOrCreateModule(
    subject: BagrutSubject,
    progress: SeedingProgress
): Promise<string> {
    // Check if module already exists in progress
    if (progress.subjects[subject].moduleId) {
        return progress.subjects[subject].moduleId!;
    }

    // Check if module exists in Firestore
    const existingModules = await db.collection('bagrut_modules')
        .where('subject', '==', subject)
        .limit(1)
        .get();

    if (!existingModules.empty) {
        const moduleId = existingModules.docs[0].id;
        progress.subjects[subject].moduleId = moduleId;
        return moduleId;
    }

    // Create new module
    const subjectInfo = SUBJECT_CONTEXT[subject];
    const chapters: BagrutChapter[] = subjectInfo.chapters.map((chapterTitle, index) => ({
        id: `${subject}-chapter-${index + 1}`,
        title: chapterTitle,
        description: `פרק ${index + 1}: ${chapterTitle}`,
        order: index + 1,
        questionIds: [],
        practiceMode: 'sequential' as const,
        totalQuestions: 0
    }));

    const moduleDoc: Partial<BagrutPracticeModule> = {
        subject,
        title: `תרגול בגרות - ${subjectInfo.hebrewName}`,
        description: subjectInfo.description,
        chapters,
        isPublic: true,
        settings: {
            showHints: true,
            showModelAnswer: true,
            showRubric: false,
            allowRetry: true,
            shuffleQuestions: false,
            shuffleOptions: true,
            timeLimit: undefined
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp() as any
    };

    const docRef = await db.collection('bagrut_modules').add(moduleDoc);
    progress.subjects[subject].moduleId = docRef.id;

    console.log(`✅ Created module for ${subjectInfo.hebrewName}: ${docRef.id}`);
    return docRef.id;
}

async function updateModuleWithQuestions(
    moduleId: string,
    subject: BagrutSubject,
    chapterTitle: string,
    questionIds: string[]
): Promise<void> {
    const moduleRef = db.collection('bagrut_modules').doc(moduleId);
    const moduleDoc = await moduleRef.get();

    if (!moduleDoc.exists) {
        console.error('Module not found:', moduleId);
        return;
    }

    const moduleData = moduleDoc.data() as BagrutPracticeModule;
    const chapters = [...moduleData.chapters];

    // Find the chapter and update it
    const chapterIndex = chapters.findIndex(c => c.title === chapterTitle);
    if (chapterIndex === -1) {
        console.error('Chapter not found:', chapterTitle);
        return;
    }

    // Add new question IDs (avoid duplicates)
    const existingIds = new Set(chapters[chapterIndex].questionIds || []);
    for (const id of questionIds) {
        existingIds.add(id);
    }

    chapters[chapterIndex].questionIds = Array.from(existingIds);
    chapters[chapterIndex].totalQuestions = chapters[chapterIndex].questionIds.length;

    // Calculate total questions for module
    const totalQuestions = chapters.reduce((sum, c) => sum + (c.questionIds?.length || 0), 0);

    await moduleRef.update({
        chapters,
        totalQuestions,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

// ============================================
// SEEDING LOGIC
// ============================================

/**
 * Generate question types for a chapter based on real exam structure
 */
function getQuestionTypesForChapter(subject: BagrutSubject): Array<{ type: BagrutQuestionType; difficulty: BagrutDifficulty }> {
    const questions: Array<{ type: BagrutQuestionType; difficulty: BagrutDifficulty }> = [];
    const distribution = getQuestionDistributionForSubject(subject);

    // Add questions based on subject-specific distribution
    for (const { type, count } of distribution) {
        for (let i = 0; i < count; i++) {
            // Assign difficulty based on distribution
            const rand = Math.random();
            let difficulty: BagrutDifficulty;
            if (rand < CONFIG.DIFFICULTY_DISTRIBUTION[1]) {
                difficulty = 1;
            } else if (rand < CONFIG.DIFFICULTY_DISTRIBUTION[1] + CONFIG.DIFFICULTY_DISTRIBUTION[2]) {
                difficulty = 2;
            } else {
                difficulty = 3;
            }

            questions.push({ type, difficulty });
        }
    }

    // Shuffle
    return questions.sort(() => Math.random() - 0.5);
}

async function seedChapter(
    subject: BagrutSubject,
    chapter: string,
    progress: SeedingProgress,
    dryRun: boolean
): Promise<void> {
    const chapterProgress = progress.subjects[subject].chapters[chapter];

    // Skip only if we have enough questions (new target is 25 per chapter)
    if (chapterProgress.questionsGenerated >= CONFIG.QUESTIONS_PER_CHAPTER) {
        console.log(`⏭️  Skipping chapter with sufficient questions: ${chapter} (${chapterProgress.questionsGenerated} questions)`);
        return;
    }

    // Reset status if we need more questions
    if (chapterProgress.status === 'completed' && chapterProgress.questionsGenerated < CONFIG.QUESTIONS_PER_CHAPTER) {
        console.log(`🔄 Reopening chapter for more questions: ${chapter} (${chapterProgress.questionsGenerated}/${CONFIG.QUESTIONS_PER_CHAPTER})`);
        chapterProgress.status = 'in_progress';
    }

    console.log(`\n📚 Seeding chapter: ${chapter} (current: ${chapterProgress.questionsGenerated}/${CONFIG.QUESTIONS_PER_CHAPTER})`);
    chapterProgress.status = 'in_progress';
    saveProgress(progress);

    const questionsToGenerate = getQuestionTypesForChapter(subject);
    const existingTopics: string[] = [];

    for (let i = 0; i < questionsToGenerate.length; i++) {
        const { type, difficulty } = questionsToGenerate[i];

        // Skip if we already have enough questions
        if (chapterProgress.questionsGenerated >= CONFIG.QUESTIONS_PER_CHAPTER) {
            break;
        }

        console.log(`  📝 Generating ${type} question (difficulty ${difficulty})... [${i + 1}/${questionsToGenerate.length}]`);

        let retries = 0;
        let success = false;

        while (retries < CONFIG.MAX_RETRIES && !success) {
            try {
                if (dryRun) {
                    console.log(`    [DRY RUN] Would generate ${type} question`);
                    success = true;
                    break;
                }

                const question = await generateQuestionWithAI(
                    subject,
                    chapter,
                    type,
                    difficulty,
                    existingTopics
                );

                if (question) {
                    // Use standard point values based on question type
                    const points = STANDARD_POINTS[type] || 15;

                    const questionId = await saveQuestionToFirestore(
                        question,
                        subject,
                        chapter,
                        type,
                        difficulty,
                        points
                    );

                    if (questionId) {
                        chapterProgress.questionIds.push(questionId);
                        chapterProgress.questionsGenerated++;
                        progress.totalQuestionsGenerated++;

                        // Track topic to avoid duplicates
                        if (question.question) {
                            existingTopics.push(question.question.substring(0, 50));
                        }

                        console.log(`    ✅ Question saved: ${questionId}`);
                        success = true;
                    }
                } else {
                    // Question generation returned null (JSON parse error or no JSON found)
                    retries++;
                    console.log(`    ⚠️ Question generation failed (attempt ${retries}/${CONFIG.MAX_RETRIES})`);
                    if (retries >= CONFIG.MAX_RETRIES) {
                        console.log(`    ⏭️ Skipping after ${CONFIG.MAX_RETRIES} failed attempts`);
                        break;
                    }
                    await sleep(CONFIG.DELAY_ON_ERROR_MS);
                    continue;
                }

                // Rate limiting
                await sleep(CONFIG.DELAY_BETWEEN_QUESTIONS_MS);

            } catch (error) {
                retries++;
                console.error(`    ❌ Error (attempt ${retries}/${CONFIG.MAX_RETRIES}):`, error);
                chapterProgress.errors.push(`${type}: ${error}`);
                progress.totalErrors++;

                if (retries < CONFIG.MAX_RETRIES) {
                    console.log(`    ⏳ Waiting ${CONFIG.DELAY_ON_ERROR_MS / 1000}s before retry...`);
                    await sleep(CONFIG.DELAY_ON_ERROR_MS);
                }
            }
        }

        // Save progress after each question
        saveProgress(progress);
    }

    // Mark chapter as completed
    chapterProgress.status = 'completed';
    saveProgress(progress);

    // Update module with new questions
    if (!dryRun && chapterProgress.questionIds.length > 0) {
        const moduleId = await getOrCreateModule(subject, progress);
        await updateModuleWithQuestions(moduleId, subject, chapter, chapterProgress.questionIds);
    }

    console.log(`  ✅ Chapter completed: ${chapterProgress.questionsGenerated} questions`);
}

async function seedSubject(
    subject: BagrutSubject,
    progress: SeedingProgress,
    dryRun: boolean
): Promise<void> {
    const subjectInfo = SUBJECT_CONTEXT[subject];
    const subjectProgress = progress.subjects[subject];

    // Check if subject needs more questions
    const totalExisting = Object.values(subjectProgress.chapters)
        .reduce((sum, c) => sum + c.questionsGenerated, 0);
    const targetTotal = subjectInfo.chapters.length * CONFIG.QUESTIONS_PER_CHAPTER;

    if (totalExisting >= targetTotal) {
        console.log(`\n⏭️  Skipping subject with sufficient questions: ${subjectInfo.hebrewName} (${totalExisting}/${targetTotal})`);
        return;
    }

    // Reset status if we need more questions
    if (subjectProgress.status === 'completed' && totalExisting < targetTotal) {
        console.log(`\n🔄 Reopening subject for more questions: ${subjectInfo.hebrewName} (${totalExisting}/${targetTotal})`);
        subjectProgress.status = 'in_progress';
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📘 Starting subject: ${subjectInfo.hebrewName}`);
    console.log(`   Chapters: ${subjectInfo.chapters.length}`);
    console.log(`${'='.repeat(60)}`);

    subjectProgress.status = 'in_progress';
    saveProgress(progress);

    // Ensure module exists
    if (!dryRun) {
        await getOrCreateModule(subject, progress);
    }

    // Seed each chapter
    for (const chapter of subjectInfo.chapters) {
        await seedChapter(subject, chapter, progress, dryRun);
        await sleep(CONFIG.DELAY_BETWEEN_CHAPTERS_MS);
    }

    // Check if all chapters are completed
    const allCompleted = Object.values(subjectProgress.chapters).every(c => c.status === 'completed');
    if (allCompleted) {
        subjectProgress.status = 'completed';
        saveProgress(progress);
    }

    const totalQuestions = Object.values(subjectProgress.chapters)
        .reduce((sum, c) => sum + c.questionsGenerated, 0);

    console.log(`\n✅ Subject ${subjectInfo.hebrewName} completed: ${totalQuestions} questions total`);
}

async function runSeeding(options: {
    subjects?: BagrutSubject[];
    resume?: boolean;
    dryRun?: boolean;
}): Promise<void> {
    console.log('\n🚀 Starting Comprehensive Bagrut Seeding');
    console.log(`   Time: ${new Date().toISOString()}`);
    console.log(`   Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   Resume: ${options.resume ? 'Yes' : 'No'}`);

    // Load or initialize progress
    let progress: SeedingProgress;

    if (options.resume && fs.existsSync(CONFIG.PROGRESS_FILE)) {
        // Resume from existing progress file
        progress = loadProgress();
    } else {
        // Initialize from Firestore to count existing questions
        progress = await initializeProgressFromFirestore();
    }

    // If specific subjects requested, reset those only
    if (!options.resume && options.subjects) {
        for (const subject of options.subjects) {
            progress.subjects[subject].status = 'pending';
            for (const chapter of Object.keys(progress.subjects[subject].chapters)) {
                progress.subjects[subject].chapters[chapter] = {
                    status: 'pending',
                    questionsGenerated: 0,
                    questionIds: [],
                    errors: []
                };
            }
        }
    }

    saveProgress(progress);

    // Determine subjects to seed
    const subjectsToSeed = options.subjects || (['civics', 'literature', 'bible', 'hebrew', 'english', 'history'] as BagrutSubject[]);

    console.log(`\n📋 Subjects to seed: ${subjectsToSeed.map(s => SUBJECT_CONTEXT[s].hebrewName).join(', ')}`);

    // Calculate expected questions
    const totalChapters = subjectsToSeed.reduce((sum, s) => sum + SUBJECT_CONTEXT[s].chapters.length, 0);
    const expectedQuestions = totalChapters * CONFIG.QUESTIONS_PER_CHAPTER;
    console.log(`   Expected questions: ~${expectedQuestions}`);
    console.log(`   Estimated time: ~${Math.ceil(expectedQuestions * (CONFIG.DELAY_BETWEEN_QUESTIONS_MS / 1000 / 60))} minutes\n`);

    // Seed each subject
    for (const subject of subjectsToSeed) {
        await seedSubject(subject, progress, options.dryRun || false);
        await sleep(CONFIG.DELAY_BETWEEN_SUBJECTS_MS);
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total questions generated: ${progress.totalQuestionsGenerated}`);
    console.log(`Total errors: ${progress.totalErrors}`);
    console.log(`Started: ${progress.startedAt}`);
    console.log(`Completed: ${new Date().toISOString()}`);

    for (const [subject, data] of Object.entries(progress.subjects)) {
        const subjectQuestions = Object.values(data.chapters).reduce((sum, c) => sum + c.questionsGenerated, 0);
        const subjectName = SUBJECT_CONTEXT[subject as BagrutSubject].hebrewName;
        console.log(`  ${subjectName}: ${subjectQuestions} questions (${data.status})`);
    }

    console.log('\n✅ Seeding completed!');
}

// ============================================
// UTILITY
// ============================================

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// CLI
// ============================================

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    const options: {
        subjects?: BagrutSubject[];
        resume?: boolean;
        dryRun?: boolean;
    } = {};

    for (const arg of args) {
        if (arg === '--resume') {
            options.resume = true;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg.startsWith('--subject=')) {
            const subject = arg.split('=')[1] as BagrutSubject;
            if (SUBJECT_CONTEXT[subject]) {
                options.subjects = [subject];
            } else {
                console.error(`Invalid subject: ${subject}`);
                console.error(`Valid subjects: civics, literature, bible, hebrew, english, history`);
                process.exit(1);
            }
        } else if (arg.startsWith('--subjects=')) {
            const subjects = arg.split('=')[1].split(',') as BagrutSubject[];
            options.subjects = subjects.filter(s => SUBJECT_CONTEXT[s]);
        }
    }

    // Check for API key
    if (!process.env.GEMINI_API_KEY && !options.dryRun) {
        console.error('❌ GEMINI_API_KEY environment variable not set');
        console.error('Set it with: export GEMINI_API_KEY=your-api-key');
        console.error('Or run with --dry-run to test without API');
        process.exit(1);
    }

    try {
        await runSeeding(options);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }

    process.exit(0);
}

main();
