// BACKEND • API
// File: api/src/middleware/rateLimit.ts
import type { Request, Response, NextFunction } from "express";

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

export type RateLimitOpts = {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;   // default: ip
  headerPrefix?: string;            // default: X-RateLimit-
};

export function rateLimit(opts: RateLimitOpts) {
  const windowMs = Math.max(1000, opts.windowMs);
  const max = Math.max(1, opts.max);
  const keyFn = opts.key ?? ((req) => req.ip ?? "anonymous");
  const H = (opts.headerPrefix ?? "X-RateLimit-").replace(/[^A-Za-z-]/g, "");

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const now = Date.now();
    const b = store.get(key) ?? { count: 0, resetAt: now + windowMs };

    if (now >= b.resetAt) {
      b.count = 0;
      b.resetAt = now + windowMs;
    }

    b.count += 1;
    store.set(key, b);

    res.setHeader(`${H}Limit`, String(max));
    res.setHeader(`${H}Remaining`, String(Math.max(0, max - b.count)));
    res.setHeader(`${H}Reset`, String(Math.floor(b.resetAt / 1000)));

    if (b.count > max) {
      return res.status(429).json({
        ok: false,
        error: "RATE_LIMITED",
        message: `Too many requests; try again after ${Math.ceil((b.resetAt - now)/1000)}s`,
        requestId: (req as any).requestId,
      });
    }
    next();
  };
}

