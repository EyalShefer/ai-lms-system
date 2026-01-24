/**
 * AI-Powered Curriculum Generator
 *
 * This script uses Gemini AI to generate comprehensive Israeli curriculum standards
 * for ALL subjects and grades (א' - י״ב) based on official Ministry of Education guidelines.
 *
 * Subjects covered:
 * - Math (מתמטיקה)
 * - Hebrew (עברית)
 * - English (אנגלית)
 * - Bible (תנ״ך)
 * - History (היסטוריה)
 * - Geography (גיאוגרפיה)
 * - Civics (אזרחות)
 * - Science (מדעים)
 * - Physics (פיזיקה)
 * - Chemistry (כימיה)
 * - Biology (ביולוגיה)
 * - Computer Science (מדעי המחשב)
 * - Literature (ספרות)
 *
 * Run with: npx ts-node src/scripts/seedCurriculumWithAI.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';
import type { CurriculumStandard } from '../services/activityBank/types';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Service account and API keys
const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../../..', 'service-account-key.json');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// ============================================
// Configuration
// ============================================

const SUBJECTS_CONFIG = [
    // יסודי (א'-ו')
    { subject: 'math', hebrewName: 'מתמטיקה', grades: ['א', 'ב', 'ג', 'ד', 'ה', 'ו'] },
    { subject: 'hebrew', hebrewName: 'עברית - חינוך לשוני', grades: ['א', 'ב', 'ג', 'ד', 'ה', 'ו'] },
    { subject: 'english', hebrewName: 'אנגלית', grades: ['ג', 'ד', 'ה', 'ו'] },
    { subject: 'bible', hebrewName: 'תנ״ך', grades: ['ד', 'ה', 'ו'] },
    { subject: 'science', hebrewName: 'מדע וטכנולוגיה', grades: ['א', 'ב', 'ג', 'ד', 'ה', 'ו'] },

    // חטיבת ביניים (ז'-ט')
    { subject: 'math', hebrewName: 'מתמטיקה', grades: ['ז', 'ח', 'ט'] },
    { subject: 'hebrew', hebrewName: 'עברית', grades: ['ז', 'ח', 'ט'] },
    { subject: 'english', hebrewName: 'אנגלית', grades: ['ז', 'ח', 'ט'] },
    { subject: 'bible', hebrewName: 'תנ״ך', grades: ['ז', 'ח', 'ט'] },
    { subject: 'history', hebrewName: 'היסטוריה', grades: ['ז', 'ח', 'ט'] },
    { subject: 'geography', hebrewName: 'גיאוגרפיה', grades: ['ז', 'ח', 'ט'] },
    { subject: 'civics', hebrewName: 'אזרחות', grades: ['ח', 'ט'] },
    { subject: 'science', hebrewName: 'מדעים', grades: ['ז', 'ח', 'ט'] },

    // תיכון (י'-י״ב)
    { subject: 'math', hebrewName: 'מתמטיקה', grades: ['י', 'יא', 'יב'] },
    { subject: 'hebrew', hebrewName: 'עברית', grades: ['י', 'יא', 'יב'] },
    { subject: 'english', hebrewName: 'אנגלית', grades: ['י', 'יא', 'יב'] },
    { subject: 'literature', hebrewName: 'ספרות', grades: ['י', 'יא', 'יב'] },
    { subject: 'bible', hebrewName: 'תנ״ך', grades: ['י', 'יא', 'יב'] },
    { subject: 'history', hebrewName: 'היסטוריה', grades: ['י', 'יא', 'יב'] },
    { subject: 'civics', hebrewName: 'אזרחות', grades: ['י', 'יא', 'יב'] },
    { subject: 'physics', hebrewName: 'פיזיקה', grades: ['י', 'יא', 'יב'] },
    { subject: 'chemistry', hebrewName: 'כימיה', grades: ['י', 'יא', 'יב'] },
    { subject: 'biology', hebrewName: 'ביולוגיה', grades: ['י', 'יא', 'יב'] },
    { subject: 'cs', hebrewName: 'מדעי המחשב', grades: ['י', 'יא', 'יב'] }
];

// ============================================
// AI Prompt for Curriculum Generation
// ============================================

function buildCurriculumPrompt(subject: string, hebrewName: string, grade: string): string {
    return `אתה מומחה לתכניות לימודים של משרד החינוך הישראלי.

צור 4-6 תקני תוכ"ל (Curriculum Standards) למקצוע **${hebrewName}** לכיתה **${grade}**.

כל תקן צריך להיות מבוסס על תכנית הלימודים הרשמית של משרד החינוך הישראלי לשנת הלימודים 2024-2025.

דרישות:
1. כל תקן חייב להיות **ספציפי** ו**מדיד**
2. התאם את רמת הקושי לכיתה
3. התמקד בנושאים מרכזיים בתכנית הלימודים
4. כלול מטרות למידה ברורות
5. המלץ על סוגי פעילויות מתאימים
6. ציין רמות Bloom המתאימות

החזר JSON array של תקנים בפורמט הבא:

\`\`\`json
[
  {
    "domain": "תחום בתכנית הלימודים (למשל: 'מספרים ופעולות', 'קריאה והבנת הנקרא')",
    "topic": "נושא ספציפי (למשל: 'שברים', 'הבנת טקסט סיפורי')",
    "title": "כותרת התקן (למשל: 'פעולות בשברים')",
    "description": "תיאור מפורט של מה התלמיד צריך לדעת/לדעת לעשות (2-3 משפטים)",
    "learningObjectives": [
      "מטרת למידה 1 (ספציפית ומדידה)",
      "מטרת למידה 2",
      "מטרת למידה 3",
      "מטרת למידה 4"
    ],
    "requiredSkills": ["מיומנות 1", "מיומנות 2", "מיומנות 3"],
    "recommendedActivityTypes": ["multiple-choice", "fill_in_blanks", "ordering"],
    "recommendedBloomLevels": ["knowledge", "comprehension", "application"]
  }
]
\`\`\`

**חשוב:**
- recommendedActivityTypes יכולים להיות: multiple-choice, true_false, fill_in_blanks, ordering, categorization, matching, open-question, memory_game, sentence_builder, image_labeling, table_completion, text_selection
- recommendedBloomLevels יכולים להיות: knowledge, comprehension, application, analysis, synthesis, evaluation

תחזיר רק את ה-JSON, ללא טקסט נוסף.`;
}

// ============================================
// AI Generator
// ============================================

async function generateStandardsWithAI(
    subject: string,
    hebrewName: string,
    grade: string
): Promise<Array<Omit<CurriculumStandard, 'id' | 'subject' | 'gradeLevel' | 'embedding' | 'createdAt' | 'updatedAt' | 'source'>>> {

    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is required');
    }

    console.log(`   🤖 Generating standards for ${hebrewName} - כיתה ${grade}...`);

    const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const prompt = buildCurriculumPrompt(subject, hebrewName, grade);

    try {
        const response = await genAI.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [{
                role: 'user',
                parts: [{ text: prompt }]
            }],
            config: {
                temperature: 0.7,
                maxOutputTokens: 4096
            }
        });

        const text = response.text || '';

        // Extract JSON from response (might be wrapped in ```json```)
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '');
        }

        const standards = JSON.parse(jsonText);

        if (!Array.isArray(standards)) {
            throw new Error('AI did not return an array');
        }

        console.log(`   ✅ Generated ${standards.length} standards`);
        return standards;

    } catch (error: any) {
        console.error(`   ❌ Error generating for ${hebrewName} - ${grade}:`, error.message);
        return [];
    }
}

// ============================================
// Main Seeding Function
// ============================================

async function seedCurriculumWithAI() {
    console.log('🤖 AI-POWERED CURRICULUM GENERATOR');
    console.log('=' .repeat(60));
    console.log('Generating comprehensive Israeli curriculum standards');
    console.log('Using: Gemini 2.0 Flash');
    console.log('=' .repeat(60));
    console.log('');

    // Initialize Firebase
    try {
        const serviceAccount = require(SERVICE_ACCOUNT_PATH);
        initializeApp({
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id
        });
        console.log(`✅ Connected to Firebase: ${serviceAccount.project_id}\n`);
    } catch (e: any) {
        console.log('Firebase init:', e.message);
        try {
            initializeApp();
        } catch {
            // Ignore
        }
    }

    const db = getFirestore();

    let totalGenerated = 0;
    let totalSaved = 0;
    let totalErrors = 0;

    const subjectStats: Record<string, number> = {};

    // Group by unique subject-grade combinations
    const uniqueCombinations = new Map<string, { subject: string; hebrewName: string; grades: string[] }>();

    for (const config of SUBJECTS_CONFIG) {
        const key = config.subject;
        if (!uniqueCombinations.has(key)) {
            uniqueCombinations.set(key, {
                subject: config.subject,
                hebrewName: config.hebrewName,
                grades: []
            });
        }
        uniqueCombinations.get(key)!.grades.push(...config.grades);
    }

    // Remove duplicates from grades
    for (const [key, value] of uniqueCombinations.entries()) {
        value.grades = [...new Set(value.grades)];
        uniqueCombinations.set(key, value);
    }

    console.log(`📚 Will generate for ${uniqueCombinations.size} subjects\n`);

    // Generate for each subject-grade combination
    for (const [_, config] of uniqueCombinations.entries()) {
        console.log(`\n📖 ${config.hebrewName}`);
        console.log('-'.repeat(40));

        for (const grade of config.grades) {
            const standards = await generateStandardsWithAI(
                config.subject,
                config.hebrewName,
                grade
            );

            totalGenerated += standards.length;

            // Save to Firestore
            for (const standardData of standards) {
                try {
                    const docRef = db.collection('curriculum_standards').doc();

                    const standard: CurriculumStandard = {
                        id: docRef.id,
                        subject: config.subject as any,
                        gradeLevel: grade as any,
                        ...standardData,
                        source: 'ministry_of_education',
                        embedding: [],
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    };

                    await docRef.set(standard);
                    totalSaved++;

                    // Track stats
                    subjectStats[config.subject] = (subjectStats[config.subject] || 0) + 1;

                } catch (error: any) {
                    totalErrors++;
                    console.error(`   ❌ Save error:`, error.message);
                }
            }

            // Rate limiting - wait 1 second between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Final Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 AI GENERATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`   🤖 Generated: ${totalGenerated} standards`);
    console.log(`   💾 Saved: ${totalSaved} standards`);
    console.log(`   ❌ Errors: ${totalErrors}`);
    console.log('');

    console.log('📊 Breakdown by Subject:');
    const hebrewNames: Record<string, string> = {
        math: 'מתמטיקה',
        hebrew: 'עברית',
        english: 'אנגלית',
        bible: 'תנ״ך',
        history: 'היסטוריה',
        geography: 'גיאוגרפיה',
        civics: 'אזרחות',
        science: 'מדעים',
        physics: 'פיזיקה',
        chemistry: 'כימיה',
        biology: 'ביולוגיה',
        cs: 'מדעי המחשב',
        literature: 'ספרות'
    };

    for (const [subject, count] of Object.entries(subjectStats).sort((a, b) => b[1] - a[1])) {
        console.log(`   ${hebrewNames[subject] || subject}: ${count} תקנים`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ Your curriculum database is ready!');
    console.log('   Teachers can now query these standards in the chat.');
    console.log('='.repeat(60));
}

// Run
if (require.main === module) {
    seedCurriculumWithAI()
        .then(() => {
            console.log('\n✅ All done!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Fatal error:', error);
            process.exit(1);
        });
}

export { seedCurriculumWithAI };
