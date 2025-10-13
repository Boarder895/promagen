import express from "express";
import cors from "cors";
import { makeAuditRouter } from "./routes/audit";
import { simulate } from "./routes/simulate";
import { JobStore } from "./jobs/store";
import { makeJobsRouter } from "./routes/jobs";
import { makeGenerateRouter } from "./routes/generate";
import { providersRoute } from "./routes/providers";
import { makeJobsAdminRouter } from "./routes/jobs_admin"; // <-- add

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
app.get("/api/v1/meta", (_req, res) =>
  res.status(200).json({
    schema: process.env.PRISMA_SCHEMA || "prisma/schema.sqlite.prisma",
    dbProvider: "sqlite",
    env: process.env.NODE_ENV || "development",
    node: process.version,
    hmac: true,
    generatedAt: new Date().toISOString(),
    latestAudit: {
      reviewRef: process.env.REVIEW_REF ?? "@postbox:koloboy7a",
      generatedAt: new Date().toISOString(),
      reviewer: "seed",
      period: "demo",
      base: "?",
      hashOk: true,
    },
  })
);

app.use("/api/v1/audit", makeAuditRouter(() => ({ ok: true } as any)));
app.use("/api/v1/simulate", simulate);

const jobs = new JobStore();
app.use("/api/v1/jobs", makeJobsRouter(jobs));
app.use("/api/v1/generate", makeGenerateRouter(jobs));
app.use("/api/v1/providers", providersRoute);
app.use("/api/v1/jobs-admin", makeJobsAdminRouter(jobs)); // <-- add

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, "0.0.0.0", () => console.log(`[api] listening on http://0.0.0.0:${PORT}`));
export default app;


