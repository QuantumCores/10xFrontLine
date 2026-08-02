// risk: standalone — a legitimate player can complete passwordless login
// seed: tests/seed.spec.ts
import { expect, test } from '@playwright/test';

const apiBaseUrl = 'http://localhost:5178/api';
const e2eAccessKey = 'frontline-e2e-access-key-2026-abcdefghijklmno';

test.describe('Legitimate player authentication', () => {
  test('user is able to login and reach protected gameplay', async ({ page }, testInfo) => {
    const email = `e2e-login-${Date.now()}-${testInfo.parallelIndex}@example.com`;

    // Open the passwordless sign-in form for the protected play route.
    await page.goto('/sign-in?returnUrl=/play');
    await page.getByLabel('Email').fill(email);

    // Request a real passwordless code and wait for the API response and route transition.
    const requestCodeResponse = page.waitForResponse(
      (response) =>
        response.url() === `${apiBaseUrl}/auth/request-code` &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Send code' }).click();
    expect((await requestCodeResponse).ok()).toBe(true);
    await page.waitForURL(/\/verify-code\?.*email=/);
    await expect(page.getByRole('heading', { name: 'Enter code' })).toBeVisible();

    // Read the code produced by the real captured-email adapter through its E2E-only seam.
    const loginCodeResponse = await page.request.post(`${apiBaseUrl}/e2e/auth/login-code`, {
      data: { email },
      headers: { 'X-FrontLine-E2E-Key': e2eAccessKey },
    });
    expect(loginCodeResponse.ok()).toBe(true);
    const { code } = (await loginCodeResponse.json()) as { code: string };

    // Verify the code and assert the protected user-visible outcome.
    await page.getByLabel('Code').fill(code);
    const verifyCodeResponse = page.waitForResponse(
      (response) =>
        response.url() === `${apiBaseUrl}/auth/verify-code` &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Verify' }).click();
    expect((await verifyCodeResponse).ok()).toBe(true);

    await page.waitForURL(/\/play$/);
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

    // Cleanup the browser session so the scenario remains independently runnable.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL(/\/sign-in$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});
