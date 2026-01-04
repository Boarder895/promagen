/**
 * @file src/lib/voting/bayesian.ts
 * @description Bayesian average scoring algorithm with time decay
 * 
 * The Bayesian formula prevents gaming through:
 * 1. Low sample size protection (new providers can't beat established ones)
 * 2. Time decay (old votes matter less)
 * 3. Global average anchoring (skeptical of outliers)
 * 
 * Formula:
 *   score = (v / (v + m)) × R + (m / (v + m)) × C
 * 
 * Where:
 *   v = weighted votes for provider
 *   m = minimum votes threshold (25)
 *   R = provider's raw average
 *   C = global average across all providers
 * 
 * Score blending (community vs seed):
 *   0-24 votes:  100% seed, 0% community
 *   25-49 votes: 75% seed, 25% community
 *   50-99 votes: 50% seed, 50% community
 *   100+ votes:  30% seed, 70% community
 */

import type { ProviderVoteStats, ProviderRanking } from './types';
import {
  BAYESIAN_MIN_VOTES,
  TIME_DECAY_HALF_LIFE_DAYS,
  BLEND_THRESHOLDS,
  SEED_ELO_SCORES,
  SEED_TIERS,
  ELO_TO_SCORE_BASE,
  ELO_TO_SCORE_SCALE,
  TIER_BASE_SCORES,
} from './constants';

// ============================================================================
// TIME DECAY
// ============================================================================

/**
 * Calculate time decay factor for a vote.
 * Returns value between 0 and 1.
 * At half-life, returns 0.5.
 */
export function calculateTimeDecay(
  voteTimestamp: number,
  now: number = Date.now()
): number {
  const ageMs = now - voteTimestamp;
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  
  // Exponential decay: e^(-λt) where λ = ln(2) / half-life
  const decayConstant = Math.LN2 / TIME_DECAY_HALF_LIFE_DAYS;
  const decay = Math.exp(-decayConstant * ageDays);
  
  // Clamp between 0.01 and 1 (never fully zero)
  return Math.max(0.01, Math.min(1, decay));
}

/**
 * Apply time decay to a set of votes.
 * Returns total decayed weight.
 */
export function applyTimeDecayToVotes(
  votes: Array<{ weight: number; createdAt: string }>,
  now: number = Date.now()
): number {
  return votes.reduce((total, vote) => {
    const timestamp = new Date(vote.createdAt).getTime();
    const decay = calculateTimeDecay(timestamp, now);
    return total + vote.weight * decay;
  }, 0);
}

// ============================================================================
// BAYESIAN SCORE CALCULATION
// ============================================================================

/**
 * Calculate Bayesian average score for a provider.
 * 
 * @param providerVotes - Total weighted votes for provider
 * @param providerScore - Provider's raw score (average per vote)
 * @param globalAverage - Average score across all providers
 * @param minVotes - Minimum votes threshold (default: 25)
 */
export function calculateBayesianScore(
  providerVotes: number,
  providerScore: number,
  globalAverage: number,
  minVotes: number = BAYESIAN_MIN_VOTES
): number {
  // v / (v + m) = confidence weight
  const confidence = providerVotes / (providerVotes + minVotes);
  
  // (1 - confidence) = prior weight
  const priorWeight = 1 - confidence;
  
  // Bayesian average
  const bayesianScore = confidence * providerScore + priorWeight * globalAverage;
  
  // Normalize to 0-100 scale
  return Math.max(0, Math.min(100, bayesianScore));
}

/**
 * Calculate global average from all provider stats.
 */
export function calculateGlobalAverage(
  allStats: Map<string, ProviderVoteStats>
): number {
  if (allStats.size === 0) return 50; // Default neutral average
  
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const stats of allStats.values()) {
    // Use vote count as weight
    totalScore += stats.bayesianScore * stats.totalVoteCount;
    totalWeight += stats.totalVoteCount;
  }
  
  if (totalWeight === 0) return 50;
  
  return totalScore / totalWeight;
}

// ============================================================================
// SEED SCORE CONVERSION
// ============================================================================

/**
 * Convert ELO score to 0-100 quality score.
 */
export function eloToQualityScore(elo: number): number {
  // Map ELO range (900-1200) to score range (60-100)
  const score = 60 + (elo - ELO_TO_SCORE_BASE) * ELO_TO_SCORE_SCALE;
  return Math.max(0, Math.min(100, score));
}

/**
 * Get seed score for a provider.
 * Uses ELO if available, otherwise tier-based score.
 */
export function getSeedScore(providerId: string): number {
  // Check for ELO score first
  const elo = SEED_ELO_SCORES[providerId];
  if (elo !== undefined) {
    return eloToQualityScore(elo);
  }
  
  // Fall back to tier-based score
  const tier = SEED_TIERS[providerId];
  if (tier) {
    return TIER_BASE_SCORES[tier] ?? 50;
  }
  
  // Default mid-tier score
  return 50;
}

/**
 * Get seed tier for a provider.
 */
export function getSeedTier(
  providerId: string
): 'top-tier' | 'mid-tier' | 'entry-tier' | 'specialized' | 'utility' {
  // Check if has ELO (top-tier if high ELO)
  const elo = SEED_ELO_SCORES[providerId];
  if (elo !== undefined) {
    if (elo >= 1100) return 'top-tier';
    if (elo >= 1000) return 'mid-tier';
    return 'entry-tier';
  }
  
  // Use manual tier
  return SEED_TIERS[providerId] ?? 'mid-tier';
}

// ============================================================================
// SCORE BLENDING
// ============================================================================

/**
 * Get blend weights based on vote count.
 * Returns [seedWeight, communityWeight].
 */
export function getBlendWeights(voteCount: number): [number, number] {
  // Find applicable threshold (in reverse order)
  for (let i = BLEND_THRESHOLDS.length - 1; i >= 0; i--) {
    const entry = BLEND_THRESHOLDS[i];
    if (entry && voteCount >= entry[0]) {
      return [entry[1], entry[2]];
    }
  }
  
  // Default: 100% seed, 0% community
  return [1.0, 0.0];
}

/**
 * Calculate blended Image Quality score.
 * Combines seed score with community score based on vote count.
 */
export function calculateBlendedScore(
  providerId: string,
  communityScore: number,
  voteCount: number
): number {
  const seedScore = getSeedScore(providerId);
  const [seedWeight, communityWeight] = getBlendWeights(voteCount);
  
  return seedScore * seedWeight + communityScore * communityWeight;
}

// ============================================================================
// RANKINGS CALCULATION
// ============================================================================

/**
 * Calculate rankings for all providers.
 */
export function calculateRankings(
  providerIds: string[],
  allStats: Map<string, ProviderVoteStats>
): ProviderRanking[] {
  // Calculate global average for Bayesian formula
  const globalAverage = calculateGlobalAverage(allStats);
  
  // Calculate blended scores for all providers
  const scoredProviders: Array<{
    providerId: string;
    blendedScore: number;
    stats: ProviderVoteStats | null;
    seedElo: number | null;
    seedTier: 'top-tier' | 'mid-tier' | 'entry-tier' | 'specialized' | 'utility';
    bayesianScore: number | null;
  }> = [];
  
  for (const providerId of providerIds) {
    const stats = allStats.get(providerId);
    const voteCount = stats?.totalVoteCount ?? 0;
    
    // Calculate Bayesian score if has votes
    let bayesianScore: number | null = null;
    if (stats && voteCount > 0) {
      // Raw score = weighted votes / vote count (as a proxy for quality)
      // This is a simplified version - in production, you might have explicit ratings
      const rawScore = stats.totalWeightedVotes / voteCount * 10; // Scale to ~50-100
      bayesianScore = calculateBayesianScore(
        voteCount,
        rawScore,
        globalAverage
      );
    }
    
    // Calculate blended score
    const communityScore = bayesianScore ?? getSeedScore(providerId);
    const blendedScore = calculateBlendedScore(providerId, communityScore, voteCount);
    
    scoredProviders.push({
      providerId,
      blendedScore,
      stats: stats ?? null,
      seedElo: SEED_ELO_SCORES[providerId] ?? null,
      seedTier: getSeedTier(providerId),
      bayesianScore,
    });
  }
  
  // Sort by blended score (descending)
  scoredProviders.sort((a, b) => b.blendedScore - a.blendedScore);
  
  // Assign ranks and create ranking objects
  const rankings: ProviderRanking[] = scoredProviders.map((p, index) => ({
    providerId: p.providerId,
    seedElo: p.seedElo,
    seedTier: p.seedTier,
    bayesianScore: p.bayesianScore,
    imageQualityRank: index + 1, // 1-indexed rank
    stats: p.stats,
  }));
  
  return rankings;
}

/**
 * Update a single provider's Bayesian score.
 * Used for incremental updates after a vote.
 */
export function updateProviderBayesianScore(
  stats: ProviderVoteStats,
  globalAverage: number
): number {
  if (stats.totalVoteCount === 0) {
    return 0;
  }
  
  // Calculate raw score from weighted votes
  const rawScore = stats.totalWeightedVotes / stats.totalVoteCount * 10;
  
  return calculateBayesianScore(
    stats.totalVoteCount,
    rawScore,
    globalAverage
  );
}
