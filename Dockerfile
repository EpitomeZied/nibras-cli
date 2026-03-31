# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/proxy/package.json ./apps/proxy/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/core/package.json ./packages/core/
COPY packages/github/package.json ./packages/github/
COPY packages/grading/package.json ./packages/grading/
RUN npm ci --ignore-scripts

FROM deps AS build
COPY . .
RUN npm run build

# ── API service ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/prisma ./prisma
EXPOSE 4848
CMD ["node", "apps/api/dist/server.js"]

# ── Worker service ────────────────────────────────────────────────────────────
FROM node:20-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/prisma ./prisma
CMD ["node", "apps/worker/dist/worker.js"]

# ── Web service ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@nibras/web"]
