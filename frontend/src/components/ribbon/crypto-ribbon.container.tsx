// src/components/ribbon/crypto-ribbon.container.tsx
//
// Container/orchestrator for Crypto ribbon (API Brain compliant):
// - Polls /api/crypto via centralised hook.
// - Joins SSOT crypto metadata + API quotes.
// - Preserves SSOT order end-to-end (no re-sorting).
// - Passes tooltip data (year, founder, fact) + brand colour to ribbon.
// - Formats prices as "$XX,XXX.XX ea" for clarity.
//
// Refresh schedule (coordinated with FX and Commodities):
// - FX:          :00, :30 (base)
// - Commodities: :10, :40 (10 min offset)
// - Crypto:      :20, :50 (20 min offset)
//
// Existing features preserved: Yes

'use client';

import React, { useMemo } from 'react';

import CryptoRibbon, { type CryptoRibbonChip } from '@/components/ribbon/crypto-ribbon';
import type { RichTooltipLine } from '@/components/ui/rich-tooltip';
import { getEmoji } from '@/data/emoji/emoji';
import { useCryptoQuotes } from '@/hooks/use-crypto-quotes';
import { getDefaultFreeCryptoAssets } from '@/lib/crypto/catalog';

// ============================================================================
// BRAND COLOURS - Vibrant and visible on dark backgrounds
// ============================================================================

const CRYPTO_BRAND_COLOURS: Record<string, string> = {
  // Top 10 by market cap
  btc: '#F7931A',    // Bitcoin - orange
  eth: '#627EEA',    // Ethereum - purple
  usdt: '#26A17B',   // Tether - teal
  bnb: '#F3BA2F',    // BNB - yellow
  sol: '#9945FF',    // Solana - violet
  usdc: '#2775CA',   // USDC - blue
  xrp: '#22C55E',    // XRP - vibrant green (was dark silver - invisible)
  ton: '#0098EA',    // Toncoin - sky blue
  doge: '#C3A634',   // Dogecoin - gold/tan
  ada: '#0033AD',    // Cardano - blue
  // Additional popular
  avax: '#E84142',   // Avalanche - red
  shib: '#FFA409',   // Shiba Inu - orange
  dot: '#E6007A',    // Polkadot - pink
  link: '#375BD2',   // Chainlink - blue
  trx: '#FF0013',    // Tron - red
  matic: '#8247E5',  // Polygon - purple
  ltc: '#BFBBBB',    // Litecoin - silver
  bch: '#8DC351',    // Bitcoin Cash - green
  xlm: '#14B8A6',    // Stellar - teal (was black - invisible)
  atom: '#6366F1',   // Cosmos - indigo (was dark blue - invisible)
  uni: '#FF007A',    // Uniswap - pink
  etc: '#328332',    // Ethereum Classic - green
  fil: '#0090FF',    // Filecoin - blue
  apt: '#06B6D4',    // Aptos - cyan (was black - invisible)
  arb: '#28A0F0',    // Arbitrum - blue
  op: '#FF0420',     // Optimism - red
  near: '#00EC97',   // NEAR - green (was black - invisible)
  vet: '#15BDFF',    // VeChain - cyan
  algo: '#00D4A4',   // Algorand - mint (was black - invisible)
  ftm: '#1969FF',    // Fantom - blue
};

// Default fallback
const DEFAULT_CRYPTO_COLOUR = '#38BDF8'; // Cyan

// ============================================================================
// PRICE FORMATTING
// ============================================================================

/**
 * Format crypto price as "$XX,XXX.XX ea" for human readability.
 * - Large values (>= $1): Show 2 decimal places with commas
 * - Small values (< $1): Show up to 4 decimal places
 */
function formatCryptoPrice(value: number): string {
  if (!Number.isFinite(value)) return '—';

  // Format with appropriate decimals
  let formatted: string;

  if (value >= 1000) {
    // Large values: $92,098.00 ea
    formatted = value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (value >= 1) {
    // Medium values: $1.00 ea
    formatted = value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (value >= 0.01) {
    // Small values: $0.07 ea
    formatted = value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  } else {
    // Very small values: $0.0001 ea
    formatted = value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    });
  }

  return `${formatted} ea`;
}

// ============================================================================
// TOOLTIP BUILDER
// ============================================================================

/**
 * Build tooltip lines for a crypto asset.
 * Returns structured data for the RichTooltip component.
 */
function buildCryptoTooltipLines(asset: {
  yearFounded?: number;
  founder?: string;
  fact?: string;
}): RichTooltipLine[] {
  const lines: RichTooltipLine[] = [];

  if (asset.yearFounded) {
    lines.push({ label: 'Founded', value: String(asset.yearFounded) });
  }
  if (asset.founder) {
    lines.push({ label: 'Founder', value: asset.founder });
  }
  if (asset.fact) {
    lines.push({ label: 'Fact', value: asset.fact });
  }

  return lines;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function CryptoRibbonContainer() {
  const { quotes, movementById } = useCryptoQuotes({
    enabled: true,
  });

  const ssot = useMemo(() => getDefaultFreeCryptoAssets(), []);

  const chipData: CryptoRibbonChip[] = useMemo(() => {
    const byId = new Map<string, { value: number | null; prevClose: number | null }>();
    for (const q of quotes) {
      byId.set(q.id, { value: q.value ?? null, prevClose: q.prevClose ?? null });
    }

    return ssot.map((a) => {
      const q = byId.get(a.id);
      const movement = movementById[a.id];

      // Format as "$XX,XXX.XX ea"
      const priceText = typeof q?.value === 'number' ? formatCryptoPrice(q.value) : '—';

      const emoji = getEmoji('currencies', a.id) ?? '🪙';

      // Use ribbonLabel (full name) or fall back to name
      const displayName = (a as { ribbonLabel?: string }).ribbonLabel ?? a.name;

      const label = (
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true">{emoji}</span>
          <span className="font-medium">{displayName}</span>
        </span>
      );

      // Build tooltip data from catalog
      const tooltipLines = buildCryptoTooltipLines(a as {
        yearFounded?: number;
        founder?: string;
        fact?: string;
      });

      // Get brand colour for this asset
      const glowColour = CRYPTO_BRAND_COLOURS[a.id] ?? DEFAULT_CRYPTO_COLOUR;

      return {
        id: a.id,
        label,
        priceText,
        tick: movement?.tick ?? 'flat',
        deltaPct: movement?.deltaPct ?? null,
        tooltipTitle: a.name,
        tooltipLines,
        glowColour,
      };
    });
  }, [movementById, quotes, ssot]);

  return <CryptoRibbon chips={chipData} />;
}
