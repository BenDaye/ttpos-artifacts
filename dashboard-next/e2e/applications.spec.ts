import type { Locator, Page } from '@playwright/test'
import { expect, authedTest as test } from './_fixtures/auth.fixture'
import { MOCK_APPS } from './_fixtures/handlers'

// 模拟 dnd-kit 拖拽：先越过 PointerSensor 的 8px 激活阈值，再分步移动到目标中心，
// 确保拖拽过程中产生足够的 pointermove 事件供碰撞检测跟踪。
async function dragGripOnto(page: Page, grip: Locator, target: Locator) {
  const gb = await grip.boundingBox()
  const tb = await target.boundingBox()
  if (!gb || !tb) {
    throw new Error('missing bounding box for drag')
  }
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2)
  await page.mouse.down()
  await page.mouse.move(gb.x + gb.width / 2 + 12, gb.y + gb.height / 2, { steps: 5 })
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 12 })
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2 + 6, { steps: 4 })
  await page.mouse.up()
}

test.describe('Applications page', () => {
  test('displays app list from mock data', async ({ page }) => {
    await page.goto('/applications')

    for (const app of MOCK_APPS) {
      await expect(page.getByText(app.AppName)).toBeVisible()
    }
  })

  test('navigates to app detail on card click', async ({ page }) => {
    await page.goto('/applications')

    await page.getByText('TTPOS-Cashier').click()
    await expect(page).toHaveURL(/\/applications\/TTPOS-Cashier/)
  })

  test('search filters applications', async ({ page }) => {
    await page.goto('/applications')

    await page.getByPlaceholder('Search').fill('KDS')

    await expect(page.getByText('TTPOS-KDS')).toBeVisible()
    await expect(page.getByText('TTPOS-Cashier')).not.toBeVisible()
  })

  test('search with no results shows empty state', async ({ page }) => {
    await page.goto('/applications')

    await page.getByPlaceholder('Search').fill('nonexistent-app-xyz')

    await expect(page.getByText('TTPOS-Cashier')).not.toBeVisible()
    await expect(page.getByText('TTPOS-KDS')).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'No applications yet' })).toBeVisible()
  })

  test('layout switcher exposes card / list / board buttons', async ({ page }) => {
    await page.goto('/applications')

    await expect(page.getByRole('button', { name: 'Card view' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'List view' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Board view' })).toBeVisible()

    await page.getByRole('button', { name: 'List view' }).click()
    // Switching layouts must keep apps reachable.
    await expect(page.getByText('TTPOS-Cashier')).toBeVisible()
  })

  test('board view shows one column per app with version cards inside', async ({ page }) => {
    await page.goto('/applications')

    await page.getByRole('button', { name: 'Board view' }).click()

    // Each app gets its own column header (app name + version count).
    await expect(page.getByText('TTPOS-Cashier')).toBeVisible()
    await expect(page.getByText('TTPOS-KDS')).toBeVisible()
    // Mocked search returns 1 version per app, so both columns render the
    // 1.0.0 / stable badge inside their version card.
    await expect(page.getByText('1.0.0').first()).toBeVisible()
    await expect(page.getByText('stable', { exact: true }).first()).toBeVisible()
  })

  test('board version card opens quick detail dialog without leaving board', async ({ page }) => {
    await page.goto('/applications')

    await page.getByRole('button', { name: 'Board view' }).click()
    await page.getByTestId('board-version-card').first().click()

    await expect(page).toHaveURL(/\/applications$/)
    const dialog = page.getByTestId('version-detail-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('version-detail-title')).toHaveText('1.0.0')
    await expect(dialog.getByTestId('version-detail-title')).toHaveAttribute('data-version-tone', 'published')
    await expect(dialog.getByTestId('version-detail-channel-chip')).toHaveText('STABLE')
    await expect(dialog.getByTestId('version-detail-status')).toContainText('Published')
    await expect(dialog.getByText('cashier-1.0.0.apk')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Add artifact' })).toBeVisible()

    await dialog.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit version' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Edit version' })).not.toBeVisible({ timeout: 5000 })

    await dialog.locator('button[type="button"]:visible', { hasText: /^Close$/ }).first().click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await page.getByTestId('board-column-open').first().click()
    await expect(page).toHaveURL(/\/applications\/TTPOS-Cashier/)
  })

  test('new app button opens create dialog', async ({ page }) => {
    await page.goto('/applications')

    await page.getByRole('button', { name: 'New app' }).first().click()
    await expect(page.getByRole('heading', { name: 'Create application' })).toBeVisible()
  })

  test('card view drag reorders applications and posts new order', async ({ page }) => {
    await page.goto('/applications')
    await page.getByRole('button', { name: 'Card view' }).click()
    await expect(page.getByText('TTPOS-Cashier')).toBeVisible()

    // exact 匹配仅命中 grip 手柄本身；可点击的 Card/列头(role=button)其可访问名由内容
    // 拼接而成会包含 'Drag to reorder' 子串，需排除。
    const grips = page.getByRole('button', { name: 'Drag to reorder', exact: true })
    await expect(grips).toHaveCount(MOCK_APPS.length)

    const reorderRequest = page.waitForRequest('**/app/reorder')
    // 把第一张卡片(Cashier)拖到第二张(KDS)位置 → 新顺序 [KDS, Cashier]
    await dragGripOnto(page, grips.first(), page.getByText('TTPOS-KDS'))

    const request = await reorderRequest
    expect(request.method()).toBe('POST')
    expect(request.postDataJSON()).toEqual({ ids: [MOCK_APPS[1].ID, MOCK_APPS[0].ID] })
  })

  test('card view drag visually reorders and persists the new order', async ({ page }) => {
    // stateful mock：/app/reorder 记录新顺序，/app/list 按记录顺序返回，
    // 覆盖「乐观更新 → POST → onSettled invalidate 重新拉取」整链后 DOM 持久重排。
    // 后注册的 route 优先（Playwright LIFO），覆盖共享 fixture 的静态 mock，仅作用于本用例。
    const byId = new Map(MOCK_APPS.map(app => [app.ID, app]))
    let orderedIds = MOCK_APPS.map(app => app.ID)
    await page.route('**/app/list*', route =>
      route.fulfill({ json: { apps: orderedIds.map(id => byId.get(id)), total: orderedIds.length } }))
    await page.route('**/app/reorder', (route) => {
      const body = route.request().postDataJSON()
      if (Array.isArray(body?.ids)) {
        orderedIds = body.ids
      }
      return route.fulfill({ json: { success: true } })
    })

    await page.goto('/applications')
    await page.getByRole('button', { name: 'Card view' }).click()

    const names = page.getByText(/^TTPOS-(Cashier|KDS)$/)
    await expect(names).toHaveText(['TTPOS-Cashier', 'TTPOS-KDS'])

    const grips = page.getByRole('button', { name: 'Drag to reorder', exact: true })
    await dragGripOnto(page, grips.first(), page.getByText('TTPOS-KDS'))

    // settle 后重新拉取的列表也反映新顺序 → DOM 持久为 [KDS, Cashier]
    await expect(names).toHaveText(['TTPOS-KDS', 'TTPOS-Cashier'])
  })

  test('board view drag reorders columns and posts new order', async ({ page }) => {
    await page.goto('/applications')
    await page.getByRole('button', { name: 'Board view' }).click()
    await expect(page.getByText('TTPOS-Cashier')).toBeVisible()
    await expect(page.getByText('TTPOS-KDS')).toBeVisible()

    // exact 匹配仅命中 grip 手柄本身；可点击的 Card/列头(role=button)其可访问名由内容
    // 拼接而成会包含 'Drag to reorder' 子串，需排除。
    const grips = page.getByRole('button', { name: 'Drag to reorder', exact: true })
    await expect(grips).toHaveCount(MOCK_APPS.length)

    const reorderRequest = page.waitForRequest('**/app/reorder')
    // 把第一列(Cashier)拖到第二列(KDS)位置 → 新顺序 [KDS, Cashier]
    await dragGripOnto(page, grips.first(), page.getByText('TTPOS-KDS'))

    const request = await reorderRequest
    expect(request.method()).toBe('POST')
    expect(request.postDataJSON()).toEqual({ ids: [MOCK_APPS[1].ID, MOCK_APPS[0].ID] })
  })
})
