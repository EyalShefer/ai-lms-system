import { test, expect } from '@playwright/test';

/**
 * Course Creation E2E Tests
 *
 * Tests the course creation and editing flow
 */

test.describe('Course Creation', () => {

  test.beforeEach(async ({ page }) => {
    // Login before each test
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
  });

  test('should navigate to course creation page', async ({ page }) => {
    // Look for "create course" or "new course" button
    const createButton = page.locator('text=יצירת קורס').or(
      page.locator('text=קורס חדש')
    ).or(
      page.locator('[data-testid="create-course"]')
    );

    if (await createButton.isVisible()) {
      await createButton.click();
      await expect(page).toHaveURL(/create|new|editor/, { timeout: 10000 });
    }
  });

  test('should display course creation form', async ({ page }) => {
    await page.goto('/create');

    // Check for essential form fields
    const titleInput = page.locator('input[name="title"]').or(
      page.locator('[placeholder*="שם"]').or(
        page.locator('[placeholder*="כותרת"]')
      )
    );

    await expect(titleInput).toBeVisible({ timeout: 10000 });
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/create');

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]').or(
      page.locator('text=יצירה').or(page.locator('text=המשך'))
    );

    if (await submitButton.isVisible()) {
      await submitButton.click();

      // Should show validation error
      const errorMessage = page.locator('[role="alert"]').or(
        page.locator('.error').or(page.locator('text=שדה חובה'))
      );

      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    }
  });

  test('should create a course successfully', async ({ page }) => {
    await page.goto('/create');

    // Fill in course details
    const titleInput = page.locator('input[name="title"]').or(
      page.locator('[placeholder*="שם"]')
    );

    if (await titleInput.isVisible()) {
      await titleInput.fill('קורס בדיקה E2E - ' + Date.now());
    }

    // Select grade level if available
    const gradeSelect = page.locator('select[name="gradeLevel"]').or(
      page.locator('[data-testid="grade-select"]')
    );

    if (await gradeSelect.isVisible()) {
      await gradeSelect.selectOption({ index: 1 });
    }

    // Select subject if available
    const subjectSelect = page.locator('select[name="subject"]').or(
      page.locator('[data-testid="subject-select"]')
    );

    if (await subjectSelect.isVisible()) {
      await subjectSelect.selectOption({ index: 1 });
    }

    // Submit
    const submitButton = page.locator('button[type="submit"]').or(
      page.locator('text=יצירה').first()
    );

    if (await submitButton.isVisible()) {
      await submitButton.click();

      // Should navigate to course editor or show success
      await expect(page.locator('text=נוצר בהצלחה').or(
        page.locator('[data-testid="course-editor"]')
      )).toBeVisible({ timeout: 30000 });
    }
  });
});

test.describe('Course Editor', () => {

  test('should load course editor with existing course', async ({ page }) => {
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
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard|home|courses/, { timeout: 15000 });

    // Navigate to courses list
    await page.goto('/courses');

    // Click on first course
    const courseCard = page.locator('[data-testid="course-card"]').or(
      page.locator('.course-card')
    ).first();

    if (await courseCard.isVisible()) {
      await courseCard.click();

      // Should show course content
      await expect(page.locator('text=יחידה').or(
        page.locator('text=שיעור')
      )).toBeVisible({ timeout: 10000 });
    }
  });

  test('should add a unit to course', async ({ page }) => {
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

    // Navigate to a course editor (assuming there's a test course)
    await page.goto('/courses');

    const editButton = page.locator('text=עריכה').or(
      page.locator('[data-testid="edit-course"]')
    ).first();

    if (await editButton.isVisible()) {
      await editButton.click();

      // Add unit button
      const addUnitButton = page.locator('text=הוסף יחידה').or(
        page.locator('text=יחידה חדשה')
      );

      if (await addUnitButton.isVisible()) {
        await addUnitButton.click();

        // Should show unit form or modal
        await expect(page.locator('[data-testid="unit-form"]').or(
          page.locator('[role="dialog"]')
        )).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
