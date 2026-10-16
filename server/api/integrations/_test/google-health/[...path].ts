import { shiftDate, todayDate } from '~~/shared/utils/nutritionSummary'

interface StubWeight {
  name: string
  weight: { sampleTime: { physicalTime: string; utcOffset: string }; weightGrams: number }
  dataSource: { platform: string; application: { googleWebClientId?: string; packageName?: string } }
}

const weights: StubWeight[] = []
const revoked: string[] = []
const failNext = new Map<string, { status: number; times: number; call?: string }>()
let nextId = 1
let tokenGate: { release: () => void; opened: Promise<void>; waiting: boolean } | null = null

function holdToken() {
  let release!: () => void
  const opened = new Promise<void>((resolve) => (release = resolve))
  tokenGate = { release, opened, waiting: false }
}

const civil = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

function daily() {
  const today = todayDate()
  const days = [1, 2, 3].map((n) => shiftDate(today, -n))
  return {
    hrv: days.map((d, i) => ({
      dailyHeartRateVariability: { date: civil(d), averageHeartRateVariabilityMilliseconds: 60 + i }
    })),
    rhr: [
      ...days.map((d, i) => ({
        dailyRestingHeartRate: {
          date: civil(d),
          beatsPerMinute: String(70 + i),
          dailyRestingHeartRateMetadata: { calculationMethod: 'WITH_SLEEP' }
        }
      })),
      {
        dailyRestingHeartRate: {
          date: civil(shiftDate(today, -4)),
          beatsPerMinute: '80',
          dailyRestingHeartRateMetadata: { calculationMethod: 'ONLY_WITH_AWAKE_DATA' }
        }
      }
    ],
    sleep: days.map((d, i) => ({
      name: `users/stub/dataTypes/sleep/dataPoints/${d}`,
      sleep: {
        interval: { startTime: `${shiftDate(d, -1)}T22:00:00Z`, endTime: `${d}T12:00:00Z`, endUtcOffset: '-18000s' },
        summary: {
          minutesAsleep: String(420 + i * 30),
          minutesAwake: '10',
          stagesSummary: [
            { type: 'LIGHT', minutes: '240' },
            { type: 'DEEP', minutes: '90' },
            { type: 'REM', minutes: '90' }
          ]
        },
        metadata: { mainSleep: true }
      }
    })),
    steps: days.map((d, i) => ({ civilStartTime: { date: civil(d) }, steps: { countSum: String(8000 + i * 1000) } }))
  }
}

function inRange(filter: string | undefined, time: string) {
  const lo = /physical_time >= "([^"]+)"/.exec(filter ?? '')?.[1]
  const hi = /physical_time < "([^"]+)"/.exec(filter ?? '')?.[1]
  return (!lo || time >= lo) && (!hi || time < hi)
}

export default defineEventHandler(async (event) => {
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  const path = getRouterParam(event, 'path') ?? ''
  const method = event.method

  if (path === 'hold-token' && method === 'POST') {
    holdToken()
    return { ok: true }
  }
  if (path === 'token-held') return { waiting: tokenGate?.waiting ?? false }
  if (path === 'release-token' && method === 'POST') {
    tokenGate?.release()
    tokenGate = null
    return { ok: true }
  }
  if (path === 'fail-next' && method === 'POST') {
    const { dataType, status, times, call } = await readBody<{
      dataType: string
      status: number
      times?: number
      call?: string
    }>(event)
    failNext.set(dataType, { status, times: times ?? 1, call })
    return { ok: true }
  }
  if (path === 'revokes') return revoked

  if (path === 'token' && method === 'POST') {
    // readBody returned no form fields for the in-process fetch, so parse the raw body.
    const form = new URLSearchParams((await readRawBody(event)) ?? '')
    if (tokenGate && !tokenGate.waiting) {
      tokenGate.waiting = true
      await tokenGate.opened
    }
    if (form.get('refresh_token') === 'revoked') {
      setResponseStatus(event, 400)
      return { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }
    }
    return { access_token: 'stub-access', expires_in: 3599, token_type: 'Bearer' }
  }
  if (path === 'revoke' && method === 'POST') {
    const form = new URLSearchParams((await readRawBody(event)) ?? '')
    revoked.push(form.get('token') ?? '')
    return {}
  }
  if (path === 'writes') {
    if (method === 'DELETE') weights.length = 0
    return weights
  }
  if (path === 'seed-weight' && method === 'POST') {
    const point = (await readBody<StubWeight>(event)) ?? null
    if (point) weights.push(point)
    return { ok: true }
  }

  const match = /^v4\/users\/me\/dataTypes\/([^/]+)\/dataPoints(:\w+)?$/.exec(path)
  if (!match) throw createError({ statusCode: 404, statusMessage: `stub has no ${method} ${path}` })
  const [, dataType, action] = match
  const failure = failNext.get(dataType!)
  if (failure && (!failure.call || failure.call === `${method}${action ?? ''}`)) {
    if (--failure.times <= 0) failNext.delete(dataType!)
    throw createError({ statusCode: failure.status, statusMessage: 'stub failure' })
  }
  const data = daily()

  if (method === 'GET') {
    if (dataType === 'daily-heart-rate-variability') return { dataPoints: data.hrv }
    if (dataType === 'daily-resting-heart-rate') return { dataPoints: data.rhr }
    if (dataType === 'sleep') return { dataPoints: data.sleep }
    if (dataType === 'weight') {
      const filter = getQuery(event).filter as string | undefined
      return { dataPoints: weights.filter((w) => inRange(filter, w.weight.sampleTime.physicalTime)) }
    }
  }
  if (method === 'POST' && dataType === 'steps' && action === ':dailyRollUp') return { rollupDataPoints: data.steps }
  if (method === 'POST' && dataType === 'weight' && !action) {
    const body = await readBody<Pick<StubWeight, 'weight'>>(event)
    const point: StubWeight = {
      ...body,
      name: `users/stub/dataTypes/weight/dataPoints/${nextId++}`,
      dataSource: {
        platform: 'GOOGLE_WEB_API',
        application: { googleWebClientId: useRuntimeConfig().oauth.google.clientId }
      }
    }
    weights.push(point)
    return { done: true, response: point }
  }
  if (method === 'POST' && dataType === 'weight' && action === ':batchDelete') {
    const { names } = await readBody<{ names: string[] }>(event)
    const removed = weights.filter((w) => names.includes(w.name))
    if (!removed.length) throw createError({ statusCode: 404, statusMessage: 'no such data point' })
    for (const w of removed) weights.splice(weights.indexOf(w), 1)
    return { done: true, response: { dataPoints: removed } }
  }
  throw createError({ statusCode: 404, statusMessage: `stub has no ${method} ${path}` })
})
