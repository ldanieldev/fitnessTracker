import { and, eq, getTableColumns } from 'drizzle-orm'
import { users, authProviders } from '~~/server/db/schema'

interface OAuthProfile {
  email: string
  name: string
  avatarUrl?: string
}

interface ProviderInfo {
  provider: string
  providerAccountId: string
}

export async function findOrCreateUserAndLinkProvider(
  profile: OAuthProfile,
  providerInfo: ProviderInfo,
  currentUserId?: number
) {
  const { password, ...userColumns } = getTableColumns(users)

  // Check if this provider account is already linked
  const existingLink = await db
    .select({ userId: authProviders.userId })
    .from(authProviders)
    .where(
      and(
        eq(authProviders.provider, providerInfo.provider),
        eq(authProviders.providerAccountId, providerInfo.providerAccountId)
      )
    )
    .limit(1)

  if (existingLink.length) {
    const linkedUserId = existingLink[0]!.userId
    // provider account must not already belong to
    // someone else — refuse rather than hand back a different account.
    if (currentUserId && linkedUserId !== currentUserId) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This account is already linked to a different user.'
      })
    }
    // Provider already linked — return the user
    const result = await db.select(userColumns).from(users).where(eq(users.id, linkedUserId)).limit(1)
    return result[0]!
  }

  // Linking while signed in: attach the provider to the CURRENT user and never
  // resolve by email — doing so would switch the session to whoever owns that
  // email (or create a new user) if it differs from the signed-in account.
  if (currentUserId) {
    await db.insert(authProviders).values({
      userId: currentUserId,
      provider: providerInfo.provider,
      providerAccountId: providerInfo.providerAccountId
    })
    return db
      .select(userColumns)
      .from(users)
      .where(eq(users.id, currentUserId))
      .limit(1)
      .then((r) => r[0]!)
  }

  // Auto-link by email: find existing user
  let user = await db
    .select(userColumns)
    .from(users)
    .where(eq(users.email, profile.email))
    .limit(1)
    .then((r) => r[0])

  if (!user) {
    // Create new user from OAuth profile
    const result = await db
      .insert(users)
      .values({
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        age: 0,
        isActive: true
      })
      .returning(userColumns)
    user = result[0]!
  } else if (profile.avatarUrl && !user.avatarUrl) {
    // Backfill avatar if missing
    await db.update(users).set({ avatarUrl: profile.avatarUrl }).where(eq(users.id, user.id))
    user.avatarUrl = profile.avatarUrl
  }

  // Link the provider to the user
  await db.insert(authProviders).values({
    userId: user.id,
    provider: providerInfo.provider,
    providerAccountId: providerInfo.providerAccountId
  })

  return user
}
