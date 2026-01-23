/**
 * ⚠️ CRITICAL TESTS - AI Prompts
 *
 * These tests protect the core AI prompt logic that affects ALL teachers and students.
 * DO NOT modify these tests without:
 * 1. Understanding the impact on generation quality
 * 2. Testing with real course data
 * 3. Code review from team lead
 */

import {
  getSkeletonPrompt,
  getStepContentPrompt,
  getLinguisticConstraintsByGrade,
  getPodcastPrompt,
  getCategorizationPrompt,
  BOT_PERSONAS
} from '../prompts';

describe('AI Prompts - Critical Logic', () => {
  describe('BOT_PERSONAS', () => {
    test('should contain all required persona types', () => {
      expect(BOT_PERSONAS).toHaveProperty('teacher');
      expect(BOT_PERSONAS).toHaveProperty('socratic');
      expect(BOT_PERSONAS).toHaveProperty('concise');
      expect(BOT_PERSONAS).toHaveProperty('coach');
    });

    test('each persona should have required fields', () => {
      Object.values(BOT_PERSONAS).forEach(persona => {
        expect(persona).toHaveProperty('id');
        expect(persona).toHaveProperty('name');
        expect(persona).toHaveProperty('systemPrompt');
        expect(persona).toHaveProperty('initialMessage');
        expect(typeof persona.systemPrompt).toBe('string');
        expect(persona.systemPrompt.length).toBeGreaterThan(10);
      });
    });

    test('socratic persona should prevent direct answers', () => {
      const socratic = BOT_PERSONAS.socratic;
      expect(socratic.systemPrompt).toContain('לעולם אל תיתן תשובה ישירה');
      expect(socratic.systemPrompt).toContain('שאלה');
    });
  });

  describe('getSkeletonPrompt', () => {
    test('should generate prompt with all required sections', () => {
      const prompt = getSkeletonPrompt(
        'Topic: Mathematics',
        'כיתה ה',
        'Friendly tone',
        'learning',
        'activity',
        5,
        ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate'],
        'Standard structure'
      );

      expect(prompt).toContain('Skeleton');
      expect(prompt).toContain('כיתה ה');
      expect(prompt).toContain('BLOOM TAXONOMY');
      expect(prompt).toContain('ZERO-TEXT-WALL');
      expect(prompt).toContain('Remember');
      expect(prompt).toContain('Hebrew');
    });

    test('should include exam mode constraints when mode=exam', () => {
      const prompt = getSkeletonPrompt(
        'Topic: Science',
        'כיתה ז',
        'Professional',
        'exam',
        'exam',
        3,
        ['Apply', 'Analyze', 'Evaluate'],
        'Test structure'
      );

      expect(prompt).toContain('EXAM');
      expect(prompt).toContain('ASSESSMENT');
    });

    test('should include learning level constraints when provided', () => {
      const prompt = getSkeletonPrompt(
        'Topic: History',
        'כיתה ח',
        'Neutral',
        'learning',
        'activity',
        4,
        ['Remember', 'Understand', 'Apply', 'Analyze'],
        'Standard',
        'הבנה' // Learning level for differentiated content
      );

      expect(prompt).toContain('DIFFERENTIATED LEARNING LEVEL');
      expect(prompt).toContain('הבנה');
      expect(prompt).toContain('SUPPORT level');
    });

    test('should respect step count parameter', () => {
      const prompt = getSkeletonPrompt(
        'Topic: Geography',
        'כיתה ו',
        'Playful',
        'learning',
        'activity',
        7, // 7 steps
        Array(7).fill('Remember'),
        'Structure'
      );

      expect(prompt).toContain('Exactly 7 steps');
    });

    test('should include interaction diversity rules', () => {
      const prompt = getSkeletonPrompt(
        'Topic: Any',
        'כיתה ה',
        'Friendly',
        'learning',
        'activity',
        5,
        ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate'],
        'Standard'
      );

      expect(prompt).toContain('INTERACTION DIVERSITY RULE');
      expect(prompt).toContain('NEVER use the same type twice in a row');
      expect(prompt).toContain('multiple_choice');
      expect(prompt).toContain('categorization');
    });
  });

  describe('getStepContentPrompt', () => {
    const mockStepInfo = {
      step_number: 1,
      title: 'Introduction',
      narrative_focus: 'Basic concepts',
      forbidden_topics: ['Advanced topics'],
      bloom_level: 'Remember',
      suggested_interaction_type: 'multiple_choice'
    };

    test('should generate valid step content prompt', () => {
      const prompt = getStepContentPrompt(
        'Test context',
        'No exam mode',
        mockStepInfo,
        'learning',
        'Simple Hebrew for grade 3',
        'כיתה ג',
        'activity',
        'friendly'
      );

      expect(prompt).toContain('Test context');
      expect(prompt).toContain('Remember');
      expect(prompt).toContain('multiple_choice');
      expect(prompt).toContain('Hebrew');
    });

    test('exam mode should disable hints and teach_content', () => {
      const prompt = getStepContentPrompt(
        'Exam context',
        '**EXAM MODE ACTIVE**',
        mockStepInfo,
        'exam',
        'Grade appropriate',
        'כיתה ח',
        'exam',
        'professional'
      );

      expect(prompt).toContain('EXAM MODE');
      expect(prompt).toContain('Do NOT output \'teach_content\'');
      expect(prompt).toContain('Do NOT generate \'progressive_hints\'');
    });

    test('activity mode should prevent teach_content and infographics', () => {
      const prompt = getStepContentPrompt(
        'Activity context',
        '',
        mockStepInfo,
        'learning',
        'Grade appropriate',
        'כיתה ה',
        'activity', // Activity mode
        'playful'
      );

      expect(prompt).toContain('STUDENT ACTIVITY MODE');
      expect(prompt).toContain('Do NOT output \'teach_content\'');
      expect(prompt).toContain('100% interactive');
    });

    test('lesson mode should require teach_content', () => {
      const prompt = getStepContentPrompt(
        'Lesson context',
        '',
        mockStepInfo,
        'learning',
        'Grade appropriate',
        'כיתה ו',
        'lesson', // Lesson mode
        'friendly'
      );

      expect(prompt).toContain('LESSON MODE');
      expect(prompt).toContain('\'teach_content\' field is REQUIRED');
    });

    test('should include learning level constraints when provided', () => {
      const prompt = getStepContentPrompt(
        'Context',
        '',
        mockStepInfo,
        'learning',
        'Constraints',
        'כיתה ז',
        'activity',
        'friendly',
        'העמקה' // Enrichment level
      );

      expect(prompt).toContain('DIFFERENTIATED LEARNING LEVEL');
      expect(prompt).toContain('העמקה');
      expect(prompt).toContain('ENRICHMENT level');
    });

    test('should include media suggestion guidelines based on product type', () => {
      const activityPrompt = getStepContentPrompt(
        'Context', '', mockStepInfo, 'learning', 'Constraints', 'כיתה ה', 'activity', 'friendly'
      );
      expect(activityPrompt).toContain('STUDENT ACTIVITY MODE - SCENARIO IMAGES ONLY');
      expect(activityPrompt).toContain('Do NOT suggest "infographic"');

      const lessonPrompt = getStepContentPrompt(
        'Context', '', mockStepInfo, 'learning', 'Constraints', 'כיתה ה', 'lesson', 'friendly'
      );
      expect(lessonPrompt).toContain('LESSON MODE - FULL MEDIA SUPPORT');
      expect(lessonPrompt).toContain('ADD infographic when');
    });
  });

  describe('getLinguisticConstraintsByGrade', () => {
    test('should return constraints for early elementary (grades 1-2)', () => {
      const constraints = getLinguisticConstraintsByGrade('כיתה א');
      expect(constraints).toContain('EARLY ELEMENTARY');
      expect(constraints).toContain('CEFR Pre-A1 to A1');
      expect(constraints).toContain('Maximum 5-8 words per sentence');
      expect(constraints).toContain('FORBIDDEN: Compound sentences');
    });

    test('should return constraints for elementary (grades 3-4)', () => {
      const constraints = getLinguisticConstraintsByGrade('כיתה ג');
      expect(constraints).toContain('ELEMENTARY (Grades 3-4)');
      expect(constraints).toContain('CEFR A1-A2');
      expect(constraints).toContain('Maximum 8-10 words per sentence');
    });

    test('should return constraints for upper elementary (grades 5-6)', () => {
      const constraints = getLinguisticConstraintsByGrade('כיתה ה');
      expect(constraints).toContain('UPPER ELEMENTARY');
      expect(constraints).toContain('CEFR A2-B1');
      expect(constraints).toContain('Maximum 10-12 words per sentence');
    });

    test('should return constraints for middle school (grades 7-8)', () => {
      const constraints = getLinguisticConstraintsByGrade('כיתה ז');
      expect(constraints).toContain('MIDDLE SCHOOL (Grades 7-8)');
      expect(constraints).toContain('CEFR B1');
      expect(constraints).toContain('Maximum 15-18 words per sentence');
    });

    test('should return constraints for high school (grades 10-12)', () => {
      const constraints = getLinguisticConstraintsByGrade('כיתה י');
      expect(constraints).toContain('HIGH SCHOOL');
      expect(constraints).toContain('CEFR B2-C1');
      expect(constraints).toContain('Academic/Formal Hebrew');
    });

    test('should return default constraints for unrecognized grade', () => {
      const constraints = getLinguisticConstraintsByGrade('unknown grade');
      expect(constraints).toContain('GENERAL');
      expect(constraints).toContain('Default: Middle School Level');
    });

    test('should handle English grade inputs', () => {
      const constraints = getLinguisticConstraintsByGrade('5th grade');
      expect(constraints).toContain('UPPER ELEMENTARY');
    });
  });

  describe('getPodcastPrompt', () => {
    test('should generate podcast prompt with characters', () => {
      const prompt = getPodcastPrompt('Climate Change', 'Some source text');

      expect(prompt).toContain('Deep Dive');
      expect(prompt).toContain('Dan');
      expect(prompt).toContain('Noa');
      expect(prompt).toContain('Climate Change');
      expect(prompt).toContain('Hebrew');
    });

    test('should limit source text length', () => {
      const longText = 'a'.repeat(20000);
      const prompt = getPodcastPrompt('Topic', longText);

      // Should be truncated to 15000 chars
      expect(prompt.length).toBeLessThan(longText.length + 1000);
    });
  });

  describe('getCategorizationPrompt', () => {
    test('should generate categorization prompt', () => {
      const prompt = getCategorizationPrompt('Animals', 'כיתה ד', 'Source text about animals');

      expect(prompt).toContain('Categorization');
      expect(prompt).toContain('Animals');
      expect(prompt).toContain('כיתה ד');
      expect(prompt).toContain('Hebrew');
      expect(prompt).toContain('MUTUALLY EXCLUSIVE');
    });

    test('should work without source text', () => {
      const prompt = getCategorizationPrompt('Science', 'כיתה ו');

      expect(prompt).toContain('Topic: "Science"');
      expect(prompt).toContain('categories');
    });
  });

  // ============ SNAPSHOT TESTS - Detect unintended changes ============
  describe('Prompt Structure Snapshots', () => {
    test('skeleton prompt structure should remain stable', () => {
      const prompt = getSkeletonPrompt(
        'Source: Test topic',
        'כיתה ה',
        'Friendly tone',
        'learning',
        'activity',
        5,
        ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate'],
        'Standard structure'
      );

      // Snapshot test - will fail if prompt structure changes unexpectedly
      expect(prompt).toMatchSnapshot();
    });

    test('step content prompt structure should remain stable', () => {
      const mockStepInfo = {
        step_number: 1,
        title: 'Test Step',
        narrative_focus: 'Focus area',
        forbidden_topics: ['Topic A', 'Topic B'],
        bloom_level: 'Apply',
        suggested_interaction_type: 'categorization'
      };

      const prompt = getStepContentPrompt(
        'Test context text',
        '',
        mockStepInfo,
        'learning',
        'Grade appropriate language',
        'כיתה ו',
        'activity',
        'friendly'
      );

      expect(prompt).toMatchSnapshot();
    });
  });

  // ============ REGRESSION TESTS - Prevent known bugs ============
  describe('Regression Tests', () => {
    test('should not allow undefined or null to break prompts', () => {
      // Test with undefined/null inputs
      expect(() => {
        getSkeletonPrompt(
          undefined as any,
          undefined as any,
          undefined as any,
          undefined as any,
          undefined as any,
          5,
          [],
          undefined as any
        );
      }).not.toThrow();
    });

    test('linguistic constraints should handle case variations', () => {
      // Test different capitalizations and formats
      const variations = ['כיתה א', 'כיתה א', '1st grade', 'First Grade', 'grade 1'];

      variations.forEach(grade => {
        const constraints = getLinguisticConstraintsByGrade(grade);
        expect(constraints).toBeTruthy();
        expect(typeof constraints).toBe('string');
      });
    });
  });
});
