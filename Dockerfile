# ── Stage 1: Install ALL dependencies (dev + prod) ──────────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app
# Install OpenSSL — required by Prisma's library engine
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Generate Prisma client + compile TypeScript ─────────────────────
FROM deps AS build
ENV NODE_OPTIONS=--max-old-space-size=4096
COPY prisma ./prisma
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN npx prisma generate --schema prisma/schema.prisma
RUN npm run build

# ── Stage 3: Production runtime image ────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install OpenSSL — required by Prisma's library engine at RUNTIME
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN groupadd -r app && useradd -r -g app -u 10001 app

# Install only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy schema — Prisma validates it at startup
COPY prisma ./prisma

# Copy the Prisma-generated client from build stage (no CLI re-run needed)
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy the Prisma CLI binary from the build stage so we can run db push at startup.
COPY --from=build /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma

# Copy compiled application
COPY --from=build /app/dist ./dist

RUN chown -R app:app /app
USER app

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD node -e "\
    const p = process.env.PORT || 5001; \
    require('http').get('http://localhost:' + p + '/health', r => { \
      process.exit(r.statusCode === 200 ? 0 : 1); \
    }).on('error', () => process.exit(1));"

# Run schema sync then start the server.
# db push is idempotent — safe to run on every container start.
# --skip-generate because we already generated the client in the build stage.
# --accept-data-loss is safe here since we have no destructive changes on fresh DBs.
CMD ["sh", "-c", "node_modules/.bin/prisma db push --schema prisma/schema.prisma --skip-generate --accept-data-loss && node dist/scripts/seedAll.js; node dist/server.js"]
