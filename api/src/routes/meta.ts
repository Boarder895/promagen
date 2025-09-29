import { Router } from 'express';
import pkg from '../../package.json' assert { type: 'json' };
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// Simple health/version pings
router.get('/health', (_req, res) => res.json({ ok: true }));
router.get('/version', (_req, res) => {
  res.json({
    name: pkg.name,
    version: pkg.version,
    node: process.version,
    env: process.env.NODE_ENV || 'dev',
  });
});

// Rich meta for the admin settings page
router.get('/api/v1/meta', async (_req, res) => {
  const schema = process.env.PRISMA_SCHEMA ?? './prisma/schema.sqlite.prisma';
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  const hmacEnabled = !!(process.env.AUDIT_HMAC_SECRET && process.env.AUDIT_HMAC_SECRET.trim().length >= 32);

  // crude provider hint
  let dbProvider: 'sqlite' | 'postgres' | 'unknown' = 'unknown';
  if (dbUrl.startsWith('file:')) dbProvider = 'sqlite';
  else if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) dbProvider = 'postgres';

  // peek latest audit row
  let latest: null | {
    id: string;
    generatedAt: string;
    reviewer: string | null;
    period: string | null;
    base: number | null;
    hasSha: boolean;
    hasHmac: boolean;
  } = null;

  try {
    const row = await prisma.leaderboardAudit.findFirst({
      orderBy: { generatedAt: 'desc' },
      select: { id: true, generatedAt: true, reviewer: true, period: true, base: true, signature: true, hmacSignature: true },
    });
    if (row) {
      latest = {
        id: row.id,
        generatedAt: row.generatedAt.toISOString(),
        reviewer: row.reviewer,
        period: row.period,
        base: row.base ?? null,
        hasSha: !!row.signature,
        hasHmac: !!row.hmacSignature,
      };
    }
  } catch (e) {
    // swallow; empty DB is fine
  }

  res.json({
    ok: true,
    meta: {
      hmacEnabled,
      schema,
      dbProvider,
      node: process.version,
      env: process.env.NODE_ENV || 'dev',
    },
    latestAudit: latest,
  });
});

export default router;
