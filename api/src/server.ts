// BACKEND · EXPRESS
// File: C:\Users\Martin Yarnold\Projects\promagen\api\src\server.ts

import express from "express";
import cors from "cors";
import { providersRouter } from "./routes/providers";

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Infra endpoints stay at root
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

// Versioned API root per project rule
app.use("/api/v1", providersRouter);

// Bind to 0.0.0.0 and PORT 3001 (project standard)
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[api] listening on http://0.0.0.0:${PORT}`);
});
