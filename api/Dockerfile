# ---------- builder ----------
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

# runtime-only deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# copy built artifacts + prisma client
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/prisma /app/prisma

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/server.js"]

