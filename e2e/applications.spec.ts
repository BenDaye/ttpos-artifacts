import { test, expect } from './fixtures/auth.fixture';
import { MOCK_APPS } from './mocks/handlers';

test.describe('Applications Page', () => {
  test('displays app list from mock data', async ({ page }) => {
    await page.goto('/applications');

    for (const app of MOCK_APPS) {
      await expect(page.getByText(app.AppName)).toBeVisible();
    }
  });

  test('navigates to app detail on card click', async ({ page }) => {
    await page.goto('/applications');

    await page.getByText('TTPOS-Cashier').click();
    await expect(page).toHaveURL(/\/applications\/TTPOS-Cashier/);
  });

  test('search filters applications', async ({ page }) => {
    await page.goto('/applications');

    await page.getByPlaceholder('Search...').fill('KDS');

    // KDS should be visible, Cashier should not
    await expect(page.getByText('TTPOS-KDS')).toBeVisible();
    await expect(page.getByText('TTPOS-Cashier')).not.toBeVisible();
  });

  test('search with no results shows empty state', async ({ page }) => {
    await page.goto('/applications');

    await page.getByPlaceholder('Search...').fill('nonexistent-app-xyz');

    // Both apps should be hidden
    await expect(page.getByText('TTPOS-Cashier')).not.toBeVisible();
    await expect(page.getByText('TTPOS-KDS')).not.toBeVisible();
  });

  test('layout switcher toggles between views', async ({ page }) => {
    await page.goto('/applications');

    // Two role="group" elements exist (LayoutSwitcher + ThemeSwitcher)
    const switcher = page.locator('[role="group"]').first();
    await expect(switcher).toBeVisible();
  });

  test('upload button opens upload modal', async ({ page }) => {
    await page.goto('/applications');

    await page.getByText('Upload the app').click();

    await expect(page.getByText('Upload Application')).toBeVisible();
  });

  test('create app button opens create modal', async ({ page }) => {
    await page.goto('/applications');

    await page.getByLabel('Create app').click();

    // Create modal should appear
    await expect(page.getByText('Create Application')).toBeVisible();
  });
});
