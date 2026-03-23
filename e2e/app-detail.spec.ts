import { test, expect } from './fixtures/auth.fixture';

test.describe('App Detail — Version Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/applications');
    await page.getByText('TTPOS-Cashier').click();
    await expect(page).toHaveURL(/\/applications\/TTPOS-Cashier/);
  });

  test('shows version list with metadata', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Version 1.0.0' })
    ).toBeVisible();
    await expect(page.getByText('Channel: stable')).toBeVisible();
    await expect(page.getByText('Published')).toBeVisible();
  });

  test('back button returns to app list', async ({ page }) => {
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/applications$/);
  });

  test('channel filter dropdown has options', async ({ page }) => {
    await page.getByText('All Channels').click();

    // Dropdown should show channel options
    await expect(page.getByRole('option', { name: 'stable' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'beta' })).toBeVisible();
  });

  test('download modal shows artifact details', async ({ page }) => {
    await page.getByTitle('Download').click();

    await expect(page.getByText('Select Artifact to Download')).toBeVisible();

    // Artifact info — use .first() since "android" also appears in the version card behind
    await expect(page.getByText('Architecture: arm64').first()).toBeVisible();

    // Share link
    await expect(page.getByText('Share link:').first()).toBeVisible();

    // Close
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(
      page.getByText('Select Artifact to Download')
    ).not.toBeVisible();
  });

  test('edit version modal shows pre-filled data', async ({ page }) => {
    await page.getByTitle('Edit').click();

    await expect(page.getByText('Edit Version 1.0.0')).toBeVisible();
    await expect(page.getByText('App Name: TTPOS-Cashier')).toBeVisible();

    // Existing artifacts section
    await expect(
      page.getByRole('heading', { name: 'Existing Artifacts' })
    ).toBeVisible();

    // Changelog textarea pre-filled
    await expect(
      page.getByPlaceholder('Enter changelog in Markdown format...')
    ).toBeVisible();

    // Checkboxes
    await expect(page.getByLabel('Published')).toBeVisible();
    await expect(page.getByLabel('Critical')).toBeVisible();
    await expect(page.getByLabel('Intermediate')).toBeVisible();

    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Edit Version 1.0.0')).not.toBeVisible();
  });

  test('changelog modal displays version info', async ({ page }) => {
    await page.getByRole('button', { name: 'View full changelog' }).click();

    await expect(
      page.getByText('Changelog for TTPOS-Cashier v1.0.0')
    ).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(
      page.getByText('Changelog for TTPOS-Cashier v1.0.0')
    ).not.toBeVisible();
  });
});
