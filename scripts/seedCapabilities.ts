/**
 * Seed Capabilities Script
 *
 * Run with: npx ts-node --esm scripts/seedCapabilities.ts
 *
 * Seeds the capabilities collection in Firestore with the predefined capabilities.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load service account
const serviceAccountPath = path.join(__dirname, '../service-account-key.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error('Error: service-account-key.json not found!');
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin
initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

// Define capabilities inline to avoid import issues
const SEED_CAPABILITIES = [
    {
        id: 'create_interactive_lesson',
        version: '1.0.0',
        name: 'יצירת שיעור אינטראקטיבי',
        description: 'יצירת שיעור מלא עם שקפים, אינפוגרפיקות, הסברים ושאלות.',
        shortDescription: 'שיעור דיגיטלי עם תמונות ושאלות',
        category: 'interactive_content',
        complexity: 'complex',
        executionType: 'wizard',
        parameters: {
            topic: { name: 'topic', type: 'string', description: 'נושא השיעור', required: true },
            grade: { name: 'grade', type: 'string', description: 'כיתה', required: false },
            subject: { name: 'subject', type: 'string', description: 'תחום דעת', required: false },
            activityLength: { name: 'activityLength', type: 'enum', enumValues: ['short', 'medium', 'long'], required: false, defaultValue: 'medium' },
            difficultyLevel: { name: 'difficultyLevel', type: 'enum', enumValues: ['support', 'core', 'enrichment', 'all'], required: false, defaultValue: 'core' }
        },
        triggers: {
            keywords: ['שיעור', 'מערך שיעור', 'שיעור אינטראקטיבי', 'שיעור דיגיטלי', 'לימוד', 'הסבר'],
            contexts: ['content_creation', 'interactive_mode'],
            exclusions: ['להדפסה', 'מודפס', 'PDF']
        },
        examples: [
            { userMessage: 'תכין לי שיעור על מחזור המים לכיתה ד', expectedParams: { topic: 'מחזור המים', grade: 'ד' } }
        ],
        functionDeclaration: {
            name: 'create_interactive_lesson',
            description: 'יצירת שיעור אינטראקטיבי עם שקפים, תמונות, ושאלות',
            parameters: {
                type: 'object',
                properties: {
                    topic: { type: 'string', description: 'נושא השיעור' },
                    grade: { type: 'string', description: 'כיתה' },
                    subject: { type: 'string', description: 'תחום דעת' },
                    activityLength: { type: 'string', enum: ['short', 'medium', 'long'] },
                    difficultyLevel: { type: 'string', enum: ['support', 'core', 'enrichment', 'all'] }
                },
                required: ['topic']
            }
        },
        execution: { type: 'wizard', wizardComponent: 'ContentCreationWizard', wizardMode: 'lesson' },
        ui: { icon: 'IconBook', color: 'blue', showInMenu: true, menuOrder: 1 },
        status: 'active',
        tags: ['lesson', 'interactive', 'visual', 'infographics']
    },
    {
        id: 'create_interactive_activity',
        version: '1.0.0',
        name: 'יצירת פעילות אינטראקטיבית',
        description: 'יצירת פעילות תרגול עם שאלות מגוונות - התאמה, מיון, סידור, חידונים ועוד.',
        shortDescription: 'פעילות תרגול עם שאלות ומשוב',
        category: 'interactive_content',
        complexity: 'medium',
        executionType: 'wizard',
        parameters: {
            topic: { name: 'topic', type: 'string', description: 'נושא הפעילות', required: true },
            grade: { name: 'grade', type: 'string', description: 'כיתה', required: false },
            activityLength: { name: 'activityLength', type: 'enum', enumValues: ['short', 'medium', 'long'], required: false, defaultValue: 'medium' },
            profile: { name: 'profile', type: 'enum', enumValues: ['balanced', 'educational', 'game'], required: false, defaultValue: 'balanced' }
        },
        triggers: {
            keywords: ['פעילות', 'תרגול', 'תרגילים', 'משחק לימודי', 'חידון', 'שאלות'],
            contexts: ['content_creation', 'interactive_mode'],
            exclusions: ['להדפסה', 'דף עבודה']
        },
        examples: [
            { userMessage: 'צור פעילות תרגול על פעלים', expectedParams: { topic: 'פעלים' } }
        ],
        functionDeclaration: {
            name: 'create_interactive_activity',
            description: 'יצירת פעילות תרגול אינטראקטיבית',
            parameters: {
                type: 'object',
                properties: {
                    topic: { type: 'string' },
                    grade: { type: 'string' },
                    activityLength: { type: 'string', enum: ['short', 'medium', 'long'] },
                    profile: { type: 'string', enum: ['balanced', 'educational', 'game'] }
                },
                required: ['topic']
            }
        },
        execution: { type: 'wizard', wizardComponent: 'ContentCreationWizard', wizardMode: 'activity' },
        ui: { icon: 'IconPuzzle', color: 'green', showInMenu: true, menuOrder: 2 },
        status: 'active',
        tags: ['activity', 'interactive', 'practice', 'quiz']
    },
    {
        id: 'create_interactive_exam',
        version: '1.0.0',
        name: 'יצירת מבחן דיגיטלי',
        description: 'יצירת מבחן או בוחן דיגיטלי עם ציון אוטומטי.',
        shortDescription: 'מבחן עם ציון אוטומטי',
        category: 'interactive_content',
        complexity: 'medium',
        executionType: 'wizard',
        parameters: {
            topic: { name: 'topic', type: 'string', description: 'נושא המבחן', required: true },
            grade: { name: 'grade', type: 'string', description: 'כיתה', required: false },
            questionCount: { name: 'questionCount', type: 'number', description: 'מספר שאלות', required: false, defaultValue: 10 }
        },
        triggers: {
            keywords: ['מבחן', 'בוחן', 'מבחן דיגיטלי', 'מבדק'],
            contexts: ['content_creation', 'interactive_mode'],
            exclusions: ['להדפסה', 'מודפס', 'PDF']
        },
        examples: [
            { userMessage: 'צור מבחן דיגיטלי על היסטוריה', expectedParams: { topic: 'היסטוריה' } }
        ],
        functionDeclaration: {
            name: 'create_interactive_exam',
            description: 'יצירת מבחן או בוחן דיגיטלי',
            parameters: {
                type: 'object',
                properties: {
                    topic: { type: 'string' },
                    grade: { type: 'string' },
                    questionCount: { type: 'number' }
                },
                required: ['topic']
            }
        },
        execution: { type: 'wizard', wizardComponent: 'ContentCreationWizard', wizardMode: 'exam' },
        ui: { icon: 'IconClipboardCheck', color: 'orange', showInMenu: true, menuOrder: 3 },
        status: 'active',
        tags: ['exam', 'test', 'assessment', 'interactive']
    },
    {
        id: 'create_micro_activity',
        version: '1.0.0',
        name: 'יצירת מיקרו פעילות',
        description: 'יצירת פעילות קצרה וממוקדת - משחק זיכרון, התאמה, מיון, סידור, השלמת חסר.',
        shortDescription: 'פעילות קצרה וממוקדת',
        category: 'interactive_content',
        complexity: 'simple',
        executionType: 'wizard',
        parameters: {
            topic: { name: 'topic', type: 'string', description: 'נושא הפעילות', required: true },
            activityType: { name: 'activityType', type: 'enum', enumValues: ['memory_game', 'matching', 'categorization', 'ordering', 'fill_in_blanks', 'multiple_choice'], required: false },
            grade: { name: 'grade', type: 'string', description: 'כיתה', required: false }
        },
        triggers: {
            keywords: ['מיקרו פעילות', 'פעילות קצרה', 'משחק זיכרון', 'התאמה', 'מיון', 'סידור', 'השלמת חסר'],
            contexts: ['content_creation', 'interactive_mode', 'quick_activity']
        },
        examples: [
            { userMessage: 'צור משחק זיכרון על בעלי חיים', expectedParams: { topic: 'בעלי חיים', activityType: 'memory_game' } }
        ],
        functionDeclaration: {
            name: 'create_micro_activity',
            description: 'יצירת מיקרו פעילות - פעילות קצרה וממוקדת',
            parameters: {
                type: 'object',
                properties: {
                    topic: { type: 'string', description: 'נושא הפעילות' },
                    activityType: { type: 'string', enum: ['memory_game', 'matching', 'categorization', 'ordering', 'fill_in_blanks', 'multiple_choice'] },
                    grade: { type: 'string' }
                },
                required: ['topic']
            }
        },
        execution: { type: 'wizard', wizardComponent: 'MicroActivityWizard', wizardMode: 'micro_activity' },
        ui: { icon: 'IconPuzzle2', color: 'pink', showInMenu: true, menuOrder: 4 },
        status: 'active',
        tags: ['micro', 'activity', 'game', 'quick', 'interactive']
    },
    {
        id: 'generate_worksheet',
        version: '1.0.0',
        name: 'יצירת דף עבודה להדפסה',
        description: 'יצירת דף עבודה מעוצב להדפסה עם תרגילים, שאלות, ומקום לתשובות.',
        shortDescription: 'דף עבודה PDF להדפסה',
        category: 'static_content',
        complexity: 'simple',
        executionType: 'prompt_based',
        parameters: {
            topic: { name: 'topic', type: 'string', description: 'נושא דף העבודה', required: true },
            grade: { name: 'grade', type: 'string', description: 'כיתה', required: false },
            questionCount: { name: 'questionCount', type: 'number', description: 'מספר שאלות', required: false, defaultValue: 10 }
        },
        triggers: {
            keywords: ['דף עבודה', 'גיליון עבודה', 'דף תרגילים', 'דף תרגול', 'להדפסה', 'מודפס'],
            contexts: ['content_creation', 'static_mode']
        },
        examples: [
            { userMessage: 'צור דף עבודה על כפל לכיתה ג', expectedParams: { topic: 'כפל', grade: 'ג' } }
        ],
        functionDeclaration: {
            name: 'generate_worksheet',
            description: 'יצירת דף עבודה להדפסה',
            parameters: {
                type: 'object',
                properties: {
                    topic: { type: 'string' },
                    grade: { type: 'string' },
                    questionCount: { type: 'number' }
                },
                required: ['topic']
            }
        },
        execution: { type: 'direct_api', apiEndpoint: 'generateStaticContent', apiMethod: 'POST' },
        ui: { icon: 'IconFileTypePdf', color: 'red', showInMenu: true, menuOrder: 10 },
        status: 'active',
        tags: ['worksheet', 'printable', 'static', 'pdf']
    },
    {
        id: 'generate_lesson_plan',
        version: '1.0.0',
        name: 'יצירת מערך שיעור להדפסה',
        description: 'יצירת מערך שיעור מפורט למורה - מטרות, פתיחה, גוף השיעור, סיכום, והערכה.',
        shortDescription: 'מערך שיעור למורה (PDF)',
        category: 'static_content',
        complexity: 'medium',
        executionType: 'prompt_based',
        parameters: {
            topic: { name: 'topic', type: 'string', description: 'נושא השיעור', required: true },
            grade: { name: 'grade', type: 'string', description: 'כיתה', required: false },
            duration: { name: 'duration', type: 'number', description: 'אורך השיעור בדקות', required: false, defaultValue: 45 }
        },
        triggers: {
            keywords: ['מערך שיעור', 'תכנית שיעור', 'תכנון שיעור', 'מערך למורה'],
            contexts: ['content_creation', 'static_mode']
        },
        examples: [
            { userMessage: 'צור מערך שיעור להדפסה על שברים', expectedParams: { topic: 'שברים' } }
        ],
        functionDeclaration: {
            name: 'generate_lesson_plan',
            description: 'יצירת מערך שיעור מודפס למורה',
            parameters: {
                type: 'object',
                properties: {
                    topic: { type: 'string' },
                    grade: { type: 'string' },
                    duration: { type: 'number' }
                },
                required: ['topic']
            }
        },
        execution: { type: 'direct_api', apiEndpoint: 'generateStaticContent', apiMethod: 'POST' },
        ui: { icon: 'IconFileTypeDoc', color: 'blue', showInMenu: true, menuOrder: 11 },
        status: 'active',
        tags: ['lesson_plan', 'printable', 'teacher', 'planning']
    },
    {
        id: 'generate_letter',
        version: '1.0.0',
        name: 'כתיבת מכתב להורים',
        description: 'יצירת מכתב מקצועי להורים - עדכונים, הודעות, בקשות, או סיכומים.',
        shortDescription: 'מכתב מעוצב להורים',
        category: 'static_content',
        complexity: 'simple',
        executionType: 'prompt_based',
        parameters: {
            subject: { name: 'subject', type: 'string', description: 'נושא המכתב', required: true },
            letterType: { name: 'letterType', type: 'enum', enumValues: ['update', 'request', 'invitation', 'summary', 'concern', 'praise'], required: false },
            tone: { name: 'tone', type: 'enum', enumValues: ['professional', 'warm', 'formal', 'casual'], required: false, defaultValue: 'professional' }
        },
        triggers: {
            keywords: ['מכתב', 'מכתב להורים', 'הודעה להורים', 'עדכון להורים']
        },
        examples: [
            { userMessage: 'כתוב מכתב להורים על טיול שנתי', expectedParams: { subject: 'טיול שנתי', letterType: 'update' } }
        ],
        functionDeclaration: {
            name: 'generate_letter',
            description: 'כתיבת מכתב מקצועי להורים',
            parameters: {
                type: 'object',
                properties: {
                    subject: { type: 'string' },
                    letterType: { type: 'string', enum: ['update', 'request', 'invitation', 'summary', 'concern', 'praise'] },
                    tone: { type: 'string', enum: ['professional', 'warm', 'formal', 'casual'] }
                },
                required: ['subject']
            }
        },
        execution: { type: 'direct_api', apiEndpoint: 'generateStaticContent', apiMethod: 'POST' },
        ui: { icon: 'IconMail', color: 'purple', showInMenu: true, menuOrder: 12 },
        status: 'active',
        tags: ['letter', 'parents', 'communication']
    },
    {
        id: 'generate_feedback',
        version: '1.0.0',
        name: 'כתיבת משוב לתלמיד',
        description: 'יצירת משוב מקצועי ומותאם אישית לתלמיד.',
        shortDescription: 'משוב מותאם אישית',
        category: 'static_content',
        complexity: 'simple',
        executionType: 'prompt_based',
        parameters: {
            studentName: { name: 'studentName', type: 'string', description: 'שם התלמיד', required: false },
            context: { name: 'context', type: 'string', description: 'הקשר המשוב', required: true },
            tone: { name: 'tone', type: 'enum', enumValues: ['encouraging', 'constructive', 'formal'], required: false, defaultValue: 'encouraging' }
        },
        triggers: {
            keywords: ['משוב', 'משוב לתלמיד', 'הערכה', 'פידבק', 'חוות דעת']
        },
        examples: [
            { userMessage: 'כתוב משוב על עבודה בהיסטוריה', expectedParams: { context: 'עבודה בהיסטוריה' } }
        ],
        functionDeclaration: {
            name: 'generate_feedback',
            description: 'כתיבת משוב לתלמיד',
            parameters: {
                type: 'object',
                properties: {
                    studentName: { type: 'string' },
                    context: { type: 'string' },
                    tone: { type: 'string', enum: ['encouraging', 'constructive', 'formal'] }
                },
                required: ['context']
            }
        },
        execution: { type: 'direct_api', apiEndpoint: 'generateStaticContent', apiMethod: 'POST' },
        ui: { icon: 'IconMessage', color: 'teal', showInMenu: true, menuOrder: 13 },
        status: 'active',
        tags: ['feedback', 'student', 'assessment']
    },
    {
        id: 'generate_rubric',
        version: '1.0.0',
        name: 'יצירת רובריקה/מחוון',
        description: 'יצירת מחוון הערכה מפורט עם קריטריונים ורמות ביצוע.',
        shortDescription: 'מחוון להערכה',
        category: 'static_content',
        complexity: 'medium',
        executionType: 'prompt_based',
        parameters: {
            assignmentType: { name: 'assignmentType', type: 'string', description: 'סוג המשימה להערכה', required: true },
            levels: { name: 'levels', type: 'number', description: 'מספר רמות ביצוע', required: false, defaultValue: 4 }
        },
        triggers: {
            keywords: ['רובריקה', 'מחוון', 'קריטריונים', 'הערכה']
        },
        examples: [
            { userMessage: 'צור מחוון להערכת מצגת', expectedParams: { assignmentType: 'מצגת' } }
        ],
        functionDeclaration: {
            name: 'generate_rubric',
            description: 'יצירת רובריקה/מחוון הערכה',
            parameters: {
                type: 'object',
                properties: {
                    assignmentType: { type: 'string' },
                    levels: { type: 'number' }
                },
                required: ['assignmentType']
            }
        },
        execution: { type: 'direct_api', apiEndpoint: 'generateStaticContent', apiMethod: 'POST' },
        ui: { icon: 'IconTable', color: 'cyan', showInMenu: true, menuOrder: 14 },
        status: 'active',
        tags: ['rubric', 'assessment', 'criteria', 'grading']
    },
    {
        id: 'generate_printable_test',
        version: '1.0.0',
        name: 'יצירת מבחן להדפסה',
        description: 'יצירת מבחן מעוצב להדפסה עם שאלות ומפתח תשובות.',
        shortDescription: 'מבחן PDF להדפסה',
        category: 'static_content',
        complexity: 'medium',
        executionType: 'prompt_based',
        parameters: {
            topic: { name: 'topic', type: 'string', description: 'נושא המבחן', required: true },
            grade: { name: 'grade', type: 'string', description: 'כיתה', required: false },
            questionCount: { name: 'questionCount', type: 'number', description: 'מספר שאלות', required: false, defaultValue: 20 }
        },
        triggers: {
            keywords: ['מבחן להדפסה', 'מבחן מודפס', 'מבחן PDF', 'בוחן להדפסה']
        },
        examples: [
            { userMessage: 'צור מבחן להדפסה על מלחמת העולם הראשונה', expectedParams: { topic: 'מלחמת העולם הראשונה' } }
        ],
        functionDeclaration: {
            name: 'generate_printable_test',
            description: 'יצירת מבחן מודפס',
            parameters: {
                type: 'object',
                properties: {
                    topic: { type: 'string' },
                    grade: { type: 'string' },
                    questionCount: { type: 'number' }
                },
                required: ['topic']
            }
        },
        execution: { type: 'direct_api', apiEndpoint: 'generateStaticContent', apiMethod: 'POST' },
        ui: { icon: 'IconPrinter', color: 'gray', showInMenu: true, menuOrder: 15 },
        status: 'active',
        tags: ['test', 'printable', 'assessment', 'pdf']
    }
];

async function seedCapabilities() {
    console.log(`📚 Starting to seed ${SEED_CAPABILITIES.length} capabilities...`);

    const batch = db.batch();

    for (const capability of SEED_CAPABILITIES) {
        const docRef = db.collection('capabilities').doc(capability.id);
        batch.set(docRef, {
            ...capability,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        console.log(`  ✅ Added: ${capability.id}`);
    }

    await batch.commit();
    console.log(`\n🎉 Successfully seeded ${SEED_CAPABILITIES.length} capabilities!`);

    process.exit(0);
}

seedCapabilities().catch(error => {
    console.error('❌ Error seeding capabilities:', error);
    process.exit(1);
});
