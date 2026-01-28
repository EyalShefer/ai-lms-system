/**
 * Prompt Fields Service
 *
 * Makes the SmartCreation bot "prompt-aware" by:
 * 1. Dynamically scanning all prompts from Firestore (cached)
 * 2. Fetching required fields from prompts
 * 3. Identifying missing fields based on user-provided params
 * 4. Building clarification questions for missing data
 */

import { collection, query, where, getDocs } from 'firebase/firestore';
// Note: Using cache instead of limit(1) queries for better performance
import { db } from '../../firebase';
import type { PromptField } from '../promptsService';
import { COMMON_FIELD_OPTIONS } from '../promptsService';

// ========== Types ==========

export interface PromptFieldRequirement {
    fieldId: string;           // e.g., "מקצוע", "שכבה"
    label: string;             // Display label
    type: 'text' | 'select' | 'number';
    required: boolean;
    options?: string[];        // For select type
    placeholder?: string;
    mapToParam: string;        // Maps to capability param: "subject", "grade"
}

export interface PromptFieldsResult {
    promptId: string | null;
    promptTitle: string | null;
    fields: PromptFieldRequirement[];
    category: string;
    subcategory?: string;
}

export interface MissingFieldsResult {
    missingFields: PromptFieldRequirement[];
    allFieldsProvided: boolean;
}

// Cached prompt info
interface CachedPromptInfo {
    promptId: string;
    title: string;
    category: string;
    subcategory?: string;
    fields: PromptFieldRequirement[];
    keywords?: string[];
}

// ========== Prompt Cache ==========

let promptCache: CachedPromptInfo[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Scan all prompts from Firestore and cache them
 */
async function refreshPromptCache(): Promise<void> {
    console.log('[PromptFields] Scanning all prompts from Firestore...');

    const snapshot = await getDocs(
        query(collection(db, 'prompts'), where('status', '==', 'active'))
    );

    promptCache = [];

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const { category, subcategory, fields, title, keywords } = data;

        // Map fields to our structure
        const mappedFields: PromptFieldRequirement[] = (fields || []).map((f: PromptField) => ({
            fieldId: f.id,
            label: f.label,
            type: f.type,
            required: f.required,
            options: f.options,
            placeholder: f.placeholder,
            mapToParam: FIELD_TO_PARAM_MAP[f.id] || f.id
        }));

        promptCache.push({
            promptId: doc.id,
            title,
            category,
            subcategory,
            fields: mappedFields,
            keywords
        });
    }

    cacheTimestamp = Date.now();
    console.log(`[PromptFields] Cached ${promptCache.length} prompts from ${new Set(promptCache.map(p => p.category)).size} categories`);
}

/**
 * Get the prompt cache, refreshing if needed
 */
async function getPromptCache(): Promise<CachedPromptInfo[]> {
    if (!promptCache || Date.now() - cacheTimestamp > CACHE_TTL) {
        await refreshPromptCache();
    }
    return promptCache!;
}

/**
 * Get all available categories (for debugging/admin)
 */
export async function getAllPromptCategories(): Promise<string[]> {
    const cache = await getPromptCache();
    return [...new Set(cache.map(p => p.category))];
}

// ========== Content Type to Category Mapping ==========

// Fallback mapping for known capability types
const CONTENT_TYPE_TO_PROMPT_CATEGORY: Record<string, { category: string; subcategory?: string }> = {
    'worksheet': { category: 'דפי עבודה', subcategory: 'דף עבודה להדפסה' },
    'test': { category: 'יצירת מבחנים' },
    'lesson_plan': { category: 'הכנת שיעורים' },
    'lesson_opener': { category: 'הכנת שיעורים', subcategory: 'פתיחת שיעור מעניינת' },
    'letter': { category: 'תקשורת אישית' },
    'feedback': { category: 'תקשורת אישית', subcategory: 'מכתב אישי לתלמיד' },
    'rubric': { category: 'הערכה חלופית', subcategory: 'רובריקה להערכה' },
    'work_plan': { category: 'תכנון ותכניות עבודה' },
    'personal_plan': { category: 'תכנון ותכניות עבודה', subcategory: 'תכנית לימודית אישית' },
    'sel_lesson': { category: 'למידה חברתית-רגשית (SEL)', subcategory: 'מערך שיעור חברתי' },
    'sel_activity': { category: 'למידה חברתית-רגשית (SEL)', subcategory: 'פעילות מיומנויות SEL' },
    'sel_roleplay': { category: 'למידה חברתית-רגשית (SEL)', subcategory: 'משחק תפקידים' },
    'sel_resilience': { category: 'למידה חברתית-רגשית (SEL)', subcategory: 'פעילות אופטימיות וחוסן' }
};

// ========== Hebrew Field to English Param Mapping ==========

const FIELD_TO_PARAM_MAP: Record<string, string> = {
    'מקצוע': 'subject',
    'שכבה': 'grade',
    'נושא': 'topic',
    'רמת_קושי': 'difficultyLevel',
    'מספר_תרגילים': 'questionCount',
    'מספר_שאלות': 'questionCount',
    'פרטים': 'additionalInstructions',
    'משך_שיעור': 'duration',
    'סוג_מבחן': 'testType',
    'שם': 'studentName',
    'הישג': 'achievement',
    'חוזקות': 'strengths',
    'סיבה': 'reason',
    'טון': 'tone',
    'אורך': 'length'
};

// Reverse mapping: English param to Hebrew field
const PARAM_TO_FIELD_MAP: Record<string, string> = Object.fromEntries(
    Object.entries(FIELD_TO_PARAM_MAP).map(([k, v]) => [v, k])
);

// ========== Capability ID to Content Type Mapping ==========

export function mapCapabilityToContentType(capabilityId: string): string | null {
    const mapping: Record<string, string> = {
        // Static content
        'generate_worksheet': 'worksheet',
        'generate_lesson_plan': 'lesson_plan',
        'generate_lesson_opener': 'lesson_opener',
        'generate_letter': 'letter',
        'generate_feedback': 'feedback',
        'generate_rubric': 'rubric',
        'generate_printable_test': 'test',
        // Planning
        'generate_work_plan': 'work_plan',
        'generate_personal_plan': 'personal_plan',
        // SEL
        'generate_sel_lesson': 'sel_lesson',
        'generate_sel_activity': 'sel_activity',
        'generate_sel_roleplay': 'sel_roleplay',
        'generate_sel_resilience': 'sel_resilience'
    };
    return mapping[capabilityId] || null;
}

/**
 * Find a prompt by searching cache with flexible matching
 */
async function findPromptInCache(
    category?: string,
    subcategory?: string,
    keywords?: string[]
): Promise<CachedPromptInfo | null> {
    const cache = await getPromptCache();

    // First try exact category + subcategory match
    if (category && subcategory) {
        const exact = cache.find(p => p.category === category && p.subcategory === subcategory);
        if (exact) return exact;
    }

    // Then try category only
    if (category) {
        const byCategory = cache.find(p => p.category === category);
        if (byCategory) return byCategory;
    }

    // Finally try keyword search
    if (keywords && keywords.length > 0) {
        for (const prompt of cache) {
            const searchText = `${prompt.title} ${prompt.category} ${prompt.subcategory || ''}`.toLowerCase();
            const matches = keywords.some(kw => searchText.includes(kw.toLowerCase()));
            if (matches) return prompt;
        }
    }

    return null;
}

// ========== Main Functions ==========

/**
 * Fetch prompt fields for a given content type (uses cache)
 */
export async function getPromptFieldsForContentType(
    contentType: string
): Promise<PromptFieldsResult> {
    const categoryInfo = CONTENT_TYPE_TO_PROMPT_CATEGORY[contentType];

    if (!categoryInfo) {
        console.warn(`[PromptFields] Unknown content type: ${contentType}, trying keyword search...`);
        // Try to find by keyword
        const prompt = await findPromptInCache(undefined, undefined, [contentType]);
        if (prompt) {
            console.log(`[PromptFields] Found by keyword: "${prompt.title}"`);
            return {
                promptId: prompt.promptId,
                promptTitle: prompt.title,
                fields: prompt.fields,
                category: prompt.category,
                subcategory: prompt.subcategory
            };
        }
        return {
            promptId: null,
            promptTitle: null,
            fields: [],
            category: contentType
        };
    }

    try {
        // Use cache instead of direct Firestore query
        const prompt = await findPromptInCache(
            categoryInfo.category,
            categoryInfo.subcategory
        );

        if (!prompt) {
            console.log(`[PromptFields] No prompt in cache for category: ${categoryInfo.category}`);
            return {
                promptId: null,
                promptTitle: null,
                fields: getDefaultFieldsForContentType(contentType),
                category: categoryInfo.category,
                subcategory: categoryInfo.subcategory
            };
        }

        console.log(`[PromptFields] Found prompt: "${prompt.title}" with ${prompt.fields.length} fields`);

        return {
            promptId: prompt.promptId,
            promptTitle: prompt.title,
            fields: prompt.fields,
            category: prompt.category,
            subcategory: prompt.subcategory
        };

    } catch (error) {
        console.error('[PromptFields] Error fetching prompt fields:', error);
        return {
            promptId: null,
            promptTitle: null,
            fields: getDefaultFieldsForContentType(contentType),
            category: categoryInfo.category,
            subcategory: categoryInfo.subcategory
        };
    }
}

/**
 * Direct search for a prompt by category name (for dynamic capability mapping)
 */
export async function getPromptFieldsByCategory(
    category: string,
    subcategory?: string
): Promise<PromptFieldsResult> {
    try {
        const prompt = await findPromptInCache(category, subcategory);

        if (!prompt) {
            console.log(`[PromptFields] No prompt found for category: ${category}`);
            return {
                promptId: null,
                promptTitle: null,
                fields: [],
                category
            };
        }

        return {
            promptId: prompt.promptId,
            promptTitle: prompt.title,
            fields: prompt.fields,
            category: prompt.category,
            subcategory: prompt.subcategory
        };
    } catch (error) {
        console.error('[PromptFields] Error in getPromptFieldsByCategory:', error);
        return {
            promptId: null,
            promptTitle: null,
            fields: [],
            category
        };
    }
}

/**
 * Get default fields for a content type (fallback if no prompt found)
 */
function getDefaultFieldsForContentType(contentType: string): PromptFieldRequirement[] {
    const defaults: Record<string, PromptFieldRequirement[]> = {
        'worksheet': [
            { fieldId: 'נושא', label: 'נושא', type: 'text', required: true, mapToParam: 'topic' },
            { fieldId: 'שכבה', label: 'כיתה', type: 'select', required: true, options: COMMON_FIELD_OPTIONS.gradeLevels, mapToParam: 'grade' },
            { fieldId: 'מקצוע', label: 'מקצוע', type: 'select', required: true, options: COMMON_FIELD_OPTIONS.subjects, mapToParam: 'subject' }
        ],
        'test': [
            { fieldId: 'נושא', label: 'נושא', type: 'text', required: true, mapToParam: 'topic' },
            { fieldId: 'שכבה', label: 'כיתה', type: 'select', required: true, options: COMMON_FIELD_OPTIONS.gradeLevels, mapToParam: 'grade' },
            { fieldId: 'מקצוע', label: 'מקצוע', type: 'select', required: true, options: COMMON_FIELD_OPTIONS.subjects, mapToParam: 'subject' }
        ],
        'lesson_plan': [
            { fieldId: 'נושא', label: 'נושא', type: 'text', required: true, mapToParam: 'topic' },
            { fieldId: 'שכבה', label: 'כיתה', type: 'select', required: true, options: COMMON_FIELD_OPTIONS.gradeLevels, mapToParam: 'grade' },
            { fieldId: 'מקצוע', label: 'מקצוע', type: 'select', required: true, options: COMMON_FIELD_OPTIONS.subjects, mapToParam: 'subject' }
        ],
        'letter': [
            { fieldId: 'נושא', label: 'נושא המכתב', type: 'text', required: true, mapToParam: 'topic' }
        ],
        'feedback': [
            { fieldId: 'שם', label: 'שם התלמיד', type: 'text', required: false, mapToParam: 'studentName' },
            { fieldId: 'נושא', label: 'הקשר המשוב', type: 'text', required: true, mapToParam: 'context' }
        ],
        'rubric': [
            { fieldId: 'נושא', label: 'סוג המשימה', type: 'text', required: true, mapToParam: 'assignmentType' }
        ]
    };

    return defaults[contentType] || [
        { fieldId: 'נושא', label: 'נושא', type: 'text', required: true, mapToParam: 'topic' }
    ];
}

/**
 * Check which required fields are missing
 */
export function getMissingRequiredFields(
    fields: PromptFieldRequirement[],
    providedParams: Record<string, any>
): MissingFieldsResult {
    const missingFields: PromptFieldRequirement[] = [];

    for (const field of fields) {
        if (!field.required) continue;

        // Check if the param is provided (either by Hebrew field name or English param name)
        const paramValue = providedParams[field.mapToParam] || providedParams[field.fieldId];

        if (!paramValue || (typeof paramValue === 'string' && paramValue.trim() === '')) {
            missingFields.push(field);
        }
    }

    return {
        missingFields,
        allFieldsProvided: missingFields.length === 0
    };
}

/**
 * Build a clarification question for missing fields
 * Strategy: Ask ONE field at a time for clarity, prioritizing the most important
 * Returns the current field being asked so we can capture the response correctly
 */
export function buildClarificationQuestion(
    missingFields: PromptFieldRequirement[]
): { question: string; options?: string[]; currentField?: PromptFieldRequirement } {
    if (missingFields.length === 0) {
        return { question: '' };
    }

    // Priority order for asking fields (most important first)
    const priorityOrder = ['שכבה', 'מקצוע', 'נושא', 'שם', 'רמת_קושי', 'סיבה', 'טון', 'חוזקות', 'אורך', 'משך'];

    // Sort missing fields by priority
    const sortedFields = [...missingFields].sort((a, b) => {
        const aIndex = priorityOrder.indexOf(a.fieldId);
        const bIndex = priorityOrder.indexOf(b.fieldId);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    // Ask about the FIRST (most important) missing field only
    const topField = sortedFields[0];
    const question = buildSingleFieldQuestion(topField);

    // Add count of remaining fields if more than 1
    const remainingCount = missingFields.length - 1;
    const questionWithCount = remainingCount > 0
        ? `${question} (עוד ${remainingCount} פרטים אחר כך)`
        : question;

    return {
        question: questionWithCount,
        options: topField.options?.slice(0, 4),
        currentField: topField  // Return which field we're asking about
    };
}

/**
 * Build a question for a single field
 */
function buildSingleFieldQuestion(field: PromptFieldRequirement): string {
    const questionTemplates: Record<string, string> = {
        // Basic fields
        'שכבה': 'לאיזו כיתה?',
        'מקצוע': 'באיזה מקצוע?',
        'נושא': 'על איזה נושא?',
        'רמת_קושי': 'באיזו רמת קושי?',
        'מספר_תרגילים': 'כמה תרגילים?',
        'מספר_שאלות': 'כמה שאלות?',
        // Letter/feedback fields
        'שם': 'מה שם התלמיד/ה?',
        'חוזקות': 'אילו חוזקות תרצה לציין?',
        'הישג': 'איזה הישג או התקדמות?',
        'סיבה': 'מה הסיבה למכתב?',
        'טון': 'באיזה טון לכתוב?',
        'אורך': 'באיזה אורך?',
        'משך': 'כמה זמן?',
        'פרטים': 'פרטים נוספים?'
    };

    return questionTemplates[field.fieldId] || `מה ${field.label}?`;
}

/**
 * Extract field values from a natural language response
 *
 * When currentField is provided (we asked about ONE specific field),
 * we use the user's response directly as the value for that field.
 */
export function extractFieldValuesFromResponse(
    response: string,
    expectedFields: string[],
    currentField?: { fieldId: string; mapToParam: string; type: string; options?: string[] }
): Record<string, any> {
    const values: Record<string, any> = {};
    const normalized = response.toLowerCase().trim();

    // If we asked about a specific field, capture the response for that field
    if (currentField) {
        const paramName = currentField.mapToParam;

        // For select fields with options, try to match
        if (currentField.type === 'select' && currentField.options) {
            const matchedOption = currentField.options.find(opt =>
                normalized.includes(opt.toLowerCase()) ||
                opt.toLowerCase().includes(normalized)
            );
            if (matchedOption) {
                values[paramName] = matchedOption;
                return values;
            }
        }

        // Special handling for grade
        if (currentField.fieldId === 'שכבה' || paramName === 'grade') {
            const gradeMatch = response.match(/כיתה\s*([א-יב]|[א-ת]'?|[1-9]|1[0-2])/i) ||
                               response.match(/([א-יב])['׳]/) ||
                               response.match(/\b([א-י])\b/);
            if (gradeMatch) {
                values.grade = normalizeGrade(gradeMatch[1]);
                return values;
            }
        }

        // For text fields or unmatched select, use the response directly
        values[paramName] = response.trim();
        return values;
    }

    // Fallback: try to extract multiple fields from a longer response
    // Extract grade (כיתה)
    if (expectedFields.includes('grade') || expectedFields.includes('שכבה')) {
        const gradeMatch = response.match(/כיתה\s*([א-יב]|[א-ת]'?|[1-9]|1[0-2])/i) ||
                           response.match(/([א-יב])['׳]/) ||
                           response.match(/\b([א-ו])\b/);
        if (gradeMatch) {
            values.grade = normalizeGrade(gradeMatch[1]);
        }
    }

    // Extract subject (מקצוע)
    if (expectedFields.includes('subject') || expectedFields.includes('מקצוע')) {
        const subjects = COMMON_FIELD_OPTIONS.subjects;
        for (const subject of subjects) {
            if (normalized.includes(subject.toLowerCase())) {
                values.subject = subject;
                break;
            }
        }
    }

    // Extract difficulty level
    if (expectedFields.includes('difficultyLevel') || expectedFields.includes('רמת_קושי')) {
        if (normalized.includes('קל')) values.difficultyLevel = 'קלה';
        else if (normalized.includes('בינוני')) values.difficultyLevel = 'בינונית';
        else if (normalized.includes('קש') || normalized.includes('מאתגר')) {
            values.difficultyLevel = 'מאתגרת';
        }
    }

    // Extract question count
    if (expectedFields.includes('questionCount') || expectedFields.includes('מספר_שאלות')) {
        const countMatch = response.match(/(\d+)\s*(שאלות|תרגילים)?/);
        if (countMatch) {
            const count = parseInt(countMatch[1], 10);
            if (count >= 1 && count <= 50) {
                values.questionCount = count;
            }
        }
    }

    return values;
}

/**
 * Normalize grade to consistent format
 */
function normalizeGrade(grade: string): string {
    const gradeMap: Record<string, string> = {
        '1': 'א׳', '2': 'ב׳', '3': 'ג׳', '4': 'ד׳', '5': 'ה׳', '6': 'ו׳',
        '7': 'ז׳', '8': 'ח׳', '9': 'ט׳', '10': 'י׳', '11': 'י״א', '12': 'י״ב',
        'א': 'א׳', 'ב': 'ב׳', 'ג': 'ג׳', 'ד': 'ד׳', 'ה': 'ה׳', 'ו': 'ו׳',
        'ז': 'ז׳', 'ח': 'ח׳', 'ט': 'ט׳', 'י': 'י׳'
    };

    const normalized = grade.replace(/['׳]/g, '');
    return gradeMap[normalized] || grade;
}
