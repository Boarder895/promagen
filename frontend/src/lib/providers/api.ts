import { z } from "zod";
import type { Provider } from "@/types/provider";
import raw from "@/data/providers.json"; // ensure resolveJsonModule true in tsconfig

const ProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
  trend: z.enum(["up", "down", "flat"]).optional(),
  tags: z.array(z.string()).optional(),
  url: z.string().url().optional(),
});

const ProvidersSchema = z.array(ProviderSchema);

export type ProvidersApiResponse = ReadonlyArray<Provider>;

/** Load and (optionally) slice validated providers. */
export function getProviders(limit?: number): ProvidersApiResponse {
  const parsed = ProvidersSchema.parse(raw) as ReadonlyArray<Provider>;
  return typeof limit === "number" && limit > 0 ? parsed.slice(0, limit) : parsed;
}
