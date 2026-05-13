# ── Stage 1: Install ALL dependencies (dev + prod) ──────────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Generate Prisma client + compile TypeScript ─────────────────────
FROM deps AS build
ENV NODE_OPTIONS=--max-old-space-size=4096
COPY prisma ./prisma
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
# prisma CLI is in devDeps — available here because deps stage installed everything
RUN npx prisma generate --schema prisma/schema.prisma
RUN npm run build

# ── Stage 3: Production runtime image ────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd -r app && useradd -r -g app -u 10001 app

# Install only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy schema for any runtime Prisma introspection needs
COPY prisma ./prisma

# Copy the Prisma-generated client from build stage
# This avoids needing the prisma CLI (a devDep) in the runtime image
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy compiled application
COPY --from=build /app/dist ./dist

RUN chown -R app:app /app
USER app

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
  CMD node -e "\
    const p = process.env.PORT || 5001; \
    require('http').get('http://localhost:' + p + '/health', r => { \
      process.exit(r.statusCode === 200 ? 0 : 1); \
    }).on('error', () => process.exit(1));"

CMD ["node", "dist/server.js"]
