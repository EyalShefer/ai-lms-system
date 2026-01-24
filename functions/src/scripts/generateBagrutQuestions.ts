/**
 * AI-Powered Bagrut Question Generator
 * יצירת שאלות בגרות אינטראקטיביות באמצעות Gemini AI
 *
 * Usage:
 * npx ts-node src/scripts/generateBagrutQuestions.ts --subject=civics --count=10
 * npx ts-node src/scripts/generateBagrutQuestions.ts --all --count=5
 *
 * This script generates high-quality interactive Bagrut questions based on
 * official Ministry of Education curriculum standards.
 */

import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import type {
    BagrutSubject,
    BagrutQuestion,
    BagrutQuestionType,
    BagrutDifficulty,
    RubricItem
} from '../../../src/shared/types/bagrutTypes';
import {
    SUBJECT_CONTEXT,
    generateBagrutQuestionPrompt,
    getAllSubjects
} from '../prompts/bagrutPrompts';

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// ============================================
// CONFIGURATION
// ============================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-pro';

interface GenerationConfig {
    subject: BagrutSubject;
    chapter: string;
    topic: string;
    questionType: BagrutQuestionType;
    difficulty: BagrutDifficulty;
    points: number;
}

// Question types distribution per chapter
const QUESTION_TYPE_DISTRIBUTION: BagrutQuestionType[] = [
    'open', 'open', 'open',           // 3 open questions
    'multiple-choice', 'multiple-choice', // 2 MC questions
    'source-analysis', 'source-analysis', // 2 source analysis
    'essay',                           // 1 essay
    'fill-in-blanks',                  // 1 fill-in-blanks
    'matching'                         // 1 matching
];

// Difficulty distribution
const DIFFICULTY_DISTRIBUTION: BagrutDifficulty[] = [
    1, 1, 1,  // 30% easy
    2, 2, 2, 2, // 40% medium
    3, 3, 3   // 30% hard
];

// Points by question type
const POINTS_BY_TYPE: Record<BagrutQuestionType, number[]> = {
    'open': [10, 15, 20],
    'multiple-choice': [5, 8, 10],
    'source-analysis': [15, 20, 25],
    'essay': [20, 25, 30],
    'fill-in-blanks': [8, 10, 12],
    'matching': [8, 10, 12]
};

// ============================================
// GEMINI API INTEGRATION
// ============================================

interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: Array<{
                text: string;
            }>;
        };
    }>;
}

async function callGemini(prompt: string): Promise<string> {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable not set');
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.9,
                    topK: 40,
                    maxOutputTokens: 4096,
                }
            })
        }
    );

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as GeminiResponse;

    if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from Gemini');
    }

    return data.candidates[0].content.parts[0].text;
}

// ============================================
// QUESTION GENERATION
// ============================================

async function generateQuestion(config: GenerationConfig): Promise<Partial<BagrutQuestion>> {
    console.log(`  Generating ${config.questionType} question for ${config.chapter}...`);

    const prompt = generateBagrutQuestionPrompt({
        subject: config.subject,
        chapter: config.chapter,
        topic: config.topic,
        questionType: config.questionType,
        difficulty: config.difficulty,
        points: config.points
    });

    const response = await callGemini(prompt);

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response;
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1];
    } else {
        // Try to find JSON object directly
        const jsonObjMatch = response.match(/\{[\s\S]*\}/);
        if (jsonObjMatch) {
            jsonStr = jsonObjMatch[0];
        }
    }

    try {
        const parsed = JSON.parse(jsonStr);

        // Transform to our format
        const question: Partial<BagrutQuestion> = {
            subject: config.subject,
            chapter: config.chapter,
            topic: config.topic || parsed.topic || config.chapter,
            questionType: config.questionType,
            points: config.points,
            difficulty: config.difficulty,
            question: parsed.question,
            sourceText: parsed.sourceText || undefined,
            sourceReference: parsed.sourceReference || undefined,
            modelAnswer: parsed.modelAnswer,
            keywords: parsed.keywords || [],
            hints: parsed.hints || [],
            commonMistakes: parsed.commonMistakes || [],
            timeEstimate: parsed.timeEstimate || Math.ceil(config.points / 2),
            reviewStatus: 'draft',
            createdBy: 'ai-generator'
        };

        // Add options for multiple choice
        if (config.questionType === 'multiple-choice' && parsed.options) {
            question.options = parsed.options;
            question.correctOptionIndex = parsed.correctOptionIndex;
        }

        // Add subQuestions for source-analysis
        if (parsed.subQuestions && Array.isArray(parsed.subQuestions)) {
            question.subQuestions = parsed.subQuestions.map((sq: any) => ({
                id: uuidv4(),
                label: sq.label,
                question: sq.question,
                points: sq.points,
                modelAnswer: sq.modelAnswer,
                keywords: sq.keywords
            }));
        }

        // Add rubric
        if (parsed.rubric && Array.isArray(parsed.rubric)) {
            question.rubric = parsed.rubric.map((r: any) => ({
                id: uuidv4(),
                criterion: r.criterion,
                maxPoints: r.maxPoints,
                levels: r.levels || []
            }));
        } else {
            // Create default rubric
            question.rubric = createDefaultRubric(config.questionType, config.points);
        }

        return question;
    } catch (error) {
        console.error(`  Failed to parse Gemini response for ${config.chapter}:`, error);
        console.error('  Response was:', jsonStr.substring(0, 500));
        throw error;
    }
}

function createDefaultRubric(questionType: BagrutQuestionType, points: number): RubricItem[] {
    const rubricTemplates: Record<BagrutQuestionType, string[]> = {
        'open': ['הבנת הנושא', 'דיוק בתשובה', 'ניסוח ובהירות'],
        'multiple-choice': [],
        'source-analysis': ['הבנת המקור', 'ניתוח וקישור', 'יישום'],
        'essay': ['תוכן ותזה', 'מבנה וארגון', 'שפה וסגנון', 'טיעון והוכחות'],
        'fill-in-blanks': ['דיוק', 'הבנה'],
        'matching': ['דיוק בהתאמות']
    };

    const criteria = rubricTemplates[questionType] || ['תשובה'];
    const pointsPerCriterion = Math.floor(points / criteria.length);

    return criteria.map((criterion, index) => ({
        id: uuidv4(),
        criterion,
        maxPoints: index === criteria.length - 1
            ? points - (pointsPerCriterion * (criteria.length - 1)) // Give remainder to last criterion
            : pointsPerCriterion,
        levels: [
            { points: pointsPerCriterion, description: 'תשובה מלאה ומדויקת' },
            { points: Math.floor(pointsPerCriterion * 0.6), description: 'תשובה חלקית' },
            { points: 0, description: 'לא ענה או תשובה שגויה' }
        ]
    }));
}

// ============================================
// TOPIC EXTRACTION
// ============================================

/**
 * Extracts specific topics from a chapter name for more focused questions
 */
function extractTopicsFromChapter(chapter: string): string[] {
    // Common patterns in chapters that indicate multiple topics
    const topics = chapter.split(' - ');
    if (topics.length > 1) {
        return topics;
    }

    // Return the chapter as a single topic
    return [chapter];
}

// ============================================
// MAIN GENERATION LOGIC
// ============================================

async function generateQuestionsForSubject(
    subject: BagrutSubject,
    questionsPerChapter: number = 3
): Promise<Partial<BagrutQuestion>[]> {
    const subjectInfo = SUBJECT_CONTEXT[subject];
    console.log(`\nGenerating questions for ${subjectInfo.hebrewName}...`);
    console.log(`  Chapters: ${subjectInfo.chapters.length}`);

    const allQuestions: Partial<BagrutQuestion>[] = [];

    for (const chapter of subjectInfo.chapters) {
        console.log(`\n  Chapter: ${chapter}`);
        const topics = extractTopicsFromChapter(chapter);

        for (let i = 0; i < questionsPerChapter; i++) {
            const questionType = QUESTION_TYPE_DISTRIBUTION[i % QUESTION_TYPE_DISTRIBUTION.length];
            const difficulty = DIFFICULTY_DISTRIBUTION[Math.floor(Math.random() * DIFFICULTY_DISTRIBUTION.length)];
            const possiblePoints = POINTS_BY_TYPE[questionType];
            const points = possiblePoints[difficulty - 1] || possiblePoints[1];
            const topic = topics[i % topics.length];

            try {
                const question = await generateQuestion({
                    subject,
                    chapter,
                    topic,
                    questionType,
                    difficulty,
                    points
                });

                allQuestions.push(question);
                console.log(`    Created: ${questionType} (difficulty ${difficulty})`);

                // Rate limiting - wait between API calls
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`    Failed to generate question:`, error);
            }
        }
    }

    return allQuestions;
}

async function saveQuestions(questions: Partial<BagrutQuestion>[]): Promise<string[]> {
    console.log(`\nSaving ${questions.length} questions to Firestore...`);
    const questionIds: string[] = [];

    const batch = db.batch();

    for (const question of questions) {
        const docRef = db.collection('bagrut_questions').doc();
        batch.set(docRef, {
            ...question,
            id: docRef.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            usageCount: 0
        });
        questionIds.push(docRef.id);
    }

    await batch.commit();
    console.log(`  Saved ${questionIds.length} questions`);

    return questionIds;
}

// ============================================
// CLI INTERFACE
// ============================================

function parseArgs(): { subject?: BagrutSubject; all: boolean; count: number } {
    const args = process.argv.slice(2);
    let subject: BagrutSubject | undefined;
    let all = false;
    let count = 3;

    for (const arg of args) {
        if (arg.startsWith('--subject=')) {
            subject = arg.replace('--subject=', '') as BagrutSubject;
        } else if (arg === '--all') {
            all = true;
        } else if (arg.startsWith('--count=')) {
            count = parseInt(arg.replace('--count=', ''), 10);
        }
    }

    return { subject, all, count };
}

async function main() {
    console.log('=== AI Bagrut Question Generator ===\n');

    const { subject, all, count } = parseArgs();

    if (!GEMINI_API_KEY) {
        console.error('Error: GEMINI_API_KEY environment variable not set');
        console.error('Set it with: export GEMINI_API_KEY=your_key');
        process.exit(1);
    }

    let subjects: BagrutSubject[];

    if (all) {
        subjects = getAllSubjects();
        console.log(`Generating questions for ALL subjects: ${subjects.join(', ')}`);
    } else if (subject) {
        subjects = [subject];
        console.log(`Generating questions for: ${subject}`);
    } else {
        console.log('Usage:');
        console.log('  --subject=civics|literature|bible|hebrew|english|history');
        console.log('  --all (generate for all subjects)');
        console.log('  --count=N (questions per chapter, default 3)');
        process.exit(0);
    }

    console.log(`Questions per chapter: ${count}`);

    let totalQuestions = 0;
    const summary: Record<string, number> = {};

    for (const s of subjects) {
        try {
            const questions = await generateQuestionsForSubject(s, count);

            if (questions.length > 0) {
                await saveQuestions(questions);
                summary[SUBJECT_CONTEXT[s].hebrewName] = questions.length;
                totalQuestions += questions.length;
            }
        } catch (error) {
            console.error(`Failed to generate questions for ${s}:`, error);
        }
    }

    console.log('\n=== Generation Complete ===');
    console.log('Summary:');
    for (const [name, count] of Object.entries(summary)) {
        console.log(`  ${name}: ${count} questions`);
    }
    console.log(`Total: ${totalQuestions} questions`);
}

// Run if executed directly
main().then(() => process.exit(0)).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
