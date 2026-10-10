import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { useRoutineActions } from '../../app/composables/useRoutineActions'

const { invalidate } = vi.hoisted(() => ({ invalidate: vi.fn() }))
mockNuxtImport('invalidateWorkouts', () => invalidate)

const deleted = vi.fn()
registerEndpoint('/api/workouts/routines/5', {
  method: 'DELETE',
  handler: () => {
    deleted()
    return null
  }
})

describe('useRoutineActions', () => {
  beforeEach(() => {
    deleted.mockClear()
    invalidate.mockReset()
  })

  it('asks, then deletes and runs onDeleted', async () => {
    const actions = useRoutineActions()
    actions.askDelete({ id: 5, name: 'Push' })
    expect(actions.deleteOpen.value).toBe(true)
    expect(actions.deleting.value).toEqual({ id: 5, name: 'Push' })
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
    const actions = useRoutineActions()
    actions.askDelete({ id: 5, name: 'Push' })
    await actions.confirmDelete(async () => {
      order.push('onDeleted')
    })
    expect(order).toEqual(['onDeleted', 'invalidate'])
  })

  it('does nothing when nothing is pending', async () => {
    const actions = useRoutineActions()
    const onDeleted = vi.fn()
    await actions.confirmDelete(onDeleted)
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
