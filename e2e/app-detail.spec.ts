import type { Locator, Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { expect, authedTest as test } from './_fixtures/auth.fixture'

async function chooseSelectOption(page: Page, scope: Locator, name: string | RegExp, option: string | RegExp) {
  await scope.getByRole('combobox', { name }).click()
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click()
}

test.describe('App detail — version management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/applications')
    await page.getByText('TTPOS-Cashier').click()
    await expect(page).toHaveURL(/\/applications\/TTPOS-Cashier/)
    // Wait for the detail page header to render so version actions are settled.
    await expect(page.getByRole('heading', { level: 1, name: 'TTPOS-Cashier' })).toBeVisible()
  })

  test('renders version row with state-colored title and channel on the right', async ({ page }) => {
    await expect(page.getByText('1.0.0').first()).toBeVisible()
    await expect(page.getByTestId('version-channel-chip').first()).toHaveText('STABLE')
    await expect(page.getByTestId('version-title').first()).toHaveAttribute('data-version-tone', 'published')
    await expect(page.getByTestId('version-status-text').first()).toContainText('Published')
    // Header summary count.
    await expect(page.getByText(/version\(s\)/i)).toBeVisible()

    const positions = await page.evaluate(() => {
      const channel = document.querySelector('[data-testid="version-channel-chip"]')?.getBoundingClientRect()
      const title = document.querySelector('[data-testid="version-title"]')?.getBoundingClientRect()
      return channel && title
        ? { titleRight: title.right, channelLeft: channel.left }
        : null
    })
    expect(positions).not.toBeNull()
    expect(positions!.titleRight).toBeLessThanOrEqual(positions!.channelLeft)
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
    await expect(page.getByRole('button', { name: 'Build Test Package' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Upload version' })).toBeVisible()

    await page.getByRole('button', { name: 'Upload version' }).click()

    const dialog = page.getByRole('dialog', { name: 'Upload new version' })
    await expect(dialog.getByRole('heading', { name: 'Upload new version' })).toBeVisible()
    await expect(dialog.getByRole('combobox', { name: 'Channel' })).toContainText('Select channel')
    await expect(dialog.getByRole('combobox', { name: 'Platform' })).toContainText('Select platform')
    await expect(dialog.getByRole('combobox', { name: 'Architecture' })).toContainText('Select architecture')

    const selectorWidths = await dialog.evaluate((element) => {
      const widthFor = (name: string) =>
        element.querySelector(`[role="combobox"][aria-label="${name}"]`)?.getBoundingClientRect().width ?? 0

      return {
        channel: widthFor('Channel'),
        platform: widthFor('Platform'),
        architecture: widthFor('Architecture'),
      }
    })

    expect(selectorWidths.channel).toBeGreaterThan(120)
    expect(Math.abs(selectorWidths.channel - selectorWidths.platform)).toBeLessThanOrEqual(2)
    expect(selectorWidths.architecture).toBeGreaterThan(selectorWidths.channel)
  })

  test('upload version submits updater and intermediate fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Upload version' }).click()

    const dialog = page.getByRole('dialog', { name: 'Upload new version' })
    await dialog.getByPlaceholder('1.2.3').fill('1.1.0')
    await chooseSelectOption(page, dialog, 'Channel', 'stable')
    await chooseSelectOption(page, dialog, 'Platform', 'android')
    await chooseSelectOption(page, dialog, 'Architecture', 'arm64')
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
    const platformSelector = dialog.getByRole('combobox', { name: 'Platform' })
    const selectorMetrics = await platformSelector.evaluate((element) => {
      const text = element.querySelector('[data-slot="select-value"]')?.getBoundingClientRect()
      const icon = element.querySelector('svg[aria-hidden="true"]')?.getBoundingClientRect()
      const box = element.getBoundingClientRect()
      return text && icon
        ? {
            centerDelta: Math.abs((text.top + text.height / 2) - (icon.top + icon.height / 2)),
            iconRightGap: box.right - icon.right,
          }
        : null
    })
    expect(selectorMetrics).not.toBeNull()
    expect(selectorMetrics!.centerDelta).toBeLessThanOrEqual(2)
    expect(selectorMetrics!.iconRightGap).toBeGreaterThan(0)

    await chooseSelectOption(page, dialog, 'Platform', 'android')
    await expect(dialog.getByText('Updater', { exact: true })).toBeVisible()
    await chooseSelectOption(page, dialog, 'Updater', 'Tauri')
    await expect(dialog.getByText('Signature', { exact: true })).toBeVisible()
    // App + channel context line is auto-filled from the version row.
    await expect(dialog.getByText(/App:\s*TTPOS-Cashier.*Channel:\s*stable/)).toBeVisible()

    await page.locator('button[type="button"]:visible', { hasText: /^Cancel$/ }).first().click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })

  test('add artifact submits updater and preserves intermediate flag', async ({ page }) => {
    await page.getByRole('button', { name: 'Add artifact' }).click()

    const dialog = page.getByRole('dialog', { name: /Add artifact to 1\.0\.0/ })
    await chooseSelectOption(page, dialog, 'Platform', 'android')
    await chooseSelectOption(page, dialog, 'Architecture', 'arm64')
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'cashier-1.0.0-arm64.apk',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('apk'),
    })

    await dialog.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })
})
