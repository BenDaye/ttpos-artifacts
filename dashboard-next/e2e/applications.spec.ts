import { expect, authedTest as test } from './_fixtures/auth.fixture'
import { MOCK_APPS } from './_fixtures/handlers'

test.describe('Applications page', () => {
  test('displays app list from mock data', async ({ page }) => {
    await page.goto('/applications')

    for (const app of MOCK_APPS) {
      await expect(page.getByText(app.AppName)).toBeVisible()
    }
  })

  test('navigates to app detail on card click', async ({ page }) => {
    await page.goto('/applications')

    await page.getByText('TTPOS-Cashier').click()
    await expect(page).toHaveURL(/\/applications\/TTPOS-Cashier/)
  })

  test('search filters applications', async ({ page }) => {
    await page.goto('/applications')

    await page.getByPlaceholder('Search').fill('KDS')

    await expect(page.getByText('TTPOS-KDS')).toBeVisible()
    await expect(page.getByText('TTPOS-Cashier')).not.toBeVisible()
  })

  test('search with no results shows empty state', async ({ page }) => {
    await page.goto('/applications')

    await page.getByPlaceholder('Search').fill('nonexistent-app-xyz')

    await expect(page.getByText('TTPOS-Cashier')).not.toBeVisible()
    await expect(page.getByText('TTPOS-KDS')).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'No applications yet' })).toBeVisible()
  })

  test('layout switcher exposes card / list / board buttons', async ({ page }) => {
    await page.goto('/applications')

    await expect(page.getByRole('button', { name: 'Card view' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'List view' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Board view' })).toBeVisible()

    await page.getByRole('button', { name: 'List view' }).click()
    // Switching layouts must keep apps reachable.
    await expect(page.getByText('TTPOS-Cashier')).toBeVisible()
  })

  test('board view shows one column per app with version cards inside', async ({ page }) => {
    await page.goto('/applications')

    await page.getByRole('button', { name: 'Board view' }).click()

    // Each app gets its own column header (app name + version count).
    await expect(page.getByText('TTPOS-Cashier')).toBeVisible()
    await expect(page.getByText('TTPOS-KDS')).toBeVisible()
    // Mocked search returns 1 version per app, so both columns render the
    // 1.0.0 / stable badge inside their version card.
    await expect(page.getByText('1.0.0').first()).toBeVisible()
    await expect(page.getByText('stable', { exact: true }).first()).toBeVisible()
  })

  test('board version card opens quick detail dialog without leaving board', async ({ page }) => {
    await page.goto('/applications')

    await page.getByRole('button', { name: 'Board view' }).click()
    await page.getByTestId('board-version-card').first().click()

    await expect(page).toHaveURL(/\/applications$/)
    const dialog = page.getByTestId('version-detail-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('version-detail-title')).toHaveText('1.0.0')
    await expect(dialog.getByTestId('version-detail-title')).toHaveAttribute('data-version-tone', 'published')
    await expect(dialog.getByTestId('version-detail-channel-chip')).toHaveText('STABLE')
    await expect(dialog.getByTestId('version-detail-status')).toContainText('Published')
    await expect(dialog.getByText('cashier-1.0.0.apk')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Add artifact' })).toBeVisible()

    await dialog.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit version' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Edit version' })).not.toBeVisible({ timeout: 5000 })

    await dialog.locator('button[type="button"]:visible', { hasText: /^Close$/ }).first().click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await page.locator('.app-board-column > button').first().click()
    await expect(page).toHaveURL(/\/applications\/TTPOS-Cashier/)
  })

  test('new app button opens create dialog', async ({ page }) => {
    await page.goto('/applications')

    await page.getByRole('button', { name: 'New app' }).first().click()
    await expect(page.getByRole('heading', { name: 'Create application' })).toBeVisible()
  })
})
