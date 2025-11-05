// src/lib/db.d.ts
export type PrismaLike = {
  $queryRawUnsafe?<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]>;
};

declare const prisma: PrismaLike;
export default prisma;








