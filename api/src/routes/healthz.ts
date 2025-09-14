// src/routes/healthz.ts — COMPLETE
import type { Request, Response } from "express";
import dns from "dns/promises";

type CheckResult = {
  name: string;
  ok: boolean;
  latencyMs?: number;
  statusCode?: number;
  info?: string;
  error?: string;
};

async function httpHead(url: string, timeoutMs = 2500): Promise<CheckResult> {
  const start = performance.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(t);
    return {
      name: `http:${url}`,
      ok: res.ok || res.status === 401 || res.status === 403, // 401/403 is fine for reachability
      statusCode: res.status,
      latencyMs: Math.round(performance.now() - start),
      info: `status=${res.status}`,
    };
  } catch (e: any) {
    clearTimeout(t);
    return {
      name: `http:${url}`,
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: e?.name === "AbortError" ? "timeout" : String(e),
    };
  }
}

async function dnsLookup(host: string): Promise<CheckResult> {
  const start = performance.now();
  try {
    const a = await dns.lookup(host, { family: 0, all: false });
    return {
      name: `dns:${host}`,
      ok: Boolean(a?.address),
      latencyMs: Math.round(performance.now() - start),
      info: `${a.address} (fam ${a.family})`,
    };
  } catch (e: any) {
    return {
      name: `dns:${host}`,
      ok: false,
      error: String(e),
      latencyMs: Math.round(performance.now() - start),
    };
  }
}

function requiredEnv(keys: string[]) {
  const missing = keys.filter((k) => !process.env[k] || process.env[k] === "");
  return { ok: missing.length === 0, missing };
}

// Main handler: GET /healthz/deep
export default async function deepHealth(_req: Request, res: Response) {
  const started = Date.now();

  // Add/adjust checks as you wire more dependencies
  const checks = await Promise.all([
    dnsLookup("api.openai.com"),
    httpHead("https://api.openai.com/v1/models", 2500), // reachability w/o auth
  ]);

  const env = requiredEnv(["COOKIE_SECRET"]); // extend if you add more required vars

  const slow = checks.filter((c) => (c.latencyMs ?? 0) > 1200);
  const failed = checks.filter((c) => !c.ok);

  let status: "ok" | "degraded" | "down" = "ok";
  if (!env.ok || failed.length > 0) status = "down";
  else if (slow.length > 0) status = "degraded";

  const body = {
    service: "promagen-api",
    status,
    now: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    node: process.version,
    env: { ok: env.ok, missing: env.missing },
    checks,
    totalMs: Date.now() - started,
  };

  res.status(status === "down" ? 503 : 200).json(body);
}
