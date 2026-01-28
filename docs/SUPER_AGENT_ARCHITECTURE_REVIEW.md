# Wizdi Super Agent - Architecture Documentation

## V2 Implementation Summary

**Date:** 2026-01-28
**Version:** 2.0
**Status:** Implemented

---

## 1. Overview

The Wizdi Super Agent transforms the creation chat into an intelligent agent that can perform all content creation actions through natural conversation in Hebrew.

### Architecture Principles
- **Dynamic Capabilities**: Loading capabilities from Firestore
- **Threshold-based RAG**: Smart filtering (score >= 5 -> top-5, else all-10)
- **Gemini Function Calling**: Executing actions via function calls
- **Zod Validation**: Type-safe parameter validation
- **Error Recovery**: Hebrew fallback messages for better UX

---

## 2. File Structure

### Frontend (src/)

| File | Purpose | Lines |
|------|---------|-------|
| `services/ai/capabilityRAG.ts` | Threshold-based capability search | ~280 |
| `services/ai/toolExecutor.ts` | Execution with validation & error recovery | ~500 |
| `services/ai/smartCreationServiceV2.ts` | Main service with function calling | ~300 |
| `services/ai/userContextService.ts` | Teacher preferences storage | ~200 |
| `services/ai/capabilityCacheService.ts` | localStorage caching with TTL | ~100 |
| `services/ai/rateLimiterService.ts` | 10 creations/hour limit | ~120 |
| `shared/types/capabilityTypes.ts` | TypeScript types | ~150 |
| `shared/validation/capabilitySchemas.ts` | Zod schemas for all capabilities | ~150 |
| `hooks/useCapabilities.ts` | React hook for loading capabilities | ~80 |
| `components/SmartCreationChatV2.tsx` | V2 chat component | ~490 |

### Backend (functions/src/)

| File | Purpose | Lines |
|------|---------|-------|
| `data/seedCapabilities.ts` | 10 capabilities (4 interactive + 6 static) | ~1050 |
| `admin/seedCapabilitiesFunction.ts` | Seeding function | ~230 |

---

## 3. System Flow

```
+-----------------+
|  User Message   |  "Create activity about fractions for 5th grade"
+--------+--------+
         |
         v
+-----------------+
| useCapabilities |  Load capabilities (with localStorage cache)
+--------+--------+
         |
         v
+-----------------+
|  capabilityRAG  |  Threshold-based search:
|                 |  - score >= 5? -> top-5 tools
|                 |  - else -> all-10 tools
+--------+--------+
         |
         v
+-----------------+
| smartCreationV2 |  Send to Gemini with function declarations
+--------+--------+
         |
         v
+-----------------+
|  Gemini API     |  Returns: function_call: create_interactive_activity
+--------+--------+
         |
         v
+-----------------+
|  toolExecutor   |  1. Zod validation
|                 |  2. Preprocess params
|                 |  3. Execute wizard/API
|                 |  4. Update user context
+--------+--------+
         |
         v
+-----------------+
|    Wizard UI    |  Opens creation wizard with params
+-----------------+
```

---

## 4. Capabilities (10 Total)

### Interactive Content (4)
| ID | Name | Execution |
|----|------|-----------|
| `create_interactive_lesson` | Interactive lesson | wizard |
| `create_interactive_activity` | Practice activity | wizard |
| `create_interactive_exam` | Digital exam | wizard |
| `create_micro_activity` | Micro activity | wizard |

### Static Content (6)
| ID | Name | Execution |
|----|------|-----------|
| `generate_worksheet` | Printable worksheet | API |
| `generate_lesson_plan` | Lesson plan | API |
| `generate_letter` | Parent letter | API |
| `generate_feedback` | Student feedback | API |
| `generate_rubric` | Rubric | API |
| `generate_printable_test` | Printable test | API |

---

## 5. Key Implementations

### 5.1 Threshold-based RAG (Option A)
```typescript
const MIN_SCORE_THRESHOLD = 5;
const TOP_MATCHES_LIMIT = 5;

// If good matches found, send top-5
// Otherwise, send all 10 and let Gemini decide
if (goodMatches.length >= 3 && topScore >= MIN_SCORE_THRESHOLD) {
    results = goodMatches.slice(0, TOP_MATCHES_LIMIT);
    strategy = 'filtered';
} else {
    results = scoredCapabilities;
    strategy = 'all';
}
```

### 5.2 Zod Validation
```typescript
// Each capability has a Zod schema
export const createInteractiveActivitySchema = z.object({
    topic: z.string().min(2).max(200),
    grade: z.string().optional(),
    activityLength: z.enum(['short', 'medium', 'long']).optional(),
    // ...
});

// Validation before execution
const zodValidation = validateCapabilityParams(capability.id, params);
if (!zodValidation.success) {
    return errorRecovery('VALIDATION_ERROR');
}
```

### 5.3 Error Recovery with Hebrew Messages
```typescript
const ERROR_MESSAGES = {
    MISSING_TOPIC: {
        userMessage: 'On what topic would you like me to create content?',
        quickReplies: ['Fractions', 'Water Cycle', 'Hebrew Verbs']
    },
    VALIDATION_ERROR: {
        userMessage: 'Missing details. What would you like to create?',
        quickReplies: ['Create lesson on fractions', 'Create activity on verbs']
    },
    // ...
};
```

### 5.4 User Context
```typescript
// Stored in Firestore: users/{userId}/settings/agentPreferences
interface TeacherPreferences {
    primaryGrade?: string;
    primarySubject?: string;
    recentTopics?: string[];
    recentGrades?: string[];
    // ...
}

// Auto-updated after each creation
await updateRecentUsage({ topic, grade, subject });
```

### 5.5 Rate Limiting
```typescript
// 10 creations per hour per user
const MAX_CREATIONS_PER_HOUR = 10;
const WINDOW_MS = 60 * 60 * 1000;

const { allowed, remaining, resetIn } = canCreateContent(userId);
if (!allowed) {
    return `Created ${MAX_CREATIONS_PER_HOUR} contents already. Try again ${formatResetTime(resetIn)}.`;
}
```

---

## 6. Feature Flag

To enable V2 Super Agent, set environment variable:
```
VITE_USE_SUPER_AGENT_V2=true
```

---

## 7. Removed Components

- `contentTypeDetector.ts` - Deleted (Gemini decides on its own)
- `searchCurriculumStandards` capability - Removed (no backend)
- `searchExistingContent` capability - Removed (no backend)

---

## 8. What's Working

- Threshold-based RAG with scoring
- Zod validation for all 10 capabilities
- Error recovery with Hebrew messages
- User context storage in Firestore
- localStorage caching (30 min TTL)
- Rate limiting (10/hour)
- Feature flag for gradual rollout

---

## 9. Future Improvements

- [ ] Multi-step tasks (full course creation)
- [ ] PDF export capability
- [ ] Duplicate content capability
- [ ] Analytics integration
- [ ] Embeddings for better RAG

---

**Written by:** Claude (Opus 4.5)
**Implementation completed:** 2026-01-28
