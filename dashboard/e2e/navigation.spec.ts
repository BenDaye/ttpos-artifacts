import { test, expect } from './fixtures/auth.fixture';

test.describe('Sidebar Navigation', () => {
  test('navigates to all main pages via sidebar', async ({ page }) => {
    await page.goto('/applications');
    await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible();

    const navItems = [
      { name: 'Channels', url: /\/channels/ },
      { name: 'Platforms', url: /\/platforms/ },
      { name: 'Architectures', url: /\/architectures/ },
      { name: 'Statistics', url: /\/statistics/ },
      { name: 'Applications', url: /\/applications/ },
    ];

    for (const { name, url } of navItems) {
      // Click the sidebar button (desktop sidebar, not drawer)
      await page.locator('aside.sidebar').getByText(name).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole('heading', { name })).toBeVisible();
    }
  });

  test('settings menu shows for admin users', async ({ page }) => {
    await page.goto('/applications');

    await page.getByLabel('Settings').first().click();

    // Admin sees username with crown, and menu items in the portal popup
    const popup = page.locator('.settings-popup-button').first().locator('..');
    await expect(page.getByText('admin')).toBeVisible();
    await expect(page.locator('.settings-popup-button').getByText('Profile')).toBeVisible();
    await expect(page.locator('.settings-popup-button').getByText('Settings')).toBeVisible();
    await expect(page.locator('.settings-popup-button').getByText('Logout')).toBeVisible();
  });

  test('admin can navigate to settings page', async ({ page }) => {
    await page.goto('/applications');

    await page.getByLabel('Settings').first().click();
    // Click the Settings option in the menu (not the gear button)
    await page.locator('.settings-popup-button').getByText('Settings').click();

    await expect(page).toHaveURL(/\/settings/);
  });
});
