import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import SettingsAdminTokens from '../../app/components/settings/SettingsAdminTokens.vue'

const { toastAdd } = vi.hoisted(() => ({ toastAdd: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add: toastAdd }))

interface Row {
  id: number
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  ownerEmail: string
}

const state = vi.hoisted(() => ({ rows: [] as Row[], deleted: [] as string[], failList: false, failDelete: false }))

registerEndpoint('/api/admin/tokens', {
  method: 'GET',
  handler: () => {
    if (state.failList) throw createError({ statusCode: 500, statusMessage: 'Boom' })
    return state.rows
  }
})
registerEndpoint('/api/admin/tokens/4', {
  method: 'DELETE',
  handler: () => {
    if (state.failDelete) throw createError({ statusCode: 500, statusMessage: 'Boom' })
    state.deleted.push('DELETE /api/admin/tokens/4')
    state.rows = state.rows.filter((r) => r.id !== 4)
    return null
  }
})

const row: Row = {
  id: 4,
  name: 'Home Assistant',
  prefix: 'zz99yy88',
  createdAt: '2026-10-01T12:00:00.000Z',
  lastUsedAt: null,
  ownerEmail: 'bob@example.com'
}

beforeEach(() => {
  state.rows = [row]
  state.deleted = []
  state.failList = false
  state.failDelete = false
})

afterEach(() => {
  toastAdd.mockReset()
  document.body.innerHTML = ''
})

describe('SettingsAdminTokens', () => {
  it('lists tokens with owner, name and prefix', async () => {
    const wrapper = await mountSuspended(SettingsAdminTokens)
    const rows = wrapper.findAll('[data-test="admin-token-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('bob@example.com')
    expect(rows[0]!.text()).toContain('Home Assistant')
    expect(rows[0]!.text()).toContain('mfj_zz99yy88…')
    wrapper.unmount()
  })

  it('shows an empty state', async () => {
    state.rows = []
    const wrapper = await mountSuspended(SettingsAdminTokens)
    expect(wrapper.find('[data-test="admin-tokens-empty"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('revokes after confirming in a sheet', async () => {
    const wrapper = await mountSuspended(SettingsAdminTokens, { attachTo: document.body })
    await wrapper.find('button[aria-label="Revoke Home Assistant for bob@example.com"]').trigger('click')
    await vi.waitFor(() => expect(document.body.querySelector('[data-test="admin-revoke-confirm"]')).not.toBeNull())
    expect(state.deleted).toEqual([])
    ;(document.body.querySelector('[data-test="admin-revoke-confirm"]') as HTMLElement).click()
    await vi.waitFor(() => expect(state.deleted).toEqual(['DELETE /api/admin/tokens/4']))
    await vi.waitFor(() => expect(wrapper.find('[data-test="admin-tokens-empty"]').exists()).toBe(true))
    wrapper.unmount()
  })

  it('toasts an error when revoke fails and keeps the row', async () => {
    state.failDelete = true
    const wrapper = await mountSuspended(SettingsAdminTokens, { attachTo: document.body })
    await wrapper.find('button[aria-label="Revoke Home Assistant for bob@example.com"]').trigger('click')
    await vi.waitFor(() => expect(document.body.querySelector('[data-test="admin-revoke-confirm"]')).not.toBeNull())
    ;(document.body.querySelector('[data-test="admin-revoke-confirm"]') as HTMLElement).click()
    await vi.waitFor(() => expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' })))
    expect(toastAdd.mock.calls[0]![0].title).toBe('Revoke failed')
    await vi.waitFor(() => expect(wrapper.findAll('[data-test="admin-token-row"]')).toHaveLength(1))
    wrapper.unmount()
  })

  it('shows an error line, not the empty state, when the list fails to load', async () => {
    state.failList = true
    const wrapper = await mountSuspended(SettingsAdminTokens)
    expect(wrapper.find('[data-test="admin-tokens-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="admin-tokens-empty"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
