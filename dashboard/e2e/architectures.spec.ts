import { test, expect } from './fixtures/auth.fixture';
import { MOCK_ARCHITECTURES } from './mocks/handlers';

test.describe('Architectures CRUD', () => {
  test('displays architecture list', async ({ page }) => {
    await page.goto('/architectures');

    for (const arch of MOCK_ARCHITECTURES) {
      await expect(page.getByText(arch.ArchID)).toBeVisible();
    }
  });

  test('creates a new architecture', async ({ page }) => {
    await page.goto('/architectures');

    await page.getByText('Create Architecture').click();

    await expect(page.getByRole('heading', { name: 'Create Architecture' })).toBeVisible();

    await page.getByLabel('Architecture Name').fill('riscv64');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Modal should close
    await expect(page.getByLabel('Architecture Name')).not.toBeVisible({ timeout: 5000 });
  });

  test('opens edit modal on card click', async ({ page }) => {
    await page.goto('/architectures');

    await page.getByText('amd64').click();

    await expect(page.getByRole('heading', { name: 'Edit Architecture' })).toBeVisible();
    await expect(page.getByLabel('Rename Architecture')).toHaveValue('amd64');
  });

  test('deletes architecture with type-to-confirm', async ({ page }) => {
    await page.goto('/architectures');

    await page.getByTitle('Delete architecture').first().click();

    await expect(page.getByRole('heading', { name: 'Delete Confirmation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();

    await page.getByPlaceholder('Enter architecture name').fill('amd64');

    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
  });

  test('search filters architectures', async ({ page }) => {
    await page.goto('/architectures');

    await page.getByPlaceholder('Search...').fill('arm');

    await expect(page.getByText('arm64')).toBeVisible();
    await expect(page.getByText('amd64')).not.toBeVisible();
  });

  test('shows empty state when no matches', async ({ page }) => {
    await page.goto('/architectures');

    await page.getByPlaceholder('Search...').fill('nonexistent');

    await expect(page.getByText('No architectures found matching your search.')).toBeVisible();
  });
});
