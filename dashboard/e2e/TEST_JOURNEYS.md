# E2E Test Journeys — FaynoSync Dashboard

> Generated via Playwright MCP live exploration on 2026-03-20
> Backend: `https://9977--main--flutter--ben.coder.gezi.vip`

## Testing Philosophy

**CLI is the standard, MCP is the extension.**

| Layer | Tool | Purpose | When |
|-------|------|---------|------|
| **Standard** | `yarn test:e2e` (Playwright Test CLI) | Deterministic regression tests with mock API | CI, pre-commit, every PR |
| **Extension** | Playwright MCP (user-level) | Interactive browser exploration, debug, discover new test paths | Development, bug investigation |

Workflow: MCP explores → discovers test paths → codified into `.spec.ts` → CLI runs deterministically.

---

## 1. Authentication

### 1.1 Sign In — Happy Path
1. Navigate to `/signin`
2. Fill `Username` = "ttpos", `password` = "ttpos@123"
3. Click **Login**
4. Assert: URL → `/applications`, sidebar visible, 7 app cards rendered

### 1.2 Sign In — Validation
1. Submit empty form → "Required field" errors
2. Username < 3 chars → "Minimum 3 symbol"
3. Password < 6 chars → "Minimum 6 symbol"

### 1.3 Sign In — Server Error
1. Wrong credentials → red error text "Invalid username or password"

### 1.4 Auth Guard
1. Navigate `/applications` without token → redirect to `/signin`
2. Navigate `/channels` without token → redirect to `/signin` with `state.from`
3. After login → redirect back to original path

### 1.5 Logout
1. Click Settings gear → click **Logout**
2. Assert: URL → `/signin`, localStorage token cleared

---

## 2. Navigation

### 2.1 Sidebar Navigation
Pages: Applications, Channels, Platforms, Architectures, Statistics
- Click each sidebar button → assert URL + heading visible

### 2.2 Settings Menu (Admin)
1. Click gear icon → popup shows: username "ttpos" + crown, Profile, Settings, Logout
2. Click **Settings** → navigate to `/settings`

### 2.3 Profile Modal
1. Gear → **Profile** → modal: username, "Administrator", Change Password form
2. Generate button creates random password
3. Change Password validates: min 8 chars, passwords must match

---

## 3. Applications

### 3.1 App List (Card View)
- 7 apps rendered: TTPOS, TTPOS Go, TTPOS Kiosk, TTPOS Kitchen, TTPOS Menu, TTPOS Queue, TTPOS Shop
- Each card: logo, name, description ("No description available"), edit/delete buttons

### 3.2 Search
1. Type "Kitchen" in Search → only TTPOS Kitchen visible
2. Type "nonexistent" → all cards hidden

### 3.3 Layout Switching
- **Card view** (default): grid of cards
- **List view**: table rows
- **Board view**: kanban columns per app, showing version/channel/status/artifacts
- Layout persists across page navigations (localStorage)

### 3.4 App Detail (Version List)
1. Click app card → URL `/applications/:appName`
2. Version cards: version number, channel badge, "Published"/"Draft", artifact count, changelog excerpt
3. **Back** button returns to `/applications`

### 3.5 Version Filters
Dropdowns: All Channels (dev/prod/test), All Platforms, All Architectures, Publication Status, Critical Status
- Select "prod" → "No versions have been uploaded yet."
- **Reset Filters** button clears all

### 3.6 Download Artifacts Modal
1. Click download icon on version
2. Modal: "Select Artifact to Download"
3. Lists: platform, architecture, package type, GCS download link, copy button
4. Example: `android/arm64 - .apk` → `https://storage.googleapis.com/...TTPOS-2.20.0.apk`

### 3.7 Edit Version Modal
1. Click edit icon on version
2. Read-only: App Name, Version, Channel
3. **Existing Artifacts** list with replace/delete buttons per artifact
4. **Add New Files** upload zone
5. **Changelog**: Markdown editor with Preview toggle
6. Checkboxes: Published, Critical, Intermediate
7. Cancel / Save buttons

### 3.8 Delete Version Modal
1. Click delete icon on version
2. Confirmation modal (type-to-confirm pattern)

### 3.9 Create App Modal
1. Click **Create app** button
2. Fields: App Name, Description, Private checkbox, Enable TUF checkbox, Logo upload
3. Submit → app appears in list

### 3.10 Upload Version Modal
1. Click **Upload the app** button
2. Modal: "Upload Application"
3. Fields: App Name (dropdown), Version, Channel, Platform, Updater (conditional), Architecture, Publish/Critical/Intermediate checkboxes, Changelog (Markdown), File upload (required)

---

## 4. Channels CRUD

### 4.1 List
- Cards: dev, prod, test
- Each card: name heading + trash button

### 4.2 Create
1. Click **Create Channel** → modal: input "Channel Name", Cancel/Create
2. Fill "nightly" → Create → modal closes, "nightly" card appears
3. Validation: names with `-` are rejected ("invalid channel name")

### 4.3 Edit
1. Click channel card text → Edit Channel modal
2. Input "Rename Channel" pre-filled with current name
3. Cancel / Save buttons

### 4.4 Delete
1. Click trash icon → "Delete Confirmation" modal
2. Must type exact channel name to enable Delete button (type-to-confirm)
3. Confirm → channel removed from list

### 4.5 Search
1. Type in Search → client-side filter
2. No matches → "No channels found matching your search."

---

## 5. Platforms CRUD

### 5.1 List
- Cards: android, ios, macos, windows
- Each card shows: updater count, default updater type ("Default: manual")

### 5.2 Create
1. **Create Platform** → modal with Platform Name + Updaters section
2. Create button is disabled until name filled
3. **Updaters** (expandable):
   - Manual (default, selected)
   - Squirrel (Darwin) — macOS
   - Squirrel (Windows)
   - Sparkle — macOS (Not implemented)
   - Electron Builder
   - Tauri
4. Each updater has "Set as default" radio

### 5.3 Edit / Delete
- Same pattern as Channels (click card → edit, trash → type-to-confirm delete)

---

## 6. Architectures CRUD

### 6.1 List
- Cards: amd64, arm64

### 6.2 Create / Edit / Delete
- Identical UX pattern to Channels (simple name field)

---

## 7. Settings

### 7.1 Users Tab (`/settings`)
- Table: Username, per-domain permissions (Apps/Channels/Platforms/Architectures)
- Permission checkboxes: Create, Delete, Edit, Download, Upload, Allowed
- **Allowed** buttons show count + popup to select specific items
- Row actions: Save (floppy icon), Edit (pencil), Delete (trash)
- **Create User** button at top

### 7.2 CI/CD Tokens Tab (`/settings/tokens`)
- **Create form**: Token name, Expiration (1d/7d/30d/90d/Never), Select allowed apps, Create token
- **Issued tokens table**: Name, Prefix, Allowed apps, Expires, Created, Last used, Revoke (trash)
- Real data: "GitHub Actions" token with prefix `fns_2639ca19`, 7 apps allowed

### 7.3 TUF Tab (`/settings/tuf`)
- App selector dropdown: "Select an app with TUF enabled"
- History section (currently empty)
- Multi-step wizard for TUF key management (not explored — no TUF-enabled apps)

---

## 8. Statistics (`/statistics`)

- **Note**: Telemetry API returns 404 in test environment
- Expected UI: summary stat cards, bar/pie/line charts, filter dropdowns (Apps/Channels/Platforms/Architectures), date range presets (Today/Week/Month), custom date picker
- **E2E tests must mock `/telemetry` endpoint**

---

## 9. Theme Switching

Available on every page header:
- **Light theme** (default)
- **Dark theme**
- **Auto theme** (time-of-day + prefers-color-scheme)
- Toggle via radio group

---

## Test Priority Matrix

| Priority | Journey | Test File | Tests |
|----------|---------|-----------|-------|
| P0 | Sign in / Sign out / Auth guard | auth.spec.ts | 7 |
| P0 | Sidebar navigation + settings menu | navigation.spec.ts | 3 |
| P0 | App list + search + layout + modals | applications.spec.ts | 7 |
| P0 | Channel CRUD + search | channels.spec.ts | 6 |
| P1 | Platform CRUD + updaters | platforms.spec.ts | 7 |
| P1 | Architecture CRUD + search | architectures.spec.ts | 6 |
| P1 | Version detail + filters + modals | app-detail.spec.ts | 6 |
| P1 | CI/CD token management | settings-tokens.spec.ts | 7 |
| P2 | User management (permissions) | - | - |
| P2 | Layout switching persistence | - | - |
| P2 | Profile / change password | - | - |
| P2 | Theme switching | - | - |
| P3 | Statistics (mock telemetry) | - | - |
| P3 | Upload version (file upload) | - | - |
| P3 | Create app (with logo upload) | - | - |
| P3 | TUF wizard | - | - |

**Current coverage: 49 tests across 8 spec files (P0 + P1 complete)**

---

## Key Selectors Reference

| Element | Selector |
|---------|----------|
| Sidebar nav buttons | `button:has-text(" Applications")` etc. |
| Settings gear | `button[aria-label="Settings"]` or `getByRole('button', { name: 'Settings' })` |
| Settings popup items | `.settings-popup-button` container |
| Layout switcher | `radio "Card view"`, `radio "List view"`, `radio "Board view"` |
| Theme switcher | `radio "Light theme"`, `radio "Dark theme"`, `radio "Auto theme"` |
| Search input | `textbox "Search..."` |
| Create Channel input | `getByLabel('Channel Name')` |
| Edit Channel input | `getByLabel('Rename Channel')` |
| Delete confirm input | `textbox "Enter channel name"` |
| Create button (modal) | `getByRole('button', { name: 'Create', exact: true })` |
| Delete button (card) | `getByTitle('Delete channel')` / `getByTitle('Delete platform')` etc. |
| Version filters | `combobox` with text "All Channels" / "All Platforms" etc. |
| Artifacts expand | `button "Artifacts: ..."` |
| Changelog | `button "View full changelog"` |

> **Note**: Modals use custom overlays (NOT Radix Dialog), so `role="dialog"` won't work.
