// src/data/pro-promagen/presets.ts
// ============================================================================
// PRO PROMAGEN PRESETS
// ============================================================================
// Quick selection presets for exchanges and FX pairs.
// Provides one-click sensible defaults for regional focus.
//
// v3.0.0: FX Pairs row removed (no longer configurable).
//         Scene Starters + Saved Prompts rows added.
//         Weather tooltip updated to clarify ALL flags, not just weather.
//
// Authority: docs/authority/paid_tier.md §5.10
// ============================================================================

import type { ExchangePreset, FxPreset } from '@/lib/pro-promagen/types';

// ============================================================================
// EXCHANGE PRESETS
// ============================================================================

export const EXCHANGE_PRESETS: ExchangePreset[] = [
  {
    id: 'asia-pacific',
    label: 'Asia Pacific',
    description: 'Major exchanges from Sydney to Tokyo',
    exchangeIds: [
      'asx-sydney',
      'tse-tokyo',
      'hkex-hong-kong',
      'sgx-singapore',
      'sse-shanghai',
      'krx-seoul',
      'bse-mumbai',
      'nse-mumbai',
      'nzx-wellington',
      'twse-taipei',
      'idx-jakarta',
      'set-bangkok',
    ],
    gradient: 'from-rose-500 via-orange-500 to-amber-500',
    glow: 'rgba(251, 113, 133, 0.15)',
    accent: 'text-rose-400',
  },
  {
    id: 'americas',
    label: 'Americas',
    description: 'NYSE to São Paulo and beyond',
    exchangeIds: [
      'nyse-new-york',
      'nasdaq-new-york',
      'tsx-toronto',
      'bmv-mexico-city',
      'b3-sao-paulo',
      'sse-santiago',
      'bcba-buenos-aires',
      'bvc-bogota',
      'bvl-lima',
      'cboe-chicago',
    ],
    gradient: 'from-blue-500 via-indigo-500 to-violet-500',
    glow: 'rgba(99, 102, 241, 0.15)',
    accent: 'text-blue-400',
  },
  {
    id: 'europe-emea',
    label: 'Europe & Middle East',
    description: 'London to Riyadh',
    exchangeIds: [
      'lse-london',
      'euronext-paris',
      'xetra-frankfurt',
      'six-zurich',
      'borsa-italiana-milan',
      'bme-madrid',
      'euronext-amsterdam',
      'omx-stockholm',
      'moex-moscow',
      'tadawul-riyadh',
      'dfm-dubai',
      'jse-johannesburg',
    ],
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    glow: 'rgba(20, 184, 166, 0.15)',
    accent: 'text-emerald-400',
  },
  {
    id: 'global-majors',
    label: 'Global Majors',
    description: 'The world\'s largest exchanges',
    exchangeIds: [
      'nyse-new-york',
      'nasdaq-new-york',
      'lse-london',
      'tse-tokyo',
      'sse-shanghai',
      'hkex-hong-kong',
      'euronext-paris',
      'xetra-frankfurt',
      'tsx-toronto',
      'bse-mumbai',
      'asx-sydney',
      'sgx-singapore',
    ],
    gradient: 'from-sky-500 via-blue-500 to-indigo-500',
    glow: 'rgba(56, 189, 248, 0.15)',
    accent: 'text-sky-400',
  },
  {
    id: 'emerging-markets',
    label: 'Emerging Markets',
    description: 'High-growth economies',
    exchangeIds: [
      'bse-mumbai',
      'sse-shanghai',
      'b3-sao-paulo',
      'jse-johannesburg',
      'bist-istanbul',
      'idx-jakarta',
      'set-bangkok',
      'klse-kuala-lumpur',
      'pse-manila',
      'ngx-lagos',
    ],
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    glow: 'rgba(245, 158, 11, 0.15)',
    accent: 'text-amber-400',
  },
];

// ============================================================================
// FX PRESETS
// ============================================================================

export const FX_PRESETS: FxPreset[] = [
  {
    id: 'major-pairs',
    label: 'Major Pairs',
    description: 'G10 currency majors',
    pairIds: [
      'eur-usd',
      'gbp-usd',
      'usd-jpy',
      'usd-chf',
      'aud-usd',
      'usd-cad',
      'nzd-usd',
      'eur-gbp',
    ],
    gradient: 'from-sky-500 via-blue-500 to-indigo-500',
    glow: 'rgba(56, 189, 248, 0.15)',
    accent: 'text-sky-400',
  },
  {
    id: 'eur-crosses',
    label: 'EUR Crosses',
    description: 'Euro against major currencies',
    pairIds: [
      'eur-usd',
      'eur-gbp',
      'eur-jpy',
      'eur-chf',
      'eur-aud',
      'eur-cad',
      'eur-nzd',
      'eur-sek',
    ],
    gradient: 'from-blue-500 via-indigo-500 to-violet-500',
    glow: 'rgba(99, 102, 241, 0.15)',
    accent: 'text-blue-400',
  },
  {
    id: 'jpy-crosses',
    label: 'JPY Crosses',
    description: 'Yen pairs for carry trades',
    pairIds: [
      'usd-jpy',
      'eur-jpy',
      'gbp-jpy',
      'aud-jpy',
      'nzd-jpy',
      'cad-jpy',
      'chf-jpy',
      'sgd-jpy',
    ],
    gradient: 'from-rose-500 via-pink-500 to-fuchsia-500',
    glow: 'rgba(236, 72, 153, 0.15)',
    accent: 'text-rose-400',
  },
  {
    id: 'commodity-currencies',
    label: 'Commodity FX',
    description: 'Resource-linked currencies',
    pairIds: [
      'aud-usd',
      'usd-cad',
      'nzd-usd',
      'usd-nok',
      'usd-zar',
      'usd-rub',
      'aud-nzd',
      'aud-cad',
    ],
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    glow: 'rgba(245, 158, 11, 0.15)',
    accent: 'text-amber-400',
  },
  {
    id: 'emerging-fx',
    label: 'Emerging FX',
    description: 'High-yield EM currencies',
    pairIds: [
      'usd-mxn',
      'usd-brl',
      'usd-zar',
      'usd-try',
      'usd-inr',
      'usd-cny',
      'usd-sgd',
      'usd-thb',
    ],
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    glow: 'rgba(20, 184, 166, 0.15)',
    accent: 'text-emerald-400',
  },
  {
    id: 'asia-pacific-fx',
    label: 'Asia Pacific FX',
    description: 'Asian currency pairs',
    pairIds: [
      'usd-jpy',
      'usd-cny',
      'usd-hkd',
      'usd-sgd',
      'usd-krw',
      'aud-usd',
      'nzd-usd',
      'usd-inr',
    ],
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    glow: 'rgba(139, 92, 246, 0.15)',
    accent: 'text-violet-400',
  },
];

// ============================================================================
// FEATURE COMPARISON TABLE DATA
// ============================================================================
// Authority: docs/authority/paid_tier.md §5.10
//
// v3.0.0 (10 Mar 2026):
// - REMOVED: FX Pairs row (FX pairs are now fixed, not configurable)
// - ADDED: Scene Starters row (25 free / 200 total)
// - ADDED: Saved Prompts row (browser only vs cross-device)
// - KEPT: Exchanges, Weather Prompt Format, Reference Frame, Daily Prompts,
//         Prompt Stacking
// ============================================================================

export interface FeatureRow {
  /** Feature name displayed in left column */
  feature: string;
  /** Standard tier value */
  standard: string;
  /** Pro tier value */
  pro: string;
  /** Whether to highlight this row */
  highlight: boolean;
  /** Whether this row has an interactive dropdown in Pro column */
  hasDropdown?: 'exchange' | 'weather-prompt-tier';
  /** Optional tooltip explanation */
  tooltip?: string;
}

export const FEATURE_COMPARISON: FeatureRow[] = [
  {
    feature: 'Exchanges',
    standard: '16 fixed',
    pro: '0–16, your choice',
    highlight: true,
    hasDropdown: 'exchange',
  },
  {
    feature: 'All Prompt Format',
    standard: 'Varies by surface',
    pro: 'Select any tier (1–4)',
    highlight: true,
    hasDropdown: 'weather-prompt-tier',
    tooltip: 'Choose prompt format for ALL flag tooltips across the site: CLIP-Based, Midjourney, Natural Language, or Plain Language',
  },
  {
    feature: 'Scene Starters',
    standard: '25 free scenes',
    pro: '200 scenes across 23 worlds',
    highlight: true,
    tooltip: 'One-click scene presets that prefill 5–8 categories in the prompt builder',
  },
  {
    feature: 'Saved Prompts',
    standard: 'Browser only',
    pro: 'Saved across devices',
    highlight: false,
    tooltip: 'Save prompts from any tooltip or the builder. Pro syncs across all your devices',
  },
  {
    feature: 'Reference Frame',
    standard: 'Your location',
    pro: 'Toggle: You / Greenwich',
    highlight: false,
  },
  {
    feature: 'Daily Prompts',
    standard: '5 per day',
    pro: 'Unlimited',
    highlight: true,
  },
  {
    feature: 'Prompt Stacking',
    standard: 'Base limits',
    pro: '+1 on 7 categories',
    highlight: false,
    tooltip: 'Extra selection on Style, Lighting, Colour, Atmosphere, Materials, Fidelity, and Negative categories',
  },
  {
    feature: 'Vote Weight',
    standard: '1.0×',
    pro: '1.5× influence',
    highlight: false,
    tooltip: 'Your votes on AI provider image quality rankings carry 50% more weight',
  },
];

// ============================================================================
// WEATHER PROMPT TIER OPTIONS (for dropdown)
// ============================================================================

export interface WeatherPromptTierOption {
  id: string;
  tier: 1 | 2 | 3 | 4;
  label: string;
  subLabel: string;
  platforms: string;
}

export const WEATHER_PROMPT_TIER_OPTIONS: WeatherPromptTierOption[] = [
  {
    id: 'tier-1',
    tier: 1,
    label: 'Tier 1: CLIP-Based',
    subLabel: 'Weighted keywords with emphasis',
    platforms: 'Stable Diffusion, Leonardo, Flux',
  },
  {
    id: 'tier-2',
    tier: 2,
    label: 'Tier 2: Midjourney',
    subLabel: 'Natural flow with parameter flags',
    platforms: 'Midjourney, BlueWillow, Niji',
  },
  {
    id: 'tier-3',
    tier: 3,
    label: 'Tier 3: Natural Language',
    subLabel: 'Full descriptive sentences',
    platforms: 'DALL·E, Imagen, Adobe Firefly',
  },
  {
    id: 'tier-4',
    tier: 4,
    label: 'Tier 4: Plain Language',
    subLabel: 'Simple, minimal prompts (FREE default)',
    platforms: 'Canva, Craiyon, Artistly',
  },
];
