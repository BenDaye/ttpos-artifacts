import { expect, test } from '@playwright/test'
import { setupMockApi, TEST_TOKEN } from './mocks/handlers'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page)
  })

  test('redirects unauthenticated user to /signin', async ({ page }) => {
    await page.goto('/applications')
    await expect(page).toHaveURL(/\/signin/)
  })

  test('signs in with valid credentials and lands on /applications', async ({ page }) => {
    await page.goto('/signin')
    await page.getByLabel(/username/i).fill('admin')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/applications/)
  })

  test('shows server error on bad credentials', async ({ page }) => {
    await page.route('**/login', route =>
      route.fulfill({
        status: 401,
        json: { error: 'Invalid username or password' },
      }))

    await page.goto('/signin')
    await page.getByLabel(/username/i).fill('admin')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    // Error toast or inline message
    await expect(page.getByText(/invalid username or password/i)).toBeVisible({ timeout: 5000 })
  })

  test('signed-in session shows ZEHub shell with side nav', async ({ page }) => {
    await page.addInitScript((token: string) => {
      window.localStorage.setItem('token', token)
    }, TEST_TOKEN)

    await page.goto('/applications')
    await expect(page).toHaveURL(/\/applications/)

    // App shell sidebar items appear
    await expect(page.getByRole('link', { name: /applications/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /channels/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /platforms/i })).toBeVisible()
  })

  test('signing out returns to /signin', async ({ page }) => {
    await page.addInitScript((token: string) => {
      window.localStorage.setItem('token', token)
    }, TEST_TOKEN)

    await page.goto('/applications')
    await expect(page).toHaveURL(/\/applications/)

    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/signin/)
  })
})
