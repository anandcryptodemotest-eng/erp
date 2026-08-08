# Build from monorepo root: docker compose build accounting
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
ENV JWT_SECRET=local-docker-build-validation-jwt-secret
ENV SERVICE_SECRET=local-docker-build-validation-service-secret
RUN if [ -f "apps/accounting/prisma/schema.prisma" ]; then pnpm --filter "@erp/accounting" exec prisma generate; fi
RUN pnpm --filter "@erp/logger" build
RUN pnpm --filter "@erp/telemetry" build
RUN DEPLOYMENT_ENVIRONMENT=development JWT_SECRET=local-docker-build-validation-jwt-secret SERVICE_SECRET=local-docker-build-validation-service-secret pnpm --filter "@erp/accounting" build

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3003
ENV HOSTNAME=0.0.0.0
ENV SERVICE_NAME=accounting
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/accounting/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/accounting/.next/static ./apps/accounting/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/accounting/public ./apps/accounting/public
COPY --from=builder --chown=nextjs:nodejs /app/packages/telemetry/package.json ./packages/telemetry/package.json
COPY --from=builder --chown=nextjs:nodejs /app/packages/telemetry/dist ./packages/telemetry/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/telemetry/node_modules ./packages/telemetry/node_modules
RUN mkdir -p /app/node_modules/@erp && ln -s /app/packages/telemetry /app/node_modules/@erp/telemetry
USER nextjs
EXPOSE 3003
CMD ["node", "apps/accounting/server.js"]
