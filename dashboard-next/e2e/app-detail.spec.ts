import { Buffer } from 'node:buffer'
import { expect, authedTest as test } from './_fixtures/auth.fixture'

test.describe('App detail — version management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/applications')
    await page.getByText('TTPOS-Cashier').click()
    await expect(page).toHaveURL(/\/applications\/TTPOS-Cashier/)
    // Wait for the detail page header to render so version actions are settled.
    await expect(page.getByRole('heading', { level: 1, name: 'TTPOS-Cashier' })).toBeVisible()
  })

  test('renders version row with metadata badges', async ({ page }) => {
    // Version string + channel badge.
    await expect(page.getByText('1.0.0').first()).toBeVisible()
    await expect(page.getByText('stable', { exact: true }).first()).toBeVisible()
    await expect(page.getByTestId('version-status-badge')).toBeVisible()
    // Header summary count.
    await expect(page.getByText(/version\(s\)/i)).toBeVisible()

    const positions = await page.evaluate(() => {
      const channel = document.querySelector('[data-testid="version-channel-chip"]')?.getBoundingClientRect()
      const title = document.querySelector('[data-testid="version-title"]')?.getBoundingClientRect()
      return channel && title
        ? { channelRight: channel.right, titleLeft: title.left }
        : null
    })
    expect(positions).not.toBeNull()
    expect(positions!.channelRight).toBeLessThanOrEqual(positions!.titleLeft)
  })

  test('back link returns to /applications', async ({ page }) => {
    await page.getByRole('link', { name: 'Back' }).click()
    await expect(page).toHaveURL(/\/applications$/)
  })

  test('changelog button opens preview modal', async ({ page }) => {
    await page.getByRole('button', { name: /^Changelog\s*\(\d+\)$/ }).click()

    await expect(page.getByText(/TTPOS-Cashier · v1.0.0/)).toBeVisible()
    await expect(page.getByText('Initial release')).toBeVisible()

    // Two "Close" buttons live in the dialog: the footer button (text node)
    // and the absolute X button (aria-label). Pick the footer one explicitly.
    await page.locator('button[type="button"]:visible', { hasText: /^Close$/ }).first().click()
    await expect(page.getByText('Initial release')).not.toBeVisible({ timeout: 5000 })
  })

  test('download button opens artifacts dialog with copy/download actions', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByRole('button', { name: /^Download\s*\(\d+\)$/ }).click()

    await expect(page.getByRole('heading', { name: 'Download artifacts' })).toBeVisible()
    await expect(page.getByText('cashier-1.0.0.apk').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy URL' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Copy URL' }).first().click()
    await expect(page.getByText('URL copied')).toBeVisible()

    await page.locator('button[type="button"]:visible', { hasText: /^Close$/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Download artifacts' })).not.toBeVisible({ timeout: 5000 })
  })

  test('edit dialog pre-fills version data', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).first().click()

    await expect(page.getByRole('heading', { name: 'Edit version' })).toBeVisible()
    await expect(page.getByRole('textbox').first()).toHaveValue('1.0.0')

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Edit version' })).not.toBeVisible({ timeout: 5000 })
  })

  test('version filter bar exposes channel/platform/arch popovers + search', async ({ page }) => {
    await expect(page.getByPlaceholder(/Search version/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Channels' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Platforms' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Architectures' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Published only' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Critical only' })).toBeVisible()
  })

  test('upload version button opens upload dialog with app pre-filled', async ({ page }) => {
    await page.getByRole('button', { name: 'Upload version' }).click()

    await expect(page.getByRole('heading', { name: 'Upload new version' })).toBeVisible()
  })

  test('upload version submits updater and intermediate fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Upload version' }).click()

    const dialog = page.getByRole('dialog', { name: 'Upload new version' })
    await dialog.getByPlaceholder('1.2.3').fill('1.1.0')
    await dialog.locator('select').nth(0).selectOption('stable')
    await dialog.locator('select').nth(2).selectOption('arm64')
    await dialog.locator('select').nth(1).selectOption('android')
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'cashier-1.1.0.apk',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('apk'),
    })

    await dialog.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })

  test('add artifact dialog exposes updater-specific fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Add artifact' }).click()

    const dialog = page.getByRole('dialog', { name: /Add artifact to 1\.0\.0/ })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Platform', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Architecture', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Artifacts', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Changelog', { exact: true })).not.toBeVisible()
    await dialog.locator('select').nth(0).selectOption('android')
    await expect(dialog.getByText('Updater', { exact: true })).toBeVisible()
    await dialog.locator('select').nth(1).selectOption('tauri')
    await expect(dialog.getByText('Signature', { exact: true })).toBeVisible()
    // App + channel context line is auto-filled from the version row.
    await expect(dialog.getByText(/App:\s*TTPOS-Cashier.*Channel:\s*stable/)).toBeVisible()

    await page.locator('button[type="button"]:visible', { hasText: /^Cancel$/ }).first().click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })

  test('add artifact submits updater and preserves intermediate flag', async ({ page }) => {
    await page.getByRole('button', { name: 'Add artifact' }).click()

    const dialog = page.getByRole('dialog', { name: /Add artifact to 1\.0\.0/ })
    await dialog.locator('select').nth(0).selectOption('android')
    await dialog.locator('select').nth(2).selectOption('arm64')
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'cashier-1.0.0-arm64.apk',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('apk'),
    })

    await dialog.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })
})
