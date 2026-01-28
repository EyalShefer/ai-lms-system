import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 *
 * Tests the login flow and protected routes
 */

test.describe('Authentication', () => {

  test('should display login page for unauthenticated users', async ({ page }) => {
    await page.goto('/');

    // Should redirect to login or show login form
    await expect(page.locator('text=התחברות').or(page.locator('text=כניסה'))).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');

    // Click login button
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=שגיאה').or(page.locator('[role="alert"]'))).toBeVisible({
      timeout: 10000
    });
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    // Skip if no test credentials are configured
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

    // Should redirect to dashboard
    await expect(page).toHaveURL(/dashboard|home|courses/, { timeout: 15000 });
  });

  test('should protect dashboard route', async ({ page }) => {
    // Try to access dashboard directly without login
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/login|auth/, { timeout: 10000 });
  });

  test('should logout successfully', async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/dashboard|home|courses/, { timeout: 15000 });

    // Find and click logout button
    const logoutButton = page.locator('text=התנתק').or(page.locator('text=יציאה'));
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await expect(page).toHaveURL(/login|auth|\/$/, { timeout: 10000 });
    }
  });
});
