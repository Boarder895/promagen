import type { Request, Response } from 'express';
import { z } from 'zod';
import { getMarketsLive } from '../lib/state';

const MarketArray = z.array(z.object({
  id: z.string(), displayName: z.string(), timeZone: z.string(), indexSymbol: z.string(),
  last: z.number(), delta_points: z.number(), delta_pct: z.number(),
  sparkline_session: z.array(z.number()), updatedAt: z.string()
}));

export const getMarketsRoute = (_req: Request, res: Response) => {
  const data = getMarketsLive();
  const ok = MarketArray.safeParse(data);
  if (!ok.success) return res.status(500).json({ error: 'validation_failed', issues: ok.error.issues });
  res.json(ok.data);
};

