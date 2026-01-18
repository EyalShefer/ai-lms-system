/**
 * Test Script: Generate Questions at 3 Difficulty Levels
 *
 * This script tests the adaptive content system by generating
 * the same question at EASY, MEDIUM, and HARD levels.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('❌ Missing GEMINI_API_KEY in environment variables');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Source text from the PDF
const SOURCE_TEXT = `
המגוון הביולוגי בסכנה

בשנת 1831 עגנה ספינתו של צ'רלס דרווין לפני חופי באייה שבברזיל. יערות הגשם החופיים שבהם ביקר, הותירו רושם בל יימחה על דרווין, וכך הוא כתב ביומנו:
"תענוג... הוא ביטוי חלש מדי להביע את עוצמת הרגשות של איש טבע המשוטט לראשונה ביער הברזילאי. האלגנטיות של העשב, אצילותם של הצמחים הטפילים, יופיים של הפרחים... שפעת הירק מילאה אותי בהערצה."

מן היער שעורר את התפעלותו של דרווין, נותרו היום פחות מ-10% מהיצורים החיים. תהליכים ישירים ועקיפים של הרס נופים טבעיים בידי האדם, דוגמת חופי באייה, נפוצים היום במרבית שטחי היער הקדום שנותרו.

הרס ישיר נגרם, למשל, כאשר כורתים יער. הרס עקיף נגרם בדרכים מורכבות יותר. לדוגמה, כאשר האדם מדשן את השדות בדשן, לעיתים קורה שכמויות הדשן נסחפות עם מי הגשמים, מגיעות לאגם או לנחל, ומשנות שם את הרכב המים - דבר שעלול להשפיע לרעה על בעלי חיים שחיים במים.

הדישון הכרחי, כי בלעדיו לא יהיה די יבול לפרנסת האדם, אך בעקיפין הוא פוגע בבתי הגידול של יצורים אחרים.
לתהליכים אלה יש השלכות חמורות על מגוון המינים של כדור הארץ.
`;

interface QuestionResult {
    level: 'easy' | 'medium' | 'hard';
    levelHebrew: string;
    question: string;
    options?: string[];
    correctAnswer: string;
    hints?: string[];
    explanation?: string;
    bloomLevel: string;
    cognitiveLoad: string;
}

async function generateQuestionAtLevel(
    level: 'easy' | 'medium' | 'hard',
    questionType: 'multiple_choice' | 'open_question' = 'multiple_choice'
): Promise<QuestionResult | null> {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const levelInstructions = {
        easy: {
            hebrew: 'קל (Scaffolding)',
            bloom: 'Remember / Understand',
            instructions: `
רמת קושי: קל (SCAFFOLDING - לתלמידים מתקשים)

עקרונות ליצירת שאלה קלה:
1. שפה פשוטה - משפטים קצרים (עד 10 מילים), אוצר מילים בסיסי
2. שאלה ישירה - שואלת על מידע שמופיע במפורש בטקסט
3. מסיחים (תשובות שגויות) - ברורים כשגויים, קל להבחין שהם לא נכונים
4. רמזים - הוסף 3 רמזים פרוגרסיביים (מעמום לברור)
5. רמת בלום: זכירה/הבנה בסיסית
6. עומס קוגניטיבי: נמוך - תשובה אחת נכונה ברורה

דוגמה לשאלה טובה ברמה קלה:
"באיזו שנה הגיע דרווין לברזיל?" - שאלת זכירה ישירה
            `,
            cognitiveLoad: 'נמוך - זיהוי וזכירה בסיסית'
        },
        medium: {
            hebrew: 'בינוני (Original)',
            bloom: 'Apply / Analyze',
            instructions: `
רמת קושי: בינוני (ORIGINAL - לתלמידים טיפוסיים)

עקרונות ליצירת שאלה בינונית:
1. שפה מותאמת לגיל - משפטים מורכבים יותר (עד 15 מילים)
2. שאלה דורשת הבנה - לא רק איתור מידע, אלא הבנת משמעות
3. מסיחים - אמינים, דורשים חשיבה להבחנה ביניהם
4. רמת בלום: יישום/ניתוח
5. עומס קוגניטיבי: בינוני - דורש חיבור בין מושגים

דוגמה לשאלה טובה ברמה בינונית:
"מה ההבדל בין הרס ישיר להרס עקיף של סביבה?" - דורש השוואה והבנה
            `,
            cognitiveLoad: 'בינוני - יישום והבנה של קשרים'
        },
        hard: {
            hebrew: 'מאתגר (Enrichment)',
            bloom: 'Evaluate / Create',
            instructions: `
רמת קושי: מאתגר (ENRICHMENT - לתלמידים מתקדמים)

עקרונות ליצירת שאלה מאתגרת:
1. שפה אקדמית - מורכבות לשונית גבוהה
2. שאלה דורשת חשיבה ביקורתית - הערכה, סינתזה, או יצירה
3. מסיחים - כולם נראים אמינים, דורשים ניתוח מעמיק
4. שאלות "למה" ו"כיצד" - לא רק "מה"
5. חיבור למושגים מתקדמים או אקטואליים
6. רמת בלום: הערכה/יצירה
7. עומס קוגניטיבי: גבוה - דורש סינתזה וחשיבה מקורית

דוגמה לשאלה טובה ברמה מאתגרת:
"כיצד הדילמה בין הדישון לשימור המגוון הביולוגי משקפת אתגרים רחבים יותר של פיתוח בר-קיימא?" - דורש הערכה וחיבור למושגים רחבים
            `,
            cognitiveLoad: 'גבוה - הערכה, סינתזה וחשיבה ביקורתית'
        }
    };

    const levelConfig = levelInstructions[level];

    const prompt = `
אתה מומחה פדגוגי ליצירת שאלות לבית הספר היסודי והחטיבה בישראל.

טקסט מקור:
${SOURCE_TEXT}

משימה: צור שאלה אחת מסוג ${questionType === 'multiple_choice' ? 'בחירה מרובה' : 'שאלה פתוחה'}
על הנושא "המגוון הביולוגי בסכנה" ברמת קושי: ${levelConfig.hebrew}

${levelConfig.instructions}

פורמט פלט JSON:
{
    "question": "נוסח השאלה בעברית",
    "options": ["תשובה א", "תשובה ב", "תשובה ג", "תשובה ד"],
    "correctAnswer": "התשובה הנכונה המלאה",
    "correctIndex": 0,
    "hints": ["רמז ראשון - עדין מאוד", "רמז שני - יותר ישיר", "רמז שלישי - כמעט מגלה"],
    "explanation": "הסבר קצר למה זו התשובה הנכונה",
    "bloomLevel": "${levelConfig.bloom}",
    "difficultyJustification": "הסבר קצר למה השאלה מתאימה לרמה ${levelConfig.hebrew}"
}

חשוב:
- כתוב בעברית בלבד
- וודא שהשאלה מתאימה בדיוק לרמת הקושי המבוקשת
- עבור שאלה קלה - השאלה חייבת להיות פשוטה וישירה
- עבור שאלה מאתגרת - השאלה חייבת לדרוש חשיבה מעמיקה
`;

    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: level === 'easy' ? 0.3 : level === 'medium' ? 0.5 : 0.7,
                maxOutputTokens: 1500,
            }
        });

        const text = result.response.text();

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error(`Failed to extract JSON for level ${level}`);
            return null;
        }

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            level,
            levelHebrew: levelConfig.hebrew,
            question: parsed.question,
            options: parsed.options,
            correctAnswer: parsed.correctAnswer,
            hints: parsed.hints,
            explanation: parsed.explanation,
            bloomLevel: levelConfig.bloom,
            cognitiveLoad: levelConfig.cognitiveLoad
        };

    } catch (error) {
        console.error(`Error generating ${level} question:`, error);
        return null;
    }
}

function printComparisonTable(results: QuestionResult[]) {
    console.log('\n' + '='.repeat(100));
    console.log('📊 טבלת השוואה בין שלוש רמות הקושי');
    console.log('='.repeat(100));

    const headers = ['קריטריון', 'קל (Scaffolding)', 'בינוני (Original)', 'מאתגר (Enrichment)'];

    console.log('\n┌' + '─'.repeat(98) + '┐');
    console.log('│ ' + headers.join(' │ ').padEnd(96) + ' │');
    console.log('├' + '─'.repeat(98) + '┤');

    // Question text
    console.log('\n📝 נוסח השאלה:');
    console.log('─'.repeat(100));
    results.forEach(r => {
        console.log(`\n[${r.levelHebrew}]:`);
        console.log(`   ${r.question}`);
    });

    // Options comparison
    console.log('\n\n📋 אפשרויות התשובה:');
    console.log('─'.repeat(100));
    results.forEach(r => {
        console.log(`\n[${r.levelHebrew}]:`);
        r.options?.forEach((opt, i) => {
            const isCorrect = opt === r.correctAnswer ? ' ✓' : '';
            console.log(`   ${i + 1}. ${opt}${isCorrect}`);
        });
    });

    // Hints (for easy level)
    console.log('\n\n💡 רמזים (רלוונטי בעיקר לרמה קלה):');
    console.log('─'.repeat(100));
    results.forEach(r => {
        if (r.hints && r.hints.length > 0) {
            console.log(`\n[${r.levelHebrew}]:`);
            r.hints.forEach((hint, i) => {
                console.log(`   רמז ${i + 1}: ${hint}`);
            });
        }
    });

    // Bloom Level
    console.log('\n\n🎯 רמת בלום וסוג החשיבה:');
    console.log('─'.repeat(100));
    results.forEach(r => {
        console.log(`[${r.levelHebrew}]: ${r.bloomLevel}`);
    });

    // Cognitive Load
    console.log('\n\n🧠 עומס קוגניטיבי:');
    console.log('─'.repeat(100));
    results.forEach(r => {
        console.log(`[${r.levelHebrew}]: ${r.cognitiveLoad}`);
    });

    // Explanations
    console.log('\n\n📖 הסבר התשובה הנכונה:');
    console.log('─'.repeat(100));
    results.forEach(r => {
        console.log(`\n[${r.levelHebrew}]:`);
        console.log(`   ${r.explanation}`);
    });

    console.log('\n' + '='.repeat(100));
}

async function main() {
    console.log('🚀 מתחיל בדיקת יצירת שאלות בשלוש רמות קושי...\n');
    console.log('📄 טקסט מקור: "המגוון הביולוגי בסכנה"');
    console.log('─'.repeat(50));

    const results: QuestionResult[] = [];

    // Generate questions at all three levels
    for (const level of ['easy', 'medium', 'hard'] as const) {
        console.log(`\n⏳ מייצר שאלה ברמת קושי: ${level}...`);
        const result = await generateQuestionAtLevel(level);
        if (result) {
            results.push(result);
            console.log(`   ✅ נוצרה בהצלחה`);
        } else {
            console.log(`   ❌ נכשל`);
        }
    }

    if (results.length === 3) {
        printComparisonTable(results);

        // Save to file
        const outputPath = path.join(__dirname, 'three_levels_output.json');
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
        console.log(`\n💾 תוצאות נשמרו ב: ${outputPath}`);
    } else {
        console.log('\n❌ לא כל הרמות נוצרו בהצלחה');
    }
}

main().catch(console.error);
