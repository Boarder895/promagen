export type Trend = 'up' | 'down' | 'flat';

export type Provider = {
  id: string;
  name: string;
  country?: string;
  score?: number;
  trend?: Trend;
  tags?: string[];
  url?: string;
  affiliateUrl?: string | null;
  requiresDisclosure?: boolean;
  tagline?: string;
  category?: string;
  emoji?: string;
};
