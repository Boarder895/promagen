// scripts/generate-demo-prompts.ts
// ============================================================================
// COMMUNITY PULSE — Demo Prompt Generator
// ============================================================================
// Generates 210 demo prompts (5 per platform × 42 platforms) using the
// real vocabulary files and the One Brain pipeline:
//   1. selectionsFromMap() or manual selections from vocabulary
//   2. assemblePrompt(platformId, selections) — platform-specific assembly
//   3. optimizePromptGoldStandard({ promptText, selections, platformId })
//
// Run: npx tsx scripts/generate-demo-prompts.ts
// Output: src/data/community-pulse/demo-prompts.json
//
// The output JSON is checked into the repo (like flags.manifest.json).
// The component reads it as static data — no runtime computation.
// ============================================================================

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { assemblePrompt, getAllCategoryOptions } from '../src/lib/prompt-builder';
import { optimizePromptGoldStandard } from '../src/lib/prompt-optimizer';
import { PLATFORM_TIERS } from '../src/data/platform-tiers';
import providers from '../src/data/providers/providers.json';

// ============================================================================
// CONFIG
// ============================================================================

const PROMPTS_PER_PLATFORM = 5;
const OUTPUT_PATH = resolve(__dirname, '../src/data/community-pulse/demo-prompts.json');
const SEED = 42;

// Brand colours per platform
const BRAND_COLORS: Record<string, string> = {
  midjourney: '#7C3AED',
  openai: '#10B981',
  'google-imagen': '#4285F4',
  leonardo: '#EC4899',
  flux: '#F97316',
  stability: '#8B5CF6',
  'adobe-firefly': '#FF6B35',
  ideogram: '#06B6D4',
  playground: '#3B82F6',
  'microsoft-designer': '#0078D4',
  novelai: '#A855F7',
  lexica: '#14B8A6',
  openart: '#F43F5E',
  '123rf': '#EF4444',
  canva: '#00C4CC',
  bing: '#0078D4',
  nightcafe: '#D946EF',
  picsart: '#FF3366',
  artistly: '#8B5CF6',
  fotor: '#22C55E',
  pixlr: '#3B82F6',
  deepai: '#6366F1',
  craiyon: '#FBBF24',
  bluewillow: '#3B82F6',
  dreamstudio: '#A855F7',
  artbreeder: '#10B981',
  'jasper-art': '#F59E0B',
  runway: '#EF4444',
  freepik: '#0EA5E9',
  simplified: '#8B5CF6',
  photoleap: '#EC4899',
  vistacreate: '#F97316',
  artguru: '#06B6D4',
  myedit: '#3B82F6',
  visme: '#7C3AED',
  hotpot: '#F59E0B',
  picwish: '#10B981',
  clipdrop: '#6366F1',
  getimg: '#14B8A6',
  'imagine-meta': '#0668E1',
  dreamlike: '#D946EF',
  'remove-bg': '#22C55E',
};

const COUNTRIES = [
  'US',
  'GB',
  'DE',
  'JP',
  'FR',
  'AU',
  'CA',
  'BR',
  'KR',
  'NL',
  'SG',
  'SE',
  'IT',
  'MX',
  'ZA',
  'IN',
  'ES',
  'PT',
  'NO',
  'DK',
  'FI',
  'AT',
  'CH',
  'BE',
  'IE',
  'NZ',
  'PL',
  'CZ',
  'HU',
  'RO',
  'GR',
  'TR',
  'IL',
  'AE',
  'TH',
  'VN',
  'PH',
  'MY',
  'ID',
  'CO',
  'AR',
  'CL',
];

// ============================================================================
// SEEDED RANDOM (deterministic)
// ============================================================================

let _seed = SEED;
function seededRandom(): number {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(seededRandom() * arr.length)]!;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // Collect all platform IDs from tiers
  const allPlatformIds: string[] = [];
  for (const tier of [1, 2, 3, 4] as const) {
    allPlatformIds.push(...PLATFORM_TIERS[tier].platforms);
  }

  const providerMap = new Map(providers.map((p: { id: string }) => [p.id, p]));

  // Load vocabulary options per category
  const CATEGORIES = [
    'subject',
    'style',
    'lighting',
    'atmosphere',
    'environment',
    'colour',
    'composition',
    'camera',
    'fidelity',
  ] as const;
  const vocabs: Record<string, string[]> = {};
  for (const cat of CATEGORIES) {
    const opts = getAllCategoryOptions(cat);
    vocabs[cat] = opts.filter((o: string) => o.length > 3);
  }

  const entries: Array<Record<string, unknown>> = [];

  for (const pid of allPlatformIds.sort()) {
    const prov = providerMap.get(pid) as Record<string, string> | undefined;
    const pname = prov?.name ?? pid;
    const picon = prov?.localIcon ?? `/icons/providers/${pid}.png`;
    const brand = BRAND_COLORS[pid] ?? '#3B82F6';

    for (let i = 0; i < PROMPTS_PER_PLATFORM; i++) {
      // Build selections from random vocabulary
      const selections: Record<string, string[]> = {};
      for (const cat of CATEGORIES) {
        selections[cat] = [pick(vocabs[cat]!)];
      }

      // Assemble for this specific platform
      const assembled = assemblePrompt(pid, selections);

      // Optimise for this specific platform
      const result = optimizePromptGoldStandard({
        promptText: assembled.positive,
        selections,
        platformId: pid,
      });

      // Description: subject + style
      let desc = `${selections.subject![0]}, ${selections.style![0]}`;
      if (desc.length > 50) desc = desc.slice(0, 47) + '...';

      // Score from optimizer data
      const catCount = CATEGORIES.length;
      const trimPct = result.wasTrimmed
        ? (result.originalLength - result.optimizedLength) / result.originalLength
        : 0;
      const score = Math.min(99, Math.max(60, Math.round(catCount * (1 - trimPct) * 11.1)));

      const country = COUNTRIES[Math.floor(seededRandom() * COUNTRIES.length)]!;
      const hour = Math.floor(seededRandom() * 24);
      const minute = Math.floor(seededRandom() * 60);

      entries.push({
        platformId: pid,
        platformName: pname,
        platformIcon: picon,
        brandColor: brand,
        description: desc,
        optimisedPrompt: result.optimized,
        score,
        countryCode: country,
        localTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        likeCount: [0, 0, 0, 1, 2, 3, 5, 8, 12, 17, 24, 31, 47][Math.floor(seededRandom() * 13)]!,
      });
    }
  }

  // Sort by score descending
  entries.sort((a, b) => (b.score as number) - (a.score as number));

  writeFileSync(OUTPUT_PATH, JSON.stringify(entries, null, 2));
  console.log(`Generated ${entries.length} demo prompts → ${OUTPUT_PATH}`);
}

main().catch(console.error);
