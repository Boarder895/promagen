export type Trend = 'up' | 'down' | 'flat';

export interface Provider {
  id: string;
  name: string;
  url: string;
  affiliateUrl: string | null;
  requiresDisclosure: boolean;
  tagline: string;
  score: number;        // base score (from data/providers.json)
  trend: Trend;         // base trend (from data/providers.json)
}

export interface ProviderRuntime extends Provider {
  // Runtime, user-behavior nudges (never persist to source file)
  liveScore: number;     // score with local nudge applied
  liveTrend: Trend;      // trend adjusted by local telemetry
}

export interface CopyMeta {
  providerId: string;
  providerName: string;
  promptStyle?: string;
  prompt: string;
  ts: number;           // epoch ms
}

export type PromptQuality = 'up' | 'flag';



