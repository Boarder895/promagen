# ---- Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Only copy what we need to run
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# Fly sets PORT; our server reads it. No EXPOSE needed for fly, but harmless:
EXPOSE 8080
CMD ["node", "dist/server.js"]
