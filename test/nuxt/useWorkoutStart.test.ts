import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { WorkoutSession } from '../../shared/types/workout'
import { todayDate } from '../../shared/utils/nutritionSummary'
import { useWorkoutStart } from '../../app/composables/useWorkoutStart'

const { apiFetchMock, invalidateMock, toastAdd } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  invalidateMock: vi.fn(),
  toastAdd: vi.fn()
}))

mockNuxtImport('apiFetch', () => apiFetchMock)
mockNuxtImport('invalidateWorkouts', () => invalidateMock)
mockNuxtImport('useToast', () => () => ({ add: toastAdd }))

const session = (id: number): WorkoutSession => ({
  id, name: null, performedOn: '2026-10-06', startedAt: '2026-10-06T10:00:00.000Z', endedAt: null, notes: null,
  routineDayId: null, deload: false, entries: []
})
const httpError = (statusMessage: string, data?: unknown) => Object.assign(new Error(statusMessage), { data: { statusMessage, data } })

afterEach(() => {
  apiFetchMock.mockReset()
  invalidateMock.mockReset()
  toastAdd.mockReset()
})

describe('useWorkoutStart', () => {
  it('posts the local date with the body and refreshes workout data', async () => {
    apiFetchMock.mockResolvedValueOnce(session(5))
    const { start } = useWorkoutStart()
    await expect(start({ routineDayId: 3, pointer: 'skip' })).resolves.toMatchObject({ id: 5 })
    expect(apiFetchMock).toHaveBeenCalledWith('/api/workouts/sessions', {
      method: 'POST',
      body: { routineDayId: 3, pointer: 'skip', performedOn: todayDate() }
    })
    expect(invalidateMock).toHaveBeenCalledTimes(1)
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('hands back the open workout on a 409 with a warning', async () => {
    apiFetchMock.mockRejectedValueOnce(httpError('A workout is already open', { session: session(9) }))
    const { start } = useWorkoutStart()
    await expect(start({})).resolves.toMatchObject({ id: 9 })
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'A workout is already open', color: 'warning' }))
    expect(invalidateMock).toHaveBeenCalledTimes(1)
  })

  it('returns null and names the failure for any other error', async () => {
    apiFetchMock.mockRejectedValueOnce(httpError('Routine day not found'))
    const { start } = useWorkoutStart()
    await expect(start({ routineDayId: 3 })).resolves.toBeNull()
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Couldn\'t start workout', description: 'Routine day not found', color: 'error'
    }))
    expect(invalidateMock).not.toHaveBeenCalled()
  })

  it('ignores a second start while one is in flight', async () => {
    let resolve: (value: WorkoutSession) => void = () => {}
    apiFetchMock.mockReturnValueOnce(new Promise<WorkoutSession>((r) => {
      resolve = r
    }))
    const { start, starting } = useWorkoutStart()
    const first = start({})
    expect(starting.value).toBe(true)
    await expect(start({})).resolves.toBeNull()
    resolve(session(1))
    await first
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    expect(starting.value).toBe(false)
  })
})
