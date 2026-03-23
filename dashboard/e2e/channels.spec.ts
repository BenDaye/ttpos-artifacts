import { test, expect } from './fixtures/auth.fixture';
import { MOCK_CHANNELS } from './mocks/handlers';

test.describe('Channels CRUD', () => {
  test('displays channel list', async ({ page }) => {
    await page.goto('/channels');

    for (const channel of MOCK_CHANNELS) {
      await expect(page.getByText(channel.ChannelName)).toBeVisible();
    }
  });

  test('creates a new channel', async ({ page }) => {
    await page.goto('/channels');

    await page.getByText('Create Channel').click();

    // Custom modal (no role="dialog") — use label to find input
    await page.getByLabel('Channel Name').fill('nightly');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Modal should close after successful creation
    await expect(page.getByLabel('Channel Name')).not.toBeVisible({ timeout: 5000 });
  });

  test('opens edit modal on channel card click', async ({ page }) => {
    await page.goto('/channels');

    await page.getByText('stable').click();

    // Edit Channel modal has a heading and "Rename Channel" label
    await expect(page.getByText('Edit Channel')).toBeVisible();
  });

  test('deletes a channel with confirmation', async ({ page }) => {
    await page.goto('/channels');

    // Click the trash icon button (has title="Delete channel")
    await page.getByTitle('Delete channel').first().click();

    // "Delete Confirmation" heading should appear
    await expect(page.getByRole('heading', { name: 'Delete Confirmation' })).toBeVisible();

    // Type the channel name to enable the Delete button
    await page.locator('.modal-overlay-high input').fill('stable');
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
  });

  test('search filters channels', async ({ page }) => {
    await page.goto('/channels');

    await page.getByPlaceholder('Search...').fill('stable');

    await expect(page.getByText('stable')).toBeVisible();
    await expect(page.getByText('beta')).not.toBeVisible();
  });

  test('shows empty state when no channels match search', async ({ page }) => {
    await page.goto('/channels');

    await page.getByPlaceholder('Search...').fill('nonexistent');

    await expect(page.getByText('No channels found matching your search.')).toBeVisible();
  });
});
