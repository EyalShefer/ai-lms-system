/**
 * Micro Activity Generator Service
 *
 * Generates single activity blocks quickly without the full
 * Architect → Generator → Guardian pipeline.
 */

import * as logger from 'firebase-functions/logger';
import { v4 as uuidv4 } from 'uuid';
import { generateText, ChatMessage } from './geminiService';
import { getMicroActivityPrompt } from '../ai/microPrompts';
import {
  MicroActivityType,
  MicroActivity,
  MicroActivitySource,
  getMicroActivityTypeInfo
} from '../shared/types/microActivityTypes';
import { ActivityBlock } from '../shared/types/courseTypes';

/**
 * Input for generating a micro activity
 */
export interface MicroGeneratorInput {
  type: MicroActivityType;
  source: MicroActivitySource;
  gradeLevel: string;
  teacherId: string;
  subject?: string;
}

/**
 * Output from the generator
 */
export interface MicroGeneratorOutput {
  success: boolean;
  microActivity?: MicroActivity;
  error?: string;
}

/**
 * Parsed response from AI
 */
interface AIGeneratedContent {
  type: string;
  suggestedTitle: string;
  content: any;
  metadata?: any;
}

/**
 * Generate a micro activity
 */
export async function generateMicroActivity(
  input: MicroGeneratorInput
): Promise<MicroGeneratorOutput> {
  const startTime = Date.now();

  logger.info('Starting micro activity generation', {
    type: input.type,
    gradeLevel: input.gradeLevel,
    sourceType: input.source.type
  });

  try {
    // 1. Get source text
    const sourceText = await resolveSourceText(input.source);

    // 2. Get the prompt for this type
    const prompt = getMicroActivityPrompt(input.type, sourceText, input.gradeLevel);

    // 3. Call Gemini
    const messages: ChatMessage[] = [
      { role: 'user', content: prompt }
    ];

    const response = await generateText(messages, {
      temperature: 0.4, // Slightly creative but consistent
      responseFormat: { type: 'json_object' }
    });

    // 4. Parse response
    const parsed = parseAIResponse(response);
    if (!parsed) {
      return {
        success: false,
        error: 'Failed to parse AI response'
      };
    }

    // 5. Validate content
    const validation = validateMicroContent(parsed, input.type);
    if (!validation.isValid) {
      logger.warn('Micro activity validation failed', {
        issues: validation.issues
      });
      // Continue anyway - let the user see and edit
    }

    // 6. Build activity block
    const block = buildActivityBlock(parsed, input.type);

    // 7. Build micro activity
    const microActivity: MicroActivity = {
      id: uuidv4(),
      teacherId: input.teacherId,
      type: input.type,
      title: parsed.suggestedTitle || generateDefaultTitle(input.type, sourceText),
      block,
      gradeLevel: input.gradeLevel,
      subject: input.subject,
      source: input.source,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      isPublic: false
    };

    const generationTime = Date.now() - startTime;
    logger.info('Micro activity generated successfully', {
      type: input.type,
      generationTime: `${generationTime}ms`,
      title: microActivity.title
    });

    return {
      success: true,
      microActivity
    };

  } catch (error: any) {
    logger.error('Micro activity generation failed', {
      type: input.type,
      error: error.message
    });

    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

/**
 * Resolve source text from different input types
 */
async function resolveSourceText(source: MicroActivitySource): Promise<string> {
  switch (source.type) {
    case 'text':
    case 'topic':
      return source.content;

    case 'file':
      // File content should already be extracted and passed in content
      // If fileUrl is provided, we'd need to fetch and parse it
      // For now, assume content contains the extracted text
      if (source.content) {
        return source.content;
      }
      if (source.fileUrl) {
        // TODO: Implement file fetching if needed
        logger.warn('File URL provided but content not extracted', {
          fileUrl: source.fileUrl
        });
        return '';
      }
      return '';

    default:
      return source.content || '';
  }
}

/**
 * Parse AI response to structured content
 */
function parseAIResponse(response: string): AIGeneratedContent | null {
  try {
    // Clean response - remove markdown code blocks if present
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.slice(7);
    }
    if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.slice(3);
    }
    if (cleanResponse.endsWith('```')) {
      cleanResponse = cleanResponse.slice(0, -3);
    }
    cleanResponse = cleanResponse.trim();

    const parsed = JSON.parse(cleanResponse);
    return parsed as AIGeneratedContent;

  } catch (error: any) {
    logger.error('Failed to parse AI response', {
      error: error.message,
      responsePreview: response.substring(0, 200)
    });
    return null;
  }
}

/**
 * Validate micro activity content
 */
function validateMicroContent(
  content: AIGeneratedContent,
  expectedType: MicroActivityType
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check type matches (with type normalization)
  const normalizedExpected = normalizeType(expectedType);
  const normalizedActual = normalizeType(content.type as MicroActivityType);

  if (normalizedActual !== normalizedExpected) {
    issues.push(`Type mismatch: expected ${expectedType}, got ${content.type}`);
  }

  // Check content exists
  if (!content.content) {
    issues.push('Missing content');
  }

  // Type-specific validations
  switch (expectedType) {
    case 'memory_game':
      if (!content.content?.pairs || content.content.pairs.length < 4) {
        issues.push('Memory game needs at least 4 pairs');
      }
      break;

    case 'matching':
      if (!content.content?.leftItems || !content.content?.rightItems) {
        issues.push('Matching needs leftItems and rightItems');
      }
      if (!content.content?.correctMatches) {
        issues.push('Matching needs correctMatches');
      }
      break;

    case 'categorization':
      if (!content.content?.categories || content.content.categories.length < 2) {
        issues.push('Categorization needs at least 2 categories');
      }
      if (!content.content?.items || content.content.items.length < 4) {
        issues.push('Categorization needs at least 4 items');
      }
      break;

    case 'ordering':
      if (!content.content?.correct_order || content.content.correct_order.length < 3) {
        issues.push('Ordering needs at least 3 items');
      }
      break;

    case 'multiple_choice':
      if (!content.content?.questions || content.content.questions.length < 1) {
        issues.push('Multiple choice needs at least 1 question');
      }
      break;

    case 'true_false':
      if (!content.content?.statements || content.content.statements.length < 3) {
        issues.push('True/false needs at least 3 statements');
      }
      break;

    case 'open_question':
      if (!content.content?.question) {
        issues.push('Open question needs a question');
      }
      break;
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Normalize type names for comparison
 */
function normalizeType(type: string): string {
  return type
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');
}

/**
 * Build ActivityBlock from parsed content
 */
function buildActivityBlock(
  parsed: AIGeneratedContent,
  type: MicroActivityType
): ActivityBlock {
  const blockId = uuidv4();

  // Map micro activity type to ActivityBlockType
  const blockType = mapToBlockType(type);

  const block: ActivityBlock = {
    id: blockId,
    type: blockType as any,
    content: parsed.content,
    metadata: parsed.metadata || {}
  };

  return block;
}

/**
 * Map MicroActivityType to ActivityBlockType
 */
function mapToBlockType(type: MicroActivityType): string {
  const typeMap: Record<MicroActivityType, string> = {
    'memory_game': 'memory_game',
    'matching': 'matching',
    'categorization': 'categorization',
    'ordering': 'ordering',
    'sentence_builder': 'sentence_builder',
    'drag_and_drop': 'drag_and_drop',
    'fill_in_blanks': 'fill_in_blanks',
    'multiple_choice': 'multiple-choice',
    'true_false': 'true_false_speed',
    'open_question': 'open-question',
    'matrix': 'matrix',
    'highlight': 'highlight',
    'text_selection': 'text_selection',
    'table_completion': 'table_completion',
    'mindmap': 'mindmap',
    'infographic': 'infographic'
  };

  return typeMap[type] || type;
}

/**
 * Generate default title
 */
function generateDefaultTitle(type: MicroActivityType, sourceText: string): string {
  const typeInfo = getMicroActivityTypeInfo(type);
  const typeName = typeInfo?.name || type;

  // Extract first meaningful words from source
  const words = sourceText
    .replace(/[^\w\sא-ת]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 3)
    .join(' ');

  if (words) {
    return `${typeName}: ${words}`;
  }

  return `${typeName} חדש`;
}

/**
 * Regenerate a micro activity with the same parameters
 */
export async function regenerateMicroActivity(
  existingActivity: MicroActivity
): Promise<MicroGeneratorOutput> {
  return generateMicroActivity({
    type: existingActivity.type,
    source: existingActivity.source,
    gradeLevel: existingActivity.gradeLevel,
    teacherId: existingActivity.teacherId,
    subject: existingActivity.subject
  });
}
