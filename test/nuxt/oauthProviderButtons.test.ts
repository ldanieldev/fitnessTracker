import { beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from '#imports'
import LoginPage from '../../app/pages/auth/login.vue'
import RegisterPage from '../../app/pages/auth/register.vue'
import SettingsProviderList from '../../app/components/settings/SettingsProviderList.vue'

const state = { providers: ['google'] as string[] }

registerEndpoint('/api/auth/oauth', () => ({ providers: state.providers }))
registerEndpoint('/api/auth/registration', () => ({ open: true }))

const hrefs = (html: string) => [...html.matchAll(/href="(\/api\/auth\/[a-z]+)"/g)].map((m) => m[1])

describe('OAuth provider buttons', () => {
  beforeEach(() => {
    state.providers = ['google']
    clearNuxtData('oauth-providers')
  })

  it('login shows only the configured provider', async () => {
    const wrapper = await mountSuspended(LoginPage)
    expect(hrefs(wrapper.html())).toEqual(['/api/auth/google'])
  })

  it('register shows only the configured provider', async () => {
    const wrapper = await mountSuspended(RegisterPage)
    expect(hrefs(wrapper.html())).toEqual(['/api/auth/google'])
  })

  it('settings offers only the configured provider to link', async () => {
    const wrapper = await mountSuspended(SettingsProviderList, { props: { linkedProviders: [] } })
    expect(wrapper.text()).toContain('Google')
    expect(wrapper.text()).not.toContain('GitHub')
  })

  it('settings keeps a linked provider visible so it can be unlinked', async () => {
    const wrapper = await mountSuspended(SettingsProviderList, {
      props: { linkedProviders: [{ provider: 'github', providerAccountId: '1', createdAt: '2026-10-19T00:00:00Z' }] }
    })
    expect(wrapper.text()).toContain('GitHub')
  })

  it('login shows no OAuth buttons or divider when none are configured', async () => {
    state.providers = []
    const wrapper = await mountSuspended(LoginPage)
    expect(hrefs(wrapper.html())).toEqual([])
    expect(wrapper.text()).not.toMatch(/\bor\b/)
  })
})
