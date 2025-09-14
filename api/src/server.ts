// ──────────────────────────────────────────────────────────────
// src/server.ts — COMPLETE (adds /healthz/deep)
// ──────────────────────────────────────────────────────────────
import "dotenv/config";
import express, { type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

// ESM + NodeNext: include .js in relative imports
import openaiRoutes from "./routes/openai.js";
import versionRoute from "./routes/version.js";
import deepHealth from "./routes/healthz.js";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

// Security / logging
app.use(helmet());
app.use(morgan("tiny"));
app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = (process.env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!origin || allowed.includes(origin)) cb(null, true);
      else cb(new Error("CORS blocked"));
    },
    credentials: true,
  })
);
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

// Routes
app.use("/api/ai/openai", openaiRoutes);
app.get("/version", versionRoute);
app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});
app.get("/healthz/deep", deepHealth);

// Start
const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`🚀 API listening on http://localhost:${port}`);
});
