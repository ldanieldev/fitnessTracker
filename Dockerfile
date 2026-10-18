# Base
FROM docker.io/oven/bun:1.4.0 AS base
WORKDIR /usr/src/app

# Install dependencies (cached layer)
FROM base AS install

RUN mkdir -p /temp/dev
COPY package.json bun.lock bunfig.toml /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Build
FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN bun run build
RUN bun build scripts/admin.ts --target=bun --outfile .output/admin.mjs
RUN bun build scripts/migrate.ts --target=bun --outfile .output/migrate.mjs

# Production
FROM base AS release
ARG GIT_SHA=
ENV GIT_SHA=$GIT_SHA

# Nitro bundles everything - only need .output, plus drizzle/ for .output/migrate.mjs
COPY --from=build /usr/src/app/.output .output
COPY --from=build /usr/src/app/drizzle drizzle

USER bun
EXPOSE 3000/tcp

CMD ["bun", "--bun", ".output/server/index.mjs"]