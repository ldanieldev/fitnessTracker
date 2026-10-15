import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import SettingsAccessTokens from '../../app/components/settings/SettingsAccessTokens.vue'

const { toastAdd } = vi.hoisted(() => ({ toastAdd: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add: toastAdd }))

interface Row {
  id: number
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

const state = vi.hoisted(() => ({
  rows: [] as Row[],
  posted: null as unknown,
  deleted: [] as string[],
  conflict: false
}))
const secret = 'mfj_abcd1234efgh5678ijkl9012mnop3456'

registerEndpoint('/api/tokens', {
  method: 'GET',
  handler: () => state.rows
})
registerEndpoint('/api/tokens', {
  method: 'POST',
  handler: async (event) => {
    state.posted = await readBody(event)
    if (state.conflict) throw createError({ statusCode: 409, statusMessage: 'Token name already used' })
    const row = { id: 9, name: 'Claude', prefix: 'abcd1234', createdAt: '2026-10-14T10:00:00.000Z', lastUsedAt: null }
    state.rows = [row, ...state.rows]
    return { token: secret, row }
  }
})
for (const id of [4, 5, 9]) {
  registerEndpoint(`/api/tokens/${id}`, {
    method: 'DELETE',
    handler: () => {
      if (id === 5) throw createError({ statusCode: 500, statusMessage: 'Boom' })
      state.deleted.push(`DELETE /api/tokens/${id}`)
      state.rows = state.rows.filter((r) => r.id !== id)
      return null
    }
  })
}

const row: Row = {
  id: 4,
  name: 'Home Assistant',
  prefix: 'zz99yy88',
  createdAt: '2026-10-01T12:00:00.000Z',
  lastUsedAt: null
}

beforeEach(() => {
  state.rows = [row]
  state.posted = null
  state.deleted = []
  state.conflict = false
})

afterEach(() => {
  toastAdd.mockReset()
  document.body.innerHTML = ''
})

describe('SettingsAccessTokens', () => {
  it('lists tokens with prefix, created date and Never for unused', async () => {
    const wrapper = await mountSuspended(SettingsAccessTokens)
    const rows = wrapper.findAll('[data-test="token-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Home Assistant')
    expect(rows[0]!.text()).toContain('mfj_zz99yy88…')
    expect(rows[0]!.text()).toContain('Created')
    expect(rows[0]!.text()).toContain('Last used Never')
    wrapper.unmount()
  })

  it('shows an empty state', async () => {
    state.rows = []
    const wrapper = await mountSuspended(SettingsAccessTokens)
    expect(wrapper.find('[data-test="tokens-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="token-row"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('creates a token, reveals the secret once with a curl example, and hides it on Done', async () => {
    const wrapper = await mountSuspended(SettingsAccessTokens)
    await wrapper.find('input[data-test="token-name"]').setValue('  Claude ')
    await wrapper.find('[data-test="token-create"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-test="token-secret"]').exists()).toBe(true))
    expect(state.posted).toEqual({ name: 'Claude' })
    expect((wrapper.find('[data-test="token-secret"]').element as HTMLInputElement).value).toBe(secret)
    expect(wrapper.find('[data-test="token-copy"]').exists()).toBe(true)
    const curl = wrapper.find('[data-test="token-curl"]').text()
    expect(curl).toContain(`Authorization: Bearer ${secret}`)
    expect(curl).toContain('/api/export?from=')
    await vi.waitFor(() => expect(wrapper.findAll('[data-test="token-row"]')).toHaveLength(2))

    await wrapper.find('[data-test="token-done"]').trigger('click')
    expect(wrapper.find('[data-test="token-secret"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Bearer')
    expect(wrapper.find('[data-test="token-reveal"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('revokes only the confirmed row and refreshes the list', async () => {
    state.rows = [row, { ...row, id: 5, name: 'Other' }]
    const wrapper = await mountSuspended(SettingsAccessTokens, { attachTo: document.body })
    await wrapper.find('button[aria-label="Revoke Home Assistant"]').trigger('click')
    await vi.waitFor(() => expect(document.body.querySelector('[data-test="confirm-revoke"]')).not.toBeNull())
    ;(document.body.querySelector('[data-test="confirm-revoke"]') as HTMLElement).click()
    await vi.waitFor(() => expect(state.deleted).toEqual(['DELETE /api/tokens/4']))
    await vi.waitFor(() => expect(wrapper.findAll('[data-test="token-row"]')).toHaveLength(1))
    expect(wrapper.find('[data-test="token-row"]').text()).toContain('Other')
    wrapper.unmount()
  })

  it('keeps the revealed secret when another token is revoked and drops it when its own token is', async () => {
    const wrapper = await mountSuspended(SettingsAccessTokens, { attachTo: document.body })
    await wrapper.find('input[data-test="token-name"]').setValue('Claude')
    await wrapper.find('[data-test="token-create"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('[data-test="token-row"]')).toHaveLength(2))

    for (const [label, remaining] of [['Revoke Home Assistant', 1], ['Revoke Claude', 0]] as const) {
      await wrapper.find(`button[aria-label="${label}"]`).trigger('click')
      await vi.waitFor(() => expect(document.body.querySelector('[data-test="confirm-revoke"]')).not.toBeNull())
      ;(document.body.querySelector('[data-test="confirm-revoke"]') as HTMLElement).click()
      await vi.waitFor(() => expect(wrapper.findAll('[data-test="token-row"]')).toHaveLength(remaining))
      expect(wrapper.find('[data-test="token-reveal"]').exists()).toBe(remaining === 1)
    }
    expect(state.deleted).toEqual(['DELETE /api/tokens/4', 'DELETE /api/tokens/9'])
    wrapper.unmount()
  })

  it('toasts an error when revoke fails', async () => {
    state.rows = [{ ...row, id: 5, name: 'Other' }]
    const wrapper = await mountSuspended(SettingsAccessTokens, { attachTo: document.body })
    await wrapper.find('button[aria-label="Revoke Other"]').trigger('click')
    await vi.waitFor(() => expect(document.body.querySelector('[data-test="confirm-revoke"]')).not.toBeNull())
    ;(document.body.querySelector('[data-test="confirm-revoke"]') as HTMLElement).click()
    await vi.waitFor(() => expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' })))
    expect(toastAdd.mock.calls[0]![0].title).toBe('Revoke failed')
    wrapper.unmount()
  })

  it('toasts an error on a 409 and keeps the typed name', async () => {
    state.conflict = true
    const wrapper = await mountSuspended(SettingsAccessTokens)
    await wrapper.find('input[data-test="token-name"]').setValue('Claude')
    await wrapper.find('[data-test="token-create"]').trigger('click')
    await vi.waitFor(() => expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' })))
    expect(toastAdd.mock.calls[0]![0].description).toBe('Token name already used')
    expect((wrapper.find('input[data-test="token-name"]').element as HTMLInputElement).value).toBe('Claude')
    expect(wrapper.find('[data-test="token-secret"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('disables Create while the name is blank', async () => {
    const wrapper = await mountSuspended(SettingsAccessTokens)
    const create = () => wrapper.find('[data-test="token-create"]')
    expect(create().attributes('disabled')).toBeDefined()
    await wrapper.find('input[data-test="token-name"]').setValue('   ')
    expect(create().attributes('disabled')).toBeDefined()
    await wrapper.find('input[data-test="token-name"]').setValue('Claude')
    expect(create().attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})
