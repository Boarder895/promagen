import { z } from 'zod';

export const FxPairSchema = z.object({
  id: z.string().min(3),
  base: z.string().min(3),
  quote: z.string().min(3),
  label: z.string().min(3),
  precision: z.number().int().min(0).max(10).optional(),
  demo: z
    .object({
      value: z.number(),
      prevClose: z.number(),
    })
    .optional(),
});
export type FxPairDTO = z.infer<typeof FxPairSchema>;

export const ProviderSchema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  country: z.string().length(2).optional(),
  score: z.number().min(0).max(100).optional(),
  trend: z.enum(['up', 'down', 'flat']).optional(),
  tags: z.array(z.string()).optional(),
  url: z.string().url().optional(),
});
export type ProviderDTO = z.infer<typeof ProviderSchema>;

export const ExchangeSchema = z.object({
  id: z.string().min(2),
  exchange: z.string().min(2),
  city: z.string().min(2),
  iso2: z.string().length(2),
  tz: z.string().min(3),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  hoursTemplate: z.string().nullable().optional(),
  workdays: z.string().nullable().optional(),
  holidaysRef: z.string().nullable().optional(),
  exceptions: z
    .array(
      z.object({
        date: z.string().min(8),
        isOpen: z.boolean(),
        note: z.string().optional(),
      }),
    )
    .optional(),
});
export type ExchangeDTO = z.infer<typeof ExchangeSchema>;
