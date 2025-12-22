// src/types/providers.ts

export type Provider = {
  id: string;
  name: string;

  country?: string;

  /**
   * Canonical provider website URL (SSOT uses `website` in providers.json).
   */
  website?: string;

  /**
   * Legacy / UI alias for website. Prefer `website` in data, but keep this
   * for backwards compatibility across components.
   */
  url?: string;

  /**
   * Affiliate destination URL, if configured for this provider.
   * If present, /go should prefer this over the plain website.
   */
  affiliateUrl?: string | null;

  /**
   * Whether the provider requires affiliate disclosure in the UI.
   */
  requiresDisclosure?: boolean;

  /**
   * Short marketing copy shown in Provider Detail.
   */
  tagline?: string;

  /**
   * Helpful tip shown in Provider Detail.
   */
  tip?: string;

  score?: number;
  trend?: 'up' | 'down' | 'flat';
  tags?: string[];

  /**
   * Provider capability hint for the UI.
   */
  supportsPrefill?: boolean;

  group?: string;
  tier?: string;
};
