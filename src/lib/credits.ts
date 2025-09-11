// src/lib/credits.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export type CreditContext = {
  userId: string;
  provider: string;
  estimatedCost: number;
};

export async function canProceed(ctx: CreditContext) {
  const user = await prisma.user.findUnique({ where: { id: ctx.userId } });
  if (!user) return { ok: false as const, reason: "USER_NOT_FOUND" as const };

  if (user.billingMode === "BYOK") {
    return { ok: true as const, mode: "BYOK" as const, balance: Number.POSITIVE_INFINITY };
  }

  if (user.creditBalance >= ctx.estimatedCost) {
    return { ok: true as const, mode: "HOUSE" as const, balance: user.creditBalance };
  }

  return { ok: false as const, reason: "INSUFFICIENT_CREDITS" as const, balance: user.creditBalance };
}

// Records usage in all modes; deducts only for HOUSE.
export async function deductCredits(ctx: CreditContext) {
  const user = await prisma.user.findUnique({ where: { id: ctx.userId } });
  if (!user) throw new Error("USER_NOT_FOUND");

  await prisma.usage.create({
    data: {
      userId: ctx.userId,
      provider: ctx.provider,
      cost: ctx.estimatedCost,
      notes: "auto",
    },
  });

  if (user.billingMode === "BYOK") {
    return { mode: "BYOK" as const, balance: Number.POSITIVE_INFINITY };
  }

  const newBalance = Math.max(0, user.creditBalance - ctx.estimatedCost);
  await prisma.user.update({
    where: { id: ctx.userId },
    data: { creditBalance: newBalance },
  });

  return { mode: "HOUSE" as const, balance: newBalance };
}
