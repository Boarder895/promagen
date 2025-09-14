// src/routes/version.ts
import type { Request, Response } from "express";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pkg = require("../../package.json");

const first = (...v: (string | undefined)[]) => v.find(Boolean) ?? "unknown";

/** GET /version — build/ops metadata */
export default function versionRoute(_req: Request, res: Response) {
  res.json({
    service: "promagen-api",
    version: pkg.version ?? "0.0.0",
    commit: first(
      process.env.BUILD_SHA,
      process.env.GIT_COMMIT_SHA,
      process.env.VERCEL_GIT_COMMIT_SHA,
      process.env.FLY_IMAGE_REF
    ),
    buildTime: first(process.env.BUILD_TIME),
    node: process.version,
    env: process.env.NODE_ENV ?? "development",
    allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
  });
}
