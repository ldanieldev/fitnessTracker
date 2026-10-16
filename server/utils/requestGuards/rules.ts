import { FITNOTES_MAX_BYTES } from '../workouts/fitnotes/input'

const MIB = 1024 * 1024

export const PAYLOAD_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const DEFAULT_BODY_LIMIT = MIB

const ROUTE_BODY_LIMITS: Record<string, number> = {
  // JSON-escaping the CSV's quotes and newlines can double it on the wire.
  '/api/workouts/import/fitnotes': 2 * FITNOTES_MAX_BYTES,
  '/api/workouts/import/fitnotes/preview': 2 * FITNOTES_MAX_BYTES,
  // 2 MiB of files plus per-part multipart headers for up to 200 files.
  '/api/nutrition/import/mymacros': 3 * MIB,
  '/api/workouts/programs/import': 4 * MIB,
  // Inngest posts the run's accumulated step state with each call.
  '/api/inngest': 32 * MIB
}

const CSRF_EXEMPT = new Set(['/api/inngest'])

export function pathOnly(path: string): string {
  const end = path.search(/[?#]/)
  const bare = end === -1 ? path : path.slice(0, end)
  return bare.length > 1 ? bare.replace(/\/+$/, '') : bare
}

export function bodyLimitFor(path: string): number {
  return ROUTE_BODY_LIMITS[pathOnly(path)] ?? DEFAULT_BODY_LIMIT
}

export function declaredLengthTooLarge(contentLength: string, limit: number): boolean {
  const length = Number(contentLength)
  return !Number.isFinite(length) || length > limit
}

export interface CsrfRequest {
  method: string
  path: string
  authorization?: string
  secFetchSite?: string
  origin?: string
  host?: string
}

export function csrfRejection(req: CsrfRequest): string | null {
  if (!PAYLOAD_METHODS.has(req.method)) return null
  // A request with any Authorization header is token-authenticated and ignores the cookie (session.ts).
  if (req.authorization !== undefined) return null
  if (CSRF_EXEMPT.has(pathOnly(req.path))) return null
  // Browsers set Sec-Fetch-Site themselves, so it outranks Origin/Host, which a rewriting proxy can disagree on.
  if (req.secFetchSite) {
    return req.secFetchSite === 'same-origin' || req.secFetchSite === 'none' ? null : 'cross-site request'
  }
  if (req.origin === undefined) return null
  let originHost: string
  try {
    originHost = new URL(req.origin).host
  } catch {
    return 'unparseable Origin'
  }
  return originHost && originHost === req.host?.toLowerCase() ? null : 'Origin does not match Host'
}
