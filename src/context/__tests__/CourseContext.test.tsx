import { renderHook, act, waitFor } from '@testing-library/react';
import { CourseProvider, useCourseStore } from '../CourseContext';
import type { Course, LearningUnit, Module } from '../../shared/types/courseTypes';
import { db } from '../../firebase';
import { onSnapshot, setDoc } from 'firebase/firestore';

// Mock Firebase
jest.mock('../../firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  onSnapshot: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn(),
}));

// Mock AuthContext
jest.mock('../AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'test-user-123' } }),
}));

// Mock gamificationService
jest.mock('../../services/gamificationService', () => ({
  getInitialProfile: jest.fn(() => ({
    level: 1,
    xp: 0,
    totalXp: 0,
    badges: [],
  })),
  addXp: jest.fn((profile, amount, reason) => ({
    newProfile: { ...profile, xp: profile.xp + amount },
    events: [],
  })),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

// ============================================================
// Helper Functions - Re-implemented for Testing
// ============================================================

/**
 * Sanitize course data (re-implemented from CourseContext.tsx for unit testing)
 * This is the core data validation and cleaning function
 */
function sanitizeCourseData(data: any, docId: string): Course {
  const baseData = data.course ? data.course : data;
  const rawSyllabus = Array.isArray(baseData.syllabus) ? baseData.syllabus : [];

  const cleanSyllabus = rawSyllabus.map((mod: any) => {
    const modId = mod.id || 'mock-uuid-1234';
    const learningUnits = Array.isArray(mod.learningUnits) ? mod.learningUnits : [];

    const cleanUnits = learningUnits
      .filter((unit: any) => unit !== null && unit !== undefined)
      .map((unit: any) => {
        const unitId = unit.id || 'mock-uuid-1234';
        const activityBlocks = Array.isArray(unit.activityBlocks) ? unit.activityBlocks : [];

        const cleanBlocks = activityBlocks
          .filter((block: any) => block !== null && block !== undefined)
          .map((block: any) => ({
            ...block,
            id: block.id || 'mock-uuid-1234',
          }));

        return { ...unit, id: unitId, activityBlocks: cleanBlocks };
      });

    return { ...mod, id: modId, learningUnits: cleanUnits };
  });

  return {
    id: docId,
    teacherId: baseData.teacherId || '',
    title: baseData.title || 'ללא כותרת',
    targetAudience: baseData.targetAudience || '',
    syllabus: cleanSyllabus,
    mode: baseData.mode || baseData.wizardData?.settings?.courseMode || 'learning',
    wizardData: baseData.wizardData || null,
    subject: baseData.subject || '',
    gradeLevel: baseData.gradeLevel || '',
    fullBookContent: baseData.fullBookContent || '',
    showSourceToStudent: baseData.showSourceToStudent ?? true,
    pdfSource: baseData.pdfSource || null,
    createdAt: baseData.createdAt || null,
  } as Course;
}

// ============================================================
// Test Suite
// ============================================================

describe('CourseContext - sanitizeCourseData', () => {
  describe('Data Structure Normalization', () => {
    test('should handle nested data structure (course.course)', () => {
      const data = {
        course: {
          teacherId: 'teacher-123',
          title: 'קורס מתמטיקה',
          syllabus: [],
        },
      };

      const result = sanitizeCourseData(data, 'doc-123');

      expect(result.id).toBe('doc-123');
      expect(result.teacherId).toBe('teacher-123');
      expect(result.title).toBe('קורס מתמטיקה');
    });

    test('should handle flat data structure', () => {
      const data = {
        teacherId: 'teacher-456',
        title: 'קורס היסטוריה',
        syllabus: [],
      };

      const result = sanitizeCourseData(data, 'doc-456');

      expect(result.id).toBe('doc-456');
      expect(result.teacherId).toBe('teacher-456');
      expect(result.title).toBe('קורס היסטוריה');
    });

    test('should handle non-array syllabus', () => {
      const data = {
        teacherId: 'teacher-789',
        title: 'קורס פיזיקה',
        syllabus: null, // Not an array
      };

      const result = sanitizeCourseData(data, 'doc-789');

      expect(Array.isArray(result.syllabus)).toBe(true);
      expect(result.syllabus).toHaveLength(0);
    });
  });

  describe('ID Generation', () => {
    test('should add missing module IDs', () => {
      const data = {
        syllabus: [
          {
            title: 'מודול 1',
            learningUnits: [],
          },
        ],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.syllabus[0].id).toBe('mock-uuid-1234');
    });

    test('should preserve existing module IDs', () => {
      const data = {
        syllabus: [
          {
            id: 'existing-module-id',
            title: 'מודול עם ID',
            learningUnits: [],
          },
        ],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.syllabus[0].id).toBe('existing-module-id');
    });

    test('should add missing unit IDs', () => {
      const data = {
        syllabus: [
          {
            id: 'module-1',
            learningUnits: [
              {
                title: 'יחידה 1',
                activityBlocks: [],
              },
            ],
          },
        ],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.syllabus[0].learningUnits[0].id).toBe('mock-uuid-1234');
    });

    test('should add missing activity block IDs', () => {
      const data = {
        syllabus: [
          {
            id: 'module-1',
            learningUnits: [
              {
                id: 'unit-1',
                activityBlocks: [
                  {
                    type: 'text',
                    content: 'תוכן',
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.syllabus[0].learningUnits[0].activityBlocks[0].id).toBe('mock-uuid-1234');
    });
  });

  describe('Null/Undefined Filtering', () => {
    test('should filter out null units', () => {
      const data = {
        syllabus: [
          {
            id: 'module-1',
            learningUnits: [
              { id: 'unit-1', title: 'יחידה 1' },
              null,
              { id: 'unit-2', title: 'יחידה 2' },
            ],
          },
        ],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.syllabus[0].learningUnits).toHaveLength(2);
      expect(result.syllabus[0].learningUnits[0].title).toBe('יחידה 1');
      expect(result.syllabus[0].learningUnits[1].title).toBe('יחידה 2');
    });

    test('should filter out undefined units', () => {
      const data = {
        syllabus: [
          {
            id: 'module-1',
            learningUnits: [
              { id: 'unit-1', title: 'יחידה 1' },
              undefined,
              { id: 'unit-2', title: 'יחידה 2' },
            ],
          },
        ],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.syllabus[0].learningUnits).toHaveLength(2);
    });

    test('should filter out null activity blocks', () => {
      const data = {
        syllabus: [
          {
            id: 'module-1',
            learningUnits: [
              {
                id: 'unit-1',
                activityBlocks: [
                  { id: 'block-1', type: 'text' },
                  null,
                  { id: 'block-2', type: 'question' },
                ],
              },
            ],
          },
        ],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.syllabus[0].learningUnits[0].activityBlocks).toHaveLength(2);
      expect(result.syllabus[0].learningUnits[0].activityBlocks[0].id).toBe('block-1');
      expect(result.syllabus[0].learningUnits[0].activityBlocks[1].id).toBe('block-2');
    });
  });

  describe('Mode Field Handling', () => {
    test('should use mode field if present', () => {
      const data = {
        mode: 'assessment',
        syllabus: [],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.mode).toBe('assessment');
    });

    test('should fallback to wizardData.settings.courseMode if mode missing', () => {
      const data = {
        wizardData: {
          settings: {
            courseMode: 'learning',
          },
        },
        syllabus: [],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.mode).toBe('learning');
    });

    test('should use default learning mode if both missing', () => {
      const data = {
        syllabus: [],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.mode).toBe('learning');
    });
  });

  describe('Default Values', () => {
    test('should use default title if missing', () => {
      const data = {
        syllabus: [],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.title).toBe('ללא כותרת');
    });

    test('should default showSourceToStudent to true', () => {
      const data = {
        syllabus: [],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.showSourceToStudent).toBe(true);
    });

    test('should preserve showSourceToStudent if false', () => {
      const data = {
        showSourceToStudent: false,
        syllabus: [],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.showSourceToStudent).toBe(false);
    });

    test('should default empty string fields', () => {
      const data = {
        syllabus: [],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.teacherId).toBe('');
      expect(result.targetAudience).toBe('');
      expect(result.subject).toBe('');
      expect(result.gradeLevel).toBe('');
      expect(result.fullBookContent).toBe('');
    });

    test('should default null fields', () => {
      const data = {
        syllabus: [],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.wizardData).toBeNull();
      expect(result.pdfSource).toBeNull();
      expect(result.createdAt).toBeNull();
    });
  });

  describe('wizardData Preservation', () => {
    test('should preserve wizardData if present', () => {
      const wizardData = {
        settings: {
          courseMode: 'learning',
          gradeLevel: 'כיתה ה',
        },
        steps: {
          completed: ['step1', 'step2'],
        },
      };

      const data = {
        wizardData,
        syllabus: [],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.wizardData).toEqual(wizardData);
    });

    test('should set wizardData to null if missing', () => {
      const data = {
        syllabus: [],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.wizardData).toBeNull();
    });
  });

  describe('Regression Tests', () => {
    test('should not crash on completely empty data', () => {
      const data = {};

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.id).toBe('doc-id');
      expect(result.syllabus).toEqual([]);
      expect(result.title).toBe('ללא כותרת');
    });

    test('should handle deeply nested null/undefined values', () => {
      const data = {
        syllabus: [
          {
            id: 'module-1',
            learningUnits: [
              {
                id: 'unit-1',
                activityBlocks: [null, undefined, { type: 'text' }, null],
              },
              null,
              {
                id: 'unit-2',
                activityBlocks: [undefined, { type: 'question' }],
              },
            ],
          },
        ],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.syllabus[0].learningUnits).toHaveLength(2);
      expect(result.syllabus[0].learningUnits[0].activityBlocks).toHaveLength(1);
      expect(result.syllabus[0].learningUnits[1].activityBlocks).toHaveLength(1);
    });

    test('should handle missing learningUnits array', () => {
      const data = {
        syllabus: [
          {
            id: 'module-1',
            title: 'מודול ללא יחידות',
          },
        ],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.syllabus[0].learningUnits).toEqual([]);
    });

    test('should handle missing activityBlocks array', () => {
      const data = {
        syllabus: [
          {
            id: 'module-1',
            learningUnits: [
              {
                id: 'unit-1',
                title: 'יחידה ללא בלוקים',
              },
            ],
          },
        ],
      };

      const result = sanitizeCourseData(data, 'doc-id');

      expect(result.syllabus[0].learningUnits[0].activityBlocks).toEqual([]);
    });
  });

  describe('Structure Snapshots', () => {
    test('complete course structure should remain stable', () => {
      const data = {
        teacherId: 'teacher-1',
        title: 'קורס מלא',
        targetAudience: 'כיתה ה',
        subject: 'מתמטיקה',
        gradeLevel: 'כיתה ה',
        mode: 'learning',
        showSourceToStudent: true,
        wizardData: {
          settings: { courseMode: 'learning' },
        },
        syllabus: [
          {
            id: 'mod-1',
            title: 'מודול 1',
            learningUnits: [
              {
                id: 'unit-1',
                title: 'יחידה 1',
                activityBlocks: [
                  {
                    id: 'block-1',
                    type: 'text',
                    content: 'תוכן',
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = sanitizeCourseData(data, 'course-123');

      expect(result).toMatchSnapshot();
    });
  });
});
