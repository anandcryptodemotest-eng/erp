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
ARG JWT_SECRET=local-docker-build-validation-jwt-secret
ARG SERVICE_SECRET=local-docker-build-validation-service-secret
# next.config rewrites are baked at build time. Use Compose DNS names so the
# running gateway container can reach sibling services (localhost would 500).
ARG SALES_SERVICE_URL=http://sales:3001
ARG INVENTORY_SERVICE_URL=http://inventory:3002
ARG ACCOUNTING_SERVICE_URL=http://accounting:3003
ARG HR_SERVICE_URL=http://hr:3004
ARG PROCUREMENT_SERVICE_URL=http://procurement:3005
ARG DELIVERY_SERVICE_URL=http://delivery:3006
ARG GATEWAY_SERVICE_URL=http://gateway:3010
ENV SALES_SERVICE_URL=$SALES_SERVICE_URL
ENV INVENTORY_SERVICE_URL=$INVENTORY_SERVICE_URL
ENV ACCOUNTING_SERVICE_URL=$ACCOUNTING_SERVICE_URL
ENV HR_SERVICE_URL=$HR_SERVICE_URL
ENV PROCUREMENT_SERVICE_URL=$PROCUREMENT_SERVICE_URL
ENV DELIVERY_SERVICE_URL=$DELIVERY_SERVICE_URL
ENV GATEWAY_SERVICE_URL=$GATEWAY_SERVICE_URL

# 1. Build lowest-level shared runtime package first
RUN pnpm --filter "@erp/logger" build

# 2. Build telemetry after logger exists
RUN pnpm --filter "@erp/telemetry" build

# 3. Generate Prisma client (schema owns the DB models)
RUN pnpm --filter "@erp/gateway" exec prisma generate --schema=prisma/schema.prisma

# 4. Build Gateway last (Next.js standalone output)
RUN DEPLOYMENT_ENVIRONMENT=development \
    JWT_SECRET=local-docker-build-validation-jwt-secret \
    SERVICE_SECRET=local-docker-build-validation-service-secret \
    pnpm --filter "@erp/gateway" build

# Package the already-built workspace dependency closure (logger dist + telemetry dist)
FROM builder AS deployer
RUN pnpm --filter "@erp/gateway" deploy --prod /app/deploy

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3010
ENV HOSTNAME=0.0.0.0
ENV SERVICE_NAME=gateway
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir -p /var/lib/erp-uploads \
    && chown nextjs:nodejs /var/lib/erp-uploads

# Next standalone output
COPY --from=builder --chown=nextjs:nodejs \
    /app/apps/gateway/.next/standalone ./

COPY --from=builder --chown=nextjs:nodejs \
    /app/apps/gateway/.next/static \
    ./apps/gateway/.next/static

RUN mkdir -p ./apps/gateway/public
COPY --from=builder --chown=nextjs:nodejs \
    /app/apps/gateway/public/ \
    ./apps/gateway/public/

# Production dependency snapshot (pnpm deploy closure — includes compiled logger + telemetry)
COPY --from=deployer --chown=nextjs:nodejs \
    /app/deploy/node_modules \
    ./node_modules

USER nextjs
EXPOSE 3010
ENV UPLOAD_ROOT=/tmp/erp-uploads
CMD ["node", "apps/gateway/server.js"]
