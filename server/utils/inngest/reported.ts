const reported = new WeakSet<object>()

// The run middleware logs a reported error as sentryCaptured, so one failure opens one Sentry issue, not two.
export function markReported<T>(err: T): T {
  if (err && typeof err === 'object') reported.add(err)
  return err
}

export function wasReported(err: unknown): boolean {
  return !!err && typeof err === 'object' && reported.has(err)
}
