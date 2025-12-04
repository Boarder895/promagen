import { z } from 'zod';

export const RoleKindEnum = z.enum([
  'fx',
  'commodities',
  'crypto',
  'equities',
  'weather',
  'time',
  'holidays',
  'meta',
  // Extended kinds for market-state roles
  'market-hours',
  'market-holidays',
]);

export const LiveVsBackgroundEnum = z.enum(['live', 'background', 'ad-hoc']);

export const RoleSchema = z
  .object({
    role: z.string().min(1),
    kind: RoleKindEnum,

    // High-level grouping and classification – optional metadata.
    group: z.string().min(1).optional(),
    role_class: z.string().min(1).optional(),

    // Whether this role is actively used in the current config.
    enabled: z.boolean().optional(),

    // Core description fields.
    description: z.string().min(1),
    friendly_description: z.string().min(1).optional(),

    typical_cadence: z.string().min(1).optional(),
    live_vs_background: LiveVsBackgroundEnum.optional(),

    // Free-form notes from the API brain docs.
    notes: z.string().optional(),
  })
  // Allow additional metadata keys in the JSON catalogue without failing
  // validation – tests only care about the core fields above.
  .passthrough();

export const RolesCatalogSchema = z.object({
  version: z.literal(1),
  roles: z.array(RoleSchema).min(1, 'roles catalogue must contain at least one role'),
});

export type RoleKind = z.infer<typeof RoleKindEnum>;
export type LiveVsBackground = z.infer<typeof LiveVsBackgroundEnum>;
export type Role = z.infer<typeof RoleSchema>;
export type RolesCatalog = z.infer<typeof RolesCatalogSchema>;

// Convenience aliases for existing imports in tests.
export const rolesCatalogSchema = RolesCatalogSchema;
export type RoleDefinition = Role;
