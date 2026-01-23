/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],

  testMatch: [
    '**/__tests__/**/*.test.ts',
  ],

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts', // Entry point
  ],

  // ⚠️ קוד AI והסטרימינג דורש כיסוי גבוה מאוד
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
    // קוד AI קריטי ביותר - 85% כיסוי
    './src/ai/prompts.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    // Streaming server קריטי - 80% כיסוי
    './src/streaming/streamingServer.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Timeout for async tests
  testTimeout: 10000,
};
