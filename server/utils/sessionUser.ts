import type { User } from '#auth-utils'
import type { users } from '~~/server/db/schema'

type SessionUserRow = Pick<
  typeof users.$inferSelect,
  'id' | 'email' | 'name' | 'avatarUrl' | 'age' | 'sex' | 'weekStart' | 'defaultRestSeconds' | 'plateSizes'
>

// Callers must use replaceUserSession: setUserSession defu-merges, which concatenates plateSizes onto the old array.
export function toSessionUser(user: SessionUserRow): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatarUrl,
    age: user.age,
    sex: user.sex,
    weekStart: user.weekStart as 0 | 1,
    defaultRestSeconds: user.defaultRestSeconds,
    plateSizes: user.plateSizes.map(Number)
  }
}
