import type { H3Event } from 'h3'

export function trustsProxy(event: H3Event): boolean {
  return String(useRuntimeConfig(event).trustProxy) === 'true'
}

// Trusts exactly one proxy hop: the last entry is the one our proxy appended, earlier ones are client-supplied.
export function lastForwarded(event: H3Event, header: string): string | undefined {
  if (!trustsProxy(event)) return undefined
  return getRequestHeader(event, header)?.split(',').pop()?.trim() || undefined
}

export function requestHost(event: H3Event): string | undefined {
  return lastForwarded(event, 'x-forwarded-host') ?? getRequestHeader(event, 'host')
}
