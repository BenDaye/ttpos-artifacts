import { defineConfig, devices } from '@playwright/test';

/**
 * Use a dedicated port (3100) for tests to avoid conflict with a running
 * dev server that may have the Vite API proxy enabled.
 */
const TEST_PORT = 3100;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list']]
    : [['html', { open: 'on-failure' }], ['list']],
  timeout: 30_000,

  use: {
    baseURL: TEST_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `yarn dev --port ${TEST_PORT}`,
    url: TEST_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    // Disable Vite proxy so Playwright can intercept all API calls
    env: { VITE_DEV_PROXY_TARGET: '', VITE_PORT: String(TEST_PORT) },
  },
});
