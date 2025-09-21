import type { RequestHandler } from "express";
import pino from "pino";

/**
 * Safe transport builder for Better Stack (Logtail).
 * - If LOGTAIL_SOURCE_TOKEN is missing OR pino.transport doesn't exist,
 *   we fall back to stdout so the app never crashes.
 */
function makeTransport() {
  const sourceToken = process.env.LOGTAIL_SOURCE_TOKEN;
  if (!sourceToken) return undefined;

  const hasTransport = typeof (pino as any).transport === "function";
  if (!hasTransport) return undefined;

  const endpoint = process.env.LOGTAIL_INGEST_HOST; // optional (from Source page: "Ingesting host")

  try {
    return (pino as any).transport({
      target: "@logtail/pino",
      options: {
        sourceToken,
        ...(endpoint ? { endpoint } : {}),
      },
    });
  } catch {
    // If transport target fails to load at runtime, just skip it.
    return undefined;
  }
}

const transport = makeTransport();

const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    base: {
      service: "promagen-api",
      env: process.env.NODE_ENV ?? "production",
      region: process.env.FLY_REGION,
    },
    redact: ["authorization", "password", "token", "cookies", "x-api-key"],
  },
  transport as any // undefined -> stdout; defined -> Logtail transport
);

// Lightweight request logger (avoids pino-http typing fuss)
export const httpLogger: RequestHandler = (req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, "request");
  next();
};

export default logger;


