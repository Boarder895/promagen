import type { Request, Response } from 'express';
import { z } from 'zod';
import { getProvidersLive } from '../lib/state';

const ProviderArray = z.array(z.object({
  id: z.string(), name: z.string(), logoUrl: z.string(), blurb: z.string(), siteUrl: z.string(),
  hasAffiliate: z.boolean(), affiliateUrl: z.string().nullable(),
  scores: z.array(z.object({ criterion: z.string(), raw_0_100: z.number(), weight: z.number() })),
  total_weighted: z.number(), delta_24h: z.number(), sparkline_24h: z.array(z.number()), updatedAt: z.string()
}));

export const getProvidersRoute = (_req: Request, res: Response) => {
  const data = getProvidersLive();
  const ok = ProviderArray.safeParse(data);
  if (!ok.success) return res.status(500).json({ error: 'validation_failed', issues: ok.error.issues });
  res.json(ok.data);
};
