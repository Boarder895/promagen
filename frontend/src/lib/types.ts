export type ProviderScore = {
  id: string;           // internal id e.g. "openai", "i23rf"
  name: string;         // display name e.g. "OpenAI", "I23RF"
  logoUrl?: string;     // optional logo
  score: number;        // 0-100
  delta?: number;       // change since last snapshot (+/-)
  rank?: number;        // computed rank
};

export type LeaderboardResponse = {
  updatedAt: string;         // ISO timestamp
  providers: ProviderScore[]; // sorted or unsorted; we’ll sort if needed
};









