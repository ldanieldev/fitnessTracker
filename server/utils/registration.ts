import { users } from '../db/schema'
import { db } from './db'

const isOpen = (mode: string) => mode.trim().toLowerCase() === 'open'

export function registrationAllowed(mode: string, hasUsers: boolean): boolean {
  return isOpen(mode) || !hasUsers
}

export async function registrationOpen(): Promise<boolean> {
  const mode = String(useRuntimeConfig().registration)
  if (isOpen(mode)) return true
  const anyUser = await db.select({ id: users.id }).from(users).limit(1)
  return registrationAllowed(mode, anyUser.length > 0)
}
