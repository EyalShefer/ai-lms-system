/**
 * Seed Curriculum Standards
 *
 * This script populates the curriculum_standards collection with
 * Israeli Ministry of Education standards for Hebrew and Science
 * grades 5-6 (כיתות ה-ו).
 *
 * Run with: npx ts-node src/scripts/seedCurriculumStandards.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as path from 'path';
import type { CurriculumStandard, ActivitySubject, GradeLevel } from '../services/activityBank/types';
import type { ActivityBlockType, BloomLevel } from '../shared/types/courseTypes';

// Service account key path (relative to functions/src/scripts)
const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../../..', 'service-account-key.json');

// ============================================
// Hebrew Language Standards (עברית - חינוך לשוני)
// ============================================

const HEBREW_STANDARDS: Omit<CurriculumStandard, 'id' | 'embedding' | 'createdAt' | 'updatedAt'>[] = [
    // כיתה ה - קריאה והבנה
    {
        subject: 'hebrew',
        gradeLevel: 'ה',
        domain: 'קריאה והבנת הנקרא',
        topic: 'הבנת טקסט סיפורי',
        title: 'זיהוי מרכיבי הסיפור',
        description: 'התלמיד יזהה את מרכיבי הסיפור: עלילה, דמויות, זמן, מקום, קונפליקט ופתרון. התלמיד יבחין בין דמות ראשית לדמות משנית ויסביר את מניעי הדמויות.',
        learningObjectives: [
            'זיהוי מרכיבי העלילה',
            'הבחנה בין דמויות ראשיות למשניות',
            'הבנת מניעי הדמויות',
            'זיהוי שיא הסיפור'
        ],
        requiredSkills: ['קריאה', 'הבנה', 'ניתוח'],
        recommendedActivityTypes: ['multiple-choice', 'open-question', 'ordering'],
        recommendedBloomLevels: ['comprehension', 'analysis'],
        source: 'ministry_of_education'
    },
    {
        subject: 'hebrew',
        gradeLevel: 'ה',
        domain: 'קריאה והבנת הנקרא',
        topic: 'הבנת טקסט מידעי',
        title: 'חילוץ מידע מטקסט מידעי',
        description: 'התלמיד יחלץ מידע מפורש ומשתמע מטקסט מידעי. יזהה רעיון מרכזי ורעיונות תומכים.',
        learningObjectives: [
            'חילוץ מידע מפורש מהטקסט',
            'הסקת מסקנות',
            'זיהוי רעיון מרכזי',
            'הבחנה בין עובדה לדעה'
        ],
        requiredSkills: ['קריאה', 'חילוץ מידע', 'הסקה'],
        recommendedActivityTypes: ['multiple-choice', 'text_selection', 'table_completion'],
        recommendedBloomLevels: ['comprehension', 'application'],
        source: 'ministry_of_education'
    },
    {
        subject: 'hebrew',
        gradeLevel: 'ה',
        domain: 'דקדוק ולשון',
        topic: 'שורש ומשקל',
        title: 'זיהוי שורש ומשקל',
        description: 'התלמיד יזהה את שורש המילה ואת המשקל שלה. יבין את הקשר בין מילים בנות אותו שורש.',
        learningObjectives: [
            'זיהוי שורש תלת-עיצורי',
            'זיהוי משקלים נפוצים',
            'הבנת משמעויות נגזרות',
            'יצירת מילים מאותו שורש'
        ],
        requiredSkills: ['ניתוח מורפולוגי', 'הבחנה'],
        recommendedActivityTypes: ['fill_in_blanks', 'categorization', 'matching'],
        recommendedBloomLevels: ['knowledge', 'application'],
        source: 'ministry_of_education'
    },
    {
        subject: 'hebrew',
        gradeLevel: 'ה',
        domain: 'דקדוק ולשון',
        topic: 'זמני הפועל',
        title: 'זיהוי ושימוש בזמני הפועל',
        description: 'התלמיד יזהה ויטה פעלים בזמנים שונים: עבר, הווה, עתיד. יבין את השימוש בכל זמן.',
        learningObjectives: [
            'זיהוי זמן הפועל',
            'הטיית פעלים',
            'התאמת זמן הפועל להקשר',
            'שימוש נכון בזמנים'
        ],
        requiredSkills: ['הטיה', 'זיהוי', 'שימוש'],
        recommendedActivityTypes: ['fill_in_blanks', 'categorization', 'sentence_builder'],
        recommendedBloomLevels: ['knowledge', 'application'],
        source: 'ministry_of_education'
    },
    {
        subject: 'hebrew',
        gradeLevel: 'ה',
        domain: 'כתיבה',
        topic: 'כתיבת סיכום',
        title: 'סיכום טקסט',
        description: 'התלמיד יידע לסכם טקסט בלשונו. יזהה את הרעיונות המרכזיים ויכתוב סיכום תמציתי.',
        learningObjectives: [
            'זיהוי רעיונות מרכזיים',
            'כתיבה במילים שלו',
            'שמירה על תמציתיות',
            'שימוש במילות קישור'
        ],
        requiredSkills: ['קריאה', 'סינתזה', 'כתיבה'],
        recommendedActivityTypes: ['open-question', 'ordering'],
        recommendedBloomLevels: ['comprehension', 'synthesis'],
        source: 'ministry_of_education'
    },
    {
        subject: 'hebrew',
        gradeLevel: 'ה',
        domain: 'אוצר מילים',
        topic: 'מילים נרדפות והפכים',
        title: 'העשרת אוצר מילים',
        description: 'התלמיד יכיר מילים נרדפות ומילים הפוכות. יידע להשתמש בהן בהקשרים שונים.',
        learningObjectives: [
            'זיהוי מילים נרדפות',
            'זיהוי מילים הפוכות',
            'שימוש בהקשר',
            'הרחבת אוצר מילים'
        ],
        requiredSkills: ['זיהוי', 'שימוש', 'הבחנה'],
        recommendedActivityTypes: ['matching', 'categorization', 'memory_game'],
        recommendedBloomLevels: ['knowledge', 'comprehension'],
        source: 'ministry_of_education'
    },

    // כיתה ו - עברית
    {
        subject: 'hebrew',
        gradeLevel: 'ו',
        domain: 'קריאה והבנת הנקרא',
        topic: 'הבנת טקסט טיעוני',
        title: 'זיהוי טיעונים וראיות',
        description: 'התלמיד יזהה טיעון מרכזי וטיעונים תומכים בטקסט טיעוני. יבחין בין טענה לראיה.',
        learningObjectives: [
            'זיהוי הטענה המרכזית',
            'מציאת טיעונים תומכים',
            'הבחנה בין טענה לראיה',
            'הערכת כוח הטיעון'
        ],
        requiredSkills: ['ניתוח', 'הערכה', 'חשיבה ביקורתית'],
        recommendedActivityTypes: ['multiple-choice', 'open-question', 'categorization'],
        recommendedBloomLevels: ['analysis', 'evaluation'],
        source: 'ministry_of_education'
    },
    {
        subject: 'hebrew',
        gradeLevel: 'ו',
        domain: 'כתיבה',
        topic: 'כתיבה טיעונית',
        title: 'בניית טיעון מסודר',
        description: 'התלמיד יידע לבנות טיעון מסודר: פתיחה, טענה, ראיות, התמודדות עם טיעון נגדי, וסיכום.',
        learningObjectives: [
            'בניית טענה ברורה',
            'הבאת ראיות תומכות',
            'התמודדות עם טיעון נגדי',
            'כתיבת פתיחה וסיכום'
        ],
        requiredSkills: ['כתיבה', 'טיעון', 'ארגון'],
        recommendedActivityTypes: ['open-question', 'ordering', 'sentence_builder'],
        recommendedBloomLevels: ['application', 'synthesis', 'evaluation'],
        source: 'ministry_of_education'
    },
    {
        subject: 'hebrew',
        gradeLevel: 'ו',
        domain: 'דקדוק ולשון',
        topic: 'משפט מורכב',
        title: 'בניית משפטים מורכבים',
        description: 'התלמיד יבין ויבנה משפטים מורכבים עם פסוקיות שונות. ישתמש במילות קישור מתאימות.',
        learningObjectives: [
            'זיהוי פסוקית ראשית ומשנית',
            'שימוש במילות קישור',
            'בניית משפטים מורכבים',
            'הבחנה בין סוגי פסוקיות'
        ],
        requiredSkills: ['ניתוח תחבירי', 'כתיבה'],
        recommendedActivityTypes: ['sentence_builder', 'fill_in_blanks', 'matching'],
        recommendedBloomLevels: ['application', 'analysis'],
        source: 'ministry_of_education'
    },
    {
        subject: 'hebrew',
        gradeLevel: 'ו',
        domain: 'קריאה והבנת הנקרא',
        topic: 'השוואת טקסטים',
        title: 'השוואה בין טקסטים',
        description: 'התלמיד ישווה בין שני טקסטים או יותר. יזהה דמיון ושוני בתוכן, סגנון ומטרה.',
        learningObjectives: [
            'זיהוי נקודות דמיון',
            'זיהוי נקודות שוני',
            'השוואת סגנונות כתיבה',
            'הבנת מטרות שונות'
        ],
        requiredSkills: ['השוואה', 'ניתוח', 'הערכה'],
        recommendedActivityTypes: ['table_completion', 'categorization', 'open-question'],
        recommendedBloomLevels: ['analysis', 'evaluation'],
        source: 'ministry_of_education'
    }
];

// ============================================
// Science Standards (מדע וטכנולוגיה)
// ============================================

const SCIENCE_STANDARDS: Omit<CurriculumStandard, 'id' | 'embedding' | 'createdAt' | 'updatedAt'>[] = [
    // כיתה ה - מדעים
    {
        subject: 'science',
        gradeLevel: 'ה',
        domain: 'מדעי החיים',
        topic: 'מערכת העיכול',
        title: 'מבנה ותפקוד מערכת העיכול',
        description: 'התלמיד יכיר את מבנה מערכת העיכול ותפקידיה. יבין את תהליך העיכול משלב הלעיסה ועד לספיגה.',
        learningObjectives: [
            'זיהוי איברי מערכת העיכול',
            'הבנת תהליך העיכול',
            'הסבר תפקיד כל איבר',
            'הבנת חשיבות התזונה'
        ],
        requiredSkills: ['זיהוי', 'הסבר', 'קישור'],
        recommendedActivityTypes: ['image_labeling', 'ordering', 'fill_in_blanks', 'matching'],
        recommendedBloomLevels: ['knowledge', 'comprehension'],
        source: 'ministry_of_education'
    },
    {
        subject: 'science',
        gradeLevel: 'ה',
        domain: 'מדעי החיים',
        topic: 'מערכת הנשימה',
        title: 'נשימה והחלפת גזים',
        description: 'התלמיד יכיר את מערכת הנשימה ויבין את תהליך החלפת הגזים. יקשר בין נשימה לאנרגיה.',
        learningObjectives: [
            'זיהוי איברי מערכת הנשימה',
            'הבנת תהליך החלפת הגזים',
            'קשר בין נשימה לאנרגיה',
            'הבנת חשיבות האוויר הנקי'
        ],
        requiredSkills: ['זיהוי', 'הסבר', 'קישור'],
        recommendedActivityTypes: ['image_labeling', 'ordering', 'multiple-choice'],
        recommendedBloomLevels: ['knowledge', 'comprehension'],
        source: 'ministry_of_education'
    },
    {
        subject: 'science',
        gradeLevel: 'ה',
        domain: 'חומרים',
        topic: 'מצבי צבירה',
        title: 'מוצק, נוזל וגז',
        description: 'התלמיד יבחין בין מצבי הצבירה השונים: מוצק, נוזל וגז. יבין את המעברים ביניהם.',
        learningObjectives: [
            'זיהוי מצבי צבירה',
            'הבנת תכונות כל מצב',
            'הסבר מעברים בין מצבים',
            'מתן דוגמאות מהחיים'
        ],
        requiredSkills: ['זיהוי', 'השוואה', 'הסבר'],
        recommendedActivityTypes: ['categorization', 'matching', 'true_false_speed'],
        recommendedBloomLevels: ['knowledge', 'comprehension', 'application'],
        source: 'ministry_of_education'
    },
    {
        subject: 'science',
        gradeLevel: 'ה',
        domain: 'אנרגיה',
        topic: 'סוגי אנרגיה',
        title: 'זיהוי סוגי אנרגיה',
        description: 'התלמיד יזהה סוגי אנרגיה שונים: תנועה, חום, אור, קול, חשמל. יבין המרות אנרגיה.',
        learningObjectives: [
            'זיהוי סוגי אנרגיה',
            'מתן דוגמאות לכל סוג',
            'הבנת המרות אנרגיה',
            'קשר לחיי היום-יום'
        ],
        requiredSkills: ['זיהוי', 'סיווג', 'קישור'],
        recommendedActivityTypes: ['categorization', 'matching', 'multiple-choice'],
        recommendedBloomLevels: ['knowledge', 'comprehension', 'application'],
        source: 'ministry_of_education'
    },

    // כיתה ו - מדעים
    {
        subject: 'science',
        gradeLevel: 'ו',
        domain: 'מדעי החיים',
        topic: 'מערכת הדם',
        title: 'מבנה ותפקוד מערכת הדם',
        description: 'התלמיד יכיר את מערכת הדם: הלב, כלי הדם והדם. יבין את מחזור הדם ותפקידיו.',
        learningObjectives: [
            'זיהוי מרכיבי מערכת הדם',
            'הבנת תפקיד הלב',
            'הבחנה בין עורקים לורידים',
            'הבנת מחזור הדם'
        ],
        requiredSkills: ['זיהוי', 'הסבר', 'הבחנה'],
        recommendedActivityTypes: ['image_labeling', 'ordering', 'fill_in_blanks', 'matching'],
        recommendedBloomLevels: ['knowledge', 'comprehension', 'application'],
        source: 'ministry_of_education'
    },
    {
        subject: 'science',
        gradeLevel: 'ו',
        domain: 'מדעי החיים',
        topic: 'מערכת העצבים',
        title: 'מוח, עצבים וחושים',
        description: 'התלמיד יכיר את מערכת העצבים ותפקידיה. יבין את הקשר בין חושים, עצבים ומוח.',
        learningObjectives: [
            'זיהוי מרכיבי מערכת העצבים',
            'הבנת תפקיד המוח',
            'קשר בין חושים למוח',
            'הבנת רפלקסים'
        ],
        requiredSkills: ['זיהוי', 'הסבר', 'קישור'],
        recommendedActivityTypes: ['image_labeling', 'matching', 'categorization'],
        recommendedBloomLevels: ['knowledge', 'comprehension'],
        source: 'ministry_of_education'
    },
    {
        subject: 'science',
        gradeLevel: 'ו',
        domain: 'אנרגיה',
        topic: 'חשמל ומעגלים',
        title: 'מעגל חשמלי פשוט',
        description: 'התלמיד יבנה ויבין מעגל חשמלי פשוט. יזהה מוליכים ומבודדים ויבין את תפקיד כל רכיב.',
        learningObjectives: [
            'בניית מעגל חשמלי',
            'הבחנה בין מוליך למבודד',
            'הבנת תפקיד כל רכיב',
            'הבנת בטיחות בחשמל'
        ],
        requiredSkills: ['בנייה', 'ניסוי', 'הסבר'],
        recommendedActivityTypes: ['ordering', 'categorization', 'multiple-choice', 'image_labeling'],
        recommendedBloomLevels: ['knowledge', 'application'],
        source: 'ministry_of_education'
    },
    {
        subject: 'science',
        gradeLevel: 'ו',
        domain: 'אנרגיה',
        topic: 'המרות אנרגיה',
        title: 'שימור והמרת אנרגיה',
        description: 'התלמיד יבין את עקרון שימור האנרגיה. יתאר המרות אנרגיה במערכות שונות.',
        learningObjectives: [
            'הבנת שימור אנרגיה',
            'זיהוי המרות אנרגיה',
            'מתן דוגמאות מהחיים',
            'הבנת יעילות אנרגטית'
        ],
        requiredSkills: ['הבנה', 'ניתוח', 'יישום'],
        recommendedActivityTypes: ['ordering', 'matching', 'open-question'],
        recommendedBloomLevels: ['comprehension', 'application', 'analysis'],
        source: 'ministry_of_education'
    },
    {
        subject: 'science',
        gradeLevel: 'ו',
        domain: 'טכנולוגיה',
        topic: 'מערכות טכנולוגיות',
        title: 'תכנון מערכת טכנולוגית',
        description: 'התלמיד יבין את מרכיבי מערכת טכנולוגית: קלט, תהליך, פלט. יתכנן מערכת פשוטה.',
        learningObjectives: [
            'זיהוי מרכיבי מערכת',
            'הבנת זרימת תהליך',
            'תכנון פתרון לבעיה',
            'הערכת פתרונות'
        ],
        requiredSkills: ['תכנון', 'ניתוח', 'פתרון בעיות'],
        recommendedActivityTypes: ['ordering', 'open-question', 'categorization'],
        recommendedBloomLevels: ['application', 'analysis', 'synthesis'],
        source: 'ministry_of_education'
    },
    {
        subject: 'science',
        gradeLevel: 'ו',
        domain: 'סביבה',
        topic: 'שרשרת מזון',
        title: 'יחסי מזון במערכת אקולוגית',
        description: 'התלמיד יבין את מושג שרשרת המזון ורשת המזון. יזהה יצרנים, צרכנים ומפרקים.',
        learningObjectives: [
            'זיהוי רמות תזונה',
            'בניית שרשרת מזון',
            'הבנת קשרי תלות',
            'הבנת איזון אקולוגי'
        ],
        requiredSkills: ['זיהוי', 'סיווג', 'קישור'],
        recommendedActivityTypes: ['ordering', 'categorization', 'matching', 'image_labeling'],
        recommendedBloomLevels: ['knowledge', 'comprehension', 'application'],
        source: 'ministry_of_education'
    }
];

// ============================================
// Seeding Function
// ============================================

async function seedCurriculumStandards() {
    console.log('🌱 Starting curriculum standards seeding...');

    // Initialize Firebase Admin with service account
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const serviceAccount = require(SERVICE_ACCOUNT_PATH);
        initializeApp({
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id
        });
        console.log(`✅ Connected to project: ${serviceAccount.project_id}`);
    } catch (e: any) {
        console.log('App initialization error:', e.message);
        // Try without credentials (might already be initialized)
        try {
            initializeApp();
        } catch {
            // Ignore
        }
    }

    const db = getFirestore();
    const allStandards = [...HEBREW_STANDARDS, ...SCIENCE_STANDARDS];

    console.log(`📚 Seeding ${allStandards.length} curriculum standards...`);

    let successCount = 0;
    let errorCount = 0;

    for (const standardData of allStandards) {
        try {
            const docRef = db.collection('curriculum_standards').doc();

            const standard: CurriculumStandard = {
                id: docRef.id,
                ...standardData,
                embedding: [], // Will be populated by a separate embedding job
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            await docRef.set(standard);
            successCount++;

            console.log(`✅ Seeded: ${standard.title} (${standard.subject} - ${standard.gradeLevel})`);

        } catch (error: any) {
            errorCount++;
            console.error(`❌ Error seeding standard: ${standardData.title}`, error.message);
        }
    }

    console.log('\n📊 Seeding Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📚 Total: ${allStandards.length}`);

    // Print breakdown by subject and grade
    const breakdown: Record<string, number> = {};
    for (const s of allStandards) {
        const key = `${s.subject}-${s.gradeLevel}`;
        breakdown[key] = (breakdown[key] || 0) + 1;
    }

    console.log('\n📈 Breakdown by Subject & Grade:');
    for (const [key, count] of Object.entries(breakdown)) {
        const [subject, grade] = key.split('-');
        const subjectHebrew = subject === 'hebrew' ? 'עברית' : 'מדעים';
        console.log(`   ${subjectHebrew} כיתה ${grade}: ${count} תקנים`);
    }
}

// Run if executed directly
if (require.main === module) {
    seedCurriculumStandards()
        .then(() => {
            console.log('\n🎉 Seeding complete!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Seeding failed:', error);
            process.exit(1);
        });
}

export { seedCurriculumStandards, HEBREW_STANDARDS, SCIENCE_STANDARDS };
