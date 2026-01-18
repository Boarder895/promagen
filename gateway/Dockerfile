# Dockerfile - Promagen API Gateway
# Modular Monolith Architecture v2.0
# All source in src/ folder (lib + feeds + server)

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

# Build TypeScript (compiles src/ to dist/src/)
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

# Set ownership
RUN chown -R gateway:nodejs /app

USER gateway

# Environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check - increased start period for feed initialization
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "dist/src/bootstrap.js"]
