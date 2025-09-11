import { PrismaClient } from "@prisma/client";

// Keep a single Prisma instance across hot-reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production"
      ? []                // silent in production
      : ["query", "warn", "error"], // verbose in dev
  });

// Only set the client on the global object in non-prod
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
