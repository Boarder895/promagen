// src/routes/admin.ts
import { Router } from "express";
import { z } from "zod";
import { PrismaClient, BillingMode } from "@prisma/client";
import { adminAuth } from "../middleware/adminAuth";

const prisma = new PrismaClient();
const r = Router();

r.use(adminAuth);

// Top up or deduct credits (delta can be negative; final balance floors at 0)
r.post("/credits/topup", async (req, res) => {
  const Body = z.object({
    userId: z.string(),
    delta: z.number().int(),
  });
  const parse = Body.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ ok: false, error: parse.error.flatten() });

  const { userId, delta } = parse.data;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });

  const newBalance = Math.max(0, (user.creditBalance ?? 0) + delta);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { creditBalance: newBalance },
    select: { id: true, creditBalance: true, email: true, billingMode: true },
  });

  return res.json({ ok: true, user: updated });
});

// Switch a user's billing mode (BYOK <-> HOUSE)
r.post("/billing/mode", async (req, res) => {
  const Body = z.object({
    userId: z.string(),
    mode: z.nativeEnum(BillingMode), // "BYOK" | "HOUSE"
  });
  const parse = Body.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ ok: false, error: parse.error.flatten() });

  const { userId, mode } = parse.data;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { billingMode: mode },
    select: { id: true, billingMode: true, creditBalance: true, email: true },
  });

  return res.json({ ok: true, user: updated });
});

// Quick user balance
r.get("/users/:userId/balance", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: { id: true, creditBalance: true, billingMode: true, email: true },
  });
  if (!user) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
  return res.json({ ok: true, user });
});

// Recent usage (last 100)
r.get("/users/:userId/usage", async (req, res) => {
  const rows = await prisma.usage.findMany({
    where: { userId: req.params.userId },
    orderBy: { date: "desc" },
    take: 100,
  });
  return res.json({ ok: true, usage: rows });
});

export default r;
