// src/lib/learning/scene-candidates.ts
// ============================================================================
// COLLECTIVE INTELLIGENCE ENGINE — Scene Candidate Generation
// ============================================================================
//
// Layer 3 of the nightly aggregation cron.
//
// When enough prompts share similar selections and all score 90%+,
// propose a new Scene Starter. Uses Jaccard similarity to cluster
// selection sets, then extracts consensus selections from large clusters.
//
// Candidates go to an admin review queue — never auto-added.
//
// Pure computation layer — no I/O, no database access.
// Existing scenes are passed as a parameter for testability.
// Called by the aggregate cron route.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 9.2
//
// Version: 1.0.0
// Created: 2026-02-25
//
// Existing features preserved: Yes.
// ============================================================================

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';
import { jaccard, flattenSelections } from '@/lib/learning/decay';
import type { PromptEventRow } from '@/lib/learning/database';

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/** A single scene candidate proposed by the learning pipeline */
export interface SceneCandidate {
  /** Unique identifier: 'candidate_' + short hash */
  id: string;
  /** Auto-generated name from top subject + style terms */
  suggestedName: string;
  /** Most common term per category across the cluster */
  consensusSelections: Record<string, string[]>;
  /** Number of qualifying events in this cluster */
  eventCount: number;
  /** Average optimizer score across cluster events */
  avgScore: number;
  /** Most common tier in the cluster */
  dominantTier: 1 | 2 | 3 | 4;
  /** Most common platforms in the cluster */
  dominantPlatforms: string[];
  /** Jaccard overlap with the closest existing scene (0–1) */
  overlapWithExisting: number;
  /** Review status — always 'pending' when generated */
  status: 'pending' | 'approved' | 'rejected';
  /** ISO timestamp of generation */
  createdAt: string;
}

/** Full scene candidates output — stored via upsertLearnedWeights */
export interface SceneCandidates {
  /** Schema version for forward compat */
  version: string;
  /** ISO timestamp of generation */
  generatedAt: string;
  /** Total events considered (after scene_used filter) */
  eventsConsidered: number;
  /** Total clusters formed (including sub-threshold) */
  clustersFormed: number;
  /** Candidates that passed all filters */
  candidates: SceneCandidate[];
}

/** Minimal shape of an existing scene (from scene-starters.json) */
export interface ExistingScenePrefills {
  /** Same shape as prompt event selections */
  prefills: Record<string, string[]>;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/** A cluster of similar events being accumulated */
interface EventCluster {
  /** Flattened terms of the cluster representative (first event) */
  representativeTerms: string[];
  /** All events in this cluster */
  events: PromptEventRow[];
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Generate scene candidates from qualifying prompt events.
 *
 * Algorithm:
 * 1. Filter to events with category_count >= 5 AND scene_used IS NULL
 *    (only non-scene prompts — scenes already exist)
 * 2. Cluster similar selection sets using Jaccard similarity (≥ 0.6)
 * 3. For clusters with ≥ 237 events:
 *    - Extract consensus selections (most common term per category)
 *    - Compute average score, dominant tier, dominant platforms
 *    - Auto-generate a candidate scene name
 * 4. Check overlap with existing scenes — skip if > 70%
 * 5. Output as pending review queue
 *
 * @param events — Qualifying PromptEventRow[] from database
 * @param existingScenes — Current scenes to check overlap against
 * @param referenceDate — "Now" for timestamps (default: Date.now())
 * @returns SceneCandidates ready for storage
 */
export function computeSceneCandidates(
  events: PromptEventRow[],
  existingScenes: ExistingScenePrefills[],
  referenceDate: Date = new Date(),
): SceneCandidates {
  const now = referenceDate;

  // ── Step 1: Filter events ───────────────────────────────────────────────
  // Only non-scene prompts with 5+ categories (richer selections for scenes)
  const eligible = events.filter(
    (evt) => evt.category_count >= 5 && evt.scene_used === null,
  );

  if (eligible.length === 0) {
    return {
      version: '1.0.0',
      generatedAt: now.toISOString(),
      eventsConsidered: 0,
      clustersFormed: 0,
      candidates: [],
    };
  }

  // ── Step 2: Cluster by Jaccard similarity ───────────────────────────────
  const clusters = clusterEvents(eligible);

  // ── Step 3: Extract candidates from large clusters ──────────────────────
  const threshold = LEARNING_CONSTANTS.SCENE_CANDIDATE_THRESHOLD;
  const candidates: SceneCandidate[] = [];

  // Flatten existing scene prefills for overlap checking
  const existingFlattened = existingScenes.map((s) =>
    flattenSelections(s.prefills),
  );

  for (const cluster of clusters) {
    if (cluster.events.length < threshold) continue;

    // Extract consensus selections
    const consensus = extractConsensusSelections(cluster.events);

    // Compute metadata
    const avgScore = Math.round(
      cluster.events.reduce((sum, e) => sum + e.score, 0) /
        cluster.events.length,
    );
    const dominantTier = findDominant(
      cluster.events.map((e) => e.tier),
    ) as 1 | 2 | 3 | 4;
    const dominantPlatforms = findTopPlatforms(
      cluster.events.map((e) => e.platform),
      3,
    );

    // ── Step 4: Check overlap with existing scenes ──────────────────────
    const candidateTerms = flattenSelections(consensus);
    const maxOverlap = existingFlattened.length > 0
      ? Math.max(
          ...existingFlattened.map((existing) =>
            jaccard(candidateTerms, existing),
          ),
        )
      : 0;

    // Skip if too similar to an existing scene
    if (maxOverlap > LEARNING_CONSTANTS.SCENE_OVERLAP_MAX) continue;

    // Generate candidate
    const id = `candidate_${simpleHash(JSON.stringify(consensus))}`;
    const suggestedName = generateSceneName(consensus);

    candidates.push({
      id,
      suggestedName,
      consensusSelections: consensus,
      eventCount: cluster.events.length,
      avgScore,
      dominantTier,
      dominantPlatforms,
      overlapWithExisting: Math.round(maxOverlap * 1000) / 1000,
      status: 'pending',
      createdAt: now.toISOString(),
    });
  }

  // Sort candidates by event count descending (strongest signals first)
  candidates.sort((a, b) => b.eventCount - a.eventCount);

  return {
    version: '1.0.0',
    generatedAt: now.toISOString(),
    eventsConsidered: eligible.length,
    clustersFormed: clusters.length,
    candidates,
  };
}

// ============================================================================
// CLUSTERING
// ============================================================================

/**
 * Greedy clustering of events by Jaccard similarity.
 *
 * For each event, compare its flattened terms against each existing
 * cluster's representative. If Jaccard >= threshold, add to that cluster.
 * Otherwise, start a new cluster.
 *
 * O(n × k) where k = number of clusters. Acceptable for batch sizes
 * up to ~10,000 events.
 *
 * @param events — Pre-filtered eligible events
 * @returns Array of clusters (each containing 1+ events)
 */
function clusterEvents(events: PromptEventRow[]): EventCluster[] {
  const jaccardThreshold = LEARNING_CONSTANTS.SCENE_JACCARD_THRESHOLD;
  const clusters: EventCluster[] = [];

  for (const evt of events) {
    const terms = flattenSelections(evt.selections);
    if (terms.length === 0) continue;

    // Try to find a matching cluster
    let assigned = false;
    for (const cluster of clusters) {
      const similarity = jaccard(terms, cluster.representativeTerms);
      if (similarity >= jaccardThreshold) {
        cluster.events.push(evt);
        assigned = true;
        break;
      }
    }

    // No match — start a new cluster
    if (!assigned) {
      clusters.push({
        representativeTerms: terms,
        events: [evt],
      });
    }
  }

  return clusters;
}

// ============================================================================
// CONSENSUS EXTRACTION
// ============================================================================

/**
 * Extract the most common term per category across a cluster of events.
 *
 * For each category, count term frequencies, then take the single
 * most common term. Returns a selections-shaped object.
 *
 * @param events — Events in one cluster
 * @returns Record<string, string[]> with the consensus pick per category
 */
function extractConsensusSelections(
  events: PromptEventRow[],
): Record<string, string[]> {
  // category → term → count
  const categoryCounts = new Map<string, Map<string, number>>();

  for (const evt of events) {
    for (const [category, values] of Object.entries(evt.selections)) {
      if (!Array.isArray(values)) continue;

      let termMap = categoryCounts.get(category);
      if (!termMap) {
        termMap = new Map<string, number>();
        categoryCounts.set(category, termMap);
      }

      for (const term of values) {
        if (typeof term === 'string' && term.length > 0) {
          termMap.set(term, (termMap.get(term) ?? 0) + 1);
        }
      }
    }
  }

  // Pick the most common term per category
  const consensus: Record<string, string[]> = {};

  for (const [category, termMap] of categoryCounts) {
    let bestTerm = '';
    let bestCount = 0;

    for (const [term, count] of termMap) {
      if (count > bestCount) {
        bestTerm = term;
        bestCount = count;
      }
    }

    if (bestTerm.length > 0) {
      consensus[category] = [bestTerm];
    }
  }

  return consensus;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Find the most common value in an array (mode).
 *
 * @returns The most frequent element, or first element if tied
 */
function findDominant<T>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  let best: T = values[0]!;
  let bestCount = 0;
  for (const [val, count] of counts) {
    if (count > bestCount) {
      best = val;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Find the top N most common platforms.
 */
function findTopPlatforms(platforms: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const p of platforms) {
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([platform]) => platform);
}

/**
 * Generate a human-readable scene name from consensus selections.
 *
 * Combines the subject and style terms into a title-cased name.
 * Falls back to "Untitled Scene" if neither is available.
 *
 * @example
 * { subject: ["cyberpunk hacker"], style: ["neon noir"] }
 * → "Cyberpunk Hacker Neon Noir"
 */
function generateSceneName(
  consensus: Record<string, string[]>,
): string {
  const parts: string[] = [];

  // Subject first
  const subject = consensus['subject']?.[0];
  if (subject) parts.push(subject);

  // Style second
  const style = consensus['style']?.[0];
  if (style) parts.push(style);

  // Fallback: use any available category
  if (parts.length === 0) {
    for (const values of Object.values(consensus)) {
      if (values[0]) {
        parts.push(values[0]);
        break;
      }
    }
  }

  if (parts.length === 0) return 'Untitled Scene';

  // Title case each word
  return parts
    .join(' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Simple deterministic hash for generating candidate IDs.
 * Not cryptographic — just needs to be stable and short.
 */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  // Convert to positive hex string, pad to 8 chars
  const positive = (hash >>> 0).toString(16);
  return positive.padStart(8, '0');
}
