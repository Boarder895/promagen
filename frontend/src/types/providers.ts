// C:\Users\Proma\Projects\promagen\frontend\src\types\providers.ts

export type ProviderTrend = 'up' | 'down' | 'flat';

export type ProviderGenerationSpeed = 'fast' | 'medium' | 'slow' | 'varies';

export type Provider = {
  id: string;
  name: string;
  country?: string;

  score?: number;
  trend?: ProviderTrend;
  tags?: string[];

  // SSOT in providers.json is `website`; UI may also use `url` as a normalised alias.
  url?: string;
  website: string;

  // Affiliate / disclosure
  affiliateUrl: string | null;
  requiresDisclosure: boolean;

  // Short marketing copy
  tagline?: string;
  tip?: string;

  // Leaderboard enrichment fields (UI contract – optional until populated)
  icon?: string;
  sweetSpot?: string;
  visualStyles?: string;
  apiAvailable?: boolean;
  affiliateProgramme?: boolean;
  generationSpeed?: ProviderGenerationSpeed;
  affordability?: string;

  // Prompt builder UX
  supportsPrefill?: boolean;

  // Future categorisation (optional)
  group?: string;
  tier?: string;
};
