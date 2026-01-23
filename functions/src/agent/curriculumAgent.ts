/**
 * Curriculum Agent
 *
 * An autonomous agent that generates educational activities using Gemini.
 * The agent uses tools to interact with the existing pipeline, ensuring
 * all content is created according to the system's rules and constraints.
 *
 * Key principle: The agent orchestrates the existing pipeline - it does NOT
 * create content directly. All content goes through:
 * - Exam Architect (structure/skeleton)
 * - Exam Generator (content with linguistic constraints)
 * - Exam Guardian (quality validation)
 *
 * ============================================================
 * IMPORTANT: Uses the same Gemini model as the rest of the system
 * See AI_MODELS_POLICY.md for approved models.
 * Model: gemini-3-pro-preview
 * ============================================================
 */

import { GoogleGenAI, Type } from '@google/genai';
import * as logger from 'firebase-functions/logger';
import { MCPToolImplementations, MCPToolSchemas, executeToolCall } from './mcpTools';
import type {
    ActivityGenerationRequest,
    GenerationResult,
    AgentConfig
} from '../services/activityBank/types';

// Use the same model as the rest of the system
const GEMINI_MODEL = 'gemini-3-pro-preview';

// ============================================
// Agent System Prompt
// ============================================

function buildSystemPrompt(request: ActivityGenerationRequest): string {
    const subjectHebrew = request.subject === 'hebrew' ? 'עברית (חינוך לשוני)' : 'מדע וטכנולוגיה';
    const gradeHebrew = request.gradeLevel === 'ה' ? "ה'" : "ו'";

    return `אתה סוכן אוטונומי מומחה ביצירת פעילויות לימודיות איכותיות לתלמידי בית הספר היסודי בישראל.

## המשימה שלך
צור ${request.activityCount} פעילויות לימודיות איכותיות.

## פרטי המשימה
- מקצוע: ${subjectHebrew}
- כיתה: ${gradeHebrew}
- נושא: ${request.topic || 'לפי תוכנית הלימודים'}
- רמות בלום נדרשות: ${request.bloomLevels.join(', ')}

## עקרונות מנחים

### 1. איכות מעל כמות
- כל פעילות חייבת לעבור Guardian עם ציון 80 ומעלה
- עדיף פעילות אחת מעולה על 5 בינוניות
- אם פעילות לא עוברת, נסה לשפר או ליצור מחדש

### 2. התאמה לתוכנית הלימודים
- כל פעילות חייבת להתבסס על תקן תוכ"ל (curriculum standard)
- השתמש ב-load_curriculum_standards תחילה

### 3. מניעת כפילויות
- לפני יצירת פעילות, בדוק שאין דומה במאגר
- השתמש ב-search_existing_activities

### 4. מגוון
- הקפד על מגוון סוגי פעילויות (multiple-choice, fill_in_blanks, ordering, categorization, matching)
- הקפד על מגוון ברמות בלום

## זרימת עבודה לכל פעילות

1. **טעינת תקן תוכ"ל**
   - load_curriculum_standards → קבל תקנים רלוונטיים
   - בחר תקן מתאים לפעילות הבאה

2. **בדיקת כפילויות**
   - search_existing_activities → בדוק שאין פעילות דומה
   - אם יש, עבור לנושא/סוג אחר

3. **יצירת שלד**
   - generate_activity_skeleton → צור מבנה הפעילות
   - השתמש בתקן שנבחר

4. **יצירת תוכן**
   - generate_activity_content → צור תוכן מלא
   - זה עובר דרך ה-Pipeline עם כל האילוצים הלשוניים

5. **בדיקת איכות**
   - validate_activity → בדוק איכות עם Guardian
   - אם ציון < 60: נסה מחדש עם פרמטרים שונים
   - אם ציון 60-79: שפר ונסה שוב (עד 2 ניסיונות)
   - אם ציון >= 80: המשך לשמירה

6. **שמירה למאגר**
   - save_to_activity_bank → שמור את הפעילות
   - רק אם ציון >= 60

## חשוב לזכור
- אתה לא יוצר תוכן ישירות - הכל עובר דרך ה-Pipeline הקיים
- כל הכללים הלשוניים, בדיקות ההטיות, ובדיקות הנגישות נאכפים אוטומטית
- התפקיד שלך הוא לתזמר את התהליך ולהבטיח איכות

## סיום
אחרי שיצרת את כל הפעילויות (או הגעת למגבלת הזמן), סכם את התוצאות.`;
}

function buildUserMessage(request: ActivityGenerationRequest): string {
    const subjectHebrew = request.subject === 'hebrew' ? 'עברית' : 'מדעים';

    return `התחל ליצור ${request.activityCount} פעילויות לימודיות.

מקצוע: ${subjectHebrew}
כיתה: ${request.gradeLevel}
${request.topic ? `נושא ספציפי: ${request.topic}` : 'נושא: לפי תוכנית הלימודים'}
${request.activityTypes ? `סוגי פעילויות מועדפים: ${request.activityTypes.join(', ')}` : ''}
רמות בלום: ${request.bloomLevels.join(', ')}

התחל בטעינת תקני תוכנית הלימודים הרלוונטיים.`;
}

// ============================================
// Convert MCP Tool Schemas to Gemini Format
// ============================================

function convertToGeminiTools() {
    return MCPToolSchemas.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: {
            type: Type.OBJECT,
            properties: Object.fromEntries(
                Object.entries(tool.input_schema.properties || {}).map(([key, value]: [string, any]) => [
                    key,
                    {
                        type: value.type === 'string' ? Type.STRING :
                              value.type === 'number' ? Type.NUMBER :
                              value.type === 'boolean' ? Type.BOOLEAN :
                              value.type === 'array' ? Type.ARRAY :
                              Type.OBJECT,
                        description: value.description,
                        ...(value.enum ? { enum: value.enum } : {}),
                        ...(value.items ? { items: { type: Type.STRING } } : {})
                    }
                ])
            ),
            required: tool.input_schema.required || []
        }
    }));
}

// ============================================
// Curriculum Agent Class
// ============================================

export class CurriculumAgent {
    private client: GoogleGenAI;
    private tools: MCPToolImplementations;
    private config: AgentConfig;

    constructor(config: AgentConfig) {
        this.config = config;

        const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is required for CurriculumAgent');
        }

        this.client = new GoogleGenAI({ apiKey });
        this.tools = new MCPToolImplementations(config.openaiApiKey);
    }

    /**
     * Main entry point - generate activities based on request
     */
    async generateActivities(request: ActivityGenerationRequest): Promise<GenerationResult> {
        const startTime = Date.now();

        const results: GenerationResult = {
            activitiesCreated: 0,
            activityIds: [],
            qualityScores: [],
            errors: [],
            totalTimeMs: 0
        };

        try {
            logger.info('🤖 Curriculum Agent: Starting activity generation', {
                subject: request.subject,
                gradeLevel: request.gradeLevel,
                activityCount: request.activityCount,
                model: GEMINI_MODEL
            });

            // Build prompts
            const systemPrompt = buildSystemPrompt(request);
            const userMessage = buildUserMessage(request);

            // Convert tools to Gemini format
            const geminiTools = convertToGeminiTools();

            // Initialize conversation history
            const history: Array<{ role: 'user' | 'model', parts: any[] }> = [];

            let iteration = 0;
            let currentMessage = userMessage;

            // Agentic loop
            while (iteration < this.config.maxIterations) {
                iteration++;

                // Check timeout
                const elapsed = Date.now() - startTime;
                if (elapsed > this.config.timeoutMs) {
                    logger.warn(`Agent timeout reached after ${iteration} iterations`);
                    results.errors.push('Agent timeout reached');
                    break;
                }

                // Check if we've created enough activities
                if (results.activitiesCreated >= request.activityCount) {
                    logger.info(`Target activity count reached: ${results.activitiesCreated}`);
                    break;
                }

                logger.info(`Agent iteration ${iteration}/${this.config.maxIterations}`);

                // Call Gemini with function calling
                const response = await this.client.models.generateContent({
                    model: GEMINI_MODEL,
                    contents: [
                        ...history,
                        { role: 'user', parts: [{ text: currentMessage }] }
                    ],
                    config: {
                        systemInstruction: systemPrompt,
                        tools: [{ functionDeclarations: geminiTools }],
                        maxOutputTokens: 4096
                    }
                });

                const candidate = response.candidates?.[0];
                if (!candidate) {
                    logger.warn('No candidate in Gemini response, retrying...');
                    currentMessage = 'לא התקבלה תשובה. המשך ליצור פעילויות.';
                    continue;
                }

                const content = candidate.content;
                if (!content || !content.parts) {
                    logger.warn('No content parts in Gemini response, retrying...');
                    currentMessage = 'לא התקבל תוכן. המשך ליצור פעילויות.';
                    continue;
                }

                // Check for function calls
                const functionCalls = content.parts.filter(part => part.functionCall);

                if (functionCalls.length === 0) {
                    // No function calls - agent is done or providing text response
                    const textParts = content.parts.filter(part => part.text);
                    if (textParts.length > 0) {
                        logger.info('Agent completed with text response');
                    }
                    break;
                }

                // Add user message and model response to history
                history.push({ role: 'user', parts: [{ text: currentMessage }] });
                history.push({ role: 'model', parts: content.parts });

                // Process function calls
                const functionResponses: any[] = [];

                for (const part of functionCalls) {
                    const functionCall = part.functionCall!;
                    const toolName = functionCall.name;
                    const toolArgs = functionCall.args || {};

                    try {
                        logger.info(`Executing tool: ${toolName}`, { args: toolArgs });

                        const result = await executeToolCall(
                            this.tools,
                            toolName,
                            toolArgs
                        );

                        // Track successful saves
                        if (toolName === 'save_to_activity_bank' && result.success) {
                            results.activitiesCreated++;
                            results.activityIds.push(result.activityId);

                            if (toolArgs.qualityScore) {
                                results.qualityScores.push(toolArgs.qualityScore as number);
                            }

                            logger.info(`✅ Activity saved: ${result.activityId}`);
                        }

                        functionResponses.push({
                            functionResponse: {
                                name: toolName,
                                response: { result: JSON.stringify(result) }
                            }
                        });

                    } catch (error: any) {
                        logger.error(`Tool error: ${toolName}`, error);

                        functionResponses.push({
                            functionResponse: {
                                name: toolName,
                                response: { error: error.message || 'Tool execution failed' }
                            }
                        });
                    }
                }

                // Add function responses to history with role: 'user'
                // Per Gemini API docs: function responses must use 'user' role, not 'model'
                history.push({ role: 'user', parts: functionResponses });
                currentMessage = 'המשך בתהליך יצירת הפעילויות על סמך התוצאות שקיבלת.';
            }

            results.totalTimeMs = Date.now() - startTime;

            logger.info('🎉 Curriculum Agent: Generation complete', {
                activitiesCreated: results.activitiesCreated,
                iterations: iteration,
                totalTimeMs: results.totalTimeMs
            });

            return results;

        } catch (error: any) {
            logger.error('❌ Curriculum Agent: Fatal error', error);
            results.errors.push(error.message || 'Unknown error');
            results.totalTimeMs = Date.now() - startTime;
            return results;
        }
    }
}

// ============================================
// Factory Function
// ============================================

export function createCurriculumAgent(
    openaiApiKey: string,
    options?: Partial<AgentConfig>
): CurriculumAgent {
    const config: AgentConfig = {
        openaiApiKey,
        maxIterations: options?.maxIterations || 50,
        timeoutMs: options?.timeoutMs || 480000, // 8 minutes
        activityCountPerRun: options?.activityCountPerRun || 10
    };

    return new CurriculumAgent(config);
}
