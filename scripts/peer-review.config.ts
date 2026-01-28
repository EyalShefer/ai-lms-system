/**
 * Peer Review Configuration
 *
 * Customize the review prompts and settings here.
 */

// ============================================================================
// Custom Review Prompts
// ============================================================================

export const REVIEW_TYPES = {
  /**
   * Standard comprehensive code review
   */
  standard: `You are a senior software engineer conducting a thorough code review.

Analyze the provided code and identify:

1. **Bugs & Logic Errors** - Actual bugs, race conditions, null pointer issues
2. **Security Vulnerabilities** - XSS, injection, auth issues, data exposure
3. **Performance Issues** - Memory leaks, inefficient algorithms
4. **Type Safety Issues** - Missing types, incorrect types, any usage
5. **Error Handling** - Missing try/catch, unhandled promise rejections
6. **Code Quality** - Code smells, dead code, inconsistent patterns

Format as JSON with findings array.`,

  /**
   * Security-focused review
   */
  security: `You are a security expert conducting a security audit.

Focus ONLY on security issues:
- Authentication & Authorization flaws
- Input validation issues
- XSS vulnerabilities
- SQL/NoSQL injection
- Sensitive data exposure
- CSRF vulnerabilities
- Insecure dependencies
- Hardcoded secrets/credentials

Be thorough. Report even potential issues.
Format as JSON with findings array.`,

  /**
   * Performance-focused review
   */
  performance: `You are a performance optimization expert.

Focus ONLY on performance issues:
- Unnecessary re-renders (React)
- Memory leaks
- Inefficient algorithms (O(n²) where O(n) possible)
- Missing memoization
- Bundle size concerns
- Database query efficiency
- Caching opportunities

Format as JSON with findings array.`,

  /**
   * React-specific review
   */
  react: `You are a React expert reviewing React/TypeScript code.

Focus on React-specific issues:
- Hook rules violations
- Missing dependencies in useEffect/useMemo/useCallback
- Prop drilling that should use context
- Component design issues
- State management problems
- Key prop issues
- Unnecessary re-renders
- Memory leaks from subscriptions

Format as JSON with findings array.`,

  /**
   * Firebase-specific review
   */
  firebase: `You are a Firebase expert reviewing Firebase/Firestore code.

Focus on Firebase-specific issues:
- Security rules concerns
- Inefficient queries (missing indexes)
- Unbounded reads/writes
- Missing error handling
- Auth state issues
- Realtime listener cleanup
- Cost optimization opportunities
- Offline support issues

Format as JSON with findings array.`,

  /**
   * Quick sanity check
   */
  quick: `Do a quick sanity check of this code.
Only report CRITICAL or HIGH severity issues.
Skip minor style issues.
Be brief.
Format as JSON with findings array.`,
};

// ============================================================================
// Project-Specific Context
// ============================================================================

/**
 * Add context about your project that helps the reviewer understand your codebase.
 * This is prepended to every review prompt.
 */
export const PROJECT_CONTEXT = `
PROJECT CONTEXT:
- This is an AI-powered Learning Management System (LMS)
- Built with React, TypeScript, Firebase (Firestore, Functions, Auth)
- Uses Tailwind CSS for styling
- Has adaptive learning features with feature flags
- Supports Hebrew RTL interface
- Backend functions use Gemini AI for content generation

KEY PATTERNS:
- Feature flags in src/config/adaptiveFeatureFlags.ts
- Firebase utils in src/firebaseUtils.ts
- Streaming service for AI responses
- Course/Unit/Lesson data model

KNOWN DECISIONS (don't flag these):
- We use 'any' in some legacy code intentionally
- Some components are large by design for performance
- Hebrew text is handled with RTL CSS
`;

// ============================================================================
// Output Preferences
// ============================================================================

export const OUTPUT_CONFIG = {
  /**
   * Where to save review results
   */
  outputDir: './reviews',

  /**
   * Include code examples in findings
   */
  includeCodeExamples: true,

  /**
   * Minimum severity to report
   */
  minSeverity: 'LOW' as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',

  /**
   * Categories to ignore
   */
  ignoreCategories: [] as string[],
};

// ============================================================================
// Model Preferences
// ============================================================================

export const MODEL_PREFERENCES = {
  /**
   * Default model for quick reviews
   */
  quickReview: 'gemini',

  /**
   * Default model for thorough reviews
   */
  thoroughReview: 'claude',

  /**
   * Models for comparison reviews
   */
  comparison: ['gemini', 'claude', 'gpt4o'],
};
