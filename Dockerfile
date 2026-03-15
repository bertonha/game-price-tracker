# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:25-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:25-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules so playwright CLI is available, then install browser + deps
COPY --from=builder /app/node_modules ./node_modules
RUN npx playwright install chromium --with-deps

# Copy Next.js standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
