import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { useProgramActions } from '../../app/composables/useProgramActions'

const { invalidate } = vi.hoisted(() => ({ invalidate: vi.fn() }))
mockNuxtImport('invalidateWorkouts', () => invalidate)

const deleted = vi.fn()
registerEndpoint('/api/workouts/programs/5', {
  method: 'DELETE',
  handler: () => {
    deleted()
    return null
  }
})

describe('useProgramActions', () => {
  beforeEach(() => {
    deleted.mockClear()
    invalidate.mockReset()
  })

  it('asks, then deletes and runs onDeleted', async () => {
    const actions = useProgramActions()
    actions.askDelete({ id: 5, name: 'Strength' })
    expect(actions.deleteOpen.value).toBe(true)
    expect(actions.deleting.value).toEqual({ id: 5, name: 'Strength' })
    const onDeleted = vi.fn(async () => {})
    await actions.confirmDelete(onDeleted)
    expect(deleted).toHaveBeenCalledOnce()
    expect(onDeleted).toHaveBeenCalledOnce()
    expect(actions.deleteOpen.value).toBe(false)
  })

  it('runs onDeleted before invalidating workouts', async () => {
    const order: string[] = []
    invalidate.mockImplementation(async () => {
      order.push('invalidate')
    })
    const actions = useProgramActions()
    actions.askDelete({ id: 5, name: 'Strength' })
    await actions.confirmDelete(async () => {
      order.push('onDeleted')
    })
    expect(order).toEqual(['onDeleted', 'invalidate'])
  })

  it('does nothing when nothing is pending', async () => {
    const actions = useProgramActions()
    const onDeleted = vi.fn()
    await actions.confirmDelete(onDeleted)
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
