# Monitoring & Alerts Setup Guide

This guide explains how to set up error monitoring, budget alerts, and E2E testing for the AI-LMS system.

## Table of Contents

1. [Error Monitoring (Sentry)](#error-monitoring-sentry)
2. [Budget Alerts (GCP)](#budget-alerts-gcp)
3. [E2E Testing (Playwright)](#e2e-testing-playwright)

---

## Error Monitoring (Sentry)

### Frontend Setup

1. **Create Sentry Account**
   - Go to [sentry.io](https://sentry.io)
   - Create a new React project

2. **Add Environment Variables**
   ```bash
   # .env.local
   VITE_SENTRY_DSN=your-sentry-dsn-here
   VITE_SENTRY_ENABLED=true
   VITE_APP_VERSION=1.0.0
   ```

3. **Initialize in main.tsx**
   ```tsx
   import { initErrorMonitoring } from './services/errorMonitoring';

   // At the top of your app
   initErrorMonitoring();
   ```

4. **Wrap App with Error Boundary**
   ```tsx
   import { ErrorBoundary } from './services/errorMonitoring';
   import { SentryErrorFallback } from './components/ErrorFallback';

   <ErrorBoundary fallback={SentryErrorFallback}>
     <App />
   </ErrorBoundary>
   ```

### Backend Setup

1. **Add Sentry Secret**
   ```bash
   firebase functions:secrets:set SENTRY_DSN
   ```

2. **Initialize in index.ts**
   ```typescript
   import { initErrorMonitoring } from './services/errorMonitoring';

   // At the top of index.ts
   initErrorMonitoring();
   ```

3. **Wrap Handlers (Optional)**
   ```typescript
   import { wrapHandler, flush } from './services/errorMonitoring';

   export const myFunction = onCall(async (request) => {
     return wrapHandler('myFunction', async () => {
       // Your code here
       await flush(); // Important for serverless!
     });
   });
   ```

---

## Budget Alerts (GCP)

### Quick Setup (Cloud Console)

1. Go to [Cloud Console > Billing > Budgets](https://console.cloud.google.com/billing/budgets)
2. Click **Create Budget**
3. Set budget amount (e.g., $500/month)
4. Add thresholds: 50%, 80%, 100%, 120%
5. Enable email notifications
6. (Optional) Link to Pub/Sub topic: `budget-alerts`

### Automated Setup (Script)

```bash
# Make executable
chmod +x scripts/setup-budget-alerts.sh

# Run with project ID and budget amount
./scripts/setup-budget-alerts.sh ai-lms-pro 500
```

### What Happens at Each Threshold

| Threshold | Action |
|-----------|--------|
| 50% | Warning logged to Firestore |
| 80% | Slack/Email notification sent |
| 100% | Service limits reduced, admins alerted |
| 120% | **Emergency Mode**: AI generation disabled |

### Disabling Emergency Mode

```typescript
// Via Cloud Functions (admin only)
const { httpsCallable } = await import('firebase/functions');
const disableEmergency = httpsCallable(functions, 'disableEmergencyModeEndpoint');
await disableEmergency();
```

### Environment Variables

```bash
# functions/.env
SLACK_BUDGET_WEBHOOK=https://hooks.slack.com/services/xxx
```

---

## E2E Testing (Playwright)

### Installation

```bash
# Install Playwright
npm install

# Install browsers
npx playwright install
```

### Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (interactive mode)
npm run test:e2e:ui

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# View report
npm run test:e2e:report
```

### Test Configuration

Create `.env.test` for test credentials:

```bash
# .env.test (DO NOT COMMIT!)
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
```

### Test Structure

```
e2e/
├── auth.spec.ts          # Authentication tests
├── course-creation.spec.ts # Course creation flow
├── ai-generation.spec.ts   # AI content generation
└── security.spec.ts        # Security tests
```

### CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Quick Reference

### Commands

| Command | Description |
|---------|-------------|
| `npm run test:e2e` | Run E2E tests |
| `npm run test:e2e:ui` | Interactive test UI |
| `npm run test:e2e:report` | View test report |

### Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `VITE_SENTRY_DSN` | Frontend | Sentry DSN |
| `SENTRY_DSN` | Functions (secret) | Backend Sentry DSN |
| `SLACK_BUDGET_WEBHOOK` | Functions | Slack webhook for alerts |
| `TEST_USER_EMAIL` | CI | Test user email |
| `TEST_USER_PASSWORD` | CI | Test user password |

### Useful Links

- [Sentry Dashboard](https://sentry.io)
- [GCP Billing Console](https://console.cloud.google.com/billing)
- [Playwright Docs](https://playwright.dev/docs/intro)
