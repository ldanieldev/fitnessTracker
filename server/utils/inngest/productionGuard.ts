// The keys compose.yml falls back to; anyone who has read the repo knows them.
const COMPOSE_DEFAULT_KEYS = new Set(['cafebabecafebabe', 'deadbeefdeadbeef'])
const MIN_KEY_LENGTH = 32
const FALSE_VALUES = new Set(['', '0', 'false'])

export function inngestProductionProblems(env: Record<string, string | undefined>): string[] {
  const problems: string[] = []
  // The SDK treats '1', 'true' or any URL as dev mode, and dev mode skips request signature checks.
  if (!FALSE_VALUES.has((env.INNGEST_DEV ?? '').trim().toLowerCase())) {
    problems.push('INNGEST_DEV is set, which turns off Inngest request signing')
  }
  for (const name of ['INNGEST_SIGNING_KEY', 'INNGEST_EVENT_KEY']) {
    const value = (env[name] ?? '').trim()
    const bare = value.replace(/^signkey-[a-z]+-/, '')
    if (!value) problems.push(`${name} is not set`)
    else if (COMPOSE_DEFAULT_KEYS.has(bare)) problems.push(`${name} is the compose.yml default`)
    else if (bare.length < MIN_KEY_LENGTH) problems.push(`${name} is shorter than ${MIN_KEY_LENGTH} characters`)
  }
  return problems
}
