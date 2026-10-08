import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

const { addMock } = vi.hoisted(() => ({ addMock: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add: addMock }))

const serverError = (statusMessage: string) => Object.assign(new Error('x'), { data: { statusMessage } })

describe('useFailToast', () => {
  afterEach(() => {
    addMock.mockClear()
  })

  it('titles the toast and prefers the server message over the fallback', async () => {
    const { useFailToast } = await import('../../app/composables/useFailToast')
    const fail = useFailToast()
    fail('Couldn\'t save workout', serverError('Name taken'), 'Could not save')
    expect(addMock.mock.lastCall![0]).toEqual({ title: 'Couldn\'t save workout', description: 'Name taken', color: 'error' })
    fail('Couldn\'t save workout', new Error('offline'), 'Could not save')
    expect(addMock.mock.lastCall![0]).toMatchObject({ description: 'Could not save' })
  })

  it('offers Retry only when given a retry', async () => {
    const { useFailToast } = await import('../../app/composables/useFailToast')
    const retry = vi.fn()
    useFailToast()('Couldn\'t create routine', new Error('x'), 'Could not create this routine', retry)
    const { actions } = addMock.mock.lastCall![0] as { actions: { label: string, onClick: () => void }[] }
    expect(actions.map((action) => action.label)).toEqual(['Retry'])
    actions[0]!.onClick()
    expect(retry).toHaveBeenCalledOnce()
    useFailToast()('Couldn\'t delete routine', new Error('x'), 'Could not delete this routine')
    expect(addMock.mock.lastCall![0].actions).toBeUndefined()
  })
})
