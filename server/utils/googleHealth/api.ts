import { FetchError } from 'ofetch'
import { logger } from '~~/server/utils/logger'
import { markReported } from '~~/server/utils/inngest/reported'
import { googleHealthConfig } from './config'
import type { RawStepsRollup, RawWeightPoint } from './map'

export class GoogleAuthError extends Error {}

export function isRetryable(error: unknown): boolean {
  if (!(error instanceof FetchError)) return false
  const status = error.statusCode
  return status === undefined || status === 429 || status >= 500
}

const TIMEOUT_MS = 30_000

const civil = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number)
  return { date: { year, month, day } }
}

export async function refreshAccessToken(refreshToken: string, userId: number): Promise<string> {
  const { clientId, clientSecret, tokenUrl } = googleHealthConfig()
  try {
    const res = await $fetch<{ access_token: string }>(tokenUrl, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret
      }),
      timeout: TIMEOUT_MS
    })
    return res.access_token
  } catch (error) {
    const oauthError = error instanceof FetchError ? error.data?.error : undefined
    if (oauthError === 'invalid_grant') {
      logger.warn({ userId }, 'Google Health refresh token rejected; reconnect required')
      throw new GoogleAuthError('Google access was revoked or expired')
    }
    logger.error(
      {
        err: markReported(error),
        userId,
        oauthError: typeof oauthError === 'string' ? oauthError.slice(0, 64) : undefined,
        status: error instanceof FetchError ? error.statusCode : undefined
      },
      'Google Health token refresh failed'
    )
    throw error
  }
}

function api(access: string) {
  const { apiBase } = googleHealthConfig()
  return $fetch.create({
    baseURL: `${apiBase}/v4/users/me/dataTypes`,
    headers: { authorization: `Bearer ${access}` },
    timeout: TIMEOUT_MS
  })
}

export async function listPoints<T>(access: string, dataType: string, filter?: string): Promise<T[]> {
  const out: T[] = []
  let pageToken: string | undefined
  do {
    const res = await api(access)<{ dataPoints?: T[]; nextPageToken?: string }>(`/${dataType}/dataPoints`, {
      query: { filter, pageToken }
    })
    out.push(...(res.dataPoints ?? []))
    pageToken = res.nextPageToken
  } while (pageToken)
  return out
}

export async function dailyRollUp(
  access: string,
  dataType: string,
  from: string,
  toExclusive: string
): Promise<RawStepsRollup[]> {
  const res = await api(access)<{ rollupDataPoints?: RawStepsRollup[] }>(`/${dataType}/dataPoints:dailyRollUp`, {
    method: 'POST',
    body: {
      range: { start: civil(from), end: civil(toExclusive) },
      dataSourceFamily: 'users/me/dataSourceFamilies/google-wearables'
    }
  })
  return res.rollupDataPoints ?? []
}

export async function createWeight(
  access: string,
  input: { grams: number; physicalTime: string; utcOffsetSeconds: number }
): Promise<string> {
  const res = await api(access)<{ response?: { name?: string } }>('/weight/dataPoints', {
    method: 'POST',
    body: {
      weight: {
        sampleTime: { physicalTime: input.physicalTime, utcOffset: `${input.utcOffsetSeconds}s` },
        weightGrams: input.grams
      }
    }
  })
  if (!res.response?.name) throw new Error('Google did not return the new weight point')
  return res.response.name
}

export async function deleteWeights(access: string, names: string[]): Promise<void> {
  if (!names.length) return
  await api(access)('/weight/dataPoints:batchDelete', { method: 'POST', body: { names } })
}

export async function listWeightsAt(access: string, physicalTime: string): Promise<RawWeightPoint[]> {
  const end = new Date(Date.parse(physicalTime) + 1000).toISOString()
  const field = 'weight.sample_time.physical_time'
  return listPoints<RawWeightPoint>(access, 'weight', `${field} >= "${physicalTime}" AND ${field} < "${end}"`)
}

export async function revokeGoogleToken(refreshToken: string): Promise<void> {
  const { revokeUrl } = googleHealthConfig()
  await $fetch(revokeUrl, { method: 'POST', body: new URLSearchParams({ token: refreshToken }), timeout: 5000 })
}
