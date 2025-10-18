// src/lib/db.ts
// Minimal, typed Prisma-like stub for Stage 1.
// Replace with a real Prisma client in API code during Stage 2/3.

export type PrismaLike = {
  $queryRawUnsafe?<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]>;
};

const prisma: PrismaLike = {
  // Safe no-op; returns empty rows so UI doesn't crash.
  async $queryRawUnsafe<T = unknown>(_sql: string, ..._params: unknown[]): Promise<T[]> {
    void _sql; void _params;
    return [];
  },
};

export default prisma;





