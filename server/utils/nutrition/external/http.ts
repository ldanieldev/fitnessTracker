export class HttpStatusError extends Error {
  constructor(public readonly status: number) {
    super(`HTTP ${status}`)
    this.name = 'HttpStatusError'
  }
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (!res.ok) throw new HttpStatusError(res.status)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}
