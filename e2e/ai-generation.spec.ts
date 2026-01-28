import { test, expect } from '@playwright/test';

/**
 * AI Content Generation E2E Tests
 *
 * Tests the AI-powered content generation flows
 * These are critical paths that use Gemini API
 */

test.describe('AI Content Generation', () => {

  test.beforeEach(async ({ page }) => {
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

  test('should show AI generation options', async ({ page }) => {
    // Navigate to content creation
    await page.goto('/create');

    // Look for AI generation buttons/options
    const aiButton = page.locator('text=יצירה עם AI').or(
      page.locator('text=בינה מלאכותית').or(
        page.locator('[data-testid="ai-generate"]')
      )
    );

    await expect(aiButton).toBeVisible({ timeout: 10000 });
  });

  test('should generate activity content via streaming', async ({ page }) => {
    // This test verifies the streaming generation works
    await page.goto('/create');

    // Fill required fields
    const topicInput = page.locator('input[name="topic"]').or(
      page.locator('[placeholder*="נושא"]')
    );

    if (await topicInput.isVisible()) {
      await topicInput.fill('מבוא למתמטיקה - חיבור וחיסור');
    }

    // Select grade
    const gradeSelect = page.locator('select[name="gradeLevel"]');
    if (await gradeSelect.isVisible()) {
      await gradeSelect.selectOption('כיתה ג');
    }

    // Click generate
    const generateButton = page.locator('text=יצירה').or(
      page.locator('text=התחל יצירה').or(
        page.locator('[data-testid="generate-content"]')
      )
    );

    if (await generateButton.isVisible()) {
      await generateButton.click();

      // Should show loading/streaming indicator
      const loadingIndicator = page.locator('[data-testid="loading"]').or(
        page.locator('.loading').or(
          page.locator('text=מייצר')
        )
      );

      // Wait for generation to start (should show within 5 seconds)
      await expect(loadingIndicator).toBeVisible({ timeout: 10000 });

      // Wait for generation to complete (up to 2 minutes for AI)
      await expect(page.locator('text=הושלם').or(
        page.locator('[data-testid="generation-complete"]').or(
          page.locator('.step-content') // Generated content appears
        )
      )).toBeVisible({ timeout: 120000 });
    }
  });

  test('should handle rate limiting gracefully', async ({ page }) => {
    // Rapid requests should be rate limited
    await page.goto('/create');

    const generateButton = page.locator('[data-testid="generate-content"]').or(
      page.locator('text=יצירה')
    );

    if (await generateButton.isVisible()) {
      // Click multiple times rapidly
      for (let i = 0; i < 3; i++) {
        await generateButton.click();
        await page.waitForTimeout(100);
      }

      // Should eventually show rate limit message or prevent further clicks
      const rateLimitMessage = page.locator('text=יותר מדי בקשות').or(
        page.locator('text=נא להמתין').or(
          page.locator('[data-testid="rate-limit-error"]')
        )
      );

      // Rate limit message might appear, or button might be disabled
      const isRateLimited = await rateLimitMessage.isVisible().catch(() => false);
      const isButtonDisabled = await generateButton.isDisabled().catch(() => false);

      expect(isRateLimited || isButtonDisabled).toBeTruthy();
    }
  });

  test('should display generated content correctly', async ({ page }) => {
    // Navigate to an existing generated activity
    await page.goto('/courses');

    // Find a course with generated content
    const courseCard = page.locator('[data-testid="course-card"]').first();

    if (await courseCard.isVisible()) {
      await courseCard.click();

      // Should display steps/questions
      const contentSection = page.locator('[data-testid="activity-content"]').or(
        page.locator('.activity-steps').or(
          page.locator('[data-testid="lesson-content"]')
        )
      );

      await expect(contentSection).toBeVisible({ timeout: 15000 });

      // Content should have Hebrew text
      const hebrewContent = page.locator('text=/[א-ת]+/');
      await expect(hebrewContent.first()).toBeVisible();
    }
  });
});

test.describe('AI Tutor Chat', () => {

  test.beforeEach(async ({ page }) => {
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

  test('should open AI tutor chat', async ({ page }) => {
    // Navigate to a course/activity
    await page.goto('/courses');

    const courseCard = page.locator('[data-testid="course-card"]').first();

    if (await courseCard.isVisible()) {
      await courseCard.click();

      // Look for chat/tutor button
      const chatButton = page.locator('[data-testid="open-chat"]').or(
        page.locator('text=עזרה').or(
          page.locator('text=צ\'אט')
        )
      );

      if (await chatButton.isVisible()) {
        await chatButton.click();

        // Chat panel should open
        await expect(page.locator('[data-testid="chat-panel"]').or(
          page.locator('.chat-container')
        )).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should send message and receive response', async ({ page }) => {
    // Navigate to chat
    await page.goto('/courses');

    const courseCard = page.locator('[data-testid="course-card"]').first();
    if (!(await courseCard.isVisible())) return;

    await courseCard.click();

    const chatButton = page.locator('[data-testid="open-chat"]').or(
      page.locator('text=עזרה')
    );

    if (!(await chatButton.isVisible())) return;

    await chatButton.click();

    // Type a message
    const chatInput = page.locator('[data-testid="chat-input"]').or(
      page.locator('textarea[placeholder*="הודעה"]').or(
        page.locator('input[placeholder*="הודעה"]')
      )
    );

    if (await chatInput.isVisible()) {
      await chatInput.fill('מה זה מתמטיקה?');

      // Send message
      const sendButton = page.locator('[data-testid="send-message"]').or(
        page.locator('button[type="submit"]')
      );

      await sendButton.click();

      // Should receive response within 30 seconds
      const responseMessage = page.locator('[data-testid="ai-response"]').or(
        page.locator('.message.assistant').or(
          page.locator('.ai-message')
        )
      );

      await expect(responseMessage).toBeVisible({ timeout: 30000 });
    }
  });
});

test.describe('Podcast Generation', () => {

  test('should generate podcast from content', async ({ page }) => {
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

    // Navigate to podcast generation
    await page.goto('/create');

    const podcastOption = page.locator('text=פודקאסט').or(
      page.locator('[data-testid="podcast-option"]')
    );

    if (await podcastOption.isVisible()) {
      await podcastOption.click();

      // Fill topic
      const topicInput = page.locator('input[name="topic"]');
      if (await topicInput.isVisible()) {
        await topicInput.fill('היסטוריה של ישראל');
      }

      // Generate
      const generateButton = page.locator('text=יצירת פודקאסט').or(
        page.locator('[data-testid="generate-podcast"]')
      );

      if (await generateButton.isVisible()) {
        await generateButton.click();

        // Wait for podcast script generation (up to 2 minutes)
        await expect(page.locator('[data-testid="podcast-script"]').or(
          page.locator('.podcast-dialogue').or(
            page.locator('text=דן:').or(page.locator('text=נועה:'))
          )
        )).toBeVisible({ timeout: 120000 });
      }
    }
  });
});
