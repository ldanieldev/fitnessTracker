import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

const { addMock, captureException } = vi.hoisted(() => ({ addMock: vi.fn(), captureException: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add: addMock }))
vi.mock('@sentry/nuxt', () => ({ captureException }))

const serverError = (statusMessage: string) => Object.assign(new Error('x'), { data: { statusMessage } })

describe('useFailToast', () => {
  afterEach(() => {
    addMock.mockClear()
    captureException.mockClear()
  })

  it('titles the toast and prefers the server message over the fallback', async () => {
    const { useFailToast } = await import('../../app/composables/useFailToast')
    const fail = useFailToast()
    fail('Couldn\'t save workout', serverError('Name taken'), 'Could not save')
    expect(addMock.mock.lastCall![0]).toEqual({
      title: 'Couldn\'t save workout',
      description: 'Name taken',
      color: 'error'
    })
    fail('Couldn\'t save workout', new Error('offline'), 'Could not save')
    expect(addMock.mock.lastCall![0]).toMatchObject({ description: 'Could not save' })
  })

  it('offers Retry only when given a retry', async () => {
    const { useFailToast } = await import('../../app/composables/useFailToast')
    const retry = vi.fn()
    useFailToast()('Couldn\'t create routine', new Error('x'), 'Could not create this routine', retry)
    const { actions } = addMock.mock.lastCall![0] as { actions: { label: string; onClick: () => void }[] }
    expect(actions.map((action) => action.label)).toEqual(['Retry'])
    actions[0]!.onClick()
    expect(retry).toHaveBeenCalledOnce()
    useFailToast()('Couldn\'t delete routine', new Error('x'), 'Could not delete this routine')
    expect(addMock.mock.lastCall![0].actions).toBeUndefined()
  })

  it('reports 5xx and network failures to Sentry with the title as the action, never 4xx', async () => {
    const { useFailToast } = await import('../../app/composables/useFailToast')
    const fail = useFailToast()
    fail('Couldn\'t save workout', Object.assign(new Error('x'), { statusCode: 422 }), 'Could not save')
    fail('Couldn\'t save workout', Object.assign(new Error('x'), { statusCode: 404 }), 'Could not save')
    expect(captureException).not.toHaveBeenCalled()
    fail('Couldn\'t save workout', Object.assign(new Error('x'), { statusCode: 500 }), 'Could not save')
    expect(captureException.mock.lastCall![1]).toEqual({ tags: { action: 'Couldn\'t save workout', status: '500' } })
    fail('Couldn\'t save workout', new Error('offline'), 'Could not save')
    expect(captureException).toHaveBeenCalledTimes(2)
    expect(captureException.mock.lastCall![1]).toEqual({ tags: { action: 'Couldn\'t save workout' } })
  })
})
