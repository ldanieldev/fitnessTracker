import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useToday } from '../../app/composables/useToday'
import { useTodayOrNow } from '../../app/composables/useTodayOrNow'

describe('useTodayOrNow', () => {
  it('hydrates with the server-rendered day, then moves to the browser day once useToday resolves', async () => {
    useToday().value = null
    useState('todayOrNow').value = '2026-10-10'
    const to = useTodayOrNow()
    expect(to.value).toBe('2026-10-10')

    useToday().value = '2026-10-09'
    await nextTick()
    expect(to.value).toBe('2026-10-09')
  })
})
