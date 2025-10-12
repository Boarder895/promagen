import { useMemo } from 'react';

type Row = { provider: string; score: number; delta: number };

const SEED: Row[] = [
  { provider: 'OpenAI', score: 91, delta: +1.2 },
  { provider: 'Stability', score: 86, delta: -0.4 },
  { provider: 'Leonardo', score: 84, delta: +0.7 },
  { provider: 'DeepAI', score: 72, delta: 0 },
  { provider: 'Google Imagen', score: 83, delta: +0.2 },
  { provider: 'Lexica', score: 78, delta: +0.1 },
  { provider: 'NovelAI', score: 80, delta: +0.3 },
  { provider: 'EdenAI', score: 74, delta: -0.1 },
  { provider: 'Runware', score: 69, delta: +0.5 },
  { provider: 'Hive', score: 67, delta: +0.1 },
  { provider: 'Recraft', score: 76, delta: +0.2 },
  { provider: 'Artistly', score: 71, delta: +0.3 },
  { provider: 'Canva', score: 68, delta: +0.2 },
  { provider: 'Adobe Firefly', score: 79, delta: +0.4 },
  { provider: 'Midjourney', score: 90, delta: -0.2 },
  { provider: 'Bing Image Creator', score: 65, delta: +0.1 },
  { provider: 'NightCafe', score: 64, delta: 0 },
  { provider: 'Playground AI', score: 70, delta: +0.2 },
  { provider: 'Pixlr', score: 62, delta: +0.1 },
  { provider: 'Fotor', score: 60, delta: -0.1 },
];

export default function Leaderboard() {
  const rows = useMemo(
    () => [...SEED].sort((a, b) => b.score - a.score || a.provider.localeCompare(b.provider)),
    [],
  );

  return (
    <div style={{ marginTop: 24 }}>
      {rows.map((r, i) => (
        <div
          key={r.provider}
          style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr 80px 80px',
            gap: 12,
            padding: '12px 16px',
            borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,.08)',
            marginBottom: 10,
          }}
        >
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#ddd' }} />
          <div>
            <strong>
              {i + 1}. {r.provider}
            </strong>
          </div>
          <div style={{ textAlign: 'right' }}>{r.score.toFixed(1)}</div>
          <div style={{ textAlign: 'right' }}>
            {r.delta >= 0 ? `▲ ${r.delta.toFixed(1)}` : `▼ ${Math.abs(r.delta).toFixed(1)}`}
          </div>
        </div>
      ))}
    </div>
  );
}
