# Base
FROM docker.io/oven/bun:1.4.4 AS base
WORKDIR /usr/src/app

# Install dependencies (cached layer)
FROM base AS install

RUN mkdir -p /temp/dev
COPY package.json bun.lock bunfig.toml /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Build
FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
# Only the downloader's own files, so the ~100 MB photo layer stays cached across code changes
COPY package.json ./
COPY shared/utils/exerciseAssets.ts shared/utils/
COPY scripts/exercises/fetchAssets.ts scripts/exercises/downloadAsset.ts scripts/exercises/
RUN bun exercises:assets
COPY . .

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ARG GIT_SHA=
# .git is not in the build context, so this is the only thing that can name the Sentry release
ENV SENTRY_RELEASE=$GIT_SHA
ARG SENTRY_UPLOAD_SOURCEMAPS=false
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=my-fitness-journal
ENV SENTRY_UPLOAD_SOURCEMAPS=$SENTRY_UPLOAD_SOURCEMAPS SENTRY_ORG=$SENTRY_ORG SENTRY_PROJECT=$SENTRY_PROJECT

# The secret mount keeps the token out of layers; an upload build without it fails instead of caching a no-upload layer
RUN --mount=type=secret,id=sentry_auth_token \
    export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null)" \
    && if [ "$SENTRY_UPLOAD_SOURCEMAPS" = true ] && [ -z "$SENTRY_AUTH_TOKEN" ]; then \
      echo 'SENTRY_UPLOAD_SOURCEMAPS=true needs the sentry_auth_token build secret' >&2; exit 1; \
    fi \
    && bun run build
RUN bun build scripts/admin.ts --target=bun --outfile .output/admin.mjs
RUN bun build scripts/migrate.ts --target=bun --outfile .output/migrate.mjs

# Production
FROM base AS release
ARG GIT_SHA=
ENV GIT_SHA=$GIT_SHA SENTRY_RELEASE=$GIT_SHA

# Nitro bundles everything - only need .output, plus drizzle/ for .output/migrate.mjs
COPY --from=build /usr/src/app/.output .output
COPY --from=build /usr/src/app/drizzle drizzle

USER bun
EXPOSE 3000/tcp

CMD ["bun", "--bun", ".output/server/index.mjs"]