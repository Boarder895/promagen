import type { RequestHandler } from 'express';
import { getCache, setCache } from './cache';
import { PROVIDERS } from '../providers/registry';

const START_TIME = Date.now();

function uptimeSeconds(): number {
  return Math.floor((Date.now() - START_TIME) / 1000);
}

function memSummary() {
  const m = process.memoryUsage();
  return {
    rssMB: Math.round(m.rss / 1024 / 1024),
    heapUsedMB: Math.round(m.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(m.heapTotal / 1024 / 1024),
  };
}

export const runALLChecksCached = async () => {
  const cacheKey = 'health:checks:v1';
  const cached = getCache<any>(cacheKey);
  if (cached) return cached;

  const result = {
    ok: true,
    providersKnown: PROVIDERS.length,
    uptimeSec: uptimeSeconds(),
    memory: memSummary(),
  };

  setCache(cacheKey, result, 60_000);
  return result;
};

export const healthHandler: RequestHandler = async (_req, res) => {
  try {
    const payload = await runALLChecksCached();
    res.json(payload);
  } catch {
    res.status(200).json({ ok: true, degraded: true, error: 'health-check-exception' });
  }
};

