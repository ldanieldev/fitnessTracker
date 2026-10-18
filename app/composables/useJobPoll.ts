import * as Sentry from '@sentry/nuxt'

const POLL_MS = 2000
const MAX_BACKOFF_MS = 30_000
const MAX_RETRIES = 5
const MAX_POLL_MS = 20 * 60_000

function isTransient(error: unknown): boolean {
  const status = (error as { statusCode?: number } | null)?.statusCode
  return status === undefined || status >= 500 || status === 408 || status === 429
}

interface JobPollHandlers<T> {
  /** Returns true once the job has finished and polling should stop. */
  onJob: (job: T) => boolean | Promise<boolean>
  /** `mayBeRunning` is true when polling gave up on network trouble or the time cap, not a definite answer. */
  onGiveUp: (error: unknown, mayBeRunning: boolean) => void
}

/**
 * Polls an import job's status URL every 2 s, retrying transient failures with backoff (up to 5 in a row)
 * and giving up after 20 minutes. Stops on unmount.
 */
export function useJobPoll<T>() {
  let timer: ReturnType<typeof setTimeout> | null = null
  let run = 0

  function stop() {
    run++
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function start(url: string, handlers: JobPollHandlers<T>) {
    stop()
    const current = run
    const startedAt = Date.now()
    let failures = 0

    const giveUp = (error: unknown, mayBeRunning: boolean) => {
      Sentry.logger.warn('Job poll gave up', {
        route: url.split('?')[0]!.replace(/\/\d+(?=\/|$)/g, '/:id'),
        failures,
        mayBeRunning,
        status: (error as { statusCode?: number } | null)?.statusCode ?? 'none'
      })
      handlers.onGiveUp(error, mayBeRunning)
    }

    const schedule = (delay: number) => {
      timer = setTimeout(tick, delay)
    }

    async function tick() {
      timer = null
      let job: T
      try {
        job = await apiFetch<T>(url, { retry: 0 })
      } catch (error: unknown) {
        if (current !== run) return
        const transient = isTransient(error)
        if (transient && failures < MAX_RETRIES && Date.now() - startedAt < MAX_POLL_MS) {
          failures++
          schedule(Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS))
        } else {
          giveUp(error, transient)
        }
        return
      }
      if (current !== run) return
      failures = 0
      if (await handlers.onJob(job)) return
      if (current !== run) return
      if (Date.now() - startedAt >= MAX_POLL_MS) {
        giveUp(new Error('Import is taking too long to finish'), true)
        return
      }
      schedule(POLL_MS)
    }

    schedule(POLL_MS)
  }

  onBeforeUnmount(stop)

  return { start, stop }
}
