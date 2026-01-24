/**
 * Seed Bagrut Content Script
 * סקריפט להזרעת תוכן בגרות ראשוני למערכת
 *
 * Usage: npx ts-node src/scripts/seedBagrutContent.ts
 */

import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import type {
    BagrutSubject,
    BagrutQuestion,
    BagrutPracticeModule,
    BagrutChapter,
    RubricItem
} from '../../../src/shared/types/bagrutTypes';
import { SUBJECT_CONTEXT, getSubjectChapters } from '../prompts/bagrutPrompts';

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// ============================================
// SAMPLE QUESTIONS DATA
// ============================================

const SAMPLE_QUESTIONS: Record<BagrutSubject, Array<Omit<BagrutQuestion, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>>> = {
    civics: [
        {
            subject: 'civics',
            chapter: 'עקרון הפרדת הרשויות ואיזונים',
            topic: 'הפרדת רשויות',
            questionType: 'open',
            points: 15,
            difficulty: 2,
            question: 'הסבר מהו עקרון הפרדת הרשויות במשטר דמוקרטי, ומדוע הוא חשוב לשמירה על הדמוקרטיה. הבא שתי דוגמאות ליישום העיקרון במדינת ישראל.',
            modelAnswer: 'עקרון הפרדת הרשויות קובע שהשלטון מחולק לשלוש רשויות עצמאיות: המחוקקת (הכנסת), המבצעת (הממשלה), והשופטת (בתי המשפט). כל רשות מבצעת תפקיד שונה וכך נמנע ריכוז כוח בידי גורם אחד.\n\nחשיבות העיקרון: מניעת עריצות, איזונים ובלמים, הגנה על זכויות האזרח.\n\nדוגמאות מישראל:\n1. הכנסת מחוקקת חוקים והממשלה מבצעת אותם\n2. בג"ץ יכול לפסול החלטות ממשלה שאינן חוקיות',
            rubric: [
                {
                    id: uuidv4(),
                    criterion: 'הסבר העיקרון',
                    maxPoints: 5,
                    levels: [
                        { points: 5, description: 'הסבר מלא של שלוש הרשויות ותפקידיהן' },
                        { points: 3, description: 'הסבר חלקי - הזכיר חלק מהרשויות' },
                        { points: 0, description: 'לא הסביר את העיקרון' }
                    ]
                },
                {
                    id: uuidv4(),
                    criterion: 'חשיבות העיקרון',
                    maxPoints: 5,
                    levels: [
                        { points: 5, description: 'הסביר מדוע העיקרון חשוב לדמוקרטיה' },
                        { points: 3, description: 'הסבר חלקי' },
                        { points: 0, description: 'לא הסביר את החשיבות' }
                    ]
                },
                {
                    id: uuidv4(),
                    criterion: 'דוגמאות',
                    maxPoints: 5,
                    levels: [
                        { points: 5, description: 'שתי דוגמאות רלוונטיות ומדויקות' },
                        { points: 3, description: 'דוגמה אחת או דוגמאות חלקיות' },
                        { points: 0, description: 'ללא דוגמאות' }
                    ]
                }
            ],
            keywords: ['הפרדת רשויות', 'כנסת', 'ממשלה', 'בית משפט', 'איזונים ובלמים'],
            hints: [
                'חשוב על שלוש הרשויות הראשיות בישראל',
                'כל רשות מבצעת תפקיד שונה - מה הם?',
                'מה קורה כשהרשויות לא מופרדות?'
            ],
            commonMistakes: ['בלבול בין תפקידי הרשויות', 'אי הבנה של הקשר לדמוקרטיה'],
            timeEstimate: 15,
            reviewStatus: 'approved',
            createdBy: 'system'
        },
        {
            subject: 'civics',
            chapter: 'עקרונות הדמוקרטיה - שלטון העם והכרעת הרוב',
            topic: 'עקרון הכרעת הרוב',
            questionType: 'multiple-choice',
            points: 10,
            difficulty: 1,
            question: 'מהו עקרון הכרעת הרוב?',
            options: [
                'הזכות של כל אזרח להצביע בבחירות',
                'קבלת החלטות על פי דעת הרוב תוך שמירה על זכויות המיעוט',
                'שלטון של קבוצה קטנה על הרוב',
                'חובת כל האזרחים לציית לחוקים'
            ],
            correctOptionIndex: 1,
            modelAnswer: 'עקרון הכרעת הרוב הוא עקרון יסוד בדמוקרטיה לפיו החלטות מתקבלות על פי דעת הרוב, אך תוך שמירה על זכויות המיעוט והגנה עליו מפני עריצות הרוב.',
            rubric: [],
            keywords: ['הכרעת הרוב', 'זכויות המיעוט'],
            hints: ['חשוב על איך מתקבלות החלטות בכנסת'],
            timeEstimate: 3,
            reviewStatus: 'approved',
            createdBy: 'system'
        },
        {
            subject: 'civics',
            chapter: 'זכויות האדם והאזרח - טבעיות ואזרחיות',
            topic: 'חוק יסוד כבוד האדם וחירותו',
            questionType: 'source-analysis',
            points: 20,
            difficulty: 2,
            sourceText: 'אין פוגעים בחייו, בגופו, או בכבודו של אדם באשר הוא אדם.',
            sourceReference: 'חוק יסוד: כבוד האדם וחירותו, סעיף 2',
            question: 'קרא את הסעיף מחוק יסוד: כבוד האדם וחירותו וענה:\nא. הסבר את המשמעות של הביטוי "באשר הוא אדם". (8 נקודות)\nב. תן שתי דוגמאות למצבים שבהם הסעיף הזה מגן על האזרח. (12 נקודות)',
            subQuestions: [
                {
                    id: uuidv4(),
                    label: 'א',
                    question: 'הסבר את המשמעות של הביטוי "באשר הוא אדם"',
                    points: 8,
                    modelAnswer: 'הביטוי "באשר הוא אדם" מדגיש שהזכות לכבוד היא זכות אוניברסלית השייכת לכל אדם רק בגלל היותו אדם, ללא קשר לדת, גזע, מין, מעמד חברתי או כל מאפיין אחר.',
                    keywords: ['אוניברסלי', 'שוויון', 'כל אדם']
                },
                {
                    id: uuidv4(),
                    label: 'ב',
                    question: 'תן שתי דוגמאות למצבים שבהם הסעיף הזה מגן על האזרח',
                    points: 12,
                    modelAnswer: 'דוגמאות:\n1. איסור עינויים - המשטרה לא יכולה להשתמש בעינויים כדי להוציא מידע מחשוד\n2. איסור השפלה - מעסיק לא יכול להשפיל עובד ברבים',
                    keywords: ['עינויים', 'השפלה', 'כבוד', 'הגנה']
                }
            ],
            modelAnswer: 'א. הביטוי "באשר הוא אדם" מדגיש שזכויות אלו שייכות לכל אדם באופן אוניברסלי, ללא תלות במאפיינים כלשהם.\n\nב. דוגמאות:\n1. איסור עינויים בחקירות\n2. איסור השפלה במקום העבודה',
            rubric: [
                {
                    id: uuidv4(),
                    criterion: 'הסבר הביטוי',
                    maxPoints: 8,
                    levels: [
                        { points: 8, description: 'הסבר מלא של המשמעות האוניברסלית' },
                        { points: 5, description: 'הסבר חלקי' },
                        { points: 0, description: 'לא הסביר' }
                    ]
                },
                {
                    id: uuidv4(),
                    criterion: 'דוגמאות',
                    maxPoints: 12,
                    levels: [
                        { points: 12, description: 'שתי דוגמאות מפורטות ורלוונטיות' },
                        { points: 8, description: 'דוגמה אחת טובה או שתיים חלקיות' },
                        { points: 0, description: 'ללא דוגמאות' }
                    ]
                }
            ],
            keywords: ['כבוד האדם', 'זכויות', 'אוניברסלי', 'הגנה'],
            hints: ['מה מיוחד בביטוי "באשר הוא אדם"?', 'חשוב על מצבים שבהם הכבוד של אנשים עלול להיפגע'],
            timeEstimate: 15,
            reviewStatus: 'approved',
            createdBy: 'system'
        }
    ],

    literature: [
        {
            subject: 'literature',
            chapter: 'ניתוח דמויות ועלילה',
            topic: 'ניתוח דמות',
            questionType: 'open',
            points: 20,
            difficulty: 2,
            question: 'בחר דמות מרכזית מאחת היצירות שלמדת. נתח את הדמות תוך התייחסות ל:\nא. אפיון הדמות (חיצוני ופנימי)\nב. השינוי שהדמות עוברת במהלך העלילה\nג. הקשר בין הדמות לנושא המרכזי של היצירה',
            modelAnswer: 'דוגמה לניתוח דמות מ"אריה בעל הגומות" של דוד גרוסמן:\n\nאפיון: אריה הוא ילד עם גומות בלחיים, רגיש ודמיוני. חיצונית - ילד רגיל לכאורה, אך פנימית - עולם פנימי עשיר ומורכב.\n\nשינוי: במהלך הסיפור אריה לומד להתמודד עם המציאות הקשה תוך שמירה על דמיונו.\n\nקשר לנושא: הדמות מייצגת את הילדות והיכולת לשמר תמימות בעולם מורכב.',
            rubric: [
                {
                    id: uuidv4(),
                    criterion: 'אפיון הדמות',
                    maxPoints: 7,
                    levels: [
                        { points: 7, description: 'אפיון מלא - חיצוני ופנימי עם דוגמאות' },
                        { points: 4, description: 'אפיון חלקי' },
                        { points: 0, description: 'לא אפיין' }
                    ]
                },
                {
                    id: uuidv4(),
                    criterion: 'שינוי הדמות',
                    maxPoints: 7,
                    levels: [
                        { points: 7, description: 'תיאור מפורט של השינוי עם הוכחות מהטקסט' },
                        { points: 4, description: 'זיהוי שינוי ללא פירוט' },
                        { points: 0, description: 'לא זיהה שינוי' }
                    ]
                },
                {
                    id: uuidv4(),
                    criterion: 'קשר לנושא',
                    maxPoints: 6,
                    levels: [
                        { points: 6, description: 'קישור ברור בין הדמות לנושא המרכזי' },
                        { points: 3, description: 'קישור חלקי' },
                        { points: 0, description: 'לא קישר' }
                    ]
                }
            ],
            keywords: ['אפיון', 'דמות', 'שינוי', 'עלילה', 'נושא מרכזי'],
            hints: [
                'התחל בתיאור הדמות - איך היא נראית ומה אופייה?',
                'איזה אירוע גורם לדמות להשתנות?',
                'מה הסיפור בעצם "אומר" דרך הדמות הזו?'
            ],
            timeEstimate: 20,
            reviewStatus: 'approved',
            createdBy: 'system'
        }
    ],

    bible: [
        {
            subject: 'bible',
            chapter: 'בראשית - סיפורי האבות',
            topic: 'עקידת יצחק',
            questionType: 'source-analysis',
            points: 15,
            difficulty: 2,
            sourceText: 'וַיֹּאמֶר קַח נָא אֶת בִּנְךָ אֶת יְחִידְךָ אֲשֶׁר אָהַבְתָּ אֶת יִצְחָק וְלֶךְ לְךָ אֶל אֶרֶץ הַמֹּרִיָּה וְהַעֲלֵהוּ שָׁם לְעֹלָה עַל אַחַד הֶהָרִים אֲשֶׁר אֹמַר אֵלֶיךָ.',
            sourceReference: 'בראשית כב, ב',
            question: 'קרא את הפסוק וענה:\nא. מהי משמעות הכינויים שבהם מכונה יצחק בציווי האלוהי? (7 נקודות)\nב. מהו הניסיון של אברהם ומה הוא מלמד על אופיו? (8 נקודות)',
            modelAnswer: 'א. הכינויים "בנך", "יחידך", "אשר אהבת" מדגישים את גודל הקורבן הנדרש מאברהם. כל כינוי מעמיק את הקושי: זה בנו, יחידו (לאחר שילוח ישמעאל), והוא אוהב אותו. הדרגתיות זו מבליטה את עוצמת הניסיון.\n\nב. הניסיון בודק את אמונתו ומסירותו המוחלטת של אברהם לאלוהים. היענותו המיידית ("וישכם אברהם בבוקר") מלמדת על אמונה עיוורת ונכונות להקריב את היקר מכל.',
            rubric: [
                {
                    id: uuidv4(),
                    criterion: 'ניתוח הכינויים',
                    maxPoints: 7,
                    levels: [
                        { points: 7, description: 'הסבר מלא של כל הכינויים ומשמעותם' },
                        { points: 4, description: 'הסבר חלקי' },
                        { points: 0, description: 'לא הסביר' }
                    ]
                },
                {
                    id: uuidv4(),
                    criterion: 'הבנת הניסיון',
                    maxPoints: 8,
                    levels: [
                        { points: 8, description: 'הבנה עמוקה של הניסיון ואופי אברהם' },
                        { points: 5, description: 'הבנה חלקית' },
                        { points: 0, description: 'לא הבין' }
                    ]
                }
            ],
            keywords: ['ניסיון', 'אמונה', 'קורבן', 'מסירות'],
            hints: ['שים לב לסדר הכינויים - האם יש הדרגה?', 'מה הניסיון בודק באברהם?'],
            timeEstimate: 12,
            reviewStatus: 'approved',
            createdBy: 'system'
        }
    ],

    hebrew: [
        {
            subject: 'hebrew',
            chapter: 'הבנת הנקרא - טקסטים עיוניים',
            topic: 'זיהוי טענה מרכזית',
            questionType: 'multiple-choice',
            points: 8,
            difficulty: 1,
            sourceText: 'השימוש ברשתות החברתיות משנה את דפוסי התקשורת בין בני אדם. מחקרים מראים כי אנשים מעדיפים לתקשר דרך הודעות כתובות על פני שיחה פנים אל פנים. תופעה זו משפיעה על יכולת ההבעה הרגשית ועל הבנת הזולת.',
            question: 'מהי הטענה המרכזית של הקטע?',
            options: [
                'רשתות חברתיות הן חיוביות לחברה',
                'השימוש ברשתות חברתיות משנה את אופן התקשורת בין אנשים',
                'אנשים לא אוהבים לדבר פנים אל פנים',
                'מחקרים הם הדרך הטובה ביותר להבין תופעות חברתיות'
            ],
            correctOptionIndex: 1,
            modelAnswer: 'הטענה המרכזית היא שהשימוש ברשתות החברתיות משנה את דפוסי התקשורת בין בני אדם - זו הטענה שסביבה נבנה כל הקטע.',
            rubric: [],
            keywords: ['טענה מרכזית', 'רשתות חברתיות', 'תקשורת'],
            hints: ['מה המשפט שסביבו נבנה כל הקטע?'],
            timeEstimate: 3,
            reviewStatus: 'approved',
            createdBy: 'system'
        }
    ],

    english: [
        {
            subject: 'english',
            chapter: 'Reading Comprehension - Expository',
            topic: 'Main Idea',
            questionType: 'multiple-choice',
            points: 10,
            difficulty: 1,
            sourceText: 'Climate change is affecting wildlife around the world. Many species are moving to new areas to find suitable habitats. Scientists warn that some animals may not adapt quickly enough to survive these rapid environmental changes.',
            question: 'What is the main idea of the passage?',
            options: [
                'Scientists are worried about wildlife',
                'Climate change is causing wildlife to relocate and struggle to adapt',
                'Animals are finding new homes',
                'Environmental changes are happening slowly'
            ],
            correctOptionIndex: 1,
            modelAnswer: 'The main idea is that climate change is causing wildlife to relocate and struggle to adapt. The passage discusses both the movement of species and the concern about their ability to survive.',
            rubric: [],
            keywords: ['climate change', 'wildlife', 'adaptation', 'survival'],
            hints: ['Look for the sentence that summarizes the whole passage'],
            timeEstimate: 3,
            reviewStatus: 'approved',
            createdBy: 'system'
        },
        {
            subject: 'english',
            chapter: 'Language - Vocabulary',
            topic: 'Word in Context',
            questionType: 'multiple-choice',
            points: 8,
            difficulty: 2,
            sourceText: 'The scientist made a groundbreaking discovery that revolutionized our understanding of genetics.',
            question: 'What does "groundbreaking" mean in this context?',
            options: [
                'Related to breaking ground for construction',
                'Very important and innovative',
                'Happening underground',
                'Causing damage to the ground'
            ],
            correctOptionIndex: 1,
            modelAnswer: 'In this context, "groundbreaking" means very important and innovative - describing a discovery that significantly changed the field of genetics.',
            rubric: [],
            keywords: ['vocabulary', 'context', 'innovative'],
            hints: ['Think about discoveries that changed science - what kind would they be?'],
            timeEstimate: 2,
            reviewStatus: 'approved',
            createdBy: 'system'
        }
    ],

    history: [
        {
            subject: 'history',
            chapter: 'התנועה הציונית - רעיונות וזרמים',
            topic: 'הצהרת בלפור',
            questionType: 'source-analysis',
            points: 15,
            difficulty: 2,
            sourceText: 'ממשלת הוד מלכותו רואה בעין יפה הקמתו של בית לאומי לעם היהודי בארץ ישראל, ותעשה את מיטב מאמציה להקל על השגת מטרה זו.',
            sourceReference: 'הצהרת בלפור, 2 בנובמבר 1917',
            question: 'קרא את הקטע מהצהרת בלפור וענה:\nא. מהי החשיבות ההיסטורית של הצהרת בלפור עבור התנועה הציונית? (7 נקודות)\nב. מדוע בריטניה הייתה מעוניינת להוציא הצהרה זו בזמן מלחמת העולם הראשונה? (8 נקודות)',
            modelAnswer: 'א. החשיבות ההיסטורית: זוהי ההכרה הבינלאומית הראשונה בזכות היהודים לבית לאומי בארץ ישראל. ההצהרה נתנה לגיטימציה לתנועה הציונית והפכה אותה לשחקן בינלאומי.\n\nב. האינטרסים הבריטיים:\n- גיוס תמיכה יהודית בארה"ב ורוסיה למאמץ המלחמתי\n- הבטחת נוכחות בריטית במזרח התיכון לאחר המלחמה\n- שליטה על מסלולים אסטרטגיים לכיוון הודו',
            rubric: [
                {
                    id: uuidv4(),
                    criterion: 'חשיבות היסטורית',
                    maxPoints: 7,
                    levels: [
                        { points: 7, description: 'הסבר מלא של החשיבות עם הקשר היסטורי' },
                        { points: 4, description: 'הסבר חלקי' },
                        { points: 0, description: 'לא הסביר' }
                    ]
                },
                {
                    id: uuidv4(),
                    criterion: 'אינטרסים בריטיים',
                    maxPoints: 8,
                    levels: [
                        { points: 8, description: 'הזכיר לפחות שני אינטרסים והסביר אותם' },
                        { points: 5, description: 'הזכיר אינטרס אחד' },
                        { points: 0, description: 'לא הזכיר אינטרסים' }
                    ]
                }
            ],
            keywords: ['הצהרת בלפור', 'בית לאומי', 'הכרה בינלאומית', 'מלחמת העולם הראשונה'],
            hints: [
                'מה היה מיוחד בכך שמעצמה גדולה הכירה בזכויות היהודים?',
                'חשוב על המצב הבינלאומי ב-1917 - מה בריטניה היתה צריכה?'
            ],
            timeEstimate: 12,
            reviewStatus: 'approved',
            createdBy: 'system'
        }
    ]
};

// ============================================
// SEEDING FUNCTIONS
// ============================================

async function seedQuestions(): Promise<Map<BagrutSubject, string[]>> {
    const questionIds = new Map<BagrutSubject, string[]>();
    const batch = db.batch();

    console.log('Seeding Bagrut questions...');

    for (const [subject, questions] of Object.entries(SAMPLE_QUESTIONS)) {
        const ids: string[] = [];

        for (const question of questions) {
            const docRef = db.collection('bagrut_questions').doc();
            batch.set(docRef, {
                ...question,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                usageCount: 0
            });
            ids.push(docRef.id);
            console.log(`  - Created question for ${subject}: ${question.topic}`);
        }

        questionIds.set(subject as BagrutSubject, ids);
    }

    await batch.commit();
    console.log('Questions seeded successfully!');

    return questionIds;
}

async function seedModules(questionIds: Map<BagrutSubject, string[]>): Promise<void> {
    console.log('\nSeeding Bagrut practice modules...');

    for (const [subject, qIds] of questionIds) {
        const subjectContext = SUBJECT_CONTEXT[subject];
        const chapters: BagrutChapter[] = subjectContext.chapters.slice(0, 3).map((chapterTitle, index) => ({
            id: uuidv4(),
            title: chapterTitle,
            order: index,
            questionIds: index === 0 ? qIds : [], // Put questions in first chapter for demo
            practiceMode: 'sequential' as const,
            totalQuestions: index === 0 ? qIds.length : 0
        }));

        const module: Omit<BagrutPracticeModule, 'id'> = {
            subject: subject as BagrutSubject,
            title: `תרגול לבגרות ב${subjectContext.hebrewName}`,
            description: `מודול תרגול מקיף למקצוע ${subjectContext.hebrewName}`,
            chapters,
            settings: {
                showHints: true,
                showModelAnswer: true,
                showRubric: false,
                allowRetry: true,
                maxRetries: 3,
                shuffleQuestions: false,
                shuffleOptions: true
            },
            isPublic: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('bagrut_modules').add(module);
        console.log(`  - Created module for ${subjectContext.hebrewName}`);
    }

    console.log('Modules seeded successfully!');
}

// ============================================
// MAIN
// ============================================

async function main() {
    console.log('=== Bagrut Content Seeding ===\n');

    try {
        const questionIds = await seedQuestions();
        await seedModules(questionIds);

        console.log('\n=== Seeding Complete ===');
        console.log('Summary:');
        for (const [subject, ids] of questionIds) {
            console.log(`  ${SUBJECT_CONTEXT[subject].hebrewName}: ${ids.length} questions`);
        }
    } catch (error) {
        console.error('Error seeding content:', error);
        process.exit(1);
    }
}

// Run if executed directly
main().then(() => process.exit(0));
