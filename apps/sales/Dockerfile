# Build from monorepo root: docker compose build sales
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
RUN if [ -f "apps/sales/prisma/schema.prisma" ]; then pnpm --filter "@erp/sales" exec prisma generate; fi
RUN pnpm --filter "@erp/sales" build

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV SERVICE_NAME=sales
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/sales/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/sales/.next/static ./apps/sales/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/sales/public ./apps/sales/public
USER nextjs
EXPOSE 3001
CMD ["node", "apps/sales/server.js"]
