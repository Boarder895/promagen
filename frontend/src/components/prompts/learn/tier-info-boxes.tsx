// src/components/prompts/learn/tier-info-boxes.tsx
// ============================================================================
// TIER INFO BOXES
// ============================================================================
// Displays the 4 platform tiers at the bottom of the Learn page.
// - No platform selected: Shows all 4 tier info boxes (information only)
// - Platform selected: Shows only the relevant tier, others hidden
// Authority: docs/authority/prompt-builder-page.md §Platform-Aware Selection Limits
// ============================================================================

'use client';

import React from 'react';
import { getAllTiers, getPlatformTier, type PlatformTier } from '@/data/platform-tiers';

// ============================================================================
// TYPES
// ============================================================================

export interface TierInfoBoxesProps {
  /** Currently selected platform ID, or null if none */
  selectedPlatformId: string | null;
  /** Map of platform ID to display name */
  platformNames: Map<string, string>;
}

// ============================================================================
// TIER BOX COMPONENT
// ============================================================================

interface TierBoxProps {
  tier: PlatformTier;
  isHighlighted: boolean;
  selectedPlatformId: string | null;
  platformNames: Map<string, string>;
}

function TierBox({ tier, isHighlighted, selectedPlatformId, platformNames }: TierBoxProps) {
  // Get tier-specific border color
  const getBorderColor = () => {
    switch (tier.id) {
      case 1: return 'border-purple-500/40';
      case 2: return 'border-amber-500/40';
      case 3: return 'border-sky-500/40';
      case 4: return 'border-emerald-500/40';
      default: return 'border-white/10';
    }
  };

  // Get tier-specific accent color
  const getAccentColor = () => {
    switch (tier.id) {
      case 1: return 'text-purple-400';
      case 2: return 'text-amber-400';
      case 3: return 'text-sky-400';
      case 4: return 'text-emerald-400';
      default: return 'text-white/70';
    }
  };

  // Get tier-specific bg tint
  const getBgTint = () => {
    switch (tier.id) {
      case 1: return 'bg-purple-500/5';
      case 2: return 'bg-amber-500/5';
      case 3: return 'bg-sky-500/5';
      case 4: return 'bg-emerald-500/5';
      default: return 'bg-white/5';
    }
  };

  // Format platform list
  const formatPlatformList = () => {
    return tier.platforms.map((id) => platformNames.get(id) ?? id).join(', ');
  };

  return (
    <div
      className={`
        rounded-xl border p-4 transition-all
        ${getBorderColor()} ${getBgTint()}
        ${isHighlighted ? 'ring-1 ring-white/20 shadow-lg' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${getAccentColor()}`}>
          Tier {tier.id}
        </span>
        <span className="text-sm font-medium text-white">
          {tier.name}
        </span>
      </div>

      {/* Prompt Style */}
      <p className={`text-xs font-medium mb-3 ${getAccentColor()}`}>
        {tier.promptStyle}
      </p>

      {/* Description */}
      <p className="text-xs text-white/60 leading-relaxed mb-3">
        {isHighlighted && selectedPlatformId ? (
          <>
            <strong className="text-white/80">
              {platformNames.get(selectedPlatformId)}
            </strong>{' '}
            uses {tier.promptStyle.toLowerCase()}.{' '}
            {tier.description.split('.')[1] || tier.description}
          </>
        ) : (
          tier.description
        )}
      </p>

      {/* Tips */}
      <div className="mb-3">
        <p className="text-[0.65rem] font-medium text-white/40 uppercase tracking-wide mb-1.5">
          Quick Tips
        </p>
        <ul className="space-y-1">
          {tier.tips.slice(0, 3).map((tip, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-white/50">
              <span className={`mt-1 ${getAccentColor()}`}>•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Platform List */}
      <div>
        <p className="text-[0.65rem] font-medium text-white/40 uppercase tracking-wide mb-1">
          {tier.platforms.length} Platforms
        </p>
        <p className="text-xs text-white/40 leading-relaxed">
          {isHighlighted && selectedPlatformId ? (
            <>
              Also in this tier:{' '}
              {tier.platforms
                .filter((id) => id !== selectedPlatformId)
                .slice(0, 5)
                .map((id) => platformNames.get(id) ?? id)
                .join(', ')}
              {tier.platforms.length > 6 && '...'}
            </>
          ) : (
            formatPlatformList()
          )}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TierInfoBoxes({ selectedPlatformId, platformNames }: TierInfoBoxesProps) {
  const allTiers = getAllTiers();
  const selectedTier = selectedPlatformId ? getPlatformTier(selectedPlatformId) : null;

  return (
    <section className="mt-6">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide">
          {selectedPlatformId ? 'Your Platform\'s Tier' : 'Platform Tiers'}
        </h3>
        {selectedPlatformId && selectedTier && (
          <span className="text-xs text-white/30">
            — {platformNames.get(selectedPlatformId)} is {selectedTier.shortName}
          </span>
        )}
      </div>

      {/* Tier Boxes */}
      <div
        className={`
          grid gap-4
          ${selectedPlatformId ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}
        `}
      >
        {selectedPlatformId && selectedTier ? (
          // Only show the relevant tier when platform selected
          <TierBox
            tier={selectedTier}
            isHighlighted={true}
            selectedPlatformId={selectedPlatformId}
            platformNames={platformNames}
          />
        ) : (
          // Show all tiers when no platform selected
          allTiers.map((tier) => (
            <TierBox
              key={tier.id}
              tier={tier}
              isHighlighted={false}
              selectedPlatformId={null}
              platformNames={platformNames}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default TierInfoBoxes;
