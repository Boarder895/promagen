// NEW FILE: src/db/prisma.ts
import { PrismaClient } from '@prisma/client';

/**
 * Reuse a single Prisma instance in dev to avoid connection storms.
 * In production (Fly) we just create one per process.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
