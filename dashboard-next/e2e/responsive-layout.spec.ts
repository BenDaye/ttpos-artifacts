import type { Page } from '@playwright/test'
import { expect, authedTest as test } from './_fixtures/auth.fixture'

const RESPONSIVE_WIDTHS = [320, 375, 768, 1024] as const

const MANY_APPS = Array.from({ length: 6 }, (_, index) => {
  const names = [
    'TTPOS-Cashier',
    'TTPOS-KDS',
    'TTPOS-Inventory-Tablet',
    'TTPOS-Backoffice-Management',
    'TTPOS-Customer-Display',
    'TTPOS-Kitchen-Printer-Service',
  ]
  return {
    ID: String(index + 1).padStart(24, 'a'),
    AppName: names[index],
    Logo: '',
    Description: 'Responsive layout fixture',
    Updated_at: '2025-01-01T00:00:00Z',
    Private: false,
    Tuf: false,
  }
})

async function mockManyApps(page: Page) {
  await page.route('**/app/list*', route =>
    route.fulfill({ status: 200, json: { apps: MANY_APPS, total: MANY_APPS.length } }))
}

async function mockVersions(page: Page, versions: unknown[], total = versions.length) {
  await page.unroute('**/search?*')
  await page.route('**/search?*', route =>
    route.fulfill({ status: 200, json: { items: versions, total, page: 1, limit: 50 } }))
}

async function expectNoDocumentOverflow(page: Page) {
  await page.waitForLoadState('networkidle')
  await expect.poll(async () => page.evaluate(() => {
    const root = document.documentElement
    return Math.ceil(root.scrollWidth - root.clientWidth)
  })).toBeLessThanOrEqual(1)
}

test.describe('Responsive layout', () => {
  for (const width of RESPONSIVE_WIDTHS) {
    test(`keeps application card view inside the viewport at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await mockManyApps(page)

      await page.goto('/applications')

      await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible()
      await expectNoDocumentOverflow(page)
    })

    test(`keeps application board scrolling local at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await mockManyApps(page)

      await page.goto('/applications')
      await page.getByRole('button', { name: 'Board view' }).click()

      await expect(page.getByText('TTPOS-Cashier')).toBeVisible()
      await expectNoDocumentOverflow(page)
    })

    test(`keeps detail filters and statistics inside the viewport at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })

      await page.goto('/applications/TTPOS-Cashier')
      await expect(page.getByRole('heading', { name: 'TTPOS-Cashier' })).toBeVisible()
      await expectNoDocumentOverflow(page)

      await page.goto('/statistics')
      await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible()
      await expectNoDocumentOverflow(page)
    })

    test(`keeps settings panels inside the viewport at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })

      await page.goto('/settings')

      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
      await expectNoDocumentOverflow(page)
    })
  }

  test('uses an overlay drawer for mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })

    await page.goto('/applications')
    await expectNoDocumentOverflow(page)

    await page.getByRole('button', { name: 'Toggle navigation' }).click()
    await expect(page.locator('aside[aria-label="Primary"]').getByRole('link', { name: 'Statistics' })).toBeVisible()

    await page.locator('aside[aria-label="Primary"]').getByRole('link', { name: 'Statistics' }).click()

    await expect(page).toHaveURL(/\/statistics$/)
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible()
    await expectNoDocumentOverflow(page)
  })

  test('keeps the empty versions state readable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await mockVersions(page, [], 0)

    await page.goto('/applications/TTPOS-Cashier')

    await expect(page.getByRole('heading', { name: 'No versions yet' })).toBeVisible()
    await expect(page.getByText('Upload your first artifact to get started.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Upload version' }).last()).toBeVisible()
    await expectNoDocumentOverflow(page)
  })

  test('expands the applications search field on focus', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto('/applications')
    await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible()

    const searchShell = page.locator('.dashboard-search-shell').first()
    await expect(searchShell).toBeVisible()
    const before = await searchShell.boundingBox()
    await page.getByPlaceholder('Search').focus()

    await expect.poll(async () => {
      const box = await searchShell.boundingBox()
      return Math.round(box?.width ?? 0)
    }).toBeGreaterThan(Math.round((before?.width ?? 0) + 20))
    await expectNoDocumentOverflow(page)
  })

  test('makes the active layout switcher item visually distinct', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto('/applications')

    const card = page.getByRole('button', { name: 'Card view' })
    const list = page.getByRole('button', { name: 'List view' })

    await expect(card).toHaveAttribute('data-pressed', 'true')
    await list.click()
    await expect(list).toHaveAttribute('data-pressed', 'true')
    await expect(card).toHaveAttribute('data-pressed', 'false')

    const selectedBackground = await list.evaluate(el => getComputedStyle(el).backgroundColor)
    const inactiveBackground = await card.evaluate(el => getComputedStyle(el).backgroundColor)
    expect(selectedBackground).not.toBe(inactiveBackground)
  })

  test('keeps long version rows multi-line and readable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    const longVersion = '2026.05.01-internal-canary-super-long-version-label-build-1234567890'
    await mockVersions(page, [{
      ID: 'long-version',
      AppName: 'TTPOS-Cashier',
      Version: longVersion,
      Channel: 'enterprise-production-long-channel-name',
      Published: false,
      Critical: true,
      Intermediate: true,
      Artifacts: [
        {
          ID: 'long-artifact',
          link: '/download?key=TTPOS-Cashier%2Fenterprise%2Fandroid%2Farm64%2Fcashier-super-long-artifact-name.apk',
          platform: 'android-enterprise-production',
          arch: 'arm64-super-long-architecture-label',
          package: 'cashier-super-long-artifact-name-for-enterprise-production.apk',
        },
      ],
      Changelog: [
        { Version: longVersion, Changes: 'Long release fixture', Date: '2026-05-01' },
      ],
      Updated_at: '2026-05-01T00:00:00Z',
    }])

    await page.goto('/applications/TTPOS-Cashier')

    await expect(page.getByText(longVersion)).toBeVisible()
    await expect(page.getByRole('button', { name: /^Download\s*\(\d+\)$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add artifact' })).toBeVisible()
    await expect(page.getByText('cashier-super-long-artifact-name-for-enterprise-production.apk')).toBeVisible()
    await expectNoDocumentOverflow(page)
  })
})
