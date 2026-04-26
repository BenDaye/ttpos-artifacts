/* eslint-disable react/rules-of-hooks */
// `use` here is the Playwright fixture callback, not React's `use` hook.
import { test as base } from '@playwright/test'
import { setupMockApi, TEST_TOKEN } from './handlers'

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      // Pin language to English so i18n-driven selectors are stable.
      window.localStorage.setItem('i18nextLng', 'en')
    })
    await setupMockApi(page)
    await use(page)
  },
})

export const authedTest = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((token: string) => {
      window.localStorage.setItem('i18nextLng', 'en')
      window.localStorage.setItem('token', token)
    }, TEST_TOKEN)
    await setupMockApi(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'
