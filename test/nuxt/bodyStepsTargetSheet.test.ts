import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { useToday } from '../../app/composables/useToday'
import BodyStepsTargetSheet from '../../app/components/body/BodyStepsTargetSheet.vue'

const q = <T extends Element>(sel: string) => document.querySelector(sel) as T | null

describe('BodyStepsTargetSheet', () => {
  it('prefills the target, shows the weekly budget live, defaults the start to this week, and PUTs', async () => {
    useToday().value = '2026-10-07'
    let received: unknown = null
    registerEndpoint('/api/body/steps/target', {
      method: 'PUT',
      handler: async (event) => {
        received = await readBody(event)
        return { dailyTarget: 9000, effectiveFrom: '2026-10-05' }
      }
    })
    const wrapper = await mountSuspended(BodyStepsTargetSheet, {
      attachTo: document.body,
      props: { open: true, target: { dailyTarget: 8000, effectiveFrom: '2026-08-24' } }
    })
    await flushPromises()
    expect(document.body.textContent).toContain('Steps target')
    const daily = q<HTMLInputElement>('input[data-test="target-daily"]')!
    expect(daily.value).toBe('8000')
    expect(q('[data-test="target-weekly"]')!.textContent).toContain('56,000 per week')
    const from = q<HTMLInputElement>('input[data-test="target-from"]')!
    expect(from.value).toMatch(/^2026-10-0[45]$/)

    daily.value = '9000'
    daily.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(q('[data-test="target-weekly"]')!.textContent).toContain('63,000 per week')
    q<HTMLButtonElement>('[data-test="target-save"]')!.click()
    await vi.waitFor(() => expect(received).toEqual({ dailyTarget: 9000, effectiveFrom: from.value }))
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('starts empty without a target and keeps Save disabled until a whole positive number is typed', async () => {
    const wrapper = await mountSuspended(BodyStepsTargetSheet, {
      attachTo: document.body,
      props: { open: true, target: null }
    })
    await flushPromises()
    const daily = q<HTMLInputElement>('input[data-test="target-daily"]')!
    expect(daily.value).toBe('')
    const save = q<HTMLButtonElement>('[data-test="target-save"]')!
    expect(save.disabled).toBe(true)
    for (const bad of ['0', '7500.5']) {
      daily.value = bad
      daily.dispatchEvent(new Event('input', { bubbles: true }))
      await flushPromises()
      expect(save.disabled).toBe(true)
    }
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
