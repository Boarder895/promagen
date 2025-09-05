import express from "express";
import cors from "cors";
import helmet from "helmet";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.PORT || 4000);

// middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// health
app.get("/health", (_req, res) => res.json({ ok: true }));

// list platforms
app.get("/platforms", async (_req, res, next) => {
  try {
    const rows = await prisma.platform.findMany({ orderBy: { id: "asc" } });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// create (or noop if name exists)
const createSchema = z.object({ name: z.string().min(1).max(100) });
app.post("/platforms", async (req, res, next) => {
  try {
    const { name } = createSchema.parse(req.body);
    const row = await prisma.platform.upsert({
      where: { name },
      create: { name },
      update: {}, // idempotent create
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// delete by id
app.delete("/platforms/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
    await prisma.platform.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// central error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof err?.status === "number" ? err.status : 500;
  const message =
    err?.issues?.[0]?.message || // zod
    err?.message ||
    "Internal Server Error";
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
