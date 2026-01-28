/**
 * Tool Executor Service V2
 *
 * Executes capabilities based on Gemini function calls.
 * Includes Zod validation and error recovery with Hebrew fallback messages.
 */

import type {
    Capability,
    CapabilityExecutionRequest,
    CapabilityExecutionResult
} from '../../shared/types/capabilityTypes';
import { functions } from '../../gemini';
import { auth } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { validateCapabilityParams, getMissingRequiredFields } from '../../shared/validation/capabilitySchemas';
import { updateRecentUsage } from './userContextService';

// ========== Types ==========

export interface FunctionCallResult {
    name: string;
    args: Record<string, any>;
}

export interface ExecutorContext {
    userId?: string;
    conversationId?: string;
    capabilities: Map<string, Capability>;
    onWizardTrigger?: (wizardData: any) => void;
    onStaticContentGenerated?: (content: any) => void;
    onError?: (error: ErrorRecoveryResult) => void;
}

// ========== Error Recovery ==========

export interface ErrorRecoveryResult {
    code: string;
    userMessage: string;        // Hebrew message for the user
    technicalMessage: string;   // English message for logs
    suggestion?: string;        // Suggested action
    quickReplies?: string[];    // Quick recovery options
}

/**
 * Hebrew error messages for different error types
 */
const ERROR_MESSAGES: Record<string, ErrorRecoveryResult> = {
    CAPABILITY_NOT_FOUND: {
        code: 'CAPABILITY_NOT_FOUND',
        userMessage: 'סליחה, לא הצלחתי להבין מה ביקשת. אפשר לנסות לנסח אחרת?',
        technicalMessage: 'Capability not found for function call',
        suggestion: 'נסה לבקש בצורה ברורה יותר',
        quickReplies: ['צור שיעור', 'צור פעילות', 'צור מבחן']
    },
    VALIDATION_ERROR: {
        code: 'VALIDATION_ERROR',
        userMessage: 'חסרים פרטים. על מה תרצה שאצור תוכן?',
        technicalMessage: 'Parameter validation failed',
        suggestion: 'ציין נושא ברור',
        quickReplies: ['צור שיעור על שברים', 'צור פעילות על פעלים']
    },
    MISSING_TOPIC: {
        code: 'MISSING_TOPIC',
        userMessage: 'על איזה נושא תרצה שאצור את התוכן?',
        technicalMessage: 'Required topic parameter is missing',
        quickReplies: ['שברים', 'מחזור המים', 'פעלים בעברית']
    },
    API_ERROR: {
        code: 'API_ERROR',
        userMessage: 'משהו השתבש בתהליך היצירה. נסה שוב בעוד רגע.',
        technicalMessage: 'API call failed',
        suggestion: 'נסה שוב',
        quickReplies: ['נסה שוב', 'צור משהו אחר']
    },
    AUTH_ERROR: {
        code: 'AUTH_ERROR',
        userMessage: 'צריך להתחבר מחדש. רענן את הדף ונסה שוב.',
        technicalMessage: 'User not authenticated',
        suggestion: 'רענן את הדף'
    },
    RATE_LIMIT: {
        code: 'RATE_LIMIT',
        userMessage: 'יצרת הרבה תכנים בזמן האחרון. נסה שוב עוד כמה דקות.',
        technicalMessage: 'Rate limit exceeded',
        suggestion: 'המתן מספר דקות'
    },
    UNKNOWN: {
        code: 'UNKNOWN',
        userMessage: 'אופס, משהו לא עבד. נסה שוב או בקש משהו אחר.',
        technicalMessage: 'Unknown error occurred',
        quickReplies: ['נסה שוב', 'צור שיעור', 'צור פעילות']
    }
};

/**
 * Get error recovery result with Hebrew message
 */
function getErrorRecovery(code: string, details?: string): ErrorRecoveryResult {
    const baseError = ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN;
    return {
        ...baseError,
        technicalMessage: details || baseError.technicalMessage
    };
}

// ========== Capability Lookup ==========

/**
 * Find capability by function name
 */
export function findCapabilityByFunctionName(
    functionName: string,
    capabilities: Capability[]
): Capability | undefined {
    return capabilities.find(
        cap => cap.functionDeclaration.name === functionName
    );
}

// ========== Parameter Preprocessing ==========

/**
 * Preprocess parameters before execution
 * Handles default values, validation, and transformation
 */
function preprocessParameters(
    params: Record<string, any>,
    capability: Capability
): Record<string, any> {
    const processed: Record<string, any> = { ...params };

    // Apply defaults for missing required parameters
    for (const [paramName, paramDef] of Object.entries(capability.parameters)) {
        if (!(paramName in processed) && paramDef.defaultValue !== undefined) {
            processed[paramName] = paramDef.defaultValue;
        }
    }

    // Validate and transform
    for (const [paramName, paramDef] of Object.entries(capability.parameters)) {
        const value = processed[paramName];
        if (value === undefined) continue;

        // Type coercion
        if (paramDef.type === 'number' && typeof value === 'string') {
            processed[paramName] = parseFloat(value);
        } else if (paramDef.type === 'boolean' && typeof value === 'string') {
            processed[paramName] = value === 'true' || value === 'כן';
        }

        // Validation
        if (paramDef.validationRules) {
            const rules = paramDef.validationRules;
            if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
                throw new Error(`${paramName} must be at least ${rules.minLength} characters`);
            }
            if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
                throw new Error(`${paramName} must be at most ${rules.maxLength} characters`);
            }
            if (rules.min && typeof value === 'number' && value < rules.min) {
                throw new Error(`${paramName} must be at least ${rules.min}`);
            }
            if (rules.max && typeof value === 'number' && value > rules.max) {
                throw new Error(`${paramName} must be at most ${rules.max}`);
            }
        }
    }

    return processed;
}

// ========== Execution Handlers ==========

/**
 * Execute a wizard-type capability
 */
async function executeWizardCapability(
    capability: Capability,
    params: Record<string, any>,
    context: ExecutorContext
): Promise<CapabilityExecutionResult> {
    console.log(`🧙 [ToolExecutor] Triggering wizard: ${capability.execution.wizardComponent}`);

    // Build wizard data from parameters
    const wizardData: Record<string, any> = {
        productType: capability.execution.wizardMode,
        topic: params.topic,
        grade: params.grade,
        subject: params.subject,
        activityLength: params.activityLength || 'medium',
        difficultyLevel: params.difficultyLevel || 'core',
        profile: params.profile || 'balanced',
        includeBot: params.includeBot ?? true,
        // Additional params
        questionCount: params.questionCount,
        customQuestionTypes: params.questionTypes
    };

    // Add micro-activity specific params
    if (capability.id === 'create_micro_activity') {
        wizardData.activityType = params.activityType;
        wizardData.itemCount = params.itemCount || 6;
        wizardData.sourceType = params.sourceType || 'topic';
    }

    // Trigger wizard callback if provided
    if (context.onWizardTrigger) {
        context.onWizardTrigger(wizardData);
    }

    return {
        success: true,
        capabilityId: capability.id,
        result: {
            action: 'wizard_triggered',
            wizardData
        },
        nextSteps: {
            message: `מצוין! מעבירים ליצירת ${capability.name}...`,
            quickReplies: ['בטל', 'שנה הגדרות']
        }
    };
}

/**
 * Execute a direct API capability
 */
async function executeApiCapability(
    capability: Capability,
    params: Record<string, any>,
    context: ExecutorContext
): Promise<CapabilityExecutionResult> {
    const startTime = Date.now();

    try {
        const endpoint = capability.execution.apiEndpoint;
        if (!endpoint) {
            throw new Error('API endpoint not defined for capability');
        }

        console.log(`📡 [ToolExecutor] Calling API: ${endpoint}`);

        // Get auth token
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }
        const idToken = await user.getIdToken();

        // Determine request body based on capability
        let requestBody: any;

        // Special handling for static content
        if (capability.category === 'static_content') {
            requestBody = {
                contentType: mapCapabilityToContentType(capability.id),
                topic: params.topic,
                grade: params.grade,
                subject: params.subject,
                additionalInstructions: buildAdditionalInstructions(params, capability)
            };
        } else {
            requestBody = params;
        }

        // Make the API call
        const response = await fetch(
            `https://us-central1-ai-lms-pro.cloudfunctions.net/${endpoint}`,
            {
                method: capability.execution.apiMethod || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        const executionTime = Date.now() - startTime;

        console.log(`✅ [ToolExecutor] API call successful (${executionTime}ms)`);

        // Trigger callback if provided
        if (capability.category === 'static_content' && context.onStaticContentGenerated) {
            context.onStaticContentGenerated(result.data);
        }

        return {
            success: true,
            capabilityId: capability.id,
            result: result.data,
            executionTime,
            nextSteps: {
                message: `✅ ${capability.name} הושלם!`,
                quickReplies: capability.ui.quickRepliesAfter || ['צור עוד', 'סיום']
            }
        };

    } catch (error: any) {
        console.error(`❌ [ToolExecutor] API call failed:`, error);
        return {
            success: false,
            capabilityId: capability.id,
            error: {
                code: 'API_ERROR',
                message: error.message
            }
        };
    }
}

/**
 * Execute a callable function capability
 */
async function executeCallableCapability(
    capability: Capability,
    params: Record<string, any>,
    context: ExecutorContext
): Promise<CapabilityExecutionResult> {
    const startTime = Date.now();

    try {
        const endpoint = capability.execution.apiEndpoint;
        if (!endpoint) {
            throw new Error('API endpoint not defined for capability');
        }

        console.log(`📞 [ToolExecutor] Calling function: ${endpoint}`);

        const callableFn = httpsCallable(functions, endpoint);
        const result: any = await callableFn(params);
        const executionTime = Date.now() - startTime;

        console.log(`✅ [ToolExecutor] Function call successful (${executionTime}ms)`);

        return {
            success: result.data?.success ?? true,
            capabilityId: capability.id,
            result: result.data,
            executionTime,
            nextSteps: {
                quickReplies: capability.ui.quickRepliesAfter
            }
        };

    } catch (error: any) {
        console.error(`❌ [ToolExecutor] Function call failed:`, error);
        return {
            success: false,
            capabilityId: capability.id,
            error: {
                code: 'FUNCTION_ERROR',
                message: error.message
            }
        };
    }
}

// ========== Helper Functions ==========

/**
 * Map capability ID to static content type
 */
function mapCapabilityToContentType(capabilityId: string): string {
    const mapping: Record<string, string> = {
        'generate_worksheet': 'worksheet',
        'generate_lesson_plan': 'lesson_plan',
        'generate_letter': 'letter',
        'generate_feedback': 'feedback',
        'generate_rubric': 'rubric',
        'generate_printable_test': 'test'
    };
    return mapping[capabilityId] || 'custom';
}

/**
 * Build additional instructions from parameters
 */
function buildAdditionalInstructions(
    params: Record<string, any>,
    capability: Capability
): string {
    const instructions: string[] = [];

    // Add capability-specific instructions
    if (params.questionCount) {
        instructions.push(`מספר שאלות: ${params.questionCount}`);
    }
    if (params.duration) {
        instructions.push(`זמן: ${params.duration} דקות`);
    }
    if (params.includeAnswerKey === false) {
        instructions.push('ללא מפתח תשובות');
    }
    if (params.tone) {
        instructions.push(`טון: ${params.tone}`);
    }
    if (params.letterType) {
        instructions.push(`סוג מכתב: ${params.letterType}`);
    }
    if (params.criteria && Array.isArray(params.criteria)) {
        instructions.push(`קריטריונים: ${params.criteria.join(', ')}`);
    }

    return instructions.join('. ');
}

// ========== Main Executor ==========

/**
 * Execute a capability based on function call
 * Includes Zod validation and error recovery
 */
export async function executeCapability(
    functionCall: FunctionCallResult,
    capabilities: Capability[],
    context: ExecutorContext
): Promise<CapabilityExecutionResult> {
    console.log(`[ToolExecutor] Executing: ${functionCall.name}`);
    console.log(`[ToolExecutor] Args:`, functionCall.args);

    // Find the capability
    const capability = findCapabilityByFunctionName(functionCall.name, capabilities);
    if (!capability) {
        const errorRecovery = getErrorRecovery('CAPABILITY_NOT_FOUND', functionCall.name);
        context.onError?.(errorRecovery);
        return {
            success: false,
            capabilityId: functionCall.name,
            error: {
                code: errorRecovery.code,
                message: errorRecovery.userMessage
            },
            nextSteps: {
                message: errorRecovery.userMessage,
                quickReplies: errorRecovery.quickReplies
            }
        };
    }

    // Step 1: Zod validation
    const zodValidation = validateCapabilityParams(capability.id, functionCall.args);
    if (!zodValidation.success) {
        console.warn(`[ToolExecutor] Zod validation failed:`, zodValidation.errors);

        // Check if topic is missing specifically
        const missingFields = getMissingRequiredFields(capability.id, functionCall.args);
        if (missingFields.includes('topic')) {
            const errorRecovery = getErrorRecovery('MISSING_TOPIC');
            context.onError?.(errorRecovery);
            return {
                success: false,
                capabilityId: capability.id,
                error: {
                    code: errorRecovery.code,
                    message: errorRecovery.userMessage
                },
                nextSteps: {
                    message: errorRecovery.userMessage,
                    quickReplies: errorRecovery.quickReplies
                }
            };
        }

        const errorRecovery = getErrorRecovery('VALIDATION_ERROR', zodValidation.errors?.join(', '));
        context.onError?.(errorRecovery);
        return {
            success: false,
            capabilityId: capability.id,
            error: {
                code: errorRecovery.code,
                message: errorRecovery.userMessage
            },
            nextSteps: {
                message: errorRecovery.userMessage,
                quickReplies: errorRecovery.quickReplies
            }
        };
    }

    // Step 2: Preprocess parameters (apply defaults, type coercion)
    let processedParams: Record<string, any>;
    try {
        processedParams = preprocessParameters(zodValidation.data || functionCall.args, capability);
    } catch (error: any) {
        const errorRecovery = getErrorRecovery('VALIDATION_ERROR', error.message);
        context.onError?.(errorRecovery);
        return {
            success: false,
            capabilityId: capability.id,
            error: {
                code: errorRecovery.code,
                message: errorRecovery.userMessage
            },
            nextSteps: {
                message: errorRecovery.userMessage,
                quickReplies: errorRecovery.quickReplies
            }
        };
    }

    // Step 3: Execute based on type
    let result: CapabilityExecutionResult;

    switch (capability.execution.type) {
        case 'wizard':
            result = await executeWizardCapability(capability, processedParams, context);
            break;

        case 'direct_api':
            result = await executeApiCapability(capability, processedParams, context);
            break;

        case 'prompt_based':
            result = await executeApiCapability(capability, processedParams, context);
            break;

        case 'hybrid':
            if (processedParams._useWizard) {
                result = await executeWizardCapability(capability, processedParams, context);
            } else {
                result = await executeApiCapability(capability, processedParams, context);
            }
            break;

        default:
            const errorRecovery = getErrorRecovery('UNKNOWN', `Unknown execution type: ${capability.execution.type}`);
            context.onError?.(errorRecovery);
            return {
                success: false,
                capabilityId: capability.id,
                error: {
                    code: errorRecovery.code,
                    message: errorRecovery.userMessage
                }
            };
    }

    // Step 4: Update user context on success
    if (result.success) {
        updateRecentUsage({
            topic: processedParams.topic,
            grade: processedParams.grade,
            subject: processedParams.subject
        }).catch(err => console.warn('[ToolExecutor] Failed to update user context:', err));
    }

    return result;
}

/**
 * Execute multiple function calls in sequence
 */
export async function executeMultipleCapabilities(
    functionCalls: FunctionCallResult[],
    capabilities: Capability[],
    context: ExecutorContext
): Promise<CapabilityExecutionResult[]> {
    const results: CapabilityExecutionResult[] = [];

    for (const functionCall of functionCalls) {
        const result = await executeCapability(functionCall, capabilities, context);
        results.push(result);

        // Stop if any fails (unless it's expected to continue)
        if (!result.success) {
            console.warn(`⚠️ [ToolExecutor] Execution stopped due to error:`, result.error);
            break;
        }
    }

    return results;
}
