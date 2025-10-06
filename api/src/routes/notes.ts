import { type Express } from "express";
import { z } from "zod";
import { prisma } from "../db"; // <-- correct

const noteSchema = z.object({
  headline: z.string().min(3),
  body: z.string().min(3),
  severity: z.enum(["info","success","warning","error"]).default("info"),
  link: z.string().url().optional()
});

export const registerNoteRoutes = (app: Express) => {
  app.get("/api/v1/public/notes", async (_req, res) => {
    const notes = await prisma.publicNote.findMany({
      where: { visible: true, approved: true },
      orderBy: { updatedAt: "desc" },
      take: 50
    });
    res.json({ notes });
  });

  app.post("/api/v1/notes", async (req, res) => {
    const parsed = noteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const note = await prisma.publicNote.create({ data: parsed.data });
    res.status(201).json({ note });
  });

  app.post("/api/v1/notes/:id/approve", async (req, res) => {
    const note = await prisma.publicNote.update({
      where: { id: req.params.id },
      data: { approved: true, visible: true }
    });
    res.json({ note });
  });
};
