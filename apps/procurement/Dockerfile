# Build from monorepo root: docker compose build procurement
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
RUN if [ -f "apps/procurement/prisma/schema.prisma" ]; then pnpm --filter "@erp/procurement" exec prisma generate; fi
RUN pnpm --filter "@erp/procurement" build

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3005
ENV HOSTNAME=0.0.0.0
ENV SERVICE_NAME=procurement
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/procurement/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/procurement/.next/static ./apps/procurement/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/procurement/public ./apps/procurement/public
USER nextjs
EXPOSE 3005
CMD ["node", "apps/procurement/server.js"]
