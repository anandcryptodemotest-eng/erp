# Build from monorepo root: docker compose build gateway
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN if [ -f "apps/gateway/prisma/schema.prisma" ]; then pnpm --filter "@erp/gateway" exec prisma generate; fi
RUN pnpm --filter "@erp/gateway" build

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3010
ENV HOSTNAME=0.0.0.0
ENV SERVICE_NAME=gateway
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/gateway/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/gateway/.next/static ./apps/gateway/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/gateway/public ./apps/gateway/public
USER nextjs
EXPOSE 3010
CMD ["node", "apps/gateway/server.js"]
