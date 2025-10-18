export type PrismaLike = {
  $queryRawUnsafe?<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]>;
};

const prisma: PrismaLike = {
  async $queryRawUnsafe<T = unknown>(_sql: string, ..._params: unknown[]): Promise<T[]> {
    void _sql; void _params;
    return [];
  },
};

export default prisma;


