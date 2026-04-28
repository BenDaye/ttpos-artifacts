import { expect, authedTest as test } from './_fixtures/auth.fixture'
import { MOCK_ARCHITECTURES } from './_fixtures/handlers'

test.describe('Architectures CRUD', () => {
  test('displays architecture list', async ({ page }) => {
    await page.goto('/architectures')

    for (const arch of MOCK_ARCHITECTURES) {
      await expect(page.getByText(arch.ArchID, { exact: true })).toBeVisible()
    }
  })

  test('search filters architectures', async ({ page }) => {
    await page.goto('/architectures')

    await page.getByPlaceholder('Search').fill('arm64')

    await expect(page.getByText('arm64', { exact: true })).toBeVisible()
    await expect(page.getByText('amd64', { exact: true })).not.toBeVisible()
  })

  test('creates a new architecture', async ({ page }) => {
    await page.goto('/architectures')

    await page.getByRole('button', { name: 'Create' }).first().click()
    await expect(page.getByRole('heading', { name: 'Create architecture' })).toBeVisible()

    await page.getByLabel('Architecture name').fill('riscv64')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: 'Create architecture' })).not.toBeVisible({ timeout: 5000 })
  })

  test('opens edit dialog from architecture card', async ({ page }) => {
    await page.goto('/architectures')

    await page.getByRole('button', { name: 'Edit' }).first().click()

    await expect(page.getByRole('heading', { name: 'Edit architecture' })).toBeVisible()
    await expect(page.getByLabel('Architecture name')).toHaveValue('amd64')
  })

  test('deletes architecture via confirmation dialog', async ({ page }) => {
    await page.goto('/architectures')

    await page.getByRole('button', { name: 'Delete' }).first().click()
    await expect(page.getByRole('heading', { name: 'Delete architecture?' })).toBeVisible()

    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await expect(page.getByRole('heading', { name: 'Delete architecture?' })).not.toBeVisible({ timeout: 5000 })
  })

  test('cancel button closes the create dialog', async ({ page }) => {
    await page.goto('/architectures')

    await page.getByRole('button', { name: 'Create' }).first().click()
    await expect(page.getByRole('heading', { name: 'Create architecture' })).toBeVisible()

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Create architecture' })).not.toBeVisible({ timeout: 5000 })
  })
})
