// Seed exemplar for generated E2E tests. Playwright ignores this file via testIgnore.
// Keep it aligned with the E2E rules in the repository AGENTS.md.
import { expect, test } from '@playwright/test';

test('unauthenticated player is redirected to sign in', async ({ page }) => {
  // Start from a protected route with a fresh browser context.
  await page.goto('/play');

  // Wait for the observable routing outcome, never for elapsed time.
  await page.waitForURL(/\/sign-in\?returnUrl=%2Fplay$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
