import { PROVIDERS } from '@/data/providers';

export default function Leaderboard() {
  return (
    <div className="leaderboard">
      <div className="lb-grid">
        {PROVIDERS.map((p: any, i: number) => (
          <div key={p.id ?? i} className={`lb-tile ${i < 10 ? 'featured' : ''}`} title={p.tagline ?? ''}>
            <div className="lb-top">{String(p.name ?? p.displayName ?? 'Unknown')}</div>
            <div className="lb-tagline">{p.tagline ?? ''}</div>
            <div className="lb-row">
              <div className="lb-score">92 ?</div>
              <div className="lb-cta">
                <a href={String(p.affiliateUrl ?? p.url ?? p.website ?? '#')} target="_blank" rel="noreferrer">
                  Visit
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

