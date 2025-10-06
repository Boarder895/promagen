import { type Express } from "express";
import { prisma } from "../db";

export const registerHistoryRoutes = (app: Express) => {
  app.get("/api/v1/history", async (_req, res) => {
    const events = await prisma.event.findMany({
      orderBy: { occurredAt: "desc" },
      take: 100,
    });
    res.json({ events });
  });
};
