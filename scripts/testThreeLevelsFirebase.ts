/**
 * Test Script: Generate Questions at 3 Difficulty Levels via Firebase
 *
 * Uses the existing geminiChat Cloud Function (which has the API key)
 */

import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
    apiKey: "AIzaSyDpydu7ZwtyWzVO0oxHgdC5w04tBXuwgGA",
    authDomain: "ai-lms-pro.firebaseapp.com",
    projectId: "ai-lms-pro",
    storageBucket: "ai-lms-pro.firebasestorage.app",
    messagingSenderId: "479417566126",
    appId: "1:479417566126:web:c40e64e9ee2f403b70be3f"
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

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
}

const levelConfigs = {
    easy: {
        hebrew: 'קל (Scaffolding)',
        bloom: 'Remember / Understand',
        instructions: `
רמת קושי: קל (SCAFFOLDING - לתלמידים מתקשים)

עקרונות:
1. שפה פשוטה - משפטים קצרים (עד 10 מילים)
2. שאלה ישירה - מידע מפורש בטקסט
3. מסיחים ברורים כשגויים
4. 3 רמזים פרוגרסיביים
5. רמת בלום: זכירה בסיסית
`,
        temperature: 0.3
    },
    medium: {
        hebrew: 'בינוני (Original)',
        bloom: 'Apply / Analyze',
        instructions: `
רמת קושי: בינוני (ORIGINAL)

עקרונות:
1. שפה מותאמת - משפטים עד 15 מילים
2. דורש הבנה, לא רק איתור
3. מסיחים אמינים, דורשים חשיבה
4. רמת בלום: יישום/ניתוח
`,
        temperature: 0.5
    },
    hard: {
        hebrew: 'מאתגר (Enrichment)',
        bloom: 'Evaluate / Create',
        instructions: `
רמת קושי: מאתגר (ENRICHMENT - לתלמידים מתקדמים)

עקרונות:
1. שפה אקדמית מורכבת
2. חשיבה ביקורתית - הערכה וסינתזה
3. מסיחים כולם נראים אמינים
4. שאלות "למה" ו"איך"
5. חיבור למושגים מתקדמים
6. רמת בלום: הערכה/יצירה
`,
        temperature: 0.7
    }
};

async function generateQuestionAtLevel(level: 'easy' | 'medium' | 'hard'): Promise<QuestionResult | null> {
    const config = levelConfigs[level];

    const prompt = `
אתה מומחה פדגוגי. צור שאלת בחירה מרובה אחת בעברית.

טקסט מקור:
${SOURCE_TEXT}

${config.instructions}

פורמט JSON בלבד:
{
    "question": "נוסח השאלה",
    "options": ["א", "ב", "ג", "ד"],
    "correctAnswer": "התשובה הנכונה",
    "hints": ["רמז 1", "רמז 2", "רמז 3"],
    "explanation": "הסבר קצר"
}
`;

    try {
        const geminiChat = httpsCallable(functions, 'geminiChat');

        const result = await geminiChat({
            messages: [{ role: 'user', content: prompt }],
            options: {
                temperature: config.temperature,
                responseFormat: { type: 'json_object' }
            }
        });

        const data = result.data as { content: string };
        const jsonMatch = data.content.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            console.error(`Failed to extract JSON for ${level}`);
            return null;
        }

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            level,
            levelHebrew: config.hebrew,
            question: parsed.question,
            options: parsed.options,
            correctAnswer: parsed.correctAnswer,
            hints: parsed.hints,
            explanation: parsed.explanation,
            bloomLevel: config.bloom
        };

    } catch (error) {
        console.error(`Error generating ${level}:`, error);
        return null;
    }
}

function printResults(results: QuestionResult[]) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 תוצאות בדיקת שלוש רמות קושי');
    console.log('='.repeat(80));

    for (const r of results) {
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`🎯 ${r.levelHebrew} | בלום: ${r.bloomLevel}`);
        console.log(`${'─'.repeat(80)}`);
        console.log(`\n📝 שאלה: ${r.question}\n`);

        console.log('אפשרויות:');
        r.options?.forEach((opt, i) => {
            const mark = opt === r.correctAnswer ? ' ✓' : '';
            console.log(`   ${i + 1}. ${opt}${mark}`);
        });

        if (r.hints && r.hints.length > 0) {
            console.log('\n💡 רמזים:');
            r.hints.forEach((h, i) => console.log(`   ${i + 1}. ${h}`));
        }

        console.log(`\n📖 הסבר: ${r.explanation}`);
    }

    console.log('\n' + '='.repeat(80));
}

async function main() {
    console.log('🚀 מתחיל בדיקה דרך Firebase Cloud Functions...\n');

    const results: QuestionResult[] = [];

    for (const level of ['easy', 'medium', 'hard'] as const) {
        console.log(`⏳ מייצר שאלה ברמת ${levelConfigs[level].hebrew}...`);
        const result = await generateQuestionAtLevel(level);
        if (result) {
            results.push(result);
            console.log(`   ✅ נוצרה בהצלחה`);
        } else {
            console.log(`   ❌ נכשל`);
        }
    }

    if (results.length > 0) {
        printResults(results);
    }
}

main().catch(console.error);
