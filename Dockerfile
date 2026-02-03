# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
ENV NODE_OPTIONS=--max-old-space-size=4096
COPY prisma ./prisma
COPY tsconfig.json prisma.config.ts ./
COPY scripts ./scripts
COPY src ./src
RUN npx prisma generate --schema prisma/schema.prisma
RUN npm run build

FROM deps AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY prisma ./prisma
COPY tsconfig.json prisma.config.ts ./
COPY src ./src
COPY scripts ./scripts
CMD ["npm", "run", "dev"]

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN groupadd -r app && useradd -r -g app -u 10001 app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate --schema prisma/schema.prisma

COPY --from=build /app/dist ./dist
RUN chown -R app:app /app

USER app

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD node -e "require('http').get('http://localhost:5001/health', r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1));"

CMD ["node", "dist/server.js"]
