import type { Page, Route } from '@playwright/test'

export const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.test'

export const TEST_USER = {
  id: 'user-1',
  username: 'admin',
  is_admin: true,
  permissions: {
    Apps: { Create: true, Delete: true, Edit: true, Download: true, Upload: true, Allowed: [] },
    Channels: { Create: true, Delete: true, Edit: true, Allowed: [] },
    Platforms: { Create: true, Delete: true, Edit: true, Allowed: [] },
    Archs: { Create: true, Delete: true, Edit: true, Allowed: [] },
  },
}

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
]

// IDs are intentionally hex-only so the truncated badge slice(0, 8) cannot
// collide with the display name (e.g. an ID containing "stable" would also
// match the channel name in `getByText`). Keep all mock IDs non-overlapping.
export const MOCK_CHANNELS = [
  { ID: '11111111aaaa', ChannelName: 'stable', Updated_at: '2025-01-01T00:00:00Z' },
  { ID: '22222222bbbb', ChannelName: 'beta', Updated_at: '2025-01-02T00:00:00Z' },
]

export const MOCK_PLATFORMS = [
  { ID: '33333333cccc', PlatformName: 'android', Updated_at: '2025-01-01T00:00:00Z' },
  { ID: '44444444dddd', PlatformName: 'windows', Updated_at: '2025-01-02T00:00:00Z' },
]

export const MOCK_ARCHITECTURES = [
  { ID: '55555555eeee', ArchID: 'amd64', Updated_at: '2025-01-01T00:00:00Z' },
  { ID: '66666666ffff', ArchID: 'arm64', Updated_at: '2025-01-02T00:00:00Z' },
]

export const MOCK_VERSION_ENTRY = {
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
}

export const MOCK_VERSIONS = {
  items: [MOCK_VERSION_ENTRY],
  total: 1,
  page: 1,
  limit: 50,
}

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
]

export const MOCK_TELEMETRY = {
  date: '2025-01-15',
  date_range: ['2025-01-09', '2025-01-15'],
  admin: 'admin',
  summary: {
    total_requests: 1250,
    unique_clients: 42,
    clients_using_latest_version: 30,
    clients_outdated: 12,
    total_active_apps: 2,
  },
  versions: { used_versions_count: 0, known_versions: [], usage: [] },
  platforms: [],
  architectures: [],
  channels: [],
  daily_stats: [],
}

function jsonHandler(payload: unknown) {
  return (route: Route) => route.fulfill({ status: 200, json: payload })
}

export interface MockOverrides {
  loginStatus?: number
  loginError?: string
  usersListStatus?: number
  usersListError?: string
}

export async function setupMockApi(page: Page, overrides: MockOverrides = {}) {
  // Auth
  await page.route('**/login', (route) => {
    if (route.request().method() !== 'POST') {
      return route.fallback()
    }
    if (overrides.loginStatus && overrides.loginStatus >= 400) {
      return route.fulfill({
        status: overrides.loginStatus,
        json: { error: overrides.loginError ?? 'Invalid username or password' },
      })
    }
    return route.fulfill({ status: 200, json: { token: TEST_TOKEN } })
  })

  await page.route('**/signup', route =>
    route.fulfill({ status: 200, json: { token: TEST_TOKEN } }))

  await page.route('**/whoami', jsonHandler(TEST_USER))

  // Apps
  await page.route('**/app/list*', jsonHandler({ apps: MOCK_APPS, total: MOCK_APPS.length }))
  await page.route('**/search*', jsonHandler(MOCK_VERSIONS))
  await page.route('**/app/create', jsonHandler({ success: true }))
  await page.route('**/app/update', jsonHandler({ success: true }))
  await page.route('**/app/delete*', jsonHandler({ success: true }))
  await page.route('**/apps/update', jsonHandler({ success: true }))
  await page.route('**/apps/delete*', jsonHandler({ success: true }))
  await page.route('**/artifact/delete', jsonHandler({ success: true }))
  await page.route('**/upload', jsonHandler({ success: true }))

  // Channels
  await page.route('**/channel/list', jsonHandler({ channels: MOCK_CHANNELS }))
  await page.route('**/channel/create', jsonHandler({ success: true }))
  await page.route('**/channel/update', jsonHandler({ success: true }))
  await page.route('**/channel/delete*', jsonHandler({ success: true }))

  // Platforms
  await page.route('**/platform/list', jsonHandler({ platforms: MOCK_PLATFORMS }))
  await page.route('**/platform/create', jsonHandler({ success: true }))
  await page.route('**/platform/update', jsonHandler({ success: true }))
  await page.route('**/platform/delete*', jsonHandler({ success: true }))

  // Architectures
  await page.route('**/arch/list', jsonHandler({ archs: MOCK_ARCHITECTURES }))
  await page.route('**/arch/create', jsonHandler({ success: true }))
  await page.route('**/arch/update', jsonHandler({ success: true }))
  await page.route('**/arch/delete*', jsonHandler({ success: true }))

  // Telemetry
  await page.route('**/telemetry*', jsonHandler(MOCK_TELEMETRY))

  // Users list (admin)
  await page.route('**/users/list', (route) => {
    if (overrides.usersListStatus && overrides.usersListStatus >= 400) {
      return route.fulfill({
        status: overrides.usersListStatus,
        json: { error: overrides.usersListError ?? 'forbidden' },
      })
    }
    return route.fulfill({ status: 200, json: { users: [{ ...TEST_USER, password: '' }] } })
  })
  await page.route('**/user/create', jsonHandler({ success: true }))
  await page.route('**/user/update', jsonHandler({ success: true }))
  await page.route('**/user/delete', jsonHandler({ success: true }))
  await page.route('**/admin/update', jsonHandler({ success: true }))

  // CI/CD Tokens
  await page.route('**/token/list', jsonHandler({ tokens: MOCK_TOKENS }))
  await page.route('**/token/create', jsonHandler({
    id: 'tok-new',
    name: 'Deploy Token',
    token: 'fns_new_token_value_shown_once',
    token_prefix: 'fns_new_toke',
    allowed_apps: [],
    created_at: new Date().toISOString(),
    expires_at: null,
    last_used_at: null,
  }))
  await page.route('**/token/delete*', jsonHandler({ success: true }))
}
