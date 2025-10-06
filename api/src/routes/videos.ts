import { type Express } from "express";
import { z } from "zod";
import { prisma } from "../db";

const videoSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  note: z.string().optional(),
  audience: z.enum(["users", "devs", "both"]).default("users"),
});

export const registerVideoRoutes = (app: Express) => {
  // Public list for Users’ Book
  app.get("/api/v1/public/videos", async (_req, res) => {
    const videos = await prisma.video.findMany({ orderBy: { title: "asc" } });
    res.json({ videos });
  });

  // Admin add (simple for now)
  app.post("/api/v1/videos", async (req, res) => {
    const parsed = videoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const video = await prisma.video.create({ data: parsed.data });
    res.status(201).json({ video });
  });
};
