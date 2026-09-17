# Stage 1: Build SvelteKit application and Cloudflare Worker
FROM oven/bun:1-debian AS builder
WORKDIR /app

# Install dependencies using bun
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

# Copy source tree and compile assets + worker bundle
COPY . .
RUN bun run gen && bun run build

# Stage 2: Self-hosted Production Runtime
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=4173 \
    PERSIST_DIR=/data

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy built application and required runtime assets
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.svelte-kit ./.svelte-kit
COPY --from=builder /app/src ./src
COPY --from=builder /app/static ./static
COPY --from=builder /app/wrangler.jsonc ./wrangler.jsonc
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh && mkdir -p /data

EXPOSE 4173

VOLUME ["/data"]

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT}/ || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
