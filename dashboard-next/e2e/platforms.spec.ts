import { expect, authedTest as test } from './_fixtures/auth.fixture'
import { MOCK_PLATFORMS } from './_fixtures/handlers'

test.describe('Platforms CRUD', () => {
  test('displays platform list', async ({ page }) => {
    await page.goto('/platforms')

    for (const platform of MOCK_PLATFORMS) {
      await expect(page.getByText(platform.PlatformName, { exact: true })).toBeVisible()
    }
  })

  test('search filters platforms', async ({ page }) => {
    await page.goto('/platforms')

    await page.getByPlaceholder('Search').fill('windows')

    await expect(page.getByText('windows', { exact: true })).toBeVisible()
    await expect(page.getByText('android', { exact: true })).not.toBeVisible()
  })

  test('creates a new platform', async ({ page }) => {
    await page.goto('/platforms')

    await page.getByRole('button', { name: 'Create' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Create platform' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Manual', { exact: true }).last()).toBeVisible()

    await page.getByLabel('Platform name').fill('linux')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: 'Create platform' })).not.toBeVisible({ timeout: 5000 })
  })

  test('opens edit dialog from platform card', async ({ page }) => {
    await page.goto('/platforms')

    await page.getByRole('button', { name: 'Edit' }).first().click()

    await expect(page.getByRole('heading', { name: 'Edit platform' })).toBeVisible()
    await expect(page.getByLabel('Platform name')).toHaveValue('android')
  })

  test('deletes platform via confirmation dialog', async ({ page }) => {
    await page.goto('/platforms')

    await page.getByRole('button', { name: 'Delete' }).first().click()
    await expect(page.getByRole('heading', { name: 'Delete platform?' })).toBeVisible()

    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await expect(page.getByRole('heading', { name: 'Delete platform?' })).not.toBeVisible({ timeout: 5000 })
  })

  test('cancel button closes the create dialog', async ({ page }) => {
    await page.goto('/platforms')

    await page.getByRole('button', { name: 'Create' }).first().click()
    await expect(page.getByRole('heading', { name: 'Create platform' })).toBeVisible()

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Create platform' })).not.toBeVisible({ timeout: 5000 })
  })
})
