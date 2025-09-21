import express from "express";
import cors from "cors";

// --- App setup
const app = express();
app.use(cors());
app.use(express.json());

// --- Meta/version
const startedAt = new Date();
const VERSION = process.env.BUILD_VERSION || process.env.COMMIT_SHA || "dev";

// --- Routes
app.get("/", (_req, res) => {
  res.status(200).send({
    name: "promagen-api",
    ok: true,
    version: VERSION,
    msg: "Hello from Promagen API",
  });
});

// Health endpoint used by Fly checks and external uptime pings.
// Keep this ultra-cheap: no DB, no external calls.
app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

// Status endpoint for humans/dashboards. Light DB wiring can be added later.
app.get("/status", async (_req, res) => {
  const now = new Date();
  const uptimeMs = now.getTime() - startedAt.getTime();
  res.status(200).send({
    status: "ok",
    version: VERSION,
    startedAt: startedAt.toISOString(),
    now: now.toISOString(),
    uptimeMs,
    // db: "skipped", // wire Prisma pinimport express from "express";
import cors from "cors";

// --- App setup
const app = express();
app.use(cors());
app.use(express.json());

// --- Meta/version
const startedAt = new Date();
const VERSION = process.env.BUILD_VERSION || process.env.COMMIT_SHA || "dev";

// --- Routes
app.get("/", (_req, res) => {
  res.status(200).send({
    name: "promagen-api",
    ok: true,
    version: VERSION,
    msg: "Hello from Promagen API",
  });
});

// Health endpoint used by Fly checks and external uptime pings.
// Keep this ultra-cheap: no DB, no external calls.
app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

// Status endpoint for humans/dashboards. Light DB wiring can be added later.
app.get("/status", async (_req, res) => {
  const now = new Date();
  const uptimeMs = now.getTime() - startedAt.getTime();
  res.status(200).send({
    status: "ok",
    version: VERSION,
    startedAt: startedAt.toISOString(),
    now: now.toISOString(),
    uptimeMs,
    // db: "skipped", // wire Prisma ping here later if you want
  });
});

// --- Bind
const PORT = Number(process.env.PORT) || 8080;

// IMPORTANT for Fly: listen on ALL interfaces
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[promagen-api] listening on 0.0.0.0:${PORT} (version=${VERSION})`);
});








