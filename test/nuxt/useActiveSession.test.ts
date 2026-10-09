import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { setResponseStatus } from 'h3'
import { useActiveSession } from '../../app/composables/useActiveSession'

let open: { id: number } | null = null
registerEndpoint('/api/workouts/sessions/active', (event) => {
  if (open) return open
  setResponseStatus(event, 204)
  return null
})

const Probe = defineComponent({
  async setup(_, { expose }) {
    const { session, status, refresh } = await useActiveSession()
    expose({ refresh })
    return () => h('p', `${status.value}:${session.value === null ? 'null' : (session.value?.id ?? 'undefined')}`)
  }
})

async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
}

afterEach(() => {
  open = null
  clearNuxtData()
})

describe('useActiveSession', () => {
  it('turns the 204 for no open workout into null, then refreshes to the open one', async () => {
    const wrapper = await mountSuspended(Probe)
    await settle()
    expect(wrapper.text()).toBe('success:null')
    open = { id: 42 }
    await (wrapper.vm as unknown as { refresh: () => Promise<void> }).refresh()
    await settle()
    expect(wrapper.text()).toBe('success:42')
    wrapper.unmount()
  })
})
