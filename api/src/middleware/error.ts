/**
 * Minimal error handler middleware with zero external dependencies.
 * Keep it generic to avoid circular logger imports.
 */
import type { Request, Response, NextFunction } from "express";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = typeof err?.status === "number" ? err.status : 500;
  const msg = (err && (err.message || err.toString())) || "Internal Server Error";

  // Log to stdout; swap for a central logger later if desired.
  // eslint-disable-next-line no-console
  console.error("[error]", { status, msg, stack: err?.stack });

  res.status(status).json({ error: status === 500 ? "Internal Server Error" : msg });
}
