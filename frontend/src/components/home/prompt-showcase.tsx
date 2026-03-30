// src/components/home/prompt-showcase.tsx
// ============================================================================
// PROMPT OF THE MOMENT — Showcase Component (v9.2 — SSR Initial Data)
// ============================================================================
// Centre-column hero for the new homepage. Displays live weather-driven
// prompts for the current rotation city via a single hero prompt area
// with 4 tier tab pills (CLIP · Midjourney · Natural Language · Plain).
//
// v9.2.0: ★ SSR POTM — accepts optional `initialData` prop from server
//         component. When provided, the hook starts with data (no skeleton,
//         no loading state). Skeleton min-height fixed to match real
//         component height, eliminating CLS on the fallback path.
//
// v9.1.0: Added 💾 save icon next to copy button (saved-page.md §7.1).
//         One-click save to Library with auto-naming and toast feedback.
//
// v9.0.0 CHANGES (Idea 4 — Morph Animation + cleanup):
// - Per-term staggered morph animation on city rotation
// - Each segment fades in with translateY + blur, 40ms stagger per term
// - Old city fades out as block, new city's terms ripple in like a wave
// - "AI Brain" → "Intelligence Engine" (honest label)
// - Removed colour legend (bridge pills teach the colours instead)
// - Removed native title tooltips from anatomy spans (dead feature)
// - Removed CATEGORY_LABELS + LEGEND_ITEMS (unused)
//
// v8.5.0 ADDITIONS (Idea 3 — Intelligence Bridge):
// - IntelligenceBridge component between city header and tier tabs
// - 3–4 compact pills: weather data → vocabulary term reasoning
// - Pill format: [emoji + input] → [coloured output term]
// - "Intelligence Engine" label left, pills flow right
// - Output terms coloured by their category (reuses CATEGORY_COLOURS)
// - Only renders when categoryMap + weather data both available
//
// v8.4.0 FIXES:
// - PromptAnatomy component: colour-codes each term by its source category
// - 12 category colours (subject=white, lighting=amber, atmosphere=cyan, etc.)
// - Weight heatmap: higher-weight terms get subtle glow (text-shadow only)
// - All text full brightness — no opacity dimming, readability first
// - Compact colour legend row between tier tabs and prompt area
// - Hover any term to see its category label (title tooltip)
// - CLIP tier: parses (term:1.2) weight syntax for glow values
// - Natural/Plain tiers: substring matching from categoryMap terms
// - Graceful fallback: if no categoryMap, renders plain text as before
//
// v8.0.0 CHANGES:
// - REPLACED: 2×2 grid of 4 cramped TierPanels
// - WITH: 4 tier tab pills + 1 large hero prompt area
// - Active tier gets the full stage — bigger font, breathing room
// - "Try In" provider icons larger and more spacious
// - Default: Tier 1 (CLIP) — most visually interesting
//
// Preserved from v7:
// - City header: flag, weather/moon emoji with tooltip, venue, conditions, local time
// - Crossfade transition on city rotation (800ms opacity)
// - Like system with deterministic IDs (potm:{rotationIndex}:{tierKey})
// - "Try in [Provider]" icons → sessionStorage + navigate to prompt builder
// - Copy + Like buttons, countdown timer, skeleton, online users bar
// - All sizing via CSS clamp() (desktop-only)
// - prefers-reduced-motion respected
//
// Authority: docs/authority/homepage.md §4.4, §7, §8
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { usePromptShowcase } from '@/hooks/use-prompt-showcase';
import FeedbackWidget from '@/components/ux/feedback-widget';
import { useOnlineUsers } from '@/hooks/use-online-users';
import { Flag } from '@/components/ui/flag';
import { resolveIsNight } from '@/lib/weather/day-night';
import { getMoonPhase } from '@/lib/weather/weather-prompt-generator';
import { ProviderWeatherEmojiTooltip } from '@/components/providers/provider-weather-emoji-tooltip';
import type { PromptOfTheMoment, ProviderShortcut, OnlineCountryEntry } from '@/types/homepage';
import type { WeatherCategoryMap } from '@/types/prompt-builder';
import type { PromptCategory } from '@/types/prompt-builder';
import { getPlatformTierId } from '@/data/platform-tiers';
import { sendShowcaseTelemetry } from '@/lib/telemetry/prompt-telemetry-client';
import { selectionsFromMap, tierToRefPlatform } from '@/lib/prompt-builder';
import { SaveIcon } from '@/components/prompts/library/save-icon';
import { CATEGORY_COLOURS } from '@/lib/prompt-colours';

// ============================================================================
// TIER DISPLAY CONFIG
// ============================================================================

interface TierDisplay {
  key: 'tier1' | 'tier2' | 'tier3' | 'tier4';
  label: string;
  /** Short label for the tab pill */
  tabLabel: string;
  colour: string;
  bgColour: string;
  ringColour: string;
  dotColour: string;
}

const TIER_DISPLAYS: TierDisplay[] = [
  {
    key: 'tier1',
    label: 'CLIP-Based',
    tabLabel: 'CLIP',
    colour: 'text-violet-400',
    bgColour: 'bg-violet-500/10',
    ringColour: 'ring-violet-500/30',
    dotColour: '#8B5CF6',
  },
  {
    key: 'tier2',
    label: 'Midjourney',
    tabLabel: 'Midjourney',
    colour: 'text-blue-400',
    bgColour: 'bg-blue-500/10',
    ringColour: 'ring-blue-500/30',
    dotColour: '#3B82F6',
  },
  {
    key: 'tier3',
    label: 'Natural Language',
    tabLabel: 'Natural',
    colour: 'text-emerald-400',
    bgColour: 'bg-emerald-500/10',
    ringColour: 'ring-emerald-500/30',
    dotColour: '#10B981',
  },
  {
    key: 'tier4',
    label: 'Plain Language',
    tabLabel: 'Plain',
    colour: 'text-amber-400',
    bgColour: 'bg-amber-500/10',
    ringColour: 'ring-amber-500/30',
    dotColour: '#F59E0B',
  },
];

/** Default like state for prompts (used as fallback) */
// ============================================================================
// WEATHER EMOJI (derive from conditions text — same as used in exchange cards)
// ============================================================================

function conditionsToEmoji(conditions: string): string {
  const c = conditions.toLowerCase();
  if (c.includes('thunder') || c.includes('storm')) return '⛈️';
  if (c.includes('rain') || c.includes('drizzle')) return '🌧️';
  if (c.includes('snow') || c.includes('blizzard')) return '❄️';
  if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return '🌫️';
  if (c.includes('overcast')) return '☁️';
  if (c.includes('cloud')) return '⛅';
  if (c.includes('clear') || c.includes('sunny')) return '☀️';
  return '🌤️';
}

// ============================================================================
// COPY BUTTON
// ============================================================================

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may not be available
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex shrink-0 items-center justify-center rounded-md transition-all ${
        copied
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
      }`}
      style={{
        width: 'clamp(24px, 1.8vw, 30px)',
        height: 'clamp(24px, 1.8vw, 30px)',
      }}
      title={copied ? 'Copied!' : 'Copy prompt'}
      aria-label={`${copied ? 'Copied' : 'Copy'} ${label} prompt`}
    >
      {copied ? (
        <svg
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          style={{ width: 'clamp(12px, 0.9vw, 16px)', height: 'clamp(12px, 0.9vw, 16px)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{ width: 'clamp(12px, 0.9vw, 16px)', height: 'clamp(12px, 0.9vw, 16px)' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}

// ============================================================================
// LIKE BUTTON — Heart toggle with count (§7.8)
// ============================================================================

// ============================================================================
// PROVIDER ICON — "Try in [Provider]"
// ============================================================================

function ProviderIcon({
  provider,
  promptText: _promptText,
  tierKey: _tierKey,
  tierPayload,
  inspiredBy,
}: {
  provider: ProviderShortcut;
  promptText: string;
  tierKey: string;
  tierPayload?: {
    promptText: string;
    selections: Record<string, string[]>;
    categoryMap?: WeatherCategoryMap;
  };
  inspiredBy?: {
    city: string;
    venue: string;
    conditions: string;
    emoji: string;
    tempC: number | null;
    localTime: string;
    mood: string;
    categoryMapHash?: string;
  };
}) {
  const handleClick = useCallback(() => {
    // Phase D: Store WeatherCategoryMap (preferred) + legacy payload for backward compat
    try {
      if (tierPayload) {
        sessionStorage.setItem('promagen:preloaded-payload', JSON.stringify(tierPayload));
      }
      if (inspiredBy) {
        sessionStorage.setItem('promagen:preloaded-inspiredBy', JSON.stringify(inspiredBy));
      }
    } catch {
      // sessionStorage unavailable — graceful degradation
    }
    // Navigate directly to /providers/[id] (not /prompt-builder which is deprecated)
    window.location.href = `/providers/${provider.id}`;
  }, [provider.id, tierPayload, inspiredBy]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/10 transition-all hover:bg-white/20 hover:ring-white/20 hover:scale-110"
      style={{
        width: 'clamp(30px, 2.3vw, 38px)',
        height: 'clamp(30px, 2.3vw, 38px)',
      }}
      title={`Try in ${provider.name}`}
      aria-label={`Open this prompt in ${provider.name}`}
    >
      <Image
        src={provider.iconPath}
        alt={provider.name}
        width={24}
        height={24}
        className="rounded-sm"
        style={{
          width: 'clamp(18px, 1.5vw, 24px)',
          height: 'clamp(18px, 1.5vw, 24px)',
          filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.4))',
        }}
      />
    </button>
  );
}

// ============================================================================
// PROMPT ANATOMY — Colour-coded category segments + weight heatmap
// ============================================================================
// Each term in the prompt is coloured by its source category and brightened
// by its CLIP weight. Hover shows the category label.
//
// Category colour palette (distinct on dark bg, accessible):
//   subject:     yellow-300   — gold, the star of the show
//   action:      lime-400     — movement/energy
//   style:       purple-400   — artistic reference
//   environment: sky-400      — place/setting
//   composition: emerald-400  — framing/structure
//   camera:      orange-400   — lens/angle
//   lighting:    amber-400    — light source/direction
//   colour:      pink-400     — colour grade
//   atmosphere:  cyan-400     — fog/haze/particles
//   materials:   teal-400     — surface/texture
//   fidelity:    blue-300     — quality boosters, distinct soft blue
//   negative:    red-400      — constraints
//   structural:  slate-400    — commas, glue text, readable but quiet
//
// Weight → glow: higher weight terms get a subtle text-shadow halo
// All text full brightness (no opacity dimming) — readability first
// Compact colour legend row educates users on what each colour means
// ============================================================================

/** CATEGORY_COLOURS imported from @/lib/prompt-colours (SSOT) */

/** Default CLIP weights per category (from platform-formats.json) */
const DEFAULT_WEIGHTS: Partial<Record<PromptCategory, number>> = {
  subject: 1.2,
  style: 1.15,
  lighting: 1.1,
  environment: 1.05,
};

interface AnatomySegment {
  text: string;
  category: PromptCategory | 'structural';
  weight: number;
}

/**
 * Build a term → category lookup from WeatherCategoryMap.
 * Checks both selections (vocabulary terms) and customValues (rich phrases).
 */
function buildTermIndex(categoryMap: WeatherCategoryMap): Map<string, PromptCategory> {
  const index = new Map<string, PromptCategory>();

  // Index selection terms
  for (const [cat, terms] of Object.entries(categoryMap.selections)) {
    if (!terms) continue;
    for (const term of terms) {
      const key = term.toLowerCase().trim();
      if (key) index.set(key, cat as PromptCategory);
    }
  }

  // Index custom values (rich phrases)
  for (const [cat, phrase] of Object.entries(categoryMap.customValues)) {
    if (!phrase) continue;
    const key = phrase.toLowerCase().trim();
    if (key) index.set(key, cat as PromptCategory);
  }

  return index;
}

/**
 * Unified prompt parser for ALL tiers.
 * Keeps the original text intact — colours terms in-place via substring matching.
 * For CLIP prompts, also extracts weight values from `(term:1.2)` patterns.
 * Commas, spaces, and punctuation stay exactly where they are in the source text.
 */
function parsePromptUnified(
  promptText: string,
  termIndex: Map<string, PromptCategory>,
): AnatomySegment[] {
  // Build sorted list of terms (longest first for greedy matching)
  const termEntries = Array.from(termIndex.entries()).sort((a, b) => b[0].length - a[0].length);

  // Also build a fidelity keyword list for structural fallback detection
  const fidelityTerms = [
    'masterpiece',
    'best quality',
    'highly detailed',
    'sharp focus',
    '8k',
    '4k',
    'intricate textures',
    'intricate details',
    'ultra detailed',
    'high resolution',
    'fine details',
  ];

  // Find all category term matches with their positions
  type Match = { start: number; end: number; category: PromptCategory; weight: number };
  const matches: Match[] = [];
  const lowerPrompt = promptText.toLowerCase();

  for (const [term, category] of termEntries) {
    let searchFrom = 0;
    while (searchFrom < lowerPrompt.length) {
      const idx = lowerPrompt.indexOf(term, searchFrom);
      if (idx === -1) break;
      // Check overlap with existing matches
      const overlaps = matches.some((m) => idx < m.end && idx + term.length > m.start);
      if (!overlaps) {
        // Check if this term is inside a CLIP weight wrapper: (term:1.2)
        let weight = DEFAULT_WEIGHTS[category] ?? 1.0;
        const beforeChar = idx > 0 ? promptText[idx - 1] : '';
        const afterText = promptText.slice(idx + term.length);
        if (beforeChar === '(' && /^:\d+\.?\d*\)/.test(afterText)) {
          const wMatch = afterText.match(/^:(\d+\.?\d*)\)/);
          if (wMatch) weight = parseFloat(wMatch[1]!);
        }

        matches.push({ start: idx, end: idx + term.length, category, weight });
      }
      searchFrom = idx + 1;
    }
  }

  // Also find fidelity keywords not already matched
  for (const fTerm of fidelityTerms) {
    let searchFrom = 0;
    while (searchFrom < lowerPrompt.length) {
      const idx = lowerPrompt.indexOf(fTerm, searchFrom);
      if (idx === -1) break;
      const overlaps = matches.some((m) => idx < m.end && idx + fTerm.length > m.start);
      if (!overlaps) {
        matches.push({ start: idx, end: idx + fTerm.length, category: 'fidelity', weight: 1.0 });
      }
      searchFrom = idx + 1;
    }
  }

  // Sort matches by position
  matches.sort((a, b) => a.start - b.start);

  // Build segments from matches and gaps — original text preserved exactly
  const segments: AnatomySegment[] = [];
  let cursor = 0;

  for (const match of matches) {
    // Gap before this match = structural text (commas, spaces, glue words)
    if (match.start > cursor) {
      segments.push({
        text: promptText.slice(cursor, match.start),
        category: 'structural',
        weight: 0.5,
      });
    }

    segments.push({
      text: promptText.slice(match.start, match.end),
      category: match.category,
      weight: match.weight,
    });
    cursor = match.end;
  }

  // Remaining text after last match
  if (cursor < promptText.length) {
    segments.push({
      text: promptText.slice(cursor),
      category: 'structural',
      weight: 0.5,
    });
  }

  // If no matches found, return the whole text as structural
  if (segments.length === 0) {
    segments.push({ text: promptText, category: 'structural', weight: 0.5 });
  }

  return segments;
}

/**
 * PromptAnatomy — Renders prompt text with colour-coded category segments
 * and weight-based brightness (heatmap). One render pass, one set of spans.
 */
const PromptAnatomy = React.memo(function PromptAnatomy({
  promptText,
  categoryMap,
  isTransitioning = false,
}: {
  promptText: string;
  categoryMap?: WeatherCategoryMap;
  /** When true, segments animate in with staggered delays (morph effect) */
  isTransitioning?: boolean;
}) {
  const segments = useMemo(() => {
    // Normalize: insert space where lowercase meets uppercase without one
    // Fixes upstream concatenation bugs like "Mexico CitySouth-westerly"
    const normalized = promptText.replace(/([a-z])([A-Z])/g, '$1 $2');

    if (!categoryMap) {
      return [{ text: normalized, category: 'structural' as const, weight: 0.5 }];
    }

    const termIndex = buildTermIndex(categoryMap);
    if (termIndex.size === 0) {
      return [{ text: normalized, category: 'structural' as const, weight: 0.5 }];
    }

    // Unified parser for all tiers — keeps original text intact
    return parsePromptUnified(normalized, termIndex);
  }, [promptText, categoryMap]);

  // Check if we have any non-structural segments (anatomy is useful)
  const hasAnatomy = segments.some((s) => s.category !== 'structural');

  if (!hasAnatomy) {
    // Fallback: plain render (no category data matched)
    return (
      <p
        className="font-mono leading-relaxed text-slate-200"
        style={{ fontSize: 'clamp(0.65rem, 0.78vw, 0.92rem)' }}
      >
        {promptText}
      </p>
    );
  }

  return (
    <p
      className="font-mono leading-relaxed"
      style={{ fontSize: 'clamp(0.65rem, 0.78vw, 0.92rem)' }}
    >
      {segments.map((seg, i) => {
        const colour = CATEGORY_COLOURS[seg.category] ?? CATEGORY_COLOURS.structural;
        const isWeighted = seg.weight >= 1.05;

        // Morph animation: staggered fade-in per segment during city rotation
        const morphStyle: React.CSSProperties = isTransitioning
          ? {
              animation: 'morphTermIn 600ms ease-out forwards',
              animationDelay: `${i * 40}ms`,
              opacity: 0,
            }
          : {};

        return (
          <span
            key={i}
            style={{
              color: colour,
              textShadow: isWeighted ? `0 0 10px ${colour}50` : undefined,
              ...morphStyle,
            }}
          >
            {seg.text}
          </span>
        );
      })}
    </p>
  );
});

// ============================================================================
// INTELLIGENCE BRIDGE — Weather → Prompt reasoning chain (Idea 3)
// ============================================================================
// Shows 3–4 compact pills revealing how weather data became prompt vocabulary.
// Each pill: [weather emoji + data point] → [category term it produced]
// Only renders when categoryMap + weather data are both available.
//
// Data sources:
//   Left side (input):  data.weather — raw API data (conditions, tempC, humidity, windKmh)
//   Right side (output): categoryMap.selections — vocabulary terms the engine chose
//   Link:               weather-category-mapper.ts mapping logic
// ============================================================================

interface BridgePill {
  emoji: string;
  input: string;
  output: string;
  category: string;
}

/**
 * Derive intelligence bridge pills from weather data + categoryMap.
 * Returns 3–4 pills based on what data is available.
 */
function deriveBridgePills(
  weather: PromptOfTheMoment['weather'],
  categoryMap: WeatherCategoryMap,
): BridgePill[] {
  const pills: BridgePill[] = [];

  // 1. Conditions → atmosphere term (always available)
  const conditions = categoryMap.meta?.conditions || weather.description;
  const atmosTerm = categoryMap.selections.atmosphere?.[0];
  if (conditions && atmosTerm) {
    pills.push({
      emoji: '☁️',
      input: conditions,
      output: atmosTerm,
      category: 'atmosphere',
    });
  }

  // 2. Temperature → colour/thermal effect
  const tempC = weather.tempC;
  const colourTerm = categoryMap.selections.colour?.[0];
  if (tempC !== null && colourTerm) {
    pills.push({
      emoji: '🌡️',
      input: `${Math.round(tempC)}°C`,
      output: colourTerm,
      category: 'colour',
    });
  }

  // 3. Lighting → lighting vocabulary term
  const lightTerm = categoryMap.selections.lighting?.[0];
  if (lightTerm) {
    // Derive input from time of day
    const hour = categoryMap.meta?.localTime?.split(':')[0];
    const hourNum = hour ? parseInt(hour, 10) : null;
    let timeLabel = 'Daylight';
    if (hourNum !== null) {
      if (hourNum >= 5 && hourNum < 7) timeLabel = 'Dawn';
      else if (hourNum >= 7 && hourNum < 10) timeLabel = 'Morning';
      else if (hourNum >= 10 && hourNum < 14) timeLabel = 'Midday';
      else if (hourNum >= 14 && hourNum < 17) timeLabel = 'Afternoon';
      else if (hourNum >= 17 && hourNum < 20) timeLabel = 'Dusk';
      else if (hourNum >= 20 || hourNum < 5) timeLabel = 'Night';
    }
    pills.push({
      emoji: '💡',
      input: timeLabel,
      output: lightTerm,
      category: 'lighting',
    });
  }

  // 4. Wind → action term (only if wind is notable)
  const windKmh = weather.windKmh;
  const actionTerm = categoryMap.customValues.action;
  if (windKmh !== null && windKmh >= 6 && actionTerm) {
    pills.push({
      emoji: '💨',
      input: `${Math.round(windKmh)} km/h`,
      output: actionTerm.length > 30 ? actionTerm.slice(0, 28) + '…' : actionTerm,
      category: 'action',
    });
  }

  // 5. Humidity → materials/surface (fallback if wind wasn't available)
  if (pills.length < 4) {
    const humidity = weather.humidity;
    const materialsTerm = categoryMap.customValues.materials;
    if (humidity !== null && materialsTerm) {
      pills.push({
        emoji: '💧',
        input: `${Math.round(humidity)}% humidity`,
        output: materialsTerm.length > 30 ? materialsTerm.slice(0, 28) + '…' : materialsTerm,
        category: 'materials',
      });
    }
  }

  return pills.slice(0, 3);
}

/**
 * IntelligenceBridge — compact pill strip showing weather → vocabulary reasoning.
 * "The wow, it actually thinks moment."
 */
const IntelligenceBridge = React.memo(function IntelligenceBridge({
  weather,
  categoryMap,
}: {
  weather: PromptOfTheMoment['weather'];
  categoryMap?: WeatherCategoryMap;
}) {
  const pills = useMemo(() => {
    if (!categoryMap) return [];
    return deriveBridgePills(weather, categoryMap);
  }, [weather, categoryMap]);

  if (pills.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center"
      style={{
        gap: 'clamp(4px, 0.35vw, 7px)',
        padding: 'clamp(4px, 0.35vw, 7px) 0',
      }}
      aria-label="Weather intelligence reasoning"
    >
      {/* Label */}
      <span
        className="shrink-0 font-medium text-slate-400"
        style={{
          fontSize: 'clamp(0.6rem, 0.75vw, 0.85rem)',
          marginRight: 'clamp(4px, 0.3vw, 6px)',
        }}
      >
        Intelligence Engine
      </span>

      {pills.map((pill, i) => {
        const outputColour = CATEGORY_COLOURS[pill.category] ?? '#E2E8F0';
        return (
          <span
            key={i}
            className="inline-flex items-center rounded-full bg-white/5 ring-1 ring-white/10"
            style={{
              padding: 'clamp(3px, 0.25vw, 5px) clamp(8px, 0.7vw, 14px)',
              gap: 'clamp(4px, 0.35vw, 7px)',
              fontSize: 'clamp(0.6rem, 0.75vw, 0.85rem)',
            }}
            title={`Weather intelligence: ${pill.input} mapped to ${pill.output}`}
          >
            <span aria-hidden="true">{pill.emoji}</span>
            <span className="text-slate-300">{pill.input}</span>
            <span className="text-slate-500" aria-hidden="true">
              →
            </span>
            <span style={{ color: outputColour }} className="font-medium">
              {pill.output}
            </span>
          </span>
        );
      })}
    </div>
  );
});

// ============================================================================
// CITY CONTENT (rendered inside crossfade wrapper)
// ============================================================================

function CityContent({
  data,
  isTransitioning = false,
  selectedProviderId,
  onTierChange,
}: {
  data: PromptOfTheMoment;
  /** When true, prompt segments animate in with staggered morph effect */
  isTransitioning?: boolean;
  /** Provider selected in Engine Bay — auto-switches to that provider's tier */
  selectedProviderId?: string;
  /** Fires when active tier changes (for leaderboard highlighting) */
  onTierChange?: (tierId: number) => void;
}) {
  // ── Active tier tab state ──────────────────────────────────────────────
  const [activeTier, setActiveTier] = useState<TierDisplay['key']>('tier1');

  // ── Auto-select tier when Engine Bay provider changes ─────────────────
  useEffect(() => {
    if (!selectedProviderId) return;
    const tierId = getPlatformTierId(selectedProviderId);
    if (tierId) {
      setActiveTier(`tier${tierId}` as TierDisplay['key']);
    }
  }, [selectedProviderId]);

  // ── Notify parent when tier changes (for leaderboard bridge) ──────────
  useEffect(() => {
    const tierId = parseInt(activeTier.replace('tier', ''), 10);
    onTierChange?.(tierId);
  }, [activeTier, onTierChange]);

  // ── Gap 2: Fire telemetry when viewing a PotM prompt ──────────────────
  // Creates a real prompt_events row so FeedbackWidget feedback can be
  // traced back to specific terms by the learning pipeline.
  // Deterministic ID: same as promptId → idempotent (ON CONFLICT DO NOTHING).
  useEffect(() => {
    const tierNum = parseInt(activeTier.replace('tier', ''), 10) as 1 | 2 | 3 | 4;
    const tierData = data.tierSelections?.[activeTier];
    if (!tierData?.categoryMap) return;

    const selections = selectionsFromMap(tierData.categoryMap);
    sendShowcaseTelemetry({
      rotationIndex: data.rotationIndex,
      tier: tierNum,
      selections,
      promptText: data.prompts[activeTier],
      platformId: tierToRefPlatform(tierNum),
    });
  }, [data.rotationIndex, activeTier, data.tierSelections, data.prompts]);

  const activeDisplay = TIER_DISPLAYS.find((d) => d.key === activeTier)!;
  const promptText = data.prompts[activeTier];
  const providers = data.tierProviders[activeTier];
  const promptId = `potm:${data.rotationIndex}:${activeTier}`;
  const categoryMap = data.tierSelections?.[activeTier]?.categoryMap;
  // Shared categoryMap for intelligence bridge (same across all tiers)
  const sharedCategoryMap = data.tierSelections?.tier1?.categoryMap;

  // ── Resolve day/night + display emoji (matches provider-cell.tsx exactly) ──
  const w = data.weather;
  const isNight = w
    ? resolveIsNight(w.isDayTime, w.timezone, w.sunriseUtc, w.sunsetUtc, w.timezoneOffset)
    : false;
  const displayEmoji = w
    ? isNight
      ? getMoonPhase().emoji
      : (w.emoji ?? '🌤️')
    : conditionsToEmoji(data.conditions);

  return (
    <div className="flex flex-col" style={{ gap: 'clamp(8px, 0.7vw, 12px)' }}>
      {/* ── City Header ────────────────────────────────────────────────── */}
      <div className="flex items-center" style={{ gap: 'clamp(8px, 0.7vw, 12px)' }}>
        {/* Flag */}
        <div
          className="relative shrink-0 overflow-hidden rounded-sm shadow-sm"
          style={{
            width: 'clamp(24px, 2vw, 34px)',
            height: 'clamp(16px, 1.3vw, 24px)',
          }}
        >
          <Image
            src={`/flags/${data.countryCode.toLowerCase()}.svg`}
            alt={data.countryCode}
            fill
            className="object-cover"
          />
        </div>

        {/* City name + metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center" style={{ gap: 'clamp(5px, 0.45vw, 8px)' }}>
            <h3
              className="truncate font-semibold text-white"
              style={{ fontSize: 'clamp(0.8rem, 1vw, 1.2rem)' }}
            >
              {data.city}
            </h3>
            {w ? (
              <ProviderWeatherEmojiTooltip
                city={data.city}
                tz={w.timezone}
                description={w.description}
                isNight={isNight}
                tempC={w.tempC}
                tempF={w.tempF}
                windKmh={w.windKmh}
                windDegrees={w.windDegrees}
                windGustKmh={w.windGustKmh}
                humidity={w.humidity}
                visibility={w.visibility}
                sunriseUtc={w.sunriseUtc}
                sunsetUtc={w.sunsetUtc}
                latitude={w.latitude}
                longitude={w.longitude}
                tooltipPosition="left"
              >
                <span
                  style={{ fontSize: 'clamp(0.85rem, 1vw, 1.3rem)', lineHeight: 1 }}
                  aria-label={isNight ? 'Moon phase' : 'Weather conditions'}
                >
                  {displayEmoji}
                </span>
              </ProviderWeatherEmojiTooltip>
            ) : (
              <span
                style={{ fontSize: 'clamp(0.85rem, 1vw, 1.3rem)' }}
                aria-label={data.conditions}
              >
                {displayEmoji}
              </span>
            )}
          </div>
          <p
            className="truncate text-slate-400"
            style={{ fontSize: 'clamp(0.5rem, 0.65vw, 0.75rem)' }}
          >
            <span>{data.venue}</span>
            <span className="text-slate-600"> · </span>
            <span>{data.conditions}</span>
            <span className="text-slate-600"> · </span>
            <LocalClock time={data.localTime} />
          </p>
        </div>
      </div>

      {/* ── Intelligence Bridge — weather → vocabulary reasoning ────────── */}
      <IntelligenceBridge weather={data.weather} categoryMap={sharedCategoryMap} />

      {/* ── Tier Tab Pills — with top provider icons ──────────────────── */}
      <div
        className="flex items-center"
        style={{ gap: 'clamp(4px, 0.35vw, 7px)' }}
        role="tablist"
        aria-label="Prompt tier selection"
      >
        {TIER_DISPLAYS.map((display) => {
          const isActive = display.key === activeTier;
          const tierProviders = data.tierProviders[display.key] ?? [];
          const previewIcons = tierProviders.slice(0, 3);
          const extraCount = Math.max(0, tierProviders.length - 3);

          return (
            <button
              key={display.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tier-panel-${display.key}`}
              onClick={() => setActiveTier(display.key)}
              className={`inline-flex items-center rounded-full ring-1 transition-all ${
                isActive
                  ? `${display.bgColour} ${display.ringColour} ${display.colour}`
                  : 'bg-white/5 ring-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-300'
              }`}
              style={{
                padding: 'clamp(5px, 0.4vw, 8px) clamp(10px, 0.9vw, 16px)',
                gap: 'clamp(4px, 0.35vw, 7px)',
                fontSize: 'clamp(0.65rem, 0.85vw, 1rem)',
                fontWeight: isActive ? 600 : 500,
                letterSpacing: '0.03em',
              }}
            >
              <span
                className="rounded-full"
                style={{
                  width: 'clamp(7px, 0.5vw, 10px)',
                  height: 'clamp(7px, 0.5vw, 10px)',
                  backgroundColor: isActive ? display.dotColour : 'rgba(255,255,255,0.2)',
                  transition: 'background-color 200ms',
                }}
                aria-hidden="true"
              />
              <span className="shrink-0">{display.tabLabel}</span>
              {/* Preview: top 3 provider icons + overflow count */}
              {previewIcons.length > 0 && (
                <span
                  className="inline-flex items-center"
                  style={{ gap: 'clamp(1px, 0.1vw, 2px)', marginLeft: 'clamp(2px, 0.15vw, 3px)' }}
                >
                  {previewIcons.map((p) => (
                    <Image
                      key={p.id}
                      src={p.iconPath}
                      alt={p.name}
                      width={20}
                      height={20}
                      className="rounded-sm"
                      style={{
                        width: 'clamp(18px, 1.5vw, 24px)',
                        height: 'clamp(18px, 1.5vw, 24px)',
                        opacity: isActive ? 1 : 0.6,
                        filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.3))',
                      }}
                    />
                  ))}
                  {extraCount > 0 && (
                    <span
                      style={{
                        fontSize: 'clamp(0.55rem, 0.65vw, 0.78rem)',
                        opacity: 0.6,
                        marginLeft: 'clamp(2px, 0.15vw, 3px)',
                      }}
                    >
                      +{extraCount}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Hero Prompt Area ───────────────────────────────────────────── */}
      <div
        id={`tier-panel-${activeTier}`}
        role="tabpanel"
        className={`flex flex-col rounded-xl bg-slate-900/60 ring-1 ${activeDisplay.ringColour}`}
        style={{
          padding: 'clamp(10px, 0.9vw, 16px)',
          gap: 'clamp(8px, 0.7vw, 12px)',
        }}
      >
        {/* Header row: tier label + like + copy */}
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: 'clamp(5px, 0.45vw, 8px)' }}>
            <div
              className="rounded-full"
              style={{
                width: 'clamp(6px, 0.4vw, 9px)',
                height: 'clamp(6px, 0.4vw, 9px)',
                backgroundColor: activeDisplay.dotColour,
              }}
              aria-hidden="true"
            />
            <span
              className={`font-semibold uppercase tracking-wider ${activeDisplay.colour}`}
              style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.78rem)', letterSpacing: '0.08em' }}
            >
              {activeDisplay.label} Tier {activeTier.replace('tier', '')}
            </span>
          </div>
          <div className="flex items-center" style={{ gap: 'clamp(4px, 0.3vw, 6px)' }}>
            <FeedbackWidget
              itemId={promptId}
              source="showcase"
              platformId={
                activeDisplay.key === 'tier2'
                  ? 'midjourney'
                  : activeDisplay.key === 'tier1'
                    ? 'leonardo'
                    : activeDisplay.key === 'tier3'
                      ? 'openai'
                      : 'canva'
              }
              tier={parseInt(activeTier.replace('tier', ''), 10)}
            />
            <SaveIcon
              positivePrompt={promptText}
              platformId={
                activeDisplay.key === 'tier2'
                  ? 'midjourney'
                  : activeDisplay.key === 'tier1'
                    ? 'leonardo'
                    : activeDisplay.key === 'tier3'
                      ? 'openai'
                      : 'canva'
              }
              platformName={activeDisplay.label}
              source="tooltip"
              tier={parseInt(activeTier.replace('tier', ''), 10)}
              size="lg"
            />
            <CopyButton text={promptText} label={activeDisplay.label} />
          </div>
        </div>

        {/* Prompt text — colour-coded anatomy, auto-height (no scroll) */}
        <div>
          <PromptAnatomy
            promptText={promptText}
            categoryMap={categoryMap}
            isTransitioning={isTransitioning}
          />
        </div>

        {/* "Try in" — colour band separator + bar treatment */}
        {providers.length > 0 && (
          <div
            className="flex items-center min-w-0 rounded-lg"
            style={{
              gap: 'clamp(8px, 0.7vw, 12px)',
              padding: 'clamp(6px, 0.5vw, 10px) clamp(10px, 0.8vw, 14px)',
              background: 'rgba(255, 255, 255, 0.06)',
              borderLeft: `3px solid ${activeDisplay.dotColour}`,
            }}
          >
            <span
              className="shrink-0 font-bold uppercase tracking-wide"
              style={{
                fontSize: 'clamp(0.7rem, 0.85vw, 0.95rem)',
                color: activeDisplay.dotColour,
              }}
            >
              Try in
            </span>
            <div className="flex flex-wrap items-center" style={{ gap: 'clamp(5px, 0.4vw, 8px)' }}>
              {providers.map((p) => (
                <ProviderIcon
                  key={p.id}
                  provider={p}
                  promptText={promptText}
                  tierKey={activeTier}
                  tierPayload={data.tierSelections?.[activeTier]}
                  inspiredBy={data.inspiredBy}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LocalClock({ time }: { time: string }) {
  const colonRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let visible = true;
    const id = setInterval(() => {
      visible = !visible;
      if (colonRef.current) colonRef.current.style.opacity = visible ? '1' : '0';
    }, 500);
    return () => clearInterval(id);
  }, []);

  const [hours, minutes] = time.split(':');
  if (!hours || !minutes) return <span>{time}</span>;

  return (
    <span className="tabular-nums">
      {hours}
      <span ref={colonRef} style={{ opacity: 1 }} aria-hidden="true">
        :
      </span>
      {minutes}
    </span>
  );
}

// ============================================================================
// COUNTDOWN TIMER — 3-state anticipation display
// ============================================================================
// Normal  (3:00 → 0:30):  "🇯🇵 Sapporo arriving in 2:47"  (city=white, rest=amber)
// Imminent (0:29 → 0:04): "🇯🇵 Sapporo in 0:12"           (city=white, rest=amber bright)
// Now      (0:03 → 0:00): "🇯🇵 Now"                        (all amber bright)
//
// Human factors:
//   §1  Curiosity Gap (Loewenstein) — city name lets brain visualise before arrival
//   §3  Anticipatory Dopamine (Schultz) — state change at 30s creates acceleration
//   §6  Temporal Compression (Eagleman) — visual state change = perceived speed-up
//   §11 Cognitive Load (Sweller) — "Live weather prompt" preamble dropped (extraneous)
//   §12 Von Restorff (isolation) — city name white, time amber = hierarchy within line
//   §17 Dark Interface Colour — white city pops; amber time is warm subordinate
//
// Flag size: matches Community Pulse (clamp 18→24px × 14→18px)
// Gap: 2× standard (clamp 8→12px) for breathing room between flag and city
// ============================================================================

/** Shared flag style — matches Community Pulse flag dimensions */
const COUNTDOWN_FLAG_STYLE: React.CSSProperties = {
  width: 'clamp(18px, 1.5vw, 24px)',
  height: 'clamp(14px, 1.1vw, 18px)',
};

/** Shared gap between flag and text — 2× normal for visual breathing room */
const COUNTDOWN_GAP: React.CSSProperties = {
  gap: 'clamp(8px, 0.6vw, 12px)',
};

function CountdownTimer({
  nextCity,
  nextCountryCode,
}: {
  nextCity: string;
  nextCountryCode: string;
}) {
  const [totalSec, setTotalSec] = useState(180);

  useEffect(() => {
    const ROTATION_MS = 3 * 60 * 1000;

    function tick() {
      const now = Date.now();
      const currentSlot = Math.floor(now / ROTATION_MS);
      const nextBoundary = (currentSlot + 1) * ROTATION_MS;
      const diff = Math.max(0, nextBoundary - now);
      setTotalSec(Math.floor(diff / 1000));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const timeStr = `${m}:${s.toString().padStart(2, '0')}`;
  const flagSrc = `/flags/${nextCountryCode.toLowerCase()}.svg`;

  // State: Now (0:03 → 0:00) — maximum brightness, single word
  if (totalSec <= 3) {
    return (
      <span className="inline-flex items-center" style={COUNTDOWN_GAP}>
        <Image
          src={flagSrc}
          alt={nextCountryCode}
          width={24}
          height={18}
          className="inline-block rounded-sm object-cover"
          style={COUNTDOWN_FLAG_STYLE}
        />
        <span
          className="tabular-nums font-semibold text-amber-300"
          style={{ filter: 'brightness(1.3)' }}
        >
          Now
        </span>
      </span>
    );
  }

  // State: Imminent (0:29 → 0:04) — city white, time amber bright, shorter text
  if (totalSec <= 29) {
    return (
      <span className="inline-flex items-center" style={COUNTDOWN_GAP}>
        <Image
          src={flagSrc}
          alt={nextCountryCode}
          width={24}
          height={18}
          className="inline-block rounded-sm object-cover"
          style={COUNTDOWN_FLAG_STYLE}
        />
        <span className="text-white font-medium">{nextCity}</span>
        <span className="tabular-nums text-amber-400/90" style={{ filter: 'brightness(1.15)' }}>
          in {timeStr}
        </span>
      </span>
    );
  }

  // State: Normal (3:00 → 0:30) — city white, "arriving in" amber
  return (
    <span className="inline-flex items-center" style={COUNTDOWN_GAP}>
      <Image
        src={flagSrc}
        alt={nextCountryCode}
        width={24}
        height={18}
        className="inline-block rounded-sm object-cover"
        style={COUNTDOWN_FLAG_STYLE}
      />
      <span className="text-white font-medium">{nextCity}</span>
      <span className="tabular-nums">arriving in {timeStr}</span>
    </span>
  );
}

// ============================================================================
// SKELETON LOADER (updated for hero layout)
// ============================================================================

function ShowcaseSkeleton() {
  return (
    <div
      className="flex flex-col rounded-3xl bg-slate-950/70 ring-1 ring-white/10"
      style={{
        padding: 'clamp(12px, 1.1vw, 18px)',
        gap: 'clamp(8px, 0.8vw, 14px)',
        // ★ CLS FIX: match the real component's rendered height so the
        // skeleton→content swap causes zero layout shift. The real component
        // renders header + bridge + tier tabs + hero prompt ≈ 280–340px.
        minHeight: 'clamp(240px, 22vw, 340px)',
      }}
    >
      {/* Header skeleton */}
      <div className="flex items-center" style={{ gap: 'clamp(8px, 0.7vw, 12px)' }}>
        <div
          className="animate-pulse rounded-sm bg-slate-800"
          style={{ width: 'clamp(24px, 2vw, 32px)', height: 'clamp(16px, 1.2vw, 22px)' }}
        />
        <div className="flex flex-col" style={{ gap: 'clamp(3px, 0.3vw, 6px)' }}>
          <div
            className="animate-pulse rounded bg-slate-800"
            style={{ width: 'clamp(100px, 9vw, 160px)', height: 'clamp(12px, 1vw, 18px)' }}
          />
          <div
            className="animate-pulse rounded bg-slate-800/60"
            style={{ width: 'clamp(70px, 6vw, 110px)', height: 'clamp(8px, 0.7vw, 12px)' }}
          />
        </div>
      </div>

      {/* Tier tab pills skeleton */}
      <div className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 8px)' }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-full bg-slate-800/40"
            style={{ width: 'clamp(55px, 5vw, 80px)', height: 'clamp(22px, 2vw, 30px)' }}
          />
        ))}
      </div>

      {/* Hero prompt skeleton */}
      <div
        className="animate-pulse rounded-xl bg-slate-900/40"
        style={{ height: 'clamp(100px, 10vw, 180px)' }}
      />
    </div>
  );
}

// ============================================================================
// ONLINE USERS BAR — Country flags with counts (Phase 6, §8.5)
// ============================================================================
// Only renders when total ≥ ONLINE_THRESHOLD (50).
// Collapsed: top 3 countries + expand indicator.
// Expanded: all countries inline.
// ============================================================================

/** Threshold: component hidden below this count (§8.2). */
const ONLINE_THRESHOLD = 50;

/** Max countries in collapsed view. */
const COLLAPSED_MAX = 3;

function OnlineUsersBar({ total, countries }: { total: number; countries: OnlineCountryEntry[] }) {
  const [expanded, setExpanded] = useState(false);

  // ── Threshold gate (§8.2) ─────────────────────────────────────────────
  if (total < ONLINE_THRESHOLD) return null;

  const visibleCountries = expanded ? countries : countries.slice(0, COLLAPSED_MAX);
  const remainingCount = countries.length - COLLAPSED_MAX;

  return (
    <div
      className="flex items-center"
      style={{
        gap: 'clamp(4px, 0.4vw, 8px)',
        paddingTop: 'clamp(6px, 0.5vw, 10px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        marginTop: 'clamp(6px, 0.5vw, 10px)',
      }}
      data-testid="online-users-bar"
    >
      {/* Online dot + total */}
      <span
        className="shrink-0 text-slate-500"
        style={{ fontSize: 'clamp(0.4rem, 0.5vw, 0.6rem)' }}
      >
        <span
          className="mr-1 inline-block animate-pulse rounded-full"
          style={{
            backgroundColor: '#10B981',
            width: 'clamp(4px, 0.25vw, 6px)',
            height: 'clamp(4px, 0.25vw, 6px)',
            verticalAlign: 'middle',
          }}
          aria-hidden="true"
        />
        {total} online
      </span>

      {/* Separator */}
      <span
        className="text-slate-700"
        style={{ fontSize: 'clamp(0.35rem, 0.4vw, 0.5rem)' }}
        aria-hidden="true"
      >
        ·
      </span>

      {/* Country flags + counts */}
      <div
        className="flex flex-wrap items-center"
        style={{ gap: 'clamp(4px, 0.35vw, 6px)' }}
        aria-label={`Users online from ${countries.length} countries`}
      >
        {visibleCountries.map((entry) => (
          <span
            key={entry.countryCode}
            className="inline-flex items-center text-slate-400"
            style={{
              gap: 'clamp(1px, 0.1vw, 2px)',
              fontSize: 'clamp(0.42rem, 0.52vw, 0.62rem)',
            }}
          >
            <Flag countryCode={entry.countryCode} size={10} decorative />
            <span className="tabular-nums">{entry.count}</span>
          </span>
        ))}

        {/* Expand/collapse toggle */}
        {countries.length > COLLAPSED_MAX && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-slate-500 transition-colors hover:text-slate-300"
            style={{ fontSize: 'clamp(0.4rem, 0.48vw, 0.58rem)' }}
            aria-expanded={expanded}
            aria-label={expanded ? 'Show fewer countries' : `Show ${remainingCount} more countries`}
          >
            {expanded ? '▴ less' : `▾ +${remainingCount}`}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PromptShowcase({
  selectedProviderId,
  onTierChange,
  initialData,
}: {
  selectedProviderId?: string;
  onTierChange?: (tierId: number) => void;
  /** ★ SSR-generated data — renders instantly, no client fetch needed */
  initialData?: PromptOfTheMoment;
}) {
  const { data, previousData, isLoading, isTransitioning, error } = usePromptShowcase(initialData);

  // ── Online users (Phase 6) ─────────────────────────────────────────────
  const { total: onlineTotal, countries: onlineCountries } = useOnlineUsers();

  // Hard error with no data at all
  if (error && !data) {
    return (
      <div
        className="flex items-center justify-center rounded-3xl bg-slate-950/70 ring-1 ring-white/10"
        style={{ padding: 'clamp(16px, 1.5vw, 24px)', minHeight: 'clamp(180px, 18vw, 300px)' }}
      >
        <p className="text-slate-500" style={{ fontSize: 'clamp(0.6rem, 0.75vw, 0.85rem)' }}>
          Prompt showcase unavailable — retrying...
        </p>
      </div>
    );
  }

  // Loading (no data yet)
  if (isLoading || !data) {
    return <ShowcaseSkeleton />;
  }

  return (
    <div
      className="flex flex-col rounded-3xl bg-slate-950/70 ring-1 ring-white/10"
      style={{ padding: 'clamp(12px, 1.1vw, 18px)' }}
      data-testid="prompt-showcase"
    >
      {/* Section header */}
      <div
        className="flex items-center"
        style={{
          gap: 'clamp(5px, 0.5vw, 8px)',
          marginBottom: 'clamp(8px, 0.7vw, 12px)',
        }}
      >
        <div
          className="animate-pulse rounded-full"
          style={{
            backgroundColor: '#F59E0B',
            width: 'clamp(6px, 0.35vw, 9px)',
            height: 'clamp(6px, 0.35vw, 9px)',
          }}
          aria-hidden="true"
        />
        <span
          className="font-mono font-bold uppercase tracking-wider text-white"
          style={{ fontSize: 'clamp(0.7rem, 0.9vw, 1rem)' }}
        >
          PROMPT OF THE MOMENT
        </span>
        <span
          className="ml-auto italic text-amber-400/80 truncate"
          style={{ fontSize: 'clamp(0.1rem, 0.75vw, 1rem)' }}
        >
          <CountdownTimer
            nextCity={data.nextCity ?? 'Loading'}
            nextCountryCode={data.nextCountryCode ?? 'XX'}
          />
        </span>
      </div>

      {/* Crossfade container */}
      <div className="relative">
        {/* Previous city (fading out during transition) */}
        {isTransitioning && previousData && (
          <div className="showcase-fade-out absolute inset-0" aria-hidden="true">
            <CityContent data={previousData} selectedProviderId={selectedProviderId} />
          </div>
        )}

        {/* Current city (fading in during transition) */}
        <div className={isTransitioning ? 'showcase-fade-in' : ''}>
          <CityContent
            data={data}
            isTransitioning={isTransitioning}
            selectedProviderId={selectedProviderId}
            onTierChange={onTierChange}
          />
        </div>
      </div>

      {/* Online users by country (Phase 6 — threshold gated ≥50) */}
      <OnlineUsersBar total={onlineTotal} countries={onlineCountries} />

      {/* Crossfade keyframes + reduced-motion */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .showcase-fade-in {
          animation: showcaseFadeIn 800ms ease-in-out forwards;
        }
        .showcase-fade-out {
          animation: showcaseFadeOut 800ms ease-in-out forwards;
        }
        @keyframes showcaseFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes showcaseFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes morphTermIn {
          from {
            opacity: 0;
            transform: translateY(4px);
            filter: blur(2px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .showcase-fade-in,
          .showcase-fade-out {
            animation-duration: 0ms !important;
          }
        }
      `,
        }}
      />
    </div>
  );
}
