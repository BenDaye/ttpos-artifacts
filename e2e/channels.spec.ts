import { expect, authedTest as test } from './_fixtures/auth.fixture'
import { MOCK_CHANNELS } from './_fixtures/handlers'

test.describe('Channels CRUD', () => {
  test('displays channel list', async ({ page }) => {
    await page.goto('/channels')

    for (const channel of MOCK_CHANNELS) {
      await expect(page.getByText(channel.ChannelName, { exact: true })).toBeVisible()
    }
  })

  test('search filters channels', async ({ page }) => {
    await page.goto('/channels')

    await page.getByPlaceholder('Search').fill('beta')

    await expect(page.getByText('beta', { exact: true })).toBeVisible()
    await expect(page.getByText('stable', { exact: true })).not.toBeVisible()
  })

  test('creates a new channel', async ({ page }) => {
    await page.goto('/channels')

    await page.getByRole('button', { name: 'Create' }).first().click()
    await expect(page.getByRole('heading', { name: 'Create channel' })).toBeVisible()

    await page.getByLabel('Channel name').fill('nightly')
    // EntityFormDialog defaults submit label to "Save" when no submitLabel is provided.
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: 'Create channel' })).not.toBeVisible({ timeout: 5000 })
  })

  test('opens edit dialog from channel card', async ({ page }) => {
    await page.goto('/channels')

    // Click the edit icon button on the "stable" card (first card).
    await page.getByRole('button', { name: 'Edit' }).first().click()

    await expect(page.getByRole('heading', { name: 'Edit channel' })).toBeVisible()
    await expect(page.getByLabel('Channel name')).toHaveValue('stable')
  })

  test('deletes a channel via confirmation dialog', async ({ page }) => {
    await page.goto('/channels')

    await page.getByRole('button', { name: 'Delete' }).first().click()
    await expect(page.getByRole('heading', { name: 'Delete channel?' })).toBeVisible()

    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await expect(page.getByRole('heading', { name: 'Delete channel?' })).not.toBeVisible({ timeout: 5000 })
  })

  test('cancel button closes the dialog without changes', async ({ page }) => {
    await page.goto('/channels')

    await page.getByRole('button', { name: 'Create' }).first().click()
    await expect(page.getByRole('heading', { name: 'Create channel' })).toBeVisible()

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Create channel' })).not.toBeVisible({ timeout: 5000 })
  })
})
