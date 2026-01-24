# 🧪 Tests Directory - AI-LMS System

All automated tests are organized in this centralized directory for easy discovery and maintenance.

---

## 📂 Directory Structure

```
tests/
├── frontend/                    # Frontend (React) tests
│   └── context/
│       └── CourseContext.test.tsx
│
└── backend/                     # Backend (Firebase Functions) tests
    ├── ai/
    │   └── prompts.test.ts
    └── streaming/
        └── streamingServer.test.ts
```

---

## 🎯 Test Organization

### Frontend Tests (`/tests/frontend/`)
- **Location**: All React component and context tests
- **Framework**: Jest + Testing Library
- **Config**: `jest.config.cjs` (root)
- **Command**: `npm test`

**Current Coverage:**
- ✅ `CourseContext.test.tsx` - 25 tests (100% passing)
  - Data sanitization
  - ID generation
  - Null/undefined filtering
  - Default values

### Backend Tests (`/tests/backend/`)
- **Location**: All Firebase Functions tests
- **Framework**: Jest + ts-jest
- **Config**: `functions/jest.config.js`
- **Command**: `cd functions && npm test`

**Current Coverage:**
- ✅ `streamingServer.test.ts` - 36 tests (100% passing)
  - Validation functions
  - Fallback mechanisms
  - Data normalization

- ✅ `prompts.test.ts` - 29 tests (24 passing)
  - AI prompt generation
  - Linguistic constraints
  - Persona validation

---

## 🚀 Running Tests

### All Frontend Tests
```bash
npm test
```

### All Backend Tests
```bash
cd functions
npm test
```

### Specific Test File
```bash
# Frontend
npm test -- CourseContext

# Backend
cd functions
npm test -- prompts
```

### With Coverage
```bash
# Frontend
npm run test:coverage

# Backend
cd functions
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

---

## 📊 Current Status

**Total Tests: 90**
- ✅ Frontend: 25/25 passing
- ✅ Backend: 60/65 passing
- ⚠️ 5 tests in prompts.test.ts need attention (pre-existing)

---

## 📁 File Naming Convention

- Test files: `*.test.ts` or `*.test.tsx`
- Location: Mirror the source file structure
- Example:
  - Source: `src/context/CourseContext.tsx`
  - Test: `tests/frontend/context/CourseContext.test.tsx`

---

## 🔗 Related Documentation

- [TESTING_GUIDE.md](../docs/TESTING_GUIDE.md) - Comprehensive testing guide
- [TESTING_QUICK_REFERENCE.md](../docs/TESTING_QUICK_REFERENCE.md) - Quick command reference
- [CRITICAL_CODE.md](../docs/CRITICAL_CODE.md) - Protected code registry

---

## 💡 Best Practices

1. **Always run tests before committing**
   ```bash
   npm run validate  # Runs type-check + lint + tests
   ```

2. **Pre-commit hook runs automatically**
   - Tests related files automatically
   - Blocks commit if tests fail

3. **Write tests for new features**
   - Add test file in appropriate directory
   - Mirror source file structure

4. **Maintain high coverage for critical files**
   - `CourseContext.tsx`: 70% minimum
   - `prompts.ts`: 85% minimum
   - `streamingServer.ts`: 80% minimum

---

**Last Updated:** 2026-01-24
**Version:** 2.0 (Centralized Structure)
