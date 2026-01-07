// src/lib/prompt-intelligence/get-families.ts
// ============================================================================
// GET FAMILIES
// ============================================================================
// Utility to load and parse style families from JSON.
// Authority: docs/authority/prompt-intelligence.md §4
// ============================================================================

import familiesJson from '@/data/prompt-intelligence/families.json';
import type { StyleFamily, FamiliesJson } from '@/types/style-family';

/**
 * Parse families JSON into typed StyleFamily array.
 */
export function getFamilies(): StyleFamily[] {
  const data = familiesJson as FamiliesJson;

  return Object.entries(data.families).map(([id, family]) => ({
    id,
    displayName: family.displayName,
    description: family.description,
    members: family.members,
    related: family.related,
    opposes: family.opposes,
    mood: family.mood as 'calm' | 'intense' | 'neutral',
    suggestedColours: family.suggestedColours,
    suggestedLighting: family.suggestedLighting,
    suggestedAtmosphere: family.suggestedAtmosphere,
  }));
}

/**
 * Get a single family by ID.
 */
export function getFamily(id: string): StyleFamily | undefined {
  const families = getFamilies();
  return families.find((f) => f.id === id);
}

/**
 * Get families by mood.
 */
export function getFamiliesByMood(mood: 'calm' | 'intense' | 'neutral'): StyleFamily[] {
  return getFamilies().filter((f) => f.mood === mood);
}

/**
 * Get related families for a given family.
 */
export function getRelatedFamilies(familyId: string): StyleFamily[] {
  const family = getFamily(familyId);
  if (!family) return [];

  const families = getFamilies();
  return families.filter((f) => family.related.includes(f.id));
}

/**
 * Get opposing families for a given family.
 */
export function getOpposingFamilies(familyId: string): StyleFamily[] {
  const family = getFamily(familyId);
  if (!family) return [];

  const families = getFamilies();
  return families.filter((f) => family.opposes.includes(f.id));
}
