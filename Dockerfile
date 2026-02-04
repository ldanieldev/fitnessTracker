# Base
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Install dependencies (cached layer)
FROM base AS install

RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Build
FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN bun run build

# Production
FROM base AS release

# Nitro bundles everything - only need .output
COPY --from=build /usr/src/app/.output .output

USER bun
EXPOSE 3000/tcp

CMD ["bun", "--bun", ".output/server/index.mjs"]