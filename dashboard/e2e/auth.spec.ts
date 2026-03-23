import { test, expect } from '@playwright/test';
import { setupMockApi, TEST_TOKEN } from './mocks/handlers';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test('redirects unauthenticated user to /signin', async ({ page }) => {
    await page.goto('/applications');
    await expect(page).toHaveURL(/\/signin/);
  });

  test('signs in with valid credentials', async ({ page }) => {
    await page.goto('/signin');

    await page.getByPlaceholder('Username').fill('admin');
    await page.getByPlaceholder('password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL(/\/applications/);
  });

  test('shows validation errors for empty form', async ({ page }) => {
    await page.goto('/signin');

    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByText('Required field').first()).toBeVisible();
  });

  test('shows minimum length error for short username', async ({ page }) => {
    await page.goto('/signin');

    await page.getByPlaceholder('Username').fill('ab');
    await page.getByPlaceholder('password').fill('123');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByText('Minimum 3 symbol')).toBeVisible();
    await expect(page.getByText('Minimum 6 symbol')).toBeVisible();
  });

  test('shows server error on bad credentials', async ({ page }) => {
    // Override login mock to return error
    await page.route('**/login', (route) =>
      route.fulfill({
        status: 401,
        json: { error: 'Invalid username or password' },
      }),
    );

    await page.goto('/signin');
    await page.getByPlaceholder('Username').fill('admin');
    await page.getByPlaceholder('password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByText('Invalid username or password')).toBeVisible();
  });

  test('logout redirects to /signin', async ({ page }) => {
    // Inject token to start authenticated
    await page.addInitScript((token: string) => {
      window.localStorage.setItem('token', token);
    }, TEST_TOKEN);

    await page.goto('/applications');
    await expect(page).toHaveURL(/\/applications/);

    // Open settings menu
    await page.getByLabel('Settings').first().click();
    await page.getByText('Logout').click();

    await expect(page).toHaveURL(/\/signin/);
  });

  test('preserves redirect path after login', async ({ page }) => {
    // Try to access /channels without auth
    await page.goto('/channels');
    await expect(page).toHaveURL(/\/signin/);

    // Login
    await page.getByPlaceholder('Username').fill('admin');
    await page.getByPlaceholder('password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();

    // Should redirect back to /channels
    await expect(page).toHaveURL(/\/channels/);
  });
});
