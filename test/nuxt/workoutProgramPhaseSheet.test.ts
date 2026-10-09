import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { USelect } from '#components'
import WorkoutProgramPhaseSheet from '../../app/components/workout/WorkoutProgramPhaseSheet.vue'
import type { ProgramPhase } from '../../shared/types/program'
import type { RoutineSummary } from '../../shared/types/routine'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const routines = [{ id: 7, name: 'Upper Lower' }, { id: 9, name: 'Push Pull' }] as RoutineSummary[]
const phase = (routine: { id: number, name: string, dayCount: number } | null) =>
  ({ id: 1, name: 'Base', weeks: 3, deload: false, sortOrder: 0, routine }) as unknown as ProgramPhase

async function mountSheet(props: { phase: ProgramPhase | null, routines: RoutineSummary[] }) {
  const wrapper = await mountSuspended(WorkoutProgramPhaseSheet, { attachTo: document.body, props: { open: true, ...props } })
  await flushPromises()
  return wrapper
}

async function save(wrapper: Awaited<ReturnType<typeof mountSheet>>) {
  const button = document.querySelector('[data-test="phase-save"]') as HTMLElement
  button.click()
  await flushPromises()
  return wrapper.emitted('save')?.[0]?.[0]
}

async function typeName(value: string) {
  const input = document.querySelector('[data-test="phase-name"]') as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

describe('WorkoutProgramPhaseSheet', () => {
  it('keeps a rest-week phase as a rest week on save', async () => {
    const wrapper = await mountSheet({ phase: phase(null), routines })
    expect(await save(wrapper)).toMatchObject({ name: 'Base', routineId: null })
    wrapper.unmount()
  })

  it('keeps the routine of a phase that has one', async () => {
    const wrapper = await mountSheet({ phase: phase({ id: 9, name: 'Push Pull', dayCount: 2 }), routines })
    expect(await save(wrapper)).toMatchObject({ routineId: 9 })
    wrapper.unmount()
  })

  it('defaults a new phase to the first routine', async () => {
    const wrapper = await mountSheet({ phase: null, routines })
    const input = document.querySelector('[data-test="phase-name"]') as HTMLInputElement
    input.value = 'New block'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(await save(wrapper)).toMatchObject({ name: 'New block', routineId: 7 })
    wrapper.unmount()
  })

  it('defaults a new phase to the first routine when routines arrive after opening', async () => {
    const wrapper = await mountSheet({ phase: null, routines: [] })
    await wrapper.setProps({ routines })
    await flushPromises()
    const input = document.querySelector('[data-test="phase-name"]') as HTMLInputElement
    input.value = 'Late'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(await save(wrapper)).toMatchObject({ routineId: 7 })
    wrapper.unmount()
  })

  it('follows a new first routine when the list is replaced at the same length', async () => {
    const wrapper = await mountSheet({ phase: null, routines: [{ id: 3, name: 'Old' }] as RoutineSummary[] })
    await wrapper.setProps({ routines: [routines[0]!] })
    await flushPromises()
    await typeName('Swap')
    expect(await save(wrapper)).toMatchObject({ routineId: 7 })
    wrapper.unmount()
  })

  it('keeps an explicit pick when routines change afterwards', async () => {
    const wrapper = await mountSheet({ phase: null, routines })
    const select = wrapper.findComponent(USelect) as unknown as { vm: { $emit: (e: string, v: number) => void } }
    select.vm.$emit('update:modelValue', 9)
    await wrapper.setProps({ routines: [{ id: 5, name: 'New' } as RoutineSummary, ...routines] })
    await flushPromises()
    await typeName('Picked')
    expect(await save(wrapper)).toMatchObject({ routineId: 9 })
    wrapper.unmount()
  })
})
