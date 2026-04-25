import { expect, test } from '@playwright/test'

test.describe('Smoke', () => {
  test('redirects to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/applications')
    await expect(page).toHaveURL(/\/signin/)
    await expect(page.getByText(/welcome back/i)).toBeVisible()
    await expect(page.getByLabel(/username/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test('public sign-up route is reachable', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByText(/create account/i).first()).toBeVisible()
  })

  test('root path redirects to sign-in', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/signin/)
  })
})
