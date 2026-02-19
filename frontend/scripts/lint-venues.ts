#!/usr/bin/env npx tsx
/**
 * scripts/lint-venues.ts
 * ============================================================================
 * VENUE TAXONOMY LINTER v8.0.0
 * ============================================================================
 *
 * Validates city-vibes.json venue → setting assignments against naming rules.
 * Flags entries where the venue name implies a different setting than assigned.
 *
 * Usage:
 *   npx tsx scripts/lint-venues.ts          # Lint and report
 *   npx tsx scripts/lint-venues.ts --strict  # Exit code 1 on ANY flag (including justified)
 *
 * Add to package.json:
 *   "lint:venues": "npx tsx scripts/lint-venues.ts"
 *
 * Rules:
 * 1. Street/Avenue/Road/Boulevard/Lane/Way → should be street|narrow (not waterfront|beach)
 * 2. Beach/Shore/Cove/Shoreline → should be beach|waterfront (not street|narrow|plaza)
 * 3. Quay/Wharf/Pier/Harbour/Harbor/Marina/Dock → should be waterfront (not street|narrow|plaza)
 * 4. Park/Garden/Botanic/Forest → should be park|elevated (not street|market|etc)
 * 5. Market/Bazaar/Souk/Mercado → should be market (not waterfront|street|etc)
 * 6. Canal → if waterfront, must be justified (canals are often just street names)
 * 7. Mall → should be market|street (not waterfront|beach)
 *
 * Entries with `overrideJustification` are flagged as JUSTIFIED (info, not error).
 * Only unjustified flags are ERRORs.
 *
 * Exit codes:
 *   0 = clean (0 errors, any number of justified flags)
 *   1 = errors found (unjustified taxonomy mismatches)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

interface Venue {
  name: string;
  setting: string;
  lightCharacter?: string[];
  overrideJustification?: string;
}

interface CityData {
  vibes?: string[];
  venues: Venue[];
}

interface CityVibesJson {
  cities: Record<string, CityData>;
}

interface LintFlag {
  rule: string;
  city: string;
  venueName: string;
  currentSetting: string;
  suggestedSettings: string[];
  justified: boolean;
  justification?: string;
}

// ── Lint Rules ─────────────────────────────────────────────────────────────

type LintRule = {
  id: string;
  description: string;
  /** Keywords to search for in venue name (lowercase). */
  keywords: string[];
  /** Settings that are WRONG for this keyword. */
  invalidSettings: string[];
  /** Settings that would be correct. */
  suggestedSettings: string[];
};

const RULES: LintRule[] = [
  {
    id: 'STREET_IN_WATER',
    description: 'Street-type name in waterfront/beach setting',
    keywords: ['street', 'avenue', 'road', 'boulevard', 'lane', 'strasse', 'gasse'],
    invalidSettings: ['waterfront', 'beach'],
    suggestedSettings: ['street', 'narrow'],
  },
  {
    id: 'BEACH_NOT_BEACH',
    description: 'Beach/shore name not in beach/waterfront setting',
    keywords: ['beach', 'shoreline'],
    invalidSettings: ['street', 'narrow', 'plaza', 'market', 'monument', 'elevated'],
    suggestedSettings: ['beach', 'waterfront'],
  },
  {
    id: 'QUAY_IN_NON_WATER',
    description: 'Quay/wharf/pier/harbour name in non-waterfront setting',
    keywords: ['quay', 'wharf', 'pier', 'harbour', 'harbor', 'marina', 'dock'],
    invalidSettings: ['street', 'narrow', 'plaza', 'park', 'market', 'monument'],
    suggestedSettings: ['waterfront'],
  },
  {
    id: 'PARK_NOT_PARK',
    description: 'Park/garden name not in park/elevated setting',
    keywords: ['park ', ' park', 'garden', 'botanic', 'botanical', 'forest'],
    invalidSettings: ['street', 'narrow', 'plaza', 'monument'],
    suggestedSettings: ['park', 'elevated'],
  },
  {
    id: 'MARKET_NOT_MARKET',
    description: 'Market/bazaar/souk name not in market setting',
    keywords: ['market', 'bazaar', 'souk', 'mercado'],
    invalidSettings: ['street', 'narrow', 'plaza', 'park', 'monument', 'elevated', 'beach'],
    suggestedSettings: ['market'],
  },
  {
    id: 'CANAL_AS_WATERFRONT',
    description: 'Canal in name tagged waterfront (often just a street name)',
    keywords: ['canal'],
    invalidSettings: ['waterfront'],
    suggestedSettings: ['street', 'narrow'],
  },
  {
    id: 'MALL_NOT_MARKET',
    description: 'Mall in name not tagged market/street',
    keywords: ['mall'],
    invalidSettings: ['waterfront', 'beach', 'park', 'elevated', 'monument'],
    suggestedSettings: ['market', 'street'],
  },
];

// ── Keywords to exclude from certain rules ─────────────────────────────────

/** If venue name contains "grand canal", skip the CANAL_AS_WATERFRONT rule. */
const CANAL_EXCEPTIONS = ['grand canal'];

/** If venue name contains "fish", skip the MARKET_NOT_MARKET rule. */
const MARKET_EXCEPTIONS = ['fish'];

// ── Main Lint Function ─────────────────────────────────────────────────────

function lintVenues(data: CityVibesJson): LintFlag[] {
  const flags: LintFlag[] = [];

  for (const [cityKey, cityData] of Object.entries(data.cities)) {
    for (const venue of cityData.venues) {
      const nl = venue.name.toLowerCase();

      for (const rule of RULES) {
        // Check exceptions
        if (rule.id === 'CANAL_AS_WATERFRONT' && CANAL_EXCEPTIONS.some(e => nl.includes(e))) continue;
        if (rule.id === 'MARKET_NOT_MARKET' && MARKET_EXCEPTIONS.some(e => nl.includes(e))) continue;

        // Check if any keyword matches AND setting is invalid
        const keywordMatch = rule.keywords.some(kw => nl.includes(kw));
        if (!keywordMatch) continue;

        const settingInvalid = rule.invalidSettings.includes(venue.setting);
        if (!settingInvalid) continue;

        flags.push({
          rule: rule.id,
          city: cityKey,
          venueName: venue.name,
          currentSetting: venue.setting,
          suggestedSettings: rule.suggestedSettings,
          justified: !!venue.overrideJustification,
          justification: venue.overrideJustification,
        });
      }
    }
  }

  return flags;
}

// ── CLI ────────────────────────────────────────────────────────────────────

function main(): void {
  const strict = process.argv.includes('--strict');

  const jsonPath = resolve(__dirname, '../src/data/vocabulary/weather/city-vibes.json');
  let raw: string;
  try {
    raw = readFileSync(jsonPath, 'utf-8');
  } catch {
    console.error(`ERROR: Cannot read ${jsonPath}`);
    process.exit(2);
  }

  const data: CityVibesJson = JSON.parse(raw);

  // Count totals
  let totalVenues = 0;
  let totalCities = 0;
  for (const cityData of Object.values(data.cities)) {
    totalCities++;
    totalVenues += cityData.venues.length;
  }

  const flags = lintVenues(data);
  const errors = flags.filter(f => !f.justified);
  const justified = flags.filter(f => f.justified);

  // Report header
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  VENUE TAXONOMY LINTER v8.0.0                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Scanned: ${totalCities} cities, ${totalVenues} venues`);
  console.log(`  Errors:  ${errors.length}`);
  console.log(`  Justified overrides: ${justified.length}`);
  console.log('');

  // Errors
  if (errors.length > 0) {
    console.log('── ERRORS (must fix or add overrideJustification) ──────────────');
    for (const f of errors) {
      console.log(`  ✗ ${f.rule}: [${f.city}] "${f.venueName}" → ${f.currentSetting}`);
      console.log(`    Suggested: ${f.suggestedSettings.join(' | ')}`);
    }
    console.log('');
  }

  // Justified
  if (justified.length > 0) {
    console.log('── JUSTIFIED OVERRIDES (info only) ─────────────────────────────');
    for (const f of justified) {
      console.log(`  ✓ ${f.rule}: [${f.city}] "${f.venueName}" → ${f.currentSetting}`);
      console.log(`    Reason: ${f.justification}`);
    }
    console.log('');
  }

  // Summary
  if (errors.length === 0 && justified.length === 0) {
    console.log('  ✓ All venue taxonomies are clean.');
    console.log('');
  }

  // Exit code
  if (errors.length > 0) {
    console.log(`FAIL: ${errors.length} error(s) found. Fix or justify.`);
    process.exit(1);
  }

  if (strict && justified.length > 0) {
    console.log(`STRICT: ${justified.length} justified override(s). Review if intentional.`);
    process.exit(1);
  }

  console.log('PASS');
  process.exit(0);
}

main();
