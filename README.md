# My Fitness Journal

A self-hosted Nuxt 4 app for logging workouts, running excercise programs, and tracking nutrition 
and body metrics, with optional Google Health sync.

## Stack

- **Runtime / package manager**: Bun
- **Framework**: Nuxt 4 + Nuxt UI (Tailwind)
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: `nuxt-auth-utils` (credentials, GitHub and Google OAuth, per-user API tokens)
- **Search**: Meilisearch, with a Postgres fallback
- **Background jobs**: Inngest
- **Tests**: Vitest (unit + Nuxt) and Playwright (E2E)

## Prerequisites

- [Bun](https://bun.sh) 1.4+ — `curl -fsSL https://bun.sh/install | bash`
- [Podman](https://podman.io) with the `compose` plugin (or `podman-compose`)

## Setup

```bash
cp .env.example .env                          # then uncomment its "Development only" block — see "Environment" below
systemctl --user enable --now podman.socket   # see "Other container runtimes" below
bun install
podman compose up -d                          # postgres, redis, meilisearch, inngest, alloy (all on 127.0.0.1)
podman compose --profile dev up -d redis-insight   # optional Redis browser on http://localhost:5540
bunx drizzle-kit migrate                      # schema + nutrient and exercise catalogues
bun exercises:assets                          # exercise photos into public/exercises/ (git-ignored)
bun dev
curl -X PUT http://localhost:3000/api/inngest # register the app's functions with Inngest
```

> [!IMPORTANT]
> **The first account to sign up becomes the admin.** Register your own account before exposing the app to
> anyone else. See [Admin](#admin) to move the role later.

`inngest start` doesn't poll the app, so re-run the `PUT` whenever a function or its cron changes.

### Other container runtimes

The commands in this README assume **rootless Podman on Linux**. If you're using something else:

- **Docker Desktop (Mac / Windows / Linux)** or **Docker Engine on Linux**: substitute `docker compose` for every `podman compose` command and **skip** the `systemctl --user enable --now podman.socket` line — Docker manages its own socket.
- **Podman Desktop / `podman machine` on Mac / Windows**: substitute is identical to the Linux Podman commands, but skip the `systemctl` line — `podman machine init` already sets up the equivalent socket inside its Linux VM.
- **Rootless Podman on Linux** (the default path): keep everything as-is. The `systemctl --user enable --now podman.socket` line is a one-time setup that enables the user-scoped API socket `compose` needs to manage service dependencies.

## Environment

> `DATABASE_URL` host: use `localhost` when the app runs on the host (`bun dev`, `drizzle-kit`) and
> `postgres` when it runs inside the compose network (containerized E2E, Option A below). The two
> can't both be right in one file — swap it for the run you're doing.

### Core - REQUIRED

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection string used by the app pool and `drizzle-kit`. No default — the pool fails to connect without it. |
| `NUXT_SESSION_PASSWORD` | Seals the session cookie. Must be 32+ characters. |
| `INNGEST_SIGNING_KEY` / `INNGEST_EVENT_KEY` | Hex, even length. Development uses the compose defaults with `INNGEST_DEV=1`; a production build refuses to start with `INNGEST_DEV` set, a key missing, a key under 32 characters or a compose default. |

### Compose services - OPTIONAL

Defaults live in `compose.yml`; set these only to override.

| Variable | Default | Description |
| --- | --- | --- |
| `POSTGRES_USER` | `postgres` | Postgres superuser. |
| `POSTGRES_PASSWORD` | `postgres` | Its password. |
| `POSTGRES_DB` | `app` | Database created on first boot. |
| `INNGEST_SCHEMA` | `inngest` | Schema Inngest gets to itself, away from the app's tables. |
| `INNGEST_EVENT_KEY` | `deadbeefdeadbeef` | Hex string, even number of characters. Development only. |
| `INNGEST_SIGNING_KEY` | `cafebabecafebabe` | Same format. Development only. |
| `REDIS_URL` | `redis://redis:6379` | Passed to Inngest as its Redis URI. |
| `APP_DB_USER` / `APP_DB_PASSWORD` | `journal` / — | `compose.prod.yml` only: the app's non-superuser database role, created and granted by the `migrate` service. |
| `REDIS_PASSWORD` | — | `compose.prod.yml` only: Redis `requirepass`. |
| `MEILI_MASTER_KEY` | — | `compose.prod.yml` only: Meilisearch master key (16+ bytes); the app uses it as `NUXT_MEILI_API_KEY`. |
| `APP_BIND` / `APP_PORT` | `127.0.0.1` / `3000` | `compose.prod.yml` only: where the app is published. |

### App - OPTIONAL

| Variable | Default | Description |
| --- | --- | --- |
| `APP_NAME` | `My Fitness Journal` | Display name, exposed via public runtime config. |
| `PORT` | `3000` | HTTP port for the built server. |
| `NUXT_REGISTRATION` | `open` | `open` lets anyone sign up; any other value (e.g. `closed`) allows only the first account. |
| `NUXT_TRUST_PROXY` | `false` (`true` in `compose.prod.yml`) | `true` only behind your own reverse proxy: client IP and host then come from `X-Forwarded-For` / `X-Forwarded-Host` (rate limits, cross-site check). Left `false` behind a proxy, every client shares the proxy's IP and so one rate-limit bucket. Must be `false` when clients reach the app directly. |
| `NUXT_SESSION_MAX_AGE` | `2592000` | Session lifetime in seconds from sign-in (30 days). |
| `INNGEST_BASE_URL` / `INNGEST_SERVE_ORIGIN` | — | Where the SDK reaches Inngest, and the origin Inngest calls back on (`/api/inngest`). |
| `INNGEST_DEV` | — | Development only: `1` talks to the dev Inngest without request signing. Never in production. |
| `NUXT_OAUTH_GITHUB_CLIENT_ID` / `NUXT_OAUTH_GITHUB_CLIENT_SECRET` | — | [GitHub OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app), callback `<origin>/api/auth/github`. Without either provider only credentials login works. |
| `NUXT_OAUTH_GOOGLE_CLIENT_ID` / `NUXT_OAUTH_GOOGLE_CLIENT_SECRET` | — | [Google OAuth client](https://developers.google.com/identity/protocols/oauth2/web-server), redirect URI `<origin>/api/auth/google`. Also used by Google Health. |
| `NUXT_MEILI_HOST` / `NUXT_MEILI_API_KEY` | — | Meilisearch for food and exercise search. Unset falls back to Postgres. |
| `NUXT_REDIS_URL` | — | Cache store. Unset uses Nitro's in-memory cache. |

### Food sources - OPTIONAL

| Variable | Default | Description |
| --- | --- | --- |
| `NUXT_OFF_USER_AGENT` | — | Open Food Facts requires an app name and contact, e.g. `MyFitnessJournal/0.1 (you@example.com)`. |
| `NUXT_USDA_API_KEY` | — | [USDA FoodData Central key](https://fdc.nal.usda.gov/api-key-signup). `DEMO_KEY` works at 30 req/h. |
| `NUXT_FATSECRET_CLIENT_ID` / `NUXT_FATSECRET_CLIENT_SECRET` | — | [FatSecret Platform](https://platform.fatsecret.com/). The server's public IP must be on the app's allow-list. |
| `NUXT_FATSECRET_SCOPE` | `basic` | FatSecret OAuth scope. |

### Google Health - OPTIONAL

Reuses the Google OAuth client above: enable the [Google Health API](https://developers.google.com/health) and add
`<origin>/api/integrations/google-health/connect` as a redirect URI.

| Variable | Default | Description |
| --- | --- | --- |
| `NUXT_GOOGLE_HEALTH_TOKEN_KEY` | — | Encrypts stored refresh tokens. 32 random bytes, base64 (`openssl rand -base64 32`); changing it forces every user to reconnect. |
| `NUXT_GOOGLE_HEALTH_SYNC_CRON` | `TZ=America/Chicago 0 7,15 * * *` | Scheduled sync. Changing it needs a restart and an Inngest re-sync. |
| `NUXT_GOOGLE_HEALTH_SYNC_COOLDOWN_SECONDS` | `60` | Minimum gap between a user's "Sync now" presses (429 inside it). |

### Sentry (errors, traces, logs) - OPTIONAL

| Variable | Default | Description |
| --- | --- | --- |
| `SENTRY_DSN` | — | Runtime reporting is off entirely unless this is set. The browser DSN is read at build time; override it at runtime with `NUXT_PUBLIC_SENTRY_DSN`. |
| `SENTRY_ENVIRONMENT` | `NODE_ENV` | Stamped on log lines as `env`. |
| `NUXT_PUBLIC_SENTRY_REPLAY` | `false` | Runtime. `true` turns on browser Session Replay for every user on the instance: 10% of sessions plus every session with an error, text and media masked. |
| `SENTRY_ORG` | — | Build-time only, for sourcemap upload. |
| `SENTRY_PROJECT` | `my-fitness-journal` | Build-time only. |
| `SENTRY_AUTH_TOKEN` | — | Build-time only. |
| `SENTRY_UPLOAD_SOURCEMAPS` | `false` | Upload is gated on this being `true`, so ordinary builds — including the one `@nuxt/test-utils` makes per E2E run — don't cut a release. |

### OpenTelemetry metrics and logging - OPTIONAL

Traces go straight to Sentry. Only metrics take this path: the server exports OTLP to the local
`alloy` collector, which remote-writes to Mimir and ships logs to Loki.

| Variable | Default | Description |
| --- | --- | --- |
| `ENABLE_OPENTELEMETRY` | `false` | Master switch. The meter provider is only registered when this is exactly `true`; otherwise every instrument is a no-op. |
| `OTEL_SERVICE_NAME` | `my-fitness-journal-server` | `service.name` on metrics, and `service` on log lines. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | Alloy's OTLP HTTP port, published by `compose.yml`. |
| `LOG_LEVEL` | `info` | Pino level. |
| `LOG_FILE` | `logs/app.log` | Extra JSON sink alongside stdout; Alloy tails it from the host. Leave empty for stdout only. |
| `GIT_SHA` | — | Stamped on every log line as `release`; set from the commit SHA in CI and image builds. |
| `MIMIR_PUSH_URL` | — | Full push URL Alloy remote-writes metrics to, e.g. `http://127.0.0.1:49009/api/v1/push`. |
| `LOKI_PUSH_URL` | — | Full push URL Alloy ships logs to, e.g. `http://127.0.0.1:43100/loki/api/v1/push`. |

## Deploying / self-hosting

`compose.prod.yml` runs the whole stack from the `Dockerfile`: a one-shot `migrate` service, the app, Postgres, Redis,
Meilisearch and Inngest. Nothing but the app (`127.0.0.1:3000`) and the Inngest dashboard (`127.0.0.1:8288`) is
published, and both only on loopback. It uses its own project name, so its volumes never mix with the dev stack's.

### 1. Secrets

```bash
cp .env.example .env
openssl rand -hex 32      # once per value: NUXT_SESSION_PASSWORD, INNGEST_SIGNING_KEY, INNGEST_EVENT_KEY,
                          # POSTGRES_PASSWORD, APP_DB_PASSWORD, REDIS_PASSWORD, MEILI_MASTER_KEY
openssl rand -base64 32   # NUXT_GOOGLE_HEALTH_TOKEN_KEY (exactly 32 bytes, base64), only if you use Google Health
```

Hex keeps the passwords URL-safe, since compose embeds them in connection URLs. Leave the "Development only" block
commented: a production build refuses to start with `INNGEST_DEV` set or a default, short or missing Inngest key.
`compose.prod.yml` builds `DATABASE_URL`, `NUXT_REDIS_URL`, `NUXT_MEILI_*` and `INNGEST_BASE_URL`/`INNGEST_SERVE_ORIGIN`
itself. Back up `.env`: losing `NUXT_GOOGLE_HEALTH_TOKEN_KEY` forces every user to reconnect Google Health.

### 2. Start and upgrade

```bash
podman compose -f compose.prod.yml up -d --build
```

`migrate` applies `drizzle/` with the superuser, then creates or updates the `APP_DB_USER` role with read/write on the
app's tables only; the app connects as that role. Upgrading is `git pull` and the same command. Inngest re-syncs the
app's functions every minute (`--sdk-url`), so production needs no `curl -X PUT /api/inngest` — and an unsigned `PUT`
is refused there anyway.

### 3. Before exposing it

- **HTTPS is required.** The session cookie is `Secure`, so browsers drop it over plain HTTP (only `localhost` is
  exempt). Put a reverse proxy with a real certificate in front (Caddy, Traefik, nginx, Tailscale Serve).
- **Proxy settings:** forward to `127.0.0.1:3000` (set `APP_BIND=0.0.0.0` if the proxy runs on another host), pass
  `X-Forwarded-For` and `X-Forwarded-Host` (`compose.prod.yml` sets `NUXT_TRUST_PROXY=true` so rate limits and the
  cross-site check see the real client; set it `false` if `APP_BIND` exposes the app to clients directly). Allow request bodies of at least 10 MB (FitNotes imports); the app enforces its own per-route caps.
- **`/api/inngest`:** Inngest reaches the app over the compose network, and every call is signed with
  `INNGEST_SIGNING_KEY`. Nothing outside needs it, so block it at the proxy as well:

  ```
  # Caddyfile
  fitness.example.com {
    respond /api/inngest* 404
    reverse_proxy 127.0.0.1:3000
  }
  ```

- **Inngest dashboard:** `127.0.0.1:8288` has no login and can re-run functions. Reach it over an SSH tunnel
  (`ssh -L 8288:127.0.0.1:8288 <host>`), never through the proxy.
- **Accounts:** register your own account first (it becomes the admin), then set `NUXT_REGISTRATION=closed` and run
  `podman compose -f compose.prod.yml up -d app`. GitHub/Google sign-in links to an existing account with the same
  verified email; that is an accepted risk, and closed registration means nobody can pre-register someone else's
  address to catch their later OAuth sign-in.

### 4. Backups

```bash
podman compose -f compose.prod.yml exec -T postgres pg_dump -U postgres -Fc app > journal-$(date +%F).dump
podman compose -f compose.prod.yml exec -T postgres pg_restore -U postgres -d app --clean < journal-2026-10-16.dump
```

The dump holds the app's data and Inngest's state (the `inngest` schema). Redis is only a cache and a queue, and the
nightly Inngest jobs rebuild the Meilisearch indexes, so neither needs a backup.

## Admin

There is exactly one admin. In the app, **Settings → Admin** lists users and access tokens, disables, enables or
deletes accounts, and revokes tokens. Outside the app, the admin CLI works directly against `DATABASE_URL`:

```bash
bun admin set-admin <email>      # move the admin role; signs out the old and new admin everywhere
bun admin set-password <email>   # prompt for a new password (needs a TTY); signs the user out everywhere
```

The production image ships the same CLI as `.output/admin.mjs`:

```bash
podman exec -it <container> bun .output/admin.mjs set-password <email>
```

## Development

```bash
bun dev                    # http://localhost:3000
bun lint
bun typecheck
bun build                  # production build
bun preview                # serve the production build locally (needs production Inngest keys, not INNGEST_DEV)
```

### Database

```bash
bunx drizzle-kit generate  # create migration from schema changes
bunx drizzle-kit migrate   # apply pending migrations
bun dbml                   # regenerate ERD (DBML) from schema
bun db:seed                # optional: re-apply the nutrient and measurement-type catalogues
bun db:clean-test-users    # delete e2e users (--dry-run to count)
```

## Testing

### Unit and Nuxt component tests

Run on the host with Vitest:

```bash
bun run test               # all projects
bun test:unit              # unit tests only (test/unit/)
bun test:nuxt              # Nuxt component tests (test/nuxt/)
bun test:watch
bun test:coverage
```

### End-to-end tests (Playwright)

Two ways to run them, depending on whether you want browsers installed on your host.

**Option A — Headless run in a container** (no host install of Chromium or its system deps):

```bash
podman compose --profile test run --rm playwright                              # full suite
podman compose --profile test run --rm playwright test:e2e test/e2e/example.spec.ts   # one file
```

The `playwright` service in `compose.yml` uses Microsoft's official Playwright image, installs Bun on first run (cached in a named volume for subsequent runs), and runs the suite against the rest of the compose stack. Args after the service name are forwarded to `bun`. The HTML report lands in `playwright-report/` on the host — open `playwright-report/index.html` in your browser to view it.

This option is headless only. For interactive modes (`--ui`, `--debug`, `--headed`), use Option B.

**Option B — On the host** (required for the Playwright UI and inspector):

```bash
bunx playwright install --with-deps   # one-time: browsers + OS libs
bun test:e2e
bun test:e2e:ui                       # interactive UI mode
```
