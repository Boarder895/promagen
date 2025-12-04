// frontend/src/lib/api/api.endpoints.catalog.schema.ts

import { z } from 'zod';
import { RoleKindEnum } from './api.roles.catalog.schema';

/**
 * Coarse usage grouping for endpoints.
 * This is intentionally small and UI-leaning.
 */
export const endpointGroupEnum = z.enum(['ribbon', 'mini_widget', 'detail', 'meta', 'chart']);

export type EndpointGroup = z.infer<typeof endpointGroupEnum>;

/**
 * Structural shape of the data returned by an endpoint.
 * This is used by tests and quota planning to understand cost vs cadence.
 */
export const dataShapeEnum = z.enum([
  'single_quote',
  'batch_quote',
  'eod_chart',
  'catalog',
  'market_hours',
  'market_holidays',
]);

export type DataShape = z.infer<typeof dataShapeEnum>;

const httpSchema = z.object({
  method: z.enum(['GET', 'POST']),
  path: z.string().min(1),
  // Query parameters are kept flexible – we just require a key→value map.
  query: z.record(z.string(), z.unknown()),
});

/**
 * Single endpoint definition.
 */
export const endpointSchema = z.object({
  id: z.string().min(1),
  provider_id: z.string().min(1),

  // Asset class – FX / commodities / crypto / etc.
  kind: RoleKindEnum,

  // Coarse grouping – ribbon, detail, meta, etc.
  group: endpointGroupEnum,

  // Logical role that this endpoint serves (FK into api.roles.catalog.json).
  role: z.string().min(1),

  description: z.string().min(1),

  http: httpSchema,

  response_shape: z.string().min(1),

  data_shape: dataShapeEnum,

  // Optional fields for later phases (quota, cadence, status, tags).
  quota_block_id: z.string().min(1).optional(),
  quota_cost: z.number().int().min(0).optional(),
  tags: z.array(z.string().min(1)).optional(),
  status: z.enum(['active', 'paused', 'candidate']).optional(),
  default_update: z
    .object({
      cadence: z.string().min(1),
      only_when_open: z.boolean(),
      jitter_seconds: z.number().int().min(0),
    })
    .optional(),
});

export type EndpointDefinition = z.infer<typeof endpointSchema>;

export const endpointsCatalogSchema = z.object({
  version: z.number().int().min(1),
  endpoints: z.array(endpointSchema),
});

export type EndpointsCatalog = z.infer<typeof endpointsCatalogSchema>;
