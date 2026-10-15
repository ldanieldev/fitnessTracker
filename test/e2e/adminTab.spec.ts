import type { Browser, Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { borrowAdmin, restoreAdmin } from './adminBorrow'
import { apiFetch, makeUser, registerViaApi } from './helpers'

test.afterEach(async () => {
  await restoreAdmin()
})

async function setupAdmin(page: Page, goto: (url: string, opts?: { waitUntil: 'hydration' }) => Promise<unknown>) {
  await goto('/', { waitUntil: 'hydration' })
  const admin = await registerViaApi(page, makeUser())
  await borrowAdmin(admin.email)
  const login = await apiFetch(page, 'POST', '/api/auth/login', { email: admin.email, password: admin.password })
  expect(login.status).toBe(200)
}

async function newTarget(browser: Browser, base: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(new URL('/', base).toString(), { waitUntil: 'networkidle' })
  const user = await registerViaApi(page, makeUser())
  return { context, page, user }
}

test('a non-admin sees no Admin link and is bounced off /settings/admin', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/settings/data', { waitUntil: 'hydration' })
  await expect(page.getByRole('link', { name: 'Data', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0)
  await goto('/settings/admin', { waitUntil: 'hydration' })
  await expect(page).toHaveURL(/\/settings\/profile$/)
})

test('admin disables, enables and deletes a user from the tab', async ({ page, goto, browser }) => {
  await setupAdmin(page, goto)
  const target = await newTarget(browser, new URL(page.url()).origin)
  try {
    await goto('/settings/data', { waitUntil: 'hydration' })
    await page.getByRole('link', { name: 'Admin', exact: true }).click()
    await expect(page).toHaveURL(/\/settings\/admin$/)

    const row = page.locator('[data-test="admin-user-row"]', { hasText: target.user.email })
    await expect(row).toBeVisible()
    const menu = row.getByRole('button', { name: `Actions for ${target.user.email}` })

    await menu.click()
    await page.getByRole('menuitem', { name: 'Disable' }).click()
    await page.locator('[data-test="admin-disable-confirm"]').click()
    await expect(row.getByText('Disabled')).toBeVisible()

    await menu.click()
    await page.getByRole('menuitem', { name: 'Enable' }).click()
    await expect(row.getByText('Disabled')).toHaveCount(0)

    await menu.click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    const confirm = page.locator('[data-test="admin-delete-confirm"]')
    await expect(confirm).toBeDisabled()
    await page.locator('[data-test="admin-delete-email"]').fill('wrong@example.com')
    await expect(confirm).toBeDisabled()
    await page.locator('[data-test="admin-delete-email"]').fill(target.user.email)
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(row).toHaveCount(0)
  } finally {
    await target.context.close()
  }
})

test('admin revokes a user token from the tab', async ({ page, goto, browser }) => {
  await setupAdmin(page, goto)
  const target = await newTarget(browser, new URL(page.url()).origin)
  try {
    const created = await apiFetch(target.page, 'POST', '/api/tokens', { name: 'tab-revoke' })
    expect(created.status).toBe(201)
    await goto('/settings/admin', { waitUntil: 'hydration' })

    const row = page.locator('[data-test="admin-token-row"]', { hasText: target.user.email })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: `Revoke tab-revoke for ${target.user.email}` }).click()
    await page.locator('[data-test="admin-revoke-confirm"]').click()
    await expect(row).toHaveCount(0)
  } finally {
    await target.context.close()
  }
})
