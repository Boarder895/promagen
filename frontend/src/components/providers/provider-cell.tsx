// src/components/providers/provider-cell.tsx
// ============================================================================
// Provider Cell - Individual provider row in the leaderboard table
// ============================================================================
// Market Pulse v2.0: City connection badges REMOVED.
// Visual connection now shown via flowing energy particles in SVG overlay.
// ============================================================================
// Updated: January 22, 2026
// - Removed prompt builder link (🎨 + "Prompt builder" text)
// - Added API (🔌) and Affiliate (🤝) emoji links in its place
// - 🔌 links to provider's API documentation
// - 🤝 links to provider's affiliate/partner program
// ============================================================================
// Updated: January 27, 2026
// - Added RankUpArrow for providers that climbed in rankings (green ⬆ with glow)
// - Added hasRankUp prop to ProviderCellProps
// ============================================================================

'use client';

import React from 'react';
import type { Provider } from '@/types/provider';
import { ProviderClock } from './provider-clock';
import { Flag } from '@/components/ui/flag';
import Tooltip from '@/components/ui/tooltip';
import { RankUpArrow } from './index-rating-cell';

export type ProviderCellProps = {
  provider: Provider;
  /** Display rank (1, 2, 3…) — reflects current sort order */
  rank?: number;
  /** Whether this provider climbed in rank position within last 24h */
  hasRankUp?: boolean;
};

/** Fallback icon path if provider icon fails to load */
const FALLBACK_ICON = '/icons/providers/fallback.png';

/** Providers that should use 🏠 emoji instead of icon */
const EMOJI_FALLBACK_PROVIDERS = ['dreamstudio'];

/**
 * Renders API and Affiliate emoji links.
 * - 🔌 API: Links to API docs if available, static otherwise
 * - 🤝 Affiliate: Links to affiliate program if available, static otherwise
 */
function ApiAffiliateEmojis({ provider }: { provider: Provider }) {
  const hasApi = provider.apiAvailable;
  const hasAffiliate = provider.affiliateProgramme;

  // Get URLs from provider data
  const apiUrl = provider.apiDocsUrl;
  const affiliateUrl = provider.affiliateUrl;

  // If neither API nor affiliate, render nothing
  if (!hasApi && !hasAffiliate) {
    return null;
  }

  return (
    <span className="provider-api-affiliate-icons">
      {/* API emoji - links to docs if URL available */}
      {hasApi &&
        (apiUrl ? (
          <Tooltip text="API documentation">
            <a
              href={apiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="provider-api-link"
              aria-label={`${provider.name} API documentation (opens in new tab)`}
            >
              <span aria-hidden="true">🔌</span>
            </a>
          </Tooltip>
        ) : (
          <Tooltip text="API available">
            <span className="provider-api-static" aria-label="API available">
              🔌
            </span>
          </Tooltip>
        ))}

      {/* Affiliate emoji - links to program if URL available */}
      {hasAffiliate &&
        (affiliateUrl ? (
          <Tooltip text="Affiliate programme">
            <a
              href={affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="provider-affiliate-link"
              aria-label={`${provider.name} affiliate programme (opens in new tab)`}
            >
              <span aria-hidden="true">🤝</span>
            </a>
          </Tooltip>
        ) : (
          <Tooltip text="Affiliate programme available">
            <span className="provider-affiliate-static" aria-label="Affiliate programme available">
              🤝
            </span>
          </Tooltip>
        ))}
    </span>
  );
}

export function ProviderCell({ provider, rank, hasRankUp = false }: ProviderCellProps) {
  // Check if this provider should use emoji fallback
  const useEmojiIcon = EMOJI_FALLBACK_PROVIDERS.includes(provider.id);

  // Local icon path: /icons/providers/{id}.png
  const iconPath = provider.localIcon || `/icons/providers/${provider.id}.png`;

  // Homepage URL via redirect
  const homepageUrl = `/go/${encodeURIComponent(provider.id)}?src=leaderboard_homepage`;

  return (
    <div className="provider-cell-container">
      {/* Line 1: Rank + Provider name (linked) + provider logo icon + API/Affiliate + RankUp arrow */}
      <div className="provider-name-row">
        {typeof rank === 'number' && rank > 0 && <span className="provider-rank">{rank}.</span>}

        {/* Provider name — hyperlinked to homepage */}
        <a
          href={homepageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="provider-name-link"
          style={{ fontSize: 'clamp(0.6rem, 1vw, 1rem)' }}
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
            <span className="provider-emoji-icon" aria-hidden="true">
              🏠
            </span>
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

        {/* API and Affiliate emoji links */}
        <ApiAffiliateEmojis provider={provider} />

        {/* Green rank-up arrow — shows when provider climbed in rankings (24h) */}
        <RankUpArrow show={hasRankUp} className="rank-up-arrow" />
      </div>

      {/* Line 2 & 3: Location block — Flag + City, then Time below */}
      {provider.countryCode && provider.hqCity && provider.timezone ? (
        <div className="provider-location">
          {/* Flag + City */}
          <div className="provider-city-line">
            <Flag countryCode={provider.countryCode} size={16} decorative />
            <span className="provider-city">{provider.hqCity}</span>
          </div>

          {/* Time */}
          <div className="provider-time-line">
            <ProviderClock timezone={provider.timezone} supportHours={provider.supportHours} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
