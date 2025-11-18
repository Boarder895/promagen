// src/lib/ribbon/__tests__/selection.test.ts

import commoditiesCatalogJson from '@/data/commodities/commodities.catalog.json';
import fxPairsCatalogJson from '@/data/fx/fx.pairs.json';
import cryptoWhitelistCatalogJson from '@/data/crypto/whitelist.json';

import freeCommodityIdsJson from '@/data/selected/commodities.free.json';
import freeFxPairIdsJson from '@/data/selected/fx.pairs.free.json';
import freeCryptoIdsJson from '@/data/selected/crypto.free.json';

import {
  getFreeFxSelection,
  getPaidFxSelection,
  getFreeCryptoSelection,
  getPaidCryptoSelection,
  validateCommoditySelection,
  getFreeCommodities,
} from '@/lib/ribbon/selection';

import type {
  Commodity,
  CommodityId,
  FxPair,
  FxPairId,
  CryptoAsset,
  CryptoId,
} from '@/types/finance-ribbon.d';

const COMMODITIES = commoditiesCatalogJson as Commodity[];
const FX_PAIRS = fxPairsCatalogJson as FxPair[];
const CRYPTO_WHITELIST = cryptoWhitelistCatalogJson as CryptoAsset[];

const FREE_COMMODITY_IDS = freeCommodityIdsJson as CommodityId[];
const FREE_FX_IDS = freeFxPairIdsJson as FxPairId[];
const FREE_CRYPTO_IDS = freeCryptoIdsJson as CryptoId[];

/**
 * Build a valid 2–3–2 selection from the live catalogue:
 * 2 energy, 3 agriculture, 2 metals, in that order.
 */
function buildValidTwoThreeTwoIds(catalogue: Commodity[]): CommodityId[] {
  const energy = catalogue.filter((c) => c.group === 'energy');
  const agriculture = catalogue.filter((c) => c.group === 'agriculture');
  const metals = catalogue.filter((c) => c.group === 'metals');

  if (energy.length < 2) {
    throw new Error('Not enough energy commodities to build a 2–3–2 selection.');
  }
  if (agriculture.length < 3) {
    throw new Error('Not enough agriculture commodities to build a 2–3–2 selection.');
  }
  if (metals.length < 2) {
    throw new Error('Not enough metals commodities to build a 2–3–2 selection.');
  }

  // Non-null assertions are safe here: we just checked the lengths.
  const ids: CommodityId[] = [
    energy[0]!.id,
    energy[1]!.id,
    agriculture[0]!.id,
    agriculture[1]!.id,
    agriculture[2]!.id,
    metals[0]!.id,
    metals[1]!.id,
  ];

  return ids;
}

describe('ribbon selection helpers', () => {
  //
  // FX catalogue coverage
  //
  it('FX catalogue contains all free FX ids and at least five pairs', () => {
    expect(FX_PAIRS.length).toBeGreaterThanOrEqual(5);

    const fxIds = new Set(FX_PAIRS.map((p) => p.id.toLowerCase()));
    const expectedIds = FREE_FX_IDS.map((id) => id.toLowerCase());

    for (const id of expectedIds) {
      expect(fxIds.has(id)).toBe(true);
    }
  });

  //
  // Crypto catalogue coverage
  //
  it('Crypto whitelist contains all free crypto ids and at least five assets', () => {
    expect(CRYPTO_WHITELIST.length).toBeGreaterThanOrEqual(5);

    const cryptoIds = new Set(CRYPTO_WHITELIST.map((a) => a.id.toLowerCase()));
    const expectedIds = FREE_CRYPTO_IDS.map((id) => id.toLowerCase());

    for (const id of expectedIds) {
      expect(cryptoIds.has(id)).toBe(true);
    }
  });

  //
  // FX behaviour
  //
  it('getFreeFxSelection returns exactly five FX pairs in order', () => {
    const result = getFreeFxSelection();

    expect(result.mode).toBe('free');
    expect(result.items).toHaveLength(5);
    expect(result.ids).toHaveLength(5);

    const expectedIds = FREE_FX_IDS.map((id) => id.toLowerCase());
    expect(result.ids).toEqual(expectedIds);
    expect(result.items.map((p) => p.id)).toEqual(expectedIds);
  });

  it('getPaidFxSelection returns a paid selection when exactly five ids are provided', () => {
    const result = getPaidFxSelection(FREE_FX_IDS, { fallbackToFree: true });

    expect(result.mode).toBe('paid');
    expect(result.items).toHaveLength(5);

    const expectedIds = FREE_FX_IDS.map((id) => id.toLowerCase());
    expect(result.ids).toEqual(expectedIds);
    expect(result.items.map((p) => p.id)).toEqual(expectedIds);
  });

  it('getPaidFxSelection falls back to the free set when too few ids are provided', () => {
    const tooFewIds = FREE_FX_IDS.slice(0, 3);
    const result = getPaidFxSelection(tooFewIds, { fallbackToFree: true });

    expect(result.mode).toBe('freeFallback');
    expect(result.reason).toBe('too-few-items');

    const free = getFreeFxSelection();
    expect(result.ids).toEqual(free.ids);
    expect(result.items.map((p) => p.id)).toEqual(free.items.map((p) => p.id));
  });

  //
  // Crypto behaviour
  //
  it('getFreeCryptoSelection returns exactly five crypto assets in order', () => {
    const result = getFreeCryptoSelection();

    expect(result.mode).toBe('free');
    expect(result.items).toHaveLength(5);
    expect(result.ids).toHaveLength(5);

    const expectedIds = FREE_CRYPTO_IDS.map((id) => id.toLowerCase());
    expect(result.ids).toEqual(expectedIds);
    expect(result.items.map((a) => a.id)).toEqual(expectedIds);
  });

  it('getPaidCryptoSelection returns a paid selection when exactly five ids are provided', () => {
    const result = getPaidCryptoSelection(FREE_CRYPTO_IDS, { fallbackToFree: true });

    expect(result.mode).toBe('paid');
    expect(result.items).toHaveLength(5);

    const expectedIds = FREE_CRYPTO_IDS.map((id) => id.toLowerCase());
    expect(result.ids).toEqual(expectedIds);
    expect(result.items.map((a) => a.id)).toEqual(expectedIds);
  });

  it('getPaidCryptoSelection falls back to the free set when too few ids are provided', () => {
    const tooFewIds = FREE_CRYPTO_IDS.slice(0, 3);
    const result = getPaidCryptoSelection(tooFewIds, { fallbackToFree: true });

    expect(result.mode).toBe('freeFallback');
    expect(result.reason).toBe('too-few-items');

    const free = getFreeCryptoSelection();
    expect(result.ids).toEqual(free.ids);
    expect(result.items.map((a) => a.id)).toEqual(free.items.map((a) => a.id));
  });

  //
  // Commodities
  //
  it('validateCommoditySelection accepts a dynamically-built valid 2–3–2 layout and finds the centre group', () => {
    const validIds = buildValidTwoThreeTwoIds(COMMODITIES);
    const validation = validateCommoditySelection(COMMODITIES, validIds);

    expect(validation.isValid).toBe(true);
    expect(validation.items).toHaveLength(7);

    const counts = validation.countsByGroup;

    // every represented group has at least 2 items
    Object.values(counts).forEach((count) => {
      expect(count).toBeGreaterThanOrEqual(2);
    });

    // exactly one crown group with 3 items
    const crownGroups = Object.entries(counts).filter(([, count]) => count === 3);
    expect(crownGroups).toHaveLength(1);

    const centreGroupId = validation.centreGroupId;
    expect(centreGroupId).toBeDefined();
    if (centreGroupId) {
      expect(counts[centreGroupId]).toBe(3);
    }
  });

  it('validateCommoditySelection rejects an invalid layout (too few items)', () => {
    const tooFewCommodityIds = FREE_COMMODITY_IDS.slice(0, 5);
    const validation = validateCommoditySelection(COMMODITIES, tooFewCommodityIds);

    expect(validation.isValid).toBe(false);
    expect(validation.reason).toBe('too-few-items');
  });

  it('getFreeCommodities returns a valid layout for the current free selection', () => {
    const validation = getFreeCommodities(COMMODITIES);

    expect(validation.isValid).toBe(true);

    // Whatever the live free JSON resolves to (5 today, 7 later),
    // the helper should be internally consistent.
    const itemsLength = validation.items.length;
    expect(itemsLength).toBeGreaterThanOrEqual(1);

    const counts = validation.countsByGroup;
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(itemsLength);
  });
});
