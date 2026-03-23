import { test as base } from '@playwright/test';
import { setupMockApi, TEST_TOKEN } from '../mocks/handlers';

/**
 * Extended test fixture that:
 * 1. Sets up API mocks
 * 2. Injects a JWT token into localStorage so tests start authenticated
 */
export const test = base.extend<{ authedPage: typeof base }>({
  page: async ({ page }, use) => {
    await setupMockApi(page);

    // Inject token into localStorage before any navigation
    await page.addInitScript((token: string) => {
      window.localStorage.setItem('token', token);
    }, TEST_TOKEN);

    await use(page);
  },
});

export { expect } from '@playwright/test';
