import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { ComponentPublicInstance } from 'vue'
import { UDrawer, UModal } from '#components'
import NutritionSheet from '../../app/components/nutrition/NutritionSheet.vue'

// Nuxt UI's generic component type hits the FunctionalComponent findComponent overload; cast to get a VueWrapper.
const DrawerCtor = UDrawer as unknown as new () => ComponentPublicInstance
const ModalCtor = UModal as unknown as new () => ComponentPublicInstance

function stubMatchMedia(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }) as unknown as MediaQueryList)
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

async function mountSheet(props: Record<string, unknown> = {}) {
  const wrapper = await mountSuspended(NutritionSheet, {
    attachTo: document.body,
    props: { open: true, title: 'Edit entry', ...props },
    slots: { body: () => 'Sheet body' }
  })
  await flushPromises()
  return wrapper
}

describe('NutritionSheet', () => {
  it('renders a bottom drawer below sm', async () => {
    stubMatchMedia(true)
    const wrapper = await mountSheet({})
    expect(wrapper.findComponent(DrawerCtor).exists()).toBe(true)
    expect(wrapper.findComponent(ModalCtor).exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders a modal at sm and above', async () => {
    stubMatchMedia(false)
    const wrapper = await mountSheet({})
    expect(wrapper.findComponent(ModalCtor).exists()).toBe(true)
    expect(wrapper.findComponent(DrawerCtor).exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders a fullscreen modal on phones when fullscreen is set', async () => {
    stubMatchMedia(true)
    const wrapper = await mountSheet({ fullscreen: true })
    const modal = wrapper.findComponent(ModalCtor)
    expect(modal.exists()).toBe(true)
    // @ts-expect-error UModal generic component type loses prop specificity in test casting
    expect(modal.props('fullscreen')).toBe(true)
    wrapper.unmount()
  })

  it('renders a normal modal on desktop even when fullscreen is set', async () => {
    stubMatchMedia(false)
    const wrapper = await mountSheet({ fullscreen: true })
    // @ts-expect-error UModal generic component type loses prop specificity in test casting
    expect(wrapper.findComponent(ModalCtor).props('fullscreen')).toBe(false)
    wrapper.unmount()
  })
})
