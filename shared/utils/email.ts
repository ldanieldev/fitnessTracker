import { z } from 'zod'

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email())
