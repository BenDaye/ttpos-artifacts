import { Page } from '@playwright/test';

// ── Mock Data ────────────────────────────────────────────────────────

export const TEST_USER = {
  id: 'user-1',
  username: 'admin',
  is_admin: true,
  permissions: {
    Apps: {
      Create: true,
      Delete: true,
      Edit: true,
      Download: true,
      Upload: true,
      Allowed: [],
    },
    Channels: { Create: true, Delete: true, Edit: true, Allowed: [] },
    Platforms: { Create: true, Delete: true, Edit: true, Allowed: [] },
    Archs: { Create: true, Delete: true, Edit: true, Allowed: [] },
  },
};

export const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.test';

export const MOCK_APPS = [
  {
    ID: 'app-1',
    AppName: 'TTPOS-Cashier',
    Logo: '',
    Description: 'POS cashier application',
    Updated_at: '2025-01-01T00:00:00Z',
    Private: false,
    Tuf: false,
  },
  {
    ID: 'app-2',
    AppName: 'TTPOS-KDS',
    Logo: '',
    Description: 'Kitchen display system',
    Updated_at: '2025-01-02T00:00:00Z',
    Private: false,
    Tuf: false,
  },
];

export const MOCK_CHANNELS = [
  { ID: 'ch-1', ChannelName: 'stable', Updated_at: '2025-01-01T00:00:00Z' },
  { ID: 'ch-2', ChannelName: 'beta', Updated_at: '2025-01-02T00:00:00Z' },
];

export const MOCK_PLATFORMS = [
  {
    ID: 'pl-1',
    PlatformName: 'android',
    Updaters: [{ type: 'manual', default: true }],
    Updated_at: '2025-01-01T00:00:00Z',
  },
  {
    ID: 'pl-2',
    PlatformName: 'windows',
    Updaters: [{ type: 'manual', default: true }],
    Updated_at: '2025-01-02T00:00:00Z',
  },
];

export const MOCK_ARCHITECTURES = [
  { ID: 'ar-1', ArchID: 'amd64', Updated_at: '2025-01-01T00:00:00Z' },
  { ID: 'ar-2', ArchID: 'arm64', Updated_at: '2025-01-02T00:00:00Z' },
];

export const MOCK_VERSIONS = {
  items: [
    {
      ID: 'ver-1',
      AppName: 'TTPOS-Cashier',
      Version: '1.0.0',
      Channel: 'stable',
      Published: true,
      Critical: false,
      Intermediate: false,
      Artifacts: [
        {
          ID: 'art-1',
          link: 'https://storage.example.com/cashier-1.0.0.apk',
          platform: 'android',
          arch: 'arm64',
          package: 'cashier-1.0.0.apk',
        },
        {
          ID: 'art-2',
          link: 'https://storage.example.com/cashier-1.0.0.exe',
          platform: 'windows',
          arch: 'amd64',
          package: 'cashier-1.0.0.exe',
        },
      ],
      Changelog: [
        { Version: '1.0.0', Changes: 'Initial release', Date: '2025-01-01' },
      ],
      Updated_at: '2025-01-01T00:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  limit: 9,
};

export const MOCK_TOKENS = [
  {
    id: 'tok-1',
    name: 'GitHub Actions',
    token_prefix: 'fns_abc12345',
    allowed_apps: ['TTPOS-Cashier', 'TTPOS-KDS'],
    expires_at: '2025-04-01T00:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    last_used_at: '2025-01-15T00:00:00Z',
  },
];

// ── Route Setup ──────────────────────────────────────────────────────

/**
 * Intercept all API routes with mock data.
 * Call this before navigating in tests that need a mocked backend.
 */
export async function setupMockApi(page: Page) {
  // Auth
  await page.route('**/login', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 200, json: { token: TEST_TOKEN } });
    }
    return route.fallback();
  });

  await page.route('**/whoami', (route) =>
    route.fulfill({ status: 200, json: TEST_USER })
  );

  // Apps
  await page.route('**/app/list', (route) =>
    route.fulfill({ status: 200, json: { apps: MOCK_APPS } })
  );

  await page.route('**/search?*', (route) =>
    route.fulfill({ status: 200, json: MOCK_VERSIONS })
  );

  await page.route('**/app/create', (route) =>
    route.fulfill({ status: 200, json: { success: true } })
  );

  await page.route('**/apps/update', (route) =>
    route.fulfill({ status: 200, json: { success: true } })
  );

  await page.route('**/apps/delete?*', (route) =>
    route.fulfill({ status: 200, json: { success: true } })
  );

  // Channels
  await page.route('**/channel/list', (route) =>
    route.fulfill({ status: 200, json: { channels: MOCK_CHANNELS } })
  );

  await page.route('**/channel/create', (route) =>
    route.fulfill({ status: 200, json: { success: true } })
  );

  await page.route('**/channel/update', (route) =>
    route.fulfill({ status: 200, json: { success: true } })
  );

  await page.route('**/channel/delete?*', (route) =>
    route.fulfill({ status: 200, json: { success: true } })
  );

  // Platforms
  await page.route('**/platform/list', (route) =>
    route.fulfill({ status: 200, json: { platforms: MOCK_PLATFORMS } })
  );

  await page.route('**/platform/create', (route) =>
    route.fulfill({ status: 200, json: { success: true } })
  );

  await page.route('**/platform/update', (route) =>
    route.fulfill({ status: 200, json: { success: true } })
  );

  await page.route('**/platform/delete?*', (route) =>
    route.fulfill({ status: 200, json: { success: true } })
  );

  // Architectures
  await page.route('**/arch/list', (route) =>
    route.fulfill({ status: 200, json: { archs: MOCK_ARCHITECTURES } })
  );

  await page.route('**/arch/create', (route) =>
    route.fulfill({ status: 200, json: { success: true } })
  );

  await page.route('**/arch/update', (route) =>
    route.fulfill({ status: 200, json: { success: true } })
  );

  await page.route('**/arch/delete?*', (route) =>
    route.fulfill({ status: 200, json: { success: true } })
  );

  // Statistics
  await page.route('**/telemetry*', (route) =>
    route.fulfill({
      status: 200,
      json: {
        total_requests: 1250,
        unique_clients: 42,
        clients_using_latest_version: 30,
        clients_outdated: 12,
        total_active_apps: 2,
        data: [],
      },
    })
  );

  // Users list (admin)
  await page.route('**/users/list', (route) =>
    route.fulfill({
      status: 200,
      json: { users: [{ ...TEST_USER, password: '' }] },
    })
  );

  // CI/CD Tokens
  await page.route('**/token/list', (route) =>
    route.fulfill({ status: 200, json: { tokens: MOCK_TOKENS } })
  );

  await page.route('**/token/create', (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: 'tok-new',
        name: 'Deploy Token',
        token: 'fns_new_token_value_shown_once',
        token_prefix: 'fns_new_toke',
        allowed_apps: [],
        created_at: new Date().toISOString(),
        expires_at: null,
        last_used_at: null,
      },
    })
  );

  await page.route('**/token/delete?*', (route) =>
    route.fulfill({ status: 200, json: { success: true } })
  );
}
