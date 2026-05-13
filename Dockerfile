FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --prefer-offline --no-audit || npm install --prefer-offline --no-audit || npm install --prefer-offline --no-audit

FROM deps AS dev
ENV NODE_ENV=development

FROM deps AS build
ENV NODE_OPTIONS=--max-old-space-size=4096
COPY prisma ./prisma
COPY tsconfig.json prisma.config.ts ./
COPY scripts ./scripts
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd -r app && useradd -r -g app -u 10001 app
COPY package.json package-lock.json ./
RUN npm install --omit=dev --prefer-offline --no-audit || npm install --omit=dev --prefer-offline --no-audit || npm install --omit=dev --prefer-offline --no-audit
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate
COPY --from=build /app/dist ./dist
RUN chown -R app:app /app
USER app
EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD node -e "const p=process.env.PORT||5001;require('http').get('http://localhost:'+p+'/health', r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1));"
CMD ["node", "dist/server.js"]