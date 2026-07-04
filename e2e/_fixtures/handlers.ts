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
    ID: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    AppName: 'TTPOS-Cashier',
    Logo: '',
    Description: 'POS cashier application',
    Updated_at: '2025-01-01T00:00:00Z',
    Private: false,
    Tuf: false,
  },
  {
    ID: 'bbbbbbbbbbbbbbbbbbbbbbbb',
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
  { ID: '111111111111111111111111', ChannelName: 'stable', Updated_at: '2025-01-01T00:00:00Z' },
  { ID: '222222222222222222222222', ChannelName: 'beta', Updated_at: '2025-01-02T00:00:00Z' },
]

export const MOCK_PLATFORMS = [
  {
    ID: '333333333333333333333333',
    PlatformName: 'android',
    Updaters: [
      { type: 'manual', default: true },
      { type: 'tauri', default: false },
    ],
    Updated_at: '2025-01-01T00:00:00Z',
  },
  {
    ID: '444444444444444444444444',
    PlatformName: 'windows',
    Updaters: [
      { type: 'manual', default: true },
      { type: 'squirrel_windows', default: false },
      { type: 'electron-builder', default: false },
    ],
    Updated_at: '2025-01-02T00:00:00Z',
  },
]

export const MOCK_ARCHITECTURES = [
  { ID: '555555555555555555555555', ArchID: 'amd64', Updated_at: '2025-01-01T00:00:00Z' },
  { ID: '666666666666666666666666', ArchID: 'arm64', Updated_at: '2025-01-02T00:00:00Z' },
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
      link: '/download?key=TTPOS-Cashier%2Fstable%2Fandroid%2Farm64%2Fcashier-1.0.0.apk',
      platform: 'android',
      arch: 'arm64',
      package: 'cashier-1.0.0.apk',
    },
    {
      ID: 'art-2',
      link: '/download?key=TTPOS-Cashier%2Fstable%2Fwindows%2Famd64%2Fcashier-1.0.0.exe',
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
    id: '888888888888888888888888',
    name: 'GitHub Actions',
    token_prefix: 'fns_abc12345',
    allowed_apps: ['aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb'],
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

function badRequest(route: Route, error: string) {
  return route.fulfill({ status: 400, json: { error } })
}

function readJsonBody(route: Route): Record<string, unknown> {
  try {
    const data = route.request().postDataJSON()
    return data && typeof data === 'object' ? data as Record<string, unknown> : {}
  }
  catch {
    return {}
  }
}

function readMultipartData(route: Route): Record<string, unknown> | null {
  const body = route.request().postData() ?? ''
  const match = body.match(/name="data"\r\n\r\n([\s\S]*?)\r\n--/)
  if (!match) {
    return null
  }
  try {
    const data = JSON.parse(match[1])
    return data && typeof data === 'object' ? data as Record<string, unknown> : null
  }
  catch {
    return null
  }
}

function hasValidUpdaters(payload: Record<string, unknown>): boolean {
  if (!Array.isArray(payload.updaters) || payload.updaters.length === 0) {
    return false
  }

  const defaults = payload.updaters.filter((item) => {
    return item && typeof item === 'object' && (item as { default?: unknown }).default === true
  })
  return defaults.length === 1
    && payload.updaters.some((item) => {
      return item && typeof item === 'object' && (item as { type?: unknown }).type === 'manual'
    })
    && payload.updaters.every((item) => {
      return item && typeof item === 'object' && typeof (item as { type?: unknown }).type === 'string'
    })
}

function hasMultipartFile(route: Route): boolean {
  return (route.request().postData() ?? '').includes('name="file"')
}

function hasValidUploadData(data: Record<string, unknown> | null): boolean {
  return Boolean(
    data
    && typeof data.intermediate === 'boolean'
    && typeof data.updater === 'string'
    && data.updater.length > 0,
  )
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

  await page.route('**/signup', (route) => {
    // /signup is both a frontend route (GET → SPA HTML) and a backend POST
    // endpoint. Only intercept the API call so the SPA navigation still loads.
    if (route.request().method() !== 'POST') {
      return route.fallback()
    }
    return route.fulfill({ status: 200, json: { token: TEST_TOKEN } })
  })

  await page.route('**/whoami', jsonHandler(TEST_USER))

  // Apps
  await page.route('**/app/list*', jsonHandler({ apps: MOCK_APPS, total: MOCK_APPS.length }))
  await page.route('**/search?*', jsonHandler(MOCK_VERSIONS))
  await page.route('**/app/create', jsonHandler({ success: true }))
  await page.route('**/app/update', jsonHandler({ success: true }))
  await page.route('**/app/delete*', jsonHandler({ success: true }))
  await page.route('**/app/reorder', jsonHandler({ success: true }))
  await page.route('**/apps/update', (route) => {
    const data = readMultipartData(route)
    const validMetadataUpdate = Boolean(data && typeof data.intermediate === 'boolean')
    if (hasMultipartFile(route) ? !hasValidUploadData(data) : !validMetadataUpdate) {
      return badRequest(route, 'apps/update must submit intermediate and updater in multipart data')
    }
    return route.fulfill({ status: 200, json: { success: true } })
  })
  await page.route('**/apps/delete*', jsonHandler({ success: true }))
  await page.route('**/artifact/delete', jsonHandler({ success: true }))
  await page.route('**/upload', (route) => {
    const data = readMultipartData(route)
    if (!hasValidUploadData(data)) {
      return badRequest(route, 'upload must submit intermediate and updater in multipart data')
    }
    return route.fulfill({ status: 200, json: { success: true } })
  })
  await page.route('**/download?*', (route) => {
    const authorization = route.request().headers().authorization
    if (!authorization?.startsWith('Bearer ')) {
      return route.fulfill({ status: 401, json: { error: 'missing bearer token' } })
    }
    const key = new URL(route.request().url()).searchParams.get('key') ?? 'artifact.bin'
    return route.fulfill({
      status: 200,
      json: { download_url: `https://signed.example.com/${encodeURIComponent(key)}` },
    })
  })

  // Channels
  await page.route('**/channel/list', jsonHandler({ channels: MOCK_CHANNELS }))
  await page.route('**/channel/create', jsonHandler({ success: true }))
  await page.route('**/channel/update', jsonHandler({ success: true }))
  await page.route('**/channel/delete*', jsonHandler({ success: true }))

  // Platforms
  await page.route('**/platform/list', jsonHandler({ platforms: MOCK_PLATFORMS }))
  await page.route('**/platform/create', (route) => {
    const body = readJsonBody(route)
    if (!hasValidUpdaters(body)) {
      return badRequest(route, 'platform/create must include a valid updaters array')
    }
    return route.fulfill({ status: 200, json: { success: true } })
  })
  await page.route('**/platform/update', (route) => {
    const body = readJsonBody(route)
    if (!body.id || !hasValidUpdaters(body)) {
      return badRequest(route, 'platform/update must include id and a valid updaters array')
    }
    return route.fulfill({ status: 200, json: { success: true } })
  })
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
  await page.route('**/token/create', (route) => {
    const body = readJsonBody(route)
    const allowedApps = Array.isArray(body.allowed_apps) ? body.allowed_apps : []
    const validAppIds = new Set(MOCK_APPS.map(app => app.ID))
    if (allowedApps.length === 0 || !allowedApps.every(id => typeof id === 'string' && validAppIds.has(id))) {
      return badRequest(route, 'token/create must submit at least one allowed app ObjectID')
    }
    return route.fulfill({
      status: 201,
      json: {
        id: '777777777777777777777777',
        name: body.name,
        token: 'fns_new_token_value_shown_once',
        token_prefix: 'fns_new_toke',
        allowed_apps: allowedApps,
        created_at: new Date().toISOString(),
        expires_at: null,
        last_used_at: null,
      },
    })
  })
  await page.route('**/token/delete*', (route) => {
    const url = new URL(route.request().url())
    const body = readJsonBody(route)
    if (url.searchParams.has('id') || body.id !== MOCK_TOKENS[0].id) {
      return badRequest(route, 'token/delete must submit token id in JSON body')
    }
    return route.fulfill({ status: 200, json: { success: true } })
  })
}
