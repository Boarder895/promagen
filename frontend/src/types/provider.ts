// src/types/provider.ts
// Re-export Provider type from providers.ts
// This allows imports from both '@/types/provider' and '@/types/providers'
//
// Updated: January 22, 2026 - Added PromagenUsersCountryUsage re-export

export type {
  Provider,
  ProviderSocials,
  ProviderTrend,
  ProviderGenerationSpeed,
  ProviderQualityTier,
  ProviderRanking,
} from './providers';

// Promagen Users types
export type {
  PromagenUsersCountryUsage,
  PromagenUsersData,
} from './promagen-users';
