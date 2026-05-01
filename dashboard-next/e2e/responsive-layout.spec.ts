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

async function mockTokens(page: Page, tokens: unknown[]) {
  await page.unroute('**/token/list')
  await page.route('**/token/list', route =>
    route.fulfill({ status: 200, json: { tokens } }))
}

async function expectNoDocumentOverflow(page: Page) {
  await page.waitForLoadState('networkidle')
  await expect.poll(async () => page.evaluate(() => {
    const root = document.documentElement
    return Math.ceil(root.scrollWidth - root.clientWidth)
  })).toBeLessThanOrEqual(1)
}

async function expectReadableEmptyStateDescription(page: Page, text: string, minWidth: number) {
  const locator = page.getByText(text, { exact: true })
  await expect(locator).toBeVisible()
  const body = locator.locator('xpath=ancestor::*[contains(@class, "dashboard-empty-state-body")][1]')
  await expect(body).toBeVisible()
  await expect.poll(async () => {
    const box = await body.boundingBox()
    return Math.round(box?.width ?? 0)
  }).toBeGreaterThanOrEqual(minWidth)
  const lineCount = await locator.evaluate((element) => {
    const style = window.getComputedStyle(element)
    const lineHeight = Number.parseFloat(style.lineHeight)
    return Math.ceil(element.getBoundingClientRect().height / lineHeight)
  })
  expect(lineCount).toBeLessThanOrEqual(3)
}

function versionFixture(index: number, overrides: Record<string, unknown> = {}) {
  return {
    ID: `responsive-version-${index}`,
    AppName: 'TTPOS-Cashier',
    Version: `1.${index}.0`,
    Channel: index % 2 === 0 ? 'stable' : 'beta',
    Published: index % 2 === 0,
    Critical: false,
    Intermediate: false,
    Artifacts: [],
    Changelog: [],
    Updated_at: '2026-05-01T00:00:00Z',
    ...overrides,
  }
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
    await expectReadableEmptyStateDescription(page, 'Upload your first artifact to get started.', 220)
    await expect(page.getByRole('button', { name: 'Upload version' }).last()).toBeVisible()
    await expectNoDocumentOverflow(page)
  })

  test('keeps the empty API tokens state readable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await mockTokens(page, [])

    await page.goto('/settings/tokens')

    await expect(page.getByRole('heading', { name: 'No API tokens' })).toBeVisible()
    await expectReadableEmptyStateDescription(page, 'Create one for CI uploads.', 220)
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

  test('makes the active statistics range visually distinct', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto('/statistics')

    const today = page.getByRole('button', { name: 'Today' })
    const week = page.getByRole('button', { name: 'Last 7 days' })

    await expect(week).toHaveAttribute('data-pressed', 'true')
    await today.click()
    await expect(today).toHaveAttribute('data-pressed', 'true')
    await expect(week).toHaveAttribute('data-pressed', 'false')

    const selectedBackground = await today.evaluate(el => getComputedStyle(el).backgroundColor)
    const inactiveBackground = await week.evaluate(el => getComputedStyle(el).backgroundColor)
    const selectedColor = await today.evaluate(el => getComputedStyle(el).color)
    const inactiveColor = await week.evaluate(el => getComputedStyle(el).color)
    expect(selectedBackground).not.toBe(inactiveBackground)
    expect(selectedColor).not.toBe(inactiveColor)
  })

  const gridCases = [
    { width: 375, expectedColumns: 1 },
    { width: 1024, expectedColumns: 2 },
    { width: 1440, expectedColumns: 2 },
    { width: 1920, expectedColumns: 3 },
  ] as const

  for (const { width, expectedColumns } of gridCases) {
    test(`lays out version cards in ${expectedColumns} column(s) at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await mockVersions(page, Array.from({ length: 4 }, (_, index) => versionFixture(index + 1)), 4)

      await page.goto('/applications/TTPOS-Cashier')

      const cards = page.getByTestId('version-card')
      await expect(cards).toHaveCount(4)

      const firstRowCount = await cards.evaluateAll((elements) => {
        const boxes = elements.map((element) => {
          const rect = element.getBoundingClientRect()
          return { y: Math.round(rect.y), width: Math.round(rect.width) }
        })
        const firstY = boxes[0]?.y ?? 0
        return boxes.filter(box => Math.abs(box.y - firstY) <= 2).length
      })
      expect(firstRowCount).toBe(expectedColumns)
      await expectNoDocumentOverflow(page)
    })
  }

  test('keeps long version rows multi-line and readable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    const longVersion = '2026.05.01-internal-canary-super-long-version-label-build-1234567890'
    await mockVersions(page, [versionFixture(1, {
      ID: 'long-version',
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
    })])

    await page.goto('/applications/TTPOS-Cashier')

    await expect(page.getByTestId('version-draft-ribbon')).toBeVisible()
    await expect(page.getByText(longVersion)).toBeVisible()
    await expect(page.getByRole('button', { name: /^Download\s*\(\d+\)$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add artifact' })).toBeVisible()
    await expect(page.getByText(/android-enterprise-production\s*\/\s*arm64-super-long-architecture-label/)).toBeVisible()
    await expect(page.getByText('cashier-super-long-artifact-name-for-enterprise-production.apk')).toBeVisible()
    await expectNoDocumentOverflow(page)
  })
})
