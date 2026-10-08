import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { usePauseProgramPrompt } from '../../app/composables/usePauseProgramPrompt'

const controls = { data: { data: { code: 'program_controls_routine', program: { name: 'BLS' } } } }

function setup() {
  useToday().value = '2026-10-06'
  return usePauseProgramPrompt()
}

describe('usePauseProgramPrompt.guarded', () => {
  it('passes today and hands the result to done when nothing blocks', async () => {
    const prompt = setup()
    const attempt = vi.fn().mockResolvedValue('saved')
    const done = vi.fn()
    await prompt.guarded(attempt, done)
    expect(attempt).toHaveBeenCalledWith({ today: '2026-10-06' })
    expect(done).toHaveBeenCalledWith('saved')
    expect(prompt.open.value).toBe(false)
  })

  it('opens the prompt on program_controls_routine and confirm retries with pauseProgram', async () => {
    const prompt = setup()
    const attempt = vi.fn().mockRejectedValueOnce(controls).mockResolvedValueOnce('paused')
    const done = vi.fn()
    await prompt.guarded(attempt, done)
    expect(prompt.open.value).toBe(true)
    expect(prompt.programName.value).toBe('BLS')
    expect(done).not.toHaveBeenCalled()
    await prompt.confirm()
    expect(prompt.open.value).toBe(false)
    expect(attempt).toHaveBeenLastCalledWith({ pauseProgram: true, today: '2026-10-06' })
    expect(done).toHaveBeenCalledWith('paused')
  })

  it('names a program the server did not send as Your program', async () => {
    const prompt = setup()
    await prompt.guarded(vi.fn().mockRejectedValue({ data: { data: { code: 'program_controls_routine' } } }), vi.fn())
    expect(prompt.programName.value).toBe('Your program')
  })

  it('rethrows any other error without opening the prompt', async () => {
    const prompt = setup()
    const boom = { data: { data: { code: 'enrollment_state' } } }
    await expect(prompt.guarded(vi.fn().mockRejectedValue(boom), vi.fn())).rejects.toBe(boom)
    expect(prompt.open.value).toBe(false)
  })

  it('closing the prompt drops the pending retry', async () => {
    const prompt = setup()
    const attempt = vi.fn().mockRejectedValueOnce(controls)
    await prompt.guarded(attempt, vi.fn())
    prompt.open.value = false
    await nextTick()
    await prompt.confirm()
    expect(attempt).toHaveBeenCalledTimes(1)
  })
})
