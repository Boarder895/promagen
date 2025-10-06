export type ProviderId =
  | 'openai' | 'stability' | 'leonardo' | 'i23rf' | 'artistly'
  | 'adobe' | 'midjourney' | 'canva' | 'bing' | 'ideogram'
  | 'picsart' | 'fotor' | 'nightcafe' | 'playground' | 'pixlr'
  | 'deepai' | 'novelai' | 'lexica' | 'openart' | 'flux';

export type CriterionId =
  | 'adoption' | 'quality' | 'speed' | 'cost' | 'safety' | 'innovation' | 'ethics';

export interface ProviderScore {
  criterion: CriterionId;
  raw_0_100: number;
  weight: number;
}

export interface ProviderApi {
  id: ProviderId;
  name: string;
  logoUrl: string;
  blurb: string;
  siteUrl: string;
  hasAffiliate: boolean;
  affiliateUrl: string | null;
  scores: ProviderScore[];
  total_weighted: number;
  delta_24h: number;
  sparkline_24h: number[];
  updatedAt: string;
}

export type ExchangeId =
  | 'asx' | 'tse' | 'sse' | 'dfm' | 'moex' | 'jse'
  | 'euronext' | 'xetra' | 'lse' | 'nyse' | 'nasdaq'
  | 'buenosaires' | 'tsx' | 'b3' | 'hkex' | 'sgx';

export interface MarketApi {
  id: ExchangeId;
  displayName: string;
  timeZone: string;
  indexSymbol: string;
  last: number;
  delta_points: number;
  delta_pct: number;
  sparkline_session: number[];
  updatedAt: string;
}
