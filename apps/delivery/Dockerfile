# Build from monorepo root: docker compose build delivery
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
RUN if [ -f "apps/delivery/prisma/schema.prisma" ]; then pnpm --filter "@erp/delivery" exec prisma generate; fi
RUN pnpm --filter "@erp/delivery" build

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3006
ENV HOSTNAME=0.0.0.0
ENV SERVICE_NAME=delivery
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/delivery/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/delivery/.next/static ./apps/delivery/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/delivery/public ./apps/delivery/public
USER nextjs
EXPOSE 3006
CMD ["node", "apps/delivery/server.js"]
