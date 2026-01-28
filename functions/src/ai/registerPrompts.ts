/**
 * Prompt Registration
 *
 * Registers all prompts with the prompt registry.
 * Call initializePrompts() at application startup.
 *
 * Version History:
 * - Update version when making significant changes to a prompt
 * - Use semantic versioning: major.minor.patch
 *   - major: Breaking changes or complete rewrite
 *   - minor: Significant improvements or new features
 *   - patch: Bug fixes or minor tweaks
 */

import { promptRegistry, PROMPT_VERSIONS } from './promptRegistry';
import { BOT_PERSONAS } from './prompts';

/**
 * Initialize all prompts in the registry
 * Should be called once at application startup
 */
export function initializePrompts(): void {
  // ============================================================
  // BOT PERSONAS
  // ============================================================

  for (const [id, persona] of Object.entries(BOT_PERSONAS)) {
    promptRegistry.register(`bot-persona-${id}`, {
      version: PROMPT_VERSIONS.BOT_PERSONA,
      template: persona.systemPrompt,
      description: `Bot persona: ${persona.name}`,
      tags: ['persona', 'chat', 'bot'],
      setActive: true
    });
  }

  // ============================================================
  // SKELETON GENERATOR
  // ============================================================

  promptRegistry.register('skeleton-generator', {
    version: PROMPT_VERSIONS.SKELETON_GENERATOR,
    template: `[Dynamic template - see getSkeletonPrompt()]`,
    description: 'Generates course/unit skeleton structure with activity types',
    tags: ['generation', 'skeleton', 'structure'],
    parameters: [
      'contextPart',
      'gradeLevel',
      'personalityInstruction',
      'mode',
      'productType',
      'stepCount',
      'bloomSteps',
      'structureGuide',
      'learningLevel'
    ],
    setActive: true
  });

  // ============================================================
  // STEP CONTENT GENERATOR
  // ============================================================

  promptRegistry.register('step-content-generator', {
    version: PROMPT_VERSIONS.STEP_CONTENT,
    template: `[Dynamic template - see getStepContentPrompt()]`,
    description: 'Generates detailed content for each activity step',
    tags: ['generation', 'content', 'activity'],
    parameters: [
      'skeleton',
      'stepNumber',
      'gradeLevel',
      'sourceContent',
      'previousSteps'
    ],
    setActive: true
  });

  // ============================================================
  // EXAM/QUIZ GENERATOR
  // ============================================================

  promptRegistry.register('exam-generator', {
    version: PROMPT_VERSIONS.EXAM_GENERATOR,
    template: `[Dynamic template - see exam generation prompts]`,
    description: 'Generates exam questions and answers',
    tags: ['generation', 'exam', 'assessment'],
    parameters: [
      'content',
      'gradeLevel',
      'questionCount',
      'questionTypes',
      'bloomLevels'
    ],
    setActive: true
  });

  // ============================================================
  // GRADING PROMPT
  // ============================================================

  promptRegistry.register('grading', {
    version: PROMPT_VERSIONS.GRADING,
    template: `[Dynamic template - see grading prompts]`,
    description: 'Grades student answers with feedback',
    tags: ['grading', 'assessment', 'feedback'],
    parameters: [
      'question',
      'correctAnswer',
      'studentAnswer',
      'rubric'
    ],
    setActive: true
  });

  // ============================================================
  // VARIANT GENERATOR (Adaptive Learning)
  // ============================================================

  promptRegistry.register('variant-generator', {
    version: PROMPT_VERSIONS.VARIANT_GENERATOR,
    template: `[Dynamic template - see variant generation]`,
    description: 'Generates easier/harder variants for adaptive learning',
    tags: ['generation', 'adaptive', 'variant', 'differentiation'],
    parameters: [
      'originalBlock',
      'targetLevel',
      'gradeLevel'
    ],
    setActive: true
  });

  // ============================================================
  // LINGUISTIC CONSTRAINTS
  // ============================================================

  promptRegistry.register('linguistic-constraints', {
    version: PROMPT_VERSIONS.LINGUISTIC_CONSTRAINTS,
    template: `[Dynamic - grade-specific linguistic rules]`,
    description: 'Hebrew linguistic constraints by grade level',
    tags: ['constraints', 'linguistic', 'hebrew'],
    parameters: ['gradeLevel'],
    setActive: true
  });

  console.log('📝 Prompt registry initialized with', promptRegistry.listPrompts().length, 'prompts');
}

/**
 * Export function to add prompt version to generated content
 */
export function addPromptVersionToContent<T extends object>(
  content: T,
  promptId: string
): T & { _promptVersion: { id: string; version: string; timestamp: string } } {
  const versionKey = Object.keys(PROMPT_VERSIONS).find(
    k => k.toLowerCase().replace(/_/g, '-') === promptId.toLowerCase().replace(/_/g, '-')
  ) as keyof typeof PROMPT_VERSIONS | undefined;

  const version = versionKey ? PROMPT_VERSIONS[versionKey] : 'unknown';

  return {
    ...content,
    _promptVersion: {
      id: promptId,
      version,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Changelog for prompt versions
 */
export const PROMPT_CHANGELOG = {
  '2024-01-26': {
    'skeleton-generator': {
      version: '2.0.0',
      changes: [
        'Added LLM security delimiters',
        'Improved differentiated learning support',
        'Added Bloom taxonomy requirements'
      ]
    },
    'step-content': {
      version: '2.0.0',
      changes: [
        'Added security sandboxing for source content',
        'Improved Hebrew linguistic constraints'
      ]
    }
  },
  '2024-01-20': {
    'exam-generator': {
      version: '1.5.0',
      changes: [
        'Added support for multiple question types',
        'Improved distractor generation'
      ]
    }
  }
};
