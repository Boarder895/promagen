// src/components/prompt-lab/platform-match-rail.tsx
// ============================================================================
// PLATFORM MATCH RAIL — Left Rail: Platform Navigator (State 1)
// ============================================================================
// Tier-grouped list of all 40 AI image platforms. Clickable rows select
// a provider in the centre column's PlaygroundWorkspace.
//
// Part 1 of the left rail build — State 1 (navigator) only.
// State 2 (scoring panel with Call 4) ships in a later part.
//
// Human factors:
//   §7 Spatial Framing — tier groups create mental map, reducing cognitive
//       load for 40-platform selection.
//   §13 Fitts's Law — full-width clickable rows, large target area.
//   §12 Von Restorff — tier colour dots isolate groups visually.
//
// Code standards:
//   - All sizing via clamp() (§6.0)
//   - No grey text — dimmest allowed is text-slate-400 (#94A3B8) (§6.0.2)
//   - cursor-pointer on all clickable elements (§6.0.4)
//   - No opacity dimming for state indication (§6.0.3)
//   - prefers-reduced-motion respected (§18)
//   - Scrollbar matches rail standard
//
// Authority: docs/authority/lefthand-rail.md v1.2.0 §5
// Existing features preserved: Yes (new file, no modifications).
// ============================================================================

'use client';

import React, { useMemo } from 'react';
import type { Provider } from '@/types/providers';
import { getRawPlatformConfig } from '@/data/providers/platform-config';

// ============================================================================
// TIER METADATA — Matches tier-showcase.tsx TIER_META (single visual language)
// ============================================================================

const TIER_META: Record<number, { label: string; color: string }> = {
  1: { label: 'CLIP-Based', color: '#60a5fa' },      // blue-400
  2: { label: 'Midjourney', color: '#c084fc' },       // purple-400
  3: { label: 'Natural Language', color: '#34d399' },  // emerald-400
  4: { label: 'Plain Language', color: '#fb923c' },    // orange-400
};

// Tier display order
const TIER_ORDER = [1, 2, 3, 4] as const;

// ============================================================================
// TYPES
// ============================================================================

interface TierGroup {
  tier: number;
  label: string;
  color: string;
  platforms: { id: string; name: string }[];
}

export interface PlatformMatchRailProps {
  /** All providers from the catalog */
  providers: Provider[];
  /** Currently selected provider ID (null = none) */
  selectedProviderId: string | null;
  /** Callback when user clicks a platform in the rail */
  onSelectProvider: (providerId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PlatformMatchRail({
  providers,
  selectedProviderId,
  onSelectProvider,
}: PlatformMatchRailProps) {
  // ── Build tier groups from providers + platform-config ────────────
  const tierGroups = useMemo<TierGroup[]>(() => {
    const groups = new Map<number, { id: string; name: string }[]>();

    for (const provider of providers) {
      const config = getRawPlatformConfig(provider.id);
      const tier = config?.tier ?? 3; // fallback to T3 if missing
      if (!groups.has(tier)) groups.set(tier, []);
      groups.get(tier)!.push({ id: provider.id, name: provider.name });
    }

    // Sort platforms alphabetically within each tier
    for (const platforms of groups.values()) {
      platforms.sort((a, b) => a.name.localeCompare(b.name));
    }

    return TIER_ORDER
      .filter((t) => groups.has(t))
      .map((t) => ({
        tier: t,
        label: TIER_META[t]?.label ?? `Tier ${t}`,
        color: TIER_META[t]?.color ?? '#94A3B8',
        platforms: groups.get(t) ?? [],
      }));
  }, [providers]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(8px, 0.8vw, 14px)',
      }}
    >
      {/* ── Heading ─────────────────────────────────────────────────── */}
      <h3
        className="bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent"
        style={{
          fontSize: 'clamp(0.7rem, 0.95vw, 1.1rem)',
          fontWeight: 600,
          lineHeight: 1.2,
          margin: 0,
        }}
      >
        Platform Match
      </h3>

      {/* ── Tier groups ─────────────────────────────────────────────── */}
      {tierGroups.map((group) => (
        <div
          key={group.tier}
          style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(2px, 0.2vw, 4px)' }}
        >
          {/* Tier header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 'clamp(6px, 0.5vw, 8px)',
              paddingBottom: 'clamp(2px, 0.2vw, 4px)',
              borderBottom: `2px solid ${group.color}`,
              marginBottom: 'clamp(2px, 0.2vw, 4px)',
            }}
          >
            <span
              style={{
                fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)',
                fontWeight: 600,
                color: '#FFFFFF',
                lineHeight: 1.3,
              }}
            >
              {group.label}
            </span>
            <span
              style={{
                fontSize: 'clamp(10px, 0.65vw, 11px)',
                color: '#94A3B8', // slate-400 — dimmest allowed
                lineHeight: 1.3,
              }}
            >
              {group.platforms.length} {group.platforms.length === 1 ? 'platform' : 'platforms'}
            </span>
          </div>

          {/* Platform rows */}
          {group.platforms.map((platform) => {
            const isSelected = platform.id === selectedProviderId;
            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => onSelectProvider(platform.id)}
                className="cursor-pointer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'clamp(6px, 0.5vw, 10px)',
                  padding: 'clamp(4px, 0.35vw, 6px) clamp(8px, 0.6vw, 10px)',
                  borderRadius: 'clamp(4px, 0.3vw, 6px)',
                  border: 'none',
                  borderLeft: isSelected
                    ? `2px solid ${group.color}`
                    : '2px solid transparent',
                  background: isSelected
                    ? `${group.color}0F` // tier colour at ~6% opacity
                    : 'transparent',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = `${group.color}0A`; // ~4% opacity
                    e.currentTarget.style.borderLeftColor = `${group.color}4D`; // ~30% opacity
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderLeftColor = 'transparent';
                  }
                }}
                aria-pressed={isSelected}
                aria-label={`Select ${platform.name} (${group.label})`}
              >
                {/* Tier colour dot */}
                <span
                  style={{
                    width: 'clamp(5px, 0.4vw, 7px)',
                    height: 'clamp(5px, 0.4vw, 7px)',
                    borderRadius: '50%',
                    backgroundColor: group.color,
                    flexShrink: 0,
                    opacity: isSelected ? 1 : 0.6,
                    transition: 'opacity 0.15s ease',
                  }}
                  aria-hidden="true"
                />

                {/* Platform name */}
                <span
                  style={{
                    fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)',
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? '#FFFFFF' : '#E2E8F0', // white or slate-200
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    transition: 'color 0.15s ease, font-weight 0.15s ease',
                  }}
                >
                  {platform.name}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default PlatformMatchRail;
