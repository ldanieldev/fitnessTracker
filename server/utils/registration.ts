import { sql } from 'drizzle-orm'
import { users } from '../db/schema'
import { db, type DbTransaction } from './db'
import { logger } from './logger'

const isOpen = (mode: string) => mode.trim().toLowerCase() === 'open'
// Advisory-lock key serialising closed-mode signups, so two first signups can't both see an empty users table.
const FIRST_SIGNUP_LOCK = 7_301_012

export function registrationAllowed(mode: string, hasUsers: boolean): boolean {
  return isOpen(mode) || !hasUsers
}

export async function registrationOpen(): Promise<boolean> {
  const mode = String(useRuntimeConfig().registration)
  if (isOpen(mode)) return true
  const anyUser = await db.select({ id: users.id }).from(users).limit(1)
  return registrationAllowed(mode, anyUser.length > 0)
}

export async function assertRegistrationOpenIn(tx: DbTransaction): Promise<void> {
  const mode = String(useRuntimeConfig().registration)
  if (isOpen(mode)) return
  await tx.execute(sql`select pg_advisory_xact_lock(${FIRST_SIGNUP_LOCK})`)
  const anyUser = await tx.select({ id: users.id }).from(users).limit(1)
  if (!registrationAllowed(mode, anyUser.length > 0)) {
    logger.info({ event: 'auth.register_closed', recheck: true }, 'registration refused: closed')
    throw createError({ statusCode: 403, statusMessage: 'Registration is closed' })
  }
}
