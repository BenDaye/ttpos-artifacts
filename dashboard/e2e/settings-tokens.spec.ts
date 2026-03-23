import { test, expect } from './fixtures/auth.fixture';

test.describe('Settings — CI/CD Tokens', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/tokens');
  });

  test('displays token creation form', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Create CI/CD Token' })
    ).toBeVisible();
    await expect(page.getByPlaceholder('GitHub Actions - MyApp')).toBeVisible();
    await expect(page.getByText('Expiration')).toBeVisible();
    await expect(page.getByText('Create token')).toBeVisible();
  });

  test('expiration dropdown has all options', async ({ page }) => {
    const select = page.locator('select');
    await expect(select).toBeVisible();

    const options = await select.locator('option').allInnerTexts();
    expect(options).toEqual(['1 day', '7 days', '30 days', '90 days', 'Never']);
  });

  test('shows issued tokens table', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Issued tokens' })
    ).toBeVisible();

    // Table headers
    await expect(
      page.getByRole('columnheader', { name: 'Name' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Prefix' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Allowed apps' })
    ).toBeVisible();

    // Token row data
    await expect(page.getByText('GitHub Actions')).toBeVisible();
    await expect(page.getByText('fns_abc12345')).toBeVisible();
  });

  test('validates required fields before creating', async ({ page }) => {
    // No name → click create → expect toast error
    await page.getByRole('button', { name: /Create token/i }).click();

    // Toast: "Token name is required"
    await expect(page.getByText('Token name is required')).toBeVisible({
      timeout: 3000,
    });
  });

  test('validates at least one app must be selected', async ({ page }) => {
    await page.getByPlaceholder('GitHub Actions - MyApp').fill('Deploy Token');
    await page.getByRole('button', { name: /Create token/i }).click();

    // Toast: requires allowed apps
    await expect(
      page.getByText('Please select at least one allowed app')
    ).toBeVisible({ timeout: 3000 });
  });

  test('revoke button exists on token rows', async ({ page }) => {
    await expect(page.getByTitle('Revoke token')).toBeVisible();
  });

  test('select allowed apps button shows count', async ({ page }) => {
    await expect(page.getByText(/Select allowed apps/)).toBeVisible();
  });
});
