import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useBackOrTo } from '../../app/composables/useBackOrTo'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
mockNuxtImport('navigateTo', () => navigate)

describe('useBackOrTo', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    navigate.mockClear()
  })

  it('navigates to the fallback when there is no history entry behind', () => {
    const router = useRouter()
    vi.spyOn(router.options.history, 'state', 'get').mockReturnValue({
      back: null
    } as never)
    const back = vi.spyOn(router, 'back').mockImplementation(() => {})
    useBackOrTo()('/fallback')
    expect(navigate).toHaveBeenCalledWith('/fallback')
    expect(back).not.toHaveBeenCalled()
  })

  it('goes back when a history entry exists', () => {
    const router = useRouter()
    vi.spyOn(router.options.history, 'state', 'get').mockReturnValue({
      back: '/prev'
    } as never)
    const back = vi.spyOn(router, 'back').mockImplementation(() => {})
    useBackOrTo()('/fallback')
    expect(back).toHaveBeenCalledOnce()
    expect(navigate).not.toHaveBeenCalled()
  })
})
