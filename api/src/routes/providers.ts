import { Router } from 'express';
import prisma from '../db/prisma';
import { PROVIDERS } from '../providers/registry';
import { runALLChecksCached } from '../services/health';
import { getCache, setCache } from '../services/cache';

const router = Router();

// GET /api/providers
router.get('/', async (_req, res) => {
  try {
    // small cache to avoid hammering DB
    const cacheKey = 'providers:list:v1';
    const cached = getCache<any[]>(cacheKey);
    if (cached) return res.json(cached);

    // Fetch overrides if table exists (keep guard for resilience)
    let overrides: any[] = [];
    try {
      overrides = await prisma.providerOverride.findMany();
    } catch {
      overrides = [];
    }

    const byId = new Map(overrides.map((o: any) => [o.providerId, o]));
    const merged = PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      override: byId.get(p.id) || null,
    }));

    setCache(cacheKey, merged, 60_000);
    return res.json(merged);
  } catch (err) {
    console.error('[providers] unexpected error', err);
    return res.status(500).json({ ok: false });
  }
});

// Optional: light status with health summary joined in
router.get('/status', async (_req, res) => {
  const health = await runALLChecksCached();
  res.json({ ok: true, count: PROVIDERS.length, health });
});

export default router;
