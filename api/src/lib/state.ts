import { CRITERIA, PROVIDER_CANON, MARKET_CANON } from '../data/canon';
import type { ProviderApi, MarketApi } from '../types';

let providerSpark: Record<string, number[]> = {};
let marketSpark: Record<string, number[]> = {};

const nowIso = () => new Date().toISOString();

export const getProvidersLive = (): ProviderApi[] => {
  return PROVIDER_CANON.map((p, idx) => {
    const scores = CRITERIA.map((c, i) => ({
      criterion: c.id,
      raw_0_100: 60 + (i * 3) + ((idx + i) % 5) + (Math.random() * 5 - 2.5),
      weight: c.weight
    }));
    const wsum = CRITERIA.reduce((a, c) => a + c.weight, 0);
    const total = scores.reduce((a, s) => a + s.raw_0_100 * s.weight, 0) / wsum;

    const key = p.id;
    const spark = (providerSpark[key] ||= Array.from({ length: 24 }, () => total + (Math.random() * 2 - 1)));
    spark.shift();
    spark.push(total + (Math.random() * 2 - 1));

    const prev = spark[spark.length - 2] ?? total;
    const delta = total - prev;

    return {
      ...p,
      hasAffiliate: false,
      affiliateUrl: null,
      scores,
      total_weighted: Number(total.toFixed(2)),
      delta_24h: Number(delta.toFixed(2)),
      sparkline_24h: spark.map(v => Number(v.toFixed(2))),
      updatedAt: nowIso()
    };
  });
};

export const getMarketsLive = (): MarketApi[] => {
  return MARKET_CANON.map(m => {
    const key = m.id;
    const base = marketSpark[key]?.[marketSpark[key].length - 1] ?? (1000 + Math.random() * 500);
    const next = base + (Math.random() * 8 - 4);
    const spark = (marketSpark[key] ||= Array.from({ length: 24 }, () => base + (Math.random() * 8 - 4)));
    spark.shift();
    spark.push(next);

    const delta = next - base;
    const pct = base !== 0 ? (delta / base) * 100 : 0;

    return {
      id: m.id,
      displayName: m.displayName,
      timeZone: m.timeZone,
      indexSymbol: m.indexSymbol,
      last: Number(next.toFixed(2)),
      delta_points: Number(delta.toFixed(2)),
      delta_pct: Number(pct.toFixed(2)),
      sparkline_session: spark.map(v => Number(v.toFixed(2))),
      updatedAt: nowIso()
    };
  });
};
