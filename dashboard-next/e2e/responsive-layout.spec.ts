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
})
