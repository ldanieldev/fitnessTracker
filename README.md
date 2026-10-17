# My Fitness Journal

A self-hosted app for logging workouts, running exercise programs, and tracking nutrition and body metrics, with
optional Google Health sync.

## Stack

- Nuxt 4 + Nuxt UI on Bun
- PostgreSQL (Drizzle ORM), Redis, Meilisearch, Inngest
- Auth via `nuxt-auth-utils`: email/password, GitHub, Google, per-user API tokens

## Quick start

Requires [Bun](https://bun.sh) 1.4+ and Podman or Docker with compose.

```bash
cp .env.example .env                          # uncomment the "Development only" block
bun install
podman compose up -d
bunx drizzle-kit migrate
bun exercises:assets                          # exercise photos (git-ignored)
bun dev
curl -X PUT http://localhost:3000/api/inngest # register background jobs; re-run when a job or its cron changes
```

The first account to sign up becomes the admin.

## Configuration

Every variable is listed with a short note in `.env.example`. Required: `DATABASE_URL`, `NUXT_SESSION_PASSWORD`
(32+ characters), `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY`.

- A production build refuses to start with `INNGEST_DEV` set or with default or short (under 32 characters) Inngest
  keys.
- The session cookie is `Secure`, so serve the app over HTTPS.
- Behind a reverse proxy, set `NUXT_TRUST_PROXY=true` so rate limits see the real client IP.
- Set `NUXT_REGISTRATION=closed` once everyone who needs an account has one.

## Admin

**Settings → Admin** manages users and access tokens. From the command line, against `DATABASE_URL`:

```bash
bun admin set-admin <email>      # move the admin role
bun admin set-password <email>   # set a new password
```

The image ships the same CLI as `bun .output/admin.mjs`.

## Development

```bash
bun lint
bun typecheck
bunx drizzle-kit generate  # migration from schema changes
bun run test               # unit + Nuxt component tests (not bare `bun test`)
bun test:e2e               # Playwright; first run: bunx playwright install --with-deps
bun db:clean-test-users    # delete e2e users (--dry-run to count)
```
