import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import AppNavbar from '../../app/components/AppNavbar.vue'
import AppMenuButton from '../../app/components/AppMenuButton.vue'

const go = vi.fn()
const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
mockNuxtImport('navigateTo', () => navigate)
mockNuxtImport('useBackOrTo', () => () => go)

describe('AppNavbar', () => {
  it('shows the drawer toggle and no back button on a hub page', async () => {
    const wrapper = await mountSuspended(AppNavbar, {
      props: { title: 'Routines' }
    })
    expect(wrapper.text()).toContain('Routines')
    expect(wrapper.find('[data-test="navbar-back"]').exists()).toBe(false)
    expect(wrapper.find('[data-slot="toggle"][aria-label="Open sidebar"]').exists()).toBe(true)
  })

  it('replaces the drawer toggle with a back button on a nested page', async () => {
    const wrapper = await mountSuspended(AppNavbar, {
      props: { title: 'Push Day', back: '/workouts/routines' }
    })
    const back = wrapper.find('[data-test="navbar-back"]')
    expect(back.attributes('aria-label')).toBe('Back')
    expect(wrapper.find('[data-slot="toggle"][aria-label="Open sidebar"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Collapse sidebar"]').exists()).toBe(true)
    await back.trigger('click')
    expect(go).toHaveBeenCalledWith('/workouts/routines')
  })

  it('goes straight to the parent when backToParent is set', async () => {
    go.mockClear()
    const wrapper = await mountSuspended(AppNavbar, {
      props: { title: 'Add', back: '/nutrition/diary/x', backToParent: true }
    })
    await wrapper.find('[data-test="navbar-back"]').trigger('click')
    expect(navigate).toHaveBeenCalledWith('/nutrition/diary/x')
    expect(go).not.toHaveBeenCalled()
  })

  it('renders the title and right slots', async () => {
    const wrapper = await mountSuspended(AppNavbar, {
      slots: {
        title: () => h('span', { 'data-test': 'custom-title' }, 'Pick'),
        right: () => h('button', { 'data-test': 'custom-right' }, 'R')
      }
    })
    expect(wrapper.find('[data-test="custom-title"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="custom-right"]').exists()).toBe(true)
  })
})

describe('AppMenuButton', () => {
  it('renders a labelled 40px trigger with its data-test', async () => {
    const wrapper = await mountSuspended(AppMenuButton, {
      props: {
        items: [[{ label: 'Delete', testId: 'x-delete' }]],
        label: 'Recipe actions',
        testId: 'recipe-menu'
      }
    })
    const button = wrapper.find('[data-test="recipe-menu"]')
    expect(button.attributes('aria-label')).toBe('Recipe actions')
    expect(button.classes()).toEqual(expect.arrayContaining(['min-h-10', 'min-w-10']))
  })
})
