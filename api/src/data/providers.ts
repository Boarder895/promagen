// Canonical 20 providers (ids must match the frontend)
export type ProviderId =
  | 'openai' | 'stability' | 'leonardo' | 'i23rf' | 'artistly'
  | 'adobe' | 'midjourney' | 'canva' | 'bing' | 'ideogram'
  | 'picsart' | 'fotor' | 'nightcafe' | 'playground' | 'pixlr'
  | 'deepai' | 'novelai' | 'lexica' | 'openart' | 'flux';

export type ProviderRow = {
  id: ProviderId;
  rank: number;
  score: number;       // 0..100
  delta: number;       // -5..+5 (example)
  trend: 'hot' | 'warm' | 'cool';
  chatter?: number;
  affiliate?: { url: string } | null;
  offer?: { label: string } | null;
};

export const PROVIDERS_ORDER: ProviderId[] = [
  'openai','stability','leonardo','i23rf','artistly',
  'adobe','midjourney','canva','bing','ideogram',
  'picsart','fotor','nightcafe','playground','pixlr',
  'deepai','novelai','lexica','openart','flux',
];

// quick demo generator; replace later with real scoring
export const demoProviderScores = (): ProviderRow[] => {
  const base = [
    92.1, 89.6, 87.4, 84.9, 82.5, 80.2, 78.0, 76.4, 74.9, 73.3,
    71.8, 70.1, 68.7, 67.0, 65.5, 64.0, 62.4, 60.9, 59.3, 57.8,
  ];
  const rows: ProviderRow[] = PROVIDERS_ORDER.map((id, i) => {
    const jitter = (Math.sin(Date.now() / 60000 + i) * 0.6);
    const score = Math.max(0, Math.min(100, base[i] + jitter));
    const delta = Math.round((jitter * 10)) / 10;
    const trend: ProviderRow['trend'] = delta > 0.2 ? 'hot' : delta < -0.2 ? 'cool' : 'warm';
    const chatter = Math.floor(40 + (i * 1.2) + Math.random() * 10);
    const affiliate = { url: `https://example.com/af/${id}` };
    const offer = i % 5 === 0 ? { label: 'Special' } : null;
    return { id, rank: i + 1, score, delta, trend, chatter, affiliate, offer };
  });
  return rows;
};
