// src/lib/vocabulary/vocab-auto-filter.ts
// ============================================================================
// VOCABULARY AUTO-FILTER — Profanity & Spam Detection
// ============================================================================
//
// Lightweight pre-queue filter that catches profanity, spam patterns, and
// garbage input before terms reach the admin review queue. Runs server-side
// in the POST handler of /api/admin/vocab-submissions.
//
// Design principles:
//   - False negatives are acceptable (a rude word slips through → admin catches it)
//   - False positives are costly (a good term gets auto-rejected → user loses trust)
//   - Therefore: blocklist is conservative, patterns target obvious spam only
//   - Admin can rescue false positives from the "Auto-Filtered" tab
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.7
//
// Version: 1.0.0
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

import type { AutoFilterReason } from '@/types/vocab-submission';
import {
  MAX_TERM_LENGTH,
  MIN_TERM_LENGTH,
} from '@/types/vocab-submission';

// ============================================================================
// TYPES
// ============================================================================

export interface FilterResult {
  /** Whether the term was caught by the filter */
  blocked: boolean;
  /** Reason for blocking (null if not blocked) */
  reason: AutoFilterReason | null;
  /** The specific pattern that matched (null if not blocked) */
  matchedPattern: string | null;
}

// ============================================================================
// BLOCKLIST
// ============================================================================

/**
 * Conservative profanity blocklist.
 *
 * Only includes terms that are ALWAYS inappropriate in a prompt builder context.
 * Creative/artistic terms that happen to sound edgy are NOT included —
 * better to let them through and let the admin decide.
 *
 * Matched as whole words (word boundary check) to avoid false positives
 * like "assassination" matching "ass".
 */
const PROFANITY_BLOCKLIST: string[] = [
  // Slurs & hate speech (always inappropriate)
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded',
  'kike', 'chink', 'wetback', 'spic', 'coon', 'gook',
  'tranny', 'shemale',
  // Sexual (not relevant to image prompts in any legitimate context)
  'porn', 'pornographic', 'hentai', 'xxx', 'nsfw',
  'cum', 'cumshot', 'blowjob', 'handjob', 'gangbang',
  'pussy', 'dick', 'cock', 'penis', 'vagina',
  'masturbate', 'masturbation', 'orgasm',
  // Extreme violence terms (beyond artistic use)
  'gore', 'snuff', 'torture porn',
  // Child safety (absolute zero tolerance)
  'loli', 'lolicon', 'shota', 'shotacon', 'underage',
  'child porn', 'cp', 'pedo', 'pedophile', 'pedophilia',
];

/**
 * Regex patterns for spam detection.
 * Each pattern has a human-readable label for the matchedPattern field.
 */
const SPAM_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // URLs
  { pattern: /https?:\/\//i, label: 'url' },
  { pattern: /www\./i, label: 'url' },
  { pattern: /\.[a-z]{2,4}\//i, label: 'url-path' },
  // Email addresses
  { pattern: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, label: 'email' },
  // Repeated characters (4+ of the same char in a row)
  { pattern: /(.)\1{3,}/i, label: 'repeated-chars' },
  // All numbers (no letters at all)
  { pattern: /^\d+$/, label: 'numbers-only' },
  // Excessive special characters (more special chars than letters)
  { pattern: /^[^a-z]*$/i, label: 'no-letters' },
  // Phone numbers
  { pattern: /\+?\d[\d\s-]{7,}\d/, label: 'phone-number' },
  // Base64-ish strings (long alphanumeric without spaces)
  { pattern: /^[A-Za-z0-9+/=]{30,}$/, label: 'encoded-string' },
];

// ============================================================================
// BUILD WORD BOUNDARY REGEX (cached)
// ============================================================================

/**
 * Build a single regex from the blocklist using word boundaries.
 * This prevents false positives like "class" matching "ass".
 * Cached at module level — built once on first import.
 */
let _profanityRegex: RegExp | null = null;

function getProfanityRegex(): RegExp {
  if (!_profanityRegex) {
    // Escape special regex characters in blocklist terms
    const escaped = PROFANITY_BLOCKLIST.map((term) =>
      term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    // Word boundary match — case insensitive
    _profanityRegex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
  }
  return _profanityRegex;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check a term against the auto-filter.
 *
 * @param term - The normalised term (already trimmed + lowercased)
 * @returns FilterResult with blocked status, reason, and matched pattern
 *
 * Check order (first match wins):
 *   1. Length checks (too short / too long)
 *   2. Profanity blocklist (word-boundary match)
 *   3. Spam patterns (regex match)
 */
export function checkAutoFilter(term: string): FilterResult {
  // ── Length checks ──────────────────────────────────────────────────────
  if (term.length < MIN_TERM_LENGTH) {
    return { blocked: true, reason: 'too-short', matchedPattern: `length=${term.length}` };
  }

  if (term.length > MAX_TERM_LENGTH) {
    return { blocked: true, reason: 'too-long', matchedPattern: `length=${term.length}` };
  }

  // ── Profanity check ───────────────────────────────────────────────────
  const profanityMatch = term.match(getProfanityRegex());
  if (profanityMatch) {
    return {
      blocked: true,
      reason: 'profanity',
      matchedPattern: profanityMatch[1] ?? profanityMatch[0],
    };
  }

  // ── Spam pattern check ────────────────────────────────────────────────
  for (const { pattern, label } of SPAM_PATTERNS) {
    if (pattern.test(term)) {
      return { blocked: true, reason: 'spam', matchedPattern: label };
    }
  }

  // ── Clean ─────────────────────────────────────────────────────────────
  return { blocked: false, reason: null, matchedPattern: null };
}

/**
 * Normalise a term before any processing.
 * Used at all three dedup layers for consistent comparison.
 */
export function normaliseTerm(raw: string): string {
  return raw.trim().toLowerCase();
}
