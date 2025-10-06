import { type Express } from "express";
import { z } from "zod";
import { prisma } from "../db";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  area: z.string().optional(),
  priority: z.enum(["low","medium","high"]).default("medium"),
  labels: z.array(z.string()).optional(),
  links: z.array(z.object({ label: z.string(), url: z.string().url() })).optional()
});

const updateStatusSchema = z.object({
  status: z.enum(["todo","doing","blocked","done"])
});

async function nextShortId(): Promise<number> {
  const agg = await prisma.task.aggregate({ _max: { shortId: true } });
  return (agg._max.shortId ?? 0) + 1;
}

export const registerTaskRoutes = (app: Express) => {
  app.get("/api/v1/tasks", async (_req, res) => {
    const tasks = await prisma.task.findMany({ orderBy: [{ createdAt: "desc" }] });
    res.json({ tasks });
  });

  app.post("/api/v1/tasks", async (req, res) => {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const sid = await nextShortId();
    const { title, description, area, priority, labels, links } = parsed.data;

    const task = await prisma.task.create({
      data: {
        shortId: sid,
        title,
        description,
        area,
        priority, // stored as String in SQLite
        labels: labels ? JSON.stringify(labels) : null,
        links: links ? JSON.stringify(links) : null
      }
    });

    res.status(201).json({ task });
  });

  app.patch("/api/v1/tasks/:id/status", async (req, res) => {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status }
    });
    res.json({ task });
  });
};
