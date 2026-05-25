# Fitness Tracker

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

- [Bun](https://bun.sh) 1.3+ — `curl -fsSL https://bun.sh/install | bash`
- [Podman](https://podman.io) with the `compose` plugin (or `podman-compose`)

## Setup

```bash
cp .env.example .env                          # set NUXT_SESSION_PASSWORD to a 32+ char string
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
bun test                   # all projects
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
podman compose --profile test run --rm playwright test:e2e tests/example.spec.ts   # one file
```

The `playwright` service in `compose.yml` uses Microsoft's official Playwright image, installs Bun on first run (cached in a named volume for subsequent runs), and runs the suite against the rest of the compose stack. Args after the service name are forwarded to `bun`. The HTML report lands in `playwright-report/` on the host — open `playwright-report/index.html` in your browser to view it.

This option is headless only. For interactive modes (`--ui`, `--debug`, `--headed`), use Option B.

**Option B — On the host** (required for the Playwright UI and inspector):

```bash
bunx playwright install --with-deps   # one-time: browsers + OS libs
bun test:e2e
bun test:e2e:ui                       # interactive UI mode
```
