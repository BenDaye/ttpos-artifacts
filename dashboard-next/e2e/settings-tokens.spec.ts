import { expect, authedTest as test } from './_fixtures/auth.fixture'

test.describe('Settings — CI/CD Tokens', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/tokens')
  })

  test('displays existing tokens with metadata', async ({ page }) => {
    await expect(page.getByText('GitHub Actions')).toBeVisible()
    await expect(page.getByText(/fns_abc12345/)).toBeVisible()
    await expect(page.getByText(/Scope:/i)).toBeVisible()
  })

  test('settings tabs link between Users and API Tokens', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'API Tokens' })).toBeVisible()
  })

  test('opens create token dialog with required fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Create token' }).first().click()

    await expect(page.getByRole('heading', { name: 'Create API token' })).toBeVisible()
    await expect(page.getByLabel('Name')).toBeVisible()
    await expect(page.getByLabel(/Expires in/i)).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'All apps' })).toBeVisible()
  })

  test('reveals token value after successful creation', async ({ page }) => {
    await page.getByRole('button', { name: 'Create token' }).first().click()

    await page.getByLabel('Name').fill('Deploy Token')
    // Submit label is "Create" before reveal (CreateTokenDialog overrides submitLabel).
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    // Token value field is a readOnly input with the freshly issued token.
    await expect(page.getByLabel('Token value')).toHaveValue('fns_new_token_value_shown_once')
    // After reveal the submit label flips to "Close".
    await expect(page.getByRole('button', { name: 'Close', exact: true }).first()).toBeVisible()
  })

  test('toggling scope reveals app checkboxes', async ({ page }) => {
    await page.getByRole('button', { name: 'Create token' }).first().click()

    // BaseCheckbox.Root exposes role="checkbox"; the wrapped input is aria-hidden.
    await page.getByRole('checkbox', { name: 'All apps' }).click()
    await expect(page.getByText('TTPOS-Cashier')).toBeVisible()
    await expect(page.getByText('TTPOS-KDS')).toBeVisible()
  })

  test('revoke button on token row opens confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Revoke' }).first().click()

    await expect(page.getByRole('heading', { name: 'Revoke token?' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Revoke token?' })).not.toBeVisible({ timeout: 5000 })
  })
})
