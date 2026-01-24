/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests/frontend', '<rootDir>/src'],

  // Where to find tests
  testMatch: [
    '**/tests/frontend/**/*.test.ts',
    '**/tests/frontend/**/*.test.tsx',
  ],

  // Coverage settings - מגדיר כיסוי מינימלי נדרש
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/index.tsx',
    '!src/reportWebVitals.ts',
  ],

  // Coverage thresholds - הבדיקות נכשלות אם הכיסוי נמוך מזה
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
    // ⚠️ קבצים קריטיים דורשים כיסוי גבוה יותר
    './src/context/CourseContext.tsx': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './src/services/*.ts': {
      branches: 65,
      functions: 65,
      lines: 65,
      statements: 65,
    },
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

  // Module resolution
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Transform settings
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
      },
    }],
  },
};
