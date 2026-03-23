import { test, expect } from './fixtures/auth.fixture';
import { MOCK_PLATFORMS } from './mocks/handlers';

test.describe('Platforms CRUD', () => {
  test('displays platform list with updater info', async ({ page }) => {
    await page.goto('/platforms');

    for (const platform of MOCK_PLATFORMS) {
      await expect(page.getByText(platform.PlatformName)).toBeVisible();
    }

    // Each platform shows updater count and default
    await expect(page.getByText('1 updater').first()).toBeVisible();
    await expect(page.getByText('Default: manual').first()).toBeVisible();
  });

  test('creates a new platform', async ({ page }) => {
    await page.goto('/platforms');

    await page.getByText('Create Platform').click();

    await expect(page.getByRole('heading', { name: 'Create Platform' })).toBeVisible();

    // Fill name — Create button should be disabled until name entered
    await page.getByLabel('Platform Name').fill('linux');

    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Modal should close
    await expect(page.getByLabel('Platform Name')).not.toBeVisible({ timeout: 5000 });
  });

  test('updaters section expands with available options', async ({ page }) => {
    await page.goto('/platforms');

    await page.getByText('Create Platform').click();

    // Expand updaters
    await page.getByLabel('Expand updaters').click();

    // Should show all updater types
    await expect(page.getByRole('heading', { name: 'Manual', level: 4 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Squirrel (Darwin)', level: 4 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tauri', level: 4 })).toBeVisible();

    // Collapse
    await page.getByLabel('Collapse updaters').click();
    await expect(page.getByRole('heading', { name: 'Squirrel (Darwin)', level: 4 })).not.toBeVisible();
  });

  test('opens edit modal on card click', async ({ page }) => {
    await page.goto('/platforms');

    await page.getByText('android').click();

    await expect(page.getByRole('heading', { name: 'Edit Platform' })).toBeVisible();
    // Input pre-filled
    await expect(page.getByLabel('Platform Name')).toHaveValue('android');
  });

  test('deletes platform with type-to-confirm', async ({ page }) => {
    await page.goto('/platforms');

    await page.getByTitle('Delete platform').first().click();

    await expect(page.getByRole('heading', { name: 'Delete Confirmation' })).toBeVisible();

    // Delete button disabled until name typed
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();

    await page.getByPlaceholder('Enter platform name').fill('android');

    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
  });

  test('search filters platforms', async ({ page }) => {
    await page.goto('/platforms');

    await page.getByPlaceholder('Search...').fill('android');

    await expect(page.getByText('android')).toBeVisible();
    await expect(page.getByText('windows')).not.toBeVisible();
  });

  test('shows empty state when no matches', async ({ page }) => {
    await page.goto('/platforms');

    await page.getByPlaceholder('Search...').fill('nonexistent');

    await expect(page.getByText('No platforms found matching your search.')).toBeVisible();
  });
});
