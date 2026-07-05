import { expect, authedTest as test } from './_fixtures/auth.fixture'

test.describe('Sidebar navigation', () => {
  test('navigates between main pages via sidebar links', async ({ page }) => {
    await page.goto('/applications')

    const sidebar = page.locator('[data-sidebar="sidebar"]')
    await expect(sidebar.getByRole('link', { name: 'Applications' })).toBeVisible()

    const items: { name: string, url: RegExp, heading: string }[] = [
      { name: 'Channels', url: /\/channels$/, heading: 'Channels' },
      { name: 'Platforms', url: /\/platforms$/, heading: 'Platforms' },
      { name: 'Architectures', url: /\/architectures$/, heading: 'Architectures' },
      { name: 'Statistics', url: /\/statistics$/, heading: 'Statistics' },
      { name: 'Applications', url: /\/applications$/, heading: 'Applications' },
    ]

    for (const item of items) {
      await sidebar.getByRole('link', { name: item.name, exact: true }).click()
      await expect(page).toHaveURL(item.url)
      await expect(page.getByRole('heading', { level: 1, name: item.heading })).toBeVisible()
    }
  })

  test('settings link routes to /settings (admin)', async ({ page }) => {
    await page.goto('/applications')

    const sidebar = page.locator('[data-sidebar="sidebar"]')
    await sidebar.getByRole('link', { name: 'Settings', exact: true }).click()

    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  })

  test('sidebar exposes Sign out button', async ({ page }) => {
    await page.goto('/applications')

    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  })
})
