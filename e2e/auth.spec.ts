import { authedTest, expect, test } from './_fixtures/auth.fixture'
import { setupMockApi } from './_fixtures/handlers'

test.describe('Authentication', () => {
  test('redirects unauthenticated user to /signin', async ({ page }) => {
    await page.goto('/applications')
    await expect(page).toHaveURL(/\/signin/)
    await expect(page.getByText(/welcome back/i)).toBeVisible()
  })

  test('signs in with valid credentials', async ({ page }) => {
    await page.goto('/signin')

    await page.getByLabel('Username').fill('admin')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page).toHaveURL(/\/applications/)
  })

  test('preserves protected route redirect after sign-in', async ({ page }) => {
    await page.goto('/platforms')
    await expect(page).toHaveURL(/\/signin.*redirect=/)

    await page.getByLabel('Username').fill('admin')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page).toHaveURL(/\/platforms$/)
  })

  test('shows validation errors for empty form', async ({ page }) => {
    await page.goto('/signin')

    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page.getByText('Required').first()).toBeVisible()
  })

  test('shows server error on bad credentials', async ({ page }) => {
    await setupMockApi(page, {
      loginStatus: 401,
      loginError: 'Invalid username or password',
    })

    await page.goto('/signin')
    await page.getByLabel('Username').fill('admin')
    await page.getByLabel('Password', { exact: true }).fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page.getByText('Invalid username or password')).toBeVisible()
  })

  test('public sign-up route is reachable', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'networkidle' })
    await expect(page.getByText(/create account/i).first()).toBeVisible({ timeout: 15_000 })
  })
})

authedTest.describe('Authentication (authenticated)', () => {
  authedTest('logout returns to /signin', async ({ page }) => {
    await page.goto('/applications')
    await expect(page).toHaveURL(/\/applications/)

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/signin/)
  })

  authedTest('root path redirects to /applications when authenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/applications/)
  })
})
