import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function keyFrom(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, 'base64')
  if (key.length !== 32) throw new Error('NUXT_GOOGLE_HEALTH_TOKEN_KEY must be 32 bytes, base64-encoded')
  return key
}

export function isValidTokenKey(keyB64: string): boolean {
  return Buffer.from(keyB64 ?? '', 'base64').length === 32
}

export function encryptToken(plain: string, keyB64: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFrom(keyB64), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    data.toString('base64url')
  ].join(':')
}

export function decryptToken(enc: string, keyB64: string): string {
  const [version, iv, tag, data] = enc.split(':')
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unrecognized token format')
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(keyB64), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}
