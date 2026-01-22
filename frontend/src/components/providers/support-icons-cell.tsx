// src/components/providers/support-icons-cell.tsx
//
// Social media icons cell for AI Providers leaderboard.
// Displays clickable social media icons with hover effects.
//
// Features:
// - Default: 70% opacity (slightly dimmed)
// - Hover: 100% opacity + scale(1.15) + glow + colorful tooltip
// - Tooltip shows "{Provider} on {Platform}" with platform-colored glow
// - Clickable → opens official page in new tab
// - 18px icons (1.5x the 12px flag size)
// - X/Twitter uses white icon with dark outline for visibility
// - Pinterest uses red (#E60023)
// - 2-row layout: If 5+ icons, splits into rows of 4
//   - Row 1 (top): tooltip opens above
//   - Row 2 (bottom): tooltip opens below
// - Icons are centered within the cell
//
// Platform order: LinkedIn → Instagram → Facebook → YouTube → Discord → Reddit → TikTok → Pinterest → X
//
// Updated: Jan 18, 2026 - Added Pinterest and X, restored tooltip with colored glow, added scale(1.15)
// Updated: Jan 18, 2026 - Added 2-row layout with smart tooltip direction (4 icons per row)
// Updated: Jan 18, 2026 - Fixed X icon visibility with dark outline
// Updated: Jan 22, 2026 - Centered icons within cell (justify-center)
// Existing features preserved: Yes

'use client';

import React, { useState } from 'react';
import type { ProviderSocials } from '@/types/providers';

export interface SupportIconsCellProps {
  providerName: string;
  socials?: ProviderSocials | null;
}

// Number of icons per row before wrapping to second row
const ICONS_PER_ROW = 4;

// Brand colors for each platform (vibrant, full color)
// X uses white (#FFFFFF) with dark outline for visibility on dark backgrounds
const SOCIAL_CONFIG: Record<
  keyof ProviderSocials,
  { label: string; color: string; glowColor: string; icon: React.FC<{ size: number; color: string }> }
> = {
  linkedin: {
    label: 'LinkedIn',
    color: '#0A66C2',
    glowColor: '#0A66C2',
    icon: LinkedInIcon,
  },
  instagram: {
    label: 'Instagram',
    color: '#E4405F',
    glowColor: '#E4405F',
    icon: InstagramIcon,
  },
  facebook: {
    label: 'Facebook',
    color: '#1877F2',
    glowColor: '#1877F2',
    icon: FacebookIcon,
  },
  youtube: {
    label: 'YouTube',
    color: '#FF0000',
    glowColor: '#FF0000',
    icon: YouTubeIcon,
  },
  discord: {
    label: 'Discord',
    color: '#5865F2',
    glowColor: '#5865F2',
    icon: DiscordIcon,
  },
  reddit: {
    label: 'Reddit',
    color: '#FF4500',
    glowColor: '#FF4500',
    icon: RedditIcon,
  },
  tiktok: {
    label: 'TikTok',
    color: '#00F2EA',
    glowColor: '#00F2EA',
    icon: TikTokIcon,
  },
  pinterest: {
    label: 'Pinterest',
    color: '#E60023',
    glowColor: '#E60023',
    icon: PinterestIcon,
  },
  x: {
    label: 'X',
    color: '#FFFFFF',
    glowColor: 'rgba(255, 255, 255, 0.6)',
    icon: XIcon,
  },
};

// The platforms to display in order
const PLATFORM_ORDER: (keyof ProviderSocials)[] = [
  'linkedin',
  'instagram',
  'facebook',
  'youtube',
  'discord',
  'reddit',
  'tiktok',
  'pinterest',
  'x',
];

/**
 * Convert hex colour to rgba with alpha.
 */
function hexToRgba(hex: string, alpha: number): string {
  // Handle rgba strings (for X's glowColor)
  if (hex.startsWith('rgba')) return hex;
  
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Individual social icon with hover glow effect and tooltip
 * @param tooltipDirection - 'above' for row 1, 'below' for row 2
 */
function SocialIconLink({
  platform,
  url,
  providerName,
  tooltipDirection = 'above',
}: {
  platform: keyof ProviderSocials;
  url: string;
  providerName: string;
  tooltipDirection?: 'above' | 'below';
}) {
  const [isHovered, setIsHovered] = useState(false);

  const config = SOCIAL_CONFIG[platform];
  if (!config) return null;

  const { label, color, glowColor, icon: IconComponent } = config;
  const ariaLabel = `${providerName} on ${label}`;
  const tooltipText = `${providerName} on ${label}`;

  const iconGlowRgba = hexToRgba(glowColor, 0.5);
  const tooltipGlowRgba = hexToRgba(glowColor, 0.4);

  // Tooltip positioning based on direction
  const tooltipPositionClasses = tooltipDirection === 'above'
    ? 'bottom-full mb-2'  // Opens above: positioned at bottom of tooltip, margin below
    : 'top-full mt-2';    // Opens below: positioned at top of tooltip, margin above

  // Arrow positioning based on direction
  const arrowClasses = tooltipDirection === 'above'
    ? 'top-full border-t-slate-900'  // Arrow points down (tooltip above)
    : 'bottom-full border-b-slate-900'; // Arrow points up (tooltip below)

  const arrowStyle = tooltipDirection === 'above'
    ? { borderTopColor: 'rgb(15 23 42)' }   // slate-900
    : { borderBottomColor: 'rgb(15 23 42)' }; // slate-900

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="support-icon-link relative inline-flex"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={ariaLabel}
    >
      {/* Icon with dimmed default, bright on hover with glow + scale */}
      <span
        className="support-icon-wrapper transition-all duration-200"
        style={{
          opacity: isHovered ? 1 : 0.7,
          transform: isHovered ? 'scale(1.15)' : 'scale(1)',
          filter: isHovered ? `drop-shadow(0 0 4px ${iconGlowRgba}) drop-shadow(0 0 8px ${iconGlowRgba})` : 'none',
        }}
      >
        <IconComponent size={18} color={color} />
      </span>

      {/* Tooltip with platform-colored glow */}
      {isHovered && (
        <span
          className={`support-icon-tooltip absolute left-1/2 -translate-x-1/2 ${tooltipPositionClasses} px-2 py-1 text-xs font-medium text-white bg-slate-900 rounded whitespace-nowrap pointer-events-none z-50 transition-opacity duration-150`}
          style={{
            boxShadow: `0 0 8px ${tooltipGlowRgba}, 0 0 16px ${tooltipGlowRgba}`,
            border: `1px solid ${hexToRgba(glowColor, 0.3)}`,
          }}
        >
          {tooltipText}
          {/* Tooltip arrow */}
          <span
            className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${arrowClasses}`}
            style={arrowStyle}
          />
        </span>
      )}
    </a>
  );
}

/**
 * Support icons cell - displays social media icons for a provider
 * Uses 2-row layout with smart tooltip direction if 5+ icons
 */
export function SupportIconsCell({ providerName, socials }: SupportIconsCellProps) {
  // Filter to only platforms with valid URLs
  const activePlatforms = PLATFORM_ORDER.filter((platform) => {
    const url = socials?.[platform];
    return typeof url === 'string' && url.trim().length > 0;
  });

  if (activePlatforms.length === 0) {
    return <span className="text-slate-500">—</span>;
  }

  // Check if we need 2 rows (5+ icons means we split)
  const needsTwoRows = activePlatforms.length > ICONS_PER_ROW;

  if (!needsTwoRows) {
    // Single row - all tooltips open above, centered
    return (
      <div className="support-icons-cell flex items-center justify-center gap-2">
        {activePlatforms.map((platform) => (
          <SocialIconLink
            key={platform}
            platform={platform}
            url={socials![platform]!}
            providerName={providerName}
            tooltipDirection="above"
          />
        ))}
      </div>
    );
  }

  // Two rows layout
  const row1Platforms = activePlatforms.slice(0, ICONS_PER_ROW);  // First 4 icons
  const row2Platforms = activePlatforms.slice(ICONS_PER_ROW);     // Remaining icons

  return (
    <div className="support-icons-cell flex flex-col items-center gap-1">
      {/* Row 1: First 4 icons - tooltips open ABOVE, centered */}
      <div className="flex items-center justify-center gap-2">
        {row1Platforms.map((platform) => (
          <SocialIconLink
            key={platform}
            platform={platform}
            url={socials![platform]!}
            providerName={providerName}
            tooltipDirection="above"
          />
        ))}
      </div>
      {/* Row 2: Remaining icons - tooltips open BELOW, centered */}
      <div className="flex items-center justify-center gap-2">
        {row2Platforms.map((platform) => (
          <SocialIconLink
            key={platform}
            platform={platform}
            url={socials![platform]!}
            providerName={providerName}
            tooltipDirection="below"
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SVG Icons (18px, full color)
// ============================================================================

function LinkedInIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function InstagramIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function FacebookIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function YouTubeIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function DiscordIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function RedditIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
    >
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}

function TikTokIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
    >
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function PinterestIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
    >
      <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
    </svg>
  );
}

/**
 * X (Twitter) Icon with dark outline for visibility on dark backgrounds
 * White fill with subtle dark stroke for contrast
 */
function XIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {/* Dark outline for contrast on dark backgrounds */}
      <path 
        d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
        fill="none"
        stroke="rgba(0,0,0,0.6)"
        strokeWidth="1.5"
      />
      {/* White fill on top */}
      <path 
        d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
        fill={color}
      />
    </svg>
  );
}

export default SupportIconsCell;
