# ---------- build stage ----------
FROM node:20-alpine AS build

WORKDIR /app

# Make a non-root user and a writable data dir (good practice)
RUN adduser -D -h /app nodeuser \
  && mkdir -p /data \
  && chown -R nodeuser:nodeuser /data /app

USER nodeuser

# Copy only manifest files first for better caching
COPY --chown=nodeuser:nodeuser package.json package-lock.json ./

# Install exactly what's in the lockfile (this is why we must sync it)
RUN npm ci

# Copy schema & source and generate Prisma client
COPY --chown=nodeuser:nodeuser prisma ./prisma
RUN npx prisma generate

# Copy the rest of the source and build TS -> JS
COPY --chown=nodeuser:nodeuser tsconfig.json ./tsconfig.json
COPY --chown=nodeuser:nodeuser src ./src
COPY --chown=nodeuser:nodeuser scripts ./scripts

RUN npm run build

# ---------- runtime stage ----------
FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Same user
RUN adduser -D -h /app nodeuser \
  && mkdir -p /data \
  && chown -R nodeuser:nodeuser /data /app
USER nodeuser

# Only bring what we need to run
COPY --from=build --chown=nodeuser:nodeuser /app/node_modules ./node_modules
COPY --from=build --chown=nodeuser:nodeuser /app/dist ./dist
COPY --from=build --chown=nodeuser:nodeuser /app/prisma ./prisma
COPY --chown=nodeuser:nodeuser package.json ./

EXPOSE 3001

CMD ["node", "dist/server.js"]

