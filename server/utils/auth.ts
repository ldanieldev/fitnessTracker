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
  providerInfo: ProviderInfo
) {
  const { password, ...userColumns } = getTableColumns(users)

  // Check if this provider account is already linked
  const existingLink = await db
    .select({ userId: authProviders.userId })
    .from(authProviders)
    .where(and(
      eq(authProviders.provider, providerInfo.provider),
      eq(authProviders.providerAccountId, providerInfo.providerAccountId)
    ))
    .limit(1)

  if (existingLink.length) {
    // Provider already linked — return the user
    const result = await db
      .select(userColumns)
      .from(users)
      .where(eq(users.id, existingLink[0]!.userId))
      .limit(1)
    return result[0]!
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
    await db
      .update(users)
      .set({ avatarUrl: profile.avatarUrl })
      .where(eq(users.id, user.id))
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
