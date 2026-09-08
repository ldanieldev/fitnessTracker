# My Fitness Journal

A full-stack Nuxt 4 app for logging workouts, tracking programs, and managing exercise history.

## Stack

- **Runtime / package manager**: Bun
- **Framework**: Nuxt 4 + Nuxt UI (Tailwind)
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: `nuxt-auth-utils` (credentials + GitHub OAuth)
- **Background jobs**: Inngest
- **Mail (dev)**: Mailpit
- **Tests**: Vitest (unit + Nuxt) and Playwright (E2E)

## Prerequisites

- [Bun](https://bun.sh) 1.4+ — `curl -fsSL https://bun.sh/install | bash`
- [Podman](https://podman.io) with the `compose` plugin (or `podman-compose`)

## Setup

```bash
# create .env — see "Environment" below
systemctl --user enable --now podman.socket   # see "Other container runtimes" below
bun install
podman compose up -d                          # postgres, redis, mailpit, inngest
bunx drizzle-kit migrate                      # apply pending migrations
```

### Other container runtimes

The commands in this README assume **rootless Podman on Linux**. If you're using something else:

- **Docker Desktop (Mac / Windows / Linux)** or **Docker Engine on Linux**: substitute `docker compose` for every `podman compose` command and **skip** the `systemctl --user enable --now podman.socket` line — Docker manages its own socket.
- **Podman Desktop / `podman machine` on Mac / Windows**: substitute is identical to the Linux Podman commands, but skip the `systemctl` line — `podman machine init` already sets up the equivalent socket inside its Linux VM.
- **Rootless Podman on Linux** (the default path): keep everything as-is. The `systemctl --user enable --now podman.socket` line is a one-time setup that enables the user-scoped API socket `compose` needs to manage service dependencies.

## Environment

Configuration comes from a git-ignored `.env` in the repo root. Nuxt loads it for the app,
`compose.yml` interpolates it for the service containers, and the `playwright` service mounts it
directly (`env_file`). A minimal one is enough to boot:

```bash
cat > .env <<'EOF'
DATABASE_URL=postgres://postgres:postgres@localhost:5432/app
NUXT_SESSION_PASSWORD=replace-with-at-least-32-characters
EOF
```

> `DATABASE_URL` host: use `localhost` when the app runs on the host (`bun dev`, `drizzle-kit`) and
> `postgres` when it runs inside the compose network (containerized E2E, Option A below). The two
> can't both be right in one file — swap it for the run you're doing.

### Required

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection string used by the app pool and `drizzle-kit`. No default — the pool fails to connect without it. |
| `NUXT_SESSION_PASSWORD` | Seals the session cookie. Must be 32+ characters. |

### Compose services

Defaults live in `compose.yml`; set these only to override.

| Variable | Default | Description |
| --- | --- | --- |
| `POSTGRES_USER` | `postgres` | Postgres superuser. |
| `POSTGRES_PASSWORD` | `postgres` | Its password. |
| `POSTGRES_DB` | `app` | Database created on first boot. |
| `INNGEST_SCHEMA` | `inngest` | Schema Inngest gets to itself, away from the app's tables. |
| `INNGEST_EVENT_KEY` | `deadbeefdeadbeef` | Hex string, even number of characters. |
| `INNGEST_SIGNING_KEY` | `cafebabecafebabe` | Same format. |
| `REDIS_URL` | `redis://redis:6379` | Passed to Inngest as its Redis URI. |

### App

| Variable | Default | Description |
| --- | --- | --- |
| `APP_NAME` | `My Fitness Journal` | Display name, exposed via public runtime config. |
| `PORT` | `3000` | HTTP port for the built server. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | — | GitHub OAuth. Without them only credentials login works. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Google OAuth. |

### Sentry (errors, traces, logs)

| Variable | Default | Description |
| --- | --- | --- |
| `SENTRY_DSN` | — | Runtime reporting is off entirely unless this is set. |
| `SENTRY_ENVIRONMENT` | `NODE_ENV` | Stamped on log lines as `env`. |
| `SENTRY_ORG` | — | Build-time only, for sourcemap upload. |
| `SENTRY_PROJECT` | `my-fitness-journal` | Build-time only. |
| `SENTRY_AUTH_TOKEN` | — | Build-time only. |
| `SENTRY_UPLOAD_SOURCEMAPS` | `false` | Upload is gated on this being `true`, so ordinary builds — including the one `@nuxt/test-utils` makes per E2E run — don't cut a release. |

### OpenTelemetry metrics and logging

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

## Development

```bash
bun dev                    # http://localhost:3000
bun lint
bun typecheck
bun build                  # production build
bun preview                # serve the production build locally
```

### Database

```bash
bunx drizzle-kit generate  # create migration from schema changes
bunx drizzle-kit migrate   # apply pending migrations
bun dbml                   # regenerate ERD (DBML) from schema
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
