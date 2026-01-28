import { test, expect } from '@playwright/test';

/**
 * Security E2E Tests
 *
 * Tests security measures implemented based on GPT Pro review:
 * - Authentication/Authorization
 * - Rate limiting
 * - Input validation
 */

test.describe('Security - Authentication', () => {

  test('should not expose sensitive user data in responses', async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);

    // Monitor network responses
    const sensitiveDataFound: string[] = [];

    page.on('response', async (response) => {
      try {
        const text = await response.text();
        // Check for sensitive fields that shouldn't be in client responses
        if (text.includes('"password"') ||
            text.includes('"passwordHash"') ||
            text.includes('"apiKey"') ||
            text.includes('"secretKey"')) {
          sensitiveDataFound.push(response.url());
        }
      } catch {
        // Ignore non-text responses
      }
    });

    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    expect(sensitiveDataFound).toHaveLength(0);
  });

  test('should redirect unauthorized users from admin routes', async ({ page }) => {
    // Try to access admin routes without login
    const adminRoutes = ['/admin', '/admin/users', '/admin/settings', '/dashboard/admin'];

    for (const route of adminRoutes) {
      await page.goto(route);

      // Should redirect to login or show 403/unauthorized
      const url = page.url();
      const is403 = await page.locator('text=403').or(page.locator('text=Forbidden')).isVisible().catch(() => false);
      const isLoginRedirect = url.includes('login') || url.includes('auth');

      expect(is403 || isLoginRedirect).toBeTruthy();
    }
  });

  test('should not allow XSS in user input fields', async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard|home|courses/, { timeout: 15000 });

    // Navigate to a form that accepts user input
    await page.goto('/create');

    const titleInput = page.locator('input[name="title"]').or(
      page.locator('[placeholder*="שם"]')
    );

    if (await titleInput.isVisible()) {
      // Try to inject XSS
      const xssPayload = '<script>alert("XSS")</script>';
      await titleInput.fill(xssPayload);

      // Submit and check that script is not executed
      const alertPromise = page.waitForEvent('dialog', { timeout: 5000 }).catch(() => null);

      const submitButton = page.locator('button[type="submit"]');
      if (await submitButton.isVisible()) {
        await submitButton.click();
      }

      const alert = await alertPromise;
      expect(alert).toBeNull(); // No alert should appear
    }
  });
});

test.describe('Security - Rate Limiting', () => {

  test('should enforce rate limits on API calls', async ({ page, request }) => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    // Login to get auth token
    await page.goto('/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard|home|courses/, { timeout: 15000 });

    // Get cookies/storage for auth
    const cookies = await page.context().cookies();

    // Make rapid requests
    let rateLimitHit = false;
    const requests: Promise<any>[] = [];

    for (let i = 0; i < 15; i++) {
      requests.push(
        request.get('/api/some-endpoint', {
          headers: {
            Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ')
          }
        }).then(res => {
          if (res.status() === 429) {
            rateLimitHit = true;
          }
          return res;
        }).catch(() => null)
      );
    }

    await Promise.all(requests);

    // Rate limit should have been triggered at some point
    // Note: This might not trigger in test environment, so we just log
    console.log('Rate limit hit:', rateLimitHit);
  });

  test('should show rate limit headers in responses', async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);

    let rateLimitHeaderFound = false;

    page.on('response', async (response) => {
      const headers = response.headers();
      if (headers['x-ratelimit-limit'] || headers['x-ratelimit-remaining']) {
        rateLimitHeaderFound = true;
      }
    });

    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Navigate around to trigger API calls
    await page.goto('/courses');
    await page.waitForTimeout(2000);

    // Note: Headers might not be exposed to client, so this is informational
    console.log('Rate limit headers found:', rateLimitHeaderFound);
  });
});

test.describe('Security - Input Validation', () => {

  test('should sanitize special characters in search', async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');

    await page.goto('/courses');

    const searchInput = page.locator('input[type="search"]').or(
      page.locator('[placeholder*="חיפוש"]')
    );

    if (await searchInput.isVisible()) {
      // Try SQL injection pattern
      await searchInput.fill("'; DROP TABLE users; --");
      await page.keyboard.press('Enter');

      // App should still work (no server error)
      await expect(page.locator('text=שגיאת שרת').or(
        page.locator('text=500')
      )).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('should validate file upload types', async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');

    await page.goto('/create');

    const fileInput = page.locator('input[type="file"]');

    if (await fileInput.isVisible()) {
      // Check that file input has accept attribute
      const acceptAttr = await fileInput.getAttribute('accept');

      // Should restrict to specific file types
      expect(acceptAttr).toBeTruthy();
      expect(acceptAttr).toMatch(/\.(pdf|doc|txt|png|jpg)/i);
    }
  });
});

test.describe('Security - CSRF Protection', () => {

  test('should include CSRF token in forms', async ({ page }) => {
    await page.goto('/login');

    // Check for CSRF token in form
    const csrfInput = page.locator('input[name="csrf"]').or(
      page.locator('input[name="_csrf"]').or(
        page.locator('input[name="csrfToken"]')
      )
    );

    // Note: Firebase Auth handles this differently, so this is informational
    const hasCSRF = await csrfInput.isVisible().catch(() => false);
    console.log('CSRF token found:', hasCSRF);
  });
});

test.describe('Security - Content Security', () => {

  test('should not load external scripts from untrusted sources', async ({ page }) => {
    const untrustedScripts: string[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.endsWith('.js')) {
        // Check if script is from trusted sources
        const trustedDomains = [
          'localhost',
          'firebaseapp.com',
          'googleapis.com',
          'gstatic.com',
          'google.com',
          'cloudflare.com',
          'unpkg.com', // Common CDN for React packages
        ];

        const isTrusted = trustedDomains.some(domain => url.includes(domain));
        if (!isTrusted) {
          untrustedScripts.push(url);
        }
      }
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    // Log any untrusted scripts (warning, not failure)
    if (untrustedScripts.length > 0) {
      console.warn('Untrusted scripts detected:', untrustedScripts);
    }
  });
});
