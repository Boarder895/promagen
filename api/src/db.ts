// BACKEND · Prisma singleton (NEW) · named exports only

import { PrismaClient } from "@prisma/client";

let prismaGlobal: PrismaClient;

export const prisma =
  (global as any).__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  (global as any).__prisma = prisma;
}

