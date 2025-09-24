export type ProviderScore = {
  id: string;     // "openai", "leonardo", "i23rf", ...
  name: string;   // Human label
  logoUrl?: string;
  score: number;  // 0–100
  delta?: number; // change since last snapshot
  rank?: number;  // computed rank
};

export type LeaderboardResponse = {
  updatedAt: string;       // ISO string
  providers: ProviderScore[];
};
