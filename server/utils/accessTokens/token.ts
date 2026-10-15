import { createHash, randomBytes } from 'node:crypto'

export const TOKEN_PREFIX = 'mfj_'

const BEARER = /^bearer (mfj_[A-Za-z0-9_-]{43})$/i

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function generateToken() {
  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token), prefix: token.slice(TOKEN_PREFIX.length, TOKEN_PREFIX.length + 8) }
}

export function parseBearer(header: string): string | null {
  return BEARER.exec(header.trim())?.[1] ?? null
}
