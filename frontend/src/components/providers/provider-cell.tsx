// src/components/providers/provider-cell.tsx
// ============================================================================
// Provider Cell - Individual provider row in the leaderboard table
// ============================================================================
// Market Pulse v2.0: City connection badges REMOVED.
// Visual connection now shown via flowing energy particles in SVG overlay.
// ============================================================================

'use client';

import React from 'react';
import type { Provider } from '@/types/provider';
import { ProviderClock } from './provider-clock';
import { Flag } from '@/components/ui/flag';

export type ProviderCellProps = {
  provider: Provider;
  /** Display rank (1, 2, 3…) — reflects current sort order */
  rank?: number;
};

/** Fallback icon path if provider icon fails to load */
const FALLBACK_ICON = '/icons/providers/fallback.png';

/** Providers that should use 🏠 emoji instead of icon */
const EMOJI_FALLBACK_PROVIDERS = ['dreamstudio'];

export function ProviderCell({ provider, rank }: ProviderCellProps) {
  // Check if this provider should use emoji fallback
  const useEmojiIcon = EMOJI_FALLBACK_PROVIDERS.includes(provider.id);
  
  // Local icon path: /icons/providers/{id}.png
  const iconPath = provider.localIcon || `/icons/providers/${provider.id}.png`;

  // Homepage URL via redirect
  const homepageUrl = `/go/${encodeURIComponent(provider.id)}?src=leaderboard_homepage`;

  return (
    <div className="provider-cell-container">
      {/* Line 1: Rank + Provider name (linked) + provider logo icon */}
      <div className="provider-name-row">
        {typeof rank === 'number' && rank > 0 && (
          <span className="provider-rank">{rank}.</span>
        )}
        
        {/* Provider name — hyperlinked to homepage */}
        <a
          href={homepageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="provider-name-link"
          aria-label={`Visit ${provider.name} website (opens in new tab)`}
        >
          {provider.name}
        </a>

        {/* Provider logo icon OR 🏠 emoji for specific providers */}
        <a
          href={homepageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="provider-logo-link"
          aria-label={`Visit ${provider.name} website (opens in new tab)`}
        >
          {useEmojiIcon ? (
            <span className="provider-emoji-icon" aria-hidden="true">🏠</span>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element -- 
               Using <img> for onError fallback handling which next/image doesn't support well.
               These are small 18x18px icons with minimal LCP impact. */
            <img
              src={iconPath}
              alt=""
              className="provider-logo-icon"
              onError={(e) => {
                // Fallback if icon fails to load
                const target = e.currentTarget;
                if (target.src !== FALLBACK_ICON) {
                  target.src = FALLBACK_ICON;
                }
              }}
            />
          )}
        </a>
      </div>

      {/* Line 2 & 3: Location block — Flag + City, then Time + Prompt builder below */}
      {provider.countryCode && provider.hqCity && provider.timezone ? (
        <div className="provider-location">
          {/* Flag + City */}
          <div className="provider-city-line">
            <Flag countryCode={provider.countryCode} size={16} decorative />
            <span className="provider-city">{provider.hqCity}</span>
          </div>

          {/* Time + Prompt builder (🎨 + text) on same line */}
          <div className="provider-time-line">
            <ProviderClock
              timezone={provider.timezone}
              supportHours={provider.supportHours}
            />

            {/* Prompt builder link — emoji + text, both clickable */}
            <a
              href={`/providers/${encodeURIComponent(provider.id)}/prompt-builder`}
              className="provider-prompt-link"
              aria-label={`Open ${provider.name} Prompt Generator`}
            >
              <span className="provider-prompt-emoji" aria-hidden="true">🎨</span>
              <span className="provider-prompt-text">Prompt builder</span>
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
