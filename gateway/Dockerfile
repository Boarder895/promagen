# Dockerfile - Promagen API Gateway
# Multi-stage build for small, secure image
# Version 2.3.1 - SSOT support for FX pairs (runtime fetch from frontend)

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install ALL dependencies (including dev for TypeScript)
RUN npm install

# Copy TypeScript config and source files
COPY tsconfig.json ./
COPY src ./src
COPY lib ./lib

# Build TypeScript (compiles src/ and lib/ to dist/)
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 gateway

# Copy package.json and install production deps only
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Note: Gateway fetches SSOT from frontend at runtime
# No local data directory needed

# Set ownership
RUN chown -R gateway:nodejs /app

USER gateway

# Environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "dist/src/server.js"]
