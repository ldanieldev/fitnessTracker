import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import SettingsAdminTokens from '../../app/components/settings/SettingsAdminTokens.vue'
import SettingsAdminUsers from '../../app/components/settings/SettingsAdminUsers.vue'

const { toastAdd } = vi.hoisted(() => ({ toastAdd: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add: toastAdd }))

interface Row {
  id: number
  name: string
  email: string
  createdAt: string
  isActive: boolean
  isAdmin: boolean
  providers: string[]
  tokenCount: number
  tokenLastUsedAt: string | null
}

const state = vi.hoisted(() => ({
  rows: [] as Row[],
  calls: [] as string[],
  patched: null as unknown,
  fail: false,
  failList: false,
  tokenFetches: 0
}))

registerEndpoint('/api/admin/tokens', {
  method: 'GET',
  handler: () => {
    state.tokenFetches++
    return []
  }
})

registerEndpoint('/api/admin/users', {
  method: 'GET',
  handler: () => {
    if (state.failList) throw createError({ statusCode: 500, statusMessage: 'Boom' })
    return state.rows
  }
})
registerEndpoint('/api/admin/users/2', {
  method: 'PATCH',
  handler: async (event) => {
    if (state.fail) throw createError({ statusCode: 500, statusMessage: 'Boom' })
    state.patched = await readBody(event)
    state.calls.push('PATCH /api/admin/users/2')
    state.rows = state.rows.map((r) => (r.id === 2 ? { ...r, isActive: true } : r))
    return { id: 2, isActive: true }
  }
})
registerEndpoint('/api/admin/users/2', {
  method: 'DELETE',
  handler: () => {
    state.calls.push('DELETE /api/admin/users/2')
    state.rows = state.rows.filter((r) => r.id !== 2)
    return null
  }
})

const admin: Row = {
  id: 1,
  name: 'Ada',
  email: 'ada@example.com',
  createdAt: '2026-09-01T10:00:00.000Z',
  isActive: true,
  isAdmin: true,
  providers: ['credentials'],
  tokenCount: 0,
  tokenLastUsedAt: null
}
const target: Row = {
  ...admin,
  id: 2,
  name: 'Bob',
  email: 'bob@example.com',
  isActive: false,
  isAdmin: false,
  providers: ['github']
}

beforeEach(() => {
  state.rows = [admin, target]
  state.calls = []
  state.patched = null
  state.fail = false
  state.failList = false
  state.tokenFetches = 0
})

afterEach(() => {
  toastAdd.mockReset()
  document.body.innerHTML = ''
})

type Item = { label: string; testId: string; onSelect: () => void }

function menuItems(wrapper: Awaited<ReturnType<typeof mountSuspended>>, label: string) {
  const menus = wrapper.findAllComponents({ name: 'AppMenuButton' })
  const menu = menus.find((m: { props: (k: string) => unknown }) => m.props('label') === label)!
  return (menu.props('items') as Item[][]).flat()
}

describe('SettingsAdminUsers', () => {
  it('lists users, badges the admin and disabled rows, and gives the admin no menu', async () => {
    const wrapper = await mountSuspended(SettingsAdminUsers)
    const rows = wrapper.findAll('[data-test="admin-user-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Admin')
    expect(rows[0]!.find('[data-test="admin-user-menu"]').exists()).toBe(false)
    expect(rows[1]!.text()).toContain('Disabled')
    expect(rows[1]!.text()).toContain('github')
    expect(rows[1]!.find('[data-test="admin-user-menu"]').exists()).toBe(true)
    expect(menuItems(wrapper, 'Actions for bob@example.com').map((i) => i.label)).toEqual(['Enable', 'Delete'])
    wrapper.unmount()
  })

  it('enables a disabled user with PATCH { isActive: true }', async () => {
    const wrapper = await mountSuspended(SettingsAdminUsers, { attachTo: document.body })
    menuItems(wrapper, 'Actions for bob@example.com')[0]!.onSelect()
    await vi.waitFor(() => expect(state.calls).toEqual(['PATCH /api/admin/users/2']))
    expect(state.patched).toEqual({ isActive: true })
    await vi.waitFor(() => expect(wrapper.findAll('[data-test="admin-user-row"]')[1]!.text()).not.toContain('Disabled'))
    wrapper.unmount()
  })

  it('confirms a delete only after the exact email is typed, then refetches', async () => {
    const wrapper = await mountSuspended(SettingsAdminUsers, { attachTo: document.body })
    menuItems(wrapper, 'Actions for bob@example.com')[1]!.onSelect()
    await vi.waitFor(() => expect(document.body.querySelector('[data-test="admin-delete-sheet"]')).not.toBeNull())
    const confirm = () => document.body.querySelector('[data-test="admin-delete-confirm"]') as HTMLButtonElement
    const email = () => document.body.querySelector('[data-test="admin-delete-email"]') as HTMLInputElement
    expect(confirm().disabled).toBe(true)
    email().value = 'bob@example.co'
    email().dispatchEvent(new Event('input'))
    await vi.waitFor(() => expect(confirm().disabled).toBe(true))
    email().value = 'bob@example.com'
    email().dispatchEvent(new Event('input'))
    await vi.waitFor(() => expect(confirm().disabled).toBe(false))
    confirm().click()
    await vi.waitFor(() => expect(state.calls).toEqual(['DELETE /api/admin/users/2']))
    await vi.waitFor(() => expect(wrapper.findAll('[data-test="admin-user-row"]')).toHaveLength(1))
    wrapper.unmount()
  })

  it('refetches the tokens card after a status change and after a delete', async () => {
    const tokens = await mountSuspended(SettingsAdminTokens)
    const wrapper = await mountSuspended(SettingsAdminUsers, { attachTo: document.body })
    const before = state.tokenFetches
    menuItems(wrapper, 'Actions for bob@example.com')[0]!.onSelect()
    await vi.waitFor(() => expect(state.tokenFetches).toBe(before + 1))
    menuItems(wrapper, 'Actions for bob@example.com')[1]!.onSelect()
    await vi.waitFor(() => expect(document.body.querySelector('[data-test="admin-delete-email"]')).not.toBeNull())
    const email = document.body.querySelector('[data-test="admin-delete-email"]') as HTMLInputElement
    email.value = 'bob@example.com'
    email.dispatchEvent(new Event('input'))
    const confirm = () => document.body.querySelector('[data-test="admin-delete-confirm"]') as HTMLButtonElement
    await vi.waitFor(() => expect(confirm().disabled).toBe(false))
    confirm().click()
    await vi.waitFor(() => expect(state.tokenFetches).toBe(before + 2))
    wrapper.unmount()
    tokens.unmount()
  })

  it('toasts an error when a change fails', async () => {
    state.fail = true
    const wrapper = await mountSuspended(SettingsAdminUsers, { attachTo: document.body })
    menuItems(wrapper, 'Actions for bob@example.com')[0]!.onSelect()
    await vi.waitFor(() => expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' })))
    expect(toastAdd.mock.calls[0]![0].description).toBe('Boom')
    wrapper.unmount()
  })

  it('toasts an error when disable fails', async () => {
    state.fail = true
    state.rows = [admin, { ...target, isActive: true }]
    const wrapper = await mountSuspended(SettingsAdminUsers, { attachTo: document.body })
    menuItems(wrapper, 'Actions for bob@example.com')[0]!.onSelect()
    await vi.waitFor(() => expect(document.body.querySelector('[data-test="admin-disable-confirm"]')).not.toBeNull())
    ;(document.body.querySelector('[data-test="admin-disable-confirm"]') as HTMLElement).click()
    await vi.waitFor(() => expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' })))
    expect(toastAdd.mock.calls[0]![0].title).toBe('Update failed')
    wrapper.unmount()
  })

  it('shows an error line instead of an empty list when loading fails', async () => {
    state.failList = true
    const wrapper = await mountSuspended(SettingsAdminUsers)
    expect(wrapper.find('[data-test="admin-users-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="admin-user-row"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
