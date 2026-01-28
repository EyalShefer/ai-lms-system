/**
 * Smart Creation Service V2
 *
 * Next-generation content creation service with:
 * - Dynamic capability loading via RAG
 * - Gemini Function Calling
 * - Slim context-aware prompts
 * - Automatic tool execution
 */

import { callGeminiJSONFast, type ChatMessage } from '../ProxyService';
import type { Capability } from '../../shared/types/capabilityTypes';
import {
    searchCapabilities,
    generateFunctionDeclarations,
    generateCapabilityContextPrompt,
    type RAGSearchResult
} from './capabilityRAG';
import {
    executeCapability,
    findCapabilityByFunctionName,
    type FunctionCallResult,
    type ExecutorContext
} from './toolExecutor';
import { getCurriculumTopics } from '../curriculumTopicService';
import {
    getPromptFieldsForContentType,
    getMissingRequiredFields,
    buildClarificationQuestion,
    extractFieldValuesFromResponse,
    mapCapabilityToContentType
} from './promptFieldsService';

// ========== Types ==========

export interface SmartResponseV2 {
    type: 'message' | 'function_call' | 'clarification' | 'error';
    message: string;
    functionCall?: FunctionCallResult;
    executionResult?: any;
    quickReplies?: string[];
    matchedCapabilities?: string[];
    contentAnalysis?: {
        mode: 'interactive' | 'static' | 'ambiguous';
    };
    // For prompt-aware flow: track pending execution waiting for more fields
    pendingExecution?: {
        functionName: string;
        collectedParams: Record<string, any>;
        missingFields: string[];
        contentType?: string;
        currentField?: { fieldId: string; mapToParam: string; type: string; options?: string[] };
    };
}

export interface ConversationContext {
    messages: ChatMessage[];
    contentMode?: 'interactive' | 'static' | null;
    collectedParams?: Record<string, any>;
    // For prompt-aware flow: track pending execution waiting for more fields
    pendingExecution?: {
        functionName: string;
        collectedParams: Record<string, any>;
        missingFields: string[];
        contentType?: string;
        currentField?: { fieldId: string; mapToParam: string; type: string; options?: string[] };
    };
}

// ========== Core System Prompt ==========

const SLIM_SYSTEM_PROMPT = `אתה עוזר חכם ליצירת תוכן לימודי בעברית.

## תפקידך
עזור למורים ליצור תכנים לימודיים בצורה קלה ומהירה.

## עקרונות
1. **שפה**: תמיד דבר בעברית טבעית וידידותית
2. **יעילות**: נסה להבין מה המורה רוצה
3. **פעולה מאוזנת**: בצע כשהבקשה ברורה, שאל רק כשבאמת נדרש

## מתי לבצע מיד (ללא שאלות):
- יש נושא ברור: "דף עבודה על כפל" → בצע
- יש נושא + כיתה: "שיעור על מחזור המים לכיתה ה" → בצע
- הנושא מרמז על תחום דעת: כפל = מתמטיקה, מחזור המים = מדעים

## מתי כן לשאול:
- הבקשה עמומה מאוד: "תכין משהו" - צריך לשאול מה
- יש כמה אפשרויות שונות מאוד והמורה לא ציין

## חשוב מאוד - מה לא לעשות:
- אל תשאל "באיזה נושא ספציפי ב-X?" - אם נתנו נושא, זה מספיק
- אל תשאל על תחום דעת כשהנושא מרמז עליו
- אל תשאל על כיתה - זה אופציונלי
- אל תחזור על אותה שאלה פעמיים

## פרמטרים:
- topic (נושא) - **חובה** - אם יש נושא, בצע
- grade (כיתה) - אופציונלי
- subject (תחום דעת) - אופציונלי, הסק מהנושא

## דוגמאות לביצוע מיידי:
- "דף עבודה על כפל לכיתה ג" → topic=כפל, grade=ג, subject=מתמטיקה
- "שיעור על מחזור המים" → topic=מחזור המים, subject=מדעים
- "פעילות על שברים" → topic=שברים, subject=מתמטיקה
`;

// ========== Function Calling Schema ==========

/**
 * Build function declarations for Gemini
 */
function buildFunctionDeclarations(capabilities: Capability[]): any[] {
    return capabilities.map(cap => ({
        name: cap.functionDeclaration.name,
        description: cap.functionDeclaration.description,
        parameters: cap.functionDeclaration.parameters
    }));
}

/**
 * Build clarification function for when AI needs more info
 */
const CLARIFICATION_FUNCTION = {
    name: 'ask_clarification',
    description: 'שאל שאלת הבהרה כשחסר מידע קריטי',
    parameters: {
        type: 'object',
        properties: {
            question: {
                type: 'string',
                description: 'השאלה לשאול'
            },
            options: {
                type: 'array',
                items: { type: 'string' },
                description: 'אפשרויות תשובה מהירות (אופציונלי)'
            },
            missingParam: {
                type: 'string',
                description: 'שם הפרמטר החסר'
            }
        },
        required: ['question']
    }
};

// ========== Content Type Disambiguation ==========

/**
 * Terms that could mean BOTH interactive AND static content
 * When detected (without explicit mode), ask the user to clarify
 */
const AMBIGUOUS_CONTENT_TERMS = [
    'מערך שיעור',
    'שיעור',
    'מבחן',
    'בוחן',
    'פעילות',
    'דף עבודה'
];

/**
 * Keywords that indicate STATIC/printable content
 */
const STATIC_INDICATORS = [
    'להדפסה', 'מודפס', 'PDF', 'pdf', 'וורד', 'Word', 'word',
    'להורדה', 'נייר', 'למורה', 'תכנון'
];

/**
 * Keywords that indicate INTERACTIVE content
 */
const INTERACTIVE_INDICATORS = [
    'אינטראקטיבי', 'דיגיטלי', 'עם שאלות', 'עם תמונות',
    'לתלמידים', 'במערכת', 'אונליין', 'online'
];

/**
 * Check if user message is a response to content type clarification
 * Returns the detected mode, or null if not a response
 */
export function detectContentTypeResponse(message: string): 'interactive' | 'static' | null {
    const normalized = message.toLowerCase();

    // Check for interactive response
    if (normalized.includes('אינטראקטיבי') ||
        normalized.includes('עם תמונות') ||
        normalized.includes('🖥️')) {
        return 'interactive';
    }

    // Check for static/printable response
    if (normalized.includes('להדפסה') ||
        normalized.includes('pdf') ||
        normalized.includes('word') ||
        normalized.includes('📄')) {
        return 'static';
    }

    return null;
}

/**
 * Check if user message requires content type clarification
 * Returns clarification response if ambiguous, null otherwise
 */
function checkContentTypeAmbiguity(
    message: string,
    contentMode: 'interactive' | 'static' | null | undefined
): { question: string; options: string[] } | null {
    // If content mode already set in context, no need to ask
    if (contentMode) {
        return null;
    }

    const normalized = message.toLowerCase();

    // Check if this is a RESPONSE to a content type question
    const detectedMode = detectContentTypeResponse(message);
    if (detectedMode) {
        // User already answered, don't ask again
        return null;
    }

    // Check if message explicitly indicates content type
    const hasStaticIndicator = STATIC_INDICATORS.some(ind => normalized.includes(ind.toLowerCase()));
    const hasInteractiveIndicator = INTERACTIVE_INDICATORS.some(ind => normalized.includes(ind.toLowerCase()));

    // If user specified type, no ambiguity
    if (hasStaticIndicator || hasInteractiveIndicator) {
        return null;
    }

    // Check if message contains ambiguous terms
    const hasAmbiguousTerm = AMBIGUOUS_CONTENT_TERMS.some(term => normalized.includes(term.toLowerCase()));

    if (hasAmbiguousTerm) {
        // Extract what they want to create for personalized question
        let contentType = 'תוכן';
        for (const term of AMBIGUOUS_CONTENT_TERMS) {
            if (normalized.includes(term.toLowerCase())) {
                contentType = term;
                break;
            }
        }

        return {
            question: `איך תרצה את ה${contentType}?`,
            options: [
                '🖥️ אינטראקטיבי - עם תמונות, שאלות ומשוב לתלמידים',
                '📄 להדפסה - PDF או Word להורדה'
            ]
        };
    }

    return null;
}

// ========== Curriculum-Aware Clarification ==========

/**
 * Map of Hebrew keywords to subjects for curriculum lookup
 */
const TOPIC_TO_SUBJECT: Record<string, string> = {
    // מתמטיקה
    'כפל': 'math', 'חילוק': 'math', 'חיבור': 'math', 'חיסור': 'math',
    'שברים': 'math', 'אחוזים': 'math', 'גיאומטריה': 'math', 'מספרים': 'math',
    // מדעים
    'מחזור המים': 'science', 'גוף האדם': 'science', 'בעלי חיים': 'science',
    'צמחים': 'science', 'אנרגיה': 'science', 'חשמל': 'science',
    // עברית
    'פעלים': 'hebrew', 'שמות עצם': 'hebrew', 'תחביר': 'hebrew', 'קריאה': 'hebrew'
};

/**
 * Extract topic keyword from user message
 */
function extractTopicKeyword(message: string): string | null {
    const normalized = message.toLowerCase();
    for (const keyword of Object.keys(TOPIC_TO_SUBJECT)) {
        if (normalized.includes(keyword)) {
            return keyword;
        }
    }
    return null;
}

/**
 * Extract grade from user message (כיתה א-ו)
 */
function extractGrade(message: string): string | null {
    const gradeMatch = message.match(/כיתה\s*([א-ו])/);
    if (gradeMatch) {
        return gradeMatch[1];
    }
    // Also check for "לכיתה ג" pattern
    const gradeMatch2 = message.match(/לכיתה\s*([א-ו])/);
    if (gradeMatch2) {
        return gradeMatch2[1];
    }
    return null;
}

/**
 * Enrich clarification with real curriculum topics
 * Instead of asking "באיזה נושא ספציפי בכפל?" with no options,
 * we fetch the actual curriculum topics and present them
 */
async function enrichClarificationWithCurriculum(
    clarificationArgs: { question: string; options?: string[]; missingParam?: string },
    userMessage: string
): Promise<{ question: string; options: string[] }> {
    const grade = extractGrade(userMessage);
    const topicKeyword = extractTopicKeyword(userMessage);

    // If we have grade and can identify the subject
    if (grade && topicKeyword) {
        const subject = TOPIC_TO_SUBJECT[topicKeyword];
        if (subject) {
            try {
                console.log(`📚 [Curriculum] Fetching topics for grade=${grade}, subject=${subject}`);
                const allTopics = await getCurriculumTopics(grade, subject);

                // Filter topics that relate to the keyword
                const relevantTopics = allTopics.filter(t =>
                    t.toLowerCase().includes(topicKeyword) ||
                    topicKeyword.includes(t.toLowerCase().split(' ')[0])
                );

                if (relevantTopics.length > 0) {
                    console.log(`📚 [Curriculum] Found ${relevantTopics.length} relevant topics`);
                    return {
                        question: `באיזה סוג תרגילי ${topicKeyword} תרצה?`,
                        options: relevantTopics.slice(0, 4) // Max 4 options
                    };
                }

                // If no specific matches, show general topics for the subject
                if (allTopics.length > 0) {
                    console.log(`📚 [Curriculum] Showing ${allTopics.length} general topics`);
                    return {
                        question: `באיזה נושא מתכנית הלימודים תרצה?`,
                        options: allTopics.slice(0, 4)
                    };
                }
            } catch (error) {
                console.warn('📚 [Curriculum] Error fetching topics:', error);
            }
        }
    }

    // Fallback to original clarification
    return {
        question: clarificationArgs.question,
        options: clarificationArgs.options || []
    };
}

// ========== Main Service ==========

/**
 * Analyze teacher intent with function calling
 */
/**
 * Find the original request message from conversation history
 * Skip assistant messages and clarification responses
 */
function findOriginalRequest(context: ConversationContext): string | null {
    // Look through messages in reverse to find the original user request
    const userMessages = context.messages.filter(m => m.role === 'user');

    // Find the first user message that contains a content creation term
    // (not just a clarification response like "אינטראקטיבי")
    for (let i = 0; i < userMessages.length; i++) {
        const msg = userMessages[i].content;
        const isOnlyClarificationResponse = detectContentTypeResponse(msg) !== null &&
            !AMBIGUOUS_CONTENT_TERMS.some(term => msg.includes(term));

        if (!isOnlyClarificationResponse) {
            return msg;
        }
    }
    return null;
}

export async function analyzeIntentV2(
    userMessage: string,
    context: ConversationContext,
    capabilities: Capability[],
    executorContext?: ExecutorContext
): Promise<SmartResponseV2> {
    console.log('🧠 [SmartCreationV2] Analyzing:', userMessage.substring(0, 50) + '...');

    // ===== STEP -1: Handle pending execution (prompt-aware flow) =====
    if (context.pendingExecution) {
        console.log('🔄 [SmartCreationV2] Resuming pending execution:', context.pendingExecution.functionName);

        const { functionName, collectedParams, missingFields, contentType, currentField } = context.pendingExecution;

        // Extract field values from user response, passing the current field we asked about
        const extractedValues = extractFieldValuesFromResponse(userMessage, missingFields, currentField);
        console.log('📥 [SmartCreationV2] Extracted values:', extractedValues);

        // Merge with previously collected params
        const mergedParams = { ...collectedParams, ...extractedValues };

        // Re-check for missing fields
        if (contentType) {
            const promptFields = await getPromptFieldsForContentType(contentType);
            const { missingFields: stillMissing, allFieldsProvided } = getMissingRequiredFields(
                promptFields.fields,
                mergedParams
            );

            if (!allFieldsProvided) {
                // Still missing fields, ask about the next one
                console.log('⚠️ [SmartCreationV2] Still missing fields:', stillMissing.map(f => f.fieldId));
                const clarification = buildClarificationQuestion(stillMissing);
                return {
                    type: 'clarification',
                    message: clarification.question,
                    quickReplies: clarification.options,
                    pendingExecution: {
                        functionName,
                        collectedParams: mergedParams,
                        missingFields: stillMissing.map(f => f.mapToParam),
                        contentType,
                        currentField: clarification.currentField ? {
                            fieldId: clarification.currentField.fieldId,
                            mapToParam: clarification.currentField.mapToParam,
                            type: clarification.currentField.type,
                            options: clarification.currentField.options
                        } : undefined
                    }
                };
            }
        }

        // All fields collected - execute!
        console.log('✅ [SmartCreationV2] All fields collected, executing:', functionName);
        const capability = findCapabilityByFunctionName(functionName, capabilities);

        if (capability && executorContext) {
            const result = await executeCapability(
                { name: functionName, args: mergedParams },
                [capability],
                executorContext
            );

            return {
                type: 'function_call',
                message: result.nextSteps?.message || 'מבצע...',
                functionCall: { name: functionName, args: mergedParams },
                executionResult: result,
                quickReplies: result.nextSteps?.quickReplies,
                matchedCapabilities: [capability.id]
            };
        }
    }

    // ===== STEP 0: Check for content type ambiguity =====
    // First, check if user is responding to a content type question
    const detectedMode = detectContentTypeResponse(userMessage);
    let effectiveContentMode = context.contentMode || detectedMode;

    // If user is responding to clarification, find the original request
    let messageForRAG = userMessage;
    if (detectedMode) {
        console.log(`✅ [SmartCreationV2] User chose content type: ${detectedMode}`);

        // Find the original request from conversation history
        const originalRequest = findOriginalRequest(context);
        if (originalRequest) {
            console.log(`📝 [SmartCreationV2] Using original request for RAG: "${originalRequest.substring(0, 50)}..."`);
            messageForRAG = originalRequest;
        }
    }

    // If user asks for something that could be interactive OR static, ask them first
    const contentTypeAmbiguity = checkContentTypeAmbiguity(userMessage, effectiveContentMode);
    if (contentTypeAmbiguity) {
        console.log('❓ [SmartCreationV2] Content type ambiguous, asking user to clarify');
        return {
            type: 'clarification',
            message: contentTypeAmbiguity.question,
            quickReplies: contentTypeAmbiguity.options,
            contentAnalysis: {
                mode: 'ambiguous' as const
            }
        };
    }

    // Search for relevant capabilities using the appropriate message
    // (original request when responding to clarification, current message otherwise)
    const ragResult = searchCapabilities(messageForRAG, capabilities, {
        maxResults: 5,
        contentMode: effectiveContentMode
    });

    console.log('🔍 [SmartCreationV2] RAG results:', ragResult.capabilities.map(c => c.capability.id));

    // Build dynamic prompt
    const capabilityContext = generateCapabilityContextPrompt(ragResult.capabilities);
    const fullPrompt = `${SLIM_SYSTEM_PROMPT}\n\n${capabilityContext}`;

    // Build function declarations
    const functionDeclarations = [
        ...buildFunctionDeclarations(ragResult.capabilities.map(r => r.capability)),
        CLARIFICATION_FUNCTION
    ];

    // Build conversation messages
    const messages: ChatMessage[] = [
        { role: 'user' as const, content: fullPrompt },
        ...context.messages.slice(-6), // Keep last 6 messages for context
        { role: 'user' as const, content: userMessage }
    ];

    // Call Gemini with function calling
    try {
        const response = await callGeminiWithFunctions(messages, functionDeclarations);

        // Handle the response
        if (response.functionCall) {
            console.log('🔧 [SmartCreationV2] Function call:', response.functionCall.name);

            // Handle clarification - enrich with curriculum topics when available
            if (response.functionCall.name === 'ask_clarification') {
                const enriched = await enrichClarificationWithCurriculum(
                    response.functionCall.args,
                    userMessage
                );
                return {
                    type: 'clarification',
                    message: enriched.question,
                    quickReplies: enriched.options,
                    matchedCapabilities: ragResult.capabilities.map(c => c.capability.id)
                };
            }

            // ===== PROMPT-AWARE CHECK: Verify all required fields before execution =====
            const capability = findCapabilityByFunctionName(
                response.functionCall.name,
                ragResult.capabilities.map(r => r.capability)
            );

            if (capability?.category === 'static_content') {
                const contentType = mapCapabilityToContentType(capability.id);

                if (contentType) {
                    console.log('📋 [SmartCreationV2] Checking prompt fields for:', contentType);

                    const promptFields = await getPromptFieldsForContentType(contentType);
                    const { missingFields, allFieldsProvided } = getMissingRequiredFields(
                        promptFields.fields,
                        response.functionCall.args
                    );

                    if (!allFieldsProvided) {
                        console.log('⚠️ [SmartCreationV2] Missing required fields:', missingFields.map(f => f.fieldId));

                        const clarification = buildClarificationQuestion(missingFields);
                        return {
                            type: 'clarification',
                            message: clarification.question,
                            quickReplies: clarification.options,
                            matchedCapabilities: [capability.id],
                            pendingExecution: {
                                functionName: response.functionCall.name,
                                collectedParams: response.functionCall.args,
                                missingFields: missingFields.map(f => f.mapToParam),
                                contentType,
                                currentField: clarification.currentField ? {
                                    fieldId: clarification.currentField.fieldId,
                                    mapToParam: clarification.currentField.mapToParam,
                                    type: clarification.currentField.type,
                                    options: clarification.currentField.options
                                } : undefined
                            }
                        };
                    }

                    console.log('✅ [SmartCreationV2] All prompt fields provided');
                }
            }

            // Execute the capability
            if (executorContext) {
                const result = await executeCapability(
                    response.functionCall,
                    ragResult.capabilities.map(r => r.capability),
                    executorContext
                );

                return {
                    type: 'function_call',
                    message: result.nextSteps?.message || 'מבצע...',
                    functionCall: response.functionCall,
                    executionResult: result,
                    quickReplies: result.nextSteps?.quickReplies,
                    matchedCapabilities: ragResult.capabilities.map(c => c.capability.id)
                };
            }

            // Return function call without execution
            return {
                type: 'function_call',
                message: `מבצע: ${response.functionCall.name}`,
                functionCall: response.functionCall,
                matchedCapabilities: ragResult.capabilities.map(c => c.capability.id)
            };
        }

        // Regular text response
        return {
            type: 'message',
            message: response.text || 'איך אפשר לעזור?',
            quickReplies: extractQuickReplies(response.text || ''),
            matchedCapabilities: ragResult.capabilities.map(c => c.capability.id)
        };

    } catch (error: any) {
        console.error('❌ [SmartCreationV2] Error:', error);
        return {
            type: 'error',
            message: 'סליחה, משהו השתבש. אפשר לנסות שוב?'
        };
    }
}

// ========== Gemini Function Calling ==========

interface GeminiResponse {
    text?: string;
    functionCall?: FunctionCallResult;
}

/**
 * Call Gemini with function declarations
 */
async function callGeminiWithFunctions(
    messages: ChatMessage[],
    functionDeclarations: any[]
): Promise<GeminiResponse> {
    // Build system prompt with function declarations
    const systemPrompt = messages[0]?.content || '';
    const functionInstructions = `
${systemPrompt}

### פונקציות זמינות:
${JSON.stringify(functionDeclarations, null, 2)}

### הוראות:
- אם יש מספיק מידע לביצוע פעולה, החזר JSON בפורמט:
  {"function_call": {"name": "שם_הפונקציה", "args": {...}}}
- אם חסר מידע קריטי, השתמש בפונקציה ask_clarification
- אם זו שאלה כללית או שיחה, החזר JSON בפורמט:
  {"text": "התשובה שלך"}
`;

    // Build messages array for the API
    const apiMessages: ChatMessage[] = [
        { role: 'user' as const, content: functionInstructions },
        ...messages.slice(1) // Include conversation history
    ];

    try {
        // Call Gemini with messages array
        const result = await callGeminiJSONFast(apiMessages, {
            temperature: 0.3,
            maxTokens: 1000
        });

        // Parse the response
        if (typeof result === 'object') {
            if (result.function_call) {
                return {
                    functionCall: {
                        name: result.function_call.name,
                        args: result.function_call.args || {}
                    }
                };
            }
            if (result.text) {
                return { text: result.text };
            }
        }

        // Fallback - treat as text
        return { text: JSON.stringify(result) };

    } catch (error) {
        console.error('Gemini call error:', error);
        throw error;
    }
}

// ========== Utilities ==========

/**
 * Extract quick replies from AI response text
 */
function extractQuickReplies(text: string): string[] {
    // Look for bullet points or numbered lists
    const quickReplies: string[] = [];

    // Pattern: "• option" or "- option" or "1. option"
    const patterns = [
        /[•\-]\s*(.+?)(?:\n|$)/g,
        /\d+\.\s*(.+?)(?:\n|$)/g
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const option = match[1].trim();
            if (option.length > 2 && option.length < 50) {
                quickReplies.push(option);
            }
        }
    }

    // Return up to 4 options
    return quickReplies.slice(0, 4);
}

/**
 * Simple intent classification for quick routing
 */
export function quickClassifyIntent(message: string): {
    isCreationRequest: boolean;
    isQuestion: boolean;
    isGreeting: boolean;
    suggestedAction?: string;
} {
    const normalized = message.toLowerCase();

    const creationKeywords = [
        'צור', 'בנה', 'הכן', 'תכין', 'תיצור', 'תעשה',
        'שיעור', 'פעילות', 'מבחן', 'דף עבודה', 'מכתב'
    ];

    const questionKeywords = [
        'מה', 'איך', 'למה', 'מתי', 'איפה', 'האם', 'כמה'
    ];

    const greetingKeywords = [
        'שלום', 'היי', 'בוקר טוב', 'ערב טוב', 'מה נשמע'
    ];

    const isCreationRequest = creationKeywords.some(k => normalized.includes(k));
    const isQuestion = questionKeywords.some(k => normalized.startsWith(k));
    const isGreeting = greetingKeywords.some(k => normalized.includes(k));

    return {
        isCreationRequest,
        isQuestion,
        isGreeting,
        suggestedAction: isCreationRequest ? 'create' : isQuestion ? 'answer' : 'chat'
    };
}
