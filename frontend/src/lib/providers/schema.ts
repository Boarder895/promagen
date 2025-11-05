import { z } from "zod";

export const providerSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string().default(""),
  website: z.string().min(1).optional(),
  url: z.string().min(1),
  affiliateUrl: z.string().url().nullable().default(null),
  requiresDisclosure: z.boolean().default(false),
  score: z.number().default(0),
  trend: z.string().default(""),
  tip: z.string().default(""),
  supportsPrefill: z.boolean().default(false)
});
export type Provider = z.infer<typeof providerSchema>;
/** Minimal deep link param contract used by deeplinks.ts (Stage-1/2). */
export type DeepLinkParams = {
  prompt?: string;
  negative?: string;
  seed?: string | number;
  steps?: number;
  size?: string;
  [key: string]: unknown;
};



