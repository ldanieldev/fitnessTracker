// DrizzleQueryError puts the bound values (passwords, emails, notes) after "params:" in its message and stack.
const PARAMS_LINE = /\nparams: [\s\S]*?(?=\n\s+at |$)/

export function redactQueryParams<T>(text: T): T {
  return (typeof text === 'string' ? text.replace(PARAMS_LINE, '\nparams: [Redacted]') : text) as T
}

interface SentryEventLike {
  message?: string
  exception?: { values?: Array<{ value?: string }> }
}

export function redactEventQueryParams<E extends SentryEventLike>(event: E): E {
  event.message = redactQueryParams(event.message)
  for (const exception of event.exception?.values ?? []) exception.value = redactQueryParams(exception.value)
  return event
}
