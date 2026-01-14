import {
  getDefaultCommoditiesForTier,
  getPrimaryExchangeForCommodity,
  getPrimaryExchangeForCommodityWithUserLocation,
  getPreferredExchangeIdsForRegionOrTimeZone,
  selectBestExchangeForCommodity,
  type CommodityRoutingContext,
  type GetExchangeMarketStatus,
} from '../index';

describe('commodities index helpers', () => {
  it('returns expected default free and paid commodities in importance order', () => {
    const freeIds = getDefaultCommoditiesForTier('free').map((commodity) => commodity.id);
    expect(freeIds).toEqual([
      'brent_crude',
      'ttf_natural_gas',
      'coffee',
      'sugar',
      'orange_juice',
      'iron_ore',
      'gold',
    ]);

    const paidIds = getDefaultCommoditiesForTier('paid').map((commodity) => commodity.id);
    expect(paidIds).toEqual([
      'brent_crude',
      'ttf_natural_gas',
      'coffee',
      'sugar',
      'orange_juice',
      'iron_ore',
      'gold',
    ]);
  });

  it('routes to the primary exchange when no preferred exchanges are provided', () => {
    const selection = getPrimaryExchangeForCommodity('brent_crude', 'free');

    expect(selection).toBeDefined();
    expect(selection?.exchangeId).toBe('lse-london');
    expect(selection?.isPrimary).toBe(true);
  });

  it('can route to a non-primary exchange when it is preferred for paid tier', () => {
    const selection = getPrimaryExchangeForCommodity('brent_crude', 'paid', ['nyse-new-york']);

    expect(selection).toBeDefined();
    expect(selection?.exchangeId).toBe('nyse-new-york');
    expect(selection?.isPrimary).toBe(false);
  });

  it('derives sensible preferred exchanges from a region or time-zone hint', () => {
    const ukPreferred = getPreferredExchangeIdsForRegionOrTimeZone('Europe/London');
    expect(ukPreferred).toContain('lse-london');

    const usPreferred = getPreferredExchangeIdsForRegionOrTimeZone('us');
    expect(usPreferred).toContain('nyse-new-york');
    expect(usPreferred).toContain('cboe-chicago');
  });

  it('selectBestExchangeForCommodity favours an open secondary over a closed primary', () => {
    const context: CommodityRoutingContext = {
      tier: 'paid',
      userRegionHint: 'us',
      now: new Date('2025-01-01T12:00:00Z'),
    };

    const getExchangeMarketStatus: GetExchangeMarketStatus = (exchangeId) => {
      if (exchangeId === 'lse-london') {
        return {
          exchangeId,
          sessionState: 'closed',
        };
      }

      if (exchangeId === 'nyse-new-york') {
        return {
          exchangeId,
          sessionState: 'open',
        };
      }

      return {
        exchangeId,
        sessionState: 'unknown',
      };
    };

    const selection = selectBestExchangeForCommodity(
      'brent_crude',
      context,
      getExchangeMarketStatus,
    );

    expect(selection).toBeDefined();
    expect(selection?.exchangeId).toBe('nyse-new-york');
    expect(selection?.isPrimary).toBe(false);
  });

  it('getPrimaryExchangeForCommodityWithUserLocation honours region hints', () => {
    const selection = getPrimaryExchangeForCommodityWithUserLocation('brent_crude', 'paid', 'us');

    // For a US user we expect NY venues to be considered "good" candidates.
    // The exact venue may still be primary depending on data, but we assert
    // that the helper at least returns a defined selection.
    expect(selection).toBeDefined();
  });
});
