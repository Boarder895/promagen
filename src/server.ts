// ──────────────────────────────────────────────────────────────
// src/server.ts — secure API + 20-provider registry
// ──────────────────────────────────────────────────────────────
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";

// Routes
import health from "./routes/health";
import openaiRoutes from "./routes/openai";
import models from "./routes/models";
import cronRoute from "./routes/cron/import";
import platforms from "./routes/platforms";   // ⬅ added

// ── Env guard ─────────────────────────────────────────────────
const MUST = ["DATABASE_URL", "COOKIE_SECRET"] as const;
for (const k of MUST) {
  if (!process.env[k]) {
    console.error(`❌ Missing ${k}`);
    process.exit(1);
  }
}

// ── App + DB ──────────────────────────────────────────────────
const app = express();
const prisma = new PrismaClient();

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

// security
app.use(helmet());
app.use(cors());
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ── Routes ────────────────────────────────────────────────────
app.use("/api", health);
app.use("/api", openaiRoutes);
app.use("/api", models);
app.use("/api", cronRoute);
app.use("/api", platforms);   // ⬅ added

// ── Listener ─────────────────────────────────────────────────
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`✅ API listening on http://localhost:${port}`);
});

