// src/data/providers.schema.ts
import { z } from "zod";

export const TrendSchema = z.enum(["up", "down", "flat"]);

export const ProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),

  // URLs
  website: z.string().url(),
  affiliateUrl: z.string().url().nullable().optional(),

  // Disclosures & copy help
  requiresDisclosure: z.boolean().default(false),
  tip: z.string().min(1).optional(),
  supportsPrefill: z.boolean().default(false),

  // Display/meta
  tagline: z.string().min(1),

  // Leaderboard data
  score: z.number().int().min(0).max(100),
  trend: TrendSchema,
});

export type Provider = z.infer<typeof ProviderSchema>;

export const ProvidersArraySchema = z
  .array(ProviderSchema)
  // extra guard: duplicate IDs not allowed
  .superRefine((arr, ctx) => {
    const seen = new Set<string>();
    for (const p of arr) {
      if (seen.has(p.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate provider id: ${p.id}`,
        });
      }
      seen.add(p.id);
    }
  });




