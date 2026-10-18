import { createError } from 'h3'

// Symbol.for, because sentry.server.config.ts is bundled apart from the server and must recognise the mark too.
const EXPECTED = Symbol.for('my-fitness-journal.expectedFailure')

export function expectedFailure(input: Parameters<typeof createError>[0]) {
  const err = createError(input)
  Object.defineProperty(err, EXPECTED, { value: true })
  return err
}

export function isExpectedFailure(err: unknown): boolean {
  return typeof err === 'object' && err !== null && EXPECTED in err
}
