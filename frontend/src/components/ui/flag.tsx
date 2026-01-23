// frontend/src/components/ui/flag.tsx
//
// Single, reusable flag glyph for the whole site.
//
// Policy:
// - Prefer SVGs in /public/flags when they exist (manifest-backed via flagSrc()).
// - Fall back to emoji when an SVG is not available.
// - Accessibility:
//   - By default flags are decorative (aria-hidden) when shown alongside text (e.g. "GBP").
//   - For cases where the flag carries meaning on its own, set decorative={false}.

import * as React from 'react';

import { countryCodeToFlagEmoji, flagAriaLabel, flagSrc } from '@/data/flags/flags';

export type FlagProps = {
  countryCode?: string | null;
  /** Pixel size for the glyph (applies to SVG img width/height). */
  size?: number;
  /** Additional classes on the outer wrapper. */
  className?: string;
  /**
   * If true (default), the flag is treated as decorative and hidden from screen readers.
   * If false, we expose a stable label for accessibility.
   */
  decorative?: boolean;
  /** Custom tooltip text. If not provided, uses country name from flagAriaLabel. */
  title?: string;
};

export function Flag({ countryCode, size = 12, className, decorative = true, title: customTitle }: FlagProps) {
  const src = flagSrc(countryCode);
  const emoji = countryCodeToFlagEmoji(countryCode);
  const label = countryCode ? flagAriaLabel(countryCode) : undefined;
  // Use custom title if provided, otherwise fall back to label
  const tooltipText = customTitle ?? label;

  // Nothing to show.
  if (!src && !emoji) return null;

  // Wrapper keeps layout consistent regardless of SVG vs emoji.
  const wrapperProps: React.HTMLAttributes<HTMLSpanElement> = decorative
    ? { 'aria-hidden': 'true' }
    : { role: 'img', 'aria-label': label ?? 'Flag' };

  return (
    <span className={className ?? 'inline-flex items-center'} {...wrapperProps}>
      {src ? (
        // Using <img> intentionally for tiny local SVGs in /public (simple + fast).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          width={size}
          height={size}
          alt={decorative ? '' : label ?? 'Flag'}
          title={tooltipText}
          className="block"
        />
      ) : (
        <span title={tooltipText}>{emoji}</span>
      )}
    </span>
  );
}

export default Flag;
