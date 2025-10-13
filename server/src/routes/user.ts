import { Router } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const r = Router();

const Body = z.object({
  preferredProviders: z.array(z.string()).max(32)
});

r.get("/me/preferences", async (req, res) => {
  const userId = req.user.id; // from your auth middleware
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferredProviders: true }});
  res.json(user ?? { preferredProviders: [] });
});

r.put("/me/preferences", async (req, res) => {
  const userId = req.user.id;
  const body = Body.parse(req.body);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { preferredProviders: body.preferredProviders }
  });
  res.json({ preferredProviders: user.preferredProviders });
});

export default r;
