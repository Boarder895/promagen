// server/src/server.ts
import "dotenv/config";                   // loads .env (DATABASE_URL, etc.)
import express from "express";
import cors from "cors";
import morgan from "morgan";

import "./domain/assertProvidersCount";   // ✅ ensures we still have 20 providers

// --- routes you already have / will add ---
import userRoutes from "./routes/user";   // GET/PUT /me/preferences, etc.
// If you created a public providers endpoint:
import publicRoutes from "./routes/public"; // GET /providers (no auth)

// --- auth middleware (your existing one) ---
import { authMiddleware } from "./middleware/auth"; // adjust path if different

const app = express();

// ---- core middleware order ----
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// ---- health checks ----
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/", (_req, res) => res.send("Promagen API running"));

// ---- route mounts ----
// User/account routes (needs auth)
app.use("/api/user", authMiddleware, userRoutes);

// Public marketing-safe routes (no auth)
app.use("/api/public", publicRoutes);

// (optional) version route to verify I23RF is present in your source-of-truth
import { PROVIDERS } from "./domain/providers";
app.get("/api/debug/providers", (_req, res) => {
  res.json({ count: PROVIDERS.length, providers: PROVIDERS });
});

// ---- error handler ----
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`Promagen API listening on http://localhost:${PORT}`);
});
